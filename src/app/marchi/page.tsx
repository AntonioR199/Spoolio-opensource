"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Trash2, Plus, Save } from "lucide-react";
import type { BrandWithStore, Store } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const NONE = "__none__";

export default function MarchiPage() {
  const [stores, setStores] = useState<Store[]>([]);
  const [brands, setBrands] = useState<BrandWithStore[]>([]);

  const load = useCallback(async () => {
    const [s, b] = await Promise.all([
      fetch("/api/stores").then((r) => r.json()),
      fetch("/api/brands").then((r) => r.json()),
    ]);
    setStores(s.stores ?? []);
    setBrands(b.brands ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Marchi e store</h1>
        <p className="text-sm text-muted-foreground">
          Collega ogni tua marca al suo store: così riordinare i filamenti finiti è a un clic.
        </p>
      </div>

      <Tabs defaultValue="brands" className="gap-6">
        <TabsList>
          <TabsTrigger value="brands">Marchi</TabsTrigger>
          <TabsTrigger value="stores">Store</TabsTrigger>
        </TabsList>
        <TabsContent value="brands">
          <BrandsSection brands={brands} stores={stores} onChange={load} />
        </TabsContent>
        <TabsContent value="stores">
          <StoresSection stores={stores} onChange={load} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ------------------------------- Store ------------------------------- */

function StoresSection({ stores, onChange }: { stores: Store[]; onChange: () => void }) {
  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      {stores.map((s) => (
        <StoreCard key={s.id} store={s} onChange={onChange} />
      ))}
      <StoreCard onChange={onChange} />
    </div>
  );
}

function StoreCard({ store, onChange }: { store?: Store; onChange: () => void }) {
  const [name, setName] = useState(store?.name ?? "");
  const [url, setUrl] = useState(store?.url ?? "");
  const [search, setSearch] = useState(store?.search_url_template ?? "");
  const [busy, setBusy] = useState(false);
  const isNew = !store;

  async function save() {
    if (!name.trim()) return toast.error("Nome store obbligatorio.");
    setBusy(true);
    try {
      const res = await fetch("/api/stores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: store?.id,
          name: name.trim(),
          url: url.trim() || null,
          search_url_template: search.trim() || null,
        }),
      });
      if (!res.ok) throw new Error("Salvataggio non riuscito");
      toast.success(isNew ? "Store aggiunto" : "Store aggiornato");
      if (isNew) {
        setName("");
        setUrl("");
        setSearch("");
      }
      onChange();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!store) return;
    setBusy(true);
    try {
      await fetch(`/api/stores?id=${store.id}`, { method: "DELETE" });
      toast.success("Store eliminato");
      onChange();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className={isNew ? "border-dashed" : ""}>
      <CardHeader>
        <CardTitle className="text-sm">{isNew ? "Nuovo store" : store!.name}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="space-y-1.5">
          <Label>Nome</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Es. Amazon IT" />
        </div>
        <div className="space-y-1.5">
          <Label>URL store</Label>
          <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" />
        </div>
        <div className="space-y-1.5">
          <Label>Template ricerca (opzionale)</Label>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="https://…/search?q={q}"
          />
          <p className="text-[11px] text-muted-foreground">
            Placeholder: <code>{"{q}"}</code> <code>{"{sku}"}</code> <code>{"{color}"}</code>
          </p>
        </div>
        <div className="flex gap-2 pt-1">
          <Button size="sm" onClick={save} disabled={busy}>
            {isNew ? <Plus className="h-3.5 w-3.5" /> : <Save className="h-3.5 w-3.5" />}
            {isNew ? "Aggiungi" : "Salva"}
          </Button>
          {!isNew && (
            <Button size="sm" variant="ghost" onClick={remove} disabled={busy}>
              <Trash2 className="h-3.5 w-3.5" /> Elimina
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/* ------------------------------- Marchi ------------------------------- */

function BrandsSection({
  brands,
  stores,
  onChange,
}: {
  brands: BrandWithStore[];
  stores: Store[];
  onChange: () => void;
}) {
  return (
    <div className="space-y-3">
      {brands.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Nessun marchio ancora. Compaiono qui appena importi o aggiungi filamenti.
        </p>
      )}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {brands.map((b) => (
          <BrandCard key={b.id} brand={b} stores={stores} onChange={onChange} />
        ))}
      </div>
    </div>
  );
}

function BrandCard({
  brand,
  stores,
  onChange,
}: {
  brand: BrandWithStore;
  stores: Store[];
  onChange: () => void;
}) {
  const [storeId, setStoreId] = useState<string>(brand.store_id ? String(brand.store_id) : NONE);
  const [tpl, setTpl] = useState(brand.product_url_template ?? "");
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      const res = await fetch("/api/brands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: brand.name,
          store_id: storeId === NONE ? null : Number(storeId),
          product_url_template: tpl.trim() || null,
        }),
      });
      if (!res.ok) throw new Error("Salvataggio non riuscito");
      toast.success(`Marchio ${brand.name} aggiornato`);
      onChange();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">{brand.name}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="space-y-1.5">
          <Label>Store di riferimento</Label>
          <Select value={storeId} onValueChange={(v) => setStoreId(v ?? NONE)}>
            <SelectTrigger className="w-full">
              <SelectValue>
                {(v: string) =>
                  v === NONE ? "Nessuno" : stores.find((s) => String(s.id) === v)?.name ?? "Nessuno"
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Nessuno</SelectItem>
              {stores.map((s) => (
                <SelectItem key={s.id} value={String(s.id)}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Template URL prodotto (opzionale)</Label>
          <Input
            value={tpl}
            onChange={(e) => setTpl(e.target.value)}
            placeholder="https://…/{sku}  (ha priorità sulla ricerca)"
          />
        </div>
        <Button size="sm" onClick={save} disabled={busy}>
          <Save className="h-3.5 w-3.5" /> Salva
        </Button>
      </CardContent>
    </Card>
  );
}
