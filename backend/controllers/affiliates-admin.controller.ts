import type { Request, Response } from "express";
import type { Prisma } from "@prisma/client";

import { prisma } from "../config/prisma";
import { sendAffiliateApprovedEmail } from "../services/affiliates/affiliate-mail";
import {
  AffiliateError,
  affiliateStats,
  createReferral,
  digitsOnly,
  generateAffiliateCode,
  money,
  normalizeEmail,
  publicAffiliate,
  referralProgress,
  resolveAffiliateRules,
  safeRules,
} from "../services/affiliates/affiliates.service";
import { createLoginToken } from "../services/affiliates/auth";
import { emitAffiliateEvent } from "../services/affiliates/events";
import { parseRules } from "../services/affiliates/rules";
import { currentGoalValue, goalDto, parseGoalBody } from "./affiliates-portal.controller";

const clean = (value: unknown, max: number) => String(value ?? "").trim().slice(0, max);
const WALLET_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const AFFILIATE_STATUS = ["pending", "active", "suspended", "rejected"];
const LEAD_STATUS = ["new", "contacted", "negotiating", "won", "lost"];
const COMMISSION_STATUS = ["pending", "confirmed", "received", "paid", "refunded", "cancelled", "blocked"];
const REFERRAL_STATUS = ["trial", "active", "overdue", "cancelled"];

function fail(res: Response, error: unknown) {
  if (error instanceof AffiliateError) return void res.status(error.status).json({ error: error.message });
  if (error instanceof Error && !("code" in error)) return void res.status(400).json({ error: error.message });
  console.error("Erro na gestão de afiliados", (error as Error)?.message);
  res.status(500).json({ error: "Não foi possível concluir agora." });
}

const eventData = (a: Awaited<ReturnType<typeof loadAffiliate>>) => ({
  affiliateId: a.id,
  code: a.code,
  name: a.name,
  email: a.email,
  whatsapp: a.whatsapp,
  status: a.status,
  walletStatus: a.wallet_status,
  planName: a.plan?.name ?? null,
});

async function loadAffiliate(id: number) {
  return prisma.affiliate.findUniqueOrThrow({ where: { id }, include: { plan: true } });
}

// ─── Visão geral ─────────────────────────────────────────────────────────
export async function overview(_req: Request, res: Response) {
  const since30 = new Date(Date.now() - 30 * 86_400_000);
  const [byStatus, leadsTotal, leadsNew, referrals, commissions, clicks30, pending, failed] = await Promise.all([
    prisma.affiliate.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.affiliateLead.count(),
    prisma.affiliateLead.count({ where: { status: "new" } }),
    prisma.affiliateReferral.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.affiliateCommission.findMany({ select: { status: true, commission_value: true } }),
    prisma.affiliateClick.count({ where: { created_at: { gte: since30 } } }),
    prisma.affiliateEvent.count({ where: { delivered_at: null, attempts: { lt: 8 } } }),
    prisma.affiliateEvent.count({ where: { delivered_at: null, attempts: { gte: 8 } } }),
  ]);
  const count = (rows: { status: string; _count: { _all: number } }[], status: string) => rows.find((r) => r.status === status)?._count._all ?? 0;
  const sum = (statuses: string[]) => money(commissions.filter((c) => statuses.includes(c.status)).reduce((s, c) => s + Number(c.commission_value), 0));
  res.json({
    affiliates: {
      total: byStatus.reduce((s, r) => s + r._count._all, 0),
      pending: count(byStatus, "pending"),
      active: count(byStatus, "active"),
      suspended: count(byStatus, "suspended"),
    },
    leads: { total: leadsTotal, new: leadsNew },
    sales: { total: referrals.reduce((s, r) => s + r._count._all, 0), activeClients: count(referrals, "active") + count(referrals, "trial") + count(referrals, "overdue") },
    commissions: { pending: sum(["pending", "confirmed"]), available: sum(["received"]), paid: sum(["paid"]) },
    clicks30,
    webhook: { pending, failed },
  });
}

