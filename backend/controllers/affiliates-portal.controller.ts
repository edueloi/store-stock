import type { Request, Response } from "express";
import type { AffiliateGoal, Prisma } from "@prisma/client";

import { env } from "../config/env";
import { prisma } from "../config/prisma";
import {
  affiliateStats,
  digitsOnly,
  money,
  normalizeCampaign,
  normalizeEmail,
  publicAffiliate,
  referralProgress,
  resolveAffiliateRules,
} from "../services/affiliates/affiliates.service";
import { checkPassword, hashPassword, passwordProblem, type AffiliateRequest } from "../services/affiliates/auth";
import { emitAffiliateEvent } from "../services/affiliates/events";
import { ruleForSequence, windowMonths } from "../services/affiliates/rules";

const me = (req: Request) => (req as AffiliateRequest).affiliate;
const clean = (value: unknown, max: number) => String(value ?? "").trim().slice(0, max);
const WALLET_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const METRICS = ["leads", "sales", "commission"] as const;

const leadDto = (l: { id: number; name: string; whatsapp: string; email: string | null; business: string | null; system: string; message: string | null; status: string; created_at: Date; campaign: string | null; origin: string; trial_ends_at: Date | null }) => ({
  id: l.id,
  name: l.name,
  whatsapp: l.whatsapp,
  email: l.email,
  business: l.business,
  system: l.system,
  message: l.message,
  status: l.status,
  campaign: l.campaign,
  origin: l.origin,
  trialEndsAt: l.trial_ends_at,
  createdAt: l.created_at,
});

// ─── Links nomeados (cada um com campanha e números próprios) ────────────
const MAX_LINKS = 30;
const baseLink = (code: string, campaign?: string | null) => `${env.affiliateSiteUrl}/store/?ref=${code}${campaign ? `&c=${campaign}` : ""}`;

async function linkRows(affiliate: { id: number; code: string }) {
  const links = await prisma.affiliateLink.findMany({ where: { affiliate_id: affiliate.id }, orderBy: { id: "asc" } });
  const [clicks, leads] = await Promise.all([
    prisma.affiliateClick.groupBy({ by: ["campaign"], where: { affiliate_id: affiliate.id }, _count: { _all: true } }),
    prisma.affiliateLead.groupBy({ by: ["campaign", "status"], where: { affiliate_id: affiliate.id }, _count: { _all: true } }),
  ]);
  const clickBy = new Map(clicks.map((c) => [c.campaign ?? "", c._count._all]));
  const leadsFor = (campaign: string | null) => leads.filter((l) => (l.campaign ?? "") === (campaign ?? ""));
  const sum = (rows: { _count: { _all: number } }[]) => rows.reduce((t, r) => t + r._count._all, 0);
  const row = (id: number | null, publicId: string, name: string, campaign: string | null, createdAt: Date | null) => {
    const mine = leadsFor(campaign);
    return {
      id,
      publicId,
      name,
      campaign,
      url: baseLink(affiliate.code, campaign),
      clicks: clickBy.get(campaign ?? "") ?? 0,
      leads: sum(mine),
      trials: sum(mine.filter((l) => l.status === "trial")),
      sales: sum(mine.filter((l) => l.status === "won")),
      createdAt,
    };
  };
  return [row(null, affiliate.code, "Link geral", null, null), ...links.map((l, i) => row(l.id, `${affiliate.code}-${String(i + 1).padStart(2, "0")}`, l.name, l.campaign, l.created_at))];
}

export async function listLinks(req: Request, res: Response) {
  res.json({ baseUrl: baseLink(me(req).code), links: await linkRows(me(req)) });
}

export async function createLink(req: Request, res: Response) {
  const affiliate = me(req);
  const name = clean(req.body?.name, 40);
  if (name.length < 2) return void res.status(400).json({ error: "Dê um nome ao link (de 2 a 40 letras)." });
  const base = normalizeCampaign(name);
  if (!base) return void res.status(400).json({ error: "Use letras ou números no nome do link." });
  if ((await prisma.affiliateLink.count({ where: { affiliate_id: affiliate.id } })) >= MAX_LINKS) {
    return void res.status(409).json({ error: `Você chegou ao limite de ${MAX_LINKS} links. Apague algum que não usa mais.` });
  }
  let campaign = base;
  for (let n = 2; await prisma.affiliateLink.findUnique({ where: { affiliate_id_campaign: { affiliate_id: affiliate.id, campaign } } }); n++) {
    campaign = `${base.slice(0, 36)}-${n}`;
  }
  const created = await prisma.affiliateLink.create({ data: { affiliate_id: affiliate.id, name, campaign } });
  const link = (await linkRows(affiliate)).find((l) => l.id === created.id);
  res.status(201).json({ link });
}

