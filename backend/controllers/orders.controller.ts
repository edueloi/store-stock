import type { Request, Response } from "express";

import { prisma } from "../config/prisma";
import type { AuthenticatedRequest } from "../types/auth";
import { localDateString } from "../utils/date";
import { cancelarNfce } from "../services/nfce/cancelar";

function getTenantId(req: Request) {
  return (req as AuthenticatedRequest).user.tenantId;
}

function getActor(req: Request): string {
  const u = (req as AuthenticatedRequest).user;
  return (u as any).name ?? (u as any).email ?? "Sistema";
}

// ── helpers ──────────────────────────────────────────────────────────────────

async function logAction(
  tenantId: number,
  orderId: number,
  action: string,
  actor?: string,
  note?: string,
  meta?: object,
) {
  await (prisma as any).orderAction.create({
    data: { tenant_id: tenantId, order_id: orderId, action, actor: actor ?? null, note: note ?? null, meta: meta ?? null },
  });
}

// Reverts stock for all items of a completed order (cancel or delete).
// Also handles SKU/variation stock for items that carried selectedOptions in meta.
async function revertStock(items: { product_id: number; quantity: number; selected_options?: any }[]) {
  for (const item of items) {
    await prisma.product.update({
      where: { id: item.product_id },
      data: { stock_quantity: { increment: item.quantity } },
    });

    // Revert SKU-level stock if the item had specific variation options stored in meta
    const opts = item.selected_options as Record<string, string> | null | undefined;
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
  }
}

// ── Controllers ───────────────────────────────────────────────────────────────

export async function listOrders(req: Request, res: Response) {
  try {
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    const orders = await prisma.order.findMany({
      where: { tenant_id: getTenantId(req) },
      orderBy: { created_at: "desc" },
      take: limit,
      include: {
        items: { include: { product: { select: { name: true, image_url: true } } } },
        services: true,
      },
    });

    res.json(orders.map((order) => ({
      ...order,
      items: order.items.map((item) => ({
        id: item.id,
        product_name: item.product.name,
        image_url: item.product.image_url,
        quantity: item.quantity,
        unit_price: item.unit_price,
      })),
      services: order.services.map((svc) => ({
        id: svc.id, service_id: svc.service_id, name: svc.name,
        unit_price: svc.unit_price, quantity: svc.quantity,
      })),
    })));
  } catch {
    res.status(500).json({ error: "Failed to fetch orders" });
  }
}

export async function getOrderById(req: Request, res: Response) {
  try {
    const order = await prisma.order.findFirst({
      where: { id: Number(req.params.id), tenant_id: getTenantId(req) },
      include: {
        items: { include: { product: { select: { name: true, image_url: true } } } },
        services: true,
      },
    });

    if (!order) { res.status(404).json({ error: "Order not found" }); return; }

    res.json({
      ...order,
      items: order.items.map((item) => ({
        ...item,
        product_name: item.product.name,
        image_url: item.product.image_url ?? null,
      })),
      services: order.services.map((svc) => ({
        id: svc.id, service_id: svc.service_id, name: svc.name,
        unit_price: svc.unit_price, quantity: svc.quantity,
      })),
    });
  } catch {
    res.status(500).json({ error: "Failed to fetch order details" });
  }
}

export async function getOrderActions(req: Request, res: Response) {
  try {
    const tenantId = getTenantId(req);
    const orderId  = Number(req.params.id);

    const order = await prisma.order.findFirst({ where: { id: orderId, tenant_id: tenantId }, select: { id: true } });
    if (!order) { res.status(404).json({ error: "Pedido não encontrado" }); return; }

    const actions = await (prisma as any).orderAction.findMany({
      where: { order_id: orderId, tenant_id: tenantId },
      orderBy: { created_at: "desc" },
    });

    res.json(actions);
  } catch {
    res.status(500).json({ error: "Falha ao buscar histórico" });
  }
}