// ─── Afiliados ───────────────────────────────────────────────────────────
export async function listAffiliates(req: Request, res: Response) {
  const status = typeof req.query.status === "string" && AFFILIATE_STATUS.includes(req.query.status) ? req.query.status : undefined;
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  const rows = await prisma.affiliate.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(q ? { OR: [{ name: { contains: q } }, { email: { contains: q } }, { code: { contains: q.toUpperCase() } }] } : {}),
    },
    include: { plan: true },
    orderBy: { created_at: "desc" },
    take: 300,
  });
  res.json({ affiliates: await Promise.all(rows.map(async (a) => ({ ...publicAffiliate(a), stats: await affiliateStats(a.id) }))) });
}

export async function getAffiliateDetail(req: Request, res: Response) {
  const id = Number(req.params.id);
  const affiliate = await prisma.affiliate.findUnique({ where: { id }, include: { plan: true } });
  if (!affiliate) return void res.status(404).json({ error: "Afiliado não encontrado." });
  const [rules, stats, leads, referrals, commissions] = await Promise.all([
    resolveAffiliateRules(affiliate),
    affiliateStats(id),
    prisma.affiliateLead.findMany({ where: { affiliate_id: id }, orderBy: { created_at: "desc" }, take: 200 }),
    prisma.affiliateReferral.findMany({ where: { affiliate_id: id }, orderBy: { started_at: "desc" }, take: 200 }),
    prisma.affiliateCommission.findMany({ where: { affiliate_id: id }, include: { referral: { select: { customer_name: true } } }, orderBy: { created_at: "desc" }, take: 300 }),
  ]);
  res.json({
    affiliate: { ...publicAffiliate(affiliate), adminNotes: affiliate.admin_notes, rulesOverride: affiliate.rules_override ?? null },
    rules,
    stats,
    leads: leads.map((l) => ({ id: l.id, name: l.name, whatsapp: l.whatsapp, email: l.email, business: l.business, system: l.system, message: l.message, status: l.status, adminNotes: l.admin_notes, createdAt: l.created_at })),
    referrals: await Promise.all(
      referrals.map(async (r) => {
        const progress = await referralProgress(r);
        return { ...referralDto(r), totalMonths: progress.totalMonths, countedMonths: progress.countedMonths, open: progress.open && r.status !== "cancelled" };
      }),
    ),
    commissions: commissions.map(commissionDto),
  });
}

