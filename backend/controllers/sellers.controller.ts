import type { Request, Response } from "express";
import { prisma } from "../config/prisma";
import type { AuthenticatedRequest } from "../types/auth";
import { computeCurrentValue } from "./goals.controller";

function getTenantId(req: Request) {
  return (req as AuthenticatedRequest).user.tenantId;
}

export async function listSellers(req: Request, res: Response) {
  try {
    const sellers = await prisma.seller.findMany({
      where: { tenant_id: getTenantId(req) },
      orderBy: { name: "asc" },
    });
    res.json(sellers);
  } catch {
    res.status(500).json({ error: "Falha ao listar vendedores" });
  }
}

export async function createSeller(req: Request, res: Response) {
  try {
    const seller = await prisma.seller.create({
      data: {
        tenant_id:       getTenantId(req),
        name:            req.body.name,
        email:           req.body.email    || null,
        phone:           req.body.phone    || null,
        document:        req.body.document || null,
        commission_rate: req.body.commission_rate ?? 0,
        is_active:       req.body.is_active ?? true,
        notes:           req.body.notes    || null,
      },
    });
    res.json(seller);
  } catch {
    res.status(500).json({ error: "Falha ao criar vendedor" });
  }
}

export async function updateSeller(req: Request, res: Response) {
  try {
    const tenantId = getTenantId(req);
    const existing = await prisma.seller.findFirst({
      where: { id: Number(req.params.id), tenant_id: tenantId },
    });
    if (!existing) return res.status(404).json({ error: "Vendedor não encontrado" });

    const seller = await prisma.seller.update({
      where: { id: Number(req.params.id) },
      data: {
        name:            req.body.name,
        email:           req.body.email    || null,
        phone:           req.body.phone    || null,
        document:        req.body.document || null,
        commission_rate: req.body.commission_rate ?? existing.commission_rate,
        is_active:       req.body.is_active ?? existing.is_active,
        notes:           req.body.notes    || null,
      },
    });
    res.json(seller);
  } catch {
    res.status(500).json({ error: "Falha ao atualizar vendedor" });
  }
}

export async function deleteSeller(req: Request, res: Response) {
  try {
    const tenantId = getTenantId(req);
    await prisma.seller.deleteMany({
      where: { id: Number(req.params.id), tenant_id: tenantId },
    });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Falha ao deletar vendedor" });
  }
}

// ── Ranking & comissões por período ────────────────────────────────────────────
export async function getSellerStats(req: Request, res: Response) {
  try {
    const tenantId = getTenantId(req);
    const { month, year } = req.query;

    const now   = new Date();
    const y     = year  ? Number(year)  : now.getFullYear();
    const m     = month ? Number(month) : now.getMonth() + 1;
    const start = new Date(y, m - 1, 1);
    const end   = new Date(y, m, 1);

    const sellers = await prisma.seller.findMany({
      where: { tenant_id: tenantId },
      orderBy: { name: "asc" },
    });

    // Busca todas as orders do período com seller_id preenchido
    const orders = await prisma.order.findMany({
      where: {
        tenant_id: tenantId,
        status:    "completed",
        seller_id: { not: null },
        created_at: { gte: start, lt: end },
      },
      select: {
        id: true,
        seller_id: true,
        total_amount: true,
        created_at: true,
      },
    });

    // Totais históricos por vendedor (all-time)
    const allTimeOrders = await prisma.order.findMany({
      where: {
        tenant_id: tenantId,
        status:    "completed",
        seller_id: { not: null },
      },
      select: { seller_id: true, total_amount: true },
    });

    const allTimeMap: Record<number, number> = {};
    for (const o of allTimeOrders) {
      if (o.seller_id) {
        allTimeMap[o.seller_id] = (allTimeMap[o.seller_id] ?? 0) + Number(o.total_amount);
      }
    }

    // Agrupa por vendedor para o mês
    const monthMap: Record<number, { sales: number; revenue: number }> = {};
    for (const o of orders) {
      if (o.seller_id) {
        if (!monthMap[o.seller_id]) monthMap[o.seller_id] = { sales: 0, revenue: 0 };
        monthMap[o.seller_id].sales   += 1;
        monthMap[o.seller_id].revenue += Number(o.total_amount);
      }
    }

    const stats = sellers.map((s) => {
      const month_data  = monthMap[s.id]  ?? { sales: 0, revenue: 0 };
      const commission  = month_data.revenue * (Number(s.commission_rate) / 100);
      return {
        ...s,
        month_sales:       month_data.sales,
        month_revenue:     month_data.revenue,
        month_commission:  commission,
        all_time_revenue:  allTimeMap[s.id] ?? 0,
        all_time_commission: (allTimeMap[s.id] ?? 0) * (Number(s.commission_rate) / 100),
      };
    });

    // Ordena por receita do mês desc (ranking)
    stats.sort((a, b) => b.month_revenue - a.month_revenue);

    res.json({ month: m, year: y, stats });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha ao buscar estatísticas" });
  }
}