export async function updateOrderStatus(req: Request, res: Response) {
  try {
    const tenantId = getTenantId(req);
    const orderId  = Number(req.params.id);
    const newStatus: string = req.body.status;

    const order = await prisma.order.findFirst({ where: { id: orderId, tenant_id: tenantId } });
    if (!order) { res.status(404).json({ error: "Order not found" }); return; }

    await prisma.order.update({ where: { id: orderId }, data: { status: newStatus } });

    // Log the status change
    await logAction(tenantId, orderId, "status_change", getActor(req), `Status alterado: ${order.status} → ${newStatus}`);

    // When a pending order is manually marked as completed, create the finance entry
    if (newStatus === "completed" && order.status !== "completed") {
      const total    = Number(order.total_amount);
      const fee      = Number(order.fee_amount ?? 0);
      const discount = Number(order.discount_amount ?? 0);
      const gross    = Number(order.gross_amount ?? total);
      const net      = Math.round((total - fee) * 100) / 100;

      const pm = order.payment_method ?? "money";
      const methodLabel: Record<string, string> = { money: "Dinheiro", pix: "PIX", debit: "Débito", credit: "Crédito" };
      const methodSummary = pm.split("|").map(seg => {
        const method = seg.split(":")[0].split("-")[0];
        return methodLabel[method] ?? method;
      }).join(" + ");
      const discountNote = discount > 0 ? ` (desc. R$ ${discount.toFixed(2)})` : "";

      await prisma.finance.create({
        data: {
          tenant_id: tenantId, type: "income",
          description: `Venda PDV #${orderId} — ${methodSummary}${discountNote}`,
          amount: net, gross_amount: gross,
          fee_amount: fee > 0 ? fee : null,
          discount_amount: discount > 0 ? discount : null,
          payment_method: pm,
          date: localDateString(),
        },
      });

      await logAction(tenantId, orderId, "finance_created", getActor(req), `Entrada financeira criada: R$ ${net.toFixed(2)}`);
    }

    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to update order status" });
  }
}

export async function cancelOrder(req: Request, res: Response) {
  try {
    const tenantId  = getTenantId(req);
    const orderId   = Number(req.params.id);
    const { cancel_reason, cancelled_by } = req.body as { cancel_reason?: string; cancelled_by?: string };

    const order = await prisma.order.findFirst({
      where: { id: orderId, tenant_id: tenantId },
      include: { items: true },
    });

    if (!order) { res.status(404).json({ error: "Pedido não encontrado" }); return; }
    if (order.status === "cancelled") { res.status(400).json({ error: "Pedido já cancelado" }); return; }

    // Mark as cancelled
    await prisma.order.update({
      where: { id: orderId },
      data: {
        status:        "cancelled",
        cancelled_by:  cancelled_by || "Sistema",
        cancel_reason: cancel_reason || null,
        cancelled_at:  new Date(),
      },
    });

    // Revert stock (total + SKU/variation level)
    const itemsWithOptions = order.items.map((item) => ({
      product_id: item.product_id,
      quantity:   item.quantity,
      selected_options: (item as any).selected_options ?? null,
    }));
    await revertStock(itemsWithOptions);

    // Build stock revert summary for the log
    const stockNote = order.items.map(i => `#${i.product_id} +${i.quantity}`).join(", ");

    // Remove the original finance entry linked to this order (instead of creating a counter-entry)
    // This cleanly removes the sale from cash flow and the overview, as if it never happened.
    const deleted = await (prisma.finance as any).deleteMany({
      where: { tenant_id: tenantId, order_id: orderId },
    });

    // Fallback: if no order_id link found, try matching by description (legacy entries)
    if (deleted.count === 0) {
      await prisma.finance.deleteMany({
        where: {
          tenant_id:   tenantId,
          description: { contains: `#${orderId}` },
          type:        "income",
        },
      });
    }

    // Log the cancellation action
    await logAction(
      tenantId, orderId, "cancelled",
      cancelled_by || getActor(req),
      cancel_reason || undefined,
      { stock_reverted: stockNote, finance_entries_removed: deleted.count },
    );

    // Se houver NFC-e autorizada para este pedido, tenta cancelar o evento fiscal.
    // Não bloqueia o cancelamento do pedido em si — estoque/financeiro já revertidos acima
    // independentemente do resultado fiscal, que fica registrado no NfceInvoice.
    let nfceCancel: { attempted: boolean; success?: boolean; error?: string } = { attempted: false };
    const invoice = await prisma.nfceInvoice.findUnique({ where: { order_id: orderId } });
    if (invoice && invoice.status === "authorized") {
      nfceCancel.attempted = true;
      const result = await cancelarNfce(orderId, cancel_reason || "Cancelamento do pedido pelo operador");
      nfceCancel.success = result.success;
      if (!result.success) nfceCancel.error = result.error;
    }

    res.json({ success: true, nfce: nfceCancel });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha ao cancelar pedido" });
  }
}