export async function createAffiliate(req: Request, res: Response) {
  try {
    const name = clean(req.body?.name, 120);
    const email = normalizeEmail(req.body?.email);
    const whatsapp = digitsOnly(req.body?.whatsapp);
    const wallet = clean(req.body?.asaasWalletId, 60);
    if (name.length < 3) throw new Error("Informe o nome.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw new Error("E-mail inválido.");
    if (whatsapp.length < 10 || whatsapp.length > 13) throw new Error("WhatsApp inválido.");
    if (wallet && !WALLET_RE.test(wallet)) throw new Error("walletId inválido.");
    if (await prisma.affiliate.findUnique({ where: { email } })) return void res.status(409).json({ error: "Já existe um afiliado com este e-mail." });
    const planId = req.body?.planId ? Number(req.body.planId) : null;

    const created = await prisma.affiliate.create({
      data: {
        code: await generateAffiliateCode(name),
        name,
        email,
        whatsapp,
        document: digitsOnly(req.body?.document) || null,
        asaas_wallet_id: wallet || null,
        plan_id: planId,
        status: "active",
        approved_at: new Date(),
      },
      include: { plan: true },
    });
    await emitAffiliateEvent("affiliate.updated", eventData(created));
    res.status(201).json({ affiliate: publicAffiliate(created) });
  } catch (error) {
    fail(res, error);
  }
}

export async function updateAffiliate(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    const current = await prisma.affiliate.findUnique({ where: { id }, include: { plan: true } });
    if (!current) return void res.status(404).json({ error: "Afiliado não encontrado." });
    const body = req.body ?? {};
    const data: Prisma.AffiliateUpdateInput = {};

    if (body.name !== undefined) data.name = clean(body.name, 120);
    if (body.whatsapp !== undefined) data.whatsapp = digitsOnly(body.whatsapp);
    if (body.adminNotes !== undefined) data.admin_notes = clean(body.adminNotes, 2000) || null;
    if (body.planId !== undefined) data.plan = body.planId ? { connect: { id: Number(body.planId) } } : { disconnect: true };
    if (body.rulesOverride !== undefined) data.rules_override = body.rulesOverride === null ? (null as unknown as Prisma.NullTypes.DbNull) as never : (parseRules(body.rulesOverride) as unknown as Prisma.InputJsonValue);
    if (body.asaasWalletId !== undefined) {
      const wallet = clean(body.asaasWalletId, 60);
      if (wallet && !WALLET_RE.test(wallet)) throw new Error("walletId inválido (formato 00000000-0000-0000-0000-000000000000).");
      data.asaas_wallet_id = wallet || null;
      if ((wallet || null) !== current.asaas_wallet_id && body.walletStatus === undefined) data.wallet_status = "pending";
    }
    if (body.walletStatus !== undefined) {
      if (!["pending", "verified"].includes(body.walletStatus)) throw new Error("Situação da carteira inválida.");
      data.wallet_status = body.walletStatus;
    }

    const activating = body.status === "active" && current.status !== "active";
    if (body.status !== undefined) {
      if (!AFFILIATE_STATUS.includes(body.status)) throw new Error("Situação inválida.");
      data.status = body.status;
      if (activating && !current.approved_at) data.approved_at = new Date();
    }

    const updated = await prisma.affiliate.update({ where: { id }, data, include: { plan: true } });
    await emitAffiliateEvent("affiliate.updated", eventData(updated));

    const rules = await resolveAffiliateRules(updated);
    const warnings: string[] = [];
    if (updated.status === "active" && rules.length === 0) warnings.push("Este afiliado ainda não tem plano de comissão: escolha um plano ou crie um plano padrão.");
    if (updated.status === "active" && !updated.asaas_wallet_id) warnings.push("Sem walletId do Asaas o split não é aplicado nas cobranças.");

    // e-mail de boas-vindas na primeira aprovação (se falhar, a aprovação vale e o aviso fica para o admin)
    if (activating && !current.approved_at) {
      try {
        await sendAffiliateApprovedEmail(updated.email, updated.name, updated.code, rules, await createLoginToken(updated.id));
      } catch (error) {
        warnings.push("Aprovado, mas o e-mail de boas-vindas não pôde ser enviado: o afiliado pode pedir o acesso em “Entrar”.");
        console.error("Falha ao enviar e-mail de aprovação de afiliado", (error as Error).message);
      }
    }
    res.json({ affiliate: publicAffiliate(updated), warnings });
  } catch (error) {
    fail(res, error);
  }
}

// ─── Planos de comissão ──────────────────────────────────────────────────
const planDto = (p: { id: number; name: string; description: string | null; rules: unknown; is_default: boolean; is_active: boolean; created_at: Date; _count?: { affiliates: number } }) => ({
  id: p.id,
  name: p.name,
  description: p.description,
  rules: safeRules(p.rules),
  isDefault: p.is_default,
  isActive: p.is_active,
  affiliates: p._count?.affiliates ?? 0,
  createdAt: p.created_at,
});

export async function listPlans(_req: Request, res: Response) {
  const plans = await prisma.affiliatePlan.findMany({ include: { _count: { select: { affiliates: true } } }, orderBy: [{ is_default: "desc" }, { created_at: "asc" }] });
  res.json({ plans: plans.map(planDto) });
}

export async function createPlan(req: Request, res: Response) {
  try {
    const name = clean(req.body?.name, 120);
    if (name.length < 2) throw new Error("Dê um nome ao plano.");
    const rules = parseRules(req.body?.rules);
    const isDefault = Boolean(req.body?.isDefault);
    const plan = await prisma.$transaction(async (tx) => {
      if (isDefault) await tx.affiliatePlan.updateMany({ data: { is_default: false } });
      return tx.affiliatePlan.create({
        data: { name, description: clean(req.body?.description, 500) || null, rules: rules as unknown as Prisma.InputJsonValue, is_default: isDefault, is_active: req.body?.isActive !== false },
      });
    });
    res.status(201).json({ plan: planDto(plan) });
  } catch (error) {
    fail(res, error);
  }
}

