"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { UploadCloud, FileText, X } from "lucide-react";
import type { DraftItem, ParseResult } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const EMPTY_ITEM: DraftItem = {
  brand: "",
  material: "PLA",
  variant: null,
  color_name: "",
  color_code: null,
  color_hex: null,
  format: null,
  diameter_mm: 1.75,
  nominal_weight_g: 1000,
  sku: null,
  unit_price: null,
  quantity: 1,
  include: true,
};

export default function UploadPage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);

  function pickFile(f: File | null | undefined) {
    if (!f) return;
    if (f.type !== "application/pdf" && !f.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Il file deve essere un PDF.");
      return;
    }
    setFile(f);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    pickFile(e.dataTransfer.files?.[0]);
  }
  const [saving, setSaving] = useState(false);
  const [meta, setMeta] = useState<Pick<ParseResult, "method" | "warnings" | "source" | "purchase_date"> | null>(null);
  const [items, setItems] = useState<DraftItem[]>([]);

  async function analyze() {
    if (!file) return;
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Errore sconosciuto");
      const r = data as ParseResult;
      setItems(r.items);
      setMeta({ method: r.method, warnings: r.warnings, source: r.source, purchase_date: r.purchase_date });
      toast.success(`Estratti ${r.items.length} filamenti`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function update(i: number, patch: Partial<DraftItem>) {
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  }

  async function save() {
    setSaving(true);
    try {
      // multipart: payload JSON + il PDF originale, così la fattura viene conservata.
      const fd = new FormData();
      fd.append(
        "payload",
        JSON.stringify({ items, source: meta?.source ?? null, purchase_date: meta?.purchase_date ?? null })
      );
      if (file) fd.append("file", file);
      const res = await fetch("/api/confirm", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Errore nel salvataggio");
      toast.success(`Salvate ${data.inserted} unità · fattura conservata`);
      router.push("/");
    } catch (e) {
      toast.error((e as Error).message);
      setSaving(false);
    }
  }

  const includedUnits = items.filter((i) => i.include).reduce((s, i) => s + (i.quantity || 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Carica fattura</h1>
        <p className="text-sm text-muted-foreground">
          Carica la tua fattura: leggo i filamenti (gli accessori li scarto io), tu controlli e confermi.
        </p>
      </div>

      {/* Drag & drop / selettore file */}
      <Card>
        <CardContent className="space-y-3">
          <div
            role="button"
            tabIndex={0}
            onClick={() => inputRef.current?.click()}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
              dragging ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"
            }`}
          >
            <UploadCloud className={`h-8 w-8 ${dragging ? "text-primary" : "text-muted-foreground"}`} />
            <p className="text-sm font-medium">Trascina qui il PDF della fattura</p>
            <p className="text-xs text-muted-foreground">oppure clicca per selezionarlo</p>
            <input
              ref={inputRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => {
                pickFile(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </div>

          {file && (
            <div className="flex items-center justify-between rounded-lg border p-2 pl-3">
              <div className="flex min-w-0 items-center gap-2 text-sm">
                <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="truncate">{file.name}</span>
                <span className="shrink-0 text-muted-foreground">
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </span>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Rimuovi file"
                onClick={() => setFile(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}

          <Button onClick={analyze} disabled={!file || loading}>
            {loading ? "Analisi in corso…" : "Analizza"}
          </Button>
        </CardContent>
      </Card>

      {meta && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">
              Metodo: {meta.method === "bambu" ? "Parser Bambu" : meta.method === "ai" ? "AI" : "—"}
            </Badge>
            {meta.source && <Badge variant="secondary">Ordine: {meta.source}</Badge>}
            {meta.purchase_date && <Badge variant="secondary">Data: {meta.purchase_date}</Badge>}
            <Badge variant="secondary">
              {items.length} righe · {includedUnits} unità
            </Badge>
          </div>

          {meta.warnings.map((w, i) => (
            <div
              key={i}
              className="rounded-lg border border-amber-300 bg-amber-50 p-2 text-sm text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300"
            >
              ⚠ {w}
            </div>
          ))}

          {/* Tabella revisione */}
          <Card className="overflow-hidden p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">✓</TableHead>
                  <TableHead>Materiale</TableHead>
                  <TableHead>Variante</TableHead>
                  <TableHead>Colore</TableHead>
                  <TableHead>Codice</TableHead>
                  <TableHead className="w-20">Qtà</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((it, i) => (
                  <TableRow key={i} className={it.include ? "" : "opacity-40"}>
                    <TableCell>
                      <Checkbox
                        checked={it.include}
                        onCheckedChange={(c) => update(i, { include: c === true })}
                      />
                    </TableCell>
                    <TableCell>
                      <Input value={it.material} onChange={(e) => update(i, { material: e.target.value })} />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={it.variant ?? ""}
                        onChange={(e) => update(i, { variant: e.target.value || null })}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span
                          className="h-5 w-5 shrink-0 rounded-full border border-black/15"
                          style={{ backgroundColor: it.color_hex ?? "#B0B4B8" }}
                        />
                        <Input
                          value={it.color_name}
                          onChange={(e) => update(i, { color_name: e.target.value })}
                        />
                      </div>
                    </TableCell>
                    <TableCell>
                      <Input
                        value={it.color_code ?? ""}
                        onChange={(e) => update(i, { color_code: e.target.value || null })}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={0}
                        value={it.quantity}
                        onChange={(e) => update(i, { quantity: parseInt(e.target.value || "0", 10) })}
                        className="w-16"
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" onClick={() => setItems((p) => [...p, { ...EMPTY_ITEM }])}>
              + Aggiungi riga
            </Button>
            <Button onClick={save} disabled={saving || includedUnits === 0}>
              {saving ? "Salvataggio…" : `Conferma e salva (${includedUnits} unità)`}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
