"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { DraftItem, InventoryRow } from "@/lib/types";
import { parseSku, deriveMaterial } from "@/lib/bambu";
import { resolveColorHex } from "@/lib/colors";
import { Combobox } from "@/components/Combobox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function AddPage() {
  const [tab, setTab] = useState("increment");
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Aggiungi a mano</h1>
        <p className="text-sm text-muted-foreground">
          Incrementa un filamento che hai già, oppure aggiungine uno nuovo (di qualsiasi marca).
        </p>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as string)} className="gap-6">
        <TabsList>
          <TabsTrigger value="increment">Incrementa esistente</TabsTrigger>
          <TabsTrigger value="new">Nuovo prodotto</TabsTrigger>
        </TabsList>
        <TabsContent value="increment">
          <IncrementForm />
        </TabsContent>
        <TabsContent value="new">
          <NewProductForm />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ----------------------------- Incrementa ----------------------------- */

function IncrementForm() {
  const router = useRouter();
  const [rows, setRows] = useState<InventoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<InventoryRow | null>(null);
  const [qty, setQty] = useState(1);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/inventory")
      .then((r) => r.json())
      .then((d) => setRows(d.rows ?? []))
      .catch(() => toast.error("Impossibile caricare l'inventario."))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      `${r.brand} ${r.material} ${r.variant ?? ""} ${r.color_name} ${r.color_code ?? ""}`
        .toLowerCase()
        .includes(q)
    );
  }, [rows, query]);

  async function save() {
    if (!selected) return;
    setSaving(true);
    try {
      const res = await fetch("/api/increment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: {
            brand: selected.brand,
            material: selected.material,
            variant: selected.variant,
            color_name: selected.color_name,
            color_code: selected.color_code,
          },
          quantity: qty,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Errore");
      toast.success(`Aggiunte ${qty} unità a ${selected.color_name}`);
      router.push("/");
    } catch (e) {
      toast.error((e as Error).message);
      setSaving(false);
    }
  }

  if (loading) return <p className="text-sm text-muted-foreground">Caricamento inventario…</p>;

  return (
    <div className="max-w-2xl space-y-4">
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Cerca colore, tipo o marca…"
      />

      <Card className="max-h-80 overflow-y-auto p-0">
        <div className="divide-y">
          {filtered.map((r) => {
            const isSel = selected && sameRow(selected, r);
            return (
              <button
                key={`${r.brand}-${r.material}-${r.variant}-${r.color_name}-${r.color_code}`}
                onClick={() => setSelected(r)}
                className={`flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors ${
                  isSel ? "bg-accent" : "hover:bg-muted/60"
                }`}
              >
                <span
                  className="h-6 w-6 shrink-0 rounded-full border border-black/15"
                  style={{ backgroundColor: r.color_hex ?? "#B0B4B8" }}
                />
                <span className="flex-1">
                  <span className="font-medium">{r.color_name}</span>{" "}
                  <span className="text-muted-foreground">
                    · {r.material}
                    {r.variant ? ` ${r.variant}` : ""} · {r.brand}
                  </span>
                </span>
                <span className="tabular-nums text-muted-foreground">×{r.quantity}</span>
              </button>
            );
          })}
          {filtered.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">Nessun risultato.</p>
          )}
        </div>
      </Card>

      <div className="flex items-center gap-3">
        <Label htmlFor="incr-qty" className="text-muted-foreground">
          Quantità da aggiungere
        </Label>
        <Input
          id="incr-qty"
          type="number"
          min={1}
          value={qty}
          onChange={(e) => setQty(Math.max(1, parseInt(e.target.value || "1", 10)))}
          className="w-24"
        />
        <Button onClick={save} disabled={!selected || saving}>
          {saving ? "Salvataggio…" : selected ? `Aggiungi a ${selected.color_name}` : "Seleziona un filamento"}
        </Button>
      </div>
    </div>
  );
}

function sameRow(a: InventoryRow, b: InventoryRow) {
  return (
    a.brand === b.brand &&
    a.material === b.material &&
    (a.variant ?? "") === (b.variant ?? "") &&
    a.color_name === b.color_name &&
    (a.color_code ?? "") === (b.color_code ?? "")
  );
}

/* ----------------------------- Nuovo prodotto ----------------------------- */

const EMPTY: DraftItem = {
  brand: "Bambu Lab",
  material: "PLA",
  variant: null,
  color_name: "",
  color_code: null,
  color_hex: "#B0B4B8",
  format: null,
  diameter_mm: 1.75,
  nominal_weight_g: 1000,
  sku: null,
  unit_price: null,
  quantity: 1,
  include: true,
};

const FORMAT_LABELS: Record<string, string> = { spool: "Bobina", refill: "Ricarica" };

