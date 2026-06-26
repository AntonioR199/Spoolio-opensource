"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bot, Send, X, Loader2, Check, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface ChatMsg {
  role: "user" | "assistant";
  content: string;
}

// Proposta di azione restituita da /api/chat (eseguita solo su conferma utente).
interface ActionProposal {
  kind: "consume" | "increment" | "new";
  endpoint: string;
  payload: unknown;
  summary: string;
}

const WELCOME: ChatMsg = {
  role: "assistant",
  content:
    "Ciao! Sono l'assistente di Spoolio. Posso dirti cosa hai in magazzino, cosa ti conviene " +
    "ricomprare, oppure aggiornare l'inventario per te — ad esempio \"ho finito una bobina di bianco\" " +
    "o \"aggiungi 2 PLA nero Bambu\".",
};

export default function ChatWidget() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [proposal, setProposal] = useState<ActionProposal | null>(null);
  const [confirming, setConfirming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, proposal, loading, open]);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    const next = [...messages, { role: "user" as const, content: text }];
    setMessages(next);
    setInput("");
    setProposal(null);
    setLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Inviamo solo i messaggi reali della conversazione (no messaggio di benvenuto).
        body: JSON.stringify({ messages: next.filter((m) => m !== WELCOME) }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessages((m) => [...m, { role: "assistant", content: data.error ?? "Qualcosa è andato storto." }]);
      } else {
        setMessages((m) => [...m, { role: "assistant", content: data.reply }]);
        if (data.proposal) setProposal(data.proposal as ActionProposal);
      }
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: "Errore di rete, riprova." }]);
    } finally {
      setLoading(false);
    }
  }

  async function confirmProposal() {
    if (!proposal || confirming) return;
    setConfirming(true);
    try {
      const res = await fetch(proposal.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(proposal.payload),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Azione non riuscita");
        setMessages((m) => [...m, { role: "assistant", content: `Non sono riuscito: ${data.error ?? "errore"}.` }]);
      } else {
        toast.success("Fatto!");
        setMessages((m) => [...m, { role: "assistant", content: `Fatto ✓ ${proposal.summary}` }]);
        setProposal(null);
        router.refresh(); // aggiorna le pagine server (inventario, dashboard…)
      }
    } catch {
      toast.error("Errore di rete");
    } finally {
      setConfirming(false);
    }
  }

  function cancelProposal() {
    setProposal(null);
    setMessages((m) => [...m, { role: "assistant", content: "Ok, ho annullato. Nessuna modifica." }]);
  }

  return (
    <>
      {/* Floating button */}
      <Button
        size="icon-lg"
        onClick={() => setOpen((o) => !o)}
        aria-label="Assistente Spoolio"
        className="fixed bottom-4 right-4 z-50 size-12 rounded-full shadow-lg"
      >
        {open ? <X className="size-5" /> : <Bot className="size-5" />}
      </Button>

      {/* Pannello chat */}
      {open && (
        <div className="fixed bottom-20 right-4 z-50 flex h-[32rem] max-h-[calc(100dvh-6rem)] w-[calc(100vw-2rem)] max-w-sm flex-col overflow-hidden rounded-xl border border-border bg-background shadow-2xl">
          <header className="flex items-center gap-2 border-b border-border px-4 py-3">
            <Sparkles className="size-4 text-primary" />
            <span className="text-sm font-semibold">Assistente Spoolio</span>
          </header>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-3 py-3">
            {messages.map((m, i) => (
              <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm",
                    m.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-foreground"
                  )}
                >
                  {m.content}
                </div>
              </div>
            ))}

            {proposal && (
              <div className="rounded-lg border border-border bg-card p-3 text-sm">
                <p className="mb-2 font-medium">Confermi questa azione?</p>
                <p className="mb-3 text-muted-foreground">{proposal.summary}</p>
                <div className="flex gap-2">
                  <Button size="sm" onClick={confirmProposal} disabled={confirming}>
                    {confirming ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                    Conferma
                  </Button>
                  <Button size="sm" variant="outline" onClick={cancelProposal} disabled={confirming}>
                    Annulla
                  </Button>
                </div>
              </div>
            )}

            {loading && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
                  <Loader2 className="size-3.5 animate-spin" /> Sto pensando…
                </div>
              </div>
            )}
          </div>

          <form
            className="flex items-center gap-2 border-t border-border p-3"
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Scrivi un messaggio…"
              disabled={loading}
              className="flex-1"
            />
            <Button type="submit" size="icon" disabled={loading || !input.trim()} aria-label="Invia">
              <Send className="size-4" />
            </Button>
          </form>
        </div>
      )}
    </>
  );
}
