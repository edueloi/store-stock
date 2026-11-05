import assert from "node:assert/strict";
import { test } from "node:test";
import { registerDebtPaymentMulti } from "../backend/services/debt-payments.service";
import { synchronizeDebtBalance } from "../backend/services/debt-balance.service";
import { financeOrderId } from "../backend/utils/finance-order";
import { parsePaymentSegments } from "../shared/paymentSegments";

function database(total = 300, installmentAmounts = [100, 100, 100]) {
  let state = {
    debt: { id: 1, tenant_id: 11, customer_id: 2, description: "Ação — crediário", amount: total, amount_paid: 0, status: "open", paid_at: null },
    installments: installmentAmounts.map((amount, index) => ({ id: index + 1, tenant_id: 11, debt_id: 1, number: index + 1, amount, amount_paid: 0, status: "open", paid_at: null })),
    payments: [] as any[], finance: [] as any[],
  };
  const matches = (row: any, where: any) => Object.entries(where).every(([key, value]) => row[key] === value);
  let queue = Promise.resolve();
  const tx = {
    async $queryRaw() { return [{ id: 1 }]; },
    customerDebt: {
      async findFirst({ where }: any) { return matches(state.debt, where) ? { ...state.debt } : null; },
      async update({ data }: any) { Object.assign(state.debt, data); return { ...state.debt, installments: structuredClone(state.installments) }; },
    },
    customerDebtInstallment: {
      async findFirst({ where }: any) { return state.installments.find(row => matches(row, where)) ?? null; },
      async findMany() { return structuredClone(state.installments); },
      async update({ where, data }: any) { const row = state.installments.find(row => row.id === where.id)!; Object.assign(row, data); return row; },
    },
    customerDebtPayment: {
      async findMany() { return structuredClone(state.payments); },
      async create({ data }: any) { const row = { id: state.payments.length + 1, ...data }; state.payments.push(row); return row; },
    },
    customer: { async findUnique() { return { name: "Cliente de teste" }; } },
    tenant: { async findUnique() { return { card_fees: { pix: [1], visa: [5] }, require_cash_session: true }; } },
    cashSession: { async findFirst() { return { id: 88 }; } },
    finance: { async create({ data }: any) { state.finance.push(data); return data; } },
  };
  const db = { async $transaction(callback: any) {
    const previous = queue;
    let release!: () => void;
    queue = new Promise<void>(resolve => { release = resolve; });
    await previous;
    const before = structuredClone(state);
    try { return await callback(tx); } catch (error) { state = before; throw error; } finally { release(); }
  } } as any;
  return { db, tx: tx as any, get state() { return state; } };
}

test("R$ 300: recebe R$ 200, depois R$ 50 e R$ 50; só a última baixa quita", async () => {
  const store = database();
  for (const [amount, paid, status] of [[200, 200, "open"], [50, 250, "open"], [50, 300, "paid"]] as const) {
    const result = await registerDebtPaymentMulti(11, 13, 1, [{ method: "money", amount }], null, new Date(), 0, store.db);
    assert.equal(result.debt.amount_paid, paid);
    assert.equal(result.debt.status, status);
    assert.equal(store.state.installments.reduce((sum, inst) => sum + inst.amount_paid, 0), paid);
    assert.equal(store.state.finance.reduce((sum, entry) => sum + entry.amount, 0), paid);
  }
  assert.ok(store.state.installments.every(inst => inst.status === "paid"));
});

test("múltiplas formas: taxas não reduzem o abatimento da dívida", async () => {
  const store = database();
  const result = await registerDebtPaymentMulti(11, 13, 1, [{ method: "pix", amount: 100 }, { method: "credit", brand: "visa", amount: 100 }], null, new Date(), 0, store.db);
  assert.equal(result.debt.amount_paid, 200); assert.equal(result.debt.status, "open");
  assert.equal(store.state.finance.reduce((sum, entry) => sum + entry.amount, 0), 194);
  assert.ok(store.state.payments.every(payment => payment.cash_session_id === 88));
});

test("desconto é explícito: R$ 200 recebidos + R$ 50 concedidos deixam R$ 50", async () => {
  const store = database();
  const result = await registerDebtPaymentMulti(11, 13, 1, [{ method: "money", amount: 200 }], null, new Date(), 50, store.db);
  assert.equal(result.debt.amount_paid, 250); assert.equal(result.debt.status, "open");
  assert.equal(store.state.finance[0].amount, 200); assert.equal(store.state.finance[0].discount_amount, 50);
  assert.equal(store.state.payments.find(p => p.payment_method === "discount").cash_session_id, null);
});

