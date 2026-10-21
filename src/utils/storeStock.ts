import type { Product, Tenant } from "../types";

/** A vitrine só acompanha estoque quando a loja controla saldo e não vende por encomenda. */
export function storeTracksStock(tenant: Pick<Tenant, "sell_without_stock_control" | "policies"> | undefined | null): boolean {
  if (!tenant) return false;
  if (tenant.sell_without_stock_control) return false;
  return tenant.policies?.storefront?.checkout_mode !== "order_request";
}

/** Unidades disponíveis do produto (ou da variação escolhida). `null` quando não é contado em unidades. */
export function availableUnits(product: Product, selected?: Record<string, string>): number | null {
  if (product.track_stock === false) return null;
  if (product.sale_unit && product.sale_unit !== "unidade") return null;
  const picked = selected && Object.keys(selected).length ? selected : null;
  const skus = Array.isArray(product.skus) ? product.skus : [];
  if (picked && skus.length) {
    const match = skus.find((s) => Object.entries(picked).every(([k, v]) => s.combo?.[k] === v));
    if (match) return Math.max(0, Number(match.stock) || 0);
  }
  if (picked && Array.isArray(product.variations) && product.variations.length) {
    const stocks = product.variations
      .filter((v) => picked[v.name] !== undefined)
      .map((v) => v.options.find((o) => o.value === picked[v.name])?.stock)
      .filter((n): n is number => typeof n === "number");
    if (stocks.length) return Math.max(0, Math.min(...stocks));
  }
  return Math.max(0, Number(product.stock_quantity) || 0);
}
