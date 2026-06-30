import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { setGroupDried } from "@/lib/inventory";
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

// Registra l'asciugatura di oggi su tutte le unità attive di una voce.
export async function POST(req: NextRequest) {
  try {
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: "Dati non validi." }, { status: 400 });
    const updated = await setGroupDried(parsed.data.key);
    return NextResponse.json({ updated });
  } catch (e) {
    return apiError("dry", e, "Si è verificato un errore. Riprova.", 500);
  }
}
