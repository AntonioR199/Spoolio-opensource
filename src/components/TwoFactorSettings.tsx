"use client";

import { useEffect, useState } from "react";
import { ShieldCheck, ShieldOff, Loader2, Check, X } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Enrolling {
  factorId: string;
  qr: string; // SVG data-URI
  secret: string;
}

export default function TwoFactorSettings() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [enabledFactorId, setEnabledFactorId] = useState<string | null>(null);
  const [enrolling, setEnrolling] = useState<Enrolling | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }
    const verified = data?.totp?.[0];
    setEnabledFactorId(verified?.id ?? null);
    setLoading(false);
  }

  useEffect(() => {
    // refresh() è async: il setState avviene dopo l'await, non in modo sincrono.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Rimuove eventuali fattori non verificati lasciati da tentativi annullati.
  async function cleanupUnverified() {
    const { data } = await supabase.auth.mfa.listFactors();
    const stale = (data?.all ?? []).filter((f) => f.status === "unverified");
    for (const f of stale) {
      await supabase.auth.mfa.unenroll({ factorId: f.id });
    }
  }

  async function startEnroll() {
    setBusy(true);
    try {
      await cleanupUnverified();
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "Spoolio",
      });
      if (error) throw error;
      setEnrolling({ factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
      setCode("");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function confirmEnroll() {
    if (!enrolling || code.length < 6 || busy) return;
    setBusy(true);
    try {
      const { data: ch, error: chErr } = await supabase.auth.mfa.challenge({
        factorId: enrolling.factorId,
      });
      if (chErr) throw chErr;
      const { error: vErr } = await supabase.auth.mfa.verify({
        factorId: enrolling.factorId,
        challengeId: ch.id,
        code,
      });
      if (vErr) throw vErr;
      toast.success("Autenticazione a due fattori attivata.");
      setEnrolling(null);
      setCode("");
      await refresh();
    } catch (e) {
      toast.error((e as Error).message || "Codice non valido.");
      setCode("");
    } finally {
      setBusy(false);
    }
  }

  async function cancelEnroll() {
    if (enrolling) {
      await supabase.auth.mfa.unenroll({ factorId: enrolling.factorId }).catch(() => {});
    }
    setEnrolling(null);
    setCode("");
  }

  async function disable() {
    if (!enabledFactorId) return;
    if (!confirm("Disattivare l'autenticazione a due fattori? L'accesso tornerà a richiedere solo la password.")) {
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.mfa.unenroll({ factorId: enabledFactorId });
      if (error) throw error;
      toast.success("2FA disattivata.");
      await refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Caricamento…
      </div>
    );
  }

  // Stato: attiva
  if (enabledFactorId && !enrolling) {
    return (
      <div className="space-y-3">
        <Badge variant="secondary" className="gap-1 text-green-700 dark:text-green-400">
          <Check className="h-3.5 w-3.5" /> Attiva
        </Badge>
        <p className="text-sm text-muted-foreground">
          Al prossimo accesso ti verrà chiesto il codice della tua app di autenticazione.
        </p>
        <Button variant="outline" onClick={disable} disabled={busy}>
          <ShieldOff className="h-4 w-4" /> Disattiva 2FA
        </Button>
      </div>
    );
  }

  // Stato: in fase di attivazione (QR + codice)
  if (enrolling) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Inquadra il QR con un&apos;app di autenticazione (Google Authenticator, Authy, 1Password…),
          poi inserisci il codice generato per confermare.
        </p>
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
          {/* QR fornito da Supabase come SVG data-URI */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={enrolling.qr}
            alt="QR per l'autenticazione a due fattori"
            className="h-44 w-44 rounded-lg border border-border bg-white p-2"
          />
          <div className="space-y-1.5 text-sm">
            <p className="text-muted-foreground">Oppure inserisci manualmente questa chiave:</p>
            <code className="block break-all rounded bg-muted px-2 py-1 font-mono text-xs">
              {enrolling.secret}
            </code>
          </div>
        </div>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            confirmEnroll();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="enroll-code">Codice di verifica</Label>
            <Input
              id="enroll-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="000000"
              className="w-40 text-center text-lg tracking-[0.3em]"
            />
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={busy || code.length < 6}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Conferma e attiva
            </Button>
            <Button type="button" variant="ghost" onClick={cancelEnroll} disabled={busy}>
              <X className="h-4 w-4" /> Annulla
            </Button>
          </div>
        </form>
      </div>
    );
  }

  // Stato: non attiva
  return (
    <div className="space-y-3">
      <Badge variant="secondary" className="gap-1 text-muted-foreground">
        <X className="h-3.5 w-3.5" /> Non attiva
      </Badge>
      <p className="text-sm text-muted-foreground">
        Aggiungi un secondo fattore con un&apos;app di autenticazione: oltre alla password, al login
        ti verrà chiesto un codice a 6 cifre.
      </p>
      <Button onClick={startEnroll} disabled={busy}>
        <ShieldCheck className="h-4 w-4" /> Attiva 2FA
      </Button>
    </div>
  );
}
