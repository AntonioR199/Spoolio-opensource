// Catalogo degli strumenti dell'assistente Spoolio.
// I tool di LETTURA vengono eseguiti lato server dentro il loop dell'agente
// (mappano sulle query esistenti). I tool di SCRITTURA NON vengono mai eseguiti
// dall'agente: produce una "proposta" che l'utente conferma a un click nella UI,
// la quale chiama le API già esistenti (/api/consume, /api/increment, /api/confirm).

import { getInventory, getStats, getValueByMaterial, getConsumptionByMonth } from "./inventory";
import { getEmptyGroups } from "./catalog";
import { getPaletteCoverage } from "./palette";
import { resolveColorHex } from "./colors";
import type { DraftItem } from "./types";

/* ------------------------------- Tipi ------------------------------- */

export type ToolMode = "read" | "write";

export interface ToolDef {
  name: string;
  description: string;
  /** JSON Schema dei parametri (compatibile sia con Anthropic sia con OpenAI). */
  parameters: Record<string, unknown>;
  mode: ToolMode;
}

/** Azione di scrittura proposta dall'assistente, eseguita dall'utente con un click. */
export interface ActionProposal {
  kind: "consume" | "increment" | "new";
  endpoint: string; // API esistente da chiamare alla conferma
  payload: unknown; // body JSON pronto per il POST
  summary: string; // frase di conferma in italiano (mostrata nella card)
}

/* ----------------------- Schemi parametri riusati ----------------------- */

// GroupKey: identifica una voce d'inventario (marca+tipo+variante+colore+codice).
const groupKeySchema = {
  type: "object",
  properties: {
    brand: { type: "string", description: "Marca, es. 'Bambu Lab'" },
    material: { type: "string", description: "Materiale, es. 'PLA', 'PETG'" },
    variant: { type: ["string", "null"], description: "Variante, es. 'Matte', 'Basic'; null se assente" },
    color_name: { type: "string", description: "Nome colore, es. 'Bianco'" },
    color_code: { type: ["string", "null"], description: "Codice colore Bambu a 5 cifre; null per altre marche" },
  },
  required: ["brand", "material", "variant", "color_name", "color_code"],
} as const;

/* ------------------------------ Catalogo ------------------------------ */

export const TOOLS: ToolDef[] = [
  // ---- LETTURA ----
  {
    name: "lista_inventario",
    mode: "read",
    description:
      "Elenca le voci di inventario attive (non esaurite) con marca, materiale, variante, " +
      "colore, codice colore, quantità e prezzo medio per unità (in €, null se non registrato). " +
      "Include le bobine in uso (in_use), l'ultima asciugatura (last_dried_at) e se la voce è da riasciugare (needs_drying). " +
      "Usalo per rispondere a domande sulle scorte e sul costo/prezzo di una voce, e per " +
      "individuare la voce esatta (GroupKey) prima di proporre un'azione. Filtro opzionale.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Filtro testuale opzionale su marca/materiale/variante/colore (case-insensitive).",
        },
      },
    },
  },
  {
    name: "statistiche",
    mode: "read",
    description:
      "Riepilogo del magazzino: unità totali, colori distinti, peso totale, valore stimato, " +
      "unità consumate e ripartizione per materiale.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "da_ricomprare",
    mode: "read",
    description: "Voci esaurite (terminate) con eventuale link di riacquisto. Utile per 'cosa devo ricomprare?'.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "consumi_mensili",
    mode: "read",
    description: "Numero di bobine terminate per mese negli ultimi N mesi (default 6).",
    parameters: {
      type: "object",
      properties: { mesi: { type: "integer", description: "Numero di mesi (1-24), default 6." } },
    },
  },
  {
    name: "valore_per_materiale",
    mode: "read",
    description: "Valore stimato (costo) e numero di unità per ciascun materiale.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "copertura_palette",
    mode: "read",
    description:
      "Copertura dei colori essenziali per le stampe multicolore/AMS: per ogni famiglia di " +
      "colore indica se hai almeno un filamento.",
    parameters: { type: "object", properties: {} },
  },

  // ---- SCRITTURA (proposte, mai eseguite dall'agente) ----
  {
    name: "scarica_bobina",
    mode: "write",
    description:
      "Propone lo scarico di N unità di una voce (bobina finita → esaurita). Risolvi prima la " +
      "voce esatta con 'lista_inventario'. L'utente confermerà l'azione.",
    parameters: {
      type: "object",
      properties: { key: groupKeySchema, quantity: { type: "integer", description: "Quante unità scaricare (>=1)." } },
      required: ["key", "quantity"],
    },
  },
  {
    name: "aggiungi_unita",
    mode: "write",
    description:
      "Propone l'incremento di N unità di una voce GIÀ presente in inventario (copia gli " +
      "attributi). Usa 'lista_inventario' per verificare che la voce esista. Se NON esiste, usa " +
      "invece 'nuovo_filamento'. L'utente confermerà l'azione.",
    parameters: {
      type: "object",
      properties: { key: groupKeySchema, quantity: { type: "integer", description: "Quante unità aggiungere (>=1)." } },
      required: ["key", "quantity"],
    },
  },
  {
    name: "nuovo_filamento",
    mode: "write",
    description:
      "Propone l'inserimento di un NUOVO filamento non ancora presente in inventario. " +
      "L'utente confermerà l'azione.",
    parameters: {
      type: "object",
      properties: {
        brand: { type: "string" },
        material: { type: "string", description: "es. 'PLA', 'PETG'" },
        variant: { type: ["string", "null"] },
        color_name: { type: "string" },
        color_code: { type: ["string", "null"], description: "Codice colore Bambu; null per altre marche" },
        format: { type: ["string", "null"], enum: ["spool", "refill", null], description: "'spool' (bobina) o 'refill' (ricarica)" },
        diameter_mm: { type: "number", description: "Diametro in mm, default 1.75" },
        nominal_weight_g: { type: "integer", description: "Peso nominale in grammi, default 1000" },
        unit_price: { type: ["number", "null"], description: "Prezzo per singola bobina, se noto" },
        quantity: { type: "integer", description: "Quante unità inserire (>=1)." },
      },
      required: ["brand", "material", "color_name", "quantity"],
    },
  },
];

