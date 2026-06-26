import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { listStores, upsertStore, deleteStore } from "@/lib/catalog";
import { apiError } from "@/lib/apiError";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ stores: await listStores() });
}

const upsertSchema = z.object({
  id: z.number().int().optional(),
  name: z.string().min(1),
  url: z.string().nullable(),
  search_url_template: z.string().nullable(),
});

export async function POST(req: NextRequest) {
  try {
    const parsed = upsertSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: "Dati non validi." }, { status: 400 });
    const id = await upsertStore(parsed.data);
    return NextResponse.json({ id });
  } catch (e) {
    return apiError("stores", e, "Si è verificato un errore. Riprova.", 500);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const id = Number(new URL(req.url).searchParams.get("id"));
    if (!id) return NextResponse.json({ error: "id mancante." }, { status: 400 });
    await deleteStore(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError("stores", e, "Si è verificato un errore. Riprova.", 500);
  }
}
