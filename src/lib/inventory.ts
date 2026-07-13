// Repository inventario su Supabase (per-utente via RLS). Le aggregazioni sono
// fatte lato server in JS sui dati dell'utente (scala personale: poche centinaia).

import { createClient } from "@/lib/supabase/server";
import { resolveColorHex } from "./colors";
import { ensureBrand } from "./catalog";
import { getLowStockThreshold, getDryIntervalDays } from "./settings";
import type { DraftItem, InventoryRow, Spool } from "./types";

export interface GroupKey {
  brand: string;
  material: string;
  variant: string | null;
  color_name: string;
  color_code: string | null;
}

// Applica i filtri di gruppo gestendo i NULL (variant/color_code).
/* eslint-disable @typescript-eslint/no-explicit-any */
function filterGroup<T>(q: T, key: GroupKey): T {
  let qq: any = (q as any)
    .eq("brand", key.brand)
    .eq("material", key.material)
    .eq("color_name", key.color_name);
  qq = key.variant === null ? qq.is("variant", null) : qq.eq("variant", key.variant);
  qq = key.color_code === null ? qq.is("color_code", null) : qq.eq("color_code", key.color_code);
  return qq as T;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

function groupKeyStr(r: { brand: string; material: string; variant: string | null; color_name: string; color_code: string | null }) {
  return `${r.brand}|${r.material}|${r.variant ?? ""}|${r.color_name}|${r.color_code ?? ""}`;
}

/** Inventario aggregato per marca+tipo+colore (esclude le unità esaurite). */
export async function getInventory(): Promise<InventoryRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("spool")
    .select("brand, material, variant, color_name, color_code, color_hex, nominal_weight_g, unit_price, status, opened_at, last_dried_at")
    .neq("status", "empty");

  const threshold = await getLowStockThreshold();
  const dryIntervalDays = await getDryIntervalDays();
  // Una bobina in uso è "da asciugare" se la sua asciugatura — o, se mai asciugata,
  // la sua apertura — è anteriore a questo istante. Le bobine chiuse non contano.
  const dryCutoff = new Date(Date.now() - dryIntervalDays * 86_400_000).toISOString();

  // Accumula somma e conteggio dei prezzi noti per calcolare la media di gruppo.
  type Acc = InventoryRow & { priceSum: number; pricedCount: number };
  const map = new Map<string, Acc>();
  for (const r of data ?? []) {
    const k = groupKeyStr(r);
    const priced = r.unit_price != null ? Number(r.unit_price) : null;
    const inUse = r.status === "open";
    // Per le bobine in uso: àncora = ultima asciugatura, altrimenti l'apertura.
    const anchor = inUse ? r.last_dried_at ?? r.opened_at : null;
    const overdue = inUse && (anchor == null || anchor < dryCutoff);
    const cur = map.get(k);
    if (cur) {
      cur.quantity += 1;
      cur.total_weight_g += r.nominal_weight_g ?? 0;
      if (!cur.color_hex && r.color_hex) cur.color_hex = r.color_hex;
      if (priced != null) {
        cur.priceSum += priced;
        cur.pricedCount += 1;
      }
      if (inUse) cur.in_use += 1;
      if (overdue) cur.needs_drying = true;
      // Asciugatura più recente tra le bobine in uso.
      if (inUse && r.last_dried_at && (!cur.last_dried_at || r.last_dried_at > cur.last_dried_at)) {
        cur.last_dried_at = r.last_dried_at;
      }
    } else {
      map.set(k, {
        brand: r.brand,
        material: r.material,
        variant: r.variant,
        color_name: r.color_name,
        color_code: r.color_code,
        color_hex: r.color_hex,
        quantity: 1,
        total_weight_g: r.nominal_weight_g ?? 0,
        unit_price: null,
        low_stock: false,
        in_use: inUse ? 1 : 0,
        last_dried_at: inUse ? r.last_dried_at ?? null : null,
        needs_drying: overdue,
        priceSum: priced ?? 0,
        pricedCount: priced != null ? 1 : 0,
      });
    }
  }

  return [...map.values()]
    .map(({ priceSum, pricedCount, ...r }) => ({
      ...r,
      color_hex: r.color_hex ?? resolveColorHex(r.color_code, r.color_name),
      unit_price: pricedCount > 0 ? Math.round((priceSum / pricedCount) * 100) / 100 : null,
      low_stock: r.quantity <= threshold,
    }))
    .sort(
      (a, b) =>
        a.material.localeCompare(b.material) ||
        (a.variant ?? "").localeCompare(b.variant ?? "") ||
        a.color_name.localeCompare(b.color_name)
    );
}

export interface InventoryStats {
  totalUnits: number;
  distinctColors: number;
  byMaterial: Array<{ material: string; units: number; colors: number }>;
  brands: string[];
  totalWeightG: number;
  estimatedValue: number;
  consumedUnits: number;
}

