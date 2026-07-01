// Adapter Bambu Lab in modalità LAN (MQTT locale su TLS 8883).
// Protocollo di riferimento: https://github.com/Doridian/OpenBambuAPI/blob/main/mqtt.md
//
// Connessione: mqtts://{host}:8883, user 'bblp', password = access code LAN,
// certificato self-signed (rejectUnauthorized:false). Si sottoscrive a
// device/{serial}/report e si pubblica un 'pushall' su device/{serial}/request
// per ottenere lo snapshot completo; poi arrivano delta parziali da mergiare.

import mqtt, { type MqttClient } from "mqtt";
import { registerAdapter, type LiveConnection, type PrinterAdapter } from "../adapter";
import { offlineStatus, type PrinterConnection, type PrinterStatus, type PrintState } from "../types";

const FIRST_REPORT_TIMEOUT_MS = 10_000;

const STATE_MAP: Record<string, PrintState> = {
  IDLE: "IDLE",
  PREPARE: "PREPARE",
  SLICING: "PREPARE",
  RUNNING: "RUNNING",
  PAUSE: "PAUSE",
  FINISH: "FINISH",
  FAILED: "FAILED",
};

type Dict = Record<string, unknown>;

/** Merge ricorsivo dei delta: gli oggetti si fondono, gli array si sostituiscono. */
function deepMerge(target: Dict, patch: Dict): Dict {
  for (const [k, v] of Object.entries(patch)) {
    if (v && typeof v === "object" && !Array.isArray(v) && typeof target[k] === "object" && target[k] && !Array.isArray(target[k])) {
      target[k] = deepMerge(target[k] as Dict, v as Dict);
    } else {
      target[k] = v;
    }
  }
  return target;
}

const num = (v: unknown, d = 0): number => {
  const n = typeof v === "string" ? Number(v) : (v as number);
  return Number.isFinite(n) ? n : d;
};

/** "RRGGBBAA" (Bambu) → "#RRGGBB". */
function bambuColorToHex(c: unknown): string | undefined {
  if (typeof c !== "string" || c.length < 6) return undefined;
  return `#${c.slice(0, 6).toUpperCase()}`;
}

/** Mappa lo stato grezzo `print` di Bambu nel modello normalizzato. */
function mapStatus(print: Dict | undefined, connected: boolean): PrinterStatus {
  if (!print || !connected) return { ...offlineStatus(), online: connected };

  const gcodeState = String(print.gcode_state ?? "").toUpperCase();
  const state: PrintState = STATE_MAP[gcodeState] ?? "IDLE";

  const status: PrinterStatus = {
    online: true,
    state,
    temps: {
      nozzle: num(print.nozzle_temper),
      nozzleTarget: num(print.nozzle_target_temper),
      bed: num(print.bed_temper),
      bedTarget: num(print.bed_target_temper),
      chamber: print.chamber_temper != null ? num(print.chamber_temper) : undefined,
    },
    ams: [],
    errors: [],
    fetchedAt: new Date().toISOString(),
  };

  // Job in corso.
  if (state === "RUNNING" || state === "PAUSE" || state === "PREPARE" || state === "FINISH") {
    status.job = {
      progressPct: num(print.mc_percent),
      layer: num(print.layer_num),
      totalLayers: num(print.total_layer_num),
      remainingSec: num(print.mc_remaining_time) * 60, // minuti → secondi
      fileName: (print.subtask_name as string) || (print.gcode_file as string) || undefined,
    };
  }

  // AMS.
  const amsRoot = print.ams as Dict | undefined;
  const trayNow = amsRoot ? num(amsRoot.tray_now, -1) : -1;
  const units = (amsRoot?.ams as Dict[] | undefined) ?? [];
  status.ams = units.map((unit, unitIdx) => {
    const trays = ((unit.tray as Dict[] | undefined) ?? []).map((tray) => {
      const trayIdx = num(tray.id, 0);
      const absIndex = unitIdx * 4 + trayIdx;
      const type = (tray.tray_type as string) || undefined;
      const remain = tray.remain != null ? num(tray.remain, -1) : undefined;
      return {
        index: trayIdx,
        type: type && type.length ? type : undefined,
        colorHex: bambuColorToHex(tray.tray_color),
        remainPct: remain != null && remain >= 0 ? remain : undefined,
        active: trayNow === absIndex,
      };
    });
    return {
      id: String(unit.id ?? unitIdx),
      humidity: unit.humidity != null ? num(unit.humidity) : undefined,
      temp: unit.temp != null ? num(unit.temp) : undefined,
      trays,
    };
  });

  // Bobina esterna (vt_tray).
  const vt = print.vt_tray as Dict | undefined;
  if (vt && (vt.tray_type || vt.tray_color)) {
    status.externalSpool = {
      type: (vt.tray_type as string) || undefined,
      colorHex: bambuColorToHex(vt.tray_color),
    };
  }

  // Errori HMS (mostriamo solo il conteggio/codici grezzi in v1).
  const hms = print.hms as Dict[] | undefined;
  if (Array.isArray(hms) && hms.length) {
    status.errors = hms.map((h) => `HMS ${h.attr ?? ""}/${h.code ?? ""}`);
  }

  return status;
}

