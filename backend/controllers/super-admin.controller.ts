import crypto from "crypto";

import bcrypt from "bcryptjs";
import type { Request, Response } from "express";

import { env } from "../config/env";
import { prisma } from "../config/prisma";
import {
  buildTenantAccessUrl,
  isReservedSubdomain,
  normalizeSubdomain,
} from "../utils/tenant-domain";

function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

async function validateProvisionSubdomain(rawSubdomain: string) {
  const subdomain = normalizeSubdomain(rawSubdomain);

  if (!subdomain) {
    return { subdomain, error: "Informe um subdomínio válido." };
  }

  if (isReservedSubdomain(subdomain)) {
    return { subdomain, error: "Esse subdomínio é reservado pelo sistema." };
  }

  const [existingTenant, existingInvite] = await Promise.all([
    prisma.tenant.findFirst({
      where: {
        OR: [{ slug: subdomain }, { subdomain }],
      },
      select: { id: true },
    }),
    prisma.setupInvite.findFirst({
      where: {
        subdomain,
        used_at: null,
        invite_expires_at: { gt: new Date() },
      },
      select: { id: true },
    }),
  ]);

  if (existingTenant || existingInvite) {
    return { subdomain, error: "Esse subdomínio já está em uso." };
  }

  return { subdomain, error: null };
}

function serializeTenant(tenant: {
  id: number;
  name: string;
  slug: string;
  subdomain: string;
  whatsapp: string;
  status: string;
  trial_days: number;
  trial_starts_at: Date | null;
  trial_ends_at: Date | null;
  subscription_amount: unknown;
  plan_id: number | null;
  setup_completed_at: Date | null;
  created_at: Date;
  updated_at: Date;
  users?: { id: number; name: string; email: string; role: string }[];
  plan?: { id: number; name: string; color: string } | null;
}) {
  const url = buildTenantAccessUrl(tenant.subdomain || tenant.slug);
  return {
    ...tenant,
    subscription_amount: Number(tenant.subscription_amount),
    access_url: url,
    public_url: url,
  };
}

function serializeInvite(invite: {
  id: number;
  token: string;
  store_name: string;
  subdomain: string;
  whatsapp: string;
  owner_name: string | null;
  owner_email: string | null;
  trial_days: number;
  subscription_amount: unknown;
  plan_id: number | null;
  invite_expires_at: Date;
  used_at: Date | null;
  created_at: Date;
  updated_at: Date;
}) {
  return {
    ...invite,
    subscription_amount: Number(invite.subscription_amount),
    invite_url: `${env.appBaseUrl.replace(/\/+$/, "")}/setup/${invite.token}`,
    access_url: buildTenantAccessUrl(invite.subdomain),
    is_expired: invite.invite_expires_at.getTime() < Date.now(),
  };
}

