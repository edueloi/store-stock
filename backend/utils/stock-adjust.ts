import { prisma } from "../config/prisma";
import type { Prisma } from "@prisma/client";

type SkuEntry = { combo: Record<string, string>; stock: number };
type LegacyVariation = { name: string; options: { value: string; stock: number }[] };
export const skuMatchesSelection = (combo: Record<string,string>, options: Record<string,string>) => Object.keys(combo).length > 0 && Object.entries(combo).every(([key,value]) => options[key] === value);

// Aplica um delta (positivo ou negativo) ao estoque da SKU/variação correspondente
// às opções selecionadas, sem tocar no total (stock_quantity) — quem chama já cuida
// disso separadamente, exatamente como o código original fazia em cada call site.
async function patchVariationStock(
  productId: number,
  selectedOptions: Record<string, string> | null | undefined,
  delta: number,
  db: Prisma.TransactionClient = prisma,
) {
  if (!selectedOptions || Object.keys(selectedOptions).length === 0) return;

  const product = await db.product.findUnique({
    where: { id: productId },
    select: { skus: true, variations: true },
  });

  if (Array.isArray(product?.skus) && product.skus.length) {
    const skus = product.skus as SkuEntry[];
    const updated = skus.map((sku) => {
      const matches = skuMatchesSelection(sku.combo, selectedOptions);
      return matches ? { ...sku, stock: Math.max(0, sku.stock + delta) } : sku;
    });
    await db.product.update({ where: { id: productId }, data: { skus: updated } });
  } else if (Array.isArray(product?.variations) && product.variations.length) {
    const variations = product.variations as LegacyVariation[];
    const updated = variations.map((v) => ({
      ...v,
      options: v.options.map((o) => {
        const matches = selectedOptions[v.name] === o.value;
        return matches ? { ...o, stock: Math.max(0, o.stock + delta) } : o;
      }),
    }));
    await db.product.update({ where: { id: productId }, data: { variations: updated } });
  }
}

// Debita o estoque total do produto e, se houver variação selecionada, a SKU/variação
// correspondente. Não loga StockMovement — quem chama decide o `type`/`reason` (venda,
// consignação, venda em espera, etc.), já que cada fluxo usa uma tag diferente.
export async function decrementProductStock(
  productId: number,
  quantity: number,
  selectedOptions?: Record<string, string> | null,
  db: Prisma.TransactionClient = prisma,
): Promise<void> {
  await db.product.update({
    where: { id: productId },
    data: { stock_quantity: { decrement: quantity } },
  });
  await patchVariationStock(productId, selectedOptions, -quantity, db);
}

// Devolve ao estoque total do produto e, se houver variação selecionada, a SKU/variação
// correspondente — usado quando uma reserva (consignação, venda em espera) é cancelada
// ou parcialmente desfeita.
export async function returnProductStock(
  productId: number,
  quantity: number,
  selectedOptions?: Record<string, string> | null,
  db: Prisma.TransactionClient = prisma,
): Promise<void> {
  await db.product.update({
    where: { id: productId },
    data: { stock_quantity: { increment: quantity } },
  });
  await patchVariationStock(productId, selectedOptions, quantity, db);
}
