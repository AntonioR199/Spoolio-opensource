// Adapter Prusa in modalità LAN via PrusaLink (HTTP locale sulla stampante).
// API di riferimento: https://github.com/prusa3d/Prusa-Link-Web (OpenAPI /api/v1).
//
// Connessione: GET http://{host}/api/v1/status (+ /api/v1/job per il nome file),
// autenticazione con header `X-Api-Key: {api key}` presa da Impostazioni → Rete →
// PrusaLink sulla stampante. Protocollo pull: si interroga ogni pochi secondi.

import { registerAdapter, type LiveConnection, type PrinterAdapter } from "../adapter";
import { fetchJson, httpBase, num, PollConnection } from "../pollConnection";
import { type PrinterConnection, type PrinterStatus, type PrintState } from "../types";

const REQUEST_TIMEOUT_MS = 8_000;

// Stati PrusaLink → stato normalizzato.
const STATE_MAP: Record<string, PrintState> = {
  IDLE: "IDLE",
  READY: "IDLE",
  PRINTING: "RUNNING",
  PAUSED: "PAUSE",
  FINISHED: "FINISH",
  STOPPED: "FAILED",
  ERROR: "FAILED",
  BUSY: "PREPARE",
  ATTENTION: "PAUSE",
};

interface PrusaStatus {
  printer?: {
    state?: string;
    temp_nozzle?: number;
    target_nozzle?: number;
    temp_bed?: number;
    target_bed?: number;
  };
  job?: { progress?: number; time_remaining?: number };
}

interface PrusaJob {
  file?: { name?: string; display_name?: string };
}

function mapStatus(status: PrusaStatus, job: PrusaJob | null): PrinterStatus {
  const printer = status.printer ?? {};
  const state: PrintState = STATE_MAP[String(printer.state ?? "").toUpperCase()] ?? "IDLE";

  const out: PrinterStatus = {
    online: true,
    state,
    temps: {
      nozzle: num(printer.temp_nozzle),
      nozzleTarget: num(printer.target_nozzle),
      bed: num(printer.temp_bed),
      bedTarget: num(printer.target_bed),
    },
    ams: [],
    errors: [],
    fetchedAt: new Date().toISOString(),
  };

  const j = status.job;
  if ((state === "RUNNING" || state === "PAUSE" || state === "FINISH") && j) {
    out.job = {
      progressPct: num(j.progress),
      layer: 0, // PrusaLink non espone i layer nello status
      totalLayers: 0,
      remainingSec: num(j.time_remaining),
      fileName: job?.file?.display_name || job?.file?.name || undefined,
    };
  }

  return out;
}

export const prusaLinkAdapter: PrinterAdapter = {
  connType: "prusalink",
  async connect(conn: PrinterConnection): Promise<LiveConnection> {
    const base = httpBase(conn.conn_host ?? "");
    const apiKey = conn.conn_access_code ?? "";
    const headers: Record<string, string> = apiKey ? { "X-Api-Key": apiKey } : {};

    const c = new PollConnection(async () => {
      const status = await fetchJson<PrusaStatus>(`${base}/api/v1/status`, { headers }, REQUEST_TIMEOUT_MS);
      let job: PrusaJob | null = null;
      try {
        job = await fetchJson<PrusaJob>(`${base}/api/v1/job`, { headers }, REQUEST_TIMEOUT_MS);
      } catch {
        /* nessun job in corso: /api/v1/job può rispondere 204/404 */
      }
      return mapStatus(status, job);
    });
    await c.start();
    return c;
  },
};

registerAdapter(prusaLinkAdapter);
