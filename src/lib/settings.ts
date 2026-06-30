// Impostazioni applicazione, per-utente, nella tabella `setting` (chiave/valore).

import { createClient, requireUserId } from "@/lib/supabase/server";

export interface AppSettings {
  lowStockThreshold: number;
  dryIntervalDays: number;
  defaultBrand: string;
  defaultDiameterMm: number;
  defaultWeightG: number;
  defaultPrinterId: number | null;
  aiProvider: string;
  aiModel: string;
  aiBaseUrl: string;
}

export const DEFAULT_SETTINGS: AppSettings = {
  lowStockThreshold: 1,
  dryIntervalDays: 30,
  defaultBrand: "Bambu Lab",
  defaultDiameterMm: 1.75,
  defaultWeightG: 1000,
  defaultPrinterId: null,
  aiProvider: "claude",
  aiModel: "",
  aiBaseUrl: "",
};

export async function getSettings(): Promise<AppSettings> {
  const supabase = await createClient();
  const { data } = await supabase.from("setting").select("key, value");
  const map = new Map((data ?? []).map((r) => [r.key as string, r.value as string]));
  const num = (k: string, d: number) => {
    const v = map.get(k);
    const n = v != null ? Number(v) : NaN;
    return Number.isFinite(n) ? n : d;
  };
  const printerRaw = map.get("defaultPrinterId");
  const printerId = printerRaw ? Number(printerRaw) : NaN;
  return {
    lowStockThreshold: num("lowStockThreshold", DEFAULT_SETTINGS.lowStockThreshold),
    dryIntervalDays: num("dryIntervalDays", DEFAULT_SETTINGS.dryIntervalDays),
    defaultBrand: map.get("defaultBrand") ?? DEFAULT_SETTINGS.defaultBrand,
    defaultDiameterMm: num("defaultDiameterMm", DEFAULT_SETTINGS.defaultDiameterMm),
    defaultWeightG: num("defaultWeightG", DEFAULT_SETTINGS.defaultWeightG),
    defaultPrinterId: Number.isFinite(printerId) && printerId > 0 ? printerId : null,
    aiProvider: map.get("aiProvider") ?? DEFAULT_SETTINGS.aiProvider,
    aiModel: map.get("aiModel") ?? DEFAULT_SETTINGS.aiModel,
    aiBaseUrl: map.get("aiBaseUrl") ?? DEFAULT_SETTINGS.aiBaseUrl,
  };
}

export async function updateSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
  const supabase = await createClient();
  const uid = await requireUserId();
  const rows = Object.entries(patch).map(([key, v]) => ({
    user_id: uid,
    key,
    value: v == null ? "" : String(v),
  }));
  if (rows.length) {
    const { error } = await supabase.from("setting").upsert(rows, { onConflict: "user_id,key" });
    if (error) throw new Error(error.message);
  }
  return getSettings();
}

export async function getLowStockThreshold(): Promise<number> {
  return (await getSettings()).lowStockThreshold;
}

/** Giorni dopo i quali un filamento asciugato è considerato "da asciugare". */
export async function getDryIntervalDays(): Promise<number> {
  return (await getSettings()).dryIntervalDays;
}

/** Chiave API AI (per-utente; fallback su ANTHROPIC_API_KEY d'ambiente). */
export async function getAiApiKey(): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("setting").select("value").eq("key", "aiApiKey").maybeSingle();
  return (data?.value as string) || process.env.ANTHROPIC_API_KEY || null;
}

export async function setAiApiKey(key: string | null): Promise<void> {
  const supabase = await createClient();
  const uid = await requireUserId();
  const { error } = await supabase
    .from("setting")
    .upsert({ user_id: uid, key: "aiApiKey", value: key ?? "" }, { onConflict: "user_id,key" });
  if (error) throw new Error(error.message);
}
