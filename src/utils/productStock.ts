interface StockAwareProduct {
  stock_quantity: number;
  sale_unit?: "unidade" | "m2" | "linear";
  skus?: { combo: Record<string, string>; stock: number }[];
  variations?: { name: string; options: { value: string; stock: number }[] }[];
}

export function productHasStock(p: StockAwareProduct): boolean {
  if (p.sale_unit && p.sale_unit !== "unidade") return true;
  if (Array.isArray(p.skus) && p.skus.length > 0) {
    return p.skus.some((s) => s.stock > 0);
  }
  if (Array.isArray(p.variations) && p.variations.length > 0) {
    return p.variations.some((v) => v.options.some((o) => o.stock > 0));
  }
  return p.stock_quantity > 0;
}
