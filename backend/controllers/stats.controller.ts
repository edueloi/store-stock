import type { Request, Response } from "express";

import { prisma } from "../config/prisma";
import type { AuthenticatedRequest } from "../types/auth";

function getTenantId(req: Request) {
  return (req as AuthenticatedRequest).user.tenantId;
}

export async function getTopSellingProducts(req: Request, res: Response) {
  try {
    const topProducts = await prisma.orderItem.groupBy({
      by: ["product_id"],
      where: {
        order: {
          tenant_id: getTenantId(req),
          status: "completed",
        },
      },
      _sum: { quantity: true },
      orderBy: {
        _sum: { quantity: "desc" },
      },
      take: 5,
    });

    const productsWithNames = await Promise.all(
      topProducts.map(async (topProduct) => {
        const product = await prisma.product.findUnique({
          where: { id: topProduct.product_id },
        });

        return {
          name: product?.name,
          total_sold: topProduct._sum.quantity,
        };
      })
    );

    res.json(productsWithNames);
  } catch {
    res.status(500).json({ error: "Failed to fetch top selling products" });
  }
}

export async function getDashboardStats(req: Request, res: Response) {
  const tenantId = getTenantId(req);

  try {
    const [totalSales, totalExpenses, products] = await Promise.all([
      prisma.order.aggregate({
        where: { tenant_id: tenantId, status: "completed" },
        _sum: { total_amount: true },
      }),
      prisma.finance.aggregate({
        where: { tenant_id: tenantId, type: "expense" },
        _sum: { amount: true },
      }),
      prisma.product.findMany({
        where: { tenant_id: tenantId },
        select: { stock_quantity: true, cost_price: true },
      }),
    ]);

    const stockValue = products.reduce(
      (accumulator, product) =>
        accumulator + product.stock_quantity * Number(product.cost_price),
      0
    );

    const salesOverTime = await prisma.$queryRaw<{ date: string; total: number }[]>`
      SELECT DATE(created_at) as date, SUM(total_amount) as total
      FROM orders
      WHERE tenant_id = ${tenantId} AND status = 'completed'
      GROUP BY DATE(created_at)
      ORDER BY date DESC
      LIMIT 7
    `;

    const revenue = Number(totalSales._sum.total_amount) || 0;
    const expenses = Number(totalExpenses._sum.amount) || 0;

    res.json({
      summary: {
        revenue,
        expenses,
        stockValue,
        profit: revenue - expenses,
      },
      salesOverTime,
    });
  } catch {
    res.status(500).json({ error: "Failed to fetch stats" });
  }
}
