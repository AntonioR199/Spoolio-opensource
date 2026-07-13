"use client";

import { useCallback, useEffect, useState } from "react";
import { ExternalLink, RotateCcw, PackageX, Download } from "lucide-react";
import { toast } from "sonner";
import type { EmptyRow } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { typeLabel } from "@/lib/labels";

function label(r: EmptyRow) {
  return typeLabel(r.material, r.variant);
}

export default function EsauritiPage() {
  const [rows, setRows] = useState<EmptyRow[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/empty");
    const data = await res.json();
    setRows(data.rows ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function restore(r: EmptyRow) {
    const id = `${r.brand}|${r.material}|${r.variant}|${r.color_name}|${r.color_code}`;
    setBusy(id);
    try {
      const res = await fetch("/api/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: {
            brand: r.brand,
            material: r.material,
            variant: r.variant,
            color_name: r.color_name,
            color_code: r.color_code,
          },
          quantity: 1,
        }),
      });
      if (res.ok) {
        toast.success(`Ripristinata 1 unità di ${r.color_name}`);
        await load();
      } else {
        toast.error("Ripristino non riuscito");
      }
    } finally {
      setBusy(null);
    }
  }

  // Raggruppa per materiale+variante
  const groups = new Map<string, EmptyRow[]>();
  for (const r of rows ?? []) {
    const k = label(r);
    (groups.get(k) ?? groups.set(k, []).get(k)!).push(r);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Esauriti</h1>
          <p className="text-sm text-muted-foreground">
            I tuoi filamenti finiti: ripristinali se li ricompri, o riordina al volo.
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          nativeButton={false}
          render={<a href="/api/export/consumption" />}
        >
          <Download className="h-3.5 w-3.5" /> Esporta CSV
        </Button>
      </div>

      {rows === null && <p className="text-sm text-muted-foreground">Caricamento…</p>}

      {rows && rows.length === 0 && (
        <Card className="flex flex-col items-center gap-2 py-12 text-center">
          <PackageX className="h-8 w-8 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">Non hai filamenti esauriti. 🎉</p>
        </Card>
      )}

      {[...groups.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([lbl, items]) => (
          <section key={lbl}>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {lbl}
            </h2>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((r) => {
                const id = `${r.brand}|${r.material}|${r.variant}|${r.color_name}|${r.color_code}`;
                return (
                  <Card key={id} className="flex-row items-center gap-3 p-3">
                    <span
                      className="h-8 w-8 shrink-0 rounded-full border border-black/15 opacity-60 grayscale"
                      style={{ backgroundColor: r.color_hex ?? "#B0B4B8" }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{r.color_name}</div>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Badge variant="secondary" className="px-1.5 py-0">
                          {r.brand}
                        </Badge>
                        <span>×{r.quantity} finite</span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy === id}
                        onClick={() => restore(r)}
                      >
                        <RotateCcw className="h-3.5 w-3.5" /> Ripristina
                      </Button>
                      {r.repurchase_url ? (
                        <Button
                          size="sm"
                          nativeButton={false}
                          render={<a href={r.repurchase_url} target="_blank" rel="noopener noreferrer" />}
                        >
                          <ExternalLink className="h-3.5 w-3.5" /> Ricompra
                        </Button>
                      ) : (
                        <Button size="sm" variant="ghost" disabled title="Imposta lo store del marchio">
                          Nessuno store
                        </Button>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          </section>
        ))}
    </div>
  );
}
