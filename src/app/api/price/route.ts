import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { setGroupPrice } from "@/lib/inventory";
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
  unit_price: z.number().nonnegative().nullable(),
});

// Imposta/modifica il prezzo unitario di una voce (utile senza fattura).
export async function POST(req: NextRequest) {
  try {
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: "Dati non validi." }, { status: 400 });
    const updated = await setGroupPrice(parsed.data.key, parsed.data.unit_price);
    return NextResponse.json({ updated });
  } catch (e) {
    return apiError("price", e, "Si è verificato un errore. Riprova.", 500);
  }
}
