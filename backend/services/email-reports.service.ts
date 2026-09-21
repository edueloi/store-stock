import cron from "node-cron";
import { prisma } from "../config/prisma";
import { parsePaymentMethod } from "../utils/payment-method";
import { sendReportEmail, baseTemplate } from "./mailer.service";

const PM_LABEL: Record<string, string> = {
  money: "Dinheiro", pix: "PIX", debit: "Débito", credit: "Crédito", crediario: "Crediário",
};

function money(v: number): string {
  return v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function endOfDay(d: Date): Date {
  return new Date(d.getTime() + 24 * 60 * 60 * 1000 - 1);
}

// Destinatários configurados manualmente em Configurações; se a lista estiver
// vazia, cai pro email de todo usuário com role "admin" do tenant (não há
// conceito de "email do tenant" separado de usuário — ver User.role).
async function resolveRecipients(tenantId: number, configured: unknown): Promise<string[]> {
  if (Array.isArray(configured) && configured.length > 0) {
    return configured.filter((e): e is string => typeof e === "string" && e.trim().length > 0);
  }
  const admins = await prisma.user.findMany({
    where: { tenant_id: tenantId, role: "admin" },
    select: { email: true },
  });
  return admins.map((a) => a.email).filter((e): e is string => !!e);
}

interface ReportData {
  periodLabel: string;
  from: Date;
  to: Date;
  sales: {
    grossTotal: number;
    netTotal: number;
    count: number;
    byMethod: { method: string; amount: number; fee: number }[];
    servicesTotal: number;
    servicesCount: number;
  };
  stock: {
    lowStockCount: number;
    lowStockItems: { name: string; stock_quantity: number; min_stock: number }[];
    lossCount: number;
    lossTotal: number;
  };
  receivable: {
    receivedCount: number;
    receivedTotal: number;
    pendingCount: number;
    pendingTotal: number;
    overdueTotal: number;
  };
  payable: {
    paidCount: number;
    paidTotal: number;
    pendingCount: number;
    pendingTotal: number;
    overdueTotal: number;
  };
  crediario: {
    dueSoonCount: number;
    dueSoonTotal: number;
    overdueCount: number;
    overdueTotal: number;
  };
  // Só preenchido no relatório mensal — comparação de faturamento bruto com o
  // mês anterior.
  monthComparison?: { current: number; previous: number; diff: number; pct: number | null };
}

async function collectReportData(tenantId: number, from: Date, to: Date, periodLabel: string): Promise<ReportData> {
  const toEnd = endOfDay(to);

  const orders = await prisma.order.findMany({
    where: { tenant_id: tenantId, status: "completed", created_at: { gte: from, lte: toEnd } },
    select: { payment_method: true, gross_amount: true, total_amount: true, fee_amount: true, change_amount: true },
  });

  const byMethod = new Map<string, { amount: number; fee: number }>();
  let grossTotal = 0;
  let netTotal = 0;
  for (const o of orders) {
    grossTotal += Number(o.gross_amount ?? o.total_amount);
    netTotal += Number(o.total_amount);
    let changeToApply = Number(o.change_amount) || 0;
    parsePaymentMethod(o.payment_method).forEach((seg) => {
      let amount = seg.amount;
      if (seg.method === "money" && changeToApply > 0) {
        const applied = Math.min(changeToApply, amount);
        amount -= applied;
        changeToApply -= applied;
      }
      const cur = byMethod.get(seg.method) ?? { amount: 0, fee: 0 };
      cur.amount += amount;
      byMethod.set(seg.method, cur);
    });
  }
  // Taxa de maquininha é gravada agregada por pedido (Order.fee_amount), não por
  // segmento — rateando proporcionalmente ao valor de cada forma pra dar uma
  // ideia de custo por método sem precisar reprocessar cada venda.
  const totalFeeAmount = orders.reduce((s, o) => s + Number(o.fee_amount ?? 0), 0);
  if (totalFeeAmount > 0 && grossTotal > 0) {
    for (const [method, v] of byMethod) {
      v.fee = Math.round((v.amount / grossTotal) * totalFeeAmount * 100) / 100;
    }
  }

  const services = await prisma.serviceOrder.findMany({
    where: { tenant_id: tenantId, status: "entregue", updated_at: { gte: from, lte: toEnd } },
    select: { total_amount: true },
  });
  const servicesTotal = services.reduce((s, so) => s + Number(so.total_amount ?? 0), 0);

  const products = await prisma.product.findMany({
    where: { tenant_id: tenantId },
    select: { name: true, stock_quantity: true, min_stock: true },
  });
  const lowStockItems = products.filter((p) => p.stock_quantity <= p.min_stock);

  const lossMovements = await prisma.stockMovement.findMany({
    where: { tenant_id: tenantId, type: "loss", created_at: { gte: from, lte: toEnd } },
    include: { product: { select: { price: true } } },
  });
  const lossTotal = lossMovements.reduce((s, m) => s + Math.abs(m.quantity) * Number(m.product?.price ?? 0), 0);

  const receivables = await prisma.accountReceivable.findMany({
    where: { tenant_id: tenantId, due_date: { gte: from, lte: toEnd } },
    select: { status: true, amount: true, received_date: true },
  });
  const receivedItems = receivables.filter((r) => r.status === "received");
  const pendingReceivables = receivables.filter((r) => r.status === "pending");
  const overdueReceivableTotal = pendingReceivables
    .filter((r) => r.status === "pending")
    .reduce((s, r) => s + Number(r.amount), 0);

  const payables = await prisma.accountPayable.findMany({
    where: { tenant_id: tenantId, due_date: { gte: from, lte: toEnd } },
    select: { status: true, amount: true },
  });
  const paidItems = payables.filter((p) => p.status === "paid");
  const pendingPayables = payables.filter((p) => p.status === "pending");

  const now = new Date();
  const soon = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const installments = await prisma.customerDebtInstallment.findMany({
    where: { tenant_id: tenantId, status: "open" },
    select: { due_date: true, amount: true, amount_paid: true },
  });
  const dueSoon = installments.filter((i) => new Date(i.due_date) >= now && new Date(i.due_date) <= soon);
  const overdue = installments.filter((i) => new Date(i.due_date) < now);
  const remaining = (i: { amount: unknown; amount_paid: unknown }) => Number(i.amount) - Number(i.amount_paid);

  return {
    periodLabel,
    from,
    to,
    sales: {
      grossTotal,
      netTotal,
      count: orders.length,
      byMethod: Array.from(byMethod.entries()).map(([method, v]) => ({ method, amount: v.amount, fee: v.fee })),
      servicesTotal,
      servicesCount: services.length,
    },
    stock: {
      lowStockCount: lowStockItems.length,
      lowStockItems: lowStockItems.slice(0, 10),
      lossCount: lossMovements.length,
      lossTotal,
    },
    receivable: {
      receivedCount: receivedItems.length,
      receivedTotal: receivedItems.reduce((s, r) => s + Number(r.amount), 0),
      pendingCount: pendingReceivables.length,
      pendingTotal: pendingReceivables.reduce((s, r) => s + Number(r.amount), 0),
      overdueTotal: overdueReceivableTotal,
    },
    payable: {
      paidCount: paidItems.length,
      paidTotal: paidItems.reduce((s, p) => s + Number(p.amount), 0),
      pendingCount: pendingPayables.length,
      pendingTotal: pendingPayables.reduce((s, p) => s + Number(p.amount), 0),
      overdueTotal: pendingPayables.reduce((s, p) => s + Number(p.amount), 0),
    },
    crediario: {
      dueSoonCount: dueSoon.length,
      dueSoonTotal: dueSoon.reduce((s, i) => s + remaining(i), 0),
      overdueCount: overdue.length,
      overdueTotal: overdue.reduce((s, i) => s + remaining(i), 0),
    },
  };
}

function statCard(label: string, value: string, color = "#0f172a"): string {
  return `<td style="padding:6px;width:50%;">
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:14px 16px;">
      <p style="margin:0 0 4px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#94a3b8;">${label}</p>
      <p style="margin:0;font-size:18px;font-weight:900;font-family:monospace;color:${color};">${value}</p>
    </div>
  </td>`;
}

function sectionTitle(title: string): string {
  return `<p style="margin:28px 0 10px;font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:#0f172a;border-bottom:2px solid #e2e8f0;padding-bottom:8px;">${title}</p>`;
}

function buildReportHtml(storeName: string, data: ReportData, kind: "weekly" | "monthly"): string {
  const methodRows = data.sales.byMethod
    .sort((a, b) => b.amount - a.amount)
    .map((m) => `
      <tr>
        <td style="padding:6px 0;font-size:13px;color:#334155;">${PM_LABEL[m.method] ?? m.method}</td>
        <td style="padding:6px 0;font-size:13px;color:#0f172a;font-weight:700;text-align:right;font-family:monospace;">R$ ${money(m.amount)}</td>
        <td style="padding:6px 0;font-size:11px;color:#94a3b8;text-align:right;font-family:monospace;">${m.fee > 0 ? `-R$ ${money(m.fee)} taxa` : ""}</td>
      </tr>`).join("");

  const lowStockRows = data.stock.lowStockItems.map((p) => `
    <tr>
      <td style="padding:5px 0;font-size:12px;color:#334155;">${p.name}</td>
      <td style="padding:5px 0;font-size:12px;color:#e11d48;font-weight:700;text-align:right;">${p.stock_quantity} / mín. ${p.min_stock}</td>
    </tr>`).join("");

  const comparisonBlock = data.monthComparison ? `
    ${sectionTitle("Comparação com o mês anterior")}
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        ${statCard("Este mês", `R$ ${money(data.monthComparison.current)}`)}
        ${statCard("Mês anterior", `R$ ${money(data.monthComparison.previous)}`)}
      </tr>
    </table>
    <p style="margin:10px 0 0;font-size:13px;font-weight:700;color:${data.monthComparison.diff >= 0 ? "#059669" : "#e11d48"};">
      ${data.monthComparison.diff >= 0 ? "▲" : "▼"} ${data.monthComparison.pct !== null ? Math.abs(data.monthComparison.pct).toFixed(1) + "%" : "—"}
      (R$ ${money(Math.abs(data.monthComparison.diff))}) em relação ao mês anterior
    </p>` : "";

  const content = `
    <p style="margin:0 0 8px;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#f59e0b;">
      Relatório ${kind === "weekly" ? "Semanal" : "Mensal"}
    </p>
    <h1 style="margin:0 0 4px;font-size:22px;font-weight:900;color:#0f172a;line-height:1.2;">${storeName}</h1>
    <p style="margin:0 0 24px;font-size:13px;color:#94a3b8;">${data.periodLabel}</p>

    ${sectionTitle("Vendas")}
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        ${statCard("Faturamento Bruto", `R$ ${money(data.sales.grossTotal)}`)}
        ${statCard("Faturamento Líquido", `R$ ${money(data.sales.netTotal)}`)}
      </tr>
      <tr>
        ${statCard("Vendas PDV", `${data.sales.count}`)}
        ${statCard("Serviços Concluídos", `${data.sales.servicesCount} · R$ ${money(data.sales.servicesTotal)}`)}
      </tr>
    </table>
    ${methodRows ? `<table width="100%" cellpadding="0" cellspacing="0" style="margin-top:14px;">${methodRows}</table>` : ""}

    ${sectionTitle("Estoque")}
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        ${statCard("Itens com Estoque Baixo", `${data.stock.lowStockCount}`, data.stock.lowStockCount > 0 ? "#e11d48" : "#0f172a")}
        ${statCard("Perdas no Período", `${data.stock.lossCount} · R$ ${money(data.stock.lossTotal)}`)}
      </tr>
    </table>
    ${lowStockRows ? `<table width="100%" cellpadding="0" cellspacing="0" style="margin-top:10px;">${lowStockRows}</table>` : ""}

    ${sectionTitle("Contas a Receber (vencimento no período)")}
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        ${statCard("Recebidas", `${data.receivable.receivedCount} · R$ ${money(data.receivable.receivedTotal)}`, "#059669")}
        ${statCard("Falta Receber", `${data.receivable.pendingCount} · R$ ${money(data.receivable.pendingTotal)}`, data.receivable.pendingCount > 0 ? "#e11d48" : "#0f172a")}
      </tr>
    </table>

    ${sectionTitle("Contas a Pagar (vencimento no período)")}
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        ${statCard("Pagas", `${data.payable.paidCount} · R$ ${money(data.payable.paidTotal)}`, "#059669")}
        ${statCard("Falta Pagar", `${data.payable.pendingCount} · R$ ${money(data.payable.pendingTotal)}`, data.payable.pendingCount > 0 ? "#e11d48" : "#0f172a")}
      </tr>
    </table>

    ${sectionTitle("Crediário")}
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        ${statCard("Vencendo em 7 dias", `${data.crediario.dueSoonCount} · R$ ${money(data.crediario.dueSoonTotal)}`, "#d97706")}
        ${statCard("Já Vencidas", `${data.crediario.overdueCount} · R$ ${money(data.crediario.overdueTotal)}`, data.crediario.overdueCount > 0 ? "#e11d48" : "#0f172a")}
      </tr>
    </table>

    ${comparisonBlock}
  `;

  return baseTemplate(content);
}

async function computeMonthComparison(tenantId: number, monthFrom: Date, monthTo: Date) {
  const prevFrom = new Date(Date.UTC(monthFrom.getUTCFullYear(), monthFrom.getUTCMonth() - 1, 1));
  const prevTo = new Date(Date.UTC(monthFrom.getUTCFullYear(), monthFrom.getUTCMonth(), 0));

  const [current, previous] = await Promise.all([
    prisma.order.aggregate({
      where: { tenant_id: tenantId, status: "completed", created_at: { gte: monthFrom, lte: endOfDay(monthTo) } },
      _sum: { gross_amount: true, total_amount: true },
    }),
    prisma.order.aggregate({
      where: { tenant_id: tenantId, status: "completed", created_at: { gte: prevFrom, lte: endOfDay(prevTo) } },
      _sum: { gross_amount: true, total_amount: true },
    }),
  ]);

  const currentTotal = Number(current._sum.gross_amount ?? current._sum.total_amount ?? 0);
  const previousTotal = Number(previous._sum.gross_amount ?? previous._sum.total_amount ?? 0);
  const diff = currentTotal - previousTotal;
  const pct = previousTotal > 0 ? (diff / previousTotal) * 100 : null;

  return { current: currentTotal, previous: previousTotal, diff, pct };
}

async function sendReportForTenant(tenantId: number, kind: "weekly" | "monthly", from: Date, to: Date, periodLabel: string) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { name: true, report_recipient_emails: true },
  });
  if (!tenant) return;

  const recipients = await resolveRecipients(tenantId, tenant.report_recipient_emails);
  if (recipients.length === 0) return;

  const data = await collectReportData(tenantId, from, to, periodLabel);
  if (kind === "monthly") {
    data.monthComparison = await computeMonthComparison(tenantId, from, to);
  }

  const html = buildReportHtml(tenant.name, data, kind);
  const subject = `${kind === "weekly" ? "Relatório Semanal" : "Relatório Mensal"} · ${tenant.name}`;
  await sendReportEmail(recipients, subject, html).catch((err) => {
    console.error(`Falha ao enviar relatório ${kind} pro tenant ${tenantId}:`, err);
  });
}

