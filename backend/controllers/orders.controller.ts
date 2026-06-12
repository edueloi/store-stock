import type { Request, Response } from "express";

import { prisma } from "../config/prisma";
import type { AuthenticatedRequest } from "../types/auth";
import { localDateString } from "../utils/date";

function getTenantId(req: Request) {
  return (req as AuthenticatedRequest).user.tenantId;
}

export async function listOrders(req: Request, res: Response) {
  try {
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    const orders = await prisma.order.findMany({
      where: { tenant_id: getTenantId(req) },
      orderBy: { created_at: "desc" },
      take: limit,
      include: {
        items: {
          include: {
            product: {
              select: { name: true, image_url: true },
            },
          },
        },
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
        id: svc.id,
        service_id: svc.service_id,
        name: svc.name,
        unit_price: svc.unit_price,
        quantity: svc.quantity,
      })),
    })));
  } catch {
    res.status(500).json({ error: "Failed to fetch orders" });
  }
}

export async function getOrderById(req: Request, res: Response) {
  try {
    const order = await prisma.order.findFirst({
      where: {
        id: Number(req.params.id),
        tenant_id: getTenantId(req),
      },
      include: {
        items: {
          include: {
            product: {
              select: { name: true },
            },
          },
        },
        services: true,
      },
    });

    if (!order) {
      res.status(404).json({ error: "Order not found" });
      return;
    }

    res.json({
      ...order,
      items: order.items.map((item) => ({
        ...item,
        product_name: item.product.name,
      })),
      services: order.services.map((svc) => ({
        id: svc.id,
        service_id: svc.service_id,
        name: svc.name,
        unit_price: svc.unit_price,
        quantity: svc.quantity,
      })),
    });
  } catch {
    res.status(500).json({ error: "Failed to fetch order details" });
  }
}

export async function updateOrderStatus(req: Request, res: Response) {
  try {
    const tenantId = getTenantId(req);
    const orderId  = Number(req.params.id);
    const newStatus: string = req.body.status;

    const order = await prisma.order.findFirst({
      where: { id: orderId, tenant_id: tenantId },
    });

    if (!order) {
      res.status(404).json({ error: "Order not found" });
      return;
    }

    await prisma.order.update({
      where: { id: orderId },
      data: { status: newStatus },
    });

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
          tenant_id:       tenantId,
          type:            "income",
          description:     `Venda PDV #${orderId} — ${methodSummary}${discountNote}`,
          amount:          net,
          gross_amount:    gross,
          fee_amount:      fee > 0 ? fee : null,
          discount_amount: discount > 0 ? discount : null,
          payment_method:  pm,
          date:            localDateString(),
        },
      });
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
    const { cancel_reason, cancelled_by } = req.body as {
      cancel_reason?: string;
      cancelled_by?: string;
    };

    // Load order with items
    const order = await prisma.order.findFirst({
      where: { id: orderId, tenant_id: tenantId },
      include: { items: true },
    });

    if (!order) {
      res.status(404).json({ error: "Pedido não encontrado" });
      return;
    }

    if (order.status === "cancelled") {
      res.status(400).json({ error: "Pedido já cancelado" });
      return;
    }

    // Mark order as cancelled
    await prisma.order.update({
      where: { id: orderId },
      data: {
        status:       "cancelled",
        cancelled_by: cancelled_by || "Sistema",
        cancel_reason: cancel_reason || null,
        cancelled_at: new Date(),
      },
    });

    // Revert stock for each item
    for (const item of order.items) {
      await prisma.product.update({
        where: { id: item.product_id },
        data: { stock_quantity: { increment: item.quantity } },
      });
    }

    // Create a finance reversal (estorno) entry
    const net = Number(order.total_amount);
    await prisma.finance.create({
      data: {
        tenant_id:   tenantId,
        type:        "expense",
        description: `Estorno Pedido #${orderId}${cancel_reason ? ` — ${cancel_reason}` : ""}${cancelled_by ? ` (por: ${cancelled_by})` : ""}`,
        amount:      net,
        date:        localDateString(),
        category:    "Estorno",
      },
    });

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha ao cancelar pedido" });
  }
}

export async function deleteOrder(req: Request, res: Response) {
  try {
    const tenantId = getTenantId(req);
    const orderId  = Number(req.params.id);

    const order = await prisma.order.findFirst({
      where: { id: orderId, tenant_id: tenantId },
    });

    if (!order) {
      res.status(404).json({ error: "Pedido não encontrado" });
      return;
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

    if (!Array.isArray(ids) || ids.length === 0) {
      res.status(400).json({ error: "IDs inválidos" });
      return;
    }

    // Ensure all orders belong to this tenant
    const orders = await prisma.order.findMany({
      where: { id: { in: ids }, tenant_id: tenantId },
      select: { id: true },
    });

    const validIds = orders.map((o) => o.id);

    if (validIds.length === 0) {
      res.status(404).json({ error: "Nenhum pedido encontrado" });
      return;
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
