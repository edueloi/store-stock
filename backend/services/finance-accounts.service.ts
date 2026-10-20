import type { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma";
import { advanceDate, generateInstallments, type IntervalUnit, type RecurrenceInput } from "../utils/finance-series";

type Kind = "payable" | "receivable";
type Data = Record<string, unknown>;
type Row = Data & { id: number; status: string; amount: unknown; due_date: Date; series_id: number | null; installment_number: number | null; is_recurring: boolean };
interface Ledger {
  findFirst(args: Data): Promise<Row | null>;
  findMany(args: Data): Promise<Row[]>;
  create(args: Data): Promise<Row>;
  update(args: Data): Promise<Row>;
  updateMany(args: Data): Promise<{ count: number }>;
  deleteMany(args: Data): Promise<{ count: number }>;
}
export class AccountValidationError extends Error {
  constructor(message: string, public status = 422) { super(message); }
}
const fail = (message: string): never => { throw new AccountValidationError(message); };
const repo = (tx: Prisma.TransactionClient, kind: Kind) => (kind === "payable" ? tx.accountPayable : tx.accountReceivable) as unknown as Ledger;
const money = (value: unknown) => {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0 || number > 99999999.99 || Math.abs(number * 100 - Math.round(number * 100)) > .0001) fail("Informe um valor positivo com até duas casas decimais.");
  return Math.round(number * 100) / 100;
};
export const accountDate = (value: unknown) => {
  if (value instanceof Date && Number.isNaN(value.getTime())) fail("Informe uma data válida.");
  const text = value instanceof Date ? value.toISOString().slice(0, 10) : String(value || "").slice(0, 10);
  const date = new Date(text + "T12:00:00Z");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== text) fail("Informe uma data válida.");
  return date;
};
const integer = (value: unknown, min: number, max: number, label: string) => {
  const number = Number(value);
  if (!Number.isInteger(number) || number < min || number > max) fail(`${label}: informe um número de ${min} a ${max}.`);
  return number;
};
const optionalText = (value: unknown, max = 191) => {
  if (value == null || value === "") return null;
  if (typeof value !== "string" || value.trim().length > max) fail(`Texto inválido ou maior que ${max} caracteres.`);
  return (value as string).trim() || null;
};
function accountData(body: Data, kind: Kind): Data {
  const description = optionalText(body.description, 191);
  if (!description) fail("Informe a descrição da conta.");
  const data: Data = { description, amount: money(body.amount), due_date: accountDate(body.due_date) };
  for (const field of ["category", kind === "payable" ? "supplier_name" : "customer_name", "payment_method", "document_number", "cost_center"]) data[field] = optionalText(body[field]);
  for (const field of ["notes", "payment_details"]) data[field] = optionalText(body[field], 10000);
  if (kind === "payable") {
    if (body.cost_type != null && body.cost_type !== "" && !["fixed", "variable"].includes(String(body.cost_type))) fail("Classificação do custo inválida.");
    data.cost_type = body.cost_type || null;
  }
  data.is_recurring = body.is_recurring === true;
  if (data.is_recurring) {
    if (!["day", "week", "month"].includes(String(body.recurrence_interval_unit))) fail("Unidade da recorrência inválida.");
    data.recurrence_interval_unit = body.recurrence_interval_unit;
    data.recurrence_interval_count = integer(body.recurrence_interval_count ?? 1, 1, 3650, "Intervalo");
    data.recurrence_value_mode = body.recurrence_value_mode === "fixed" ? "fixed" : "variable";
  } else Object.assign(data, { recurrence_interval_unit: null, recurrence_interval_count: null, recurrence_value_mode: null });
  return data;
}
function plan(body: Data, recurrence: Data) {
  const config: RecurrenceInput = {
    installments_count: integer(recurrence.installments_count, 1, 360, "Parcelas"),
    interval_count: integer(recurrence.interval_count ?? 1, 1, 3650, "Intervalo"),
    interval_unit: recurrence.interval_unit as IntervalUnit,
    value_mode: recurrence.value_mode === "per_installment" ? "per_installment" : recurrence.value_mode === "variable" ? "variable" : "fixed",
    amounts: Array.isArray(recurrence.amounts) ? recurrence.amounts.map(money) : undefined,
  };
  const rate = Number(recurrence.interest_rate ?? 0);
  if (!Number.isFinite(rate) || rate < 0 || rate > 999.99) fail("Taxa de juros inválida.");
  const settings = { interval_unit: config.interval_unit, interval_count: config.interval_count, value_mode: config.value_mode,
    interest_rate: rate, interest_period: recurrence.interest_period === "day" ? "day" : "month",
    interest_grace_days: integer(recurrence.interest_grace_days ?? 0, 0, 3650, "Carência") };
  try { return { rows: generateInstallments(Number(body.amount), body.due_date as Date, config), settings }; }
  catch (error) { throw new AccountValidationError(error instanceof Error ? error.message : "Parcelamento inválido."); }
}
async function atomic<T>(database: typeof prisma, action: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try { return await database.$transaction(action, { isolationLevel: "Serializable", timeout: 15000 }); }
    catch (error) { if (attempt < 2 && (error as { code?: string }).code === "P2034") continue; throw error; }
  }
}

