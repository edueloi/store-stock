import type { Request, Response } from "express";

import { prisma } from "../config/prisma";
import type { AuthenticatedRequest } from "../types/auth";

function getTenantId(req: Request) {
  return (req as AuthenticatedRequest).user.tenantId;
}

// Resolve o período (from/to) a partir da query. Default: mês atual.
// Retorna Date objects em UTC midnight para casar com colunas @db.Date.
function resolvePeriod(req: Request): { from: Date; to: Date } {
  const q = req.query as { from?: string; to?: string };
  const now = new Date();
  const isYmd = (s?: string) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);

  const from = isYmd(q.from)
    ? new Date(q.from + "T00:00:00Z")
    : new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));
  const to = isYmd(q.to)
    ? new Date(q.to + "T00:00:00Z")
    : new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 0)); // último dia do mês atual

  return { from, to };
}

// Fim do dia (23:59:59.999) — para incluir o dia inteiro em colunas datetime.
function endOfDay(d: Date): Date {
  return new Date(d.getTime() + 24 * 60 * 60 * 1000 - 1);
}

export async function getTopSellingProducts(req: Request, res: Response) {
  try {
    const { from, to } = resolvePeriod(req);
    const topProducts = await prisma.orderItem.groupBy({
      by: ["product_id"],
      where: {
        order: {
          tenant_id: getTenantId(req),
          status: "completed",
          created_at: { gte: from, lte: endOfDay(to) },
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

const ymd = (d: Date) =>
  `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;

export async function getDashboardStats(req: Request, res: Response) {
  const tenantId = getTenantId(req);
  const { from, to } = resolvePeriod(req);
  const toEnd = endOfDay(to);

  try {
    const baseWhere = { tenant_id: tenantId, type: "income", date: { gte: from, lte: to } } as const;

    const [totalGross, products, cogsResult, servicesRevenue, productsRevenue, servicesCount, productsCount] = await Promise.all([
      // Bruto total (todos os tipos)
      prisma.finance.aggregate({
        where: baseWhere,
        _sum: { gross_amount: true, amount: true },
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
          AND o.created_at >= ${from} AND o.created_at <= ${toEnd}
      `,
      // Receita líquida de serviços (source = 'services')
      prisma.finance.aggregate({
        where: { ...baseWhere, source: "services" },
        _sum: { amount: true, gross_amount: true },
      }),
      // Receita líquida de produtos (source = 'pdv' ou null para entradas antigas)
      prisma.finance.aggregate({
        where: { ...baseWhere, OR: [{ source: "pdv" }, { source: null }] },
        _sum: { amount: true, gross_amount: true },
      }),
      // Contagem de ordens de serviço no período
      prisma.order.count({
        where: { tenant_id: tenantId, status: "completed", order_type: "services", created_at: { gte: from, lte: toEnd } },
      }),
      // Contagem de ordens de produto no período
      prisma.order.count({
        where: { tenant_id: tenantId, status: "completed", order_type: { in: ["products", "mixed"] }, created_at: { gte: from, lte: toEnd } },
      }),
    ]);

    const stockValue = products.reduce(
      (acc, p) => acc + p.stock_quantity * Number(p.cost_price), 0
    );

    // Série diária — busca todos os registros do período e agrupa em JS
    // (evita dependência de timezone do MySQL em queries DATE() raw)
    const allDailyEntries = await prisma.finance.findMany({
      where: { tenant_id: tenantId, type: "income", date: { gte: from, lte: toEnd } },
      select: { date: true, amount: true, source: true },
    });

    // Agrupa por dia (YYYY-MM-DD) em JS para evitar problemas de timezone do MySQL
    const dailyAgg    = new Map<string, number>();
    const dailySvc    = new Map<string, number>();
    const dailyPdv    = new Map<string, number>();
    for (const row of allDailyEntries) {
      // Normalize to YYYY-MM-DD regardless of how the driver returns the date.
      // @db.Date values are stored as UTC midnight — we extract the UTC calendar day.
      const d = row.date instanceof Date ? row.date : new Date(String(row.date));
      const key = ymd(d);
      const amt  = Number(row.amount) || 0;
      dailyAgg.set(key, (dailyAgg.get(key) ?? 0) + amt);
      if (row.source === "services") {
        dailySvc.set(key, (dailySvc.get(key) ?? 0) + amt);
      } else {
        dailyPdv.set(key, (dailyPdv.get(key) ?? 0) + amt);
      }
    }

    const salesOverTime: { date: string; total: number; services: number; products: number }[] = [];
    const cursor = new Date(from.getTime());
    let guard = 0;
    while (cursor.getTime() <= to.getTime() && guard < 366) {
      const key = ymd(cursor);
      salesOverTime.push({
        date:     key,
        total:    dailyAgg.get(key) ?? 0,
        services: dailySvc.get(key) ?? 0,
        products: dailyPdv.get(key) ?? 0,
      });
      cursor.setUTCDate(cursor.getUTCDate() + 1);
      guard++;
    }

    const grossRevenue          = Number(totalGross._sum.gross_amount ?? totalGross._sum.amount) || 0;
    const netRevenue            = Number(totalGross._sum.amount) || 0;
    const cogs                  = Number(cogsResult[0]?.cogs) || 0;
    const servicesNet           = Number(servicesRevenue._sum.amount) || 0;
    const servicesGross         = Number(servicesRevenue._sum.gross_amount ?? servicesRevenue._sum.amount) || 0;
    const productsNet           = Number(productsRevenue._sum.amount) || 0;
    const productsGross         = Number(productsRevenue._sum.gross_amount ?? productsRevenue._sum.amount) || 0;

    res.json({
      summary: {
        grossRevenue,
        netRevenue,
        cogs,
        stockValue,
        profit:         netRevenue - cogs,
        servicesNet,
        servicesGross,
        servicesCount,
        productsNet,
        productsGross,
        productsCount,
      },
      salesOverTime,
    });
  } catch (err) {
    console.error("[stats] getDashboardStats error:", err);
    res.status(500).json({ error: "Failed to fetch stats", detail: String(err) });
  }
}
