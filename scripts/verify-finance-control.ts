import assert from "node:assert/strict";
import { test } from "node:test";
import { saveFinanceAccount, settleFinanceAccounts, accountDate } from "../backend/services/finance-accounts.service";
import { generateInstallments } from "../backend/utils/finance-series";
import { controlAccounts } from "../src/lib/account-control";
import { parseCurrencyPaste, formatCurrencyInput } from "../src/components/finance/CurrencyInput";

type Row = Record<string, any>;
function memoryDatabase() {
  let records: Row[] = [], series: Row[] = [], nextId = 1;
  const matches = (row: Row, where: Row = {}) => Object.entries(where).every(([key, value]) => typeof value === "object" && value !== null && "in" in value ? value.in.includes(row[key]) : row[key] === value);
  const ledger = {
    async findFirst({ where }: Row) { return records.find(row => matches(row, where)) || null; },
    async findMany({ where }: Row) { return records.filter(row => matches(row, where)).sort((a,b) => (a.installment_number || 0) - (b.installment_number || 0)); },
    async create({ data }: Row) { const row = { id: nextId++, status: "pending", series_id: null, interest_amount: 0, updated_at: new Date("2026-10-20T01:00:00.123Z"), ...data }; records.push(row); return row; },
    async update({ where, data }: Row) { const row = records.find(row => matches(row, where)); assert.ok(row); Object.assign(row, data); return row; },
    async updateMany({ where, data }: Row) { const found = records.filter(row => matches(row, where)); found.forEach(row => Object.assign(row, data)); return { count: found.length }; },
    async deleteMany({ where }: Row) { const old = records.length; records = records.filter(row => !matches(row, where)); return { count: old-records.length }; },
  };
  const tx = { accountPayable: ledger, accountReceivable: ledger, financeSeries: {
    async create({ data }: Row) { const row = { id: series.length+1, ...data }; series.push(row); return row; },
    async findFirst({ where }: Row) { return series.find(row => matches(row,where)) || null; },
    async update({ where, data }: Row) { const row = series.find(row => matches(row,where)); assert.ok(row); Object.assign(row,data); return row; },
  }};
  return { get rows() { return records; }, get series() { return series; }, database: { async $transaction(callback: (tx: unknown) => any) { const snapshot = structuredClone({ records,series,nextId }); try { return await callback(tx); } catch(error) { records=snapshot.records; series=snapshot.series; nextId=snapshot.nextId; throw error; } } } as any };
}
const base = { description: "Energia — Ação", amount: 150, due_date: "2026-01-31", payment_method: "pix", document_number: "NF-123", cost_center: "Operação" };
const plan = (mode = "per_installment", count = 10) => ({ installments_count: count, interval_unit: "month", interval_count: 1, value_mode: mode });

