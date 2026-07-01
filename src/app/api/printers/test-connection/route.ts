import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId } from "@/lib/supabase/server";
import { getAdapter } from "@/lib/printer-monitor/adapter";
import { apiError } from "@/lib/apiError";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  conn_type: z.string().min(1),
  conn_host: z.string().min(1),
  conn_serial: z.string().min(1),
  conn_access_code: z.string().min(1),
});

// Verifica una connessione in lettura con i parametri forniti (prima del salvataggio).
// Apre una connessione una tantum, legge lo stato e chiude.
export async function POST(req: NextRequest) {
  try {
    await requireUserId(); // solo utenti autenticati possono avviare connessioni
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: "Dati non validi." }, { status: 400 });

    const adapter = getAdapter(parsed.data.conn_type);
    if (!adapter) return NextResponse.json({ error: "Tipo di connessione non supportato." }, { status: 400 });

    const conn = await adapter.connect({ id: -1, ...parsed.data });
    const status = conn.getStatus();
    conn.close();

    if (!status.online) {
      return NextResponse.json({
        ok: false,
        error: "Nessuna risposta dalla stampante. Verifica IP, seriale, access code e che la modalità LAN sia attiva.",
      });
    }
    return NextResponse.json({ ok: true, state: status.state });
  } catch (e) {
    return apiError("printer-test", e, "Verifica connessione non riuscita.", 500);
  }
}
