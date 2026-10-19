import fs from "fs";
import path from "path";

import { prisma } from "../config/prisma";
import { localDateString } from "../utils/date";

const METHOD_LABELS: Record<string, string> = {
  money: "Dinheiro",
  cash: "Dinheiro",
  pix: "PIX",
  debit: "Débito",
  credit: "Crédito",
  card: "Cartão",
  crediario: "Crediário",
  transfer: "Transferência",
  boleto: "Boleto",
};

export type StatementData = {
  store: {
    name: string;
    document: string | null;
    stateRegistration: string | null;
    address: string;
    phone: string | null;
    logoBuffer: Buffer | null;
  };
  customer: { name: string; document: string | null; phone: string | null };
  generatedAt: Date;
  summary: {
    openTotal: number;
    openPaid: number;
    pending: number;
    overdue: number;
    nextDue: { date: Date; amount: number } | null;
  };
  openInstallments: Array<{
    description: string;
    number: number;
    count: number;
    dueDate: Date;
    remaining: number;
    overdue: boolean;
  }>;
  purchases: Array<{
    id: number;
    createdAt: Date;
    itemsSummary: string;
    total: number;
    status: "paid" | "credit_open" | "credit_paid";
    pending: number;
  }>;
  payments: Array<{ paidAt: Date; method: string; amount: number; description: string }>;
};

const num = (value: unknown) => Number(value ?? 0);

export function formatMoney(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function formatDate(date: Date) {
  return date.toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

export function formatDateTime(date: Date) {
  return date.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });
}

export function formatDocument(value: string | null | undefined) {
  const digits = (value ?? "").replace(/\D/g, "");
  if (digits.length === 14) return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
  if (digits.length === 11) return digits.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
  return value ?? "";
}

function readLogo(logoUrl: string | null | undefined): Buffer | null {
  if (!logoUrl?.startsWith("/uploads/")) return null;
  try {
    return fs.readFileSync(path.join(process.cwd(), "public", logoUrl));
  } catch {
    return null;
  }
}

