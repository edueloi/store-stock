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
    const [totalGross, totalIncome, products, cogsResult] = await Promise.all([
      prisma.order.aggregate({
        where: { tenant_id: tenantId, status: "completed" },
        _sum: { total_amount: true },
      }),
      prisma.finance.aggregate({
        where: { tenant_id: tenantId, type: "income" },
        _sum: { amount: true },
      }),
      prisma.product.findMany({
        where: { tenant_id: tenantId },
        select: { stock_quantity: true, cost_price: true },
      }),
      prisma.$queryRaw<{ cogs: number }[]>`
        SELECT SUM(oi.quantity * p.cost_price) as cogs
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
        JOIN products p ON p.id = oi.product_id
        WHERE o.tenant_id = ${tenantId} AND o.status = 'completed'
      `,
    ]);

    const stockValue = products.reduce(
      (accumulator, product) =>
        accumulator + product.stock_quantity * Number(product.cost_price),
      0
    );

    const salesOverTime = await prisma.$queryRaw<{ date: string; total: number }[]>`
      SELECT DATE(date) as date, SUM(amount) as total
      FROM finance
      WHERE tenant_id = ${tenantId} AND type = 'income'
      GROUP BY DATE(date)
      ORDER BY date DESC
      LIMIT 7
    `;

    const grossRevenue = Number(totalGross._sum.total_amount) || 0;
    const netRevenue   = Number(totalIncome._sum.amount) || 0;
    const cogs         = Number(cogsResult[0]?.cogs) || 0;

    res.json({
      summary: {
        grossRevenue,
        netRevenue,
        cogs,
        stockValue,
        profit: netRevenue - cogs,
      },
      salesOverTime,
    });
  } catch {
    res.status(500).json({ error: "Failed to fetch stats" });
  }
}
