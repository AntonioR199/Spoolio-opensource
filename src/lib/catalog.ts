// Gestione marchi/store ed esauriti (con link di riacquisto) su Supabase.

import { createClient, requireUserId } from "@/lib/supabase/server";
import { resolveColorHex } from "./colors";
import type { BrandWithStore, EmptyRow, Store } from "./types";
import type { GroupKey } from "./inventory";

/* ------------------------------- Store ------------------------------- */

export async function listStores(): Promise<Store[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("store").select("*").order("name");
  return (data ?? []) as Store[];
}

export async function upsertStore(s: {
  id?: number;
  name: string;
  url: string | null;
  search_url_template: string | null;
}): Promise<number> {
  const supabase = await createClient();
  if (s.id) {
    await supabase
      .from("store")
      .update({ name: s.name, url: s.url, search_url_template: s.search_url_template })
      .eq("id", s.id);
    return s.id;
  }
  const uid = await requireUserId();
  const { data, error } = await supabase
    .from("store")
    .upsert(
      { user_id: uid, name: s.name, url: s.url, search_url_template: s.search_url_template },
      { onConflict: "user_id,name" }
    )
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data!.id as number;
}

export async function deleteStore(id: number): Promise<void> {
  const supabase = await createClient();
  await supabase.from("store").delete().eq("id", id);
}

/* ------------------------------- Brand ------------------------------- */

/** Garantisce che un marchio esista (chiamata all'inserimento dei filamenti). */
export async function ensureBrand(name: string): Promise<void> {
  const supabase = await createClient();
  const uid = await requireUserId();
  await supabase
    .from("brand")
    .upsert({ user_id: uid, name }, { onConflict: "user_id,name", ignoreDuplicates: true });
}

interface BrandStoreNested {
  id: number;
  name: string;
  store_id: number | null;
  product_url_template: string | null;
  created_at: string;
  store: { name: string | null; url: string | null; search_url_template: string | null } | null;
}

export async function listBrandsWithStore(): Promise<BrandWithStore[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("brand")
    .select("id, name, store_id, product_url_template, created_at, store:store_id(name,url,search_url_template)")
    .order("name");
  return ((data ?? []) as unknown as BrandStoreNested[]).map((b) => ({
    id: b.id,
    name: b.name,
    store_id: b.store_id,
    product_url_template: b.product_url_template,
    created_at: b.created_at,
    store_name: b.store?.name ?? null,
    store_url: b.store?.url ?? null,
    store_search: b.store?.search_url_template ?? null,
  }));
}

export async function updateBrand(b: {
  name: string;
  store_id: number | null;
  product_url_template: string | null;
}): Promise<void> {
  const supabase = await createClient();
  const uid = await requireUserId();
  const { error } = await supabase
    .from("brand")
    .upsert(
      { user_id: uid, name: b.name, store_id: b.store_id, product_url_template: b.product_url_template },
      { onConflict: "user_id,name" }
    );
  if (error) throw new Error(error.message);
}

/* --------------------------- Link riacquisto --------------------------- */

interface RepurchaseCtx {
  brand: string;
  material: string;
  variant: string | null;
  color: string;
  sku: string | null;
}

function fillTemplate(tpl: string, ctx: RepurchaseCtx): string {
  const q = [ctx.brand, ctx.material, ctx.variant, ctx.color].filter(Boolean).join(" ");
  const enc = encodeURIComponent;
  return tpl
    .replace(/\{q\}/g, enc(q))
    .replace(/\{sku\}/g, enc(ctx.sku ?? ""))
    .replace(/\{color\}/g, enc(ctx.color))
    .replace(/\{material\}/g, enc(ctx.material))
    .replace(/\{brand\}/g, enc(ctx.brand))
    .replace(/\{variant\}/g, enc(ctx.variant ?? ""));
}

function resolveUrl(
  b: { product_url_template: string | null; store_url: string | null; store_search: string | null } | undefined,
  ctx: RepurchaseCtx
): string | null {
  if (!b) return null;
  if (b.product_url_template) return fillTemplate(b.product_url_template, ctx);
  if (b.store_search) return fillTemplate(b.store_search, ctx);
  return b.store_url ?? null;
}

/** Link di riacquisto di una singola voce (dashboard). */
export async function buildRepurchaseUrl(ctx: RepurchaseCtx): Promise<string | null> {
  const brands = await listBrandsWithStore();
  const b = brands.find((x) => x.name === ctx.brand);
  return resolveUrl(b, ctx);
}

/* ------------------------------- Esauriti ------------------------------- */

export async function getEmptyGroups(): Promise<EmptyRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("spool")
    .select("brand, material, variant, color_name, color_code, color_hex, sku")
    .eq("status", "empty");

  const brands = await listBrandsWithStore();
  const brandMap = new Map(brands.map((b) => [b.name, b]));

  const map = new Map<string, Omit<EmptyRow, "repurchase_url">>();
  for (const r of data ?? []) {
    const k = `${r.brand}|${r.material}|${r.variant ?? ""}|${r.color_name}|${r.color_code ?? ""}`;
    const cur = map.get(k);
    if (cur) {
      cur.quantity += 1;
      if (!cur.sku && r.sku) cur.sku = r.sku;
      if (!cur.color_hex && r.color_hex) cur.color_hex = r.color_hex;
    } else {
      map.set(k, {
        brand: r.brand,
        material: r.material,
        variant: r.variant,
        color_name: r.color_name,
        color_code: r.color_code,
        color_hex: r.color_hex,
        quantity: 1,
        sku: r.sku,
      });
    }
  }

  return [...map.values()]
    .map((r) => ({
      ...r,
      color_hex: r.color_hex ?? resolveColorHex(r.color_code, r.color_name),
      repurchase_url: resolveUrl(brandMap.get(r.brand), {
        brand: r.brand,
        material: r.material,
        variant: r.variant,
        color: r.color_name,
        sku: r.sku,
      }),
    }))
    .sort(
      (a, b) =>
        a.material.localeCompare(b.material) ||
        (a.variant ?? "").localeCompare(b.variant ?? "") ||
        a.color_name.localeCompare(b.color_name)
    );
}

/** Ripristina N unità esaurite (status: empty -> sealed). */
export async function restoreGroup(key: GroupKey, quantity: number): Promise<number> {
  const supabase = await createClient();
  /* eslint-disable @typescript-eslint/no-explicit-any */
  let q: any = supabase
    .from("spool")
    .select("id")
    .eq("brand", key.brand)
    .eq("material", key.material)
    .eq("color_name", key.color_name)
    .eq("status", "empty");
  q = key.variant === null ? q.is("variant", null) : q.eq("variant", key.variant);
  q = key.color_code === null ? q.is("color_code", null) : q.eq("color_code", key.color_code);
  /* eslint-enable @typescript-eslint/no-explicit-any */
  const { data: ids } = await q.order("id", { ascending: false }).limit(quantity);
  const idList = ((ids ?? []) as Array<{ id: number }>).map((r) => r.id);
  if (idList.length === 0) return 0;
  const { error } = await supabase
    .from("spool")
    .update({ status: "sealed", remaining_g: null, consumed_at: null })
    .in("id", idList);
  if (error) throw new Error(error.message);
  return idList.length;
}
