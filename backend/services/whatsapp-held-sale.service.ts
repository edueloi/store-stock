import { prisma } from "../config/prisma";
import { decrementProductStock } from "../utils/stock-adjust";
import { emitToTenant } from "./realtime.service";

// "Segurar venda" pedido pelo assistente de IA do WhatsApp. Mesmas regras do PDV (reserva o
// estoque, aparece em Vendas em espera), mas com travas extras porque quem pede é um cliente
// anônimo: tudo é revalidado no servidor (a IA só sugere ids/quantidades), só há uma reserva
// aberta por telefone e a equipe confirma antes de virar venda.

const MAX_ITEMS = 8;
const MAX_QTY = 50;
const ACTOR = "Assistente WhatsApp";
const NOTE = "Reservado pelo assistente de WhatsApp — aguardando confirmação da equipe.";

export type WhatsappHoldItemInput = { id: number; qty: number; options?: Record<string, string> };

export class HoldRejected extends Error {}

type SkuEntry = { combo: Record<string, string>; stock: number };
type LegacyVariation = { name: string; options: { value: string; stock: number }[] };

/** Estoque realmente disponível para a opção escolhida, ou erro explicando o que falta. */
function availableFor(product: { name: string; stock_quantity: number; skus: unknown; variations: unknown }, options: Record<string, string>) {
  const chosen = Object.entries(options);

  if (Array.isArray(product.skus) && product.skus.length) {
    const skus = product.skus as SkuEntry[];
    const sku = skus.find((s) => s.combo
      && Object.keys(s.combo).length === chosen.length
      && chosen.every(([k, v]) => s.combo[k] === v));
    if (!sku) throw new HoldRejected(`Preciso saber a opção de "${product.name}" (tamanho, cor etc.) para segurar.`);
    return Math.min(Number(sku.stock), product.stock_quantity);
  }

  if (Array.isArray(product.variations) && product.variations.length) {
    const variations = product.variations as LegacyVariation[];
    let min = product.stock_quantity;
    for (const variation of variations) {
      const option = variation.options?.find((o) => o.value === options[variation.name]);
      if (!option) throw new HoldRejected(`Preciso saber a opção de "${product.name}" (${variation.name}) para segurar.`);
      min = Math.min(min, Number(option.stock));
    }
    return min;
  }

  return product.stock_quantity;
}

export async function createHeldSaleFromWhatsapp(input: {
  tenantId: number;
  customerName: string;
  customerPhone: string;
  customerId?: number | null;
  items: WhatsappHoldItemInput[];
}) {
  const { tenantId } = input;
  if (!Array.isArray(input.items) || !input.items.length || input.items.length > MAX_ITEMS) {
    throw new HoldRejected("Não consegui montar a lista de itens para segurar.");
  }

  // uma reserva aberta por telefone: evita esvaziar o estoque com pedidos repetidos
  const phoneDigits = input.customerPhone.replace(/\D/g, "");
  const open = await prisma.heldSale.findFirst({
    where: {
      tenant_id: tenantId,
      status: { in: ["held", "resumed"] },
      notes: { startsWith: "Reservado pelo assistente" },
      customer_phone: { contains: phoneDigits.slice(-9) },
    },
    select: { number: true },
  });
  if (open) throw new HoldRejected(`Você já tem a reserva nº ${open.number} aberta. A equipe vai confirmar com você.`);

  const rows: { product_id: number; name: string; quantity: number; unit_price: number; selected_options: Record<string, string> | null }[] = [];
  for (const item of input.items) {
    const quantity = Number(item.qty);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QTY) throw new HoldRejected("A quantidade informada não é válida.");

    const product = await prisma.product.findFirst({ where: { id: Number(item.id), tenant_id: tenantId } });
    if (!product) throw new HoldRejected("Um dos produtos não foi encontrado.");
    if (product.sale_unit && product.sale_unit !== "unidade") {
      throw new HoldRejected(`"${product.name}" é vendido por medida; a equipe precisa combinar com você.`);
    }

    const options = item.options && typeof item.options === "object" ? item.options : {};
    const available = availableFor(product, options);
    if (available < quantity) {
      throw new HoldRejected(available > 0
        ? `Só tenho ${available} unidade(s) de "${product.name}" nessa opção.`
        : `"${product.name}" está sem estoque nessa opção.`);
    }

    rows.push({
      product_id: product.id,
      name: product.name,
      quantity,
      unit_price: Number(product.discount_price ?? product.price),
      selected_options: Object.keys(options).length ? options : null,
    });
  }

  const last = await prisma.heldSale.findFirst({ where: { tenant_id: tenantId }, orderBy: { number: "desc" }, select: { number: true } });
  const number = (last?.number ?? 0) + 1;

  const heldSale = await prisma.heldSale.create({
    data: {
      tenant_id: tenantId,
      number,
      customer_id: input.customerId || null,
      customer_name: input.customerName || null,
      customer_phone: input.customerPhone || null,
      notes: NOTE,
      items: { create: rows },
    },
    include: { items: true },
  });

  for (const row of rows) {
    await decrementProductStock(row.product_id, row.quantity, row.selected_options);
    await prisma.stockMovement.create({
      data: { tenant_id: tenantId, product_id: row.product_id, quantity: -row.quantity, type: "held_sale_out", reason: `Venda em espera #${number}` },
    });
  }

  await prisma.heldSaleAction.create({
    data: { tenant_id: tenantId, held_sale_id: heldSale.id, action: "created", to_status: heldSale.status, actor: ACTOR, note: NOTE },
  });
  emitToTenant(tenantId, "order:updated", { heldSaleId: heldSale.id });
  emitToTenant(tenantId, "stock:changed", { heldSaleId: heldSale.id });

  const total = rows.reduce((sum, r) => sum + r.unit_price * r.quantity, 0);
  return { number, total: Math.round(total * 100) / 100, items: rows };
}
