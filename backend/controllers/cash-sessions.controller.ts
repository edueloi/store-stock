import type { Request, Response } from "express";

import { prisma } from "../config/prisma";
import type { AuthenticatedRequest } from "../types/auth";
import { parsePaymentMethod } from "../utils/payment-method";

function getTenantId(req: Request) {
  return (req as AuthenticatedRequest).user.tenantId;
}

function getUserId(req: Request) {
  return (req as AuthenticatedRequest).user.userId;
}

export async function getCurrentCashSession(req: Request, res: Response) {
  try {
    const tenantId = getTenantId(req);
    const userId = getUserId(req);

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { require_cash_session: true },
    });

    const session = await prisma.cashSession.findFirst({
      where: { tenant_id: tenantId, opened_by_id: userId, status: "open" },
      orderBy: { opened_at: "desc" },
    });

    res.json({ requireCashSession: !!tenant?.require_cash_session, session });
  } catch (err) {
    console.error("[getCurrentCashSession] error:", err);
    res.status(500).json({ error: "Falha ao consultar sessão de caixa" });
  }
}

export async function openCashSession(req: Request, res: Response) {
  try {
    const tenantId = getTenantId(req);
    const userId = getUserId(req);
    const { openingAmount, openingNote } = req.body as { openingAmount: number; openingNote?: string };

    const existing = await prisma.cashSession.findFirst({
      where: { tenant_id: tenantId, opened_by_id: userId, status: "open" },
      select: { id: true },
    });
    if (existing) {
      res.status(409).json({ error: "Você já possui um caixa aberto." });
      return;
    }

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });

    const session = await prisma.cashSession.create({
      data: {
        tenant_id: tenantId,
        opened_by_id: userId,
        opened_by_name: user?.name ?? "Operador",
        opening_amount: Number(openingAmount) || 0,
        opening_note: openingNote ?? null,
        status: "open",
      },
    });

    res.status(201).json({ session });
  } catch (err) {
    console.error("[openCashSession] error:", err);
    res.status(500).json({ error: "Falha ao abrir caixa" });
  }
}

export async function closeCashSession(req: Request, res: Response) {
  try {
    const tenantId = getTenantId(req);
    const userId = getUserId(req);
    const id = Number(req.params.id);
    const { countedAmount, countedBreakdown, closingNote } = req.body as {
      countedAmount: number;
      countedBreakdown?: Record<string, number>;
      closingNote?: string;
    };

    const session = await prisma.cashSession.findFirst({
      where: { id, tenant_id: tenantId, opened_by_id: userId, status: "open" },
    });
    if (!session) {
      res.status(404).json({ error: "Sessão de caixa não encontrada ou já fechada." });
      return;
    }

    const orders = await prisma.order.findMany({
      where: { tenant_id: tenantId, cash_session_id: id, status: "completed" },
      select: { payment_method: true },
    });

    const totals: Record<string, number> = {};
    for (const order of orders) {
      for (const seg of parsePaymentMethod(order.payment_method ?? "money")) {
        if (seg.amount <= 0) continue;
        totals[seg.method] = (totals[seg.method] ?? 0) + seg.amount;
      }
    }

    const openingAmount = Number(session.opening_amount);
    const moneyExpected = Math.round((openingAmount + (totals.money ?? 0)) * 100) / 100;
    const counted = Math.round((Number(countedAmount) || 0) * 100) / 100;
    const difference = Math.round((counted - moneyExpected) * 100) / 100;

    const paymentBreakdown: Record<string, { expected: number; counted?: number; difference?: number }> = {
      money: { expected: moneyExpected, counted, difference },
    };
    for (const method of Object.keys(totals)) {
      if (method === "money") continue;
      const expected = Math.round(totals[method] * 100) / 100;
      const countedForMethod = countedBreakdown?.[method];
      paymentBreakdown[method] = countedForMethod !== undefined
        ? { expected, counted: countedForMethod, difference: Math.round((countedForMethod - expected) * 100) / 100 }
        : { expected };
    }

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });

    const updated = await prisma.cashSession.update({
      where: { id },
      data: {
        status: "closed",
        closed_by_id: userId,
        closed_by_name: user?.name ?? "Operador",
        closed_at: new Date(),
        counted_amount: counted,
        expected_amount: moneyExpected,
        difference_amount: difference,
        payment_breakdown: paymentBreakdown,
        closing_note: closingNote ?? null,
      },
    });

    res.json({ session: updated });
  } catch (err) {
    console.error("[closeCashSession] error:", err);
    res.status(500).json({ error: "Falha ao fechar caixa" });
  }
}

export async function listCashSessions(req: Request, res: Response) {
  try {
    const tenantId = getTenantId(req);
    const { from, to, userId, status } = req.query as { from?: string; to?: string; userId?: string; status?: string };

    const sessions = await prisma.cashSession.findMany({
      where: {
        tenant_id: tenantId,
        ...(status ? { status } : {}),
        ...(userId ? { opened_by_id: Number(userId) } : {}),
        ...(from || to ? {
          opened_at: {
            ...(from ? { gte: new Date(`${from}T00:00:00`) } : {}),
            ...(to ? { lte: new Date(`${to}T23:59:59`) } : {}),
          },
        } : {}),
      },
      orderBy: { opened_at: "desc" },
    });

    res.json(sessions);
  } catch (err) {
    console.error("[listCashSessions] error:", err);
    res.status(500).json({ error: "Falha ao listar sessões de caixa" });
  }
}

export async function getCashSessionDetail(req: Request, res: Response) {
  try {
    const tenantId = getTenantId(req);
    const id = Number(req.params.id);

    const session = await prisma.cashSession.findFirst({
      where: { id, tenant_id: tenantId },
      include: {
        orders: {
          select: { id: true, total_amount: true, payment_method: true, created_at: true, status: true },
          orderBy: { created_at: "asc" },
        },
      },
    });
    if (!session) {
      res.status(404).json({ error: "Sessão de caixa não encontrada" });
      return;
    }

    res.json(session);
  } catch (err) {
    console.error("[getCashSessionDetail] error:", err);
    res.status(500).json({ error: "Falha ao buscar sessão de caixa" });
  }
}