test("máscara brasileira e colagem de valores", () => {
  assert.equal(formatCurrencyInput("1234.56"), "1.234,56");
  assert.equal(formatCurrencyInput(""), "");
  for (const text of ["R$ 1.234,56", "1234.56", "1234,56"]) assert.equal(parseCurrencyPaste(text), "1234.56");
  assert.equal(parseCurrencyPaste("150"), "150.00");
  assert.equal(parseCurrencyPaste("1.500"), "1500.00");
  assert.equal(parseCurrencyPaste("-10"), null);
});
test("datas inválidas e vencimento no último dia do mês", () => {
  assert.throws(() => accountDate("2026-02-31"));
  assert.throws(() => accountDate(new Date("invalid")));
  const rows = generateInstallments(100, accountDate("2026-01-31"), plan("fixed", 3) as any);
  assert.deepEqual(rows.map(row => row.amount), [33.33,33.33,33.34]);
  assert.deepEqual(rows.map(row => row.due_date.toISOString().slice(0,10)), ["2026-01-31","2026-02-28","2026-03-31"]);
});
for (const kind of ["payable", "receivable"] as const) {
  test(`${kind}: R$ 150 por parcela gera 10 de R$ 150, total R$ 1.500`, async () => {
    const db = memoryDatabase(); await saveFinanceAccount(kind, 7, { ...base, recurrence: plan() }, undefined, db.database);
    assert.equal(db.rows.length,10); assert.ok(db.rows.every(row => row.amount === 150));
    assert.equal(db.series[0].total_amount,1500); assert.equal(db.series[0].value_mode,"per_installment");
    assert.ok(db.rows.every(row => row.payment_method === "pix" && row.cost_center === "Operação" && row.tenant_id === 7));
  });
  test(`${kind}: total e valores personalizados preservam centavos e rejeitam soma divergente`, async () => {
    const db = memoryDatabase();
    await saveFinanceAccount(kind,7,{ ...base, amount:100, recurrence:plan("fixed",3) },undefined,db.database);
    assert.deepEqual(db.rows.map(row=>row.amount),[33.33,33.33,33.34]);
    await assert.rejects(saveFinanceAccount(kind,7,{ ...base,recurrence:{...plan("variable",2),amounts:[40,50]} },undefined,db.database));
    assert.equal(db.rows.length,3);
  });
  test(`${kind}: edição em grupo preserva parcelas baixadas e verifica concorrência`, async () => {
    const db = memoryDatabase(); await saveFinanceAccount(kind,7,{...base,recurrence:plan("per_installment",3)},undefined,db.database);
    await settleFinanceAccounts(kind,7,[1],{continue_recurring:false},db.database);
    const before = structuredClone(db.rows[0]);
    await saveFinanceAccount(kind,7,{...base,amount:200,edit_scope:"pending_series",expected_pending:db.rows.slice(1).map(row=>({id:row.id,updated_at:row.updated_at.toISOString()})),recurrence:plan("per_installment",2)},2,db.database);
    assert.deepEqual(db.rows[0],before); assert.deepEqual(db.rows.map(row=>row.amount),[150,200,200]); assert.equal(db.series[0].total_amount,550);
    await assert.rejects(saveFinanceAccount(kind,7,{...base,edit_scope:"pending_series",expected_pending:[],recurrence:plan("fixed",2)},2,db.database),{status:409});
    await assert.rejects(saveFinanceAccount(kind,99,{...base},2,db.database),{status:404});
    await assert.rejects(saveFinanceAccount(kind,7,{...base,expected_updated_at:"2020-01-01"},2,db.database),{status:409});
    await saveFinanceAccount(kind,7,{...base,expected_updated_at:db.rows[1].updated_at.toISOString()},2,db.database);
  });
  test(`${kind}: baixa variável ajusta a ocorrência e cria uma só próxima estimativa`, async () => {
    const db = memoryDatabase(); await saveFinanceAccount(kind,7,{...base,is_recurring:true,recurrence_interval_unit:"month",recurrence_value_mode:"variable"},undefined,db.database);
    const result = await settleFinanceAccounts(kind,7,[1],{amount:180.55,payment_method:"boleto",expected_updated_at:db.rows[0].updated_at.toISOString()},db.database);
    assert.equal(result.count,1); assert.equal(db.rows[0].amount,180.55); assert.equal(db.rows[1].amount,180.55); assert.equal(db.rows[1].payment_method,"boleto");
    const repeated = await settleFinanceAccounts(kind,7,[1],{amount:190},db.database); assert.equal(repeated.count,0); assert.equal(db.rows.length,2);
    await settleFinanceAccounts(kind,7,[2],{amount:175,continue_recurring:false},db.database); assert.equal(db.rows.length,2);
  });
  test(`${kind}: recorrência fixa não permite alteração do valor na baixa`, async () => {
    const db=memoryDatabase(); await saveFinanceAccount(kind,7,{...base,is_recurring:true,recurrence_interval_unit:"month",recurrence_value_mode:"fixed"},undefined,db.database);
    await assert.rejects(settleFinanceAccounts(kind,7,[1],{amount:200},db.database)); assert.equal(db.rows[0].status,"pending");
  });
}
test("controle filtra documentos, acentos, vencidos e valores", () => {
  const rows = [{...base,id:1,status:"pending",due_date:"2020-01-01",amount:150}, {...base,id:2,status:"paid",due_date:"2020-01-01",amount:200}];
  const filter={search:"operacao",category:"",kind:"all",due:"overdue",sort:"amount_desc"};
  const result=controlAccounts(rows,filter); assert.deepEqual(result.map(row=>row.id),[1]); assert.equal(result[0].status,"overdue");
});
