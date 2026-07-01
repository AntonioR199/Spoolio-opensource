// Gestione stampanti dell'utente (Supabase, per-utente).

import { createClient, requireUserId } from "@/lib/supabase/server";
import { getSettings } from "./settings";
import type { Printer } from "./types";

/** Stampante senza il segreto (access code): sicura da inviare al browser. */
export type SafePrinter = Omit<Printer, "conn_access_code"> & { conn_configured: boolean };

function toSafe(p: Printer): SafePrinter {
  const { conn_access_code, ...rest } = p;
  return { ...rest, conn_configured: Boolean(conn_access_code) };
}

/** Elenco stampanti sanitizzato (senza access code) per l'uso lato client. */
export async function listPrinters(): Promise<SafePrinter[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("printer").select("*").order("created_at").order("id");
  return ((data ?? []) as Printer[]).map(toSafe);
}

/** Stampante completa (incluso l'access code): SOLO per uso lato server. */
export async function getPrinter(id: number): Promise<Printer | undefined> {
  const supabase = await createClient();
  const { data } = await supabase.from("printer").select("*").eq("id", id).maybeSingle();
  return (data ?? undefined) as Printer | undefined;
}

export interface PrinterInput {
  id?: number;
  name: string;
  brand: string | null;
  model: string | null;
  build_volume: string | null;
  nozzle_diameter: number | null;
  tech: string | null;
  notes: string | null;
  // Connessione in lettura: opzionali. Se `undefined` non vengono toccati (le
  // modifiche ai campi base non cancellano la connessione già salvata).
  conn_type?: string | null;
  conn_host?: string | null;
  conn_serial?: string | null;
  conn_access_code?: string | null;
}

export async function upsertPrinter(p: PrinterInput): Promise<number> {
  const supabase = await createClient();
  const fields: Record<string, unknown> = {
    name: p.name,
    brand: p.brand,
    model: p.model,
    build_volume: p.build_volume,
    nozzle_diameter: p.nozzle_diameter,
    tech: p.tech,
    notes: p.notes,
  };
  // Includi i campi di connessione solo se esplicitamente forniti.
  if (p.conn_type !== undefined) fields.conn_type = p.conn_type;
  if (p.conn_host !== undefined) fields.conn_host = p.conn_host;
  if (p.conn_serial !== undefined) fields.conn_serial = p.conn_serial;
  if (p.conn_access_code !== undefined) fields.conn_access_code = p.conn_access_code;
  if (p.id) {
    const { error } = await supabase.from("printer").update(fields).eq("id", p.id);
    if (error) throw new Error(error.message);
    return p.id;
  }
  const uid = await requireUserId();
  const { data, error } = await supabase
    .from("printer")
    .insert({ user_id: uid, ...fields })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data!.id as number;
}

export async function deletePrinter(id: number): Promise<void> {
  const supabase = await createClient();
  await supabase.from("printer").delete().eq("id", id);
}

/** Stampante predefinita (sanitizzata): quella impostata, altrimenti la prima disponibile. */
export async function getDefaultPrinter(): Promise<SafePrinter | null> {
  const id = (await getSettings()).defaultPrinterId;
  if (id) {
    const p = await getPrinter(id);
    if (p) return toSafe(p);
  }
  return (await listPrinters())[0] ?? null;
}
