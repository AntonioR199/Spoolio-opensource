import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { closeSpool } from "@/lib/inventory";
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

// Rimette tra le chiuse una bobina in uso della voce (azzera il countdown asciugatura).
export async function POST(req: NextRequest) {
  try {
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: "Dati non validi." }, { status: 400 });
    const updated = await closeSpool(parsed.data.key);
    if (updated === 0) return NextResponse.json({ error: "Nessuna bobina in uso." }, { status: 400 });
    return NextResponse.json({ updated });
  } catch (e) {
    return apiError("close", e, "Si è verificato un errore. Riprova.", 500);
  }
}
