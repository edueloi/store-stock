import type { Request, Response } from "express";

import { prisma } from "../config/prisma";
import {
  AffiliateError,
  createReferral,
  normalizeCode,
  processPaymentEvent,
  safeRules,
  splitForSequence,
} from "../services/affiliates/affiliates.service";
import { emitAffiliateEvent } from "../services/affiliates/events";
import { ruleForSequence, windowMonths } from "../services/affiliates/rules";

// API server-to-server usada pela Develoi (x-api-key). A Develoi cobra o cliente no Asaas; aqui ela
// registra a indicação, busca o split da faixa de cada mês e repassa os eventos de pagamento.

function fail(res: Response, error: unknown) {
  if (error instanceof AffiliateError) return void res.status(error.status).json({ error: error.message });
  console.error("Erro na API externa de afiliados", (error as Error)?.message);
  res.status(500).json({ error: "Não foi possível concluir agora." });
}

export async function resolveCode(req: Request, res: Response) {
  const affiliate = await prisma.affiliate.findUnique({ where: { code: normalizeCode(req.params.code) }, include: { plan: true } });
  if (!affiliate || affiliate.status !== "active") return void res.json({ valid: false });
  const rules = safeRules(affiliate.rules_override ?? affiliate.plan?.rules ?? []);
  res.json({ valid: true, affiliateId: affiliate.id, name: affiliate.name, hasWallet: Boolean(affiliate.asaas_wallet_id), windowMonths: windowMonths(rules) });
}

export async function registerReferral(req: Request, res: Response) {
  try {
    const develoiClientId = String(req.body?.develoiClientId ?? "").trim();
    if (!develoiClientId) throw new AffiliateError("Informe develoiClientId.");
    const referral = await createReferral({
      code: String(req.body?.code ?? ""),
      develoiClientId,
      customerName: String(req.body?.customerName ?? "Cliente").trim() || "Cliente",
      planValue: Number(req.body?.planValue) || 0,
      asaasSubscriptionId: req.body?.asaasSubscriptionId ? String(req.body.asaasSubscriptionId) : null,
      tenantId: req.body?.tenantId ? Number(req.body.tenantId) : null,
      leadId: req.body?.leadId ? Number(req.body.leadId) : null,
    });
    const full = await prisma.affiliateReferral.findUniqueOrThrow({ where: { id: referral.id }, include: { affiliate: true } });
    res.status(201).json({ referralId: referral.id, split: await splitForSequence(full, 1), rules: safeRules(referral.rules) });
  } catch (error) {
    fail(res, error);
  }
}

export async function getSplit(req: Request, res: Response) {
  try {
    const sequence = Number(req.query.sequence ?? 1);
    const referral = await prisma.affiliateReferral.findUnique({ where: { develoi_client_id: req.params.develoiClientId }, include: { affiliate: true } });
    if (!referral) throw new AffiliateError("Indicação não encontrada.", 404);
    if (referral.status === "cancelled") return void res.json({ split: null, rule: null });
    res.json({ split: await splitForSequence(referral, sequence), rule: ruleForSequence(safeRules(referral.rules), sequence) });
  } catch (error) {
    fail(res, error);
  }
}

export async function receivePaymentEvent(req: Request, res: Response) {
  try {
    const { event, payment } = req.body ?? {};
    if (typeof event !== "string" || !payment?.id) throw new AffiliateError("Informe event e payment.id.");
    if (!req.body.develoiClientId && !req.body.asaasSubscriptionId) throw new AffiliateError("Informe develoiClientId ou asaasSubscriptionId.");
    const result = await processPaymentEvent({
      event,
      develoiClientId: req.body.develoiClientId ? String(req.body.develoiClientId) : null,
      asaasSubscriptionId: req.body.asaasSubscriptionId ? String(req.body.asaasSubscriptionId) : null,
      sequence: req.body.sequence ? Number(req.body.sequence) : null,
      payment: {
        id: String(payment.id),
        value: Number(payment.value) || 0,
        netValue: payment.netValue != null ? Number(payment.netValue) : null,
        dueDate: payment.dueDate ?? null,
        paymentDate: payment.paymentDate ?? null,
        split: Array.isArray(payment.split) ? payment.split : null,
      },
    });
    res.json({ ok: true, result });
  } catch (error) {
    fail(res, error);
  }
}

export async function setReferralStatus(req: Request, res: Response) {
  try {
    const status = String(req.body?.status ?? "");
    if (!["active", "overdue", "cancelled"].includes(status)) throw new AffiliateError("Situação inválida.");
    const referral = await prisma.affiliateReferral.findUnique({ where: { develoi_client_id: req.params.develoiClientId }, include: { affiliate: true } });
    if (!referral) throw new AffiliateError("Indicação não encontrada.", 404);
    if (referral.status !== status) {
      await prisma.affiliateReferral.update({ where: { id: referral.id }, data: { status, cancelled_at: status === "cancelled" ? new Date() : null } });
      await emitAffiliateEvent("referral.updated", {
        referralId: referral.id,
        affiliateId: referral.affiliate_id,
        affiliateCode: referral.affiliate.code,
        affiliateName: referral.affiliate.name,
        customerName: referral.customer_name,
        develoiClientId: referral.develoi_client_id,
        planValue: Number(referral.plan_value),
        status,
      });
    }
    res.json({ ok: true });
  } catch (error) {
    fail(res, error);
  }
}
