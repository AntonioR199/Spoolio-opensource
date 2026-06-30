import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getGroupDetail } from "@/lib/inventory";
import { ordersWithInvoice } from "@/lib/invoices";
import { getDryIntervalDays } from "@/lib/settings";
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

// Dettaglio di una voce di inventario (unità attive) per la modale.
export async function POST(req: NextRequest) {
  try {
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Dati non validi." }, { status: 400 });
    }
    const spools = await getGroupDetail(parsed.data.key);
    const sources = [...new Set(spools.map((s) => s.source).filter((v): v is string => !!v))];
    return NextResponse.json({
      spools,
      invoiceSources: await ordersWithInvoice(sources),
      dryIntervalDays: await getDryIntervalDays(),
    });
  } catch (e) {
    return apiError("group", e, "Si è verificato un errore. Riprova.", 500);
  }
}