/** Um lançamento, conversão para parcelas ou revisão explícita das parcelas ainda pendentes. */
export async function saveFinanceAccount(kind: Kind, tenantId: number, input: Data, id?: number, database = prisma) {
  if (id !== undefined) integer(id, 1, 2147483647, "Conta");
  return atomic(database, async tx => {
    const accounts = repo(tx, kind);
    const existing = id ? await accounts.findFirst({ where: { id, tenant_id: tenantId } }) : null;
    if (id && !existing) throw new AccountValidationError("Conta não encontrada.", 404);
    if (existing && input.expected_updated_at && new Date(String(input.expected_updated_at)).getTime() !== new Date(existing.updated_at as string).getTime()) throw new AccountValidationError("Esta conta foi alterada. Atualize a lista e revise os dados antes de salvar.", 409);
    const data = accountData({ ...existing, ...input }, kind);
    const recurrence = input.recurrence as Data | undefined;
    if (!recurrence) {
      if (existing?.series_id && input.is_recurring === true) fail("Revise o parcelamento antes de alterar o tipo de uma parcela.");
      const saved = existing ? await accounts.update({ where: { id: existing.id }, data }) : await accounts.create({ data: { ...data, tenant_id: tenantId } });
      if (existing?.series_id) {
        const rows = await accounts.findMany({ where: { tenant_id: tenantId, series_id: existing.series_id } });
        await tx.financeSeries.update({ where: { id: existing.series_id }, data: { total_amount: rows.reduce((sum, row) => sum + Math.round(Number(row.amount) * 100), 0) / 100 } });
      }
      return saved;
    }
    if (typeof recurrence !== "object" || Array.isArray(recurrence)) fail("Parcelamento inválido.");
    if (existing && existing.status !== "pending") fail("Uma conta já baixada ou cancelada não pode ser transformada em parcelas.");
    Object.assign(data, { is_recurring: false, recurrence_interval_unit: null, recurrence_interval_count: null, recurrence_value_mode: null });
    const { rows, settings } = plan(data, recurrence);
    const party = kind === "payable" ? data.supplier_name : data.customer_name;
    const seriesData = { description: String(data.description), category: data.category as string | null, party_name: party as string | null,
      notes: data.notes as string | null, ...settings };
    if (existing?.series_id) {
      if (input.edit_scope !== "pending_series") fail("Selecione a revisão das parcelas pendentes para alterar o parcelamento.");
      const series = await tx.financeSeries.findFirst({ where: { id: existing.series_id, tenant_id: tenantId, kind } });
      if (!series) throw new AccountValidationError("Parcelamento não encontrado.", 404);
      const all = await accounts.findMany({ where: { tenant_id: tenantId, series_id: series.id }, orderBy: { installment_number: "asc" } });
      const pending = all.filter(row => row.status === "pending");
      const locked = all.filter(row => row.status !== "pending");
      if (Array.isArray(input.expected_pending)) {
        const expected = input.expected_pending as { id: number; updated_at: string }[];
        if (expected.length !== pending.length || pending.some(row => !expected.some(item => item.id === row.id && new Date(item.updated_at).getTime() === new Date(row.updated_at as string).getTime()))) throw new AccountValidationError("As parcelas foram alteradas ou baixadas. Atualize a lista e revise o parcelamento.", 409);
      }
      if (locked.length && rows.length !== pending.length) fail("Há parcelas baixadas ou canceladas. Mantenha a quantidade e altere somente datas e valores das pendentes.");
      if (pending.some(row => Number(row.interest_amount) > 0)) fail("Há juros já aplicados. Edite essas parcelas individualmente para preservar o histórico.");
      if (!locked.length) await accounts.updateMany({ where: { tenant_id: tenantId, series_id: series.id, status: "pending" }, data: { installment_number: null } });
      const saved: Row[] = [];
      for (let index = 0; index < rows.length; index++) {
        const row = { ...data, amount: rows[index].amount, due_date: rows[index].due_date, installment_number: locked.length ? pending[index].installment_number : index + 1 };
        saved.push(index < pending.length ? await accounts.update({ where: { id: pending[index].id }, data: row }) : await accounts.create({ data: { ...row, series_id: series.id, tenant_id: tenantId } }));
      }
      if (rows.length < pending.length) await accounts.deleteMany({ where: { tenant_id: tenantId, status: "pending", id: { in: pending.slice(rows.length).map(row => row.id) } } });
      const total = [...locked, ...saved].reduce((sum, row) => sum + Math.round(Number(row.amount) * 100), 0) / 100;
      await tx.financeSeries.update({ where: { id: series.id }, data: { ...seriesData, total_amount: total, installments_count: locked.length ? series.installments_count : rows.length } });
      return { installments: saved, updated_count: saved.length };
    }
    if (rows.length < 2) fail("Um novo parcelamento precisa ter pelo menos duas parcelas.");
    const total = rows.reduce((sum, row) => sum + Math.round(row.amount * 100), 0) / 100;
    const series = await tx.financeSeries.create({ data: { ...seriesData, tenant_id: tenantId, kind, total_amount: total, installments_count: rows.length } });
    const saved: Row[] = [];
    for (let index = 0; index < rows.length; index++) {
      const row = { ...data, amount: rows[index].amount, due_date: rows[index].due_date, series_id: series.id, installment_number: index + 1 };
      saved.push(index === 0 && existing ? await accounts.update({ where: { id: existing.id }, data: row }) : await accounts.create({ data: { ...row, tenant_id: tenantId } }));
    }
    return { installments: saved };
  });
}

