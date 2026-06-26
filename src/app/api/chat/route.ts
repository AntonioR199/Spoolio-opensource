import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId } from "@/lib/supabase/server";
import { runAgent } from "@/lib/chat";
import { apiError } from "@/lib/apiError";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
      })
    )
    .min(1)
    .max(40),
});

// Turno dell'assistente: l'agente legge i dati via tool e, per le modifiche,
// ritorna una proposta che l'utente conferma a un click (non scrive a DB qui).
export async function POST(req: NextRequest) {
  try {
    await requireUserId(); // auth + RLS (le query dell'agente girano per-utente)
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Dati non validi." }, { status: 400 });
    }
    const result = await runAgent(parsed.data.messages);
    return NextResponse.json(result);
  } catch (e) {
    return apiError("chat", e, "Si è verificato un errore. Riprova.", 500);
  }
}
