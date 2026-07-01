"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Star, Trash2, Plus, Wifi, Loader2, Unplug } from "lucide-react";
import { PrinterThumb } from "@/components/PrinterThumb";
import { PrinterStatusCard } from "@/components/PrinterStatusCard";
import type { SafePrinter } from "@/lib/printers";
import { PRINTER_PRESETS, CONN_METHODS, connMethod, defaultConnMethod } from "@/lib/printerPresets";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const EMPTY = {
  name: "",
  brand: "",
  model: "",
  build_volume: "",
  nozzle_diameter: "0.4",
  tech: "FDM",
  notes: "",
};

export default function StampantiPage() {
  const [printers, setPrinters] = useState<SafePrinter[]>([]);
  const [defaultId, setDefaultId] = useState<number | null>(null);
  const [form, setForm] = useState({ ...EMPTY });
  const [saving, setSaving] = useState(false);

  // Collegamento in lettura (LAN).
  const [connTarget, setConnTarget] = useState<SafePrinter | null>(null);
  const [connForm, setConnForm] = useState({ method: "bambu-lan", host: "", serial: "", port: "", code: "" });
  const [testing, setTesting] = useState(false);
  const [savingConn, setSavingConn] = useState(false);

  const load = useCallback(async () => {
    const [p, s] = await Promise.all([
      fetch("/api/printers").then((r) => r.json()),
      fetch("/api/settings").then((r) => r.json()),
    ]);
    setPrinters(p.printers ?? []);
    setDefaultId(s.settings?.defaultPrinterId ?? null);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function applyPreset(idx: string) {
    const p = PRINTER_PRESETS[Number(idx)];
    if (!p) return;
    setForm({
      name: `${p.brand} ${p.model}`,
      brand: p.brand,
      model: p.model,
      build_volume: p.build_volume,
      nozzle_diameter: String(p.nozzle_diameter),
      tech: p.tech,
      notes: "",
    });
  }

  async function add() {
    if (!form.name.trim()) return toast.error("Il nome è obbligatorio.");
    setSaving(true);
    try {
      const res = await fetch("/api/printers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          brand: form.brand.trim() || null,
          model: form.model.trim() || null,
          build_volume: form.build_volume.trim() || null,
          nozzle_diameter: form.nozzle_diameter ? Number(form.nozzle_diameter) : null,
          tech: form.tech.trim() || null,
          notes: form.notes.trim() || null,
        }),
      });
      if (!res.ok) throw new Error("Salvataggio non riuscito");
      toast.success(`Stampante "${form.name}" aggiunta`);
      setForm({ ...EMPTY });
      load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function setDefault(id: number) {
    await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ defaultPrinterId: id }),
    });
    toast.success("Stampante predefinita aggiornata");
    load();
  }

  async function remove(id: number) {
    await fetch(`/api/printers?id=${id}`, { method: "DELETE" });
    if (defaultId === id) {
      await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ defaultPrinterId: null }),
      });
    }
    toast.success("Stampante eliminata");
    load();
  }

  function openConnect(p: SafePrinter) {
    const method = p.conn_type ?? defaultConnMethod(p.brand);
    const port = (p.conn_config?.port as number | string | undefined) ?? "";
    setConnForm({
      method,
      host: p.conn_host ?? "",
      serial: p.conn_serial ?? "",
      port: port === "" ? "" : String(port),
      code: "",
    });
    setConnTarget(p);
  }

  /** Payload di connessione comune a test e salvataggio, secondo il metodo scelto. */
  function buildConnPayload(): Record<string, unknown> | null {
    const method = connMethod(connForm.method);
    if (!method) return null;
    if (!connForm.host.trim()) {
      toast.error("L'indirizzo IP è obbligatorio.");
      return null;
    }
    if (method.needsSerial && !connForm.serial.trim()) {
      toast.error("Il numero di serie è obbligatorio per questo metodo.");
      return null;
    }
    const payload: Record<string, unknown> = {
      conn_type: method.id,
      conn_host: connForm.host.trim(),
      conn_serial: method.needsSerial ? connForm.serial.trim() : null,
      conn_config: method.needsPort
        ? { port: Number(connForm.port) || method.defaultPort }
        : null,
    };
    if (connForm.code.trim()) payload.conn_access_code = connForm.code;
    return payload;
  }

  async function testConn() {
    if (!connTarget) return;
    const method = connMethod(connForm.method);
    if (!method) return;
    const payload = buildConnPayload();
    if (!payload) return;
    // Per la prova il segreto (se richiesto) va inserito ora: non è persistito nel form.
    if (method.secretLabel && !connForm.code.trim()) {
      return toast.error(`Inserisci ${method.secretLabel.toLowerCase()} per la prova.`);
    }
    setTesting(true);
    try {
      const res = await fetch("/api/printers/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.ok) toast.success("Connessione riuscita: stampante raggiunta.");
      else toast.error(data.error ?? "Connessione non riuscita.");
    } catch {
      toast.error("Errore di rete durante la prova.");
    } finally {
      setTesting(false);
    }
  }

  async function saveConn() {
    if (!connTarget) return;
    const method = connMethod(connForm.method);
    if (!method) return;
    const payload = buildConnPayload();
    if (!payload) return;
    // Il segreto è già salvato (non rimandato al client): serve inserirlo solo la
    // prima volta o per cambiarlo. Se il metodo cambia, richiedilo di nuovo.
    const methodChanged = connTarget.conn_type !== method.id;
    if (method.secretLabel && (!connTarget.conn_configured || methodChanged) && !connForm.code.trim()) {
      return toast.error(`Inserisci ${method.secretLabel.toLowerCase()}.`);
    }
    setSavingConn(true);
    try {
      const body: Record<string, unknown> = {
        id: connTarget.id,
        name: connTarget.name,
        brand: connTarget.brand,
        model: connTarget.model,
        build_volume: connTarget.build_volume,
        nozzle_diameter: connTarget.nozzle_diameter,
        tech: connTarget.tech,
        notes: connTarget.notes,
        ...payload,
      };
      const res = await fetch("/api/printers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Salvataggio non riuscito");
      toast.success("Stampante collegata in lettura.");
      setConnTarget(null);
      load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSavingConn(false);
    }
  }

  async function disconnect(p: SafePrinter) {
    setSavingConn(true);
    try {
      await fetch("/api/printers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: p.id,
          name: p.name,
          brand: p.brand,
          model: p.model,
          build_volume: p.build_volume,
          nozzle_diameter: p.nozzle_diameter,
          tech: p.tech,
          notes: p.notes,
          conn_type: null,
          conn_host: null,
          conn_serial: null,
          conn_access_code: null,
          conn_config: null,
        }),
      });
      toast.success("Collegamento rimosso.");
      setConnTarget(null);
      load();
    } finally {
      setSavingConn(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Le mie stampanti</h1>
        <p className="text-sm text-muted-foreground">
          Aggiungi le tue stampanti da un preset o a mano, e scegli quella predefinita.
        </p>
      </div>

      {/* Elenco */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {printers.map((p) => {
          const isDefault = p.id === defaultId;
          return (
            <Card key={p.id} className={isDefault ? "border-primary/50" : ""}>
              <CardHeader className="flex-row items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <PrinterThumb brand={p.brand} model={p.model} size="sm" />
                  <CardTitle className="text-sm">{p.name}</CardTitle>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  {isDefault && (
                    <Badge variant="secondary" className="gap-1 text-primary">
                      <Star className="h-3 w-3 fill-current" /> Predefinita
                    </Badge>
                  )}
                  {p.conn_configured && (
                    <Badge variant="secondary" className="gap-1 text-emerald-600 dark:text-emerald-400">
                      <Wifi className="h-3 w-3" /> Collegata
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="text-xs text-muted-foreground">
                  {[p.build_volume, p.nozzle_diameter ? `ugello ${p.nozzle_diameter} mm` : null, p.tech]
                    .filter(Boolean)
                    .join(" · ") || "—"}
                </div>
                <div className="flex flex-wrap gap-2">
                  {!isDefault && (
                    <Button size="sm" variant="outline" onClick={() => setDefault(p.id)}>
                      <Star className="h-3.5 w-3.5" /> Predefinita
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => openConnect(p)}>
                    <Wifi className="h-3.5 w-3.5" /> {p.conn_configured ? "Collegamento" : "Collega"}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => remove(p.id)}>
                    <Trash2 className="h-3.5 w-3.5" /> Elimina
                  </Button>
                </div>
                {p.conn_configured && <PrinterStatusCard printerId={p.id} title="Stato in tempo reale" />}
              </CardContent>
            </Card>
          );
        })}
        {printers.length === 0 && (
          <p className="text-sm text-muted-foreground">Non hai ancora stampanti. Aggiungi la tua qui sotto.</p>
        )}
      </div>

      {/* Aggiungi */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Aggiungi stampante</CardTitle>
          <CardDescription>Scegli un preset per compilare i campi, oppure inseriscili a mano.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Preset</Label>
            <Select onValueChange={(v) => v != null && applyPreset(String(v))}>
              <SelectTrigger className="w-full sm:w-96">
                <SelectValue placeholder="Scegli un modello dal mercato…">
                  {(v: string | null) => {
                    if (v == null || v === "") return "Scegli un modello dal mercato…";
                    const p = PRINTER_PRESETS[Number(v)];
                    return p ? `${p.brand} ${p.model}` : "Scegli un modello dal mercato…";
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {PRINTER_PRESETS.map((p, i) => (
                  <SelectItem key={`${p.brand}-${p.model}`} value={String(i)}>
                    {p.brand} {p.model}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Nome *">
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label="Marca">
              <Input value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} />
            </Field>
            <Field label="Modello">
              <Input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} />
            </Field>
            <Field label="Volume di stampa">
              <Input
                value={form.build_volume}
                onChange={(e) => setForm({ ...form, build_volume: e.target.value })}
                placeholder="256×256×256 mm"
              />
            </Field>
            <Field label="Ugello (mm)">
              <Input
                type="number"
                step="0.1"
                value={form.nozzle_diameter}
                onChange={(e) => setForm({ ...form, nozzle_diameter: e.target.value })}
              />
            </Field>
            <Field label="Tecnologia">
              <Input value={form.tech} onChange={(e) => setForm({ ...form, tech: e.target.value })} />
            </Field>
          </div>

          <Button onClick={add} disabled={saving}>
            <Plus className="h-4 w-4" /> {saving ? "Aggiunta…" : "Aggiungi stampante"}
          </Button>
        </CardContent>
      </Card>

      {/* Collegamento in lettura (LAN) */}
      <Dialog open={connTarget != null} onOpenChange={(o) => !o && setConnTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Collega in lettura — {connTarget?.name}</DialogTitle>
            <DialogDescription>
              {connMethod(connForm.method)?.hint ??
                "Lettura via rete locale (LAN): scegli il metodo di connessione della stampante."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Field label="Metodo di connessione">
              <Select
                value={connForm.method}
                onValueChange={(v) => v != null && setConnForm({ ...connForm, method: String(v) })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONN_METHODS.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Indirizzo IP">
              <Input
                value={connForm.host}
                onChange={(e) => setConnForm({ ...connForm, host: e.target.value })}
                placeholder="192.168.1.50"
              />
            </Field>
            {connMethod(connForm.method)?.needsSerial && (
              <Field label="Numero di serie">
                <Input
                  value={connForm.serial}
                  onChange={(e) => setConnForm({ ...connForm, serial: e.target.value })}
                  placeholder="01P00A000000000"
                />
              </Field>
            )}
            {connMethod(connForm.method)?.needsPort && (
              <Field label="Porta">
                <Input
                  value={connForm.port}
                  onChange={(e) => setConnForm({ ...connForm, port: e.target.value })}
                  placeholder={String(connMethod(connForm.method)?.defaultPort ?? "")}
                />
              </Field>
            )}
            {connMethod(connForm.method)?.secretLabel && (
              <Field
                label={
                  connTarget?.conn_configured
                    ? `${connMethod(connForm.method)!.secretLabel} (lascia vuoto per non cambiarlo)`
                    : connMethod(connForm.method)!.secretLabel!
                }
              >
                <Input
                  type="password"
                  value={connForm.code}
                  onChange={(e) => setConnForm({ ...connForm, code: e.target.value })}
                />
              </Field>
            )}
            <div className="flex flex-wrap gap-2 pt-1">
              <Button variant="outline" onClick={testConn} disabled={testing || savingConn}>
                {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wifi className="h-4 w-4" />}
                Prova connessione
              </Button>
              <Button onClick={saveConn} disabled={savingConn || testing}>
                {savingConn ? "Salvataggio…" : "Salva collegamento"}
              </Button>
              {connTarget?.conn_configured && (
                <Button
                  variant="ghost"
                  onClick={() => connTarget && disconnect(connTarget)}
                  disabled={savingConn || testing}
                >
                  <Unplug className="h-4 w-4" /> Scollega
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
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
