import type { Prisma } from "@prisma/client";

// O histórico de recebimentos e descontos é a fonte do saldo. Taxas de cartão
// diminuem a receita da loja, nunca o valor abatido da dívida do cliente.
export async function synchronizeDebtBalance(tx: Prisma.TransactionClient, tenantId: number, debtId: number) {
  const debt = await tx.customerDebt.findFirst({ where: { id: debtId, tenant_id: tenantId } });
  if (!debt) throw new Error("NOT_FOUND");
  const payments = await tx.customerDebtPayment.findMany({
    where: { tenant_id: tenantId, debt_id: debtId }, orderBy: [{ paid_at: "asc" }, { id: "asc" }],
  });
  const installments = await tx.customerDebtInstallment.findMany({
    where: { tenant_id: tenantId, debt_id: debtId }, orderBy: { number: "asc" },
  });
  const cents = (value: unknown) => Math.round(Number(value) * 100);
  const totalPaid = payments.reduce((sum, payment) => sum + cents(payment.amount), 0);
  if (totalPaid > cents(debt.amount)) throw new Error("INVALID_AMOUNT");
  const allocations = new Map(installments.map(inst => [inst.id, { amount: 0, paidAt: null as Date | null }]));
  // Primeiro respeita pagamentos destinados a uma parcela. Os recebimentos
  // gerais são distribuídos nas parcelas restantes em ordem de vencimento.
  for (const payment of [...payments.filter(p => p.installment_id), ...payments.filter(p => !p.installment_id)]) {
    let remaining = cents(payment.amount);
    const targets = payment.installment_id ? installments.filter(inst => inst.id === payment.installment_id) : installments;
    for (const inst of targets) {
      const allocation = allocations.get(inst.id)!;
      const applied = Math.min(remaining, cents(inst.amount) - allocation.amount);
      if (applied <= 0) continue;
      allocation.amount += applied;
      allocation.paidAt = !allocation.paidAt || payment.paid_at > allocation.paidAt ? payment.paid_at : allocation.paidAt;
      remaining -= applied;
    }
    if (installments.length && remaining > 0) throw new Error("INVALID_AMOUNT");
  }
  for (const inst of installments) {
    const allocation = allocations.get(inst.id)!;
    const paid = allocation.amount >= cents(inst.amount);
    await tx.customerDebtInstallment.update({ where: { id: inst.id }, data: {
      amount_paid: allocation.amount / 100, status: paid ? "paid" : "open", paid_at: paid ? allocation.paidAt : null,
    } });
  }
  const paid = totalPaid >= cents(debt.amount);
  return tx.customerDebt.update({ where: { id: debtId }, data: {
    amount_paid: totalPaid / 100, status: paid ? "paid" : "open", paid_at: paid ? payments.at(-1)?.paid_at ?? null : null,
  }, include: { installments: { orderBy: { number: "asc" } } } });
}
