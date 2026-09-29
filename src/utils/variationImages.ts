import type { Product } from "../types";

/** Retorna a galeria específica da combinação selecionada, se ela existir. */
export function getVariationImages(product: Product | undefined, options: Record<string, string>) {
  if (!product?.skus || !Object.values(options).some(Boolean)) return [];

  const exact = product.skus.find(sku =>
    Object.entries(options).every(([name, value]) => !value || sku.combo[name] === value)
  );

  return Array.isArray(exact?.images) ? exact.images.filter(Boolean) : [];
}
