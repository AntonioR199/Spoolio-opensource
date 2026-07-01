"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Download, Database, Check, X, Upload, KeyRound } from "lucide-react";
import type { AppSettings } from "@/lib/settings";

type Provider = { id: string; label: string; defaultModel: string; keyHint: string };
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";
import TwoFactorSettings from "@/components/TwoFactorSettings";
import type { Printer } from "@/lib/types";

const NO_PRINTER = "__none__";

export default function ImpostazioniPage() {
  const router = useRouter();
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [aiConfigured, setAiConfigured] = useState(false);
  const [aiKeyPreview, setAiKeyPreview] = useState<string | null>(null);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [aiKey, setAiKey] = useState(""); // input chiave (write-only)
  const [printers, setPrinters] = useState<Printer[]>([]);
  const [saving, setSaving] = useState(false);
  const dbInputRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);

  function loadSettings() {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => {
        setSettings(d.settings);
        setAiConfigured(!!d.aiConfigured);
        setAiKeyPreview(d.aiKeyPreview ?? null);
        setProviders(d.providers ?? []);
      })
      .catch(() => toast.error("Impossibile caricare le impostazioni."));
  }

  useEffect(() => {
    loadSettings();
    fetch("/api/printers")
      .then((r) => r.json())
      .then((d) => setPrinters(d.printers ?? []))
      .catch(() => {});
  }, []);

  async function saveAi() {
    if (!settings) return;
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          aiProvider: settings.aiProvider,
          aiModel: settings.aiModel,
          aiBaseUrl: settings.aiBaseUrl,
          ...(aiKey.trim() ? { aiApiKey: aiKey.trim() } : {}),
        }),
      });
      if (!res.ok) throw new Error("Salvataggio non riuscito");
      toast.success("Configurazione AI salvata");
      setAiKey("");
      loadSettings();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function importFile(endpoint: string, file: File, label: string) {
    if (!confirm(`Ripristinare da "${file.name}"? I dati attuali verranno sovrascritti.`)) return;
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(endpoint, { method: "POST", body: fd });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      toast.success(`${label} ripristinato.`);
      router.refresh();
      loadSettings();
    } else {
      toast.error(data.error ?? "Import non riuscito");
    }
  }

  function set<K extends keyof AppSettings>(k: K, v: AppSettings[K]) {
    setSettings((p) => (p ? { ...p, [k]: v } : p));
  }

  async function save() {
    if (!settings) return;
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (!res.ok) throw new Error("Salvataggio non riuscito");
      toast.success("Impostazioni salvate");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Impostazioni</h1>
        <p className="text-sm text-muted-foreground">Le tue preferenze, i valori di default e i tuoi dati.</p>
      </div>

      {/* Aspetto */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Aspetto</CardTitle>
          <CardDescription>Tema chiaro, scuro o in base al sistema.</CardDescription>
        </CardHeader>
        <CardContent>
          <ThemeSwitcher />
        </CardContent>
      </Card>

      {/* Inventario + default */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Inventario e default</CardTitle>
          <CardDescription>
            Soglia di scorta bassa e valori predefiniti per il form &quot;Nuovo prodotto&quot;.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!settings ? (
            <p className="text-sm text-muted-foreground">Caricamento…</p>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Soglia scorta bassa (≤)">
                  <Input
                    type="number"
                    min={0}
                    value={settings.lowStockThreshold}
                    onChange={(e) => set("lowStockThreshold", parseInt(e.target.value || "0", 10))}
                  />
                </Field>
                <Field label="Avviso 'da asciugare' (giorni)">
                  <Input
                    type="number"
                    min={1}
                    value={settings.dryIntervalDays}
                    onChange={(e) => set("dryIntervalDays", parseInt(e.target.value || "30", 10))}
                  />
                </Field>
                <Field label="Marca predefinita">
                  <Input
                    value={settings.defaultBrand}
                    onChange={(e) => set("defaultBrand", e.target.value)}
                  />
                </Field>
                <Field label="Diametro predefinito (mm)">
                  <Input
                    type="number"
                    step="0.05"
                    value={settings.defaultDiameterMm}
                    onChange={(e) => set("defaultDiameterMm", parseFloat(e.target.value || "1.75"))}
                  />
                </Field>
                <Field label="Peso predefinito (g)">
                  <Input
                    type="number"
                    value={settings.defaultWeightG}
                    onChange={(e) => set("defaultWeightG", parseInt(e.target.value || "1000", 10))}
                  />
                </Field>
              </div>
              <Field label="Stampante predefinita">
                <Select
                  value={settings.defaultPrinterId ? String(settings.defaultPrinterId) : NO_PRINTER}
                  onValueChange={(v) =>
                    set("defaultPrinterId", !v || v === NO_PRINTER ? null : Number(v))
                  }
                >
                  <SelectTrigger className="w-full sm:w-96">
                    <SelectValue>
                      {(v: string) =>
                        v === NO_PRINTER || !v
                          ? "Nessuna"
                          : printers.find((p) => String(p.id) === v)?.name ?? "Nessuna"
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_PRINTER}>Nessuna</SelectItem>
                    {printers.map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {printers.length === 0 && (
                  <p className="text-[11px] text-muted-foreground">
                    Aggiungi prima una stampante da &quot;Le mie stampanti&quot;.
                  </p>
                )}
              </Field>
              <Button onClick={save} disabled={saving}>
                {saving ? "Salvataggio…" : "Salva impostazioni"}
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* Sicurezza / 2FA */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sicurezza</CardTitle>
          <CardDescription>
            Autenticazione a due fattori (2FA) con app di autenticazione, per proteggere il tuo account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TwoFactorSettings />
        </CardContent>
      </Card>

      {/* Esportazioni e ripristino */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Backup e ripristino</CardTitle>
          <CardDescription>
            Scarica i tuoi dati e, quando vuoi, ricaricali per ripristinare tutto.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <p className="mb-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">Esporta</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" nativeButton={false} render={<a href="/api/export/inventory" download />}>
                <Download className="h-4 w-4" /> Inventario CSV
              </Button>
              <Button variant="outline" nativeButton={false} render={<a href="/api/export/db" download />}>
                <Database className="h-4 w-4" /> Backup database
              </Button>
            </div>
          </div>
          <div>
            <p className="mb-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Ripristina (sovrascrive i dati)
            </p>
            <div className="flex flex-wrap gap-2">
              <input
                ref={csvInputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) importFile("/api/import/inventory", f, "Inventario");
                  e.target.value = "";
                }}
              />
              <Button variant="outline" onClick={() => csvInputRef.current?.click()}>
                <Upload className="h-4 w-4" /> Importa CSV
              </Button>
              <input
                ref={dbInputRef}
                type="file"
                accept=".db,application/octet-stream,application/x-sqlite3"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) importFile("/api/import/db", f, "Database");
                  e.target.value = "";
                }}
              />
              <Button variant="outline" onClick={() => dbInputRef.current?.click()}>
                <Database className="h-4 w-4" /> Importa backup DB
              </Button>
            </div>
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              Il backup DB ripristina <strong>tutto</strong> (inventario, fatture, marchi, stampanti…). Il CSV
              ripristina solo l&apos;inventario.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* AI */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Estrazione AI fatture</CardTitle>
          <CardDescription>
            Per le fatture non-Bambu uso l&apos;AI. Scegli il provider che preferisci e inserisci la tua chiave.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!settings ? (
            <p className="text-sm text-muted-foreground">Caricamento…</p>
          ) : (
            <>
              <div className="flex items-center gap-2">
                {aiConfigured ? (
                  <Badge variant="secondary" className="gap-1 text-green-700 dark:text-green-400">
                    <Check className="h-3.5 w-3.5" /> Chiave attiva {aiKeyPreview}
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="gap-1 text-muted-foreground">
                    <X className="h-3.5 w-3.5" /> Nessuna chiave
                  </Badge>
                )}
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Provider">
                  <Select
                    value={settings.aiProvider}
                    onValueChange={(v) => v && set("aiProvider", v)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue>
                        {(v: string) => providers.find((p) => p.id === v)?.label ?? v}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {providers.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Modello">
                  <Input
                    value={settings.aiModel}
                    onChange={(e) => set("aiModel", e.target.value)}
                    placeholder={providers.find((p) => p.id === settings.aiProvider)?.defaultModel || "modello"}
                  />
                </Field>
                {settings.aiProvider === "custom" && (
                  <Field label="Base URL (OpenAI compatibile)">
                    <Input
                      value={settings.aiBaseUrl}
                      onChange={(e) => set("aiBaseUrl", e.target.value)}
                      placeholder="https://…/v1"
                    />
                  </Field>
                )}
                <Field label="Chiave API">
                  <Input
                    type="password"
                    value={aiKey}
                    onChange={(e) => setAiKey(e.target.value)}
                    placeholder={
                      aiConfigured
                        ? "•••• (lascia vuoto per non cambiarla)"
                        : providers.find((p) => p.id === settings.aiProvider)?.keyHint || "chiave…"
                    }
                  />
                </Field>
              </div>

              <div className="flex items-center gap-2">
                <Button onClick={saveAi} disabled={saving}>
                  <KeyRound className="h-4 w-4" /> {saving ? "Salvataggio…" : "Salva configurazione AI"}
                </Button>
                {aiConfigured && (
                  <Button
                    variant="ghost"
                    onClick={async () => {
                      await fetch("/api/settings", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ aiApiKey: "" }),
                      });
                      toast.success("Chiave rimossa");
                      loadSettings();
                    }}
                  >
                    Rimuovi chiave
                  </Button>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Info</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm text-muted-foreground">
          <p>Spoolio · v{process.env.NEXT_PUBLIC_APP_VERSION}</p>
          <p>
            Un progetto{" "}
            <a
              href="https://www.domotic-lab.it/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline underline-offset-2"
            >
              DomoticLab
            </a>{" "}
            · ™ 2025-2026 · Tutti i diritti riservati
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
