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
      // Bruto = soma de gross_amount das entradas do finance (igual ao card "Bruto" do Fluxo de Caixa)
      prisma.finance.aggregate({
        where: { tenant_id: tenantId, type: "income" },
        _sum: { gross_amount: true, amount: true },
      }),
      // Líquido = soma de amount das entradas do finance (igual ao "Total Entradas" do Fluxo de Caixa)
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

    // Somas por dia dos últimos 7 dias (inclusive hoje). Montamos a série
    // completa no JS para que dias SEM venda apareçam como zero e a ordem
    // seja crescente (do mais antigo ao mais recente).
    const rawDaily = await prisma.$queryRaw<{ date: string; total: number }[]>`
      SELECT DATE(date) as date, SUM(amount) as total
      FROM finance
      WHERE tenant_id = ${tenantId}
        AND type = 'income'
        AND DATE(date) >= DATE(DATE_SUB(CURDATE(), INTERVAL 6 DAY))
      GROUP BY DATE(date)
    `;
    // mapa "YYYY-MM-DD" -> total
    const dailyMap = new Map<string, number>();
    for (const r of rawDaily) {
      const key = String(r.date).substring(0, 10);
      dailyMap.set(key, Number(r.total) || 0);
    }
    // gera os 7 dias do calendário em ordem crescente
    const now = new Date();
    const salesOverTime: { date: string; total: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      salesOverTime.push({ date: key, total: dailyMap.get(key) ?? 0 });
    }

    const grossRevenue = Number(totalGross._sum.gross_amount ?? totalGross._sum.amount) || 0;
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
