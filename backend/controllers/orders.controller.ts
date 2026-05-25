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
