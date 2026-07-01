// Modello di stato stampante NORMALIZZATO, indipendente dal marchio.
// Ogni adapter (Bambu, Moonraker, OctoPrint, …) mappa i dati grezzi in questo
// modello, così la UI resta unica.

export type PrintState =
  | "IDLE"
  | "PREPARE"
  | "RUNNING"
  | "PAUSE"
  | "FINISH"
  | "FAILED"
  | "OFFLINE";

export interface AmsTray {
  index: number;
  type?: string; // es. "PLA", "PETG"
  colorHex?: string; // "#RRGGBB"
  remainPct?: number; // 0..100 (-1/undefined = sconosciuto)
  active: boolean; // tray attualmente in uso
}

export interface AmsUnit {
  id: string;
  humidity?: number; // indice 1..5 (dato dalla stampante)
  temp?: number; // °C
  trays: AmsTray[];
}

export interface PrinterStatus {
  online: boolean;
  state: PrintState;
  temps: {
    nozzle: number;
    nozzleTarget: number;
    bed: number;
    bedTarget: number;
    chamber?: number;
  };
  job?: {
    progressPct: number; // 0..100
    layer: number;
    totalLayers: number;
    remainingSec: number;
    fileName?: string;
  };
  ams: AmsUnit[];
  externalSpool?: { type?: string; colorHex?: string };
  errors: string[];
  fetchedAt: string; // ISO
}

/** Dati di connessione salvati sulla stampante (sottoinsieme di Printer). */
export interface PrinterConnection {
  id: number;
  conn_type: string | null;
  conn_host: string | null;
  conn_serial: string | null;
  conn_access_code: string | null;
  /** Parametri non segreti specifici del protocollo (es. { port: 7125 }). */
  conn_config?: Record<string, unknown> | null;
}

/** Stato "offline" di comodo quando non riusciamo a leggere la stampante. */
export function offlineStatus(): PrinterStatus {
  return {
    online: false,
    state: "OFFLINE",
    temps: { nozzle: 0, nozzleTarget: 0, bed: 0, bedTarget: 0 },
    ams: [],
    errors: [],
    fetchedAt: new Date().toISOString(),
  };
}
