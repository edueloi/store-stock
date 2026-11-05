import type { NextFunction, Request, Response } from "express";
import bcrypt from "bcryptjs";

import { env } from "../config/env";
import { prisma } from "../config/prisma";
import { sendWelcomeEmail } from "../services/mailer.service";
import { digitsOnly, normalizeCampaign, normalizeCode, normalizeEmail } from "../services/affiliates/affiliates.service";
import { passwordProblem } from "../services/affiliates/auth";
import { emitAffiliateEvent } from "../services/affiliates/events";
import { isReservedSubdomain, normalizeSubdomain } from "../utils/tenant-domain";

// Criação de conta pela página de vendas do Store (boxsys.com.br/store/): a loja nasce ativa, em teste grátis,
// e a Develoi (que cobra) recebe o evento store.signup.created para criar o cliente e cobrar no fim do teste.

const TRIAL_DAYS = Number(process.env.STORE_SIGNUP_TRIAL_DAYS || 14);
const SUBSCRIPTION_AMOUNT = Number(process.env.STORE_SIGNUP_AMOUNT || 150);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const BUSINESS_TYPES = new Set(["serralheria", "vidracaria", "eletrica", "oficina", "roupas", "construcao", "otica", "mercado", "pet", "outro"]);

const clean = (value: unknown, max: number) => String(value ?? "").trim().slice(0, max);
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000);

// 5 contas novas por hora por IP (a página é pública)
const hits = new Map<string, { count: number; until: number }>();
export function limitStoreSignup(req: Request, res: Response, next: NextFunction) {
  const key = req.ip || "?";
  const now = Date.now();
  const entry = hits.get(key);
  if (entry && entry.until > now && entry.count >= 5) {
    res.status(429).json({ error: "Muitas contas criadas deste lugar. Tente de novo mais tarde ou fale com a equipe pelo WhatsApp." });
    return;
  }
  if (!entry || entry.until <= now) {
    if (hits.size >= 10_000) hits.delete(hits.keys().next().value!);
    hits.set(key, { count: 1, until: now + 60 * 60_000 });
  } else entry.count++;
  next();
}

async function freeSubdomain(storeName: string) {
  const base = normalizeSubdomain(storeName).slice(0, 34) || "loja";
  for (let attempt = 0; attempt < 8; attempt++) {
    const candidate = attempt === 0 ? base : `${base}-${Math.floor(100 + Math.random() * 900)}`;
    if (candidate.length < 3 || isReservedSubdomain(candidate)) continue;
    const taken = await prisma.tenant.findFirst({ where: { OR: [{ slug: candidate }, { subdomain: candidate }] }, select: { id: true } });
    if (!taken) return candidate;
  }
  return null;
}

export async function storeSignup(req: Request, res: Response) {
  const storeName = clean(req.body?.storeName, 120);
  const ownerName = clean(req.body?.ownerName, 120);
  const email = normalizeEmail(req.body?.email);
  const whatsapp = digitsOnly(req.body?.whatsapp);
  const document = digitsOnly(req.body?.document);
  const password = req.body?.password;
  const businessTypeRaw = clean(req.body?.businessType, 30).toLowerCase();
  const businessType = BUSINESS_TYPES.has(businessTypeRaw) ? businessTypeRaw : null;

  if (storeName.length < 2) return void res.status(400).json({ error: "Informe o nome da loja ou da empresa." });
  if (ownerName.length < 3) return void res.status(400).json({ error: "Informe o seu nome completo." });
  if (!EMAIL_RE.test(email)) return void res.status(400).json({ error: "Informe um e-mail válido." });
  if (whatsapp.length < 10 || whatsapp.length > 13) return void res.status(400).json({ error: "Informe um WhatsApp com DDD." });
  if (![11, 14].includes(document.length)) return void res.status(400).json({ error: "Informe um CPF ou CNPJ válido (só números)." });
  const weak = passwordProblem(password);
  if (weak) return void res.status(400).json({ error: weak });

  if (await prisma.user.findUnique({ where: { email } })) {
    return void res.status(409).json({ error: "Já existe uma conta com esse e-mail. Entre no sistema com a sua senha." });
  }

  const subdomain = await freeSubdomain(storeName);
  if (!subdomain) return void res.status(409).json({ error: "Não conseguimos reservar um endereço para essa loja. Tente um nome um pouco diferente." });

  // indicação (opcional): só vale afiliado ativo
  const code = normalizeCode(req.body?.ref);
  const affiliate = code ? await prisma.affiliate.findUnique({ where: { code } }) : null;
  const activeAffiliate = affiliate && affiliate.status === "active" ? affiliate : null;
  const campaign = normalizeCampaign(req.body?.campaign);

  const now = new Date();
  const trialEndsAt = addDays(now, TRIAL_DAYS);
  const passwordHash = await bcrypt.hash(String(password), 10);

  try {
    const { tenant, lead } = await prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          name: storeName,
          slug: subdomain,
          subdomain,
          whatsapp,
          document,
          status: "active",
          trial_days: TRIAL_DAYS,
          trial_starts_at: now,
          trial_ends_at: trialEndsAt,
          subscription_amount: SUBSCRIPTION_AMOUNT,
          setup_completed_at: now,
        },
      });
      await tx.user.create({ data: { tenant_id: tenant.id, name: ownerName, email, password: passwordHash, role: "admin" } });
      const lead = activeAffiliate
        ? await tx.affiliateLead.create({
            data: {
              affiliate_id: activeAffiliate.id,
              name: ownerName,
              whatsapp,
              email,
              business: storeName,
              system: "store",
              message: businessType ? `Ramo: ${businessType}` : null,
              status: "trial",
              origin: "store-signup",
              campaign,
              tenant_id: tenant.id,
              trial_ends_at: trialEndsAt,
            },
          })
        : null;
      return { tenant, lead };
    });

    await emitAffiliateEvent("store.signup.created", {
      tenantId: tenant.id,
      subdomain,
      storeName,
      ownerName,
      email,
      whatsapp,
      document,
      businessType,
      trialDays: TRIAL_DAYS,
      trialEndsAt: trialEndsAt.toISOString(),
      subscriptionAmount: SUBSCRIPTION_AMOUNT,
      affiliateCode: activeAffiliate?.code ?? null,
      campaign,
      leadId: lead?.id ?? null,
    });
    if (lead && activeAffiliate) {
      await emitAffiliateEvent("lead.created", {
        leadId: lead.id,
        affiliateId: activeAffiliate.id,
        affiliateCode: activeAffiliate.code,
        name: lead.name,
        whatsapp: lead.whatsapp,
        business: lead.business,
        system: lead.system,
        status: lead.status,
        origin: "store-signup",
        campaign,
      });
    }

    const loginUrl = `https://${env.appDomain ? `${env.primarySubdomain}.${env.appDomain}` : "store.boxsys.com.br"}`;
    void sendWelcomeEmail(email, ownerName, storeName, loginUrl).catch((error) => console.error("Falha ao enviar boas-vindas da loja nova", (error as Error).message));

    res.status(201).json({ ok: true, email, storeName, trialDays: TRIAL_DAYS, trialEndsAt: trialEndsAt.toISOString(), loginUrl });
  } catch (error) {
    if ((error as { code?: string })?.code === "P2002") {
      return void res.status(409).json({ error: "Já existe uma conta com esse e-mail ou endereço. Tente entrar no sistema." });
    }
    console.error("Falha ao criar conta pela página do Store", (error as Error).message);
    res.status(500).json({ error: "Não foi possível criar a sua conta agora. Tente de novo em instantes." });
  }
}
