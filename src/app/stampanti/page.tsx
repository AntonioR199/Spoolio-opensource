"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Star, Trash2, Plus } from "lucide-react";
import { PrinterThumb } from "@/components/PrinterThumb";
import type { Printer } from "@/lib/types";
import { PRINTER_PRESETS } from "@/lib/printerPresets";
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
  const [printers, setPrinters] = useState<Printer[]>([]);
  const [defaultId, setDefaultId] = useState<number | null>(null);
  const [form, setForm] = useState({ ...EMPTY });
  const [saving, setSaving] = useState(false);

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
                {isDefault && (
                  <Badge variant="secondary" className="gap-1 text-primary">
                    <Star className="h-3 w-3 fill-current" /> Predefinita
                  </Badge>
                )}
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="text-xs text-muted-foreground">
                  {[p.build_volume, p.nozzle_diameter ? `ugello ${p.nozzle_diameter} mm` : null, p.tech]
                    .filter(Boolean)
                    .join(" · ") || "—"}
                </div>
                <div className="flex gap-2">
                  {!isDefault && (
                    <Button size="sm" variant="outline" onClick={() => setDefault(p.id)}>
                      <Star className="h-3.5 w-3.5" /> Predefinita
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => remove(p.id)}>
                    <Trash2 className="h-3.5 w-3.5" /> Elimina
                  </Button>
                </div>
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