export async function deleteLink(req: Request, res: Response) {
  const result = await prisma.affiliateLink.deleteMany({ where: { id: Number(req.params.id), affiliate_id: me(req).id } });
  if (result.count === 0) return void res.status(404).json({ error: "Link não encontrado." });
  res.json({ ok: true });
}

export async function getMe(req: Request, res: Response) {
  const affiliate = await prisma.affiliate.findUniqueOrThrow({ where: { id: me(req).id }, include: { plan: true } });
  const rules = await resolveAffiliateRules(affiliate);
  res.json({
    affiliate: publicAffiliate(affiliate),
    link: baseLink(affiliate.code),
    rules,
    windowMonths: windowMonths(rules),
  });
}

export async function updateMe(req: Request, res: Response) {
  const current = me(req);
  const data: Prisma.AffiliateUpdateInput = {};

  if (req.body?.name !== undefined) {
    const name = clean(req.body.name, 120);
    if (name.length < 3) return void res.status(400).json({ error: "Informe seu nome completo." });
    data.name = name;
  }
  if (req.body?.whatsapp !== undefined) {
    const whatsapp = digitsOnly(req.body.whatsapp);
    if (whatsapp.length < 10 || whatsapp.length > 13) return void res.status(400).json({ error: "Informe um WhatsApp com DDD." });
    data.whatsapp = whatsapp;
  }
  if (req.body?.pitch !== undefined) data.pitch = clean(req.body.pitch, 1000) || null;

  let walletChanged = false;
  if (req.body?.asaasWalletId !== undefined) {
    const wallet = clean(req.body.asaasWalletId, 60);
    if (wallet && !WALLET_RE.test(wallet)) return void res.status(400).json({ error: "O walletId do Asaas tem o formato 00000000-0000-0000-0000-000000000000." });
    if ((wallet || null) !== current.asaas_wallet_id) {
      data.asaas_wallet_id = wallet || null;
      data.wallet_status = "pending"; // a equipe confirma de novo
      walletChanged = true;
    }
  }

  const updated = await prisma.affiliate.update({ where: { id: current.id }, data, include: { plan: true } });
  if (walletChanged || data.name || data.whatsapp) {
    await emitAffiliateEvent("affiliate.updated", {
      affiliateId: updated.id,
      code: updated.code,
      name: updated.name,
      email: updated.email,
      whatsapp: updated.whatsapp,
      status: updated.status,
      walletStatus: updated.wallet_status,
      planName: updated.plan?.name ?? null,
    });
  }
  res.json({ affiliate: publicAffiliate(updated) });
}

export async function getDashboard(req: Request, res: Response) {
  res.json(await affiliateStats(me(req).id));
}

// ─── Leads ───────────────────────────────────────────────────────────────
export async function listLeads(req: Request, res: Response) {
  const leads = await prisma.affiliateLead.findMany({ where: { affiliate_id: me(req).id }, orderBy: { created_at: "desc" }, take: 500 });
  res.json({ leads: leads.map(leadDto) });
}

export async function createLead(req: Request, res: Response) {
  const name = clean(req.body?.name, 120);
  const whatsapp = digitsOnly(req.body?.whatsapp);
  if (name.length < 2) return void res.status(400).json({ error: "Informe o nome do contato." });
  if (whatsapp.length < 10 || whatsapp.length > 13) return void res.status(400).json({ error: "Informe um WhatsApp com DDD." });
  const system = ["store", "menu", "ambos"].includes(req.body?.system) ? req.body.system : "store";
  const affiliate = me(req);
  const lead = await prisma.affiliateLead.create({
    data: {
      affiliate_id: affiliate.id,
      name,
      whatsapp,
      email: normalizeEmail(req.body?.email) || null,
      business: clean(req.body?.business, 150) || null,
      system,
      message: clean(req.body?.message, 1000) || null,
      origin: "manual",
    },
  });
  await emitAffiliateEvent("lead.created", {
    leadId: lead.id,
    affiliateId: affiliate.id,
    affiliateCode: affiliate.code,
    name: lead.name,
    whatsapp: lead.whatsapp,
    business: lead.business,
    system: lead.system,
    status: lead.status,
  });
  res.status(201).json({ lead: leadDto(lead) });
}

