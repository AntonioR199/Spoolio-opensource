"use client";

import { useEffect, useState } from "react";
import { ShieldCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Logo } from "@/components/Logo";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

function redirectTarget() {
  if (typeof window === "undefined") return "/";
  return new URLSearchParams(window.location.search).get("redirect") || "/";
}

export default function MfaVerifyPage() {
  const supabase = createClient();
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  // Recupera il fattore TOTP verificato dell'utente. Se non ne ha, non serve
  // la verifica: torna all'app.
  useEffect(() => {
    supabase.auth.mfa
      .listFactors()
      .then(({ data, error }) => {
        if (error) throw error;
        const totp = data?.totp?.[0];
        if (!totp) {
          window.location.href = redirectTarget();
          return;
        }
        setFactorId(totp.id);
      })
      .catch((e) => toast.error((e as Error).message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function verify() {
    if (!factorId || code.length < 6 || busy) return;
    setBusy(true);
    try {
      const { data: ch, error: chErr } = await supabase.auth.mfa.challenge({ factorId });
      if (chErr) throw chErr;
      const { error: vErr } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: ch.id,
        code,
      });
      if (vErr) throw vErr;
      // La sessione è ora ad aal2: il middleware lascerà passare.
      window.location.href = redirectTarget();
    } catch (e) {
      toast.error((e as Error).message || "Codice non valido.");
      setCode("");
      setBusy(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-neutral-50 px-4 dark:bg-neutral-950">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0 bg-cover bg-center opacity-20 dark:opacity-25"
        style={{ backgroundImage: "url('/login-bg.png')" }}
      />
      <div aria-hidden className="pointer-events-none absolute inset-0 z-0 bg-background/30" />

      <Card className="relative z-10 w-full max-w-sm shadow-xl backdrop-blur-sm">
        <CardHeader className="items-center text-center">
          <Logo className="h-14 w-14" />
          <CardTitle className="flex items-center gap-2 text-xl">
            <ShieldCheck className="h-5 w-5 text-primary" /> Verifica in due passaggi
          </CardTitle>
          <CardDescription>
            Inserisci il codice a 6 cifre della tua app di autenticazione.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="flex justify-center py-6 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                verify();
              }}
            >
              <div className="space-y-1.5">
                <Label htmlFor="code">Codice di verifica</Label>
                <Input
                  id="code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  autoFocus
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="000000"
                  className="text-center text-lg tracking-[0.4em]"
                />
              </div>
              <Button type="submit" className="w-full" disabled={busy || code.length < 6}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                Verifica e accedi
              </Button>
            </form>
          )}

          {/* Via di fuga: logout (POST) anche se bloccati ad aal1. */}
          <form action="/auth/signout" method="post">
            <Button type="submit" variant="ghost" className="w-full text-muted-foreground">
              Esci
            </Button>
          </form>

          <p className="text-center text-[11px] text-muted-foreground">
            Spoolio · un progetto DomoticLab
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