test("parcela específica: pagamento parcial não quita parcela nem dívida", async () => {
  const store = database();
  await registerDebtPaymentMulti(11, 13, 1, [{ method: "money", amount: 40 }], 2, new Date(), 0, store.db);
  assert.equal(store.state.installments[1].amount_paid, 40); assert.equal(store.state.installments[1].status, "open");
  assert.equal(store.state.debt.amount_paid, 40); assert.equal(store.state.debt.status, "open");
});

test("estorno de recebimento geral reabre parcelas e dívida conforme histórico restante", async () => {
  const store = database();
  await registerDebtPaymentMulti(11, 13, 1, [{ method: "money", amount: 200 }], null, new Date(), 0, store.db);
  await registerDebtPaymentMulti(11, 13, 1, [{ method: "money", amount: 100 }], null, new Date(), 0, store.db);
  store.state.payments.splice(0, 1);
  await synchronizeDebtBalance(store.tx, 11, 1);
  assert.equal(store.state.debt.amount_paid, 100); assert.equal(store.state.debt.status, "open");
  assert.deepEqual(store.state.installments.map(inst => inst.amount_paid), [100, 0, 0]);
  assert.deepEqual(store.state.installments.map(inst => inst.status), ["paid", "open", "open"]);
});

test("valores inválidos, excesso e loja errada não gravam recebimentos", async () => {
  const store = database();
  for (const amount of [0, -10, NaN, Infinity, 301]) {
    await assert.rejects(registerDebtPaymentMulti(11, 13, 1, [{ method: "money", amount }], null, new Date(), 0, store.db));
  }
  await assert.rejects(registerDebtPaymentMulti(12, 13, 1, [{ method: "money", amount: 10 }], null, new Date(), 0, store.db));
  assert.equal(store.state.payments.length, 0); assert.equal(store.state.finance.length, 0);
});

test("duas confirmações do mesmo saldo registram apenas uma baixa", async () => {
  const store = database();
  const results = await Promise.allSettled([1, 2].map(() => registerDebtPaymentMulti(11, 13, 1, [{ method: "money", amount: 100 }], null, new Date(), 0, store.db, 300)));
  assert.equal(results.filter(result => result.status === "fulfilled").length, 1);
  assert.equal(store.state.debt.amount_paid, 100); assert.equal(store.state.payments.length, 1);
});

test("retroativo não entra no caixa de hoje; centavos são preservados", async () => {
  const store = database(0.3, [0.3]);
  await registerDebtPaymentMulti(11, 13, 1, [{ method: "money", amount: 0.1 }, { method: "pix", amount: 0.2 }], null, new Date("2025-01-01T12:00:00Z"), 0, store.db);
  assert.equal(store.state.debt.amount_paid, 0.3); assert.equal(store.state.debt.status, "paid");
  assert.ok(store.state.payments.every(payment => payment.cash_session_id === null));
});

test("editar receita de crediário não altera o pedido citado na descrição", () => {
  assert.equal(financeOrderId({ source: "debt_payment", description: "Pagamento fiado — Valmir: Venda PDV #1421" }), null);
  assert.equal(financeOrderId({ source: "debt_payment_reversal", order_id: 1421 }), null);
  assert.equal(financeOrderId({ description: "Pagamento fiado — Valmir: Venda PDV #1421" }), null);
  assert.equal(financeOrderId({ source: "pdv", order_id: 2296 }), 2296);
  assert.equal(financeOrderId({ description: "Venda PDV #2296 — PIX" }), 2296);
});

test("relatório e fechamento incluem formas sem valor embutido e descontam troco uma vez", () => {
  assert.equal(parsePaymentSegments("pix", 6.5)[0].amount, 6.5);
  assert.equal(parsePaymentSegments("debit-visa", 24.64)[0].amount, 24.64);
  assert.equal(parsePaymentSegments("money", 3, 2)[0].amount - 2, 3);
  assert.equal(parsePaymentSegments("money:5.00", 3, 2)[0].amount - 2, 3);
  assert.equal(parsePaymentSegments("pix:0", 6.5)[0].amount, 0);
  assert.deepEqual(parsePaymentSegments("pix|money", 10).map(seg => seg.amount), [0, 0]);
});
