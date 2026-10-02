import bcrypt from "bcryptjs";
import type { Request, Response } from "express";

import { prisma } from "../config/prisma";
import { buildTenantAccessUrl, isReservedSubdomain, normalizeSubdomain } from "../utils/tenant-domain";

// API externa server-to-server (autenticada por API Key, não por sessão de login) para
// outras aplicações criarem/consultarem/editarem/bloquearem/deletarem tenants — mesma
// ideia usada no projeto cardapio-delivery (src/backend/routes/external-api-routes.ts).

function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function serializeTenant(tenant: any) {
  const owner = Array.isArray(tenant.users) ? tenant.users[0] : tenant.users;
  return {
    id: tenant.id,
    name: tenant.name,
    slug: tenant.slug,
    subdomain: tenant.subdomain,
    whatsapp: tenant.whatsapp ?? null,
    document: tenant.document ?? null,
    accessUrl: buildTenantAccessUrl(tenant.subdomain || tenant.slug),
    status: tenant.status,
    trialDays: tenant.trial_days,
    trialEndsAt: tenant.trial_ends_at,
    subscriptionAmount: tenant.subscription_amount !== undefined ? Number(tenant.subscription_amount) : undefined,
    planId: tenant.plan_id,
    planName: tenant.plan?.name ?? null,
    createdAt: tenant.created_at,
    owner: owner ? { id: owner.id, name: owner.name, email: owner.email, phone: owner.phone ?? null } : null,
  };
}

const tenantWithOwnerInclude = {
  plan: { select: { id: true, name: true } },
  users: {
    where: { role: "admin" },
    orderBy: { id: "asc" as const },
    take: 1,
    select: { id: true, name: true, email: true, phone: true },
  },
};

// ── LISTAR / CONSULTAR ─────────────────────────────────────────────────────────

export async function listTenants(_req: Request, res: Response) {
  try {
    const tenants = await prisma.tenant.findMany({
      orderBy: { created_at: "desc" },
      include: tenantWithOwnerInclude,
    });
    res.json(tenants.map(serializeTenant));
  } catch {
    res.status(500).json({ error: "Falha ao listar estabelecimentos." });
  }
}

export async function getTenant(req: Request, res: Response) {
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: Number(req.params.id) },
      include: tenantWithOwnerInclude,
    });
    if (!tenant) return res.status(404).json({ error: "Estabelecimento não encontrado." });
    res.json(serializeTenant(tenant));
  } catch {
    res.status(500).json({ error: "Falha ao consultar estabelecimento." });
  }
}

// ── CRIAR (Tenant + User admin) ─────────────────────────────────────────────────

export async function createTenant(req: Request, res: Response) {
  const {
    storeName,
    subdomain: rawSubdomain,
    whatsapp,
    ownerName,
    ownerEmail,
    ownerPassword,
    planId,
    trialDays,
    subscriptionAmount,
  } = req.body;

  if (!storeName || !ownerName || !ownerEmail || !ownerPassword) {
    return res.status(400).json({ error: "storeName, ownerName, ownerEmail e ownerPassword são obrigatórios." });
  }

  try {
    const subdomain = normalizeSubdomain(rawSubdomain || storeName);
    if (!subdomain) {
      return res.status(400).json({ error: "Subdomínio inválido." });
    }
    if (isReservedSubdomain(subdomain)) {
      return res.status(400).json({ error: "Esse subdomínio é reservado pelo sistema." });
    }

    const [existingTenant, existingUser] = await Promise.all([
      prisma.tenant.findFirst({ where: { OR: [{ slug: subdomain }, { subdomain }] } }),
      prisma.user.findUnique({ where: { email: String(ownerEmail).trim().toLowerCase() } }),
    ]);
    if (existingTenant) return res.status(400).json({ error: "Esse subdomínio já está em uso." });
    if (existingUser) return res.status(400).json({ error: "Já existe uma conta com esse e-mail." });

    const selectedPlan = planId ? await prisma.subscriptionPlan.findUnique({ where: { id: Number(planId) } }) : null;

    const tenant = await prisma.tenant.create({
      data: {
        name: String(storeName).trim(),
        slug: subdomain,
        subdomain,
        whatsapp: String(whatsapp || "").trim(),
        status: "active",
        plan_id: selectedPlan?.id,
        trial_days: Math.max(1, Number(trialDays) || selectedPlan?.trial_days || 30),
        trial_starts_at: new Date(),
        trial_ends_at: addDays(new Date(), Math.max(1, Number(trialDays) || selectedPlan?.trial_days || 30)),
        subscription_amount: Number(subscriptionAmount) || Number(selectedPlan?.price) || 0,
        setup_completed_at: new Date(),
      },
    });

    const hashedPassword = await bcrypt.hash(ownerPassword, 10);
    const user = await prisma.user.create({
      data: {
        tenant_id: tenant.id,
        name: String(ownerName).trim(),
        email: String(ownerEmail).trim().toLowerCase(),
        password: hashedPassword,
        role: "admin",
      },
    });

    const full = await prisma.tenant.findUnique({ where: { id: tenant.id }, include: tenantWithOwnerInclude });
    res.status(201).json(serializeTenant({ ...full, users: [user] }));
  } catch (error) {
    console.error("external/tenants create error:", error);
    res.status(500).json({ error: "Falha ao criar estabelecimento." });
  }
}

