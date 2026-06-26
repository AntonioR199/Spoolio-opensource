// Mappa codice colore Bambu -> hex, per l'anteprima "a colpo d'occhio".
// I valori sono approssimazioni dei colori reali Bambu Lab: bastano per i
// pallini in dashboard. Le voci mancanti ricadono su una stima dal nome.

export const BAMBU_COLOR_HEX: Record<string, string> = {
  // PLA Basic (10xxx)
  "10104": "#C7CACB", // Grigio chiaro / Light Grey
  "10201": "#D8C9A6", // Beige
  "10301": "#E8761B", // Arancione zucca / Pumpkin Orange
  "10402": "#F5C518", // Giallo girasole / Sunflower Yellow
  "10801": "#8C6B3F", // Bronzo / Bronze
  // PLA Matte (11xxx)
  "11100": "#F0EBDD", // Bianco avorio / Ivory White
  "11101": "#2E2B28", // Carbone / Charcoal
  "11102": "#9B9EA0", // Grigio cenere / Ash Grey
  "11103": "#CBC6B8", // Bianco osso / Bone White
  "11200": "#C8102E", // Rosso scarlatto / Scarlet Red
  "11201": "#E8A0BD", // Rosa sakura / Sakura Pink
  "11202": "#8B2A2A", // Rosso scuro / Dark Red
  "11203": "#C66A4A", // Terracotta
  "11500": "#5B8C3E", // Verde prato / Grass Green
  "11600": "#1B3A6B", // Blu marino / Marine Blue
  "11800": "#A6794F", // Caffelatte / Latte
  "11801": "#4A2F23", // Marrone scuro / Dark Brown
  // PLA Silk+ (131xx)
  "13108": "#8A8D8F", // Grigio titanio / Titanium Grey
  // PLA Translucent (136xx)
  "13611": "#2B6CB0", // Blu / Translucent Blue
  "13612": "#3E8E8E", // Verde petrolio / Translucent Teal
  // PLA Pure (17xxx)
  "17100": "#F7F7F7", // Pure White
  "17101": "#1A1A1A", // Absolute Black
  "17200": "#F3C6D3", // Milky Pink
  "17300": "#F2C18B", // Apricot
  "17600": "#A9CCE3", // Baby Blue
  // PETG Basic (301xx)
  "30105": "#1A1A1A", // Black
  "30106": "#F7F7F7", // White
  // Support (651xx)
  "65104": "#F0F0F0", // Support White
};

// Stima grezza dal nome colore (italiano/inglese) per marche non Bambu.
const NAME_HINTS: Array<[RegExp, string]> = [
  [/(nero|black|carbone|charcoal)/i, "#1A1A1A"],
  [/(bianco|white|ivory|avorio|osso|bone)/i, "#F2F0EA"],
  [/(grigio|grey|gray|silver|titanio|cenere)/i, "#9B9EA0"],
  [/(rosso|red|scarlat|terracotta)/i, "#C8102E"],
  [/(blu|blue|marino|navy)/i, "#2B6CB0"],
  [/(verde|green|petrolio|teal)/i, "#3F9B4F"],
  [/(giallo|yellow|girasole)/i, "#F5C518"],
  [/(arancio|orange|zucca|apricot)/i, "#E8761B"],
  [/(rosa|pink|sakura)/i, "#E8A0BD"],
  [/(marrone|brown|caffe|latte|bronzo|bronze)/i, "#6B4A2F"],
  [/(beige|sabbia|sand)/i, "#D8C9A6"],
  [/(viola|purple|violet)/i, "#7A4FBF"],
];

/** Risolve un hex da codice colore Bambu o, in mancanza, dal nome. */
export function resolveColorHex(code: string | null, name: string | null): string {
  if (code && BAMBU_COLOR_HEX[code]) return BAMBU_COLOR_HEX[code];
  if (name) {
    for (const [re, hex] of NAME_HINTS) {
      if (re.test(name)) return hex;
    }
  }
  return "#B0B4B8"; // grigio neutro di default
}
