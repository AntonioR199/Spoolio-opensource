// Adapter Klipper via Moonraker (HTTP locale). Copre Creality K1/K2, Elegoo
// Centauri, Voron, Sonic Pad e in generale ogni macchina con Klipper+Moonraker.
// API di riferimento: https://moonraker.readthedocs.io/ (Printer Objects).
//
// Connessione: GET http://{host}:{port}/printer/objects/query?... (porta 7125 di
// default, in conn_config.port). In LAN di norma senza auth; se è impostata una
// API key la inviamo come header `X-Api-Key`. Protocollo pull.

import { registerAdapter, type LiveConnection, type PrinterAdapter } from "../adapter";
import { fetchJson, httpBase, num, PollConnection } from "../pollConnection";
import { offlineStatus, type PrinterConnection, type PrinterStatus, type PrintState } from "../types";

const REQUEST_TIMEOUT_MS = 8_000;
const DEFAULT_PORT = 7125;
const QUERY = "extruder&heater_bed&print_stats&display_status&virtual_sdcard";

// Stati Klipper (print_stats.state) → stato normalizzato.
const STATE_MAP: Record<string, PrintState> = {
  standby: "IDLE",
  printing: "RUNNING",
  paused: "PAUSE",
  complete: "FINISH",
  cancelled: "FAILED",
  error: "FAILED",
};

type Dict = Record<string, unknown>;

function mapStatus(s: Dict): PrinterStatus {
  const ps = (s.print_stats as Dict) ?? {};
  const ext = (s.extruder as Dict) ?? {};
  const bed = (s.heater_bed as Dict) ?? {};
  const disp = (s.display_status as Dict) ?? {};
  const state: PrintState = STATE_MAP[String(ps.state ?? "").toLowerCase()] ?? "IDLE";

  const out: PrinterStatus = {
    online: true,
    state,
    temps: {
      nozzle: num(ext.temperature),
      nozzleTarget: num(ext.target),
      bed: num(bed.temperature),
      bedTarget: num(bed.target),
    },
    ams: [],
    errors: [],
    fetchedAt: new Date().toISOString(),
  };

  if (state === "RUNNING" || state === "PAUSE" || state === "FINISH") {
    const progressFrac = num(disp.progress); // 0..1
    const printDuration = num(ps.print_duration);
    const info = (ps.info as Dict) ?? {};
    // Moonraker non fornisce un tempo residuo: lo stimiamo dalla durata/progresso.
    const remaining = progressFrac > 0 ? (printDuration * (1 - progressFrac)) / progressFrac : 0;
    out.job = {
      progressPct: Math.round(progressFrac * 100),
      layer: num(info.current_layer),
      totalLayers: num(info.total_layer),
      remainingSec: Math.round(Math.max(0, remaining)),
      fileName: (ps.filename as string) || undefined,
    };
  }

  return out;
}

export const moonrakerAdapter: PrinterAdapter = {
  connType: "moonraker",
  async connect(conn: PrinterConnection): Promise<LiveConnection> {
    const port = num((conn.conn_config as Dict | undefined)?.port, DEFAULT_PORT) || DEFAULT_PORT;
    const base = httpBase(conn.conn_host ?? "", port);
    const apiKey = conn.conn_access_code ?? "";
    const headers: Record<string, string> = apiKey ? { "X-Api-Key": apiKey } : {};
    const url = `${base}/printer/objects/query?${QUERY}`;

    const c = new PollConnection(async () => {
      const resp = await fetchJson<{ result?: { status?: Dict } }>(url, { headers }, REQUEST_TIMEOUT_MS);
      const status = resp.result?.status;
      if (!status) return offlineStatus();
      return mapStatus(status);
    });
    await c.start();
    return c;
  },
};

registerAdapter(moonrakerAdapter);
