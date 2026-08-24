import type { Request, Response } from "express";

import { prisma } from "../config/prisma";
import type { AuthenticatedRequest } from "../types/auth";
import { finalizeSaleOrderForConsignment, SaleError } from "./sales.controller";
import { decrementProductStock, returnProductStock } from "../utils/stock-adjust";
import { emitToTenant } from "../services/realtime.service";

function getTenantId(req: Request) {
  return (req as AuthenticatedRequest).user.tenantId;
}

function getActor(req: Request): string {
  const u = (req as AuthenticatedRequest).user;
  return (u as any).name ?? (u as any).email ?? "Sistema";
}

async function logAction(
  tenantId: number,
  consignmentId: number,
  action: string,
  opts?: { fromStatus?: string; toStatus?: string; actor?: string; note?: string; meta?: object },
) {
  await prisma.consignmentAction.create({
    data: {
      tenant_id: tenantId,
      consignment_id: consignmentId,
      action,
      from_status: opts?.fromStatus ?? null,
      to_status: opts?.toStatus ?? null,
      actor: opts?.actor ?? null,
      note: opts?.note ?? null,
      meta: opts?.meta ?? undefined,
    },
  });
}

function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

function isOverdue(consignment: { status: string; due_date: Date }): boolean {
  return consignment.status === "aberta" && consignment.due_date.getTime() < Date.now();
}

// Reverte estoque (e SKU/variação) de um item da sacola — usado tanto na
// devolução parcial quanto no cancelamento total.
async function returnItemToStock(item: { product_id: number; quantity: number; selected_options: unknown }) {
  await returnProductStock(item.product_id, item.quantity, item.selected_options as Record<string, string> | null);

  await prisma.stockMovement.create({
    data: {
      tenant_id: (await prisma.product.findUnique({ where: { id: item.product_id }, select: { tenant_id: true } }))!.tenant_id,
      product_id: item.product_id,
      quantity: item.quantity,
      type: "consignment_return",
      reason: "Devolução de item consignado",
    },
  });
}

const CONSIGNMENT_INCLUDE = {
  items: true,
};

function isDueToday(dueDate: Date): boolean {
  const today = new Date();
  return dueDate.getFullYear() === today.getFullYear()
    && dueDate.getMonth() === today.getMonth()
    && dueDate.getDate() === today.getDate();
}

// Status "de exibição": não mexe no campo `status` persistido (aberta|fechada|cancelada),
// só refina "aberta" em parcial/vencendo/atrasada com base nos itens e no prazo.
function deriveStatus(consignment: { status: string; due_date: Date; items: { resolution: string }[] }): string {
  if (consignment.status !== "aberta") return consignment.status;
  const hasPending = consignment.items.some((it) => it.resolution === "pending");
  const hasResolved = consignment.items.some((it) => it.resolution !== "pending");
  if (hasPending && hasResolved) return "parcial";
  if (hasPending && consignment.due_date.getTime() < Date.now() && !isDueToday(consignment.due_date)) return "atrasada";
  if (hasPending && isDueToday(consignment.due_date)) return "vencendo_hoje";
  return "aberta";
}

// Bloqueia consignação para cliente de risco ou que ultrapasse o limite dedicado de
// consignação — mesmo princípio (e mesmo formato de erro) do limite de crediário em
// sales.controller.ts, mas com campo próprio (customer.consignment_limit), já que são
// exposições financeiras diferentes.
async function checkConsignmentEligibility(
  tenantId: number,
  customerId: number | null | undefined,
  additionalAmount: number,
): Promise<{ status: number; error: string; extra?: object } | null> {
  if (!customerId) return null;

  const customer = await prisma.customer.findFirst({
    where: { id: customerId, tenant_id: tenantId },
    select: { risk_flag: true, consignment_limit: true, name: true },
  });
  if (!customer) return null;

  if (customer.risk_flag) {
    return { status: 400, error: "Este cliente está bloqueado para novas consignações." };
  }

  const limit = customer.consignment_limit ? Number(customer.consignment_limit) : 0;
  if (limit > 0) {
    const openConsignments = await prisma.consignment.findMany({
      where: { tenant_id: tenantId, customer_id: customerId, status: "aberta" },
      include: { items: true },
    });
    const openTotal = openConsignments.reduce(
      (sum, c) => sum + c.items
        .filter((it) => it.resolution === "pending")
        .reduce((s, it) => s + Number(it.unit_price) * it.quantity, 0),
      0,
    );
    if (openTotal + additionalAmount > limit + 0.005) {
      return {
        status: 422,
        error: `Limite de consignação excedido: em aberto R$ ${openTotal.toFixed(2)} + R$ ${additionalAmount.toFixed(2)} > limite R$ ${limit.toFixed(2)}`,
        extra: { limit, openTotal, requested: additionalAmount },
      };
    }
  }

  return null;
}

