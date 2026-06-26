import { NextResponse } from "next/server";
import { getInventory, getStats } from "@/lib/inventory";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Inventario aggregato + statistiche (usato dalla pagina "Aggiungi a mano").
export async function GET() {
  const [rows, stats] = await Promise.all([getInventory(), getStats()]);
  return NextResponse.json({ rows, stats });
}
