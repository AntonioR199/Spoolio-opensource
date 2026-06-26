// Persistenza fatture: il PDF è salvato su Supabase Storage (bucket 'invoices',
// sotto la cartella dell'utente: "<uid>/<file>.pdf"), con un record in tabella
// `invoice`. Collegamento ai filamenti via order_number (= spool.source).

import { createClient, requireUserId } from "@/lib/supabase/server";
import { compressPdf } from "./pdf";
import type { Invoice } from "./types";

const BUCKET = "invoices";

function sanitize(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
}

/** Carica il PDF su Storage e crea/aggiorna il record fattura. */
export async function saveInvoice(
  buffer: Buffer,
  meta: { order: string | null; originalName: string | null; date: string | null; unitCount: number }
): Promise<Invoice> {
  const supabase = await createClient();
  const uid = await requireUserId();
  const base = meta.order ? sanitize(meta.order) : `invoice-${Date.now()}`;
  const storage_path = `${uid}/${base}.pdf`;

  const compressed = await compressPdf(buffer);
  // Rimuove l'eventuale file esistente e ricarica (evita l'UPDATE su storage,
  // che non ha policy RLS; servono solo insert+delete).
  await supabase.storage.from(BUCKET).remove([storage_path]);
  const up = await supabase.storage.from(BUCKET).upload(storage_path, compressed, {
    contentType: "application/pdf",
    upsert: false,
  });
  if (up.error) throw new Error(up.error.message);

  if (meta.order) {
    const { data, error } = await supabase
      .from("invoice")
      .upsert(
        {
          user_id: uid,
          order_number: meta.order,
          storage_path,
          original_name: meta.originalName,
          invoice_date: meta.date,
          unit_count: meta.unitCount,
          uploaded_at: new Date().toISOString(),
        },
        { onConflict: "user_id,order_number" }
      )
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return data as Invoice;
  }

  const { data, error } = await supabase
    .from("invoice")
    .insert({
      user_id: uid,
      order_number: null,
      storage_path,
      original_name: meta.originalName,
      invoice_date: meta.date,
      unit_count: meta.unitCount,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as Invoice;
}

export async function listInvoices(): Promise<Invoice[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("invoice").select("*").order("uploaded_at", { ascending: false });
  return (data ?? []) as Invoice[];
}

export async function getInvoiceByOrder(order: string): Promise<Invoice | undefined> {
  const supabase = await createClient();
  const { data } = await supabase.from("invoice").select("*").eq("order_number", order).maybeSingle();
  return (data ?? undefined) as Invoice | undefined;
}

export async function getInvoiceById(id: number): Promise<Invoice | undefined> {
  const supabase = await createClient();
  const { data } = await supabase.from("invoice").select("*").eq("id", id).maybeSingle();
  return (data ?? undefined) as Invoice | undefined;
}

/** Dato un elenco di order_number, restituisce quelli con una fattura conservata. */
export async function ordersWithInvoice(sources: string[]): Promise<string[]> {
  if (sources.length === 0) return [];
  const supabase = await createClient();
  const { data } = await supabase.from("invoice").select("order_number").in("order_number", sources);
  return ((data ?? []) as Array<{ order_number: string | null }>)
    .map((r) => r.order_number)
    .filter((v): v is string => !!v);
}

/** Elimina una fattura: record DB + file su Storage. */
export async function deleteInvoice(id: number): Promise<boolean> {
  const supabase = await createClient();
  const inv = await getInvoiceById(id);
  if (!inv) return false;
  await supabase.storage.from(BUCKET).remove([inv.storage_path]);
  const { error } = await supabase.from("invoice").delete().eq("id", id);
  if (error) throw new Error(error.message);
  return true;
}

/** Scarica il PDF della fattura dallo Storage (bytes). */
export async function downloadInvoice(inv: Invoice): Promise<Buffer | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.storage.from(BUCKET).download(inv.storage_path);
  if (error || !data) return null;
  return Buffer.from(await data.arrayBuffer());
}
