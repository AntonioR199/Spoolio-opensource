import { NextResponse } from "next/server";
import { getEmptyGroups } from "@/lib/catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Voci esaurite (status='empty') con link di riacquisto risolto.
export async function GET() {
  return NextResponse.json({ rows: await getEmptyGroups() });
}
