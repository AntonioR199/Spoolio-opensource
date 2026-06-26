// Copertura dei colori base per le stampe multicolore (AMS).
// Verifica se in inventario hai almeno un colore per ciascuna famiglia "essenziale".

export interface EssentialColor {
  name: string;
  hex: string;
  re: RegExp;
}

export const ESSENTIAL_COLORS: EssentialColor[] = [
  { name: "Nero", hex: "#1A1A1A", re: /(nero|black|carbone|charcoal|antracite)/i },
  { name: "Bianco", hex: "#F2F0EA", re: /(bianco|white|avorio|osso|ivory|bone)/i },
  { name: "Grigio", hex: "#9B9EA0", re: /(grigio|grey|gray|silver|titanio|cenere)/i },
  { name: "Rosso", hex: "#C8102E", re: /(rosso|red|scarlat|cremisi)/i },
  { name: "Blu", hex: "#2B6CB0", re: /(blu|blue|marino|navy|azzurro)/i },
  { name: "Verde", hex: "#3F9B4F", re: /(verde|green|prato|petrolio)/i },
  { name: "Giallo", hex: "#F5C518", re: /(giallo|yellow|girasole|oro|gold)/i },
  { name: "Arancione", hex: "#E8761B", re: /(arancio|orange|zucca|apricot|albicocca)/i },
];

export interface PaletteSlot extends EssentialColor {
  present: boolean;
}

/** Per ogni colore essenziale indica se è coperto da almeno un colore in inventario. */
export function getPaletteCoverage(colorNames: string[]): PaletteSlot[] {
  return ESSENTIAL_COLORS.map((c) => ({
    ...c,
    present: colorNames.some((n) => c.re.test(n)),
  }));
}
