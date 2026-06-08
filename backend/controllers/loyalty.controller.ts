import type { Request, Response } from "express";
import { prisma } from "../config/prisma";
import type { AuthenticatedRequest } from "../types/auth";

function tid(req: Request) {
  return (req as AuthenticatedRequest).user.tenantId;
}

// ─── Program (one per tenant) ─────────────────────────────────────────────────

export async function getProgram(req: Request, res: Response) {
  try {
    const tenantId = tid(req);
    let program = await prisma.loyaltyProgram.findUnique({
      where: { tenant_id: tenantId },
      include: { rewards: { where: { is_active: true }, orderBy: { points_cost: "asc" } } },
    });
    if (!program) {
      program = await prisma.loyaltyProgram.create({
        data: { tenant_id: tenantId },
        include: { rewards: true },
      });
    }
    res.json(program);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha ao buscar programa" });
  }
}

export async function updateProgram(req: Request, res: Response) {
  try {
    const tenantId = tid(req);
    const { name, is_active, spend_per_point, points_expiry_days, season_start, season_end } = req.body;

    const program = await prisma.loyaltyProgram.upsert({
      where: { tenant_id: tenantId },
      create: {
        tenant_id: tenantId,
        name: name ?? "Programa de Fidelidade",
        is_active: is_active ?? true,
        spend_per_point: spend_per_point ?? 10,
        points_expiry_days: points_expiry_days ?? 0,
        season_start: season_start ? new Date(season_start) : null,
        season_end: season_end ? new Date(season_end) : null,
      },
      update: {
        ...(name !== undefined && { name }),
        ...(is_active !== undefined && { is_active }),
        ...(spend_per_point !== undefined && { spend_per_point }),
        ...(points_expiry_days !== undefined && { points_expiry_days }),
        ...(season_start !== undefined && { season_start: season_start ? new Date(season_start) : null }),
        ...(season_end !== undefined && { season_end: season_end ? new Date(season_end) : null }),
      },
      include: { rewards: { where: { is_active: true }, orderBy: { points_cost: "asc" } } },
    });
    res.json(program);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha ao atualizar programa" });
  }
}

// ─── Rewards ──────────────────────────────────────────────────────────────────

export async function listRewards(req: Request, res: Response) {
  try {
    const tenantId = tid(req);
    const program = await prisma.loyaltyProgram.findUnique({ where: { tenant_id: tenantId } });
    if (!program) return res.json([]);
    const rewards = await prisma.loyaltyReward.findMany({
      where: { program_id: program.id, tenant_id: tenantId },
      orderBy: { points_cost: "asc" },
    });
    res.json(rewards);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha ao listar recompensas" });
  }
}

export async function createReward(req: Request, res: Response) {
  try {
    const tenantId = tid(req);
    const program = await prisma.loyaltyProgram.findUnique({ where: { tenant_id: tenantId } });
    if (!program) return res.status(404).json({ error: "Programa não configurado" });

    const { name, type, discount_value, discount_type, product_id, product_qty, points_cost } = req.body;
    const reward = await prisma.loyaltyReward.create({
      data: {
        program_id: program.id,
        tenant_id: tenantId,
        name,
        type,
        discount_value: discount_value ?? null,
        discount_type: discount_type ?? null,
        product_id: product_id ?? null,
        product_qty: product_qty ?? null,
        points_cost,
      },
    });
    res.json(reward);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha ao criar recompensa" });
  }
}

export async function updateReward(req: Request, res: Response) {
  try {
    const tenantId = tid(req);
    const id = Number(req.params.rewardId);
    const { name, type, discount_value, discount_type, product_id, product_qty, points_cost, is_active } = req.body;

    await prisma.loyaltyReward.updateMany({
      where: { id, tenant_id: tenantId },
      data: {
        ...(name !== undefined && { name }),
        ...(type !== undefined && { type }),
        ...(discount_value !== undefined && { discount_value }),
        ...(discount_type !== undefined && { discount_type }),
        ...(product_id !== undefined && { product_id }),
        ...(product_qty !== undefined && { product_qty }),
        ...(points_cost !== undefined && { points_cost }),
        ...(is_active !== undefined && { is_active }),
      },
    });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha ao atualizar recompensa" });
  }
}

export async function deleteReward(req: Request, res: Response) {
  try {
    const tenantId = tid(req);
    await prisma.loyaltyReward.deleteMany({
      where: { id: Number(req.params.rewardId), tenant_id: tenantId },
    });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha ao excluir recompensa" });
  }
}

// ─── Customer points ───────────────────────────────────────────────────────────

export async function getCustomerPoints(req: Request, res: Response) {
  try {
    const tenantId = tid(req);
    const customerId = Number(req.params.customerId);

    const entries = await prisma.customerPoint.findMany({
      where: { tenant_id: tenantId, customer_id: customerId },
      orderBy: { created_at: "desc" },
      take: 50,
    });

    const balance = entries.length > 0 ? entries[0].balance_after : 0;

    // check expiry
    const program = await prisma.loyaltyProgram.findUnique({ where: { tenant_id: tenantId } });
    let effectiveBalance = balance;
    if (program && program.points_expiry_days > 0 && entries.length > 0) {
      const lastEarn = entries.find((e) => e.delta > 0);
      if (lastEarn) {
        const expireAt = new Date(lastEarn.created_at);
        expireAt.setDate(expireAt.getDate() + program.points_expiry_days);
        if (new Date() > expireAt) effectiveBalance = 0;
      }
    }

    res.json({ balance: effectiveBalance, entries });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha ao buscar pontos" });
  }
}

