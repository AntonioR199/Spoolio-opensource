import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { listPrinters, upsertPrinter, deletePrinter } from "@/lib/printers";
import { apiError } from "@/lib/apiError";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ printers: await listPrinters() });
}

const schema = z.object({
  id: z.number().int().optional(),
  name: z.string().min(1),
  brand: z.string().nullable(),
  model: z.string().nullable(),
  build_volume: z.string().nullable(),
  nozzle_diameter: z.number().nullable(),
  tech: z.string().nullable(),
  notes: z.string().nullable(),
});

export async function POST(req: NextRequest) {
  try {
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: "Dati non validi." }, { status: 400 });
    const id = await upsertPrinter(parsed.data);
    return NextResponse.json({ id });
  } catch (e) {
    return apiError("printers", e, "Si è verificato un errore. Riprova.", 500);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const id = Number(new URL(req.url).searchParams.get("id"));
    if (!id) return NextResponse.json({ error: "id mancante." }, { status: 400 });
    await deletePrinter(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError("printers", e, "Si è verificato un errore. Riprova.", 500);
  }
}
