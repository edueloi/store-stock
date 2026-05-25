import type { Request, Response } from "express";
import { prisma } from "../config/prisma";
import type { AuthenticatedRequest } from "../types/auth";

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