export async function adjustPoints(req: Request, res: Response) {
  try {
    const tenantId = tid(req);
    const customerId = Number(req.params.customerId);
    const { delta, description } = req.body;

    const last = await prisma.customerPoint.findFirst({
      where: { tenant_id: tenantId, customer_id: customerId },
      orderBy: { created_at: "desc" },
    });
    const currentBalance = last?.balance_after ?? 0;
    const newBalance = Math.max(0, currentBalance + delta);

    const entry = await prisma.customerPoint.create({
      data: {
        tenant_id: tenantId,
        customer_id: customerId,
        delta,
        balance_after: newBalance,
        description: description ?? null,
      },
    });
    res.json({ entry, balance: newBalance });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha ao ajustar pontos" });
  }
}

// ─── Redemption ───────────────────────────────────────────────────────────────

export async function redeemReward(req: Request, res: Response) {
  try {
    const tenantId = tid(req);
    const customerId = Number(req.params.customerId);
    const { reward_id, order_id } = req.body;

    const reward = await prisma.loyaltyReward.findFirst({
      where: { id: reward_id, tenant_id: tenantId, is_active: true },
    });
    if (!reward) return res.status(404).json({ error: "Recompensa não encontrada" });

    const last = await prisma.customerPoint.findFirst({
      where: { tenant_id: tenantId, customer_id: customerId },
      orderBy: { created_at: "desc" },
    });
    const currentBalance = last?.balance_after ?? 0;
    if (currentBalance < reward.points_cost) {
      return res.status(400).json({ error: "Pontos insuficientes" });
    }

    const newBalance = currentBalance - reward.points_cost;

    // deduct stock if product reward
    if (reward.type === "product" && reward.product_id) {
      const qty = reward.product_qty ?? 1;
      await prisma.product.updateMany({
        where: { id: reward.product_id, tenant_id: tenantId },
        data: { stock_quantity: { decrement: qty } },
      });
      await prisma.stockMovement.create({
        data: {
          tenant_id: tenantId,
          product_id: reward.product_id,
          type: "out",
          quantity: qty,
          reason: `Resgate fidelidade — ${reward.name}`,
        },
      });
    }

    await prisma.$transaction([
      prisma.customerPoint.create({
        data: {
          tenant_id: tenantId,
          customer_id: customerId,
          order_id: order_id ?? null,
          delta: -reward.points_cost,
          balance_after: newBalance,
          description: `Resgate: ${reward.name}`,
        },
      }),
      prisma.pointRedemption.create({
        data: {
          tenant_id: tenantId,
          customer_id: customerId,
          reward_id: reward.id,
          order_id: order_id ?? null,
          points_used: reward.points_cost,
        },
      }),
    ]);

    res.json({ success: true, balance: newBalance, reward });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha ao resgatar recompensa" });
  }
}

// ─── Summary for all customers (dashboard) ────────────────────────────────────

export async function loyaltySummary(req: Request, res: Response) {
  try {
    const tenantId = tid(req);

    const program = await prisma.loyaltyProgram.findUnique({
      where: { tenant_id: tenantId },
      include: { rewards: true },
    });

    // top customers by balance
    const latestEntries = await prisma.$queryRaw<
      { customer_id: number; balance_after: number }[]
    >`
      SELECT customer_id, balance_after
      FROM customer_points
      WHERE tenant_id = ${tenantId}
        AND id IN (
          SELECT MAX(id) FROM customer_points WHERE tenant_id = ${tenantId} GROUP BY customer_id
        )
      ORDER BY balance_after DESC
      LIMIT 10
    `;

    const customerIds = latestEntries.map((e) => e.customer_id);
    const customers = await prisma.customer.findMany({
      where: { id: { in: customerIds } },
      select: { id: true, name: true, phone: true },
    });

    const topCustomers = latestEntries.map((e) => {
      const c = customers.find((x) => x.id === e.customer_id);
      return { customer_id: e.customer_id, name: c?.name ?? "–", phone: c?.phone ?? null, balance: e.balance_after };
    });

    const totalPoints = await prisma.customerPoint.aggregate({
      where: { tenant_id: tenantId, delta: { gt: 0 } },
      _sum: { delta: true },
    });

    const totalRedemptions = await prisma.pointRedemption.count({ where: { tenant_id: tenantId } });

    const activeCustomers = latestEntries.filter((e) => e.balance_after > 0).length;

    res.json({
      program,
      stats: {
        total_points_issued: Number(totalPoints._sum.delta ?? 0),
        total_redemptions: totalRedemptions,
        active_customers: activeCustomers,
      },
      top_customers: topCustomers,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha ao buscar resumo" });
  }
}

// ─── Used internally by sales controller ─────────────────────────────────────

export async function awardPointsForOrder(
  tenantId: number,
  customerId: number,
  orderId: number,
  orderTotal: number
) {
  const program = await prisma.loyaltyProgram.findUnique({ where: { tenant_id: tenantId } });
  if (!program || !program.is_active) return;

  const spendPer = Number(program.spend_per_point);
  if (spendPer <= 0) return;

  const pointsEarned = Math.floor(orderTotal / spendPer);
  if (pointsEarned <= 0) return;

  const last = await prisma.customerPoint.findFirst({
    where: { tenant_id: tenantId, customer_id: customerId },
    orderBy: { created_at: "desc" },
  });
  const currentBalance = last?.balance_after ?? 0;
  const newBalance = currentBalance + pointsEarned;

  let expiresAt: Date | null = null;
  if (program.points_expiry_days > 0) {
    expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + program.points_expiry_days);
  }

  await prisma.customerPoint.create({
    data: {
      tenant_id: tenantId,
      customer_id: customerId,
      order_id: orderId,
      delta: pointsEarned,
      balance_after: newBalance,
      description: `Compra #${orderId}`,
      expires_at: expiresAt,
    },
  });
}
