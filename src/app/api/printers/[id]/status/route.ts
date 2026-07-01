import { NextResponse } from "next/server";
import { getPrinter } from "@/lib/printers";
import { getPrinterStatus } from "@/lib/printer-monitor/connectionManager";
import { offlineStatus } from "@/lib/printer-monitor/types";
import { apiError } from "@/lib/apiError";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const id = Number((await params).id);
    if (!id) return NextResponse.json({ error: "id mancante." }, { status: 400 });
    // getPrinter passa da RLS: ritorna solo se la stampante è dell'utente.
    const printer = await getPrinter(id);
    if (!printer) return NextResponse.json({ error: "Stampante non trovata." }, { status: 404 });

    if (!printer.conn_type) {
      return NextResponse.json({ status: offlineStatus(), configured: false });
    }
    const status = await getPrinterStatus({
      id: printer.id,
      conn_type: printer.conn_type,
      conn_host: printer.conn_host,
      conn_serial: printer.conn_serial,
      conn_access_code: printer.conn_access_code,
    });
    return NextResponse.json({ status, configured: true });
  } catch (e) {
    return apiError("printer-status", e, "Impossibile leggere lo stato della stampante.", 500);
  }
}
