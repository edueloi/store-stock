import crypto from "crypto";

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
  setup_completed_at: Date | null;
  created_at: Date;
  updated_at: Date;
  users?: { id: number; name: string; email: string; role: string }[];
}) {
  return {
    ...tenant,
    subscription_amount: Number(tenant.subscription_amount),
    access_url: buildTenantAccessUrl(tenant.subdomain || tenant.slug),
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
    const [tenants, invites] = await Promise.all([
      prisma.tenant.findMany({
        orderBy: { created_at: "desc" },
        include: {
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
  } = req.body;

  try {
    const { subdomain, error } = await validateProvisionSubdomain(rawSubdomain || storeName || "");

    if (error) {
      res.status(400).json({ error });
      return;
    }

    const invite = await prisma.setupInvite.create({
      data: {
        token: crypto.randomBytes(24).toString("hex"),
        store_name: String(storeName).trim(),
        subdomain,
        whatsapp: String(whatsapp || "").trim(),
        owner_name: ownerName ? String(ownerName).trim() : null,
        owner_email: ownerEmail ? String(ownerEmail).trim().toLowerCase() : null,
        trial_days: Math.max(1, Number(trialDays) || 30),
        subscription_amount: Number(subscriptionAmount) || 0,
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

export async function updateManagedTenant(req: Request, res: Response) {
  const tenantId = Number(req.params.tenantId);
  const {
    status,
    trialDays,
    trialEndsAt,
    subscriptionAmount,
    whatsapp,
  } = req.body;

  if (!tenantId) {
    res.status(400).json({ error: "Tenant inválido." });
    return;
  }

  try {
    const tenant = await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        status: status || undefined,
        trial_days: trialDays !== undefined ? Math.max(1, Number(trialDays) || 30) : undefined,
        trial_ends_at: trialEndsAt ? new Date(trialEndsAt) : undefined,
        subscription_amount: subscriptionAmount !== undefined ? Number(subscriptionAmount) || 0 : undefined,
        whatsapp: whatsapp ? String(whatsapp).trim() : undefined,
      },
      include: {
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
    });

    res.json(serializeTenant(tenant));
  } catch {
    res.status(500).json({ error: "Falha ao atualizar o tenant." });
  }
}
