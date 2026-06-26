import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { listBrandsWithStore, updateBrand } from "@/lib/catalog";
import { apiError } from "@/lib/apiError";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ brands: await listBrandsWithStore() });
}

const schema = z.object({
  name: z.string().min(1),
  store_id: z.number().int().nullable(),
  product_url_template: z.string().nullable(),
});

export async function POST(req: NextRequest) {
  try {
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: "Dati non validi." }, { status: 400 });
    await updateBrand(parsed.data);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError("brands", e, "Si è verificato un errore. Riprova.", 500);
  }
}