export async function getSuperAdminOverview(_req: Request, res: Response) {
  try {
    const [tenants, invites, plans] = await Promise.all([
      prisma.tenant.findMany({
        orderBy: { created_at: "desc" },
        include: {
          plan: { select: { id: true, name: true, color: true } },
          users: {
            orderBy: { created_at: "asc" },
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
        },
      }),
      prisma.setupInvite.findMany({
        orderBy: { created_at: "desc" },
      }),
      prisma.subscriptionPlan.findMany({ orderBy: [{ sort_order: "asc" }, { price: "asc" }] }),
    ]);

    res.json({
      stats: {
        tenants: tenants.length,
        active_trials: tenants.filter((tenant) => tenant.status === "trial").length,
        active_accounts: tenants.filter((tenant) => tenant.status === "active").length,
        pending_invites: invites.filter(
          (invite) => !invite.used_at && invite.invite_expires_at.getTime() > Date.now(),
        ).length,
      },
      tenants: tenants.map(serializeTenant),
      invites: invites.map(serializeInvite),
      plans: plans.map((plan) => ({ ...plan, price: Number(plan.price) })),
    });
  } catch {
    res.status(500).json({ error: "Falha ao carregar o painel do super admin." });
  }
}

export async function createSetupInvite(req: Request, res: Response) {
  const {
    storeName,
    subdomain: rawSubdomain,
    whatsapp,
    ownerName,
    ownerEmail,
    trialDays,
    subscriptionAmount,
    planId,
  } = req.body;

  try {
    const { subdomain, error } = await validateProvisionSubdomain(rawSubdomain || storeName || "");

    if (error) {
      res.status(400).json({ error });
      return;
    }

    const selectedPlan = planId ? await prisma.subscriptionPlan.findUnique({ where: { id: Number(planId) } }) : null;
    const invite = await prisma.setupInvite.create({
      data: {
        token: crypto.randomBytes(24).toString("hex"),
        store_name: String(storeName).trim(),
        subdomain,
        whatsapp: String(whatsapp || "").trim(),
        owner_name: ownerName ? String(ownerName).trim() : null,
        owner_email: ownerEmail ? String(ownerEmail).trim().toLowerCase() : null,
        plan_id: selectedPlan?.id,
        trial_days: Math.max(1, Number(trialDays) || selectedPlan?.trial_days || 30),
        subscription_amount: Number(subscriptionAmount) || Number(selectedPlan?.price) || 0,
        invite_expires_at: addDays(new Date(), env.inviteExpirationDays),
      },
    });

    res.status(201).json(serializeInvite(invite));
  } catch {
    res.status(500).json({ error: "Falha ao gerar o link de ativação." });
  }
}

export async function regenerateInvite(req: Request, res: Response) {
  try {
    const invite = await prisma.setupInvite.findUnique({
      where: { id: Number(req.params.inviteId) },
    });

    if (!invite) {
      res.status(404).json({ error: "Convite não encontrado." });
      return;
    }

    const updated = await prisma.setupInvite.update({
      where: { id: invite.id },
      data: {
        token: crypto.randomBytes(24).toString("hex"),
        invite_expires_at: addDays(new Date(), env.inviteExpirationDays),
        used_at: null,
      },
    });

    res.json(serializeInvite(updated));
  } catch {
    res.status(500).json({ error: "Falha ao regenerar o convite." });
  }
}

export async function updateSetupInvite(req: Request, res: Response) {
  const inviteId = Number(req.params.inviteId);
  const { subscriptionAmount, trialDays } = req.body;

  if (!inviteId) {
    res.status(400).json({ error: "Convite inválido." });
    return;
  }

  try {
    const invite = await prisma.setupInvite.findUnique({ where: { id: inviteId } });
    if (!invite) {
      res.status(404).json({ error: "Convite não encontrado." });
      return;
    }
    if (invite.used_at) {
      res.status(400).json({ error: "Esse convite já foi utilizado e não pode mais ser editado." });
      return;
    }

    const updated = await prisma.setupInvite.update({
      where: { id: inviteId },
      data: {
        subscription_amount: subscriptionAmount !== undefined ? Number(subscriptionAmount) || 0 : undefined,
        trial_days: trialDays !== undefined ? Math.max(1, Number(trialDays) || 30) : undefined,
      },
    });

    res.json(serializeInvite(updated));
  } catch {
    res.status(500).json({ error: "Falha ao atualizar o convite." });
  }
}

export async function updateManagedTenant(req: Request, res: Response) {
  const tenantId = Number(req.params.tenantId);
  const {
    status,
    trialDays,
    trialEndsAt,
    subscriptionAmount,
    whatsapp,
    name,
    fluxoProducaoEnabled,
    graficaEnabled,
    planId,
  } = req.body;

  if (!tenantId) {
    res.status(400).json({ error: "Tenant inválido." });
    return;
  }

  try {
    const selectedPlan = planId !== undefined && planId !== null
      ? await prisma.subscriptionPlan.findUnique({ where: { id: Number(planId) } })
      : null;
    const selectedFeatures = Array.isArray(selectedPlan?.features) ? selectedPlan.features.map(String) : [];
    const tenant = await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        name: name ? String(name).trim() : undefined,
        status: status || undefined,
        trial_days: trialDays !== undefined ? Math.max(1, Number(trialDays) || 30) : undefined,
        trial_ends_at: trialEndsAt ? new Date(trialEndsAt) : undefined,
        whatsapp: whatsapp !== undefined ? String(whatsapp).trim() : undefined,
        plan_id: planId !== undefined ? (planId ? Number(planId) : null) : undefined,
        subscription_amount: planId !== undefined && selectedPlan ? selectedPlan.price : subscriptionAmount !== undefined ? Number(subscriptionAmount) || 0 : undefined,
        fluxo_producao_enabled: planId !== undefined && selectedPlan ? selectedFeatures.includes("fluxo_producao") : fluxoProducaoEnabled !== undefined ? !!fluxoProducaoEnabled : undefined,
        grafica_enabled: planId !== undefined && selectedPlan ? selectedFeatures.includes("grafica") : graficaEnabled !== undefined ? !!graficaEnabled : undefined,
      },
      include: {
        plan: { select: { id: true, name: true, color: true } },
        users: {
          orderBy: { created_at: "asc" },
          select: { id: true, name: true, email: true, role: true },
        },
      },
    });

    res.json(serializeTenant(tenant));
  } catch {
    res.status(500).json({ error: "Falha ao atualizar o tenant." });
  }
}

