import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { incrementGroup } from "@/lib/inventory";
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
  quantity: z.number().int().min(1),
});

// Incrementa la quantità di una voce già presente in inventario.
export async function POST(req: NextRequest) {
  try {
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Dati non validi." }, { status: 400 });
    }
    const inserted = await incrementGroup(parsed.data.key, parsed.data.quantity);
    if (inserted === 0) {
      return NextResponse.json({ error: "Voce non trovata in inventario." }, { status: 404 });
    }
    return NextResponse.json({ inserted });
  } catch (e) {
    return apiError("increment", e, "Si è verificato un errore. Riprova.", 500);
  }
}
