import { prisma } from "../config/prisma";
import { localDateString } from "../utils/date";
import { computeSegmentFee } from "../utils/payment-method";
import { synchronizeDebtBalance } from "./debt-balance.service";

function isPaymentToday(paymentDate: Date) {
  const today = localDateString();
  return paymentDate.toISOString().slice(0, 10) === today.toISOString().slice(0, 10);
}

export interface DebtPaymentSegmentInput {
  method: string;
  brand?: string;
  installments?: number;
  amount: number;
}

// Generalização de registerDebtPayment para N formas de pagamento simultâneas (ex.:
// metade dinheiro, metade crédito 2x) — um CustomerDebtPayment por segmento, cada um já
// com bandeira/parcelas/taxa de maquininha calculada, igual ao que a venda normal do
// PDV já faz (mas lá agregado numa string composta; aqui cada forma é sua própria
// linha, o que é mais simples de auditar e não precisa ratear taxa depois).
export async function registerDebtPaymentMulti(
  tenantId: number,
  userId: number,
  debtId: number,
  segments: DebtPaymentSegmentInput[],
  installmentId?: number | null,
  paymentDate = new Date(),
  discount = 0,
  database = prisma,
  expectedRemaining?: number,
) {
  if (!Array.isArray(segments) || segments.some(seg =>
    !["money", "pix", "debit", "credit", "boleto"].includes(seg.method)
    || !Number.isFinite(Number(seg.amount)) || Number(seg.amount) <= 0
  ) || !Number.isFinite(Number(discount)) || Number(discount) < 0) throw new Error("INVALID_AMOUNT");
  const totalAmount = segments.reduce((sum, seg) => sum + Math.round(Number(seg.amount) * 100), 0) / 100;
  const cleanDiscount = Math.max(0, Math.round((Number(discount) || 0) * 100) / 100);
  const settledAmount = Math.round((totalAmount + cleanDiscount) * 100) / 100;

  if (settledAmount <= 0) throw new Error("INVALID_AMOUNT");

  return database.$transaction(async (tx) => {
    // Todas as entradas usam a mesma trava antes de ler ou alterar o saldo.
    await tx.$queryRaw`SELECT id FROM customer_debts WHERE id = ${debtId} AND tenant_id = ${tenantId} FOR UPDATE`;
    const debt = await tx.customerDebt.findFirst({ where: { id: debtId, tenant_id: tenantId } });
    if (!debt) throw new Error("NOT_FOUND");
    if (debt.status === "paid") throw new Error("ALREADY_PAID");
    const previousPayments = await tx.customerDebtPayment.findMany({ where: { tenant_id: tenantId, debt_id: debtId } });
    const ledgerPaid = previousPayments.reduce((sum, payment) => sum + Math.round(Number(payment.amount) * 100), 0);
    if (ledgerPaid !== Math.round(Number(debt.amount_paid) * 100)) throw new Error("BALANCE_CHANGED");

    const remaining = Number(debt.amount) - Number(debt.amount_paid);
    // Sem troco em fiado — quitar até o saldo devedor, nunca além (mesma tolerância de
    // arredondamento já usada em registerDebtPayment).
    if (settledAmount > remaining + 0.005) throw new Error("INVALID_AMOUNT");

    let installment = null;
    if (installmentId) {
      installment = await tx.customerDebtInstallment.findFirst({
        where: { id: installmentId, debt_id: debtId, tenant_id: tenantId },
      });
      if (!installment) throw new Error("INSTALLMENT_NOT_FOUND");
      if (installment.status === "paid") throw new Error("INSTALLMENT_ALREADY_PAID");
      const installmentRemaining = Number(installment.amount) - Number(installment.amount_paid);
      if (settledAmount > installmentRemaining + 0.005) throw new Error("INVALID_AMOUNT");
    }

    const currentRemaining = installment
      ? Number(installment.amount) - Number(installment.amount_paid) : remaining;
    if (expectedRemaining !== undefined && (!Number.isFinite(Number(expectedRemaining))
      || Math.round(Number(expectedRemaining) * 100) !== Math.round(currentRemaining * 100))) {
      throw new Error("BALANCE_CHANGED");
    }

    const customer = await tx.customer.findUnique({ where: { id: debt.customer_id } });
    const tenantData = await tx.tenant.findUnique({
      where: { id: tenantId },
      select: { card_fees: true, require_cash_session: true },
    });
    const cardFees = (tenantData?.card_fees ?? {}) as Record<string, number[]>;

    // Sessão de caixa aberta do operador — mesmo padrão de sales.controller.ts. Quando a
    // loja exige caixa aberto, bloqueia igual à venda normal; caso contrário, o pagamento
    // segue permitido mesmo sem sessão (só fica de fora do fechamento daquele dia).
    // Um pagamento lançado com data passada fica registrado no crediário e no
    // financeiro daquela data, mas nunca altera de surpresa um caixa que já foi
    // fechado. Só o recebimento do dia entra na sessão de caixa aberta do operador.
    const openSession = isPaymentToday(paymentDate)
      ? await tx.cashSession.findFirst({
          where: { tenant_id: tenantId, opened_by_id: userId, status: "open" },
          select: { id: true },
        })
      : null;
    if (tenantData?.require_cash_session && isPaymentToday(paymentDate) && !openSession && totalAmount > 0) {
      throw new Error("CASH_SESSION_REQUIRED");
    }
    const cashSessionId = openSession?.id ?? null;

    const createdPayments = [];
    for (const seg of segments) {
      const amount = Math.round((Number(seg.amount) || 0) * 100) / 100;
      if (amount <= 0) continue;
      const brand = seg.brand || "other";
      const installmentsCount = seg.installments && seg.installments > 1 ? seg.installments : 1;
      const fee = computeSegmentFee({ method: seg.method, brand, installments: installmentsCount, amount }, cardFees);
      const net = Math.round((amount - fee) * 100) / 100;

      const payment = await tx.customerDebtPayment.create({
        data: {
          tenant_id: tenantId,
          debt_id: debtId,
          installment_id: installmentId || null,
          amount,
          payment_method: seg.method,
          card_brand: (seg.method === "debit" || seg.method === "credit") ? brand : null,
          installments: seg.method === "credit" ? installmentsCount : null,
          gross_amount: amount,
          fee_amount: fee > 0 ? fee : null,
          net_amount: net,
          cash_session_id: cashSessionId,
          paid_at: paymentDate,
        },
      });
      createdPayments.push(payment);
    }

    if (cleanDiscount > 0) {
      const discountPayment = await tx.customerDebtPayment.create({
        data: {
          tenant_id: tenantId,
          debt_id: debtId,
          installment_id: installmentId || null,
          amount: cleanDiscount,
          payment_method: "discount",
          card_brand: null,
          installments: null,
          gross_amount: cleanDiscount,
          fee_amount: null,
          net_amount: cleanDiscount,
          cash_session_id: null,
          paid_at: paymentDate,
        },
      });
      createdPayments.push(discountPayment);
    }

    const updated = await synchronizeDebtBalance(tx, tenantId, debtId);

    // Registra no financeiro: o desconto NÃO entra como despesa/prejuízo ("valor perdido"),
    // entra devidamente no campo discount_amount com o gross_amount correspondente.
    const moneyPayments = createdPayments.filter((p) => p.payment_method !== "discount");
    if (moneyPayments.length > 0) {
      for (let i = 0; i < moneyPayments.length; i++) {
        const p = moneyPayments[i];
        const segDiscount = i === 0 && cleanDiscount > 0 ? cleanDiscount : null;
        const segGross = Number(p.gross_amount ?? p.amount) + (segDiscount ?? 0);
        await tx.finance.create({
          data: {
            tenant_id: tenantId,
            type: "income",
            description: `Pagamento fiado — ${customer?.name ?? "Cliente"}: ${debt.description}${segDiscount ? ` (Desconto: R$ ${segDiscount.toFixed(2)})` : ""}`,
            amount: Number(p.net_amount ?? p.amount),
            gross_amount: segGross,
            fee_amount: p.fee_amount ? Number(p.fee_amount) : null,
            discount_amount: segDiscount,
            payment_method: p.payment_method,
            source: "debt_payment",
            date: paymentDate,
          },
        });
      }
    } else if (cleanDiscount > 0) {
      await tx.finance.create({
        data: {
          tenant_id: tenantId,
          type: "income",
          description: `Desconto fiado concedido — ${customer?.name ?? "Cliente"}: ${debt.description} (Desconto: R$ ${cleanDiscount.toFixed(2)})`,
          amount: 0,
          gross_amount: cleanDiscount,
          fee_amount: null,
          discount_amount: cleanDiscount,
          payment_method: "discount",
          source: "debt_payment",
          date: paymentDate,
        },
      });
    }

    return { debt: updated, payments: createdPayments };
  });
}

