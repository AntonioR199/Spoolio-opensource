"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import type { InventoryRow, Spool } from "@/lib/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { typeLabel } from "@/lib/labels";

function rowKey(r: InventoryRow) {
  return {
    brand: r.brand,
    material: r.material,
    variant: r.variant,
    color_name: r.color_name,
    color_code: r.color_code,
  };
}

// [singolare, plurale]
const FORMAT_LABEL: Record<string, [string, string]> = {
  spool: ["bobina", "bobine"],
  refill: ["ricarica", "ricariche"],
};

function uniq(values: Array<string | null>): string[] {
  return [...new Set(values.filter((v): v is string => !!v))];
}

export default function ItemDetailModal({
  row,
  onClose,
  onMutated,
}: {
  row: InventoryRow;
  onClose: () => void;
  onMutated: () => void;
}) {
  const [spools, setSpools] = useState<Spool[] | null>(null);
  const [invoiceSources, setInvoiceSources] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [confirmConsume, setConfirmConsume] = useState(false);
  const [editingPrice, setEditingPrice] = useState(false);
  const [priceInput, setPriceInput] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/group", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: rowKey(row) }),
    });
    const data = await res.json();
    setSpools(data.spools ?? []);
    setInvoiceSources(data.invoiceSources ?? []);
  }, [row]);

  useEffect(() => {
    load();
  }, [load]);

  async function act(url: string, ok: string) {
    setBusy(true);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: rowKey(row), quantity: 1 }),
      });
      if (res.ok) {
        await load();
        onMutated();
        toast.success(ok);
      } else {
        const d = await res.json().catch(() => ({}));
        toast.error(d.error ?? "Operazione non riuscita");
      }
    } finally {
      setBusy(false);
      setConfirmConsume(false);
    }
  }

  async function savePrice() {
    const raw = priceInput.replace(",", ".").trim();
    const value = raw === "" ? null : Number(raw);
    if (value !== null && (!Number.isFinite(value) || value < 0)) {
      toast.error("Prezzo non valido.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/price", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: rowKey(row), unit_price: value }),
      });
      if (res.ok) {
        await load();
        onMutated();
        toast.success("Prezzo aggiornato");
        setEditingPrice(false);
      } else {
        toast.error("Aggiornamento non riuscito");
      }
    } finally {
      setBusy(false);
    }
  }

  const qty = spools?.length ?? row.quantity;
  const formats = spools
    ? Object.entries(
        spools.reduce<Record<string, number>>((acc, s) => {
          const k = s.format ?? "n/d";
          acc[k] = (acc[k] ?? 0) + 1;
          return acc;
        }, {})
      )
        .map(([f, n]) => {
          const l = FORMAT_LABEL[f];
          return `${n} ${l ? (n === 1 ? l[0] : l[1]) : f}`;
        })
        .join(" · ")
    : "—";
  const skus = spools ? uniq(spools.map((s) => s.sku)) : [];
  const sources = spools ? uniq(spools.map((s) => s.source)) : [];
  const dates = spools ? uniq(spools.map((s) => s.purchase_date)) : [];
  const prices = spools ? spools.map((s) => s.unit_price).filter((p): p is number => p != null) : [];
  const avgPrice = prices.length ? prices.reduce((a, b) => a + b, 0) / prices.length : null;
  const totalWeightKg = spools ? spools.reduce((s, x) => s + x.nominal_weight_g, 0) / 1000 : 0;
  const diam = spools?.[0]?.diameter_mm ?? null;
  const weightG = spools?.[0]?.nominal_weight_g ?? null;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-4">
            <span
              className="h-12 w-12 shrink-0 rounded-xl border border-black/15 shadow-inner"
              style={{ backgroundColor: row.color_hex ?? "#B0B4B8" }}
            />
            <div className="min-w-0">
              <DialogTitle className="truncate text-base">{row.color_name}</DialogTitle>
              <DialogDescription>
                {typeLabel(row.material, row.variant)} · {row.brand}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <Separator />

        {/* Dettagli */}
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <Detail label="Quantità disponibile" value={`${qty}`} />
          <Detail label="Peso totale" value={`${totalWeightKg.toFixed(2)} kg`} />
          <Detail label="Formato" value={formats} />
          <Detail label="Diametro" value={diam ? `${diam} mm` : "—"} />
          <Detail label="Peso per unità" value={weightG ? `${weightG} g` : "—"} />
          <Detail label="Codice colore" value={row.color_code ?? "—"} />
          <Detail label="Colore (hex)" value={row.color_hex ?? "—"} mono />
          <div>
            <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">Prezzo / unità</dt>
            <dd className="mt-0.5">
              {editingPrice ? (
                <div className="flex items-center gap-1">
                  <Input
                    autoFocus
                    type="number"
                    step="0.01"
                    min={0}
                    value={priceInput}
                    onChange={(e) => setPriceInput(e.target.value)}
                    className="h-7 w-20"
                    placeholder="€"
                  />
                  <Button size="xs" onClick={savePrice} disabled={busy}>
                    OK
                  </Button>
                  <Button size="xs" variant="ghost" onClick={() => setEditingPrice(false)} disabled={busy}>
                    ✕
                  </Button>
                </div>
              ) : (
                <button
                  type="button"
                  className="inline-flex items-center gap-1 hover:underline"
                  onClick={() => {
                    setPriceInput(avgPrice != null ? String(avgPrice) : "");
                    setEditingPrice(true);
                  }}
                >
                  {avgPrice != null ? `€${avgPrice.toFixed(2)}` : "— imposta"}
                  <Pencil className="h-3 w-3 text-muted-foreground" />
                </button>
              )}
            </dd>
          </div>
          <Detail label="SKU" value={skus.length ? skus.join(", ") : "—"} mono span2 />
          <div className="col-span-2">
            <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">Provenienza</dt>
            <dd className="mt-0.5">
              {sources.length === 0
                ? "—"
                : sources.map((s, i) => (
                    <span key={s}>
                      {i > 0 && ", "}
                      {invoiceSources.includes(s) ? (
                        <a
                          href={`/api/invoices/file?order=${encodeURIComponent(s)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary underline underline-offset-2 hover:opacity-80"
                          title="Apri la fattura (PDF)"
                        >
                          {s}
                        </a>
                      ) : (
                        s
                      )}
                    </span>
                  ))}
            </dd>
          </div>
          <Detail label="Date acquisto" value={dates.length ? dates.join(", ") : "—"} span2 />
        </dl>

        <Separator />

        {/* Azioni */}
        {!confirmConsume ? (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="destructive"
              className="flex-1"
              disabled={busy || qty === 0}
              onClick={() => setConfirmConsume(true)}
            >
              Scarica una bobina (finita)
            </Button>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => act("/api/increment", "Aggiunta 1 unità")}
            >
              + Aggiungi 1
            </Button>
          </div>
        ) : (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/30">
            <p className="text-sm text-amber-800 dark:text-amber-200">
              Confermi lo scarico di <strong>una unità</strong> di {row.color_name}? Resterà nello
              storico ma non sarà più contata.
            </p>
            <div className="mt-3 flex gap-2">
              <Button
                variant="destructive"
                disabled={busy}
                onClick={() => act("/api/consume", `Scaricata una bobina di ${row.color_name}`)}
              >
                {busy ? "…" : "Sì, scaricata"}
              </Button>
              <Button variant="ghost" disabled={busy} onClick={() => setConfirmConsume(false)}>
                Annulla
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Detail({
  label,
  value,
  mono,
  span2,
}: {
  label: string;
  value: string;
  mono?: boolean;
  span2?: boolean;
}) {
  return (
    <div className={span2 ? "col-span-2" : ""}>
      <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className={`mt-0.5 ${mono ? "break-all font-mono text-xs" : ""}`}>{value}</dd>
    </div>
  );
}
