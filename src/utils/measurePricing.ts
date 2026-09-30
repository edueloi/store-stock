export type SaleUnit = "unidade" | "m2" | "linear";

export interface MeasuredPriceResult {
  rawQuantity: number;
  billedQuantity: number;
  total: number;
  label: string;
  minimumApplied: boolean;
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
): MeasuredPriceResult {
  const rawQuantity = saleUnit === "m2" ? height * (width ?? 0) : height;
  const min = Number(minBillableQuantity) || 0;
  const billedQuantity = Math.max(rawQuantity, min);
  const minimumApplied = min > 0 && rawQuantity < min;
  const total = Math.round(billedQuantity * pricePerMeasure * 100) / 100;

  const label = saleUnit === "m2"
    ? `${height.toFixed(2)}m × ${(width ?? 0).toFixed(2)}m = ${billedQuantity.toFixed(2)}m²`
    : `${rawQuantity.toFixed(2)}m linear`;

  return { rawQuantity, billedQuantity, total, label, minimumApplied };
}
