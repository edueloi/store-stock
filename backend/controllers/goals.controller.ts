import type { Request, Response } from "express";
import { prisma } from "../config/prisma";
import type { AuthenticatedRequest } from "../types/auth";

function getTenantId(req: Request) {
  return (req as AuthenticatedRequest).user.tenantId;
}

// Calcula o valor atual de uma meta com base nos dados reais do período
async function computeCurrentValue(
  tenantId: number,
  type: string,
  startDate: Date,
  endDate: Date
): Promise<number> {
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);

  switch (type) {
    case "revenue": {
      // Faturamento bruto: soma de todas as vendas (orders completadas)
      const result = await prisma.order.aggregate({
        where: {
          tenant_id: tenantId,
          status: "completed",
          created_at: { gte: startDate, lte: end },
        },
        _sum: { total_amount: true },
      });
      return Number(result._sum.total_amount ?? 0);
    }

    case "orders_count": {
      // Número de pedidos concluídos
      const count = await prisma.order.count({
        where: {
          tenant_id: tenantId,
          status: "completed",
          created_at: { gte: startDate, lte: end },
        },
      });
      return count;
    }

    case "expense_reduction": {
      // Despesas (finance entries do tipo expense)
      const result = await prisma.finance.aggregate({
        where: {
          tenant_id: tenantId,
          type: "expense",
          date: { gte: startDate, lte: end },
        },
        _sum: { amount: true },
      });
      return Number(result._sum.amount ?? 0);
    }

    case "income": {
      // Entradas no fluxo de caixa (finance income)
      const result = await prisma.finance.aggregate({
        where: {
          tenant_id: tenantId,
          type: "income",
          date: { gte: startDate, lte: end },
        },
        _sum: { amount: true },
      });
      return Number(result._sum.amount ?? 0);
    }

    case "quotes_converted": {
      // Orçamentos convertidos em vendas
      const count = await prisma.quote.count({
        where: {
          tenant_id: tenantId,
          status: "converted",
          created_at: { gte: startDate, lte: end },
        },
      });
      return count;
    }

    case "new_customers": {
      // Novos clientes cadastrados no período
      const count = await prisma.customer.count({
        where: {
          tenant_id: tenantId,
          created_at: { gte: startDate, lte: end },
        },
      });
      return count;
    }

    default:
      return 0;
  }
}

export async function listGoals(req: Request, res: Response) {
  try {
    const tenantId = getTenantId(req);
    const goals = await prisma.goal.findMany({
      where: { tenant_id: tenantId },
      orderBy: [{ status: "asc" }, { end_date: "asc" }],
    });

    // Recalcula current_value para cada meta ativa
    const enriched = await Promise.all(
      goals.map(async (g) => {
        if (g.status !== "active") return g;
        const current = await computeCurrentValue(
          tenantId,
          g.type,
          new Date(g.start_date),
          new Date(g.end_date)
        );
        // Atualiza no banco se mudou
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
    res.status(500).json({ error: "Falha ao listar metas" });
  }
}

export async function createGoal(req: Request, res: Response) {
  try {
    const tenantId = getTenantId(req);
    const { title, description, type, period, target_value, start_date, end_date } = req.body;

    const goal = await prisma.goal.create({
      data: {
        tenant_id: tenantId,
        title,
        description: description || null,
        type,
        period,
        target_value,
        current_value: 0,
        start_date: new Date(start_date),
        end_date: new Date(end_date),
        status: "active",
      },
    });

    // Calcula valor atual imediatamente após criar
    const current = await computeCurrentValue(
      tenantId,
      type,
      new Date(start_date),
      new Date(end_date)
    );
    const updated = await prisma.goal.update({
      where: { id: goal.id },
      data: { current_value: current },
    });

    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha ao criar meta" });
  }
}

export async function updateGoal(req: Request, res: Response) {
  try {
    const tenantId = getTenantId(req);
    const id = Number(req.params.id);
    const { title, description, target_value, status } = req.body;

    const goal = await prisma.goal.updateMany({
      where: { id, tenant_id: tenantId },
      data: {
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(target_value !== undefined && { target_value }),
        ...(status !== undefined && { status }),
      },
    });

    res.json({ success: true, count: goal.count });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha ao atualizar meta" });
  }
}

export async function deleteGoal(req: Request, res: Response) {
  try {
    const tenantId = getTenantId(req);
    await prisma.goal.deleteMany({
      where: { id: Number(req.params.id), tenant_id: tenantId },
    });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha ao excluir meta" });
  }
}
