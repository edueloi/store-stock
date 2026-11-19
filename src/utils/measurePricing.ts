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

const FACTORS: Record<string, [string, number]> = {
  km: ["len", 1000], m: ["len", 1], cm: ["len", 0.01], mm: ["len", 0.001],
  t: ["mass", 1000], kg: ["mass", 1], g: ["mass", 0.001], mg: ["mass", 0.000001],
  l: ["vol", 1], ml: ["vol", 0.001],
};

/** Unidade de cada lado/medida digitada: m² → m, cm² → cm; as demais já são a própria unidade. */
export function sideUnitOf(unit: string): string {
  const u = unit.toLowerCase();
  return u === "m2" ? "m" : u === "cm2" ? "cm" : u === "mm2" ? "mm" : u === "km2" ? "km" : u;
}

/** Converte entre unidades da mesma família (comprimento, massa, volume). Famílias diferentes: devolve o valor. */
export function convertMeasure(value: number, from: string, to: string): number {
  const a = FACTORS[from.toLowerCase()];
  const b = FACTORS[to.toLowerCase()];
  if (!a || !b || a[0] !== b[0]) return value;
  return (value * a[1]) / b[1];
}

/** Medida digitada (na unidade escolhida) já convertida para a unidade do produto — é o que vai para o backend. */
export function toProductMeasure(value: number, inputUnit: string | null | undefined, saleUnit: SaleUnit, measureUnit?: string | null): number {
  const side = sideUnitOf((measureUnit || defaultMeasureUnit(saleUnit)).toLowerCase());
  return !inputUnit || inputUnit.toLowerCase() === side ? value : convertMeasure(value, inputUnit, side);
}

/** Unidades em que o operador pode digitar a medida (conversão automática para a unidade do produto). */
export function measureInputUnitOptions(saleUnit: SaleUnit): [string, string][] {
  if (saleUnit === "peso") return [["kg", "kg"], ["g", "g"], ["mg", "mg"], ["t", "t"]];
  if (saleUnit === "volume") return [["l", "L"], ["ml", "mL"]];
  if (saleUnit === "m2") return [["m", "m"], ["cm", "cm"], ["mm", "mm"]];
  return [["m", "m"], ["cm", "cm"], ["mm", "mm"], ["km", "km"]];
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
  /** Unidade em que a medida foi digitada (ex.: mm). Converte para a unidade do produto antes de calcular. */
  inputUnit?: string | null,
): MeasuredPriceResult {
  const productUnit = (measureUnit || defaultMeasureUnit(saleUnit)).toLowerCase();
  const side = sideUnitOf(productUnit);
  const typedIn = (inputUnit || side).toLowerCase();
  const converted = typedIn !== side;
  const rawHeight = converted ? convertMeasure(height, typedIn, side) : height;
  const rawWidth = converted ? convertMeasure(width ?? 0, typedIn, side) : (width ?? 0);
  const rawQuantity = saleUnit === "m2" ? rawHeight * rawWidth : rawHeight;
  const min = Number(minBillableQuantity) || 0;
  const billedQuantity = Math.max(rawQuantity, min);
  const minimumApplied = min > 0 && rawQuantity < min;
  const calculated = Math.round(billedQuantity * pricePerMeasure * 100) / 100;
  const floor = Math.max(0, Number(minCharge) || 0);
  const minChargeApplied = floor > 0 && calculated < floor;
  const total = minChargeApplied ? floor : calculated;

  const unit = measureUnitAbbr(measureUnit, saleUnit);
  const fmtNum = (n: number) => String(Math.round(n * 1000) / 1000).replace(".", ",");
  const sideAbbr = measureUnitAbbr(typedIn, saleUnit);
  const billedText = fmtNum(billedQuantity);
  const label = saleUnit === "m2"
    ? `${fmtNum(height)} ${sideAbbr} × ${fmtNum(width ?? 0)} ${sideAbbr} = ${billedText} ${unit}`
    : `${fmtNum(height)} ${sideAbbr}${converted ? ` = ${billedText} ${unit}` : ""}`;

  return { rawQuantity, billedQuantity, total, label, minimumApplied, minChargeApplied };
}
