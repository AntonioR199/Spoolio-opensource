// Base per gli adapter "pull" (HTTP): a differenza di Bambu (push MQTT), questi
// protocolli si interrogano periodicamente. PollConnection incapsula il timer di
// polling e la cache dello stato; l'adapter fornisce solo la funzione che fa una
// fetch e mappa la risposta in PrinterStatus.

import type { LiveConnection } from "./adapter";
import { offlineStatus, type PrinterStatus } from "./types";

const DEFAULT_INTERVAL_MS = 4_000;
const DEFAULT_TIMEOUT_MS = 8_000;

/** Numero tollerante: accetta string|number, altrimenti default. */
export function num(v: unknown, d = 0): number {
  const n = typeof v === "string" ? Number(v) : (v as number);
  return Number.isFinite(n) ? n : d;
}

/** GET/POST JSON con timeout via AbortController. Lancia su HTTP non-2xx o timeout. */
export async function fetchJson<T = unknown>(
  url: string,
  init: RequestInit = {},
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

/** Costruisce l'URL base da un host: aggiunge http:// e la porta se mancano. */
export function httpBase(host: string, port?: number): string {
  const trimmed = host.trim().replace(/\/+$/, "");
  const hasScheme = /^https?:\/\//i.test(trimmed);
  const bare = hasScheme ? trimmed.replace(/^https?:\/\//i, "") : trimmed;
  const hasPort = /:\d+$/.test(bare);
  const scheme = hasScheme ? "" : "http://";
  const withPort = !hasPort && port ? `:${port}` : "";
  return `${scheme}${trimmed}${withPort}`;
}

/** Connessione viva basata su polling periodico di un endpoint HTTP. */
export class PollConnection implements LiveConnection {
  private status: PrinterStatus = offlineStatus();
  private timer: NodeJS.Timeout | null = null;
  private closed = false;

  constructor(
    private readonly fetchStatus: () => Promise<PrinterStatus>,
    private readonly intervalMs = DEFAULT_INTERVAL_MS
  ) {}

  /** Avvia il polling e risolve al primo tentativo (o dopo il timeout della fetch). */
  async start(): Promise<void> {
    await this.tick();
    this.timer = setInterval(() => void this.tick(), this.intervalMs);
    this.timer.unref?.();
  }

  private async tick(): Promise<void> {
    if (this.closed) return;
    try {
      this.status = await this.fetchStatus();
    } catch {
      this.status = offlineStatus();
    }
  }

  getStatus(): PrinterStatus {
    return this.status;
  }

  close(): void {
    this.closed = true;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
