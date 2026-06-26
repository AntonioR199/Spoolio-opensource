import { NextRequest, NextResponse } from "next/server";
import { listInvoices, deleteInvoice } from "@/lib/invoices";
import { apiError } from "@/lib/apiError";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ invoices: await listInvoices() });
}

export async function DELETE(req: NextRequest) {
  try {
    const id = Number(new URL(req.url).searchParams.get("id"));
    if (!id) return NextResponse.json({ error: "id mancante." }, { status: 400 });
    const ok = await deleteInvoice(id);
    if (!ok) return NextResponse.json({ error: "Fattura non trovata." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError("invoices", e, "Si è verificato un errore. Riprova.", 500);
  }
}