/** Reúne tudo que o extrato do cliente mostra: posição do crediário, compras e pagamentos. */
export async function loadCustomerStatement(tenantId: number, customerId: number): Promise<StatementData | null> {
  const [tenant, customer] = await Promise.all([
    prisma.tenant.findUnique({ where: { id: tenantId } }),
    prisma.customer.findFirst({ where: { id: customerId, tenant_id: tenantId } }),
  ]);
  if (!tenant || !customer) return null;

  const debts = await prisma.customerDebt.findMany({
    where: { tenant_id: tenantId, customer_id: customerId },
    orderBy: { created_at: "desc" },
    include: { installments: { orderBy: { number: "asc" } }, payments: { orderBy: { paid_at: "desc" } } },
  });

  const today = localDateString();
  const openDebts = debts.filter((d) => d.status === "open");

  const openInstallments: StatementData["openInstallments"] = [];
  for (const debt of openDebts) {
    const count = debt.installments.length || 1;
    if (debt.installments.length === 0) {
      const remaining = num(debt.amount) - num(debt.amount_paid);
      if (remaining > 0.004 && debt.due_date) {
        openInstallments.push({
          description: debt.description, number: 1, count, dueDate: debt.due_date, remaining,
          overdue: debt.due_date.getTime() < today.getTime(),
        });
      }
      continue;
    }
    for (const inst of debt.installments) {
      const remaining = num(inst.amount) - num(inst.amount_paid);
      if (inst.status === "paid" || remaining <= 0.004) continue;
      openInstallments.push({
        description: debt.description, number: inst.number, count, dueDate: inst.due_date, remaining,
        overdue: inst.due_date.getTime() < today.getTime(),
      });
    }
  }
  openInstallments.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());

  const openTotal = openDebts.reduce((sum, d) => sum + num(d.amount), 0);
  const openPaid = openDebts.reduce((sum, d) => sum + num(d.amount_paid), 0);
  const pending = Math.max(0, openTotal - openPaid);
  const overdue = openInstallments.filter((i) => i.overdue).reduce((sum, i) => sum + i.remaining, 0);
  const upcoming = openInstallments.find((i) => !i.overdue);
  const nextDue = upcoming ? { date: upcoming.dueDate, amount: upcoming.remaining } : null;

  // Compras: mesmo critério da aba "Compras" do cliente (customer_id; nome só para legado sem id).
  const orders = await prisma.order.findMany({
    where: {
      tenant_id: tenantId,
      status: "completed",
      OR: [{ customer_id: customer.id }, { customer_id: null, customer_name: customer.name }],
    },
    orderBy: { created_at: "desc" },
    take: 50,
    include: { items: { include: { product: { select: { name: true } } } }, services: true },
  });
  const debtByOrder = new Map(debts.filter((d) => d.order_id).map((d) => [d.order_id as number, d]));

  const purchases: StatementData["purchases"] = orders.map((order) => {
    const lines = [
      ...order.items.map((it) => ({ name: it.product?.name ?? it.name ?? "Item", qty: num(it.quantity) })),
      ...order.services.map((s) => ({ name: s.name, qty: num(s.quantity) })),
    ];
    const shown = lines.slice(0, 3).map((l) => `${l.qty}x ${l.name}`).join(", ");
    const itemsSummary = lines.length > 3 ? `${shown} e mais ${lines.length - 3}` : shown || "Venda";
    const debt = debtByOrder.get(order.id);
    const debtPending = debt ? Math.max(0, num(debt.amount) - num(debt.amount_paid)) : 0;
    return {
      id: order.id,
      createdAt: order.created_at,
      itemsSummary,
      total: num(order.total_amount),
      status: !debt ? "paid" : debt.status === "open" ? "credit_open" : "credit_paid",
      pending: debt?.status === "open" ? debtPending : 0,
    };
  });

  const payments: StatementData["payments"] = debts
    .flatMap((d) => d.payments.map((p) => ({
      paidAt: p.paid_at,
      method: p.payment_method ? METHOD_LABELS[p.payment_method] ?? p.payment_method : "—",
      amount: num(p.amount),
      description: d.description,
    })))
    .sort((a, b) => b.paidAt.getTime() - a.paidAt.getTime())
    .slice(0, 30);

  return {
    store: {
      name: tenant.razao_social || tenant.name,
      document: tenant.document,
      stateRegistration: tenant.inscricao_estadual,
      address: [
        [tenant.address_street, tenant.address_number].filter(Boolean).join(", "),
        tenant.address_district,
        [tenant.address_city, tenant.address_state].filter(Boolean).join("/"),
      ].filter(Boolean).join(" - "),
      phone: tenant.whatsapp || null,
      logoBuffer: readLogo(tenant.logo_url),
    },
    customer: { name: customer.legal_name || customer.name, document: customer.document, phone: customer.phone },
    generatedAt: new Date(),
    summary: { openTotal, openPaid, pending, overdue, nextDue },
    openInstallments,
    purchases,
    payments,
  };
}

/** Texto da mensagem que acompanha o PDF no WhatsApp. */
export function buildStatementWhatsappText(data: StatementData) {
  const firstName = data.customer.name.trim().split(/\s+/)[0] || "cliente";
  const { summary } = data;

  if (summary.pending <= 0.004) {
    return [
      `Olá, ${firstName}! 👋`,
      `Aqui é da *${data.store.name}*.`,
      "",
      "✅ Você está *em dia*: não há nenhum valor pendente na sua conta.",
      "",
      "Segue em anexo o extrato com o histórico das suas compras. Obrigado pela preferência!",
    ].join("\n");
  }

  const lines = [
    `Olá, ${firstName}! 👋`,
    `Aqui é da *${data.store.name}*. Segue o resumo da sua conta:`,
    "",
    `🧾 Total em crediário: *${formatMoney(summary.openTotal)}*`,
    `✅ Já pago: *${formatMoney(summary.openPaid)}*`,
    `⏳ Falta pagar: *${formatMoney(summary.pending)}*`,
  ];
  if (summary.overdue > 0.004) lines.push(`⚠️ Em atraso: *${formatMoney(summary.overdue)}*`);
  if (summary.nextDue) lines.push(`📅 Próximo vencimento: *${formatDate(summary.nextDue.date)}* (${formatMoney(summary.nextDue.amount)})`);
  lines.push("", "No documento em anexo estão as compras, os pagamentos e as parcelas em aberto.", "Qualquer dúvida, é só responder esta mensagem. Obrigado!");
  return lines.join("\n");
}
