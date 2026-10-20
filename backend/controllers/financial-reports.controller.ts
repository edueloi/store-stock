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
  /** Conta a pagar ainda não paga: entra no mês do vencimento. */
  pending?: boolean;
  /** Lançamento sem Fixo/Variável definido: somado em Custo Variável até ser classificado. */
  unclassified?: boolean;
}

interface ReceivableItem {
  description: string;
  customer: string | null;
  amount: number;
  date: string; // vencimento, YYYY-MM-DD
  /** Vencimento anterior a hoje e ainda não recebida. */
  overdue: boolean;
}

interface ReceberBucket { total: number; overdueTotal: number; items: ReceivableItem[] }

interface EntradasBucket {
  byOperator: Record<string, Record<PmKey, number>>;
  totalByMethod: Record<PmKey, number>;
  total: number;
}

// Origem da venda que gerou a entrada — espelha Order.order_type ("products" |
// "services" | "mixed"), permitindo o relatório separar Catálogo de Serviço ou
// somar os dois juntos (bucket "todas").
type OrigemKey = "produtos" | "servicos" | "mista";

interface MonthReport {
  year: number;
  month: number; // 0-based
  entradas: EntradasBucket;
  // Mesma estrutura de `entradas`, só que uma por dia do mês (chave = dia 1-31) —
  // permite a visão "Dia" sem precisar de outra ida ao banco.
  entradasByDay: Record<number, EntradasBucket>;
  // Entradas separadas por origem da venda (produto/serviço/mista) — mesma
  // estrutura de `entradas`/`entradasByDay`, para o filtro Tudo/Catálogo/Serviço.
  entradasByOrigem: Record<OrigemKey, EntradasBucket>;
  entradasByDayByOrigem: Record<number, Record<OrigemKey, EntradasBucket>>;
  // Custo das mercadorias vendidas (qtd × cost_price do catálogo), por origem e por dia.
  cmvByOrigem: Record<OrigemKey, number>;
  cmvByDayByOrigem: Record<number, Record<OrigemKey, number>>;
  custoFixo: { total: number; items: CostItem[] };
  custoVariavel: { total: number; items: CostItem[] };
  // Contas a Receber ainda não recebidas, no mês do vencimento. Não entram no Resultado (não é dinheiro recebido).
  aReceber: ReceberBucket;
}

function emptyPmTotals(): Record<PmKey, number> {
  return { money: 0, pix: 0, debit: 0, credit: 0 };
}

function emptyEntradasBucket(): EntradasBucket {
  return { byOperator: {}, totalByMethod: emptyPmTotals(), total: 0 };
}

function emptyEntradasByOrigem(): Record<OrigemKey, EntradasBucket> {
  return { produtos: emptyEntradasBucket(), servicos: emptyEntradasBucket(), mista: emptyEntradasBucket() };
}

function emptyMonth(year: number, month: number): MonthReport {
  return {
    year,
    month,
    entradas: emptyEntradasBucket(),
    entradasByDay: {},
    entradasByOrigem: emptyEntradasByOrigem(),
    entradasByDayByOrigem: {},
    cmvByOrigem: { produtos: 0, servicos: 0, mista: 0 },
    cmvByDayByOrigem: {},
    custoFixo: { total: 0, items: [] },
    custoVariavel: { total: 0, items: [] },
    aReceber: { total: 0, overdueTotal: 0, items: [] },
  };
}

