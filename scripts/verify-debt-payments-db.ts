import "dotenv/config";
import assert from "node:assert/strict";
import { prisma } from "../backend/config/prisma";
import { registerDebtPaymentMulti } from "../backend/services/debt-payments.service";
import { synchronizeDebtBalance } from "../backend/services/debt-balance.service";

// Executar explicitamente com tenant e operador. Todos os dados de teste são
// criados na mesma transação e revertidos mesmo quando as verificações passam.
const tenantId = Number(process.argv[2]);
const userId = Number(process.argv[3]);
assert.ok(tenantId > 0 && userId > 0, "Informe tenant e operador");
const rollback = new Error("ROLLBACK_TEST");
let customerId = 0;
try {
  await prisma.$transaction(async tx => {
    const customer = await tx.customer.create({ data: { tenant_id: tenantId, name: "Teste transacional — não persistir" } });
    customerId = customer.id;
    const debt = await tx.customerDebt.create({ data: { tenant_id: tenantId, customer_id: customer.id, description: "Teste de saldo parcial", amount: 300 } });
    for (let number = 1; number <= 3; number++) {
      await tx.customerDebtInstallment.create({ data: { tenant_id: tenantId, debt_id: debt.id, number, amount: 100, due_date: new Date() } });
    }
    const database = { $transaction: (fn: (client: typeof tx) => unknown) => fn(tx) } as unknown as typeof prisma;
    const pay = (amount: number, expectedRemaining: number) => registerDebtPaymentMulti(tenantId, userId, debt.id,
      [{ method: "money", amount }], null, new Date(), 0, database, expectedRemaining);
    const partial = await pay(200, 300);
    assert.equal(Number(partial.debt.amount_paid), 200);
    assert.equal(partial.debt.status, "open");
    assert.deepEqual(partial.debt.installments.map(inst => Number(inst.amount_paid)), [100, 100, 0]);
    await assert.rejects(pay(50, 300), /BALANCE_CHANGED/);
    const partialAgain = await pay(50, 100);
    assert.equal(Number(partialAgain.debt.amount_paid), 250);
    assert.equal(partialAgain.debt.status, "open");
    const completed = await pay(50, 50);
    assert.equal(completed.debt.status, "paid");
    assert.ok(completed.debt.installments.every(inst => inst.status === "paid"));
    await tx.customerDebtPayment.delete({ where: { id: partial.payments[0].id } });
    const reversed = await synchronizeDebtBalance(tx, tenantId, debt.id);
    assert.equal(Number(reversed.amount_paid), 100);
    assert.equal(reversed.status, "open");
    assert.deepEqual(reversed.installments.map(inst => Number(inst.amount_paid)), [100, 0, 0]);
    const entries = await tx.finance.findMany({ where: { tenant_id: tenantId, description: { contains: "Teste de saldo parcial" } } });
    assert.equal(entries.length, 3);
    assert.equal(entries.reduce((sum, entry) => sum + Number(entry.amount), 0), 300);
    throw rollback;
  }, { timeout: 30000 });
} catch (error) {
  if (error !== rollback) throw error;
} finally {
  const customer = customerId ? await prisma.customer.findUnique({ where: { id: customerId } }) : null;
  await prisma.$disconnect();
  assert.equal(customer, null, "O teste não deve persistir dados");
}
console.log("MySQL: pagamentos parciais, quitação, saldo desatualizado e estorno verificados; transação revertida.");
