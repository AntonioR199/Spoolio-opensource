import { NextRequest, NextResponse } from "next/server";
import { parseInvoice } from "@/lib/parseInvoice";
import { apiError } from "@/lib/apiError";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_PDF_BYTES = 15 * 1024 * 1024; // 15 MB

// Riceve un PDF, estrae le voci filamento e le restituisce SENZA scrivere a DB.
// La scrittura avviene solo dopo conferma utente (vedi /api/confirm).
export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Nessun file caricato." }, { status: 400 });
    }
    if (file.type && file.type !== "application/pdf") {
      return NextResponse.json({ error: "Il file deve essere un PDF." }, { status: 400 });
    }
    if (file.size > MAX_PDF_BYTES) {
      return NextResponse.json({ error: "PDF troppo grande (max 15 MB)." }, { status: 413 });
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    // Verifica firma %PDF (un type dichiarato non basta).
    if (buffer.subarray(0, 5).toString("latin1") !== "%PDF-") {
      return NextResponse.json({ error: "Il file non è un PDF valido." }, { status: 400 });
    }
    const result = await parseInvoice(buffer);
    return NextResponse.json(result);
  } catch (e) {
    return apiError("upload", e, "Elaborazione del PDF non riuscita.", 500);
  }
}