function origemKey(orderType: string | null | undefined): OrigemKey {
  if (orderType === "services" || orderType === "service") return "servicos";
  if (orderType === "mixed") return "mista";
  return "produtos";
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

    const [incomeEntries, expenseEntries, payables, receivables] = await Promise.all([
      prisma.finance.findMany({
        where: { tenant_id: tenantId, type: "income", date: { gte: from, lt: to } },
        select: { amount: true, payment_method: true, order_id: true, date: true },
      }),
      prisma.finance.findMany({
        where: { tenant_id: tenantId, type: "expense", cost_type: { not: null }, date: { gte: from, lt: to } },
        select: { description: true, amount: true, cost_type: true, date: true },
      }),
      // Contas pagas entram no mês do pagamento; as ainda em aberto, no mês do vencimento —
      // assim o custo fixo/variável lançado em Contas a Pagar aparece no relatório antes da baixa.
      prisma.accountPayable.findMany({
        where: {
          tenant_id: tenantId,
          OR: [
            { status: "paid", paid_date: { gte: from, lt: to } },
            { status: { not: "paid" }, due_date: { gte: from, lt: to } },
          ],
        },
        select: { description: true, amount: true, cost_type: true, paid_date: true, due_date: true, status: true },
      }),
      // Contas a Receber não recebidas até o fim do ano consultado: as do ano entram no mês do
      // vencimento; as de anos anteriores ainda em aberto aparecem como "atrasadas anteriores".
      prisma.accountReceivable.findMany({
        where: { tenant_id: tenantId, status: { notIn: ["received", "cancelled"] }, due_date: { lt: to } },
        select: { description: true, customer_name: true, amount: true, due_date: true },
        orderBy: { due_date: "asc" },
      }),
    ]);

    // "Hoje" no fuso de Brasília, para decidir o que está atrasado.
    const todayKey = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
    const atrasadasAnteriores: ReceberBucket = { total: 0, overdueTotal: 0, items: [] };
    for (const r of receivables) {
      const date = new Date(r.due_date).toISOString().substring(0, 10);
      const amount = Number(r.amount);
      const item: ReceivableItem = { description: r.description, customer: r.customer_name, amount, date, overdue: date < todayKey };
      if (new Date(r.due_date) < from) {
        atrasadasAnteriores.total += amount;
        atrasadasAnteriores.overdueTotal += amount;
        atrasadasAnteriores.items.push({ ...item, overdue: true });
        continue;
      }
      const bucket = months[new Date(r.due_date).getUTCMonth()].aReceber;
      bucket.total += amount;
      if (item.overdue) bucket.overdueTotal += amount;
      bucket.items.push(item);
    }

    // Nome do operador: prioriza Order.seller_name (vendedor escolhido manualmente
    // na venda, campo opcional) e cai para quem tinha o caixa aberto no momento da
    // venda (CashSession.opened_by_name) — esse sim reflete quem estava logado no
    // sistema, diferente do "Vendedor" que fica em branco na maioria das vendas.
    const orderIds = Array.from(new Set(incomeEntries.map(e => e.order_id).filter((id): id is number => id != null)));
    const orders = orderIds.length
      ? await prisma.order.findMany({
          where: { id: { in: orderIds }, tenant_id: tenantId },
          select: { id: true, seller_name: true, order_type: true, cash_session: { select: { opened_by_name: true } } },
        })
      : [];
    const sellerByOrder = new Map(orders.map(o => [o.id, o.seller_name || o.cash_session?.opened_by_name || "Geral"]));
    const origemByOrder = new Map(orders.map(o => [o.id, origemKey(o.order_type)]));

    for (const entry of incomeEntries) {
      const entryDate = new Date(entry.date);
      const m = entryDate.getUTCMonth();
      const day = entryDate.getUTCDate();
      const operator = entry.order_id != null ? (sellerByOrder.get(entry.order_id) ?? "Geral") : "Geral";
      const origem = entry.order_id != null ? (origemByOrder.get(entry.order_id) ?? "produtos") : "produtos";
      const segs = parsePaymentMethod(entry.payment_method || "money");
      if (!months[m].entradasByDay[day]) months[m].entradasByDay[day] = emptyEntradasBucket();
      if (!months[m].entradasByDayByOrigem[day]) months[m].entradasByDayByOrigem[day] = emptyEntradasByOrigem();
      for (const seg of segs) {
        const key = pmKey(seg.method);
        const amt = seg.amount > 0 ? seg.amount : Number(entry.amount);
        addEntry(months[m].entradas, operator, key, amt);
        addEntry(months[m].entradasByDay[day], operator, key, amt);
        addEntry(months[m].entradasByOrigem[origem], operator, key, amt);
        addEntry(months[m].entradasByDayByOrigem[day][origem], operator, key, amt);
      }
    }

    // CMV: itens de vendas concluídas com produto do catálogo que tenha custo registrado.
    const soldItems = await prisma.orderItem.findMany({
      where: {
        product_id: { not: null },
        order: { tenant_id: tenantId, status: "completed", created_at: { gte: from, lt: to } },
      },
      select: { quantity: true, returned_quantity: true, product: { select: { cost_price: true } }, order: { select: { created_at: true, order_type: true } } },
    });
    for (const it of soldItems) {
      const cost = Number(it.product?.cost_price ?? 0);
      const qty = it.quantity - (it.returned_quantity ?? 0);
      if (!(cost > 0) || qty <= 0) continue;
      const d = new Date(it.order.created_at);
      const m = d.getUTCMonth();
      const day = d.getUTCDate();
      const origem = origemKey(it.order.order_type);
      const val = cost * qty;
      months[m].cmvByOrigem[origem] += val;
      if (!months[m].cmvByDayByOrigem[day]) months[m].cmvByDayByOrigem[day] = { produtos: 0, servicos: 0, mista: 0 };
      months[m].cmvByDayByOrigem[day][origem] += val;
    }

    for (const e of expenseEntries) {
      const m = new Date(e.date).getUTCMonth();
      const target = e.cost_type === "fixed" ? months[m].custoFixo : months[m].custoVariavel;
      const amount = Number(e.amount);
      target.total += amount;
      target.items.push({ description: e.description, amount, date: new Date(e.date).toISOString().substring(0, 10), source: "financeiro" });
    }

    for (const p of payables) {
      const pending = p.status !== "paid";
      const when = pending ? p.due_date : p.paid_date;
      if (!when) continue;
      const m = new Date(when).getUTCMonth();
      const target = p.cost_type === "fixed" ? months[m].custoFixo : months[m].custoVariavel;
      const amount = Number(p.amount);
      target.total += amount;
      target.items.push({ description: p.description, amount, date: new Date(when).toISOString().substring(0, 10), source: "contas_pagar", pending, ...(p.cost_type ? {} : { unclassified: true }) });
    }

    res.json({ year, months, atrasadasAnteriores });
  } catch (err) {
    console.error("[getYearlyFinancialReport]", err);
    res.status(500).json({ error: "Failed to build financial report" });
  }
}
