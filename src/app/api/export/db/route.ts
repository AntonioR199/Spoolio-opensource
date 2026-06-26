/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import Database from "better-sqlite3";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Backup completo: ricostruisce un file SQLite dai dati dell'utente su Supabase
// (formato compatibile con l'importatore /api/import/db).
export async function GET() {
  const supabase = await createClient();
  const [spools, stores, brands, printers, settings] = await Promise.all([
    supabase.from("spool").select("*").order("id"),
    supabase.from("store").select("*").order("id"),
    supabase.from("brand").select("*").order("id"),
    supabase.from("printer").select("*").order("id"),
    supabase.from("setting").select("key, value"),
  ]);

  const tmp = path.join(os.tmpdir(), `spoolio-backup-${Date.now()}.db`);
  try {
    const db = new Database(tmp);
    db.exec(`
      CREATE TABLE store (id INTEGER PRIMARY KEY, name TEXT, url TEXT, search_url_template TEXT);
      CREATE TABLE brand (id INTEGER PRIMARY KEY, name TEXT, store_id INTEGER, product_url_template TEXT);
      CREATE TABLE printer (id INTEGER PRIMARY KEY, name TEXT, brand TEXT, model TEXT, build_volume TEXT, nozzle_diameter REAL, tech TEXT, notes TEXT);
      CREATE TABLE setting (key TEXT PRIMARY KEY, value TEXT);
      CREATE TABLE spool (
        id INTEGER PRIMARY KEY, brand TEXT, material TEXT, variant TEXT, color_name TEXT,
        color_code TEXT, color_hex TEXT, format TEXT, diameter_mm REAL, nominal_weight_g INTEGER,
        sku TEXT, source TEXT, purchase_date TEXT, unit_price REAL, status TEXT, remaining_g INTEGER,
        consumed_at TEXT, notes TEXT
      );
    `);

    const ins = (sql: string, rows: any[], map: (r: any) => any[]) => {
      const stmt = db.prepare(sql);
      const tx = db.transaction((rs: any[]) => rs.forEach((r) => stmt.run(...map(r))));
      tx(rows ?? []);
    };

    ins(
      `INSERT INTO store (id,name,url,search_url_template) VALUES (?,?,?,?)`,
      stores.data ?? [],
      (r) => [r.id, r.name, r.url, r.search_url_template]
    );
    ins(
      `INSERT INTO brand (id,name,store_id,product_url_template) VALUES (?,?,?,?)`,
      brands.data ?? [],
      (r) => [r.id, r.name, r.store_id, r.product_url_template]
    );
    ins(
      `INSERT INTO printer (id,name,brand,model,build_volume,nozzle_diameter,tech,notes) VALUES (?,?,?,?,?,?,?,?)`,
      printers.data ?? [],
      (r) => [r.id, r.name, r.brand, r.model, r.build_volume, r.nozzle_diameter, r.tech, r.notes]
    );
    ins(`INSERT INTO setting (key,value) VALUES (?,?)`, settings.data ?? [], (r) => [r.key, r.value]);
    ins(
      `INSERT INTO spool (id,brand,material,variant,color_name,color_code,color_hex,format,diameter_mm,nominal_weight_g,sku,source,purchase_date,unit_price,status,remaining_g,consumed_at,notes)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      spools.data ?? [],
      (r) => [
        r.id, r.brand, r.material, r.variant, r.color_name, r.color_code, r.color_hex, r.format,
        r.diameter_mm, r.nominal_weight_g, r.sku, r.source, r.purchase_date, r.unit_price, r.status,
        r.remaining_g, r.consumed_at, r.notes,
      ]
    );
    db.close();

    const bytes = fs.readFileSync(tmp);
    const date = new Date().toISOString().slice(0, 10);
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="spoolio-backup-${date}.db"`,
      },
    });
  } finally {
    if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
  }
}