class BambuLanConnection implements LiveConnection {
  private client: MqttClient;
  private print: Dict = {};
  private hasData = false;
  private connected = false;
  private readonly reportTopic: string;
  private readonly requestTopic: string;

  constructor(private conn: PrinterConnection) {
    const host = conn.conn_host!;
    const serial = conn.conn_serial!;
    this.reportTopic = `device/${serial}/report`;
    this.requestTopic = `device/${serial}/request`;

    this.client = mqtt.connect(`mqtts://${host}:8883`, {
      username: "bblp",
      password: conn.conn_access_code ?? "",
      rejectUnauthorized: false, // certificato self-signed della stampante
      reconnectPeriod: 5_000,
      connectTimeout: 8_000,
      clientId: `spoolio_${serial}_${Math.random().toString(16).slice(2, 8)}`,
    });

    this.client.on("connect", () => {
      this.connected = true;
      this.client.subscribe(this.reportTopic, () => this.pushAll());
    });
    this.client.on("message", (_topic, payload) => this.onMessage(payload));
    this.client.on("error", () => {
      /* gli errori diventano stato offline; mqtt.js ritenta da solo */
    });
    this.client.on("close", () => {
      this.connected = false;
    });
    this.client.on("offline", () => {
      this.connected = false;
    });
  }

  private pushAll() {
    this.client.publish(
      this.requestTopic,
      JSON.stringify({ pushing: { sequence_id: "0", command: "pushall" } })
    );
  }

  private onMessage(payload: Buffer) {
    try {
      const msg = JSON.parse(payload.toString()) as Dict;
      if (msg.print && typeof msg.print === "object") {
        deepMerge(this.print, msg.print as Dict);
        this.hasData = true;
      }
    } catch {
      /* payload non-JSON: ignora */
    }
  }

  /** Risolve quando arriva il primo report utile o dopo il timeout. */
  waitForFirst(): Promise<void> {
    return new Promise((resolve) => {
      if (this.hasData) return resolve();
      const timer = setTimeout(resolve, FIRST_REPORT_TIMEOUT_MS);
      const onMsg = () => {
        if (this.hasData) {
          clearTimeout(timer);
          this.client.removeListener("message", onMsg);
          resolve();
        }
      };
      this.client.on("message", onMsg);
    });
  }

  getStatus(): PrinterStatus {
    return mapStatus(this.hasData ? this.print : undefined, this.connected);
  }

  close(): void {
    this.client.end(true);
  }
}

export const bambuLanAdapter: PrinterAdapter = {
  connType: "bambu-lan",
  async connect(conn: PrinterConnection): Promise<LiveConnection> {
    const c = new BambuLanConnection(conn);
    await c.waitForFirst();
    return c;
  },
};

registerAdapter(bambuLanAdapter);
