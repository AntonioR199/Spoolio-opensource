import Link from "next/link";
import {
  Printer,
  Boxes,
  Weight,
  Palette,
  Euro,
  ShoppingCart,
  FileText,
  ArrowRight,
  PackageX,
  TrendingUp,
  Layers,
} from "lucide-react";
import { getInventory, getStats, getValueByMaterial, getConsumptionByMonth } from "@/lib/inventory";
import { buildRepurchaseUrl } from "@/lib/catalog";
import { listInvoices } from "@/lib/invoices";
import { getDefaultPrinter } from "@/lib/printers";
import { getPaletteCoverage } from "@/lib/palette";
import { typeLabel } from "@/lib/labels";
import { PrinterThumb } from "@/components/PrinterThumb";
import { PrinterStatusCard } from "@/components/PrinterStatusCard";
import DryingNotifications from "@/components/DryingNotifications";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const [stats, rows, invoicesAll, printer, valueByMaterial, consumption] = await Promise.all([
    getStats(),
    getInventory(),
    listInvoices(),
    getDefaultPrinter(),
    getValueByMaterial(),
    getConsumptionByMonth(6),
  ]);
  const lowStock = rows.filter((r) => r.low_stock);
  const invoices = invoicesAll.slice(0, 5);
  const palette = getPaletteCoverage(rows.map((r) => r.color_name));
  const missing = palette.filter((p) => !p.present);

  const maxValue = Math.max(1, ...valueByMaterial.map((m) => m.value));
  const maxConsumption = Math.max(1, ...consumption.map((c) => c.units));

  // Suggerimenti di riacquisto: scorta bassa con link allo store del marchio.
  const repurchase = await Promise.all(
    lowStock.slice(0, 6).map(async (r) => ({
      row: r,
      url: await buildRepurchaseUrl({
        brand: r.brand,
        material: r.material,
        variant: r.variant,
        color: r.color_name,
        sku: null,
      }),
    }))
  );

  return (
    <div className="space-y-6">
      <DryingNotifications dryCount={rows.filter((r) => r.needs_drying).length} />

      <div>
        <h1 className="text-2xl font-bold tracking-tight">La tua dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Tutto il tuo magazzino filamenti e la tua stampa 3D, a colpo d&apos;occhio.
        </p>
      </div>

      {/* Stampante predefinita */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-4">
          {printer ? (
            <PrinterThumb brand={printer.brand} model={printer.model} />
          ) : (
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white">
              <Printer className="h-6 w-6" />
            </span>
          )}
          {printer ? (
            <>
              <div className="min-w-0 flex-1">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">La tua stampante</div>
                <div className="text-lg font-semibold">{printer.name}</div>
                <div className="text-sm text-muted-foreground">
                  {[printer.build_volume, printer.nozzle_diameter ? `ugello ${printer.nozzle_diameter} mm` : null, printer.tech]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
              </div>
              <Button variant="outline" nativeButton={false} render={<Link href="/stampanti" />}>
                Le mie stampanti <ArrowRight className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <div className="flex flex-1 flex-wrap items-center justify-between gap-3">
              <div>
                <div className="font-medium">Non hai ancora una stampante</div>
                <div className="text-sm text-muted-foreground">Aggiungi la tua per vederla qui in primo piano.</div>
              </div>
              <Button nativeButton={false} render={<Link href="/stampanti" />}>
                Aggiungi la tua stampante
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stato in tempo reale della stampante collegata */}
      {printer?.conn_configured && <PrinterStatusCard printerId={printer.id} title={`Stato — ${printer.name}`} />}

      {/* Statistiche */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={Boxes} label="Le tue unità" value={`${stats.totalUnits}`} />
        <Stat icon={Weight} label="Peso in casa" value={`${(stats.totalWeightG / 1000).toFixed(1)} kg`} />
        <Stat icon={Palette} label="I tuoi colori" value={`${stats.distinctColors}`} />
        <Stat icon={Euro} label="Valore stimato" value={`€${stats.estimatedValue.toFixed(2)}`} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Suggerimenti di riacquisto */}
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <ShoppingCart className="h-4 w-4 text-amber-500" /> Da ricomprare
            </CardTitle>
            <Button size="sm" variant="ghost" nativeButton={false} render={<Link href="/inventario" />}>
              Inventario <ArrowRight className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            {repurchase.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                Sei a posto, nessuna scorta bassa. 👍
              </p>
            ) : (
              <ul className="space-y-2">
                {repurchase.map(({ row: r, url }) => (
                  <li key={`${r.brand}-${r.color_code}-${r.color_name}`} className="flex items-center gap-2 text-sm">
                    <span
                      className="h-5 w-5 shrink-0 rounded-full border border-black/15"
                      style={{ backgroundColor: r.color_hex ?? "#B0B4B8" }}
                    />
                    <span className="min-w-0 flex-1 truncate">
                      {r.color_name}{" "}
                      <span className="text-muted-foreground">· {typeLabel(r.material, r.variant)}</span>
                    </span>
                    <Badge variant="secondary">{r.quantity}</Badge>
                    {url && (
                      <Button
                        size="xs"
                        variant="outline"
                        nativeButton={false}
                        render={<a href={url} target="_blank" rel="noopener noreferrer" />}
                      >
                        Ricompra
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Consumo nel tempo */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4" /> I tuoi consumi (6 mesi)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {consumption.every((c) => c.units === 0) ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                Ancora nessuna bobina terminata. Quando ne finisci una, la vedrai qui.
              </p>
            ) : (
              <div className="flex h-36 items-end justify-between gap-2">
                {consumption.map((c) => (
                  <div key={c.month} className="flex flex-1 flex-col items-center gap-1">
                    <div className="flex w-full flex-1 items-end">
                      <div
                        className="w-full rounded-t bg-gradient-to-t from-violet-500 to-indigo-500"
                        style={{ height: `${(c.units / maxConsumption) * 100}%`, minHeight: c.units ? 4 : 0 }}
                        title={`${c.units} bobine`}
                      />
                    </div>
                    <span className="text-[10px] text-muted-foreground">{c.label}</span>
                    <span className="text-xs font-medium tabular-nums">{c.units}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Costi per materiale */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Euro className="h-4 w-4" /> Quanto vale, per materiale
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {valueByMaterial.length === 0 && (
              <p className="py-4 text-center text-sm text-muted-foreground">Inventario vuoto.</p>
            )}
            {valueByMaterial.map((m) => (
              <div key={m.material}>
                <div className="mb-1 flex justify-between text-sm">
                  <span className="font-medium">{m.material}</span>
                  <span className="text-muted-foreground">
                    €{m.value.toFixed(2)} · {m.units} unità
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-600"
                    style={{ width: `${(m.value / maxValue) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Palette multicolore AMS */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Layers className="h-4 w-4" /> Pronto per il multicolore
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {palette.map((p) => (
                <div
                  key={p.name}
                  title={`${p.name}${p.present ? "" : " — mancante"}`}
                  className={`flex items-center gap-1.5 rounded-full border px-2 py-1 text-xs ${
                    p.present ? "" : "opacity-40 grayscale"
                  }`}
                >
                  <span
                    className="h-4 w-4 rounded-full border border-black/15"
                    style={{ backgroundColor: p.hex }}
                  />
                  {p.name}
                </div>
              ))}
            </div>
            <p className="text-sm text-muted-foreground">
              Hai <strong className="text-foreground">{palette.length - missing.length}/{palette.length}</strong> colori base.{" "}
              {missing.length === 0
                ? "Palette completa: sei pronto per qualsiasi stampa multicolore! 🎨"
                : `Ti mancano: ${missing.map((m) => m.name).join(", ")}.`}
            </p>
          </CardContent>
        </Card>

        {/* Fatture recenti */}
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4" /> Le tue ultime fatture
            </CardTitle>
            <Button size="sm" variant="ghost" nativeButton={false} render={<Link href="/fatture" />}>
              Tutte <ArrowRight className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            {invoices.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">Nessuna fattura conservata.</p>
            ) : (
              <ul className="divide-y">
                {invoices.map((inv) => (
                  <li key={inv.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                    <a
                      href={`/api/invoices/file?id=${inv.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="truncate font-mono text-xs text-primary underline underline-offset-2"
                    >
                      {inv.order_number ?? inv.original_name ?? `#${inv.id}`}
                    </a>
                    <span className="shrink-0 text-muted-foreground">
                      {inv.invoice_date ?? inv.uploaded_at?.slice(0, 10)} · {inv.unit_count ?? "—"} unità
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Consumo storico */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <PackageX className="h-4 w-4" /> Bobine finite
            </CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div>
              <div className="text-3xl font-semibold tabular-nums">{stats.consumedUnits}</div>
              <div className="text-sm text-muted-foreground">in tutto il tuo storico</div>
            </div>
            <Button variant="ghost" nativeButton={false} render={<Link href="/esauriti" />}>
              Esauriti <ArrowRight className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Boxes;
  label: string;
  value: string;
}) {
  return (
    <Card>
      <CardContent className="px-4">
        <Icon className="mb-1 h-4 w-4 text-muted-foreground" />
        <div className="text-2xl font-semibold tabular-nums">{value}</div>
        <div className="text-xs text-muted-foreground">{label}</div>
      </CardContent>
    </Card>
  );
}
