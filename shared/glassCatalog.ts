/** Regras do catálogo usadas pela prévia e recalculadas pelo servidor. Medidas em mm. */
export interface GlassCatalogItem {
  id: number; name: string; description?: string | null; image_url?: string | null;
  images?: unknown; sale_unit?: string; measure_unit?: string | null;
  price?: unknown; discount_price?: unknown; price_per_measure?: unknown;
  min_billable_quantity?: unknown; attributes?: unknown; variations?: unknown;
  price_hidden?: boolean; hide_price_on_site?: boolean;
  storefront_details?: any;
}
export function glassMeasurements(item: GlassCatalogItem) {
  const settings = item.storefront_details?.measurements;
  return { enabled: typeof settings?.enabled === "boolean" ? settings.enabled : ["m2", "linear"].includes(item.sale_unit || ""), kind: settings?.kind || "fixo", allowLater: settings?.allow_measure_later !== false };
}
export function glassOptions(item: GlassCatalogItem): Array<{ name: string; values: string[] }> {
  const attrs = Array.isArray(item.attributes) ? item.attributes : [];
  const variations = Array.isArray(item.variations) ? item.variations : [];
  return (attrs.length ? attrs : variations).flatMap((a: any) => {
    if (!a || typeof a.name !== "string") return [];
    const values = Array.isArray(a.values) ? a.values : Array.isArray(a.options) ? a.options.map((o: any) => o?.value) : [];
    const clean = [...new Set(values.filter((v: unknown): v is string => typeof v === "string" && !!v.trim()))] as string[];
    return clean.length ? [{ name: a.name, values: clean }] : [];
  });
}
export function glassPrice(item: GlassCatalogItem, widthMm: number, heightMm: number, quantity = 1) {
  const unit = item.sale_unit || "unidade";
  const measure = item.measure_unit || (unit === "m2" ? "m2" : "m");
  const areaFactors: Record<string, number> = { m2: 1, cm2: 10000, mm2: 1000000, km2: .000001 };
  const lengthFactors: Record<string, number> = { m: 1, cm: 100, mm: 1000, km: .001 };
  const raw = unit === "m2" ? widthMm * heightMm / 1000000 * (areaFactors[measure] ?? 1)
    : unit === "linear" ? widthMm / 1000 * (lengthFactors[measure] ?? 1) : 1;
  const billed = unit === "unidade" ? 1 : Math.max(raw, Number(item.min_billable_quantity) || 0);
  const rate = unit === "unidade" ? Number(item.discount_price ?? item.price) : Number(item.price_per_measure);
  const known = !item.price_hidden && !item.hide_price_on_site && Number.isFinite(rate) && rate > 0;
  const unitPrice = Number.isFinite(rate) && rate >= 0 ? Math.round(billed * rate * 100) / 100 : 0;
  return { raw, billed, measure, minimumApplied: billed > raw, unitPrice, total: Math.round(unitPrice * quantity * 100) / 100, known };
}
export const glassMeasureLabel = (item: GlassCatalogItem) => item.sale_unit === "m2" ? (item.measure_unit || "m2").replace("2", "²") : item.sale_unit === "linear" ? (item.measure_unit || "m") : "unidade";