/** A baixa é atômica e idempotente: repetir a solicitação não cria outra recorrência. */
export async function settleFinanceAccounts(kind: Kind, tenantId: number, inputIds: number[], input: Data, database = prisma) {
  const ids = [...new Set(inputIds.map(id => integer(id, 1, 2147483647, "Conta")))];
  if (!ids.length || ids.length > 500) fail("Selecione de 1 a 500 contas.");
  const dateField = kind === "payable" ? "paid_date" : "received_date";
  const status = kind === "payable" ? "paid" : "received";
  const date = accountDate(input[dateField] || new Date());
  return atomic(database, async tx => {
    const accounts = repo(tx, kind);
    const found = await accounts.findMany({ where: { tenant_id: tenantId, id: { in: ids } } });
    if (ids.length === 1 && !found.length) throw new AccountValidationError("Conta não encontrada.", 404);
    let count = 0;
    for (const existing of found) {
      if (existing.status !== "pending") continue;
      if (input.expected_updated_at && new Date(String(input.expected_updated_at)).getTime() !== new Date(existing.updated_at as string).getTime()) throw new AccountValidationError("Esta conta foi alterada. Atualize a lista antes de confirmar a baixa.", 409);
      let amount = Number(existing.amount);
      if (input.amount !== undefined) {
        if (ids.length !== 1 || !existing.is_recurring || existing.recurrence_value_mode === "fixed") fail("O valor na baixa só pode ser ajustado em uma recorrência variável.");
        amount = money(input.amount);
        if (amount <= Number(existing.interest_amount || 0)) fail("O valor da ocorrência precisa ser maior que os juros já aplicados.");
      }
      const payment = input.payment_method === undefined ? {} : { payment_method: optionalText(input.payment_method) };
      const update = await accounts.updateMany({ where: { id: existing.id, tenant_id: tenantId, status: "pending" }, data: { status, [dateField]: date, amount, ...payment } });
      if (!update.count) continue;
      count++;
      if (existing.is_recurring && existing.recurrence_interval_unit && input.continue_recurring !== false) {
        const next = accountData(existing, kind);
        next.amount = money(Math.max(.01, (Math.round(amount * 100) - Math.round(Number(existing.interest_amount || 0) * 100)) / 100));
        next.due_date = advanceDate(new Date(existing.due_date), existing.recurrence_interval_unit as IntervalUnit, Number(existing.recurrence_interval_count) || 1);
        await accounts.create({ data: { ...next, ...payment, tenant_id: tenantId } });
      }
    }
    return { count, items: await accounts.findMany({ where: { tenant_id: tenantId, id: { in: ids } } }) };
  });
}
