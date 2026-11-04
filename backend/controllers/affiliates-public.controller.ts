import crypto from "node:crypto";

import type { NextFunction, Request, Response } from "express";

import { prisma } from "../config/prisma";
import { env } from "../config/env";
import { sendAffiliateLoginEmail, sendAffiliateWelcomeEmail } from "../services/affiliates/affiliate-mail";
import {
  digitsOnly,
  generateAffiliateCode,
  normalizeCode,
  normalizeEmail,
  resolveAffiliateRules,
  safeRules,
} from "../services/affiliates/affiliates.service";
import { checkPassword, consumeLoginToken, createLoginToken, hashPassword, passwordProblem, signAffiliateToken } from "../services/affiliates/auth";
import { emitAffiliateEvent } from "../services/affiliates/events";
import { windowMonths } from "../services/affiliates/rules";
import { publicAffiliate } from "../services/affiliates/affiliates.service";

// Limitador simples em memória (mesmo estilo do checkout público): `max` chamadas por janela e por IP.
function limiter(max: number, windowMs: number, byEmail = false) {
  const hits = new Map<string, { count: number; until: number }>();
  return (req: Request, res: Response, next: NextFunction) => {
    // no login, a conta tentada entra na chave: o chute em uma conta não bloqueia as outras do mesmo IP
    const key = `${req.path}:${req.ip}${byEmail ? `:${normalizeEmail(req.body?.email)}` : ""}`;
    const now = Date.now();
    const entry = hits.get(key);
    if (entry && entry.until > now && entry.count >= max) {
      res.status(429).json({ error: "Muitas tentativas. Aguarde alguns minutos e tente de novo." });
      return;
    }
    if (!entry || entry.until <= now) {
      if (hits.size >= 10_000) hits.delete(hits.keys().next().value!);
      hits.set(key, { count: 1, until: now + windowMs });
    } else entry.count++;
    next();
  };
}

export const limitApply = limiter(8, 60 * 60_000);
export const limitAuth = limiter(10, 15 * 60_000);
export const limitLogin = limiter(8, 15 * 60_000, true);
export const limitLead = limiter(20, 60 * 60_000);
export const limitClick = limiter(120, 10 * 60_000);

const clean = (value: unknown, max: number) => String(value ?? "").trim().slice(0, max);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const WALLET_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Plano padrão ativo, para a página de vendas mostrar os números reais. */
export async function getProgram(_req: Request, res: Response) {
  const plan = await prisma.affiliatePlan.findFirst({ where: { is_default: true, is_active: true } });
  if (!plan) {
    res.json({ plan: null, windowMonths: 0 });
    return;
  }
  const rules = safeRules(plan.rules);
  res.json({ plan: { name: plan.name, rules }, windowMonths: windowMonths(rules) });
}

export async function validateCode(req: Request, res: Response) {
  const affiliate = await prisma.affiliate.findUnique({ where: { code: normalizeCode(req.params.code) } });
  if (!affiliate || affiliate.status !== "active") {
    res.json({ valid: false });
    return;
  }
  res.json({ valid: true, firstName: affiliate.name.split(/\s+/)[0] });
}

/**
 * Cadastro aberto: qualquer pessoa vira afiliado ativa na hora, com código, link e sessão aberta.
 * A equipe só entra depois, para suspender abuso. O walletId pode vir depois (sem ele não há split).
 */
export async function applyAffiliate(req: Request, res: Response) {
  const name = clean(req.body?.name, 120);
  const email = normalizeEmail(req.body?.email);
  const whatsapp = digitsOnly(req.body?.whatsapp);
  const document = digitsOnly(req.body?.document);
  const walletId = clean(req.body?.asaasWalletId, 60);
  const password = req.body?.password;

  if (name.length < 3) return void res.status(400).json({ error: "Informe seu nome completo." });
  if (!EMAIL_RE.test(email)) return void res.status(400).json({ error: "Informe um e-mail válido." });
  if (whatsapp.length < 10 || whatsapp.length > 13) return void res.status(400).json({ error: "Informe um WhatsApp com DDD." });
  if (document && ![11, 14].includes(document.length)) return void res.status(400).json({ error: "CPF ou CNPJ inválido." });
  if (walletId && !WALLET_RE.test(walletId)) return void res.status(400).json({ error: "O walletId do Asaas tem o formato 00000000-0000-0000-0000-000000000000." });
  const weak = passwordProblem(password);
  if (weak) return void res.status(400).json({ error: weak });

  if (await prisma.affiliate.findUnique({ where: { email } })) {
    res.status(409).json({ error: "Este e-mail já está cadastrado. Entre com a sua senha ou peça um link de acesso." });
    return;
  }

  const code = await generateAffiliateCode(name);
  const created = await prisma.affiliate.create({
    data: {
      code,
      name,
      email,
      whatsapp,
      document: document || null,
      asaas_wallet_id: walletId || null,
      pitch: clean(req.body?.pitch, 1000) || null,
      password_hash: await hashPassword(String(password)),
      status: "active",
      approved_at: new Date(),
    },
    include: { plan: true },
  });

  await emitAffiliateEvent("affiliate.applied", {
    affiliateId: created.id,
    code: created.code,
    name: created.name,
    email: created.email,
    whatsapp: created.whatsapp,
    status: created.status,
    walletStatus: created.wallet_status,
    planName: created.plan?.name ?? null,
    link: `${env.affiliateSiteUrl}/store-boxsys/?ref=${created.code}`,
  });

  // boas-vindas por e-mail (o WhatsApp sai pela Develoi, que recebe o evento acima); falha de e-mail não derruba o cadastro
  void resolveAffiliateRules(created)
    .then((rules) => sendAffiliateWelcomeEmail(created.email, created.name, created.code, rules))
    .catch((error) => console.error("Falha ao enviar boas-vindas de afiliado", (error as Error).message));

  res.status(201).json({ ok: true, code: created.code, token: signAffiliateToken(created.id), affiliate: publicAffiliate(created) });
}

