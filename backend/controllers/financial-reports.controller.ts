import type { Request, Response } from "express";
import { prisma } from "../config/prisma";
import type { AuthenticatedRequest } from "../types/auth";
import { parsePaymentMethod } from "./finance.controller";

function getTenantId(req: Request) {
  return (req as AuthenticatedRequest).user.tenantId;
}

const PM_KEYS = ["money", "pix", "debit", "credit"] as const;
type PmKey = (typeof PM_KEYS)[number];
function pmKey(method: string): PmKey {
  return (PM_KEYS as readonly string[]).includes(method) ? (method as PmKey) : "money";
}

interface CostItem {
  description: string;
  amount: number;
  date: string; // YYYY-MM-DD
  source: "financeiro" | "contas_pagar";
}

interface EntradasBucket {
  byOperator: Record<string, Record<PmKey, number>>;
  totalByMethod: Record<PmKey, number>;
  total: number;
}

interface MonthReport {
  year: number;
  month: number; // 0-based
  entradas: EntradasBucket;
  // Mesma estrutura de `entradas`, só que uma por dia do mês (chave = dia 1-31) —
  // permite a visão "Dia" sem precisar de outra ida ao banco.
  entradasByDay: Record<number, EntradasBucket>;
  custoFixo: { total: number; items: CostItem[] };
  custoVariavel: { total: number; items: CostItem[] };
}

function emptyPmTotals(): Record<PmKey, number> {
  return { money: 0, pix: 0, debit: 0, credit: 0 };
}

function emptyEntradasBucket(): EntradasBucket {
  return { byOperator: {}, totalByMethod: emptyPmTotals(), total: 0 };
}

function emptyMonth(year: number, month: number): MonthReport {
  return {
    year,
    month,
    entradas: emptyEntradasBucket(),
    entradasByDay: {},
    custoFixo: { total: 0, items: [] },
    custoVariavel: { total: 0, items: [] },
  };
}

function addEntry(bucket: EntradasBucket, operator: string, key: PmKey, amt: number) {
  if (!bucket.byOperator[operator]) bucket.byOperator[operator] = emptyPmTotals();
  bucket.byOperator[operator][key] += amt;
  bucket.totalByMethod[key] += amt;
  bucket.total += amt;
}

// Busca e monta o relatório do ano inteiro numa passada só (em vez de 12 idas ao banco) —
// o front pode navegar entre meses do mesmo ano sem nova requisição, e a aba "Resumo Anual"
// usa os mesmos totais já calculados aqui.
export async function getYearlyFinancialReport(req: Request, res: Response) {
  try {
    const tenantId = getTenantId(req);
    const year = Number(req.params.year) || new Date().getFullYear();
    const from = new Date(Date.UTC(year, 0, 1));
    const to = new Date(Date.UTC(year + 1, 0, 1));

    const months: MonthReport[] = Array.from({ length: 12 }, (_, m) => emptyMonth(year, m));

    const [incomeEntries, expenseEntries, paidPayables] = await Promise.all([
      prisma.finance.findMany({
        where: { tenant_id: tenantId, type: "income", date: { gte: from, lt: to } },
        select: { amount: true, payment_method: true, order_id: true, date: true },
      }),
      prisma.finance.findMany({
        where: { tenant_id: tenantId, type: "expense", cost_type: { not: null }, date: { gte: from, lt: to } },
        select: { description: true, amount: true, cost_type: true, date: true },
      }),
      prisma.accountPayable.findMany({
        where: { tenant_id: tenantId, status: "paid", cost_type: { not: null }, paid_date: { gte: from, lt: to } },
        select: { description: true, amount: true, cost_type: true, paid_date: true },
      }),
    ]);

    // Nomes de operador vêm de Order.seller_name — só buscamos as orders realmente
    // referenciadas pelas entradas (evita puxar a tabela toda).
    const orderIds = Array.from(new Set(incomeEntries.map(e => e.order_id).filter((id): id is number => id != null)));
    const orders = orderIds.length
      ? await prisma.order.findMany({ where: { id: { in: orderIds }, tenant_id: tenantId }, select: { id: true, seller_name: true } })
      : [];
    const sellerByOrder = new Map(orders.map(o => [o.id, o.seller_name || "Geral"]));

    for (const entry of incomeEntries) {
      const entryDate = new Date(entry.date);
      const m = entryDate.getUTCMonth();
      const day = entryDate.getUTCDate();
      const operator = entry.order_id != null ? (sellerByOrder.get(entry.order_id) ?? "Geral") : "Geral";
      const segs = parsePaymentMethod(entry.payment_method || "money");
      if (!months[m].entradasByDay[day]) months[m].entradasByDay[day] = emptyEntradasBucket();
      for (const seg of segs) {
        const key = pmKey(seg.method);
        const amt = seg.amount > 0 ? seg.amount : Number(entry.amount);
        addEntry(months[m].entradas, operator, key, amt);
        addEntry(months[m].entradasByDay[day], operator, key, amt);
      }
    }

    for (const e of expenseEntries) {
      const m = new Date(e.date).getUTCMonth();
      const target = e.cost_type === "fixed" ? months[m].custoFixo : months[m].custoVariavel;
      const amount = Number(e.amount);
      target.total += amount;
      target.items.push({ description: e.description, amount, date: new Date(e.date).toISOString().substring(0, 10), source: "financeiro" });
    }

    for (const p of paidPayables) {
      if (!p.paid_date) continue;
      const m = new Date(p.paid_date).getUTCMonth();
      const target = p.cost_type === "fixed" ? months[m].custoFixo : months[m].custoVariavel;
      const amount = Number(p.amount);
      target.total += amount;
      target.items.push({ description: p.description, amount, date: new Date(p.paid_date).toISOString().substring(0, 10), source: "contas_pagar" });
    }

    res.json({ year, months });
  } catch (err) {
    console.error("[getYearlyFinancialReport]", err);
    res.status(500).json({ error: "Failed to build financial report" });
  }
}
