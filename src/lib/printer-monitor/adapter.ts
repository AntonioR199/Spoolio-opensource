// Interfaccia adapter per il monitoraggio in lettura di una stampante.
// Un adapter incapsula il protocollo di un marchio (Bambu LAN, Moonraker, …) e
// mantiene una connessione viva in-process aggiornando lo stato normalizzato.

import type { PrinterConnection, PrinterStatus } from "./types";

/** Connessione viva verso una singola stampante. */
export interface LiveConnection {
  /** Ultimo stato noto (già normalizzato). */
  getStatus(): PrinterStatus;
  /** Chiude la connessione e libera le risorse. */
  close(): void;
}

export interface PrinterAdapter {
  /** Identificatore del tipo di connessione gestito (es. 'bambu-lan'). */
  readonly connType: string;
  /**
   * Apre una connessione viva. La promise si risolve al primo stato utile
   * (o dopo il timeout, con stato offline). Non deve mai lanciare: gli errori
   * vanno riflessi nello stato.
   */
  connect(conn: PrinterConnection): Promise<LiveConnection>;
}

const registry = new Map<string, PrinterAdapter>();

export function registerAdapter(adapter: PrinterAdapter): void {
  registry.set(adapter.connType, adapter);
}

export function getAdapter(connType: string | null | undefined): PrinterAdapter | undefined {
  if (!connType) return undefined;
  return registry.get(connType);
}
