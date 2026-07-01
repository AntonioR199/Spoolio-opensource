// Tipi condivisi per l'inventario filamenti.

export type SpoolFormat = "spool" | "refill";
// sealed = chiusa/sigillata, open = in uso (countdown asciugatura attivo), empty = finita
export type SpoolStatus = "sealed" | "open" | "empty";

/** Una singola unità fisica di filamento (bobina o ricarica). */
export interface Spool {
  id: number;
  user_id?: string;
  brand: string;
  material: string; // PLA, PETG, Support, ...
  variant: string | null; // Matte, Basic, Pure, Translucent, Silk+, ...
  color_name: string;
  color_code: string | null; // codice colore Bambu, es. "11101"
  color_hex: string | null; // #rrggbb per l'anteprima
  format: SpoolFormat | null; // salvato ma NON dimensione principale
  diameter_mm: number;
  nominal_weight_g: number;
  sku: string | null;
  source: string | null; // numero ordine fattura / 'pre-existing' / 'manual'
  purchase_date: string | null; // ISO yyyy-mm-dd
  unit_price: number | null;
  status: SpoolStatus;
  remaining_g: number | null; // null finché non si passa al tracking a grammi
  opened_at: string | null; // quando è stata messa in uso (ISO); àncora del countdown asciugatura
  last_dried_at: string | null; // ultima asciugatura (ISO); flag "da asciugare" derivato per soglia giorni
  consumed_at: string | null; // quando la bobina è stata terminata
  notes: string | null;
  created_at: string;
}

/** Riga aggregata mostrata in dashboard: una per marca+tipo+colore. */
export interface InventoryRow {
  brand: string;
  material: string;
  variant: string | null;
  color_name: string;
  color_code: string | null;
  color_hex: string | null;
  quantity: number; // unità disponibili (status != empty)
  total_weight_g: number; // somma pesi nominali, utile per stima scorta
  unit_price: number | null; // prezzo medio per unità del gruppo (null se nessuna unità ha prezzo)
  low_stock: boolean;
  in_use: number; // quante unità del gruppo sono in uso (status='open')
  last_dried_at: string | null; // asciugatura più recente tra le unità in uso (ISO), null se nessuna
  needs_drying: boolean; // true se almeno un'unità in uso ha superato la soglia di giorni dall'asciugatura/apertura
}

/** Voce estratta da una fattura, prima della conferma utente. */
export interface DraftItem {
  brand: string;
  material: string;
  variant: string | null;
  color_name: string;
  color_code: string | null;
  color_hex: string | null;
  format: SpoolFormat | null;
  diameter_mm: number;
  nominal_weight_g: number;
  sku: string | null;
  unit_price: number | null;
  quantity: number;
  include: boolean; // se false, escluso dall'import (es. accessori)
}

/** Store di riferimento per il riacquisto. */
export interface Store {
  id: number;
  name: string;
  url: string | null;
  search_url_template: string | null;
  created_at: string;
}

/** Marchio, collegato a uno store. */
export interface Brand {
  id: number;
  name: string;
  store_id: number | null;
  product_url_template: string | null;
  created_at: string;
}

/** Marchio con i dati dello store collegato (join). */
export interface BrandWithStore extends Brand {
  store_name: string | null;
  store_url: string | null;
  store_search: string | null;
}

/** Stampante 3D dell'utente. */
export interface Printer {
  id: number;
  name: string;
  brand: string | null;
  model: string | null;
  build_volume: string | null;
  nozzle_diameter: number | null;
  tech: string | null;
  notes: string | null;
  /** Integrazione in lettura (LAN). null = non collegata. */
  conn_type: string | null; // es. 'bambu-lan'
  conn_host: string | null;
  conn_serial: string | null;
  conn_access_code: string | null;
  created_at: string;
}

/** Fattura caricata e conservata (PDF su Supabase Storage). */
export interface Invoice {
  id: number;
  order_number: string | null;
  storage_path: string; // percorso nel bucket 'invoices' (<uid>/<file>.pdf)
  original_name: string | null;
  invoice_date: string | null;
  unit_count: number | null;
  uploaded_at: string;
}

/** Voce esaurita, con link di riacquisto risolto. */
export interface EmptyRow {
  brand: string;
  material: string;
  variant: string | null;
  color_name: string;
  color_code: string | null;
  color_hex: string | null;
  quantity: number; // unità esaurite
  sku: string | null;
  repurchase_url: string | null;
}

export interface ParseResult {
  method: "bambu" | "ai" | "none";
  items: DraftItem[];
  warnings: string[];
  source: string | null; // numero ordine se rilevato
  purchase_date: string | null;
}