/* --------------------------- Dispatcher LETTURA --------------------------- */

/** Esegue un tool di sola lettura e ritorna un risultato serializzabile in JSON. */
export async function executeReadTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    case "lista_inventario": {
      const rows = await getInventory();
      const q = typeof args.query === "string" ? args.query.trim().toLowerCase() : "";
      const filtered = q
        ? rows.filter((r) =>
            [r.brand, r.material, r.variant ?? "", r.color_name].join(" ").toLowerCase().includes(q)
          )
        : rows;
      // Restituisce la GroupKey completa per ogni voce, così l'agente può comporre le azioni.
      return filtered.map((r) => ({
        key: {
          brand: r.brand,
          material: r.material,
          variant: r.variant,
          color_name: r.color_name,
          color_code: r.color_code,
        },
        quantity: r.quantity,
        low_stock: r.low_stock,
        total_weight_g: r.total_weight_g,
        unit_price: r.unit_price, // prezzo medio per unità (€), null se non registrato
        in_use: r.in_use, // quante bobine sono in uso (aperte); le altre sono chiuse
        last_dried_at: r.last_dried_at, // asciugatura più recente tra le bobine in uso (ISO), null se nessuna
        needs_drying: r.needs_drying, // true se una bobina in uso ha superato la soglia di giorni
      }));
    }
    case "statistiche":
      return await getStats();
    case "da_ricomprare":
      return await getEmptyGroups();
    case "consumi_mensili": {
      const n = typeof args.mesi === "number" ? Math.min(24, Math.max(1, Math.floor(args.mesi))) : 6;
      return await getConsumptionByMonth(n);
    }
    case "valore_per_materiale":
      return await getValueByMaterial();
    case "copertura_palette": {
      const rows = await getInventory();
      return getPaletteCoverage(rows.map((r) => r.color_name));
    }
    default:
      throw new Error(`Tool di lettura sconosciuto: ${name}`);
  }
}

/* --------------------------- Costruttore PROPOSTE --------------------------- */

/* eslint-disable @typescript-eslint/no-explicit-any */
function asGroupKey(a: any) {
  return {
    brand: String(a?.brand ?? ""),
    material: String(a?.material ?? ""),
    variant: a?.variant ?? null,
    color_name: String(a?.color_name ?? ""),
    color_code: a?.color_code ?? null,
  };
}

function describeKey(k: { brand: string; material: string; variant: string | null; color_name: string }) {
  return [k.material, k.variant, k.color_name, `(${k.brand})`].filter(Boolean).join(" ");
}

/** Trasforma la chiamata di un tool di scrittura in una proposta confermabile. */
export function buildProposal(name: string, args: Record<string, unknown>): ActionProposal {
  const a = args as any;
  switch (name) {
    case "scarica_bobina": {
      const key = asGroupKey(a.key);
      const quantity = Math.max(1, Math.floor(Number(a.quantity ?? 1)));
      return {
        kind: "consume",
        endpoint: "/api/consume",
        payload: { key, quantity },
        summary: `Scarico ${quantity} unità di ${describeKey(key)} come esaurite.`,
      };
    }
    case "aggiungi_unita": {
      const key = asGroupKey(a.key);
      const quantity = Math.max(1, Math.floor(Number(a.quantity ?? 1)));
      return {
        kind: "increment",
        endpoint: "/api/increment",
        payload: { key, quantity },
        summary: `Aggiungo ${quantity} unità a ${describeKey(key)}.`,
      };
    }
    case "nuovo_filamento": {
      const quantity = Math.max(1, Math.floor(Number(a.quantity ?? 1)));
      const color_code = a.color_code ?? null;
      const color_name = String(a.color_name ?? "?");
      const item: DraftItem = {
        brand: String(a.brand ?? "Sconosciuto"),
        material: String(a.material ?? "Sconosciuto"),
        variant: a.variant ?? null,
        color_name,
        color_code,
        color_hex: resolveColorHex(color_code, color_name),
        format: a.format === "spool" || a.format === "refill" ? a.format : null,
        diameter_mm: typeof a.diameter_mm === "number" ? a.diameter_mm : 1.75,
        nominal_weight_g: typeof a.nominal_weight_g === "number" ? Math.floor(a.nominal_weight_g) : 1000,
        sku: null,
        unit_price: typeof a.unit_price === "number" ? a.unit_price : null,
        quantity,
        include: true,
      };
      return {
        kind: "new",
        endpoint: "/api/confirm",
        payload: { items: [item], source: "manual", purchase_date: null },
        summary: `Inserisco ${quantity} unità di ${item.material}${item.variant ? " " + item.variant : ""} ${item.color_name} (${item.brand}).`,
      };
    }
    default:
      throw new Error(`Tool di scrittura sconosciuto: ${name}`);
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export function toolMode(name: string): ToolMode | undefined {
  return TOOLS.find((t) => t.name === name)?.mode;
}
