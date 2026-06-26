import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { insertSpools } from "@/lib/inventory";
import { resolveColorHex } from "@/lib/colors";
import type { DraftItem } from "@/lib/types";
import { apiError } from "@/lib/apiError";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cur += '"';
          i++;
        } else inQ = false;
      } else cur += c;
    } else if (c === '"') inQ = true;
    else if (c === ",") {
      row.push(cur);
      cur = "";
    } else if (c === "\n") {
      row.push(cur);
      rows.push(row);
      row = [];
      cur = "";
    } else if (c !== "\r") cur += c;
  }
  if (cur !== "" || row.length) {
    row.push(cur);
    rows.push(row);
  }
  return rows;
}

// Ripristino inventario da CSV (formato dell'export). SOSTITUISCE i filamenti.
export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "Nessun file." }, { status: 400 });

    let text = await file.text();
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1); // BOM
    const rows = parseCsv(text).filter((r) => r.some((c) => c.trim() !== ""));
    if (rows.length < 2) return NextResponse.json({ error: "CSV vuoto o non valido." }, { status: 400 });

    // Colonne: Marca, Materiale, Variante, Colore, Codice, Quantità, Peso totale (g), Hex
    const items: DraftItem[] = [];
    for (const r of rows.slice(1)) {
      const [brand, material, variant, color_name, color_code, qtyStr, weightStr, hex] = r;
      const quantity = parseInt((qtyStr || "0").trim(), 10);
      if (!material?.trim() || !color_name?.trim() || !quantity) continue;
      const totalW = parseFloat((weightStr || "").replace(",", ".")) || 0;
      const perUnit = quantity > 0 && totalW > 0 ? Math.round(totalW / quantity) : 1000;
      items.push({
        brand: brand?.trim() || "Sconosciuto",
        material: material.trim(),
        variant: variant?.trim() || null,
        color_name: color_name.trim(),
        color_code: color_code?.trim() || null,
        color_hex: hex?.trim() || resolveColorHex(color_code?.trim() || null, color_name.trim()),
        format: null,
        diameter_mm: 1.75,
        nominal_weight_g: perUnit,
        sku: null,
        unit_price: null,
        quantity,
        include: true,
      });
    }
    if (items.length === 0) return NextResponse.json({ error: "Nessuna riga valida nel CSV." }, { status: 400 });

    // Sostituisce l'inventario dell'utente (RLS limita la delete alle sue righe).
    const supabase = await createClient();
    await supabase.from("spool").delete().gte("id", 0);
    const inserted = await insertSpools(items, "import-csv", null);
    return NextResponse.json({ ok: true, inserted });
  } catch (e) {
    return apiError("import/inventory", e, "Import non riuscito.", 500);
  }
}
