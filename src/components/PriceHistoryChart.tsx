"use client";

import { useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Euro } from "lucide-react";

interface PricePoint {
  purchaseDate: string;
  material: string;
  brand: string;
  unitPrice: number;
}

interface Props {
  data: PricePoint[];
}

const COLORS = [
  "#10b981", // emerald-500
  "#8b5cf6", // violet-500
  "#f59e0b", // amber-500
  "#06b6d4", // cyan-500
  "#f97316", // orange-500
  "#ec4899", // pink-500
  "#6366f1", // indigo-500
  "#14b8a6", // teal-500
];

function formatDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  const months = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"];
  return `${months[d.getMonth()]} ${d.getFullYear()}`;
}

function formatPrice(n: number): string {
  return `€${n.toFixed(2)}`;
}

export function PriceHistoryChart({ data }: Props) {
  const [selectedMaterial, setSelectedMaterial] = useState<string>("all");

  const materials = useMemo(() => {
    const set = new Set(data.map((d) => d.material));
    return [...set].sort();
  }, [data]);

  const filtered = useMemo(() => {
    if (selectedMaterial === "all") return data;
    return data.filter((d) => d.material === selectedMaterial);
  }, [data, selectedMaterial]);

  const chartData = useMemo(() => {
    // Group by purchaseDate: each data point is a date entry with per-material unitPrice
    const byDate = new Map<string, Record<string, number>>();
    for (const d of filtered) {
      const dateObj = byDate.get(d.purchaseDate) ?? {};
      dateObj[d.material] = d.unitPrice;
      byDate.set(d.purchaseDate, dateObj);
    }
    const sorted = [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b));
    return sorted.map(([date, materialsMap]) => ({
      date: formatDate(date),
      rawDate: date,
      ...materialsMap,
    }));
  }, [filtered]);

  const visibleMaterials = useMemo(() => {
    if (selectedMaterial !== "all") return [selectedMaterial];
    return materials;
  }, [materials, selectedMaterial]);

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Euro className="h-4 w-4 text-emerald-500" /> Evoluzione prezzi
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="py-4 text-center text-sm text-muted-foreground">
            Ancora nessun prezzo registrato. I prezzi compaiono quando carichi fatture con costo.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Euro className="h-4 w-4 text-emerald-500" /> Evoluzione prezzi
        </CardTitle>
        {materials.length > 1 && (
          <select
            value={selectedMaterial}
            onChange={(e) => setSelectedMaterial(e.target.value)}
            className="h-8 rounded-md border border-input bg-background px-2 text-xs ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="all">Tutti i materiali</option>
            {materials.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        )}
      </CardHeader>
      <CardContent>
        <p className="mb-3 text-xs text-muted-foreground">
          Prezzo per bobina nel tempo
        </p>
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 4, right: 8, left: -8, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted/50" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10 }}
                className="text-muted-foreground"
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 10 }}
                tickFormatter={(v: number) => `€${v.toFixed(0)}`}
                className="text-muted-foreground"
                width={48}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  return (
                    <div className="rounded-lg border bg-background p-2 text-xs shadow-md">
                      <div className="mb-1 font-medium">{label}</div>
                      {payload.map((entry) => (
                        <div key={entry.name} className="flex items-center gap-2">
                          <span
                            className="h-2.5 w-2.5 shrink-0 rounded-full"
                            style={{ backgroundColor: entry.color }}
                          />
                          <span>{entry.name}:</span>
                          <span className="font-medium tabular-nums">
                            {formatPrice(entry.value as number)}
                          </span>
                        </div>
                      ))}
                    </div>
                  );
                }}
              />
              <Legend
                wrapperStyle={{ fontSize: "11px", paddingTop: "4px" }}
                iconType="circle"
                iconSize={8}
              />
              {visibleMaterials.map((material, i) => (
                <Line
                  key={material}
                  type="monotone"
                  dataKey={material}
                  name={material}
                  stroke={COLORS[i % COLORS.length]}
                  strokeWidth={2}
                  dot={{ r: 3, strokeWidth: 1 }}
                  activeDot={{ r: 5, strokeWidth: 1 }}
                  connectNulls={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
