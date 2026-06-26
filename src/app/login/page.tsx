"use client";

import { useState } from "react";
import { Mail, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Logo } from "@/components/Logo";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

function redirectTarget() {
  if (typeof window === "undefined") return "/";
  return new URLSearchParams(window.location.search).get("redirect") || "/";
}

export default function LoginPage() {
  const supabase = createClient();
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function signIn() {
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      window.location.href = redirectTarget();
    } catch (e) {
      toast.error((e as Error).message);
      setBusy(false);
    }
  }

  async function signUp() {
    setBusy(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) throw error;
      if (data.session) window.location.href = redirectTarget();
      else toast.success("Ti ho inviato una mail di conferma: aprila per attivare l'account.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function magicLink() {
    if (!email) return toast.error("Inserisci la tua email.");
    setBusy(true);
    try {
      const r = encodeURIComponent(redirectTarget());
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback?redirect=${r}` },
      });
      if (error) throw error;
      toast.success("Ti ho inviato un link magico via email. Aprilo per entrare.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    const r = encodeURIComponent(redirectTarget());
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback?redirect=${r}` },
    });
    if (error) toast.error(error.message);
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-neutral-50 px-4 dark:bg-neutral-950">
      {/* Sfondo illustrato in trasparenza, sotto il form (responsive: cover+center) */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0 bg-cover bg-center opacity-20 dark:opacity-25"
        style={{ backgroundImage: "url('/login-bg.png')" }}
      />
      {/* Velo per leggibilità del form */}
      <div aria-hidden className="pointer-events-none absolute inset-0 z-0 bg-background/30" />

      <Card className="relative z-10 w-full max-w-sm shadow-xl backdrop-blur-sm">
        <CardHeader className="items-center text-center">
          <Logo className="h-14 w-14" />
          <CardTitle className="text-xl">Spoolio</CardTitle>
          <CardDescription>Accedi al tuo magazzino filamenti 3D.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button variant="outline" className="w-full" onClick={google}>
            <GoogleIcon /> Continua con Google
          </Button>

          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <div className="h-px flex-1 bg-border" /> oppure <div className="h-px flex-1 bg-border" />
          </div>

          <Tabs value={mode} onValueChange={setMode}>
            <TabsList className="w-full">
              <TabsTrigger value="signin" className="flex-1">
                Accedi
              </TabsTrigger>
              <TabsTrigger value="signup" className="flex-1">
                Registrati
              </TabsTrigger>
            </TabsList>

            <div className="mt-4 space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@email.it"
                  autoComplete="email"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete={mode === "signin" ? "current-password" : "new-password"}
                />
              </div>

              <TabsContent value="signin" className="m-0">
                <Button className="w-full" onClick={signIn} disabled={busy || !email || !password}>
                  <KeyRound className="h-4 w-4" /> Accedi
                </Button>
              </TabsContent>
              <TabsContent value="signup" className="m-0">
                <Button className="w-full" onClick={signUp} disabled={busy || !email || !password}>
                  Crea account
                </Button>
              </TabsContent>
            </div>
          </Tabs>

          <Button variant="ghost" className="w-full" onClick={magicLink} disabled={busy}>
            <Mail className="h-4 w-4" /> Inviami un link magico
          </Button>

          <p className="text-center text-[11px] text-muted-foreground">
            Spoolio · un progetto DomoticLab
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.26 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z"
      />
    </svg>
  );
}