export async function updatePlan(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    if (!(await prisma.affiliatePlan.findUnique({ where: { id } }))) return void res.status(404).json({ error: "Plano não encontrado." });
    const data: Prisma.AffiliatePlanUpdateInput = {};
    if (req.body?.name !== undefined) data.name = clean(req.body.name, 120);
    if (req.body?.description !== undefined) data.description = clean(req.body.description, 500) || null;
    if (req.body?.rules !== undefined) data.rules = parseRules(req.body.rules) as unknown as Prisma.InputJsonValue;
    if (req.body?.isActive !== undefined) data.is_active = Boolean(req.body.isActive);
    if (req.body?.isDefault !== undefined) data.is_default = Boolean(req.body.isDefault);
    const plan = await prisma.$transaction(async (tx) => {
      if (data.is_default === true) await tx.affiliatePlan.updateMany({ where: { id: { not: id } }, data: { is_default: false } });
      return tx.affiliatePlan.update({ where: { id }, data, include: { _count: { select: { affiliates: true } } } });
    });
    res.json({ plan: planDto(plan) });
  } catch (error) {
    fail(res, error);
  }
}

export async function deletePlan(req: Request, res: Response) {
  const id = Number(req.params.id);
  const used = await prisma.affiliate.count({ where: { plan_id: id } });
  if (used > 0) {
    await prisma.affiliatePlan.update({ where: { id }, data: { is_active: false, is_default: false } });
    return void res.json({ ok: true, archived: true });
  }
  await prisma.affiliatePlan.deleteMany({ where: { id } });
  res.json({ ok: true });
}

// ─── Leads ───────────────────────────────────────────────────────────────
const adminLeadDto = (l: { id: number; affiliate_id: number; name: string; whatsapp: string; email: string | null; business: string | null; system: string; message: string | null; status: string; admin_notes: string | null; created_at: Date; affiliate?: { name: string; code: string } }) => ({
  id: l.id,
  affiliateId: l.affiliate_id,
  affiliateName: l.affiliate?.name,
  affiliateCode: l.affiliate?.code,
  name: l.name,
  whatsapp: l.whatsapp,
  email: l.email,
  business: l.business,
  system: l.system,
  message: l.message,
  status: l.status,
  adminNotes: l.admin_notes,
  createdAt: l.created_at,
});

export async function listLeads(req: Request, res: Response) {
  const status = typeof req.query.status === "string" && LEAD_STATUS.includes(req.query.status) ? req.query.status : undefined;
  const leads = await prisma.affiliateLead.findMany({ where: status ? { status } : {}, include: { affiliate: { select: { name: true, code: true } } }, orderBy: { created_at: "desc" }, take: 500 });
  res.json({ leads: leads.map(adminLeadDto) });
}

export async function updateLead(req: Request, res: Response) {
  const id = Number(req.params.id);
  const lead = await prisma.affiliateLead.findUnique({ where: { id }, include: { affiliate: { select: { name: true, code: true } } } });
  if (!lead) return void res.status(404).json({ error: "Contato não encontrado." });
  const data: Prisma.AffiliateLeadUpdateInput = {};
  if (req.body?.status !== undefined) {
    if (!LEAD_STATUS.includes(req.body.status)) return void res.status(400).json({ error: "Situação inválida." });
    data.status = req.body.status;
  }
  if (req.body?.adminNotes !== undefined) data.admin_notes = clean(req.body.adminNotes, 2000) || null;
  const updated = await prisma.affiliateLead.update({ where: { id }, data, include: { affiliate: { select: { name: true, code: true } } } });
  if (data.status) {
    await emitAffiliateEvent("lead.updated", {
      leadId: updated.id,
      affiliateId: updated.affiliate_id,
      affiliateCode: updated.affiliate.code,
      name: updated.name,
      whatsapp: updated.whatsapp,
      business: updated.business,
      system: updated.system,
      status: updated.status,
    });
  }
  res.json({ lead: adminLeadDto(updated) });
}

