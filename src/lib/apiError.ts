import { NextResponse } from "next/server";

// Risposta d'errore generica per le route API: logga il dettaglio lato server
// (per il debug) ma NON espone il messaggio interno al client (evita di rivelare
// schema DB, vincoli, percorsi o dettagli dell'infrastruttura).
export function apiError(logTag: string, e: unknown, userMessage = "Si è verificato un errore. Riprova.", status = 500) {
  console.error(`[api:${logTag}]`, e);
  return NextResponse.json({ error: userMessage }, { status });
}
