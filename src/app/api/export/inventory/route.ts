import { NextResponse } from "next/server";
import { getInventory } from "@/lib/inventory";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function csvCell(v: string | number | null): string {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// Esporta l'inventario corrente in CSV.
export async function GET() {
  const rows = await getInventory();
  const header = ["Marca", "Materiale", "Variante", "Colore", "Codice", "Quantità", "Peso totale (g)", "Hex"];
  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push(
      [
        csvCell(r.brand),
        csvCell(r.material),
        csvCell(r.variant),
        csvCell(r.color_name),
        csvCell(r.color_code),
        csvCell(r.quantity),
        csvCell(r.total_weight_g),
        csvCell(r.color_hex),
      ].join(",")
    );
  }
  const csv = "﻿" + lines.join("\n"); // BOM per Excel
  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="inventario-${date}.csv"`,
    },
  });
}