export async function listConsignments(req: Request, res: Response) {
  try {
    const tenantId = getTenantId(req);
    const status = req.query.status as string | undefined;
    const overdue = req.query.overdue === "true";

    const consignments = await prisma.consignment.findMany({
      where: {
        tenant_id: tenantId,
        ...(status ? { status } : {}),
        ...(overdue ? { status: "aberta", due_date: { lt: new Date() } } : {}),
      },
      include: CONSIGNMENT_INCLUDE,
      orderBy: { created_at: "desc" },
    });
    res.json(consignments.map((c) => ({ ...c, overdue: isOverdue(c), derived_status: deriveStatus(c) })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha ao listar consignações" });
  }
}

export async function getOverdueCount(req: Request, res: Response) {
  try {
    const tenantId = getTenantId(req);
    const overdue = await prisma.consignment.findMany({
      where: { tenant_id: tenantId, status: "aberta", due_date: { lt: new Date() } },
      select: { id: true, number: true, customer_name: true, due_date: true },
      orderBy: { due_date: "asc" },
    });
    res.json({
      count: overdue.length,
      customers: overdue.map((c) => ({
        consignmentId: c.id,
        number: c.number,
        customerName: c.customer_name,
        dueDate: c.due_date,
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha ao buscar consignações em atraso" });
  }
}

export async function getConsignmentById(req: Request, res: Response) {
  try {
    const tenantId = getTenantId(req);
    const consignment = await prisma.consignment.findFirst({
      where: { id: Number(req.params.id), tenant_id: tenantId },
      include: {
        ...CONSIGNMENT_INCLUDE,
        actions: { orderBy: { created_at: "desc" } },
      },
    });
    if (!consignment) return res.status(404).json({ error: "Consignação não encontrada" });
    res.json({ ...consignment, overdue: isOverdue(consignment), derived_status: deriveStatus(consignment) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha ao buscar consignação" });
  }
}

export async function createConsignment(req: Request, res: Response) {
  try {
    const tenantId = getTenantId(req);

    const {
      customer_id,
      customer_name,
      customer_phone,
      seller_id,
      due_days,
      notes,
      items,
    } = req.body as {
      customer_id?: number;
      customer_name: string;
      customer_phone?: string;
      seller_id?: number;
      due_days?: number;
      notes?: string;
      items: Array<{ product_id: number; quantity: number; selectedOptions?: Record<string, string> | null }>;
    };

    if (!customer_name || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "Cliente e ao menos um item são obrigatórios" });
    }

    // Resolve, valida e reserva estoque de cada item ANTES de criar a sacola —
    // nunca confia em preço/nome mandado pelo cliente (mesmo princípio de createServiceOrder).
    const itemRows: { product_id: number; name: string; quantity: number; unit_price: number; selected_options: any }[] = [];
    for (const it of items) {
      const product = await prisma.product.findFirst({ where: { id: it.product_id, tenant_id: tenantId } });
      if (!product) return res.status(400).json({ error: `Produto ${it.product_id} não encontrado` });
      if (product.sale_unit && product.sale_unit !== "unidade") {
        return res.status(400).json({ error: `Produto "${product.name}" é vendido por medida e não pode ser consignado` });
      }
      if (product.stock_quantity < it.quantity) {
        return res.status(400).json({ error: `Estoque insuficiente para "${product.name}"` });
      }
      itemRows.push({
        product_id: product.id,
        name: product.name,
        quantity: it.quantity,
        unit_price: Number(product.discount_price ?? product.price),
        selected_options: it.selectedOptions ?? null,
      });
    }

    const totalAmount = itemRows.reduce((sum, row) => sum + row.unit_price * row.quantity, 0);
    const eligibilityError = await checkConsignmentEligibility(tenantId, customer_id, totalAmount);
    if (eligibilityError) return res.status(eligibilityError.status).json({ error: eligibilityError.error, ...eligibilityError.extra });

    const last = await prisma.consignment.findFirst({
      where: { tenant_id: tenantId },
      orderBy: { number: "desc" },
      select: { number: true },
    });
    const nextNumber = (last?.number ?? 0) + 1;

    let sellerName: string | null = null;
    if (seller_id) {
      const seller = await prisma.seller.findUnique({ where: { id: seller_id }, select: { name: true } });
      sellerName = seller?.name ?? null;
    }

    const dueDaysNum = due_days && due_days > 0 ? Number(due_days) : 7;

    const consignment = await prisma.consignment.create({
      data: {
        tenant_id: tenantId,
        number: nextNumber,
        customer_id: customer_id || null,
        customer_name,
        customer_phone: customer_phone || null,
        seller_id: seller_id || null,
        seller_name: sellerName,
        due_days: dueDaysNum,
        due_date: addDays(new Date(), dueDaysNum),
        notes: notes || null,
        items: { create: itemRows },
      },
      include: CONSIGNMENT_INCLUDE,
    });

    // Reserva (debita) o estoque de saída, com rastreio em StockMovement.
    for (const row of itemRows) {
      await decrementProductStock(row.product_id, row.quantity, row.selected_options as Record<string, string> | null);

      await prisma.stockMovement.create({
        data: {
          tenant_id: tenantId,
          product_id: row.product_id,
          quantity: -row.quantity,
          type: "consignment_out",
          reason: `Consignação #${nextNumber}`,
        },
      });
    }

    await logAction(tenantId, consignment.id, "created", { toStatus: consignment.status, actor: getActor(req) });

    emitToTenant(tenantId, "consignment:changed", { consignmentId: consignment.id });
    emitToTenant(tenantId, "stock:changed", { consignmentId: consignment.id });

    res.json(consignment);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha ao criar consignação" });
  }
}

export async function updateConsignment(req: Request, res: Response) {
  try {
    const tenantId = getTenantId(req);
    const id = Number(req.params.id);

    const existing = await prisma.consignment.findFirst({ where: { id, tenant_id: tenantId } });
    if (!existing) return res.status(404).json({ error: "Consignação não encontrada" });
    if (existing.status !== "aberta") return res.status(400).json({ error: "Só é possível editar consignações abertas" });

    const { customer_id, customer_name, customer_phone, seller_id, due_days, notes } = req.body as Record<string, any>;

    const data: Record<string, any> = {};
    if (customer_id !== undefined) data.customer_id = customer_id || null;
    if (customer_name !== undefined) data.customer_name = customer_name;
    if (customer_phone !== undefined) data.customer_phone = customer_phone || null;
    if (notes !== undefined) data.notes = notes || null;

    if (seller_id !== undefined) {
      data.seller_id = seller_id || null;
      if (seller_id) {
        const seller = await prisma.seller.findUnique({ where: { id: seller_id }, select: { name: true } });
        data.seller_name = seller?.name ?? null;
      } else {
        data.seller_name = null;
      }
    }

    if (due_days !== undefined && Number(due_days) > 0) {
      data.due_days = Number(due_days);
      data.due_date = addDays(existing.created_at, Number(due_days));
    }

    // Registra no histórico só o que de fato mudou, com valor anterior → novo.
    const changes: string[] = [];
    if (data.due_date && data.due_date.getTime() !== existing.due_date.getTime()) {
      changes.push(`Prazo alterado de ${existing.due_date.toLocaleDateString("pt-BR")} para ${data.due_date.toLocaleDateString("pt-BR")}`);
    }
    if (data.seller_name !== undefined && data.seller_name !== existing.seller_name) {
      changes.push(`Vendedor alterado de "${existing.seller_name ?? "—"}" para "${data.seller_name ?? "—"}"`);
    }
    if (data.notes !== undefined && data.notes !== existing.notes) {
      changes.push("Observações atualizadas");
    }
    if (data.customer_name !== undefined && data.customer_name !== existing.customer_name) {
      changes.push(`Cliente alterado de "${existing.customer_name}" para "${data.customer_name}"`);
    }

    await prisma.consignment.update({ where: { id }, data });

    if (changes.length > 0) {
      await logAction(tenantId, id, "updated", {
        actor: getActor(req),
        note: changes.join(" · "),
        meta: {
          before: { due_date: existing.due_date, seller_name: existing.seller_name, notes: existing.notes, customer_name: existing.customer_name },
          after: { due_date: data.due_date ?? existing.due_date, seller_name: data.seller_name ?? existing.seller_name, notes: data.notes ?? existing.notes, customer_name: data.customer_name ?? existing.customer_name },
        },
      });
    }

    emitToTenant(tenantId, "consignment:changed", { consignmentId: id });

    const updated = await prisma.consignment.findFirst({ where: { id, tenant_id: tenantId }, include: CONSIGNMENT_INCLUDE });
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha ao atualizar consignação" });
  }
}

export async function addConsignmentItem(req: Request, res: Response) {
  try {
    const tenantId = getTenantId(req);
    const id = Number(req.params.id);
    const { product_id, quantity, selectedOptions } = req.body as {
      product_id: number; quantity?: number; selectedOptions?: Record<string, string> | null;
    };

    const consignment = await prisma.consignment.findFirst({ where: { id, tenant_id: tenantId } });
    if (!consignment) return res.status(404).json({ error: "Consignação não encontrada" });
    if (consignment.status !== "aberta") return res.status(400).json({ error: "Consignação não está aberta" });

    const product = await prisma.product.findFirst({ where: { id: product_id, tenant_id: tenantId } });
    if (!product) return res.status(404).json({ error: "Produto não encontrado" });
    if (product.sale_unit && product.sale_unit !== "unidade") {
      return res.status(400).json({ error: `Produto "${product.name}" é vendido por medida e não pode ser consignado` });
    }

    const qty = Number(quantity) || 1;
    if (product.stock_quantity < qty) {
      return res.status(400).json({ error: `Estoque insuficiente para "${product.name}"` });
    }

    const addedAmount = Number(product.discount_price ?? product.price) * qty;
    const eligibilityError = await checkConsignmentEligibility(tenantId, consignment.customer_id, addedAmount);
    if (eligibilityError) return res.status(eligibilityError.status).json({ error: eligibilityError.error, ...eligibilityError.extra });

    const item = await prisma.consignmentItem.create({
      data: {
        consignment_id: id,
        product_id: product.id,
        name: product.name,
        quantity: qty,
        unit_price: Number(product.discount_price ?? product.price),
        selected_options: selectedOptions ?? undefined,
      },
    });

    await prisma.product.update({ where: { id: product.id }, data: { stock_quantity: { decrement: qty } } });
    await prisma.stockMovement.create({
      data: {
        tenant_id: tenantId,
        product_id: product.id,
        quantity: -qty,
        type: "consignment_out",
        reason: `Consignação #${consignment.number}`,
      },
    });

    await logAction(tenantId, id, "item_added", {
      actor: getActor(req),
      note: `${product.name} x${qty}`,
      meta: { product_id: product.id, quantity: qty },
    });

    emitToTenant(tenantId, "consignment:changed", { consignmentId: id });
    emitToTenant(tenantId, "stock:changed", { consignmentId: id, productId: product.id });

    const updated = await prisma.consignment.findFirst({ where: { id, tenant_id: tenantId }, include: CONSIGNMENT_INCLUDE });
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha ao adicionar item" });
  }
}

export async function removeConsignmentItem(req: Request, res: Response) {
  try {
    const tenantId = getTenantId(req);
    const id = Number(req.params.id);
    const itemId = Number(req.params.itemId);

    const consignment = await prisma.consignment.findFirst({ where: { id, tenant_id: tenantId } });
    if (!consignment) return res.status(404).json({ error: "Consignação não encontrada" });
    if (consignment.status !== "aberta") return res.status(400).json({ error: "Consignação não está aberta" });

    const item = await prisma.consignmentItem.findFirst({ where: { id: itemId, consignment_id: id } });
    if (!item) return res.status(404).json({ error: "Item não encontrado" });
    if (item.resolution !== "pending") return res.status(400).json({ error: "Item já foi resolvido" });

    await returnItemToStock(item);
    await prisma.consignmentItem.delete({ where: { id: itemId } });

    await logAction(tenantId, id, "item_removed", {
      actor: getActor(req),
      note: `${item.name} x${item.quantity}`,
      meta: { product_id: item.product_id, quantity: item.quantity },
    });

    emitToTenant(tenantId, "consignment:changed", { consignmentId: id });
    emitToTenant(tenantId, "stock:changed", { consignmentId: id, productId: item.product_id });

    const updated = await prisma.consignment.findFirst({ where: { id, tenant_id: tenantId }, include: CONSIGNMENT_INCLUDE });
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha ao remover item" });
  }
}

// ── Resolução (tela única: marcar ficou/voltou + faturar) ──────────────────

export async function resolveConsignment(req: Request, res: Response) {
  try {
    const tenantId = getTenantId(req);
    const id = Number(req.params.id);

    const consignment = await prisma.consignment.findFirst({
      where: { id, tenant_id: tenantId },
      include: { items: true },
    });
    if (!consignment) return res.status(404).json({ error: "Consignação não encontrada" });
    if (consignment.status !== "aberta") return res.status(400).json({ error: "Consignação não está aberta" });

    const {
      resolutions,
      payment_method,
      seller_id,
      discount,
      surcharge,
      passFeeToCustomer,
      passFeeByMethod,
      cashSessionId,
    } = req.body as {
      resolutions: Array<{ item_id: number; resolution: "kept" | "returned" }>;
      payment_method?: string;
      seller_id?: number;
      discount?: number;
      surcharge?: number;
      passFeeToCustomer?: boolean;
      passFeeByMethod?: Record<string, boolean>;
      cashSessionId?: number | null;
    };

    if (!Array.isArray(resolutions) || resolutions.length === 0) {
      return res.status(400).json({ error: "Informe a resolução de ao menos um item" });
    }

    const resolutionMap = new Map(resolutions.map((r) => [r.item_id, r.resolution]));
    const pendingItems = consignment.items.filter((it) => it.resolution === "pending");
    const pendingIds = new Set(pendingItems.map((it) => it.id));

    // Aceita resolver só um SUBCONJUNTO dos itens pendentes (conversão parcial) — não exige
    // mais que todos venham no payload. Só valida que o que veio realmente está pendente.
    for (const itemId of resolutionMap.keys()) {
      if (!pendingIds.has(itemId)) {
        return res.status(400).json({ error: `Item ${itemId} não está pendente nesta sacola` });
      }
    }

    const returnedItems = pendingItems.filter((it) => resolutionMap.get(it.id) === "returned");
    const keptItems = pendingItems.filter((it) => resolutionMap.get(it.id) === "kept");

    // Devolve ao estoque os itens que voltaram
    for (const item of returnedItems) {
      await returnItemToStock(item);
      await prisma.consignmentItem.update({
        where: { id: item.id },
        data: { resolution: "returned", resolved_at: new Date() },
      });
    }

    let invoicedOrderId: number | null = null;

    if (keptItems.length > 0) {
      const totalAmount = keptItems.reduce((sum, it) => sum + Number(it.unit_price) * it.quantity, 0);

      try {
        const result = await finalizeSaleOrderForConsignment({
          tenantId,
          items: keptItems.map((it) => ({
            id: it.product_id,
            quantity: it.quantity,
            price: Number(it.unit_price),
            selectedOptions: it.selected_options as Record<string, string> | null,
          })),
          customerName: consignment.customer_name,
          customerId: consignment.customer_id ?? undefined,
          totalAmount: Math.round((totalAmount - (discount ?? 0) + (surcharge ?? 0)) * 100) / 100,
          paymentMethod: payment_method,
          discount,
          surcharge,
          sellerId: seller_id ?? consignment.seller_id ?? undefined,
          passFeeToCustomer,
          passFeeByMethod,
          descriptionPrefix: `Consignação #${consignment.number} — Venda`,
          cashSessionId,
        });
        invoicedOrderId = result.orderId;
      } catch (err) {
        if (err instanceof SaleError) {
          return res.status(err.status).json({ error: err.message, ...err.extra });
        }
        throw err;
      }

      for (const item of keptItems) {
        await prisma.consignmentItem.update({
          where: { id: item.id },
          data: { resolution: "kept", resolved_at: new Date() },
        });
      }
    }

    const allReturned = keptItems.length === 0;
    // Só fecha a sacola se não sobrar NENHUM item pendente — se o pedido resolveu só parte,
    // ela continua "aberta" (aparece como "parcial" via derived_status) para o restante.
    const stillPending = pendingItems.some((it) => !resolutionMap.has(it.id));
    const closingNow = !stillPending;
    const newStatus = closingNow ? "fechada" : "aberta";

    await prisma.consignment.update({
      where: { id },
      data: closingNow
        ? {
            status: newStatus,
            invoiced_order_id: invoicedOrderId,
            invoiced_at: invoicedOrderId ? new Date() : null,
            closed_at: new Date(),
          }
        : {},
    });

    await logAction(tenantId, id, closingNow ? "resolved" : "partial_resolved", {
      fromStatus: consignment.status,
      toStatus: newStatus,
      actor: getActor(req),
      meta: {
        kept: keptItems.map((i) => i.id),
        returned: returnedItems.map((i) => i.id),
        order_id: invoicedOrderId,
        all_returned: allReturned,
        still_pending: stillPending,
      },
    });

    emitToTenant(tenantId, "consignment:changed", { consignmentId: id });
    emitToTenant(tenantId, "stock:changed", { consignmentId: id });
    if (invoicedOrderId) {
      emitToTenant(tenantId, "order:created", { orderId: invoicedOrderId, consignmentId: id });
      emitToTenant(tenantId, "finance:changed", { orderId: invoicedOrderId });
    }

    const updated = await prisma.consignment.findFirst({ where: { id, tenant_id: tenantId }, include: CONSIGNMENT_INCLUDE });
    res.json({ ...updated, orderId: invoicedOrderId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha ao resolver consignação" });
  }
}

export async function cancelConsignment(req: Request, res: Response) {
  try {
    const tenantId = getTenantId(req);
    const id = Number(req.params.id);
    const { cancel_reason } = req.body as { cancel_reason?: string };

    const consignment = await prisma.consignment.findFirst({
      where: { id, tenant_id: tenantId },
      include: { items: true },
    });
    if (!consignment) return res.status(404).json({ error: "Consignação não encontrada" });
    if (consignment.status !== "aberta") return res.status(400).json({ error: "Consignação não está aberta" });

    const pendingItems = consignment.items.filter((it) => it.resolution === "pending");
    for (const item of pendingItems) {
      await returnItemToStock(item);
      await prisma.consignmentItem.update({
        where: { id: item.id },
        data: { resolution: "returned", resolved_at: new Date() },
      });
    }

    await prisma.consignment.update({
      where: { id },
      data: {
        status: "cancelada",
        cancelled_by: getActor(req),
        cancel_reason: cancel_reason || null,
        cancelled_at: new Date(),
        closed_at: new Date(),
      },
    });

    await logAction(tenantId, id, "cancelled", {
      fromStatus: consignment.status,
      toStatus: "cancelada",
      actor: getActor(req),
      note: cancel_reason,
      // guarda quais itens foram devolvidos POR ESTE cancelamento — necessário pra reabertura
      // saber exatamente o que restaurar, já que outros itens podem já ter sido resolvidos antes.
      meta: { returned_item_ids: pendingItems.map((it) => it.id) },
    });

    emitToTenant(tenantId, "consignment:changed", { consignmentId: id });
    emitToTenant(tenantId, "stock:changed", { consignmentId: id });

    const updated = await prisma.consignment.findFirst({ where: { id, tenant_id: tenantId }, include: CONSIGNMENT_INCLUDE });
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha ao cancelar consignação" });
  }
}

// Reabre uma sacola CANCELADA (não fechada — uma sacola fechada já gerou venda/pagamento
// reais e desfazer isso é estorno financeiro, fora do escopo desta ação). Restaura ao
// estoque consignado só os itens que essa cancelação específica devolveu.
export async function reopenConsignment(req: Request, res: Response) {
  try {
    const authReq = req as AuthenticatedRequest;
    if (authReq.user.role !== "admin" && !authReq.user.superAdmin) {
      return res.status(403).json({ error: "Somente administradores podem reabrir uma consignação" });
    }

    const tenantId = getTenantId(req);
    const id = Number(req.params.id);
    const { reason } = req.body as { reason?: string };
    if (!reason || !reason.trim()) {
      return res.status(400).json({ error: "Informe o motivo da reabertura" });
    }

    const consignment = await prisma.consignment.findFirst({
      where: { id, tenant_id: tenantId },
      include: { items: true },
    });
    if (!consignment) return res.status(404).json({ error: "Consignação não encontrada" });
    if (consignment.status !== "cancelada") {
      return res.status(400).json({ error: "Só é possível reabrir consignações canceladas" });
    }

    const lastCancelAction = await prisma.consignmentAction.findFirst({
      where: { consignment_id: id, action: "cancelled" },
      orderBy: { created_at: "desc" },
    });
    const returnedItemIds: number[] = (lastCancelAction?.meta as any)?.returned_item_ids ?? [];
    const itemsToRestore = consignment.items.filter((it) => returnedItemIds.includes(it.id));

    for (const item of itemsToRestore) {
      const product = await prisma.product.findFirst({ where: { id: item.product_id, tenant_id: tenantId } });
      if (!product || product.stock_quantity < item.quantity) {
        return res.status(400).json({ error: `Estoque insuficiente para reabrir "${item.name}" — só ${product?.stock_quantity ?? 0} disponível(is)` });
      }
    }

    for (const item of itemsToRestore) {
      await decrementProductStock(item.product_id, item.quantity, item.selected_options as Record<string, string> | null);
      await prisma.stockMovement.create({
        data: {
          tenant_id: tenantId,
          product_id: item.product_id,
          quantity: -item.quantity,
          type: "consignment_out",
          reason: `Reabertura da consignação #${consignment.number}`,
        },
      });
      await prisma.consignmentItem.update({
        where: { id: item.id },
        data: { resolution: "pending", resolved_at: null },
      });
    }

    await prisma.consignment.update({
      where: { id },
      data: {
        status: "aberta",
        cancelled_by: null,
        cancel_reason: null,
        cancelled_at: null,
        closed_at: null,
      },
    });

    await logAction(tenantId, id, "reopened", {
      fromStatus: "cancelada",
      toStatus: "aberta",
      actor: getActor(req),
      note: reason,
      meta: { restored_item_ids: itemsToRestore.map((it) => it.id) },
    });

    emitToTenant(tenantId, "consignment:changed", { consignmentId: id });
    emitToTenant(tenantId, "stock:changed", { consignmentId: id });

    const updated = await prisma.consignment.findFirst({ where: { id, tenant_id: tenantId }, include: CONSIGNMENT_INCLUDE });
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha ao reabrir consignação" });
  }
}