// ─── Indicações ──────────────────────────────────────────────────────────
export const referralDto = (r: { id: number; affiliate_id: number; lead_id: number | null; develoi_client_id: string | null; tenant_id: number | null; asaas_subscription_id: string | null; customer_name: string; plan_value: unknown; rules: unknown; status: string; started_at: Date; cancelled_at: Date | null; affiliate?: { name: string; code: string } }) => ({
  id: r.id,
  affiliateId: r.affiliate_id,
  affiliateName: r.affiliate?.name,
  affiliateCode: r.affiliate?.code,
  leadId: r.lead_id,
  develoiClientId: r.develoi_client_id,
  tenantId: r.tenant_id,
  asaasSubscriptionId: r.asaas_subscription_id,
  customerName: r.customer_name,
  planValue: Number(r.plan_value),
  rules: safeRules(r.rules),
  status: r.status,
  startedAt: r.started_at,
  cancelledAt: r.cancelled_at,
});

export async function listReferrals(_req: Request, res: Response) {
  const rows = await prisma.affiliateReferral.findMany({ include: { affiliate: { select: { name: true, code: true } } }, orderBy: { started_at: "desc" }, take: 500 });
  res.json({ referrals: rows.map(referralDto) });
}

export async function createManualReferral(req: Request, res: Response) {
  try {
    const customerName = clean(req.body?.customerName, 191);
    if (customerName.length < 2) throw new Error("Informe o nome do cliente.");
    const referral = await createReferral({
      code: String(req.body?.code ?? ""),
      customerName,
      planValue: Number(req.body?.planValue) || 0,
      develoiClientId: clean(req.body?.develoiClientId, 191) || null,
      tenantId: req.body?.tenantId ? Number(req.body.tenantId) : null,
    });
    res.status(201).json({ referral: referralDto(referral) });
  } catch (error) {
    fail(res, error);
  }
}

export async function updateReferral(req: Request, res: Response) {
  const id = Number(req.params.id);
  const status = String(req.body?.status ?? "");
  if (!REFERRAL_STATUS.includes(status)) return void res.status(400).json({ error: "Situação inválida." });
  const found = await prisma.affiliateReferral.findUnique({ where: { id } });
  if (!found) return void res.status(404).json({ error: "Indicação não encontrada." });
  const referral = await prisma.affiliateReferral.update({
    where: { id },
    data: { status, cancelled_at: status === "cancelled" ? new Date() : null },
    include: { affiliate: { select: { name: true, code: true } } },
  });
  await emitAffiliateEvent("referral.updated", {
    referralId: referral.id,
    affiliateId: referral.affiliate_id,
    affiliateCode: referral.affiliate.code,
    affiliateName: referral.affiliate.name,
    customerName: referral.customer_name,
    develoiClientId: referral.develoi_client_id,
    planValue: Number(referral.plan_value),
    status: referral.status,
  });
  res.json({ referral: referralDto(referral) });
}

// ─── Comissões ───────────────────────────────────────────────────────────
export const commissionDto = (c: { id: number; referral_id: number; affiliate_id: number; sequence: number; status: string; gross_value: unknown; net_value: unknown; commission_value: unknown; rule_type: string; rule_value: unknown; due_date: Date | null; paid_at: Date | null; asaas_payment_id: string; referral?: { customer_name: string }; affiliate?: { name: string; code: string } }) => ({
  id: c.id,
  referralId: c.referral_id,
  affiliateId: c.affiliate_id,
  affiliateName: c.affiliate?.name,
  affiliateCode: c.affiliate?.code,
  customerName: c.referral?.customer_name,
  sequence: c.sequence,
  status: c.status,
  grossValue: Number(c.gross_value),
  netValue: c.net_value == null ? null : Number(c.net_value),
  commissionValue: Number(c.commission_value),
  ruleType: c.rule_type,
  ruleValue: Number(c.rule_value),
  dueDate: c.due_date,
  paidAt: c.paid_at,
  asaasPaymentId: c.asaas_payment_id,
});

