import type { Request, Response } from "express";

import { prisma } from "../config/prisma";
import type { AuthenticatedRequest } from "../types/auth";
import { finalizeSaleOrderForConsignment, SaleError } from "./sales.controller";

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
  await prisma.product.update({
    where: { id: item.product_id },
    data: { stock_quantity: { increment: item.quantity } },
  });

  const opts = item.selected_options as Record<string, string> | null;
  if (opts && Object.keys(opts).length > 0) {
    const product = await prisma.product.findUnique({
      where: { id: item.product_id },
      select: { skus: true, variations: true },
    });
    if (product?.skus) {
      type SkuEntry = { combo: Record<string, string>; stock: number };
      const skus = product.skus as SkuEntry[];
      const updated = skus.map((sku) => {
        const matches = Object.entries(opts).every(([k, v]) => sku.combo[k] === v);
        return matches ? { ...sku, stock: sku.stock + item.quantity } : sku;
      });
      await prisma.product.update({ where: { id: item.product_id }, data: { skus: updated } });
    } else if (product?.variations) {
      type LegacyVariation = { name: string; options: { value: string; stock: number }[] };
      const variations = product.variations as LegacyVariation[];
      const updated = variations.map((v) => ({
        ...v,
        options: v.options.map((o) => {
          const matches = opts[v.name] === o.value;
          return matches ? { ...o, stock: o.stock + item.quantity } : o;
        }),
      }));
      await prisma.product.update({ where: { id: item.product_id }, data: { variations: updated } });
    }
  }

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
    res.json(consignments);
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
    res.json({ ...consignment, overdue: isOverdue(consignment) });
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
      await prisma.product.update({
        where: { id: row.product_id },
        data: { stock_quantity: { decrement: row.quantity } },
      });

      if (row.selected_options && Object.keys(row.selected_options).length > 0) {
        const product = await prisma.product.findUnique({
          where: { id: row.product_id },
          select: { skus: true, variations: true },
        });
        if (product?.skus) {
          type SkuEntry = { combo: Record<string, string>; stock: number };
          const skus = product.skus as SkuEntry[];
          const opts = row.selected_options as Record<string, string>;
          const updated = skus.map((sku) => {
            const matches = Object.entries(opts).every(([k, v]) => sku.combo[k] === v);
            return matches ? { ...sku, stock: Math.max(0, sku.stock - row.quantity) } : sku;
          });
          await prisma.product.update({ where: { id: row.product_id }, data: { skus: updated } });
        } else if (product?.variations) {
          type LegacyVariation = { name: string; options: { value: string; stock: number }[] };
          const variations = product.variations as LegacyVariation[];
          const opts = row.selected_options as Record<string, string>;
          const updated = variations.map((v) => ({
            ...v,
            options: v.options.map((o) => {
              const matches = opts[v.name] === o.value;
              return matches ? { ...o, stock: Math.max(0, o.stock - row.quantity) } : o;
            }),
          }));
          await prisma.product.update({ where: { id: row.product_id }, data: { variations: updated } });
        }
      }

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

    await prisma.consignment.update({ where: { id }, data });

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
    } = req.body as {
      resolutions: Array<{ item_id: number; resolution: "kept" | "returned" }>;
      payment_method?: string;
      seller_id?: number;
      discount?: number;
      surcharge?: number;
      passFeeToCustomer?: boolean;
      passFeeByMethod?: Record<string, boolean>;
    };

    if (!Array.isArray(resolutions) || resolutions.length === 0) {
      return res.status(400).json({ error: "Informe a resolução de ao menos um item" });
    }

    const resolutionMap = new Map(resolutions.map((r) => [r.item_id, r.resolution]));
    const pendingItems = consignment.items.filter((it) => it.resolution === "pending");

    for (const item of pendingItems) {
      if (!resolutionMap.has(item.id)) {
        return res.status(400).json({ error: `Item ${item.id} não teve resolução informada` });
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
    const newStatus = "fechada";

    await prisma.consignment.update({
      where: { id },
      data: {
        status: newStatus,
        invoiced_order_id: invoicedOrderId,
        invoiced_at: invoicedOrderId ? new Date() : null,
        closed_at: new Date(),
      },
    });

    await logAction(tenantId, id, "resolved", {
      fromStatus: consignment.status,
      toStatus: newStatus,
      actor: getActor(req),
      meta: {
        kept: keptItems.map((i) => i.id),
        returned: returnedItems.map((i) => i.id),
        order_id: invoicedOrderId,
        all_returned: allReturned,
      },
    });

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
      fromStatus: consignment.status, toStatus: "cancelada", actor: getActor(req), note: cancel_reason,
    });

    const updated = await prisma.consignment.findFirst({ where: { id, tenant_id: tenantId }, include: CONSIGNMENT_INCLUDE });
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha ao cancelar consignação" });
  }
}
