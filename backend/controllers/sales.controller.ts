import type { Request, Response } from "express";

import { prisma } from "../config/prisma";
import type { AuthenticatedRequest } from "../types/auth";

function getTenantId(req: Request) {
  return (req as AuthenticatedRequest).user.tenantId;
}

interface SaleItemInput {
  id: number;
  quantity: number;
  price: number;
}

export async function createSale(req: Request, res: Response) {
  const { items, customerName, totalAmount } = req.body as {
    items: SaleItemInput[];
    customerName?: string;
    totalAmount: number;
  };

  try {
    const tenantId = getTenantId(req);
    const order = await prisma.order.create({
      data: {
        tenant_id: tenantId,
        customer_name: customerName || "Balcão",
        total_amount: totalAmount,
        status: "completed",
        payment_method: "money",
        items: {
          create: items.map((item) => ({
            product_id: item.id,
            quantity: item.quantity,
            unit_price: item.price,
          })),
        },
      },
    });

    for (const item of items) {
      await prisma.product.update({
        where: { id: item.id },
        data: {
          stock_quantity: {
            decrement: item.quantity,
          },
        },
      });
    }

    await prisma.finance.create({
      data: {
        tenant_id: tenantId,
        type: "income",
        description: `Venda PDV #${order.id}`,
        amount: totalAmount,
        date: new Date(),
      },
    });

    res.json({ success: true, orderId: order.id });
  } catch {
    res.status(500).json({ error: "Sale failed" });
  }
}