function NewProductForm() {
  const router = useRouter();
  const [item, setItem] = useState<DraftItem>({ ...EMPTY });
  const [brands, setBrands] = useState<string[]>([]);
  const [materials, setMaterials] = useState<string[]>([]);
  const [variants, setVariants] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/inventory")
      .then((r) => r.json())
      .then((d) => {
        const rows: InventoryRow[] = d.rows ?? [];
        setBrands(d.stats?.brands ?? []);
        setMaterials([...new Set(rows.map((r) => r.material).filter(Boolean))].sort());
        setVariants([...new Set(rows.map((r) => r.variant).filter((v): v is string => !!v))].sort());
      })
      .catch(() => {});

    // Default dal pannello Impostazioni.
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => {
        const s = d.settings;
        if (!s) return;
        setItem((p) => ({
          ...p,
          brand: s.defaultBrand,
          diameter_mm: s.defaultDiameterMm,
          nominal_weight_g: s.defaultWeightG,
        }));
      })
      .catch(() => {});
  }, []);

  function set<K extends keyof DraftItem>(k: K, v: DraftItem[K]) {
    setItem((p) => ({ ...p, [k]: v }));
  }

  function autofillFromSku() {
    if (!item.sku) return;
    const parsed = parseSku(item.sku);
    if (!parsed) {
      toast.info("SKU non in formato Bambu: compila i campi a mano.");
      return;
    }
    const { material, variant } = deriveMaterial("", parsed.materialCode);
    setItem((p) => ({
      ...p,
      brand: "Bambu Lab",
      material,
      variant,
      format: parsed.format,
      diameter_mm: parsed.diameter_mm,
      nominal_weight_g: parsed.nominal_weight_g,
    }));
    toast.success("Campi compilati dallo SKU. Aggiungi nome e codice colore.");
  }

  async function save() {
    if (!item.color_name.trim() || !item.material.trim()) {
      toast.error("Materiale e nome colore sono obbligatori.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: [item], source: "manual", purchase_date: null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Errore");
      toast.success(`Salvate ${item.quantity} unità di ${item.color_name}`);
      router.push("/");
    } catch (e) {
      toast.error((e as Error).message);
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-4">
      {/* Autofill SKU */}
      <Card>
        <CardContent className="space-y-2">
          <Label htmlFor="sku">Codice prodotto / SKU</Label>
          <div className="flex gap-2">
            <Input
              id="sku"
              value={item.sku ?? ""}
              onChange={(e) => set("sku", e.target.value || null)}
              placeholder="es. A01-K1-1.75-1000-SPLFREE  oppure  ePLA+HS-…"
            />
            <Button variant="outline" className="whitespace-nowrap" onClick={autofillFromSku}>
              Autofill da SKU Bambu
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Campi */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Marca">
          <Combobox
            value={item.brand}
            onChange={(v) => set("brand", v)}
            options={brands}
            placeholder="Bambu Lab, eSun…"
          />
        </Field>
        <Field label="Materiale *">
          <Combobox
            value={item.material}
            onChange={(v) => set("material", v)}
            options={materials}
            placeholder="PLA, PETG…"
          />
        </Field>
        <Field label="Variante">
          <Combobox
            value={item.variant ?? ""}
            onChange={(v) => set("variant", v || null)}
            options={variants}
            placeholder="Matte, Basic, PLA+ HS…"
          />
        </Field>
        <Field label="Nome colore *" htmlFor="color_name">
          <Input
            id="color_name"
            value={item.color_name}
            onChange={(e) => set("color_name", e.target.value)}
          />
        </Field>
        <Field label="Codice colore" htmlFor="color_code">
          <Input
            id="color_code"
            value={item.color_code ?? ""}
            onChange={(e) => set("color_code", e.target.value || null)}
          />
        </Field>
        <Field label="Colore">
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={item.color_hex ?? "#B0B4B8"}
              onChange={(e) => set("color_hex", e.target.value)}
              className="h-9 w-12 cursor-pointer rounded border"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => set("color_hex", resolveColorHex(item.color_code, item.color_name))}
            >
              Stima dal nome
            </Button>
          </div>
        </Field>
        <Field label="Formato">
          <Select
            value={item.format ?? ""}
            onValueChange={(v) => set("format", (v || null) as DraftItem["format"])}
          >
            <SelectTrigger className="w-full">
              <SelectValue>{(v: string) => FORMAT_LABELS[v] ?? "—"}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">—</SelectItem>
              <SelectItem value="spool">Bobina</SelectItem>
              <SelectItem value="refill">Ricarica</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Diametro (mm)" htmlFor="diam">
          <Input
            id="diam"
            type="number"
            step="0.05"
            value={item.diameter_mm}
            onChange={(e) => set("diameter_mm", parseFloat(e.target.value || "1.75"))}
          />
        </Field>
        <Field label="Peso (g)" htmlFor="weight">
          <Input
            id="weight"
            type="number"
            value={item.nominal_weight_g}
            onChange={(e) => set("nominal_weight_g", parseInt(e.target.value || "1000", 10))}
          />
        </Field>
        <Field label="Quantità" htmlFor="qty">
          <Input
            id="qty"
            type="number"
            min={1}
            value={item.quantity}
            onChange={(e) => set("quantity", Math.max(1, parseInt(e.target.value || "1", 10)))}
          />
        </Field>
        <Field label="Prezzo a bobina (€)" htmlFor="price">
          <Input
            id="price"
            type="number"
            step="0.01"
            min={0}
            value={item.unit_price ?? ""}
            onChange={(e) => set("unit_price", e.target.value ? parseFloat(e.target.value) : null)}
            placeholder="opzionale"
          />
        </Field>
      </div>

      <Button onClick={save} disabled={saving}>
        {saving ? "Salvataggio…" : `Salva (${item.quantity} unità)`}
      </Button>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}