// ── EDITAR ───────────────────────────────────────────────────────────────────

export async function updateTenant(req: Request, res: Response) {
  const { name, whatsapp, subscriptionAmount, planId, trialDays, trialEndsAt } = req.body;
  try {
    const tenant = await prisma.tenant.findUnique({ where: { id: Number(req.params.id) } });
    if (!tenant) return res.status(404).json({ error: "Estabelecimento não encontrado." });

    // trialEndsAt: vencimento informado por quem cobra (ex.: Develoi) — aparece como "Vence" no painel
    const endsAt = trialEndsAt ? new Date(trialEndsAt) : null;
    if (endsAt && Number.isNaN(endsAt.getTime())) return res.status(400).json({ error: "trialEndsAt inválido." });

    const updated = await prisma.tenant.update({
      where: { id: tenant.id },
      data: {
        name: name !== undefined ? String(name).trim() : undefined,
        whatsapp: whatsapp !== undefined ? String(whatsapp).trim() : undefined,
        subscription_amount: subscriptionAmount !== undefined ? Number(subscriptionAmount) : undefined,
        plan_id: planId !== undefined ? Number(planId) : undefined,
        trial_days: trialDays !== undefined ? Math.max(1, Number(trialDays)) : undefined,
        trial_ends_at: endsAt ?? undefined,
      },
      include: tenantWithOwnerInclude,
    });
    res.json(serializeTenant(updated));
  } catch (error) {
    console.error("external/tenants update error:", error);
    res.status(500).json({ error: "Falha ao editar estabelecimento." });
  }
}

// ── BLOQUEAR / DESBLOQUEAR ──────────────────────────────────────────────────────

export async function blockTenant(req: Request, res: Response) {
  try {
    const tenant = await prisma.tenant.findUnique({ where: { id: Number(req.params.id) } });
    if (!tenant) return res.status(404).json({ error: "Estabelecimento não encontrado." });

    const updated = await prisma.tenant.update({
      where: { id: tenant.id },
      data: { status: "suspended" },
      include: tenantWithOwnerInclude,
    });
    res.json(serializeTenant(updated));
  } catch (error) {
    console.error("external/tenants block error:", error);
    res.status(500).json({ error: "Falha ao bloquear estabelecimento." });
  }
}

export async function unblockTenant(req: Request, res: Response) {
  try {
    const tenant = await prisma.tenant.findUnique({ where: { id: Number(req.params.id) } });
    if (!tenant) return res.status(404).json({ error: "Estabelecimento não encontrado." });

    const updated = await prisma.tenant.update({
      where: { id: tenant.id },
      data: { status: "active" },
      include: tenantWithOwnerInclude,
    });
    res.json(serializeTenant(updated));
  } catch (error) {
    console.error("external/tenants unblock error:", error);
    res.status(500).json({ error: "Falha ao desbloquear estabelecimento." });
  }
}

// ── DELETAR ──────────────────────────────────────────────────────────────────

export async function deleteTenant(req: Request, res: Response) {
  try {
    const tenant = await prisma.tenant.findUnique({ where: { id: Number(req.params.id) } });
    if (!tenant) return res.status(404).json({ error: "Estabelecimento não encontrado." });
    await prisma.tenant.delete({ where: { id: tenant.id } });
    res.json({ ok: true });
  } catch (error) {
    console.error("external/tenants delete error:", error);
    res.status(500).json({ error: "Falha ao deletar estabelecimento." });
  }
}

// ── PLANOS (só leitura) ────────────────────────────────────────────────────────

export async function listPlans(_req: Request, res: Response) {
  try {
    const plans = await prisma.subscriptionPlan.findMany({
      where: { is_active: true },
      orderBy: { sort_order: "asc" },
    });
    res.json(
      plans.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        price: Number(p.price),
        billingCycle: p.billing_cycle,
        trialDays: p.trial_days,
      }))
    );
  } catch {
    res.status(500).json({ error: "Falha ao listar planos." });
  }
}