/** Entrada com e-mail e senha. A resposta é a mesma para e-mail inexistente e senha errada. */
export async function loginWithPassword(req: Request, res: Response) {
  const email = normalizeEmail(req.body?.email);
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  const affiliate = EMAIL_RE.test(email) ? await prisma.affiliate.findUnique({ where: { email }, include: { plan: true } }) : null;
  const ok = await checkPassword(password, affiliate?.password_hash);
  if (!affiliate || !ok) return void res.status(401).json({ error: "E-mail ou senha incorretos." });
  if (affiliate.status === "suspended" || affiliate.status === "rejected") {
    return void res.status(403).json({ error: "Este acesso está desativado. Fale com a equipe BoxSys." });
  }
  await prisma.affiliate.update({ where: { id: affiliate.id }, data: { last_login_at: new Date() } });
  res.json({ token: signAffiliateToken(affiliate.id), affiliate: publicAffiliate(affiliate) });
}

/** Sempre responde igual, exista ou não o e-mail (não revela quem é afiliado). */
export async function requestLogin(req: Request, res: Response) {
  const email = normalizeEmail(req.body?.email);
  res.json({ ok: true });
  if (!EMAIL_RE.test(email)) return;
  try {
    const affiliate = await prisma.affiliate.findUnique({ where: { email } });
    if (!affiliate || affiliate.status === "suspended" || affiliate.status === "rejected") return;
    const token = await createLoginToken(affiliate.id);
    await sendAffiliateLoginEmail(affiliate.email, affiliate.name, token);
  } catch (error) {
    console.error("Falha ao enviar link de acesso de afiliado", (error as Error).message);
  }
}

export async function verifyLogin(req: Request, res: Response) {
  const token = clean(req.body?.token, 200);
  const affiliate = token ? await consumeLoginToken(token) : null;
  if (!affiliate) {
    res.status(401).json({ error: "Este link expirou ou já foi usado. Peça um novo." });
    return;
  }
  const full = await prisma.affiliate.findUniqueOrThrow({ where: { id: affiliate.id }, include: { plan: true } });
  res.json({ token: signAffiliateToken(affiliate.id, "link"), affiliate: publicAffiliate(full) });
}

export async function trackClick(req: Request, res: Response) {
  try {
    const affiliate = await prisma.affiliate.findUnique({ where: { code: normalizeCode(req.body?.code) } });
    if (affiliate && affiliate.status === "active") {
      // um visitante por dia por afiliado: o hash mistura IP, navegador e a data
      const day = new Date().toISOString().slice(0, 10);
      const visitor = crypto.createHash("sha256").update(`${req.ip}|${req.headers["user-agent"] ?? ""}|${day}|${affiliate.id}`).digest("hex").slice(0, 32);
      const exists = await prisma.affiliateClick.findFirst({ where: { affiliate_id: affiliate.id, visitor_hash: visitor }, select: { id: true } });
      if (!exists) {
        await prisma.affiliateClick.create({ data: { affiliate_id: affiliate.id, visitor_hash: visitor, landing: clean(req.body?.landing, 190) || null } });
      }
    }
  } catch (error) {
    console.error("Falha ao registrar clique de afiliado", (error as Error).message);
  }
  // nunca revela se o código existe: a resposta é sempre a mesma
  res.json({ ok: true });
}

export async function createPublicLead(req: Request, res: Response) {
  const affiliate = await prisma.affiliate.findUnique({ where: { code: normalizeCode(req.body?.code) } });
  const name = clean(req.body?.name, 120);
  const whatsapp = digitsOnly(req.body?.whatsapp);
  if (name.length < 2) return void res.status(400).json({ error: "Informe o nome." });
  if (whatsapp.length < 10 || whatsapp.length > 13) return void res.status(400).json({ error: "Informe um WhatsApp com DDD." });
  // código inválido não gera erro visível para o visitante: o contato dele não pode se perder por isso
  if (!affiliate || affiliate.status !== "active") return void res.status(201).json({ ok: true });

  const system = ["store", "menu", "ambos"].includes(req.body?.system) ? req.body.system : "store";
  const lead = await prisma.affiliateLead.create({
    data: {
      affiliate_id: affiliate.id,
      name,
      whatsapp,
      email: normalizeEmail(req.body?.email) || null,
      business: clean(req.body?.business, 150) || null,
      system,
      message: clean(req.body?.message, 1000) || null,
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
  res.status(201).json({ ok: true });
}

export { resolveAffiliateRules };