export async function updateLead(req: Request, res: Response) {
  const id = Number(req.params.id);
  const status = String(req.body?.status ?? "");
  if (!["new", "contacted", "negotiating", "lost"].includes(status)) return void res.status(400).json({ error: "Situação inválida." });
  const affiliate = me(req);
  const lead = await prisma.affiliateLead.findFirst({ where: { id, affiliate_id: affiliate.id } });
  if (!lead) return void res.status(404).json({ error: "Contato não encontrado." });
  if (lead.status === "won") return void res.status(409).json({ error: "Este contato virou cliente e não pode mudar de situação." });
  const updated = await prisma.affiliateLead.update({ where: { id }, data: { status } });
  await emitAffiliateEvent("lead.updated", {
    leadId: updated.id,
    affiliateId: affiliate.id,
    affiliateCode: affiliate.code,
    name: updated.name,
    whatsapp: updated.whatsapp,
    business: updated.business,
    system: updated.system,
    status: updated.status,
  });
  res.json({ lead: leadDto(updated) });
}

// ─── Clientes indicados (só enquanto a janela de comissão está aberta) ────
export async function listReferrals(req: Request, res: Response) {
  const referrals = await prisma.affiliateReferral.findMany({ where: { affiliate_id: me(req).id }, orderBy: { started_at: "desc" }, take: 500 });
  const rows = await Promise.all(
    referrals.map(async (r) => {
      const progress = await referralProgress(r);
      const next = progress.countedMonths + 1;
      return {
        id: r.id,
        customerName: r.customer_name,
        status: r.status,
        startedAt: r.started_at,
        planValue: Number(r.plan_value),
        totalMonths: progress.totalMonths,
        countedMonths: progress.countedMonths,
        open: progress.open && r.status !== "cancelled",
        currentRule: ruleForSequence(progress.rules, Math.max(progress.countedMonths, 1)),
        nextRule: ruleForSequence(progress.rules, next),
      };
    }),
  );
  res.json({ referrals: req.query.all ? rows : rows.filter((r) => r.open) });
}

// ─── Comissões ───────────────────────────────────────────────────────────
export async function listCommissions(req: Request, res: Response) {
  const status = typeof req.query.status === "string" && req.query.status ? req.query.status : undefined;
  const rows = await prisma.affiliateCommission.findMany({
    where: { affiliate_id: me(req).id, ...(status ? { status } : {}) },
    include: { referral: { select: { customer_name: true } } },
    orderBy: { created_at: "desc" },
    take: 1000,
  });
  const all = status ? await prisma.affiliateCommission.findMany({ where: { affiliate_id: me(req).id }, select: { status: true, commission_value: true } }) : rows;
  const sum = (list: { status: string; commission_value: unknown }[], statuses: string[]) =>
    money(list.filter((c) => statuses.includes(c.status)).reduce((s, c) => s + Number(c.commission_value), 0));
  res.json({
    commissions: rows.map((c) => ({
      id: c.id,
      referralId: c.referral_id,
      customerName: c.referral.customer_name,
      sequence: c.sequence,
      status: c.status,
      grossValue: Number(c.gross_value),
      netValue: c.net_value == null ? null : Number(c.net_value),
      commissionValue: Number(c.commission_value),
      ruleType: c.rule_type,
      ruleValue: Number(c.rule_value),
      dueDate: c.due_date,
      paidAt: c.paid_at,
    })),
    totals: { pending: sum(all, ["pending", "confirmed"]), available: sum(all, ["received"]), paid: sum(all, ["paid"]) },
  });
}

