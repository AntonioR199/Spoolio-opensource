// Gestione stampanti dell'utente (Supabase, per-utente).

import { createClient, requireUserId } from "@/lib/supabase/server";
import { getSettings } from "./settings";
import type { Printer } from "./types";

export async function listPrinters(): Promise<Printer[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("printer").select("*").order("created_at").order("id");
  return (data ?? []) as Printer[];
}

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
}

export async function upsertPrinter(p: PrinterInput): Promise<number> {
  const supabase = await createClient();
  const fields = {
    name: p.name,
    brand: p.brand,
    model: p.model,
    build_volume: p.build_volume,
    nozzle_diameter: p.nozzle_diameter,
    tech: p.tech,
    notes: p.notes,
  };
  if (p.id) {
    await supabase.from("printer").update(fields).eq("id", p.id);
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

/** Stampante predefinita: quella impostata, altrimenti la prima disponibile. */
export async function getDefaultPrinter(): Promise<Printer | null> {
  const id = (await getSettings()).defaultPrinterId;
  if (id) {
    const p = await getPrinter(id);
    if (p) return p;
  }
  return (await listPrinters())[0] ?? null;
}
