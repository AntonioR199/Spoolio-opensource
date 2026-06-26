import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { restoreGroup } from "@/lib/catalog";
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

// Ripristina N unità esaurite (empty -> sealed).
export async function POST(req: NextRequest) {
  try {
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: "Dati non validi." }, { status: 400 });
    const restored = await restoreGroup(parsed.data.key, parsed.data.quantity);
    if (restored === 0) return NextResponse.json({ error: "Nessuna unità esaurita da ripristinare." }, { status: 404 });
    return NextResponse.json({ restored });
  } catch (e) {
    return apiError("restore", e, "Si è verificato un errore. Riprova.", 500);
  }
}