export async function updateTenantUser(req: Request, res: Response) {
  const tenantId = Number(req.params.tenantId);
  const userId = Number(req.params.userId);
  const { name, email, password } = req.body;

  if (!tenantId || !userId) {
    res.status(400).json({ error: "Parâmetros inválidos." });
    return;
  }

  try {
    // Confirm the user belongs to this tenant
    const existing = await prisma.user.findFirst({ where: { id: userId, tenant_id: tenantId } });
    if (!existing) {
      res.status(404).json({ error: "Usuário não encontrado nesse tenant." });
      return;
    }

    // Check email uniqueness if changing email
    if (email && email !== existing.email) {
      const conflict = await prisma.user.findFirst({ where: { email: String(email).trim().toLowerCase() } });
      if (conflict) {
        res.status(409).json({ error: "E-mail já está em uso por outro usuário." });
        return;
      }
    }

    const data: Record<string, unknown> = {};
    if (name) data.name = String(name).trim();
    if (email) data.email = String(email).trim().toLowerCase();
    if (password && String(password).length >= 6) {
      data.password_hash = await bcrypt.hash(String(password), 10);
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data,
      select: { id: true, name: true, email: true, role: true },
    });

    res.json(updated);
  } catch {
    res.status(500).json({ error: "Falha ao atualizar o usuário." });
  }
}

function planPayload(body: Record<string, unknown>) {
  const features = Array.isArray(body.features) ? body.features.map(String).filter(Boolean) : [];
  const limits = body.limits && typeof body.limits === "object" ? body.limits : {};
  return {
    name: String(body.name || "").trim(),
    description: body.description ? String(body.description).trim() : null,
    price: Math.max(0, Number(body.price) || 0),
    billing_cycle: body.billingCycle === "yearly" ? "yearly" : "monthly",
    trial_days: Math.max(0, Number(body.trialDays) || 0),
    features,
    limits,
    color: /^#[0-9a-f]{6}$/i.test(String(body.color || "")) ? String(body.color) : "#2563eb",
    is_featured: !!body.isFeatured,
    is_active: body.isActive !== false,
    sort_order: Number(body.sortOrder) || 0,
  };
}

export async function listSubscriptionPlans(_req: Request, res: Response) {
  try {
    const plans = await prisma.subscriptionPlan.findMany({
      orderBy: [{ sort_order: "asc" }, { price: "asc" }],
      include: { _count: { select: { tenants: true } } },
    });
    res.json(plans.map((plan) => ({ ...plan, price: Number(plan.price), subscribers: plan._count.tenants })));
  } catch {
    res.status(500).json({ error: "Falha ao carregar os planos." });
  }
}

export async function createSubscriptionPlan(req: Request, res: Response) {
  const data = planPayload(req.body || {});
  if (!data.name) { res.status(400).json({ error: "Informe o nome do plano." }); return; }
  if (data.features.length === 0) { res.status(400).json({ error: "Selecione ao menos um recurso." }); return; }
  try {
    const plan = await prisma.subscriptionPlan.create({ data });
    res.status(201).json({ ...plan, price: Number(plan.price), subscribers: 0 });
  } catch {
    res.status(500).json({ error: "Falha ao criar o plano." });
  }
}

export async function updateSubscriptionPlan(req: Request, res: Response) {
  const id = Number(req.params.planId);
  if (!id) { res.status(400).json({ error: "Plano inválido." }); return; }
  const data = planPayload(req.body || {});
  if (!data.name) { res.status(400).json({ error: "Informe o nome do plano." }); return; }
  try {
    const plan = await prisma.subscriptionPlan.update({ where: { id }, data });
    const subscribers = await prisma.tenant.count({ where: { plan_id: id } });
    res.json({ ...plan, price: Number(plan.price), subscribers });
  } catch {
    res.status(500).json({ error: "Falha ao atualizar o plano." });
  }
}

export async function archiveSubscriptionPlan(req: Request, res: Response) {
  const id = Number(req.params.planId);
  if (!id) { res.status(400).json({ error: "Plano inválido." }); return; }
  try {
    const plan = await prisma.subscriptionPlan.update({ where: { id }, data: { is_active: false } });
    res.json({ ...plan, price: Number(plan.price) });
  } catch {
    res.status(500).json({ error: "Falha ao arquivar o plano." });
  }
}