function weekRange(reference: Date): { from: Date; to: Date; label: string } {
  // "reference" é a segunda-feira do disparo — a semana reportada é a anterior
  // (segunda a domingo passados), nunca a semana corrente (ainda não fechou).
  const to = new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth(), reference.getUTCDate() - 1));
  const from = new Date(to.getTime() - 6 * 24 * 60 * 60 * 1000);
  const fmt = (d: Date) => d.toLocaleDateString("pt-BR", { timeZone: "UTC" });
  return { from, to, label: `Semana de ${fmt(from)} a ${fmt(to)}` };
}

function monthRange(reference: Date): { from: Date; to: Date; label: string } {
  // "reference" é o dia 1º do mês corrente — o mês reportado é o anterior
  // (já fechado por completo).
  const from = new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth() - 1, 1));
  const to = new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth(), 0));
  const label = from.toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });
  return { from, to, label: label.charAt(0).toUpperCase() + label.slice(1) };
}

export async function runWeeklyReports(reference = new Date()) {
  const { from, to, label } = weekRange(reference);
  const tenants = await prisma.tenant.findMany({ where: { weekly_report_enabled: true }, select: { id: true } });
  for (const t of tenants) {
    await sendReportForTenant(t.id, "weekly", from, to, label).catch((err) => console.error(err));
  }
}

