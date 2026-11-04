import crypto from "node:crypto";

import type { Affiliate, AffiliatePlan, AffiliateReferral, Prisma } from "@prisma/client";

import { prisma } from "../../config/prisma";
import { emitAffiliateEvent } from "./events";
import { commissionAmount, parseRules, ruleForSequence, splitEntry, windowMonths, type CommissionRule, type SplitEntry } from "./rules";

export const digitsOnly = (value: unknown) => String(value ?? "").replace(/\D/g, "");
export const normalizeEmail = (value: unknown) => String(value ?? "").trim().toLowerCase();
export const money = (value: unknown) => Math.round(Number(value ?? 0) * 100) / 100;

// ─── Código público do afiliado ────────────────────────────────────────────
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sem O/0/I/1 para não confundir ao ditar

export async function generateAffiliateCode(name: string) {
  const base = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .slice(0, 4);
  for (let attempt = 0; attempt < 20; attempt++) {
    let suffix = "";
    for (let i = 0; i < 3; i++) suffix += ALPHABET[crypto.randomInt(ALPHABET.length)];
    const code = `${base.padEnd(3, "X")}${suffix}`;
    if (!(await prisma.affiliate.findUnique({ where: { code } }))) return code;
  }
  return `AF${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
}

export const normalizeCode = (value: unknown) => String(value ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 16);

// ─── Regras efetivas ─────────────────────────────────────────────────────
type AffiliateWithPlan = Affiliate & { plan: AffiliatePlan | null };

/** Regras do afiliado: ajuste individual > plano dele > plano padrão ativo. Vazio = ainda não pode ganhar. */
export async function resolveAffiliateRules(affiliate: AffiliateWithPlan): Promise<CommissionRule[]> {
  try {
    if (affiliate.rules_override) return parseRules(affiliate.rules_override);
    if (affiliate.plan?.is_active) return parseRules(affiliate.plan.rules);
    const fallback = await prisma.affiliatePlan.findFirst({ where: { is_default: true, is_active: true } });
    return fallback ? parseRules(fallback.rules) : [];
  } catch {
    return [];
  }
}

export function safeRules(value: unknown): CommissionRule[] {
  try {
    return parseRules(value);
  } catch {
    return [];
  }
}

// ─── Janela de comissão de uma indicação ─────────────────────────────────
const COUNTED = ["confirmed", "received", "paid"];

export async function referralProgress(referral: Pick<AffiliateReferral, "id" | "rules">) {
  const rules = safeRules(referral.rules);
  const total = windowMonths(rules);
  const counted = await prisma.affiliateCommission.count({ where: { referral_id: referral.id, status: { in: COUNTED } } });
  return { rules, totalMonths: total, countedMonths: counted, open: total === null || counted < total };
}

// ─── Split para a Develoi aplicar no Asaas ───────────────────────────────
export async function splitForSequence(referral: AffiliateReferral & { affiliate: Affiliate }, sequence: number): Promise<SplitEntry[] | null> {
  const { affiliate } = referral;
  if (affiliate.status !== "active" || !affiliate.asaas_wallet_id) return null;
  const rule = ruleForSequence(safeRules(referral.rules), sequence);
  if (!rule) return null;
  return [splitEntry(affiliate.asaas_wallet_id, rule)];
}

// ─── Criação de indicação (chamada pela Develoi ao fechar a venda) ───────
export interface CreateReferralInput {
  code: string;
  develoiClientId?: string | null;
  tenantId?: number | null;
  asaasSubscriptionId?: string | null;
  customerName: string;
  planValue: number;
  leadId?: number | null;
}

export class AffiliateError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

export async function createReferral(input: CreateReferralInput) {
  const affiliate = await prisma.affiliate.findUnique({ where: { code: normalizeCode(input.code) }, include: { plan: true } });
  if (!affiliate || affiliate.status !== "active") throw new AffiliateError("Código de afiliado inválido ou inativo.", 404);

  if (input.develoiClientId) {
    const existing = await prisma.affiliateReferral.findUnique({ where: { develoi_client_id: input.develoiClientId } });
    if (existing) {
      // idempotente; só completa o que faltava
      return prisma.affiliateReferral.update({
        where: { id: existing.id },
        data: {
          asaas_subscription_id: existing.asaas_subscription_id ?? input.asaasSubscriptionId ?? undefined,
          tenant_id: existing.tenant_id ?? input.tenantId ?? undefined,
        },
      });
    }
  }

  const rules = await resolveAffiliateRules(affiliate);
  if (rules.length === 0) throw new AffiliateError("Este afiliado ainda não tem plano de comissão definido.", 409);

  const referral = await prisma.affiliateReferral.create({
    data: {
      affiliate_id: affiliate.id,
      lead_id: input.leadId ?? null,
      develoi_client_id: input.develoiClientId ?? null,
      tenant_id: input.tenantId ?? null,
      asaas_subscription_id: input.asaasSubscriptionId ?? null,
      customer_name: input.customerName.slice(0, 191),
      plan_value: money(input.planValue),
      rules: rules as unknown as Prisma.InputJsonValue, // foto das regras no dia da venda
      status: "trial",
    },
  });

  if (input.leadId) await prisma.affiliateLead.updateMany({ where: { id: input.leadId, affiliate_id: affiliate.id }, data: { status: "won" } });

  await emitAffiliateEvent("referral.created", {
    referralId: referral.id,
    affiliateId: affiliate.id,
    affiliateCode: affiliate.code,
    affiliateName: affiliate.name,
    customerName: referral.customer_name,
    develoiClientId: referral.develoi_client_id,
    planValue: Number(referral.plan_value),
  });
  return referral;
}

// ─── Eventos de cobrança do Asaas, repassados pela Develoi ────────────────
export interface PaymentEventInput {
  event: string;
  develoiClientId?: string | null;
  asaasSubscriptionId?: string | null;
  sequence?: number | null;
  payment: {
    id: string;
    value: number;
    netValue?: number | null;
    dueDate?: string | null;
    paymentDate?: string | null;
    split?: Array<{ walletId?: string; fixedValue?: number | null; percentualValue?: number | null; status?: string | null }> | null;
  };
}

const STATUS_BY_EVENT: Record<string, string> = {
  PAYMENT_CREATED: "pending",
  PAYMENT_UPDATED: "pending",
  PAYMENT_CONFIRMED: "confirmed",
  PAYMENT_RECEIVED: "received",
  PAYMENT_SPLIT_DONE: "paid",
  PAYMENT_REFUNDED: "refunded",
  PAYMENT_CHARGEBACK_REQUESTED: "refunded",
  PAYMENT_DELETED: "cancelled",
  PAYMENT_SPLIT_CANCELLED: "cancelled",
  PAYMENT_SPLIT_DIVERGENCE_BLOCK: "blocked",
  PAYMENT_SPLIT_DIVERGENCE_BLOCK_FINISHED: "received",
};

// Não rebaixa uma comissão já recebida/paga por um evento atrasado (o Asaas pode reenviar fora de ordem).
const RANK: Record<string, number> = { pending: 1, confirmed: 2, received: 3, paid: 4 };
const TERMINAL = new Set(["refunded", "cancelled", "blocked"]);

export async function processPaymentEvent(input: PaymentEventInput) {
  const referral = await prisma.affiliateReferral.findFirst({
    where: input.develoiClientId
      ? { develoi_client_id: input.develoiClientId }
      : { asaas_subscription_id: input.asaasSubscriptionId ?? "__none__" },
    include: { affiliate: { include: { plan: true } } },
  });
  if (!referral) return { ignored: "no_referral" as const };

  const { payment } = input;
  let commission = await prisma.affiliateCommission.findUnique({ where: { asaas_payment_id: payment.id } });

  // número da mensalidade: o da própria cobrança, se já registrada; senão o informado; senão a próxima da fila
  let sequence = commission?.sequence ?? input.sequence ?? null;
  if (!sequence) sequence = (await prisma.affiliateCommission.count({ where: { referral_id: referral.id } })) + 1;

  const rule = ruleForSequence(safeRules(referral.rules), sequence);
  if (!commission && !rule) return { ignored: "out_of_window" as const };

  const net = payment.netValue != null ? money(payment.netValue) : null;
  const gross = money(payment.value);
  const wallet = referral.affiliate.asaas_wallet_id;
  const splitItem = wallet ? payment.split?.find((s) => s.walletId === wallet) : undefined;

  // valor da comissão: o que o Asaas realmente configurou na cobrança; senão calcula pela faixa
  let amount = commission ? Number(commission.commission_value) : 0;
  if (splitItem?.fixedValue != null) amount = money(splitItem.fixedValue);
  else if (splitItem?.percentualValue != null) amount = money(((net ?? gross) * Number(splitItem.percentualValue)) / 100);
  else if (rule && !commission) amount = commissionAmount(rule, net ?? gross);

  const target = STATUS_BY_EVENT[input.event];
  const current = commission?.status ?? "pending";
  let status = current;
  if (target) {
    if (TERMINAL.has(target)) status = target; // estorno, cancelamento ou bloqueio sempre valem
    else if (current === "blocked") status = target; // bloqueio por divergência resolvido
    else if (TERMINAL.has(current)) status = current; // estornada/cancelada: evento atrasado não reabre
    else status = (RANK[target] ?? 0) >= (RANK[current] ?? 0) ? target : current; // nunca rebaixa recebida/paga
  }

  const data = {
    gross_value: gross,
    net_value: net,
    commission_value: amount,
    status,
    due_date: payment.dueDate ? new Date(payment.dueDate) : commission?.due_date ?? null,
    paid_at: status === "paid" ? new Date() : commission?.paid_at ?? (status === "received" && payment.paymentDate ? new Date(payment.paymentDate) : null),
  };

  const saved = commission
    ? await prisma.affiliateCommission.update({ where: { id: commission.id }, data })
    : await prisma.affiliateCommission.create({
        data: {
          ...data,
          referral_id: referral.id,
          affiliate_id: referral.affiliate_id,
          sequence,
          asaas_payment_id: payment.id,
          rule_type: rule!.type,
          rule_value: rule!.value,
        },
      });

  // situação do cliente
  let referralStatus: string | null = null;
  if (input.event === "PAYMENT_CONFIRMED" || input.event === "PAYMENT_RECEIVED") referralStatus = "active";
  else if (input.event === "PAYMENT_OVERDUE") referralStatus = "overdue";
  if (referralStatus && referral.status !== referralStatus && referral.status !== "cancelled") {
    await prisma.affiliateReferral.update({ where: { id: referral.id }, data: { status: referralStatus } });
  }

  const changed = !commission || commission.status !== saved.status || Number(commission.commission_value) !== Number(saved.commission_value);
  if (changed) {
    await emitAffiliateEvent("commission.updated", {
      commissionId: saved.id,
      referralId: referral.id,
      affiliateId: referral.affiliate_id,
      affiliateCode: referral.affiliate.code,
      customerName: referral.customer_name,
      sequence: saved.sequence,
      status: saved.status,
      grossValue: Number(saved.gross_value),
      netValue: saved.net_value == null ? null : Number(saved.net_value),
      commissionValue: Number(saved.commission_value),
      asaasPaymentId: saved.asaas_payment_id,
    });
  }
  return { ignored: null, commissionId: saved.id, sequence: saved.sequence, status: saved.status };
}

// ─── Números de um afiliado (painel dele e gestão) ───────────────────────
const MONTHS_BACK = 6;

export async function affiliateStats(affiliateId: number) {
  const since30 = new Date(Date.now() - 30 * 86_400_000);
  const [clicksTotal, clicks30, leadGroups, referrals, commissions] = await Promise.all([
    prisma.affiliateClick.count({ where: { affiliate_id: affiliateId } }),
    prisma.affiliateClick.count({ where: { affiliate_id: affiliateId, created_at: { gte: since30 } } }),
    prisma.affiliateLead.groupBy({ by: ["status"], where: { affiliate_id: affiliateId }, _count: { _all: true } }),
    prisma.affiliateReferral.findMany({ where: { affiliate_id: affiliateId }, select: { id: true, status: true, rules: true, started_at: true } }),
    prisma.affiliateCommission.findMany({ where: { affiliate_id: affiliateId }, select: { status: true, commission_value: true, created_at: true, paid_at: true } }),
  ]);

  const leads = Object.fromEntries(leadGroups.map((g) => [g.status, g._count._all])) as Record<string, number>;
  const leadsTotal = Object.values(leads).reduce((a, b) => a + b, 0);

  let activeClients = 0;
  const counted = await prisma.affiliateCommission.groupBy({
    by: ["referral_id"],
    where: { affiliate_id: affiliateId, status: { in: COUNTED } },
    _count: { _all: true },
  });
  const countedBy = new Map(counted.map((c) => [c.referral_id, c._count._all]));
  for (const r of referrals) {
    if (r.status === "cancelled") continue;
    const total = windowMonths(safeRules(r.rules));
    if (total === null || (countedBy.get(r.id) ?? 0) < total) activeClients++;
  }

  const sum = (statuses: string[]) => money(commissions.filter((c) => statuses.includes(c.status)).reduce((s, c) => s + Number(c.commission_value), 0));

  const series: { month: string; sales: number; commission: number }[] = [];
  const now = new Date();
  for (let i = MONTHS_BACK - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const inMonth = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}` === key;
    series.push({
      month: key,
      sales: referrals.filter((r) => inMonth(r.started_at)).length,
      commission: money(commissions.filter((c) => ["received", "paid"].includes(c.status) && inMonth(c.paid_at ?? c.created_at)).reduce((s, c) => s + Number(c.commission_value), 0)),
    });
  }

  return {
    clicks: { total: clicksTotal, last30: clicks30 },
    leads: { total: leadsTotal, byStatus: leads },
    sales: { total: referrals.length, activeClients, cancelled: referrals.filter((r) => r.status === "cancelled").length },
    commissions: {
      pending: sum(["pending", "confirmed"]),
      available: sum(["received"]),
      paid: sum(["paid"]),
      total: sum(["pending", "confirmed", "received", "paid"]),
    },
    conversion: leadsTotal > 0 ? Math.round((referrals.length / leadsTotal) * 1000) / 10 : 0,
    series,
  };
}

export function publicAffiliate(a: Affiliate & { plan?: AffiliatePlan | null }) {
  return {
    id: a.id,
    code: a.code,
    name: a.name,
    email: a.email,
    whatsapp: a.whatsapp,
    document: a.document,
    asaasWalletId: a.asaas_wallet_id,
    walletStatus: a.wallet_status,
    status: a.status,
    planId: a.plan_id,
    planName: a.plan?.name ?? null,
    pitch: a.pitch,
    hasPassword: Boolean(a.password_hash),
    approvedAt: a.approved_at,
    createdAt: a.created_at,
    lastLoginAt: a.last_login_at,
  };
}
