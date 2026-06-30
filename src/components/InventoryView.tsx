"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Search, TriangleAlert, Droplets } from "lucide-react";
import type { InventoryRow } from "@/lib/types";
import ItemDetailModal from "./ItemDetailModal";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { typeLabel } from "@/lib/labels";

interface Stats {
  totalUnits: number;
  distinctColors: number;
  byMaterial: Array<{ material: string; units: number; colors: number }>;
  brands: string[];
}

function groupLabel(r: InventoryRow): string {
  return typeLabel(r.material, r.variant);
}

/** Pallino colore con bordo, leggibile anche su colori chiari. */
function Swatch({ hex, className }: { hex: string | null; className?: string }) {
  return (
    <span
      className={`inline-block shrink-0 rounded-full border border-black/15 shadow-inner ${className ?? "h-8 w-8"}`}
      style={{ backgroundColor: hex ?? "#B0B4B8" }}
    />
  );
}

export default function InventoryView({ rows, stats }: { rows: InventoryRow[]; stats: Stats }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [material, setMaterial] = useState<string | null>(null);
  const [brand, setBrand] = useState<string | null>(null);
  const [onlyLow, setOnlyLow] = useState(false);
  const [onlyDry, setOnlyDry] = useState(false);
  const [selected, setSelected] = useState<InventoryRow | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (material && r.material !== material) return false;
      if (brand && r.brand !== brand) return false;
      if (onlyLow && !r.low_stock) return false;
      if (onlyDry && !r.needs_drying) return false;
      if (!q) return true;
      return (
        r.color_name.toLowerCase().includes(q) ||
        (r.color_code ?? "").toLowerCase().includes(q) ||
        r.brand.toLowerCase().includes(q) ||
        groupLabel(r).toLowerCase().includes(q)
      );
    });
  }, [rows, query, material, brand, onlyLow, onlyDry]);

  const groups = useMemo(() => {
    const map = new Map<string, InventoryRow[]>();
    for (const r of filtered) {
      const k = groupLabel(r);
      (map.get(k) ?? map.set(k, []).get(k)!).push(r);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  const materials = stats.byMaterial.map((m) => m.material);
  const lowCount = rows.filter((r) => r.low_stock).length;
  const dryCount = rows.filter((r) => r.needs_drying).length;

  return (
    <div className="space-y-6">
      {/* Statistiche */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Unità totali" value={stats.totalUnits} />
        <StatCard label="Colori distinti" value={stats.distinctColors} />
        <StatCard label="Tipi materiale" value={stats.byMaterial.length} />
        <StatCard label="Scorta bassa" value={lowCount} accent={lowCount > 0} />
      </div>

      {/* Filtri */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-50 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cerca colore, codice, tipo o marca…"
            className="pl-8"
          />
        </div>
        <Button variant={material === null ? "default" : "outline"} size="sm" onClick={() => setMaterial(null)}>
          Tutti
        </Button>
        {materials.map((m) => (
          <Button
            key={m}
            variant={material === m ? "default" : "outline"}
            size="sm"
            onClick={() => setMaterial(m)}
          >
            {m}
          </Button>
        ))}
        <Button
          variant={onlyLow ? "default" : "outline"}
          size="sm"
          onClick={() => setOnlyLow((v) => !v)}
        >
          <TriangleAlert className="h-3.5 w-3.5" /> Scorta bassa
        </Button>
        <Button
          variant={onlyDry ? "default" : "outline"}
          size="sm"
          onClick={() => setOnlyDry((v) => !v)}
        >
          <Droplets className="h-3.5 w-3.5" /> Da asciugare{dryCount > 0 ? ` (${dryCount})` : ""}
        </Button>
      </div>

      {/* Filtro marca */}
      {stats.brands.length > 1 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs uppercase tracking-wider text-muted-foreground">Marca</span>
          <Button variant={brand === null ? "default" : "outline"} size="sm" onClick={() => setBrand(null)}>
            Tutte
          </Button>
          {stats.brands.map((b) => (
            <Button key={b} variant={brand === b ? "default" : "outline"} size="sm" onClick={() => setBrand(b)}>
              {b}
            </Button>
          ))}
        </div>
      )}

      {/* Gruppi */}
      {groups.length === 0 && (
        <p className="py-12 text-center text-sm text-muted-foreground">Nessun filamento corrisponde ai filtri.</p>
      )}

      {groups.map(([label, items]) => {
        const tot = items.reduce((s, r) => s + r.quantity, 0);
        return (
          <section key={label}>
            <div className="mb-2 flex items-baseline justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{label}</h2>
              <span className="text-xs text-muted-foreground/70">
                {items.length} colori · {tot} unità
              </span>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((r) => (
                <Card
                  key={`${r.brand}-${label}-${r.color_code}-${r.color_name}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelected(r)}
                  onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setSelected(r)}
                  className={`cursor-pointer flex-row items-center gap-3 p-3 transition-colors hover:border-primary/40 hover:shadow-sm ${
                    r.low_stock ? "border-amber-400/70" : ""
                  }`}
                >
                  <Swatch hex={r.color_hex} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{r.color_name}</div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Badge variant="secondary" className="px-1.5 py-0 font-medium">
                        {r.brand}
                      </Badge>
                      {r.color_code && <span>{r.color_code}</span>}
                      {r.in_use > 0 && <span>{r.in_use} in uso</span>}
                      {r.needs_drying && (
                        <span className="inline-flex items-center gap-0.5 text-sky-600 dark:text-sky-400">
                          <Droplets className="h-3 w-3" /> da asciugare
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="text-right">
                      <div className="text-lg font-semibold tabular-nums leading-none">{r.quantity}</div>
                      {r.low_stock && (
                        <div className="text-[10px] font-medium text-amber-600">bassa</div>
                      )}
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
                  </div>
                </Card>
              ))}
            </div>
          </section>
        );
      })}

      {selected && (
        <ItemDetailModal
          row={selected}
          onClose={() => setSelected(null)}
          onMutated={() => router.refresh()}
        />
      )}
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <Card className={accent ? "border-amber-400/70 bg-amber-50/60 dark:bg-amber-950/20" : ""}>
      <CardContent className="px-4">
        <div className="text-2xl font-semibold tabular-nums">{value}</div>
        <div className="text-xs text-muted-foreground">{label}</div>
      </CardContent>
    </Card>
  );
}
