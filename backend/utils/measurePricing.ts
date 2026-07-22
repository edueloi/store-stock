export type SaleUnit = "unidade" | "m2" | "linear";

export interface MeasuredPriceResult {
  rawQuantity: number;
  billedQuantity: number;
  total: number;
  label: string;
  minimumApplied: boolean;
}

// Calcula o preço de um item vendido por medida (m² ou metro linear), aplicando
// o mínimo faturável quando a medida informada for menor que ele. Espelhado em
// src/utils/measurePricing.ts (preview no frontend) — esta cópia é a fonte da
// verdade: nunca confiar no preço calculado pelo cliente, sempre recalcular aqui
// a partir das dimensões brutas recebidas.
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
    : `${billedQuantity.toFixed(2)}m linear`;

  return { rawQuantity, billedQuantity, total, label, minimumApplied };
}
