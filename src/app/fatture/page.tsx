"use client";

import { useCallback, useEffect, useState } from "react";
import { FileText, ExternalLink, Trash2, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import type { Invoice } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function FatturePage() {
  const [invoices, setInvoices] = useState<Invoice[] | null>(null);

  const load = useCallback(() => {
    fetch("/api/invoices")
      .then((r) => r.json())
      .then((d) => setInvoices(d.invoices ?? []))
      .catch(() => setInvoices([]));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Fatture</h1>
        <p className="text-sm text-muted-foreground">
          Qui conservo le tue fatture, già collegate ai filamenti che hai acquistato.
        </p>
      </div>

      {invoices === null && <p className="text-sm text-muted-foreground">Caricamento…</p>}

      {invoices && invoices.length === 0 && (
        <Card className="flex flex-col items-center gap-2 py-12 text-center">
          <FileText className="h-8 w-8 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">
            Non hai ancora fatture conservate. Caricane una da <strong>Carica fattura</strong>.
          </p>
        </Card>
      )}

      {invoices && invoices.length > 0 && (
        <Card className="overflow-hidden p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ordine</TableHead>
                <TableHead>Data</TableHead>
                <TableHead className="text-right">Unità</TableHead>
                <TableHead>Caricata</TableHead>
                <TableHead className="text-right">Azioni</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell className="font-mono text-xs">{inv.order_number ?? "—"}</TableCell>
                  <TableCell>{inv.invoice_date ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{inv.unit_count ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{inv.uploaded_at?.slice(0, 10)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        nativeButton={false}
                        render={
                          <a href={`/api/invoices/file?id=${inv.id}`} target="_blank" rel="noopener noreferrer" />
                        }
                      >
                        <ExternalLink className="h-3.5 w-3.5" /> Apri
                      </Button>
                      <DeleteInvoiceButton invoice={inv} onDeleted={load} />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}

function DeleteInvoiceButton({ invoice, onDeleted }: { invoice: Invoice; onDeleted: () => void }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const label = invoice.order_number ?? invoice.original_name ?? `#${invoice.id}`;

  function close() {
    setOpen(false);
    setTimeout(() => setStep(1), 200);
  }

  async function confirmDelete() {
    setBusy(true);
    try {
      const res = await fetch(`/api/invoices?id=${invoice.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Eliminazione non riuscita");
      toast.success(`Fattura ${label} eliminata`);
      onDeleted();
      close();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)} aria-label="Elimina fattura">
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
      <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
        <DialogContent>
          {step === 1 ? (
            <>
              <DialogHeader>
                <DialogTitle>Eliminare la fattura {label}?</DialogTitle>
                <DialogDescription>
                  Rimuoverò il PDF e il record della fattura. I filamenti importati restano in
                  inventario.
                </DialogDescription>
              </DialogHeader>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={close}>
                  Annulla
                </Button>
                <Button variant="destructive" onClick={() => setStep(2)}>
                  Continua
                </Button>
              </div>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-destructive">
                  <TriangleAlert className="h-5 w-5" /> Conferma definitiva
                </DialogTitle>
                <DialogDescription>
                  Questa azione è <strong>irreversibile</strong>. Vuoi davvero eliminare la fattura{" "}
                  {label}?
                </DialogDescription>
              </DialogHeader>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={close} disabled={busy}>
                  Annulla
                </Button>
                <Button variant="destructive" onClick={confirmDelete} disabled={busy}>
                  {busy ? "Eliminazione…" : "Elimina definitivamente"}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
