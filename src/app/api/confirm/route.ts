import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { insertSpools } from "@/lib/inventory";
import { saveInvoice } from "@/lib/invoices";
import type { DraftItem } from "@/lib/types";
import { apiError } from "@/lib/apiError";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const itemSchema = z.object({
  brand: z.string(),
  material: z.string().min(1),
  variant: z.string().nullable(),
  color_name: z.string().min(1),
  color_code: z.string().nullable(),
  color_hex: z.string().nullable(),
  format: z.enum(["spool", "refill"]).nullable(),
  diameter_mm: z.number(),
  nominal_weight_g: z.number().int(),
  sku: z.string().nullable(),
  unit_price: z.number().nullable(),
  quantity: z.number().int().min(0),
  include: z.boolean(),
});

const bodySchema = z.object({
  items: z.array(itemSchema),
  source: z.string().nullable(),
  purchase_date: z.string().nullable(),
});

// Scrive a DB le voci confermate. Se arriva un PDF (multipart, dalla pagina
// upload), conserva la fattura collegandola all'order_number.
export async function POST(req: NextRequest) {
  try {
    let body: z.infer<typeof bodySchema>;
    let file: File | null = null;

    if (req.headers.get("content-type")?.includes("multipart/form-data")) {
      const form = await req.formData();
      const payload = form.get("payload");
      body = bodySchema.parse(JSON.parse(typeof payload === "string" ? payload : "{}"));
      const f = form.get("file");
      if (f instanceof File) file = f;
    } else {
      const parsed = bodySchema.safeParse(await req.json());
      if (!parsed.success) {
        return NextResponse.json({ error: "Dati non validi.", details: parsed.error.issues }, { status: 400 });
      }
      body = parsed.data;
    }

    const { items, source, purchase_date } = body;
    const inserted = await insertSpools(items as DraftItem[], source ?? "manual", purchase_date);

    if (file) {
      const buffer = Buffer.from(await file.arrayBuffer());
      await saveInvoice(buffer, {
        order: source,
        originalName: file.name,
        date: purchase_date,
        unitCount: inserted,
      });
    }

    return NextResponse.json({ inserted });
  } catch (e) {
    return apiError("confirm", e, "Salvataggio non riuscito.", 500);
  }
}
