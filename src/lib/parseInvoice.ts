// Estrazione voci filamento da una fattura PDF.
// 1) Parser deterministico per fatture Bambu Lab (zero costi).
// 2) Fallback su Claude per venditori/formati diversi.

import { getDocumentProxy, extractText } from "unpdf";
import { resolveColorHex } from "./colors";
import {
  parseSku,
  deriveMaterial,
  parseColorFromVariant,
} from "./bambu";
import { extractFilamentsWithAI } from "./ai";
import type { DraftItem, ParseResult } from "./types";

/** Estrae il testo grezzo dal PDF (unpdf -> stringa unica). */
export async function pdfToText(buffer: Buffer): Promise<string> {
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { text } = await extractText(pdf, { mergePages: true });
  return Array.isArray(text) ? text.join("\n") : text;
}

function findOrderNumber(text: string): string | null {
  return text.match(/Order Number:\s*(\S+)/i)?.[1] ?? null;
}
function findInvoiceDate(text: string): string | null {
  return text.match(/Invoice Date:\s*(\d{4}-\d{2}-\d{2})/i)?.[1] ?? null;
}

/** Parser deterministico Bambu. Tiene solo gli SKU filamento (scarta accessori). */
export function parseBambu(text: string): { items: DraftItem[]; warnings: string[] } {
  const items: DraftItem[] = [];
  const warnings: string[] = [];

  // <nome> SKU: <sku> Variant: <variante> <qty> €<price> [€sconto] IVA €tax €subtotale
  const re =
    /([^€\n]+?)\s*SKU:\s*([A-Z0-9.\- ]+?)\s*Variant:\s*([\s\S]+?)\s+(\d+)\s*€([\d.,]+)/gi;

  // Raccoglie i match con le posizioni, per poter leggere il subtotale di riga
  // (ultimo € della riga importi) e ricavare il costo NETTO per unità.
  const raw: Array<{ groups: RegExpExecArray; end: number }> = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) raw.push({ groups: m, end: re.lastIndex });

  for (let i = 0; i < raw.length; i++) {
    const [, rawName, rawSku, variantText, qtyStr, priceStr] = raw[i].groups;
    const sku = rawSku.replace(/\s+/g, "");
    const parsed = parseSku(sku);
    if (!parsed) continue; // non è un filamento (es. piatti FAP, olio FAZ)

    const { material, variant } = deriveMaterial(rawName.trim(), parsed.materialCode);
    const { color_name, color_code } = parseColorFromVariant(variantText);
    const qty = parseInt(qtyStr, 10);

    // Importi di riga: dal primo prezzo fino al prossimo "SKU:" (così il
    // subtotale resta nello span; il nome del prossimo articolo può contenere
    // cifre e "ruberebbe" il numero del subtotale). L'ultimo € è il subtotale
    // (netto sconti, IVA inclusa). Si esclude la sezione totali finale.
    const nextSku = text.indexOf("SKU:", raw[i].end);
    let span = text.slice(raw[i].end, nextSku >= 0 ? nextSku : text.length);
    const cut = span.search(/Items Subtotal|Thank you for|Grand total/i);
    if (cut >= 0) span = span.slice(0, cut);
    const tailNums = [...span.matchAll(/€\s*([\d.,]+)/g)].map((x) => parseFloat(x[1].replace(",", ".")));
    const firstPrice = parseFloat(priceStr.replace(",", ".")) || 0;
    const amounts = [firstPrice, ...tailNums].filter((n) => Number.isFinite(n));
    const subtotal = amounts.length ? amounts[amounts.length - 1] : firstPrice;
    const unitNet = qty > 0 ? Math.round((subtotal / qty) * 100) / 100 : firstPrice;

    items.push({
      brand: "Bambu Lab",
      material,
      variant,
      color_name,
      color_code,
      color_hex: resolveColorHex(color_code, color_name),
      format: parsed.format,
      diameter_mm: parsed.diameter_mm,
      nominal_weight_g: parsed.nominal_weight_g,
      sku,
      unit_price: unitNet || null,
      quantity: qty,
      include: true,
    });
  }

  if (items.length === 0) warnings.push("Nessun filamento Bambu riconosciuto nel testo.");
  return { items, warnings };
}

/** Pipeline completa: testo -> Bambu -> (fallback AI) -> ParseResult. */
export async function parseInvoice(buffer: Buffer): Promise<ParseResult> {
  const text = await pdfToText(buffer);
  const source = findOrderNumber(text);
  const purchase_date = findInvoiceDate(text);

  const bambu = parseBambu(text);
  if (bambu.items.length > 0) {
    return { method: "bambu", items: bambu.items, warnings: bambu.warnings, source, purchase_date };
  }

  // Fallback AI solo se il parser deterministico non trova nulla.
  try {
    const aiItems = await extractFilamentsWithAI(text);
    return {
      method: aiItems.length ? "ai" : "none",
      items: aiItems,
      warnings: aiItems.length ? ["Estratto via AI: verifica con attenzione."] : ["Nessun filamento trovato."],
      source,
      purchase_date,
    };
  } catch (e) {
    return {
      method: "none",
      items: [],
      warnings: [`Parser Bambu vuoto e fallback AI non disponibile: ${(e as Error).message}`],
      source,
      purchase_date,
    };
  }
}
