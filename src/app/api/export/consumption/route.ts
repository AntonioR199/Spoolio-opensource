import { NextResponse } from "next/server";
import { getConsumptionHistory } from "@/lib/inventory";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function csvCell(v: string | number | null): string {
  const s = v == null ? "" : String(v);
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// Esporta lo storico consumi in CSV. Delimitatore ";" per l'apertura diretta
// in Excel con impostazioni regionali italiane (virgola = separatore decimale).
export async function GET() {
  const rows = await getConsumptionHistory();
  const header = ["Marca", "Materiale", "Variante", "Colore", "Codice", "SKU", "Peso (g)", "Prezzo (€)", "Data consumo"];
  const lines = [header.join(";")];
  for (const r of rows) {
    lines.push(
      [
        csvCell(r.brand),
        csvCell(r.material),
        csvCell(r.variant),
        csvCell(r.color_name),
        csvCell(r.color_code),
        csvCell(r.sku),
        csvCell(r.nominal_weight_g),
        csvCell(r.unit_price != null ? String(r.unit_price) : null),
        csvCell(r.consumed_at ? r.consumed_at.slice(0, 10) : null),
      ].join(";")
    );
  }
  const csv = "\ufeff" + lines.join("\n"); // BOM per Excel
  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="storico-consumi-${date}.csv"`,
    },
  });
}
