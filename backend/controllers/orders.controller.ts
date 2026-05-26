import type { Request, Response } from "express";

import { prisma } from "../config/prisma";
import type { AuthenticatedRequest } from "../types/auth";

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
    });
  } catch {
    res.status(500).json({ error: "Failed to fetch order details" });
  }
}

export async function updateOrderStatus(req: Request, res: Response) {
  try {
    await prisma.order.updateMany({
      where: {
        id: Number(req.params.id),
        tenant_id: getTenantId(req),
      },
      data: {
        status: req.body.status,
      },
    });

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
        date:        new Date(),
        category:    "Estorno",
      },
    });

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha ao cancelar pedido" });
  }
}