export async function runMonthlyReports(reference = new Date()) {
  const { from, to, label } = monthRange(reference);
  const tenants = await prisma.tenant.findMany({ where: { monthly_report_enabled: true }, select: { id: true } });
  for (const t of tenants) {
    await sendReportForTenant(t.id, "monthly", from, to, label).catch((err) => console.error(err));
  }
}

// Envio manual (botão "Enviar agora" em Configurações) — sempre reporta o
// período já fechado mais recente, igual o job automático faria hoje.
export async function sendReportNow(tenantId: number, kind: "weekly" | "monthly") {
  const now = new Date();
  const { from, to, label } = kind === "weekly" ? weekRange(now) : monthRange(now);
  await sendReportForTenant(tenantId, kind, from, to, label);
}

let cronStarted = false;

export function startEmailReportsCron() {
  if (cronStarted) return;
  cronStarted = true;

  // Toda segunda-feira às 8h — relatório da semana anterior (seg a dom).
  cron.schedule("0 8 * * 1", () => {
    runWeeklyReports().catch((err) => console.error("runWeeklyReports failed:", err));
  });

  // Todo dia 1º do mês às 8h — relatório do mês anterior, já fechado.
  cron.schedule("0 8 1 * *", () => {
    runMonthlyReports().catch((err) => console.error("runMonthlyReports failed:", err));
  });
}
