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
    const [totalGross, totalIncome, products, cogsResult] = await Promise.all([
      // Bruto = soma de gross_amount das entradas do finance (igual ao card "Bruto" do Fluxo de Caixa)
      prisma.finance.aggregate({
        where: { tenant_id: tenantId, type: "income", date: { gte: from, lte: to } },
        _sum: { gross_amount: true, amount: true },
      }),
      // Líquido = soma de amount das entradas do finance (igual ao "Total Entradas" do Fluxo de Caixa)
      prisma.finance.aggregate({
        where: { tenant_id: tenantId, type: "income", date: { gte: from, lte: to } },
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
          AND o.created_at >= ${from} AND o.created_at <= ${toEnd}
      `,
    ]);

    const stockValue = products.reduce(
      (accumulator, product) =>
        accumulator + product.stock_quantity * Number(product.cost_price),
      0
    );

    // Série diária dentro do período selecionado. Montamos a série completa
    // no JS para que dias SEM venda apareçam como zero e a ordem seja crescente.
    const rawDaily = await prisma.$queryRaw<{ date: string; total: number }[]>`
      SELECT DATE(date) as date, SUM(amount) as total
      FROM finance
      WHERE tenant_id = ${tenantId}
        AND type = 'income'
        AND DATE(date) >= ${ymd(from)}
        AND DATE(date) <= ${ymd(to)}
      GROUP BY DATE(date)
    `;
    const dailyMap = new Map<string, number>();
    for (const r of rawDaily) {
      dailyMap.set(String(r.date).substring(0, 10), Number(r.total) || 0);
    }
    // gera todos os dias do período (limite de 366 pontos por segurança)
    const salesOverTime: { date: string; total: number }[] = [];
    const cursor = new Date(from.getTime());
    let guard = 0;
    while (cursor.getTime() <= to.getTime() && guard < 366) {
      const key = ymd(cursor);
      salesOverTime.push({ date: key, total: dailyMap.get(key) ?? 0 });
      cursor.setUTCDate(cursor.getUTCDate() + 1);
      guard++;
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
