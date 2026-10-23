export type SaleUnit = "unidade" | "m2" | "linear" | "peso" | "volume";

export type MeasureUnit = "m" | "cm" | "mm" | "km" | "m2" | "cm2" | "mm2" | "km2" | "kg" | "g" | "mg" | "t" | "l" | "ml";

const UNIT_LABELS: Record<MeasureUnit, string> = {
  m: "metro (m)", cm: "centímetro (cm)", mm: "milímetro (mm)", km: "quilômetro (km)",
  m2: "metro quadrado (m²)", cm2: "centímetro quadrado (cm²)", mm2: "milímetro quadrado (mm²)", km2: "quilômetro quadrado (km²)",
  kg: "quilograma (kg)", g: "grama (g)", mg: "miligrama (mg)", t: "tonelada (t)",
  l: "litro (L)", ml: "mililitro (mL)",
};

export function defaultMeasureUnit(saleUnit: SaleUnit): MeasureUnit {
  if (saleUnit === "m2") return "m2";
  if (saleUnit === "peso") return "kg";
  if (saleUnit === "volume") return "l";
  return "m";
}

export function measureUnitLabel(unit: string | null | undefined, saleUnit: SaleUnit = "linear"): string {
  return UNIT_LABELS[(unit || defaultMeasureUnit(saleUnit)) as MeasureUnit] ?? String(unit || "UN").toUpperCase();
}

export function measureUnitAbbr(unit: string | null | undefined, saleUnit: SaleUnit = "linear"): string {
  const value = (unit || defaultMeasureUnit(saleUnit)).toLowerCase();
  return value === "m2" ? "m²" : value === "cm2" ? "cm²" : value === "mm2" ? "mm²" : value === "km2" ? "km²" : value === "l" ? "L" : value === "ml" ? "mL" : value;
}

export function measureUnitOptions(saleUnit: SaleUnit): [MeasureUnit, string][] {
  if (saleUnit === "m2") return [["m2", "Metro quadrado (m²)"], ["cm2", "Centímetro quadrado (cm²)"], ["mm2", "Milímetro quadrado (mm²)"], ["km2", "Quilômetro quadrado (km²)"]];
  if (saleUnit === "peso") return [["kg", "Quilograma (kg)"], ["g", "Grama (g)"], ["mg", "Miligrama (mg)"], ["t", "Tonelada (t)"]];
  if (saleUnit === "volume") return [["l", "Litro (L)"], ["ml", "Mililitro (mL)"]];
  return [["m", "Metro (m)"], ["cm", "Centímetro (cm)"], ["mm", "Milímetro (mm)"], ["km", "Quilômetro (km)"]];
}

export interface MeasuredPriceResult {
  rawQuantity: number;
  billedQuantity: number;
  total: number;
  label: string;
  minimumApplied: boolean;
  /** O valor mínimo em R$ (min_charge) foi aplicado porque o cálculo ficou abaixo dele. */
  minChargeApplied: boolean;
}

/** Aceita a vírgula brasileira e o ponto decimal sem alterar o que o usuário vê. */
export function parseMeasureInput(value: string | number | null | undefined): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const normalized = String(value ?? "").trim().replace(/\s/g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

// Calcula o preço de um item vendido por medida (m² ou metro linear), aplicando
// o mínimo faturável quando a medida informada for menor que ele. Espelhado em
// backend/utils/measurePricing.ts — o backend é a fonte da verdade (nunca confia
// no preço calculado pelo cliente), este lado só serve para preview ao vivo.
export function computeMeasuredPrice(
  saleUnit: SaleUnit,
  pricePerMeasure: number,
  minBillableQuantity: number | null | undefined,
  height: number,
  width?: number,
  measureUnit?: string | null,
  minCharge?: number | null,
): MeasuredPriceResult {
  const rawQuantity = saleUnit === "m2" ? height * (width ?? 0) : height;
  const min = Number(minBillableQuantity) || 0;
  const billedQuantity = Math.max(rawQuantity, min);
  const minimumApplied = min > 0 && rawQuantity < min;
  const calculated = Math.round(billedQuantity * pricePerMeasure * 100) / 100;
  const floor = Math.max(0, Number(minCharge) || 0);
  const minChargeApplied = floor > 0 && calculated < floor;
  const total = minChargeApplied ? floor : calculated;

  const unit = measureUnitAbbr(measureUnit, saleUnit);
  const label = saleUnit === "m2"
    ? `${height.toFixed(2)}${unit} × ${(width ?? 0).toFixed(2)}${unit} = ${billedQuantity.toFixed(2)}${unit}`
    : `${rawQuantity.toFixed(2)} ${unit}`;

  return { rawQuantity, billedQuantity, total, label, minimumApplied, minChargeApplied };
}