export async function getStats(): Promise<InventoryStats> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("spool")
    .select("brand, material, variant, color_name, color_code, nominal_weight_g, unit_price")
    .neq("status", "empty");
  const rows = data ?? [];

  const colorKey = (r: { material: string; variant: string | null; color_name: string; color_code: string | null }) =>
    `${r.material}|${r.variant ?? ""}|${r.color_name}|${r.color_code ?? ""}`;

  const distinctColors = new Set(rows.map(colorKey)).size;
  const brands = [...new Set(rows.map((r) => r.brand))].sort();
  const totalWeightG = rows.reduce((s, r) => s + (r.nominal_weight_g ?? 0), 0);
  const estimatedValue = rows.reduce((s, r) => s + (r.unit_price != null ? Number(r.unit_price) : 0), 0);

  const matMap = new Map<string, { units: number; colors: Set<string> }>();
  for (const r of rows) {
    const m = matMap.get(r.material) ?? { units: 0, colors: new Set<string>() };
    m.units += 1;
    m.colors.add(`${r.color_code ?? ""}|${r.color_name}`);
    matMap.set(r.material, m);
  }
  const byMaterial = [...matMap.entries()]
    .map(([material, v]) => ({ material, units: v.units, colors: v.colors.size }))
    .sort((a, b) => b.units - a.units);

  const { count: consumedUnits } = await supabase
    .from("spool")
    .select("id", { count: "exact", head: true })
    .eq("status", "empty");

  return {
    totalUnits: rows.length,
    distinctColors,
    byMaterial,
    brands,
    totalWeightG,
    estimatedValue,
    consumedUnits: consumedUnits ?? 0,
  };
}

/** Valore stimato (costo netto) e unità per materiale — per la dashboard. */
export async function getValueByMaterial(): Promise<Array<{ material: string; value: number; units: number }>> {
  const supabase = await createClient();
  const { data } = await supabase.from("spool").select("material, unit_price").neq("status", "empty");
  const map = new Map<string, { value: number; units: number }>();
  for (const r of data ?? []) {
    const m = map.get(r.material) ?? { value: 0, units: 0 };
    m.units += 1;
    m.value += r.unit_price != null ? Number(r.unit_price) : 0;
    map.set(r.material, m);
  }
  return [...map.entries()]
    .map(([material, v]) => ({ material, value: v.value, units: v.units }))
    .sort((a, b) => b.value - a.value || b.units - a.units);
}

/** Bobine terminate per mese negli ultimi `n` mesi (incluso il mese corrente). */
export async function getConsumptionByMonth(n = 6): Promise<Array<{ month: string; label: string; units: number }>> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("spool")
    .select("consumed_at")
    .eq("status", "empty")
    .not("consumed_at", "is", null);

  const byMonth = new Map<string, number>();
  for (const r of data ?? []) {
    const key = String(r.consumed_at).slice(0, 7); // YYYY-MM
    byMonth.set(key, (byMonth.get(key) ?? 0) + 1);
  }

  const MESI = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"];
  const out: Array<{ month: string; label: string; units: number }> = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    out.push({ month: key, label: MESI[d.getMonth()], units: byMonth.get(key) ?? 0 });
  }
  return out;
}

/** Storico consumi: bobine finite (status='empty') con data consumo, per esportazione CSV. */
export interface ConsumptionRow {
  brand: string;
  material: string;
  variant: string | null;
  color_name: string;
  color_code: string | null;
  sku: string | null;
  nominal_weight_g: number | null;
  unit_price: number | null;
  consumed_at: string | null;
}

export async function getConsumptionHistory(): Promise<ConsumptionRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("spool")
    .select("brand, material, variant, color_name, color_code, sku, nominal_weight_g, unit_price, consumed_at")
    .eq("status", "empty")
    .not("consumed_at", "is", null)
    .order("consumed_at", { ascending: false });
  return (data ?? []) as ConsumptionRow[];
}

/** Inserisce le voci confermate, espandendo la quantità in righe singole. */
export async function insertSpools(items: DraftItem[], source: string, purchaseDate: string | null): Promise<number> {
  const supabase = await createClient();
  const brands = new Set<string>();
  const rows: Record<string, unknown>[] = [];
  for (const it of items) {
    if (!it.include) continue;
    brands.add(it.brand);
    const qty = Math.max(0, Math.floor(it.quantity));
    for (let i = 0; i < qty; i++) {
      rows.push({
        brand: it.brand,
        material: it.material,
        variant: it.variant,
        color_name: it.color_name,
        color_code: it.color_code,
        color_hex: it.color_hex ?? resolveColorHex(it.color_code, it.color_name),
        format: it.format,
        diameter_mm: it.diameter_mm,
        nominal_weight_g: it.nominal_weight_g,
        sku: it.sku,
        source,
        purchase_date: purchaseDate,
        unit_price: it.unit_price,
        status: "sealed",
      });
    }
  }
  for (const b of brands) await ensureBrand(b);
  if (rows.length) {
    const { error } = await supabase.from("spool").insert(rows);
    if (error) throw new Error(error.message);
  }
  return rows.length;
}