// ─── Metas ───────────────────────────────────────────────────────────────
export async function currentGoalValue(affiliateId: number, goal: Pick<AffiliateGoal, "metric" | "period_start" | "period_end">) {
  const start = new Date(goal.period_start);
  const end = new Date(goal.period_end);
  end.setHours(23, 59, 59, 999);
  if (goal.metric === "leads") return prisma.affiliateLead.count({ where: { affiliate_id: affiliateId, created_at: { gte: start, lte: end } } });
  if (goal.metric === "sales") return prisma.affiliateReferral.count({ where: { affiliate_id: affiliateId, started_at: { gte: start, lte: end } } });
  const rows = await prisma.affiliateCommission.findMany({
    where: { affiliate_id: affiliateId, status: { in: ["received", "paid"] }, created_at: { gte: start, lte: end } },
    select: { commission_value: true },
  });
  return money(rows.reduce((s, c) => s + Number(c.commission_value), 0));
}

export const goalDto = (g: AffiliateGoal, current: number) => ({
  id: g.id,
  affiliateId: g.affiliate_id,
  title: g.title,
  metric: g.metric,
  target: Number(g.target),
  reward: g.reward,
  periodStart: g.period_start,
  periodEnd: g.period_end,
  createdBy: g.created_by,
  current,
  percent: Number(g.target) > 0 ? Math.min(100, Math.round((current / Number(g.target)) * 100)) : 0,
});

export async function listGoals(req: Request, res: Response) {
  const id = me(req).id;
  const goals = await prisma.affiliateGoal.findMany({ where: { OR: [{ affiliate_id: id }, { affiliate_id: null }] }, orderBy: { period_end: "desc" }, take: 200 });
  res.json({ goals: await Promise.all(goals.map(async (g) => goalDto(g, await currentGoalValue(id, g)))) });
}

export function parseGoalBody(body: Record<string, unknown>) {
  const title = clean(body.title, 120);
  const metric = String(body.metric ?? "");
  const target = Number(body.target);
  const start = new Date(String(body.periodStart ?? ""));
  const end = new Date(String(body.periodEnd ?? ""));
  if (title.length < 2) throw new Error("Dê um nome para a meta.");
  if (!(METRICS as readonly string[]).includes(metric)) throw new Error("Escolha o que a meta mede: contatos, vendas ou comissão.");
  if (!Number.isFinite(target) || target <= 0) throw new Error("A meta precisa ser maior que zero.");
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) throw new Error("Confira as datas da meta.");
  return { title, metric, target, period_start: start, period_end: end, reward: clean(body.reward, 190) || null };
}

export async function createGoal(req: Request, res: Response) {
  try {
    const data = parseGoalBody(req.body ?? {});
    const goal = await prisma.affiliateGoal.create({ data: { ...data, affiliate_id: me(req).id, created_by: "affiliate", reward: null } });
    res.status(201).json({ goal: goalDto(goal, await currentGoalValue(me(req).id, goal)) });
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
}

export async function deleteGoal(req: Request, res: Response) {
  const result = await prisma.affiliateGoal.deleteMany({ where: { id: Number(req.params.id), affiliate_id: me(req).id, created_by: "affiliate" } });
  if (result.count === 0) return void res.status(404).json({ error: "Meta não encontrada (metas da equipe não podem ser apagadas)." });
  res.json({ ok: true });
}

/**
 * Define ou troca a senha. Quem já tem senha precisa informar a atual, exceto logo depois de entrar
 * por link mágico (recuperação, 30 min). Quem nunca teve senha (conta criada pela equipe) também pode definir.
 */
export async function changePassword(req: Request, res: Response) {
  const current = me(req);
  const newPassword = req.body?.newPassword;
  const weak = passwordProblem(newPassword);
  if (weak) return void res.status(400).json({ error: weak });

  const fresh = (req as AffiliateRequest).freshLink;
  if (current.password_hash && !fresh) {
    const ok = await checkPassword(String(req.body?.currentPassword ?? ""), current.password_hash);
    if (!ok) return void res.status(403).json({ error: "A senha atual não confere." });
  }
  await prisma.affiliate.update({ where: { id: current.id }, data: { password_hash: await hashPassword(String(newPassword)) } });
  res.json({ ok: true });
}
