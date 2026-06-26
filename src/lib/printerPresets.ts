// Preset delle stampanti FDM più diffuse, per aggiungerle rapidamente.

export interface PrinterPreset {
  brand: string;
  model: string;
  build_volume: string;
  nozzle_diameter: number;
  tech: string;
}

export const PRINTER_PRESETS: PrinterPreset[] = [
  // Bambu Lab
  { brand: "Bambu Lab", model: "A1", build_volume: "256×256×256 mm", nozzle_diameter: 0.4, tech: "FDM" },
  { brand: "Bambu Lab", model: "A1 mini", build_volume: "180×180×180 mm", nozzle_diameter: 0.4, tech: "FDM" },
  { brand: "Bambu Lab", model: "P1P", build_volume: "256×256×256 mm", nozzle_diameter: 0.4, tech: "FDM" },
  { brand: "Bambu Lab", model: "P1S", build_volume: "256×256×256 mm", nozzle_diameter: 0.4, tech: "FDM" },
  { brand: "Bambu Lab", model: "X1 Carbon", build_volume: "256×256×256 mm", nozzle_diameter: 0.4, tech: "FDM" },
  { brand: "Bambu Lab", model: "X1E", build_volume: "256×256×256 mm", nozzle_diameter: 0.4, tech: "FDM" },
  { brand: "Bambu Lab", model: "H2D", build_volume: "350×320×325 mm", nozzle_diameter: 0.4, tech: "FDM" },
  // Prusa
  { brand: "Prusa", model: "MK4S", build_volume: "250×210×220 mm", nozzle_diameter: 0.4, tech: "FDM" },
  { brand: "Prusa", model: "MK3S+", build_volume: "250×210×210 mm", nozzle_diameter: 0.4, tech: "FDM" },
  { brand: "Prusa", model: "MINI+", build_volume: "180×180×180 mm", nozzle_diameter: 0.4, tech: "FDM" },
  { brand: "Prusa", model: "CORE One", build_volume: "250×220×270 mm", nozzle_diameter: 0.4, tech: "FDM" },
  { brand: "Prusa", model: "XL", build_volume: "360×360×360 mm", nozzle_diameter: 0.4, tech: "FDM" },
  // Creality
  { brand: "Creality", model: "Ender-3 V3", build_volume: "220×220×250 mm", nozzle_diameter: 0.4, tech: "FDM" },
  { brand: "Creality", model: "Ender-3 V3 SE", build_volume: "220×220×250 mm", nozzle_diameter: 0.4, tech: "FDM" },
  { brand: "Creality", model: "K1", build_volume: "220×220×250 mm", nozzle_diameter: 0.4, tech: "FDM" },
  { brand: "Creality", model: "K1 Max", build_volume: "300×300×300 mm", nozzle_diameter: 0.4, tech: "FDM" },
  { brand: "Creality", model: "K2 Plus", build_volume: "350×350×350 mm", nozzle_diameter: 0.4, tech: "FDM" },
  // Anycubic
  { brand: "Anycubic", model: "Kobra 2 Pro", build_volume: "220×220×250 mm", nozzle_diameter: 0.4, tech: "FDM" },
  { brand: "Anycubic", model: "Kobra 3", build_volume: "250×220×260 mm", nozzle_diameter: 0.4, tech: "FDM" },
  // Elegoo
  { brand: "Elegoo", model: "Neptune 4 Pro", build_volume: "225×225×265 mm", nozzle_diameter: 0.4, tech: "FDM" },
  { brand: "Elegoo", model: "Centauri Carbon", build_volume: "256×256×256 mm", nozzle_diameter: 0.4, tech: "FDM" },
  // QIDI
  { brand: "QIDI", model: "Q1 Pro", build_volume: "245×245×245 mm", nozzle_diameter: 0.4, tech: "FDM" },
];

/** Slug univoco marca+modello → nome file immagine. */
export function printerSlug(brand: string, model: string): string {
  return `${brand}-${model}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Percorso della thumbnail per una stampante nota (preset), altrimenti null.
 *  Le immagini le forniamo noi in /public/printers/<slug>.webp. */
export function printerImage(brand: string | null, model: string | null): string | null {
  if (!brand || !model) return null;
  const found = PRINTER_PRESETS.find(
    (p) => p.brand.toLowerCase() === brand.toLowerCase() && p.model.toLowerCase() === model.toLowerCase()
  );
  if (!found) return null;
  return `/printers/${printerSlug(found.brand, found.model)}.webp`;
}

/** Elenco dei file immagine attesi in /public/printers/ (per fornirli). */
export const PRINTER_IMAGE_FILES = PRINTER_PRESETS.map(
  (p) => `${printerSlug(p.brand, p.model)}.webp`
);