export async function countSpools(): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase.from("spool").select("id", { count: "exact", head: true });
  return count ?? 0;
}

export async function listSpools(): Promise<Spool[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("spool").select("*").order("id");
  return (data ?? []) as Spool[];
}

/** Incrementa una voce esistente copiando gli attributi da un'unità rappresentativa. */
export async function incrementGroup(key: GroupKey, quantity: number): Promise<number> {
  const supabase = await createClient();
  const { data: rep } = await filterGroup(supabase.from("spool").select("*"), key).limit(1).maybeSingle();
  if (!rep) return 0;
  const item: DraftItem = {
    brand: rep.brand,
    material: rep.material,
    variant: rep.variant,
    color_name: rep.color_name,
    color_code: rep.color_code,
    color_hex: rep.color_hex,
    format: rep.format,
    diameter_mm: rep.diameter_mm,
    nominal_weight_g: rep.nominal_weight_g,
    sku: rep.sku,
    unit_price: rep.unit_price != null ? Number(rep.unit_price) : null,
    quantity,
    include: true,
  };
  return insertSpools([item], "manual", null);
}

/** Imposta il prezzo unitario su tutte le unità attive di una voce. */
export async function setGroupPrice(key: GroupKey, unitPrice: number | null): Promise<number> {
  const supabase = await createClient();
  const { data } = await filterGroup(supabase.from("spool").update({ unit_price: unitPrice }), key)
    .neq("status", "empty")
    .select("id");
  return data?.length ?? 0;
}

/** Marca le unità in uso (status='open') di una voce come asciugate ora. */
export async function setGroupDried(key: GroupKey): Promise<number> {
  const supabase = await createClient();
  const { data } = await filterGroup(
    supabase.from("spool").update({ last_dried_at: new Date().toISOString() }),
    key
  )
    .eq("status", "open")
    .select("id");
  return data?.length ?? 0;
}

/** Mette in uso una bobina chiusa della voce: status 'sealed' -> 'open', avvia il countdown. */
export async function openSpool(key: GroupKey): Promise<number> {
  const supabase = await createClient();
  const { data: rep } = await filterGroup(supabase.from("spool").select("id"), key)
    .eq("status", "sealed")
    .order("id")
    .limit(1)
    .maybeSingle();
  if (!rep) return 0;
  const { error } = await supabase
    .from("spool")
    .update({ status: "open", opened_at: new Date().toISOString(), last_dried_at: null })
    .eq("id", rep.id);
  if (error) throw new Error(error.message);
  return 1;
}

/** Rimette tra le chiuse una bobina in uso: status 'open' -> 'sealed', azzera il countdown. */
export async function closeSpool(key: GroupKey): Promise<number> {
  const supabase = await createClient();
  const { data: rep } = await filterGroup(supabase.from("spool").select("id"), key)
    .eq("status", "open")
    .order("id")
    .limit(1)
    .maybeSingle();
  if (!rep) return 0;
  const { error } = await supabase
    .from("spool")
    .update({ status: "sealed", opened_at: null, last_dried_at: null })
    .eq("id", rep.id);
  if (error) throw new Error(error.message);
  return 1;
}

/** Restituisce le unità attive (non esaurite) di una voce, per la modale dettagli. */
export async function getGroupDetail(key: GroupKey): Promise<Spool[]> {
  const supabase = await createClient();
  const { data } = await filterGroup(supabase.from("spool").select("*"), key)
    .neq("status", "empty")
    .order("id");
  return (data ?? []) as Spool[];
}

/** Segna N unità di una voce come esaurite (status='empty'). Mantiene lo storico. */
export async function consumeGroup(key: GroupKey, quantity: number): Promise<number> {
  const supabase = await createClient();
  // Scarica prima le bobine in uso ('open' < 'sealed'), così "finita" termina quella aperta.
  const { data: ids } = await filterGroup(supabase.from("spool").select("id"), key)
    .neq("status", "empty")
    .order("status", { ascending: true })
    .order("id")
    .limit(quantity);
  const idList = (ids ?? []).map((r) => r.id);
  if (idList.length === 0) return 0;
  const { error } = await supabase
    .from("spool")
    .update({ status: "empty", remaining_g: 0, consumed_at: new Date().toISOString() })
    .in("id", idList);
  if (error) throw new Error(error.message);
  return idList.length;
}
