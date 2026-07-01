// Gestore delle connessioni vive verso le stampanti, in-process.
//
// Strategia (vedi piano): niente worker separato. Apriamo una connessione MQTT
// lazy alla prima richiesta di stato, facciamo un solo 'pushall', teniamo lo
// stato in RAM aggiornato dai delta, e ogni poll del browser legge la cache.
// Le connessioni non interrogate per un po' vengono chiuse (idle timeout).
//
// Funziona perché in self-host il processo Node (`next start`) è long-lived.

import { getAdapter, type LiveConnection } from "./adapter";
import { offlineStatus, type PrinterConnection, type PrinterStatus } from "./types";
// Registra gli adapter disponibili (side-effect import).
import "./bambu/lan";
import "./prusa/prusalink";
import "./moonraker/moonraker";

const IDLE_TIMEOUT_MS = 2 * 60_000; // chiudi dopo 2 min senza richieste
const SWEEP_INTERVAL_MS = 30_000;

interface Entry {
  conn: LiveConnection;
  key: string; // firma dei parametri di connessione
  lastAccess: number;
}

// Persistiamo su globalThis per sopravvivere agli hot-reload in dev.
type Store = { entries: Map<number, Entry>; sweeper: NodeJS.Timeout | null };
const g = globalThis as unknown as { __spoolioPrinterConns?: Store };
const store: Store = (g.__spoolioPrinterConns ??= { entries: new Map(), sweeper: null });

function connKey(c: PrinterConnection): string {
  return [
    c.conn_type,
    c.conn_host,
    c.conn_serial,
    c.conn_access_code,
    JSON.stringify(c.conn_config ?? null),
  ].join("|");
}

function ensureSweeper() {
  if (store.sweeper) return;
  store.sweeper = setInterval(() => {
    const now = Date.now();
    for (const [id, e] of store.entries) {
      if (now - e.lastAccess > IDLE_TIMEOUT_MS) {
        e.conn.close();
        store.entries.delete(id);
      }
    }
    if (store.entries.size === 0 && store.sweeper) {
      clearInterval(store.sweeper);
      store.sweeper = null;
    }
  }, SWEEP_INTERVAL_MS);
  // Non tenere vivo il processo solo per lo sweeper.
  store.sweeper.unref?.();
}

/** True se la stampante ha una connessione configurata e supportata.
 *  I requisiti specifici del protocollo (es. seriale per Bambu) li valida l'adapter. */
export function isConnectable(c: PrinterConnection): boolean {
  return Boolean(c.conn_type && c.conn_host && getAdapter(c.conn_type));
}

/** Stato corrente della stampante (apre/riusa la connessione viva). */
export async function getPrinterStatus(c: PrinterConnection): Promise<PrinterStatus> {
  if (!isConnectable(c)) return offlineStatus();

  const key = connKey(c);
  const existing = store.entries.get(c.id);
  if (existing && existing.key === key) {
    existing.lastAccess = Date.now();
    return existing.conn.getStatus();
  }
  // Parametri cambiati: chiudi la vecchia connessione.
  if (existing) {
    existing.conn.close();
    store.entries.delete(c.id);
  }

  const adapter = getAdapter(c.conn_type)!;
  try {
    const conn = await adapter.connect(c);
    store.entries.set(c.id, { conn, key, lastAccess: Date.now() });
    ensureSweeper();
    return conn.getStatus();
  } catch {
    return offlineStatus();
  }
}

/** Chiude e dimentica la connessione di una stampante (es. dopo modifica/elimina). */
export function closePrinterConnection(id: number): void {
  const e = store.entries.get(id);
  if (e) {
    e.conn.close();
    store.entries.delete(id);
  }
}
