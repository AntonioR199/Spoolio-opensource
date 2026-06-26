// Etichetta "tipo" da mostrare = materiale + variante, senza duplicare il
// polimero. Es: material "PLA" + variant "PLA+ HS" -> "PLA+ HS" (non "PLA PLA+ HS").
// Il materiale resta invariato, quindi i filtri continuano a usare "PLA".

export function typeLabel(material: string, variant: string | null): string {
  if (!variant) return material;
  const v = variant.trim();
  if (!v) return material;
  if (v.toLowerCase().startsWith(material.toLowerCase())) return v;
  return `${material} ${v}`;
}