// ── Metas por vendedor ──────────────────────────────────────────────────────
// Lista metas de vendedores (todas, ou de um vendedor específico via ?seller_id=)
export async function listSellerGoals(req: Request, res: Response) {
  try {
    const tenantId = getTenantId(req);
    const { seller_id } = req.query;

    const goals = await prisma.goal.findMany({
      where: {
        tenant_id: tenantId,
        seller_id: seller_id ? Number(seller_id) : { not: null },
      },
      orderBy: [{ status: "asc" }, { end_date: "asc" }],
    });

    const enriched = await Promise.all(
      goals.map(async (g) => {
        if (g.status !== "active") return g;
        const current = await computeCurrentValue(
          tenantId,
          g.type,
          new Date(g.start_date),
          new Date(g.end_date),
          g.seller_id
        );
        if (Math.abs(current - Number(g.current_value)) > 0.01) {
          await prisma.goal.update({
            where: { id: g.id },
            data: { current_value: current },
          });
        }
        return { ...g, current_value: current };
      })
    );

    res.json(enriched);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha ao listar metas de vendedores" });
  }
}

// ── Ranking por cumprimento de meta ─────────────────────────────────────────
// Para cada vendedor ativo, retorna a meta ativa que se sobrepõe ao mês
// selecionado e o % já cumprido, ordenado desc. Vendedores sem meta ativa no
// período vêm com goal: null (aparecem no fim, sem % de cumprimento).
export async function getSellerGoalsRanking(req: Request, res: Response) {
  try {
    const tenantId = getTenantId(req);
    const { month, year } = req.query;

    const now = new Date();
    const y = year ? Number(year) : now.getFullYear();
    const m = month ? Number(month) : now.getMonth() + 1;
    const monthStart = new Date(y, m - 1, 1);
    const monthEnd = new Date(y, m, 0);

    const sellers = await prisma.seller.findMany({
      where: { tenant_id: tenantId, is_active: true },
      orderBy: { name: "asc" },
    });

    const ranking = await Promise.all(
      sellers.map(async (s) => {
        // Meta ativa do vendedor que se sobrepõe ao período selecionado.
        // Se houver mais de uma, prioriza a de intervalo mais longo (mais estratégica).
        const activeGoals = await prisma.goal.findMany({
          where: {
            tenant_id: tenantId,
            seller_id: s.id,
            status: "active",
            start_date: { lte: monthEnd },
            end_date: { gte: monthStart },
          },
        });

        if (activeGoals.length === 0) {
          return { ...s, goal: null, progress_pct: null };
        }

        activeGoals.sort((a, b) => {
          const lenA = new Date(a.end_date).getTime() - new Date(a.start_date).getTime();
          const lenB = new Date(b.end_date).getTime() - new Date(b.start_date).getTime();
          return lenB - lenA;
        });
        const goal = activeGoals[0];

        const current = await computeCurrentValue(
          tenantId,
          goal.type,
          new Date(goal.start_date),
          new Date(goal.end_date),
          s.id
        );
        const target = Number(goal.target_value);
        const progress_pct = target > 0 ? (current / target) * 100 : 0;

        return {
          ...s,
          goal: { ...goal, current_value: current },
          progress_pct,
        };
      })
    );

    ranking.sort((a, b) => {
      if (a.progress_pct == null && b.progress_pct == null) return 0;
      if (a.progress_pct == null) return 1;
      if (b.progress_pct == null) return -1;
      return b.progress_pct - a.progress_pct;
    });

    res.json({ month: m, year: y, ranking });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha ao buscar ranking de metas" });
  }
}
