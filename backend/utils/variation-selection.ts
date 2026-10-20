// Escolha de variação (tamanho, cor etc.) de um produto em orçamento, ordem de serviço e demais
// fluxos que não são o PDV. Valida a escolha contra o cadastro do produto no servidor e informa
// o estoque realmente disponível para aquela combinação — nunca confia no que o cliente mandou.

type Attribute = { name: string; values: string[] };
type SkuEntry = { combo: Record<string, string>; stock: number };
type LegacyVariation = { name: string; options: { value: string; stock: number }[] };

type ProductLike = {
  name: string;
  stock_quantity: number;
  attributes?: unknown;
  variations?: unknown;
  skus?: unknown;
};

export class VariationError extends Error {}

export type VariationSelection = {
  /** Opções escolhidas (null quando o produto não tem variações). */
  options: Record<string, string> | null;
  /** Texto para exibir, ex.: "Tamanho: M, Cor: Azul". */
  label: string | null;
  /** Unidades disponíveis para essa combinação. */
  available: number;
};

export function productHasVariations(product: { attributes?: unknown; variations?: unknown }): boolean {
  return (Array.isArray(product.attributes) && product.attributes.length > 0)
    || (Array.isArray(product.variations) && product.variations.length > 0);
}

export function resolveVariationSelection(product: ProductLike, raw: unknown): VariationSelection {
  const hasAttr = Array.isArray(product.attributes) && product.attributes.length > 0;
  const hasLegacy = !hasAttr && Array.isArray(product.variations) && product.variations.length > 0;

  if (!hasAttr && !hasLegacy) {
    return { options: null, label: null, available: product.stock_quantity };
  }

  const chosen = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const options: Record<string, string> = {};

  if (hasAttr) {
    for (const attr of product.attributes as Attribute[]) {
      const value = chosen[attr.name];
      if (typeof value !== "string" || !attr.values.includes(value)) {
        throw new VariationError(`Escolha ${attr.name} de "${product.name}".`);
      }
      options[attr.name] = value;
    }
    const skus = Array.isArray(product.skus) ? (product.skus as SkuEntry[]) : [];
    const sku = skus.find((s) => s.combo && Object.keys(s.combo).length === Object.keys(options).length
      && Object.entries(options).every(([k, v]) => s.combo[k] === v));
    // sem SKU cadastrada para a combinação, vale o estoque total do produto (mesmo critério do PDV)
    const available = sku ? Math.min(Number(sku.stock), product.stock_quantity) : product.stock_quantity;
    return { options, label: Object.entries(options).map(([k, v]) => `${k}: ${v}`).join(", "), available };
  }

  let available = product.stock_quantity;
  for (const variation of product.variations as LegacyVariation[]) {
    const option = variation.options?.find((o) => o.value === chosen[variation.name]);
    if (!option) throw new VariationError(`Escolha ${variation.name} de "${product.name}".`);
    options[variation.name] = option.value;
    available = Math.min(available, Number(option.stock));
  }
  return { options, label: Object.entries(options).map(([k, v]) => `${k}: ${v}`).join(", "), available };
}
