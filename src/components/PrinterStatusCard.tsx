"use client";

import { useEffect, useRef, useState } from "react";
import { Thermometer, Layers, Clock, AlertTriangle, Loader2, WifiOff } from "lucide-react";
import type { PrinterStatus, PrintState } from "@/lib/printer-monitor/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useBrowserNotifications } from "@/lib/useBrowserNotifications";

const POLL_MS = 10_000;

const STATE_LABEL: Record<PrintState, string> = {
  IDLE: "Inattiva",
  PREPARE: "Preparazione",
  RUNNING: "In stampa",
  PAUSE: "In pausa",
  FINISH: "Completata",
  FAILED: "Errore",
  OFFLINE: "Offline",
};

function stateBadgeClass(state: PrintState): string {
  switch (state) {
    case "RUNNING":
      return "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400";
    case "PAUSE":
      return "bg-amber-500/15 text-amber-600 dark:text-amber-400";
    case "FINISH":
      return "bg-sky-500/15 text-sky-600 dark:text-sky-400";
    case "FAILED":
      return "bg-red-500/15 text-red-600 dark:text-red-400";
    case "OFFLINE":
      return "bg-muted text-muted-foreground";
    default:
      return "bg-violet-500/15 text-violet-600 dark:text-violet-400";
  }
}

function formatRemaining(sec: number): string {
  if (!sec || sec <= 0) return "—";
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function PrinterStatusCard({ printerId, title }: { printerId: number; title?: string }) {
  const [status, setStatus] = useState<PrinterStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const { notify } = useBrowserNotifications();
  const prevStateRef = useRef<PrintState | null>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const r = await fetch(`/api/printers/${printerId}/status`);
        const data = await r.json();
        if (alive && data.status) setStatus(data.status as PrinterStatus);
      } catch {
        /* rete: riproviamo al prossimo giro */
      } finally {
        if (alive) setLoading(false);
      }
    };
    load();
    const t = setInterval(load, POLL_MS);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [printerId]);

  // Notifiche browser su transizioni di stato
  useEffect(() => {
    if (!status) return;
    const prev = prevStateRef.current;
    prevStateRef.current = status.state;
    if (prev === "RUNNING" && status.state === "FINISH") {
      notify("Stampa completata", {
        body: status.job?.fileName
          ? `La stampa di ${status.job.fileName} è terminata.`
          : "La stampa è terminata.",
      });
    } else if (prev === "RUNNING" && status.state === "FAILED") {
      notify("Stampa fallita", {
        body: status.job?.fileName
          ? `Errore durante la stampa di ${status.job.fileName}.`
          : "La stampa ha riportato un errore.",
      });
    }
  }, [status, notify]);

  if (loading && !status) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Lettura stato stampante…
        </CardContent>
      </Card>
    );
  }
  if (!status) return null;

  const offline = !status.online;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2 pb-3">
        <CardTitle className="text-sm">{title ?? "Stato stampante"}</CardTitle>
        <Badge className={`gap-1 ${stateBadgeClass(status.state)}`} variant="secondary">
          {offline ? <WifiOff className="h-3 w-3" /> : <span className="h-2 w-2 rounded-full bg-current" />}
          {STATE_LABEL[status.state]}
        </Badge>
      </CardHeader>

      {!offline && (
        <CardContent className="space-y-4">
          {/* Temperature */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <TempStat label="Ugello" value={status.temps.nozzle} target={status.temps.nozzleTarget} />
            <TempStat label="Piatto" value={status.temps.bed} target={status.temps.bedTarget} />
            {status.temps.chamber != null && (
              <TempStat label="Camera" value={status.temps.chamber} />
            )}
          </div>

          {/* Avanzamento stampa */}
          {status.job && (status.state === "RUNNING" || status.state === "PAUSE") && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Layers className="h-3.5 w-3.5" /> Layer {status.job.layer}/{status.job.totalLayers}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" /> {formatRemaining(status.job.remainingSec)}
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-violet-500 to-indigo-600 transition-all"
                  style={{ width: `${Math.min(100, Math.max(0, status.job.progressPct))}%` }}
                />
              </div>
              <div className="text-right text-xs font-medium">{status.job.progressPct}%</div>
              {status.job.fileName && (
                <div className="truncate text-xs text-muted-foreground">{status.job.fileName}</div>
              )}
            </div>
          )}

          {/* AMS */}
          {status.ams.map((unit) => (
            <div key={unit.id} className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>AMS {Number(unit.id) + 1}</span>
                {unit.humidity != null && <span>Umidità {unit.humidity}/5</span>}
              </div>
              <div className="flex flex-wrap gap-2">
                {unit.trays.map((tray) => (
                  <div
                    key={tray.index}
                    className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs ${
                      tray.active ? "border-primary ring-1 ring-primary/40" : "border-border"
                    }`}
                    title={tray.active ? "In uso" : undefined}
                  >
                    <span
                      className="h-3.5 w-3.5 shrink-0 rounded-full border border-black/10"
                      style={{ backgroundColor: tray.colorHex ?? "#B0B4B8" }}
                    />
                    <span>{tray.type ?? "vuoto"}</span>
                    {tray.remainPct != null && (
                      <span className="text-muted-foreground">{tray.remainPct}%</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Bobina esterna */}
          {status.externalSpool && (
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-muted-foreground">Esterna:</span>
              <span
                className="h-3.5 w-3.5 rounded-full border border-black/10"
                style={{ backgroundColor: status.externalSpool.colorHex ?? "#B0B4B8" }}
              />
              <span>{status.externalSpool.type ?? "—"}</span>
            </div>
          )}

          {/* Errori */}
          {status.errors.length > 0 && (
            <div className="flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-400">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{status.errors.length} avviso/i attivo/i sulla stampante</span>
            </div>
          )}
        </CardContent>
      )}

      {offline && (
        <CardContent className="text-sm text-muted-foreground">
          Stampante non raggiungibile. Verifica che sia accesa, sulla stessa rete e in modalità LAN.
        </CardContent>
      )}
    </Card>
  );
}

function TempStat({ label, value, target }: { label: string; value: number; target?: number }) {
  return (
    <div className="rounded-lg border bg-muted/30 px-2.5 py-1.5">
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <Thermometer className="h-3 w-3" /> {label}
      </div>
      <div className="text-sm font-semibold">
        {Math.round(value)}°
        {target != null && target > 0 && (
          <span className="text-xs font-normal text-muted-foreground"> / {Math.round(target)}°</span>
        )}
      </div>
    </div>
  );
}