export async function deleteOrder(req: Request, res: Response) {
  try {
    const tenantId = getTenantId(req);
    const orderId  = Number(req.params.id);
    const shouldRevertStock   = req.body?.revertStock   !== false;
    const shouldRevertFinance = req.body?.revertFinance !== false;

    const order = await prisma.order.findFirst({
      where: { id: orderId, tenant_id: tenantId },
      include: { items: true },
    });

    if (!order) { res.status(404).json({ error: "Pedido não encontrado" }); return; }

    if (order.status === "completed") {
      if (shouldRevertStock) {
        const itemsWithOptions = order.items.map((item) => ({
          product_id: item.product_id,
          quantity:   item.quantity,
          selected_options: (item as any).selected_options ?? null,
        }));
        await revertStock(itemsWithOptions);
      }

      if (shouldRevertFinance) {
        const deleted = await (prisma.finance as any).deleteMany({
          where: { tenant_id: tenantId, order_id: orderId },
        });
        if (deleted.count === 0) {
          await prisma.finance.deleteMany({
            where: { tenant_id: tenantId, description: { contains: `#${orderId}` }, type: "income" },
          });
        }
      }
    }

    await prisma.orderItem.deleteMany({ where: { order_id: orderId } });
    await prisma.orderService.deleteMany({ where: { order_id: orderId } });
    await prisma.order.delete({ where: { id: orderId } });

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha ao deletar pedido" });
  }
}

export async function bulkDeleteOrders(req: Request, res: Response) {
  try {
    const tenantId = getTenantId(req);
    const { ids } = req.body as { ids: number[] };
    const shouldRevertStock   = req.body?.revertStock   !== false;
    const shouldRevertFinance = req.body?.revertFinance !== false;

    if (!Array.isArray(ids) || ids.length === 0) {
      res.status(400).json({ error: "IDs inválidos" }); return;
    }

    const orders = await prisma.order.findMany({
      where: { id: { in: ids }, tenant_id: tenantId },
      include: { items: true },
    });

    if (orders.length === 0) { res.status(404).json({ error: "Nenhum pedido encontrado" }); return; }

    const validIds = orders.map((o) => o.id);

    for (const order of orders) {
      if (order.status === "completed") {
        if (shouldRevertStock) {
          const itemsWithOptions = order.items.map((item) => ({
            product_id: item.product_id,
            quantity:   item.quantity,
            selected_options: (item as any).selected_options ?? null,
          }));
          await revertStock(itemsWithOptions);
        }

        if (shouldRevertFinance) {
          const deleted = await (prisma.finance as any).deleteMany({
            where: { tenant_id: tenantId, order_id: order.id },
          });
          if (deleted.count === 0) {
            await prisma.finance.deleteMany({
              where: { tenant_id: tenantId, description: { contains: `#${order.id}` }, type: "income" },
            });
          }
        }
      }
    }

    await prisma.orderItem.deleteMany({ where: { order_id: { in: validIds } } });
    await prisma.orderService.deleteMany({ where: { order_id: { in: validIds } } });
    await prisma.order.deleteMany({ where: { id: { in: validIds } } });

    res.json({ success: true, deleted: validIds.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha ao deletar pedidos" });
  }
}
