import { NextRequest, NextResponse } from "next/server";
import { getInvoiceByOrder, getInvoiceById, downloadInvoice } from "@/lib/invoices";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Serve il PDF della fattura dallo Storage: /api/invoices/file?order=EN... | ?id=1
export async function GET(req: NextRequest) {
  const sp = new URL(req.url).searchParams;
  const order = sp.get("order");
  const id = sp.get("id");
  const inv = order ? await getInvoiceByOrder(order) : id ? await getInvoiceById(Number(id)) : undefined;
  if (!inv) return NextResponse.json({ error: "Fattura non trovata." }, { status: 404 });

  const buffer = await downloadInvoice(inv);
  if (!buffer) return NextResponse.json({ error: "PDF non disponibile nello Storage." }, { status: 404 });

  // Nome file ripulito: evita header injection (virgolette/newline) dal nome
  // caricato dall'utente. ASCII per `filename`, UTF-8 per `filename*`.
  const raw = inv.original_name ?? "fattura.pdf";
  const asciiName = raw.replace(/[^\x20-\x7E]/g, "_").replace(/["\\\r\n]/g, "_").slice(0, 100) || "fattura.pdf";
  const encodedName = encodeURIComponent(raw).slice(0, 200);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${asciiName}"; filename*=UTF-8''${encodedName}`,
    },
  });
}
