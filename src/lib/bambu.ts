// Parser deterministico per i prodotti Bambu Lab.
// Lo SKU Bambu è una chiave stabile: materiale-colore-diametro-peso-formato.
// Esempio: "A01-K1-1.75-1000-SPLFREE" oppure "S02-W1-1.75-500-SPL".

import type { SpoolFormat } from "./types";

/** Mappa prefisso codice materiale -> {material, variant}. Fallback se manca il nome. */
const MATERIAL_CODE: Record<string, { material: string; variant: string | null }> = {
  A00: { material: "PLA", variant: "Basic" },
  A01: { material: "PLA", variant: "Matte" },
  A06: { material: "PLA", variant: "Silk+" },
  A17: { material: "PLA", variant: "Translucent" },
  A19: { material: "PLA", variant: "Pure" },
  G00: { material: "PETG", variant: "Basic" },
  S02: { material: "Support", variant: null },
};

const POLYMERS = ["PLA", "PETG", "PET", "ABS", "ASA", "TPU", "PA", "PC", "PVA", "PPS"];

export interface ParsedSku {
  materialCode: string;
  diameter_mm: number;
  nominal_weight_g: number;
  format: SpoolFormat;
}

/** Estrae diametro, peso e formato dallo SKU Bambu. null se non riconosciuto. */
export function parseSku(rawSku: string): ParsedSku | null {
  const sku = rawSku.replace(/\s+/g, "").toUpperCase();
  // <mat>-<col>-<diam>-<weight>-SPL|SPLFREE
  const m = sku.match(/^([A-Z]\d{2})-[A-Z0-9]+-(\d+(?:\.\d+)?)-(\d+)-(SPLFREE|SPL)$/);
  if (!m) return null;
  return {
    materialCode: m[1],
    diameter_mm: parseFloat(m[2]),
    nominal_weight_g: parseInt(m[3], 10),
    format: m[4] === "SPLFREE" ? "refill" : "spool",
  };
}

/** True se lo SKU è un filamento (e non un accessorio tipo FAP/FAZ/FAW). */
export function isFilamentSku(rawSku: string): boolean {
  return parseSku(rawSku) !== null;
}

/** Ricava {material, variant} dal nome prodotto della fattura, con fallback sul codice. */
export function deriveMaterial(
  productName: string,
  materialCode?: string
): { material: string; variant: string | null } {
  // Il codice SKU Bambu è la fonte autorevole: usalo per primo se noto.
  if (materialCode && MATERIAL_CODE[materialCode]) return MATERIAL_CODE[materialCode];

  const name = productName.replace(/\(.*?\)/g, "").trim(); // toglie "(New Version)" ecc.

  // Caso supporto: "Support for PLA"
  if (/^support/i.test(name)) return { material: "Support", variant: null };

  const tokens = name.split(/\s+/);
  const first = tokens[0]?.toUpperCase();
  if (first && POLYMERS.includes(first)) {
    const variant = tokens.slice(1).join(" ").trim();
    return { material: first, variant: variant || null };
  }

  return { material: name || "Sconosciuto", variant: null };
}

/** Estrae nome colore e codice numerico dal testo "Variant" della fattura. */
export function parseColorFromVariant(variantText: string): {
  color_name: string;
  color_code: string | null;
} {
  // es. "Carbone (11101) / Ricarica" -> name "Carbone", code "11101"
  const codeMatch = variantText.match(/\((\d{4,6})\)/);
  const color_code = codeMatch ? codeMatch[1] : null;
  // nome = testo prima della prima parentesi / o slash
  let name = variantText.split(/[(/]/)[0].trim();
  if (!name) name = variantText.trim();
  return { color_name: name, color_code };
}
