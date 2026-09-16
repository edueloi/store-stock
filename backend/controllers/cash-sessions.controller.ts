import type { Request, Response } from "express";

import { prisma } from "../config/prisma";
import type { AuthenticatedRequest } from "../types/auth";
import { parsePaymentMethod } from "../utils/payment-method";
import { emitToTenant } from "../services/realtime.service";

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

    emitToTenant(tenantId, "cash-session:changed", { cashSessionId: session.id });
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
      select: { payment_method: true, fee_amount: true, change_amount: true },
    });

    // Pagamentos de dívida (crediário) recebidos dentro desta sessão de caixa — cada
    // linha já é 1 segmento de forma de pagamento com sua própria taxa calculada (ver
    // customers.controller.ts registerDebtPaymentMulti), então soma direto, sem
    // precisar ratear como é feito abaixo para Order (que agrega N segmentos num único
    // fee_amount por pedido).
    const debtPayments = await prisma.customerDebtPayment.findMany({
      where: { tenant_id: tenantId, cash_session_id: id },
      select: { payment_method: true, amount: true, fee_amount: true },
    });

    const totals: Record<string, number> = {};
    const fees: Record<string, number> = {};
    for (const order of orders) {
      const segs = parsePaymentMethod(order.payment_method ?? "money").filter((seg) => seg.amount > 0);
      const orderGross = segs.reduce((sum, seg) => sum + seg.amount, 0);
      const orderFee = Number(order.fee_amount) || 0;
      // O segmento "money" guarda o valor RECEBIDO do cliente (ex.: cliente paga R$20
      // numa compra de R$5,99), não o que fica na gaveta — sem subtrair o troco aqui,
      // o "esperado em dinheiro" do fechamento de caixa ficava inflado por todo troco
      // dado no dia, gerando uma diferença negativa gigante e falsa (bug real visto em
      // produção: sessão com 484,90 esperado vs 190,80 contado, quando o esperado
      // correto — descontando troco — era 420,38).
      const changeAmount = Number(order.change_amount) || 0;
      let changeToApply = changeAmount;
      for (const seg of segs) {
        let segAmount = seg.amount;
        if (seg.method === "money" && changeToApply > 0) {
          const applied = Math.min(changeToApply, segAmount);
          segAmount -= applied;
          changeToApply -= applied;
        }
        totals[seg.method] = (totals[seg.method] ?? 0) + segAmount;
        // fee_amount é gravado por pedido, não por forma de pagamento — em venda
        // com pagamento misto (ex.: metade PIX, metade crédito), rateia a taxa
        // do pedido proporcionalmente ao valor de cada segmento. Dinheiro nunca
        // tem taxa de maquininha, mesmo que aponte pra cá por engano. O rateio usa o
        // valor bruto original do segmento (orderGross), não o líquido pós-troco.
        if (seg.method !== "money" && orderFee > 0 && orderGross > 0) {
          fees[seg.method] = (fees[seg.method] ?? 0) + orderFee * (seg.amount / orderGross);
        }
      }
    }
    for (const dp of debtPayments) {
      const method = dp.payment_method || "money";
      const amount = Number(dp.amount) || 0;
      const fee = Number(dp.fee_amount) || 0;
      totals[method] = (totals[method] ?? 0) + amount;
      if (method !== "money" && fee > 0) {
        fees[method] = (fees[method] ?? 0) + fee;
      }
    }

    const openingAmount = Number(session.opening_amount);
    const moneyExpected = Math.round((openingAmount + (totals.money ?? 0)) * 100) / 100;
    const counted = Math.round((Number(countedAmount) || 0) * 100) / 100;
    const difference = Math.round((counted - moneyExpected) * 100) / 100;

    const paymentBreakdown: Record<string, { expected: number; counted?: number; difference?: number; fee?: number; net?: number }> = {
      money: { expected: moneyExpected, counted, difference },
    };
    for (const method of Object.keys(totals)) {
      if (method === "money") continue;
      const expected = Math.round(totals[method] * 100) / 100;
      const fee = Math.round((fees[method] ?? 0) * 100) / 100;
      const countedForMethod = countedBreakdown?.[method];
      paymentBreakdown[method] = {
        expected,
        fee: fee > 0 ? fee : undefined,
        net: fee > 0 ? Math.round((expected - fee) * 100) / 100 : undefined,
        ...(countedForMethod !== undefined
          ? { counted: countedForMethod, difference: Math.round((countedForMethod - expected) * 100) / 100 }
          : {}),
      };
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

    emitToTenant(tenantId, "cash-session:changed", { cashSessionId: updated.id });
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
          select: {
            id: true, total_amount: true, gross_amount: true, discount_amount: true, fee_amount: true,
            payment_method: true, created_at: true, status: true,
            customer_name: true, seller_name: true,
            items: {
              select: {
                quantity: true, unit_price: true, name: true,
                product: { select: { name: true } },
              },
            },
          },
          orderBy: { created_at: "desc" },
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
