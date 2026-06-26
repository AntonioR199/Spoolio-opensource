import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { consumeGroup } from "@/lib/inventory";
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

// Decremento: segna N unità come esaurite (bobina finita).
export async function POST(req: NextRequest) {
  try {
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Dati non validi." }, { status: 400 });
    }
    const consumed = await consumeGroup(parsed.data.key, parsed.data.quantity);
    if (consumed === 0) {
      return NextResponse.json({ error: "Nessuna unità disponibile da scalare." }, { status: 404 });
    }
    return NextResponse.json({ consumed });
  } catch (e) {
    return apiError("consume", e, "Si è verificato un errore. Riprova.", 500);
  }
}
