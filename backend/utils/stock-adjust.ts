import { prisma } from "../config/prisma";

type SkuEntry = { combo: Record<string, string>; stock: number };
type LegacyVariation = { name: string; options: { value: string; stock: number }[] };

// Aplica um delta (positivo ou negativo) ao estoque da SKU/variação correspondente
// às opções selecionadas, sem tocar no total (stock_quantity) — quem chama já cuida
// disso separadamente, exatamente como o código original fazia em cada call site.
async function patchVariationStock(
  productId: number,
  selectedOptions: Record<string, string> | null | undefined,
  delta: number,
) {
  if (!selectedOptions || Object.keys(selectedOptions).length === 0) return;

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { skus: true, variations: true },
  });

  if (product?.skus) {
    const skus = product.skus as SkuEntry[];
    const updated = skus.map((sku) => {
      const matches = Object.entries(selectedOptions).every(([k, v]) => sku.combo[k] === v);
      return matches ? { ...sku, stock: Math.max(0, sku.stock + delta) } : sku;
    });
    await prisma.product.update({ where: { id: productId }, data: { skus: updated } });
  } else if (product?.variations) {
    const variations = product.variations as LegacyVariation[];
    const updated = variations.map((v) => ({
      ...v,
      options: v.options.map((o) => {
        const matches = selectedOptions[v.name] === o.value;
        return matches ? { ...o, stock: Math.max(0, o.stock + delta) } : o;
      }),
    }));
    await prisma.product.update({ where: { id: productId }, data: { variations: updated } });
  }
}

// Debita o estoque total do produto e, se houver variação selecionada, a SKU/variação
// correspondente. Não loga StockMovement — quem chama decide o `type`/`reason` (venda,
// consignação, venda em espera, etc.), já que cada fluxo usa uma tag diferente.
export async function decrementProductStock(
  productId: number,
  quantity: number,
  selectedOptions?: Record<string, string> | null,
): Promise<void> {
  await prisma.product.update({
    where: { id: productId },
    data: { stock_quantity: { decrement: quantity } },
  });
  await patchVariationStock(productId, selectedOptions, -quantity);
}

// Devolve ao estoque total do produto e, se houver variação selecionada, a SKU/variação
// correspondente — usado quando uma reserva (consignação, venda em espera) é cancelada
// ou parcialmente desfeita.
export async function returnProductStock(
  productId: number,
  quantity: number,
  selectedOptions?: Record<string, string> | null,
): Promise<void> {
  await prisma.product.update({
    where: { id: productId },
    data: { stock_quantity: { increment: quantity } },
  });
  await patchVariationStock(productId, selectedOptions, quantity);
}
