/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import Database from "better-sqlite3";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import { createClient, requireUserId } from "@/lib/supabase/server";
import { upsertStore, updateBrand } from "@/lib/catalog";
import { upsertPrinter } from "@/lib/printers";
import { apiError } from "@/lib/apiError";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_DB_BYTES = 50 * 1024 * 1024; // 50 MB

// Ripristino completo da backup SQLite (anche il vecchio backup pre-cloud):
// legge il .db e ricarica i dati nell'account corrente su Supabase.
export async function POST(req: NextRequest) {
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Nessun file." }, { status: 400 });
  if (file.size > MAX_DB_BYTES) {
    return NextResponse.json({ error: "Backup troppo grande (max 50 MB)." }, { status: 413 });
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.subarray(0, 15).toString("latin1") !== "SQLite format 3") {
    return NextResponse.json({ error: "Il file non è un database SQLite valido." }, { status: 400 });
  }

  const tmp = path.join(os.tmpdir(), `spoolio-import-${Date.now()}.db`);
  fs.writeFileSync(tmp, buffer);
  try {
    const db = new Database(tmp, { readonly: true });
    const supabase = await createClient();
    const uid = await requireUserId();
    const has = (t: string) =>
      !!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(t);

    // Svuota i dati correnti dell'utente (RLS limita alle sue righe).
    await supabase.from("spool").delete().gte("id", 0);
    await supabase.from("brand").delete().gte("id", 0);
    await supabase.from("store").delete().gte("id", 0);
    await supabase.from("printer").delete().gte("id", 0);

    // Store (rimappa gli id per nome).
    const oldStoreIdName = new Map<number, string>();
    const nameToNewStore = new Map<string, number>();
    if (has("store")) {
      for (const s of db.prepare("SELECT * FROM store").all() as any[]) {
        oldStoreIdName.set(s.id, s.name);
        const id = await upsertStore({
          name: s.name,
          url: s.url ?? null,
          search_url_template: s.search_url_template ?? null,
        });
        nameToNewStore.set(s.name, id);
      }
    }

    // Brand (collega allo store per nome).
    if (has("brand")) {
      for (const b of db.prepare("SELECT * FROM brand").all() as any[]) {
        const storeName = b.store_id != null ? oldStoreIdName.get(b.store_id) : undefined;
        await updateBrand({
          name: b.name,
          store_id: storeName ? nameToNewStore.get(storeName) ?? null : null,
          product_url_template: b.product_url_template ?? null,
        });
      }
    }

    // Stampanti.
    if (has("printer")) {
      for (const p of db.prepare("SELECT * FROM printer").all() as any[]) {
        await upsertPrinter({
          name: p.name,
          brand: p.brand ?? null,
          model: p.model ?? null,
          build_volume: p.build_volume ?? null,
          nozzle_diameter: p.nozzle_diameter ?? null,
          tech: p.tech ?? null,
          notes: p.notes ?? null,
        });
      }
    }

    // Impostazioni.
    if (has("setting")) {
      const rows = (db.prepare("SELECT key, value FROM setting").all() as any[]).map((r) => ({
        user_id: uid,
        key: r.key,
        value: r.value,
      }));
      if (rows.length) await supabase.from("setting").upsert(rows, { onConflict: "user_id,key" });
    }

    // Filamenti (preserva stato, prezzo, date, consumo).
    let units = 0;
    if (has("spool")) {
      const cols = new Set((db.prepare("PRAGMA table_info(spool)").all() as any[]).map((c) => c.name));
      const spoolRows = (db.prepare("SELECT * FROM spool").all() as any[]).map((s) => {
        const row: Record<string, unknown> = {
          brand: s.brand,
          material: s.material,
          variant: s.variant ?? null,
          color_name: s.color_name,
          color_code: s.color_code ?? null,
          color_hex: s.color_hex ?? null,
          format: s.format ?? null,
          diameter_mm: s.diameter_mm ?? 1.75,
          nominal_weight_g: s.nominal_weight_g ?? 1000,
          sku: s.sku ?? null,
          source: s.source ?? null,
          purchase_date: s.purchase_date ?? null,
          unit_price: s.unit_price ?? null,
          status: s.status ?? "sealed",
          remaining_g: s.remaining_g ?? null,
          notes: s.notes ?? null,
        };
        if (cols.has("consumed_at")) row.consumed_at = s.consumed_at ?? null;
        return row;
      });
      for (let i = 0; i < spoolRows.length; i += 500) {
        const { error } = await supabase.from("spool").insert(spoolRows.slice(i, i + 500));
        if (error) throw new Error(error.message);
      }
      units = spoolRows.length;
    }

    db.close();
    return NextResponse.json({ ok: true, units });
  } catch (e) {
    return apiError("import/db", e, "Ripristino non riuscito.", 500);
  } finally {
    if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
  }
}
