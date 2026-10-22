import { prisma } from "../config/prisma";
import { decrementProductStock, returnProductStock } from "../utils/stock-adjust";
import { emitToTenant } from "./realtime.service";
import { Prisma, type PrismaClient } from "@prisma/client";
import { WHATSAPP_RESERVATION_VALIDITY_MS, whatsappReservationExpiry } from "./whatsapp-reservation";

// "Segurar venda" pedido pelo assistente de IA do WhatsApp. Mesmas regras do PDV (reserva o
// estoque, aparece em Vendas em espera), mas com travas extras porque quem pede é um cliente
// anônimo: tudo é revalidado no servidor (a IA só sugere ids/quantidades), só há uma reserva
// aberta por telefone e a equipe confirma antes de virar venda.

const MAX_ITEMS = 8;
const MAX_QTY = 50;
const ACTOR = "Assistente WhatsApp";
const NOTE = "Reservado pelo assistente de WhatsApp — válido por 24 horas, aguardando confirmação da equipe.";

export type WhatsappHoldItemInput = { id: number; qty: number; options?: Record<string, string> };

export class HoldRejected extends Error {}

type SkuEntry = { combo: Record<string, string>; stock: number };
type LegacyVariation = { name: string; options: { value: string; stock: number }[] };
type ReservationDatabase = Pick<PrismaClient, "heldSale" | "$transaction">;

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
}, database: ReservationDatabase = prisma) {
  const { tenantId } = input;
  if (!Array.isArray(input.items) || !input.items.length || input.items.length > MAX_ITEMS) {
    throw new HoldRejected("Não consegui montar a lista de itens para segurar.");
  }

  const phoneDigits = input.customerPhone.replace(/\D/g, "");
  if (phoneDigits.length < 10) throw new HoldRejected("Preciso de um telefone válido para registrar a reserva.");
  await expireWhatsappReservations({ tenantId }, new Date(), database);

  // Estoque, itens e auditoria são confirmados juntos; falhas desfazem a reserva inteira.
  const result = await database.$transaction(async (db) => {
    const open = await db.heldSale.findFirst({
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

      if (!Number.isInteger(Number(item.id)) || Number(item.id) < 1) throw new HoldRejected("Um dos produtos não é válido.");
      const product = await db.product.findFirst({ where: { id: Number(item.id), tenant_id: tenantId } });
      if (!product) throw new HoldRejected("Um dos produtos não foi encontrado.");
      if (product.sale_unit && product.sale_unit !== "unidade") {
        throw new HoldRejected(`"${product.name}" é vendido por medida; a equipe precisa combinar com você.`);
      }

      const options = item.options && typeof item.options === "object" && !Array.isArray(item.options) ? item.options : {};
      if (Object.entries(options).some(([key, value]) => !key || typeof value !== "string")) throw new HoldRejected("A opção escolhida não é válida.");
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
      // Debita a cada linha dentro da transação: ids repetidos não podem exceder o estoque.
      await decrementProductStock(product.id, quantity, options, db);
    }

    const last = await db.heldSale.findFirst({ where: { tenant_id: tenantId }, orderBy: { number: "desc" }, select: { number: true } });
    const number = (last?.number ?? 0) + 1;
    const createdAt = new Date();
    const expiresAt = new Date(createdAt.getTime() + WHATSAPP_RESERVATION_VALIDITY_MS);

    const heldSale = await db.heldSale.create({
      data: {
        tenant_id: tenantId,
        number,
        customer_id: input.customerId || null,
        customer_name: input.customerName || null,
        customer_phone: input.customerPhone || null,
        notes: NOTE,
        created_at: createdAt,
        snapshot: { whatsappReservation: { expiresAt: expiresAt.toISOString() } },
        items: { create: rows },
      },
      include: { items: true },
    });

    for (const row of rows) {
      await db.stockMovement.create({
        data: { tenant_id: tenantId, product_id: row.product_id, quantity: -row.quantity, type: "held_sale_out", reason: `Venda em espera #${number}` },
      });
    }

    await db.heldSaleAction.create({
      data: { tenant_id: tenantId, held_sale_id: heldSale.id, action: "created", to_status: heldSale.status, actor: ACTOR, note: NOTE },
    });
    const total = rows.reduce((sum, r) => sum + r.unit_price * r.quantity, 0);
    return { id: heldSale.id, number, total: Math.round(total * 100) / 100, items: rows, createdAt, expiresAt };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15_000 });
  emitToTenant(tenantId, "order:updated", { heldSaleId: result.id });
  emitToTenant(tenantId, "stock:changed", { heldSaleId: result.id });
  return result;
}

/** Cancela somente reservas WhatsApp com prazo gravado, devolvendo cada item uma única vez. */
export async function expireWhatsappReservations(filter: { tenantId?: number; heldSaleId?: number } = {}, now = new Date(), database: ReservationDatabase = prisma) {
  const candidates = await database.heldSale.findMany({
    where: {
      ...(filter.tenantId ? { tenant_id: filter.tenantId } : {}),
      ...(filter.heldSaleId ? { id: filter.heldSaleId } : {}),
      status: { in: ["held", "resumed"] },
      notes: { startsWith: "Reservado pelo assistente de WhatsApp" },
    },
    select: { id: true, tenant_id: true, snapshot: true },
  });
  for (const candidate of candidates) {
    const expiresAt = whatsappReservationExpiry(candidate.snapshot);
    if (!expiresAt || expiresAt > now) continue;
    const changed = await database.$transaction(async (db) => {
      const claim = await db.heldSale.updateMany({
        where: { id: candidate.id, tenant_id: candidate.tenant_id, status: { in: ["held", "resumed"] } },
        data: { status: "cancelled", cancelled_by: ACTOR, cancelled_at: now, cancel_reason: "Validade de 24 horas da reserva encerrada." },
      });
      if (!claim.count) return false;
      const items = await db.heldSaleItem.findMany({ where: { held_sale_id: candidate.id, resolution: "pending" } });
      for (const item of items) {
        await returnProductStock(item.product_id, item.quantity, item.selected_options as Record<string, string> | null, db);
        await db.stockMovement.create({ data: {
          tenant_id: candidate.tenant_id, product_id: item.product_id, quantity: item.quantity,
          type: "held_sale_return", reason: "Expiração da reserva WhatsApp (24 horas)",
        } });
        await db.heldSaleItem.update({ where: { id: item.id }, data: { resolution: "returned", resolved_at: now } });
      }
      await db.heldSaleAction.create({ data: {
        tenant_id: candidate.tenant_id, held_sale_id: candidate.id, action: "cancelled", to_status: "cancelled",
        actor: ACTOR, note: "Reserva expirada após 24 horas; estoque liberado automaticamente.",
      } });
      return true;
    }, { timeout: 15_000 });
    if (changed) {
      emitToTenant(candidate.tenant_id, "order:updated", { heldSaleId: candidate.id });
      emitToTenant(candidate.tenant_id, "stock:changed", { heldSaleId: candidate.id });
    }
  }
}