export async function listCommissions(req: Request, res: Response) {
  const status = typeof req.query.status === "string" && COMMISSION_STATUS.includes(req.query.status) ? req.query.status : undefined;
  const affiliateId = req.query.affiliateId ? Number(req.query.affiliateId) : undefined;
  const where: Prisma.AffiliateCommissionWhereInput = { ...(status ? { status } : {}), ...(affiliateId ? { affiliate_id: affiliateId } : {}) };
  const rows = await prisma.affiliateCommission.findMany({
    where,
    include: { referral: { select: { customer_name: true } }, affiliate: { select: { name: true, code: true } } },
    orderBy: { created_at: "desc" },
    take: 1000,
  });
  const sum = (statuses: string[]) => money(rows.filter((c) => statuses.includes(c.status)).reduce((s, c) => s + Number(c.commission_value), 0));
  res.json({ commissions: rows.map(commissionDto), totals: { pending: sum(["pending", "confirmed"]), available: sum(["received"]), paid: sum(["paid"]) } });
}

export async function updateCommission(req: Request, res: Response) {
  const id = Number(req.params.id);
  const status = String(req.body?.status ?? "");
  if (!COMMISSION_STATUS.includes(status)) return void res.status(400).json({ error: "Situação inválida." });
  if (!(await prisma.affiliateCommission.findUnique({ where: { id } }))) return void res.status(404).json({ error: "Comissão não encontrada." });
  const commission = await prisma.affiliateCommission.update({
    where: { id },
    data: { status, paid_at: status === "paid" ? new Date() : undefined },
    include: { referral: { select: { customer_name: true } }, affiliate: { select: { name: true, code: true } } },
  });
  await emitAffiliateEvent("commission.updated", {
    commissionId: commission.id,
    referralId: commission.referral_id,
    affiliateId: commission.affiliate_id,
    affiliateCode: commission.affiliate.code,
    customerName: commission.referral.customer_name,
    sequence: commission.sequence,
    status: commission.status,
    grossValue: Number(commission.gross_value),
    netValue: commission.net_value == null ? null : Number(commission.net_value),
    commissionValue: Number(commission.commission_value),
    asaasPaymentId: commission.asaas_payment_id,
  });
  res.json({ commission: commissionDto(commission) });
}

// ─── Metas ───────────────────────────────────────────────────────────────
export async function listGoals(_req: Request, res: Response) {
  const goals = await prisma.affiliateGoal.findMany({ orderBy: { period_end: "desc" }, include: { affiliate: { select: { id: true, name: true } } }, take: 300 });
  res.json({
    goals: await Promise.all(
      goals.map(async (g) => ({
        ...goalDto(g, g.affiliate_id ? await currentGoalValue(g.affiliate_id, g) : 0),
        affiliateName: g.affiliate?.name ?? null,
      })),
    ),
  });
}

export async function createGoal(req: Request, res: Response) {
  try {
    const data = parseGoalBody(req.body ?? {});
    const affiliateId = req.body?.affiliateId ? Number(req.body.affiliateId) : null;
    if (affiliateId && !(await prisma.affiliate.findUnique({ where: { id: affiliateId } }))) throw new Error("Afiliado não encontrado.");
    const goal = await prisma.affiliateGoal.create({ data: { ...data, affiliate_id: affiliateId, created_by: "admin" } });
    res.status(201).json({ goal: goalDto(goal, affiliateId ? await currentGoalValue(affiliateId, goal) : 0) });
  } catch (error) {
    fail(res, error);
  }
}

export async function deleteGoal(req: Request, res: Response) {
  await prisma.affiliateGoal.deleteMany({ where: { id: Number(req.params.id) } });
  res.json({ ok: true });
}

// ─── Fila do webhook para a Develoi ──────────────────────────────────────
export async function listEvents(req: Request, res: Response) {
  const events = await prisma.affiliateEvent.findMany({
    where: req.query.pending ? { delivered_at: null } : {},
    orderBy: { id: "desc" },
    take: 200,
  });
  res.json({
    events: events.map((e) => ({ id: e.id, type: e.type, attempts: e.attempts, deliveredAt: e.delivered_at, nextTryAt: e.next_try_at, lastError: e.last_error, createdAt: e.created_at })),
  });
}

export async function retryEvent(req: Request, res: Response) {
  const result = await prisma.affiliateEvent.updateMany({ where: { id: Number(req.params.id), delivered_at: null }, data: { attempts: 0, next_try_at: new Date(), last_error: null } });
  if (result.count === 0) return void res.status(404).json({ error: "Evento não encontrado ou já entregue." });
  res.json({ ok: true });
}
