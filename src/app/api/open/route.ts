import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { openSpool } from "@/lib/inventory";
import { apiError } from "@/lib/apiError";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  key: z.object({
    brand: z.string(),
    material: z.string(),
    variant: z.string().nullable(),
    color_name: z.string(),
    color_code: z.string().nullable(),
  }),
});

// Mette in uso una bobina chiusa della voce (avvia il countdown asciugatura).
export async function POST(req: NextRequest) {
  try {
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: "Dati non validi." }, { status: 400 });
    const updated = await openSpool(parsed.data.key);
    if (updated === 0) return NextResponse.json({ error: "Nessuna bobina chiusa disponibile." }, { status: 400 });
    return NextResponse.json({ updated });
  } catch (e) {
    return apiError("open", e, "Si è verificato un errore. Riprova.", 500);
  }
}
