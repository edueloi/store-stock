import crypto from "crypto";

import type { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

import { env } from "../config/env";
import { prisma } from "../config/prisma";
import type { AuthenticatedRequest } from "../types/auth";
import { getTenantAccessState } from "../utils/tenant-access";
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

function createToken(payload: { userId: number; tenantId?: number; role: string; superAdmin?: boolean }) {
  return jwt.sign(payload, env.jwtSecret);
}

async function assertSubdomainAvailable(subdomain: string) {
  const normalized = normalizeSubdomain(subdomain);

  if (!normalized) {
    return "Informe um subdomínio válido.";
  }

  if (isReservedSubdomain(normalized)) {
    return "Esse subdomínio é reservado pelo sistema.";
  }

  const [existingTenant, existingInvite] = await Promise.all([
    prisma.tenant.findFirst({
      where: {
        OR: [{ slug: normalized }, { subdomain: normalized }],
      },
      select: { id: true },
    }),
    prisma.setupInvite.findFirst({
      where: {
        subdomain: normalized,
        used_at: null,
        invite_expires_at: { gt: new Date() },
      },
      select: { id: true },
    }),
  ]);

  if (existingTenant || existingInvite) {
    return "Esse subdomínio já está em uso.";
  }

  return null;
}

export async function registerTenant(req: Request, res: Response) {
  const { tenantName, slug, whatsapp, userName, email, password } = req.body;
  const normalizedSlug = normalizeSubdomain(slug || tenantName || "");

  try {
    const subdomainError = await assertSubdomainAvailable(normalizedSlug);

    if (subdomainError) {
      res.status(400).json({ error: subdomainError });
      return;
    }

    const tenant = await prisma.tenant.create({
      data: {
        name: tenantName,
        slug: normalizedSlug,
        subdomain: normalizedSlug,
        whatsapp,
        status: "active",
        trial_days: 30,
        trial_starts_at: new Date(),
        trial_ends_at: addDays(new Date(), 30),
        setup_completed_at: new Date(),
      },
    });

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        tenant_id: tenant.id,
        name: userName,
        email,
        password: hashedPassword,
        role: "admin",
      },
    });

    const token = createToken({
      userId: user.id,
      tenantId: tenant.id,
      role: "admin",
    });

    res.json({
      token,
      tenantId: tenant.id,
      user: {
        name: user.name,
        email: user.email,
        role: user.role,
        tenantId: user.tenant_id,
      },
      access_url: buildTenantAccessUrl(tenant.subdomain),
    });
  } catch {
    res.status(500).json({ error: "Registration failed" });
  }
}

export async function login(req: Request, res: Response) {
  const identifier = String(req.body.identifier || req.body.email || "").trim().toLowerCase();
  const { password } = req.body;

  try {
    const user = await prisma.user.findUnique({
      where: { email: identifier },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            slug: true,
            subdomain: true,
            status: true,
            trial_ends_at: true,
          },
        },
      },
    });

    if (!user) {
      res.status(400).json({ error: "User not found" });
      return;
    }

    const accessState = getTenantAccessState(user.tenant);

    if (!accessState.allowed) {
      res.status(403).json({ error: accessState.reason });
      return;
    }

    const validPassword = await bcrypt.compare(password, user.password);

    if (!validPassword) {
      res.status(400).json({ error: "Invalid password" });
      return;
    }

    const token = createToken({
      userId: user.id,
      tenantId: user.tenant_id,
      role: user.role,
    });

    res.json({
      token,
      user: {
        name: user.name,
        email: user.email,
        role: user.role,
        tenantId: user.tenant_id,
      },
      tenant: {
        id: user.tenant.id,
        name: user.tenant.name,
        slug: user.tenant.slug,
        subdomain: user.tenant.subdomain,
        public_url: buildTenantAccessUrl(user.tenant.subdomain || user.tenant.slug),
      },
    });
  } catch {
    res.status(500).json({ error: "Login failed" });
  }
}

export async function superAdminLogin(req: Request, res: Response) {
  const identifier = String(req.body.identifier || req.body.username || "").trim();
  const { password } = req.body;

  if (
    identifier.toLowerCase() !== env.superAdminUser.toLowerCase() ||
    password !== env.superAdminPassword
  ) {
    res.status(401).json({ error: "Credenciais do super admin inválidas." });
    return;
  }

  const token = createToken({
    userId: 0,
    tenantId: 0,
    role: "super_admin",
    superAdmin: true,
  });

  res.json({
    token,
    user: {
      name: "Super Admin",
      email: env.superAdminUser,
      role: "super_admin",
      superAdmin: true,
    },
  });
}

export async function getSetupInvite(req: Request, res: Response) {
  try {
    const invite = await prisma.setupInvite.findUnique({
      where: { token: req.params.token },
    });

    if (!invite) {
      res.status(404).json({ error: "Convite não encontrado." });
      return;
    }

    if (invite.used_at) {
      res.status(410).json({ error: "Este link já foi utilizado." });
      return;
    }

    if (invite.invite_expires_at.getTime() < Date.now()) {
      res.status(410).json({ error: "Este link expirou." });
      return;
    }

    res.json({
      store_name: invite.store_name,
      subdomain: invite.subdomain,
      whatsapp: invite.whatsapp,
      owner_name: invite.owner_name,
      owner_email: invite.owner_email,
      trial_days: invite.trial_days,
      subscription_amount: Number(invite.subscription_amount),
      invite_expires_at: invite.invite_expires_at,
      access_url: buildTenantAccessUrl(invite.subdomain),
    });
  } catch {
    res.status(500).json({ error: "Falha ao validar convite." });
  }
}

export async function claimSetupInvite(req: Request, res: Response) {
  const { token, ownerName, ownerEmail, password, whatsapp } = req.body;

  try {
    const invite = await prisma.setupInvite.findUnique({
      where: { token },
    });

    if (!invite) {
      res.status(404).json({ error: "Convite não encontrado." });
      return;
    }

    if (invite.used_at) {
      res.status(410).json({ error: "Este link já foi utilizado." });
      return;
    }

    if (invite.invite_expires_at.getTime() < Date.now()) {
      res.status(410).json({ error: "Este link expirou." });
      return;
    }

    const existingUser = await prisma.user.findUnique({
      where: { email: String(ownerEmail).trim().toLowerCase() },
      select: { id: true },
    });

    if (existingUser) {
      res.status(400).json({ error: "Já existe um usuário com este e-mail." });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const now = new Date();
    const trialEndsAt = addDays(now, invite.trial_days);

    const result = await prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          name: invite.store_name,
          slug: invite.subdomain,
          subdomain: invite.subdomain,
          whatsapp: whatsapp || invite.whatsapp,
          status: "trial",
          trial_days: invite.trial_days,
          trial_starts_at: now,
          trial_ends_at: trialEndsAt,
          subscription_amount: invite.subscription_amount,
          setup_completed_at: now,
        },
      });

      const user = await tx.user.create({
        data: {
          tenant_id: tenant.id,
          name: ownerName || invite.owner_name || invite.store_name,
          email: String(ownerEmail).trim().toLowerCase(),
          password: hashedPassword,
          role: "admin",
        },
      });

      await tx.setupInvite.update({
        where: { id: invite.id },
        data: {
          tenant_id: tenant.id,
          owner_name: ownerName || invite.owner_name || invite.store_name,
          owner_email: String(ownerEmail).trim().toLowerCase(),
          used_at: now,
          whatsapp: whatsapp || invite.whatsapp,
        },
      });

      return { tenant, user };
    });

    const authToken = createToken({
      userId: result.user.id,
      tenantId: result.tenant.id,
      role: result.user.role,
    });

    res.json({
      token: authToken,
      user: {
        name: result.user.name,
        email: result.user.email,
        role: result.user.role,
        tenantId: result.user.tenant_id,
      },
      tenant: {
        id: result.tenant.id,
        name: result.tenant.name,
        slug: result.tenant.slug,
        subdomain: result.tenant.subdomain,
        public_url: buildTenantAccessUrl(result.tenant.subdomain),
      },
    });
  } catch {
    res.status(500).json({ error: "Falha ao criar a conta." });
  }
}

export async function changePassword(req: Request, res: Response) {
  const authReq = req as AuthenticatedRequest;
  const { password } = req.body;

  if (!authReq.user?.userId || authReq.user.superAdmin) {
    res.status(403).json({ error: "Apenas usuários do painel podem alterar a senha." });
    return;
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    await prisma.user.update({
      where: { id: authReq.user.userId },
      data: { password: hashedPassword },
    });

    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Não foi possível alterar a senha." });
  }
}

export async function regenerateSetupInvite(req: Request, res: Response) {
  const { subdomain } = req.body;

  try {
    const normalized = normalizeSubdomain(subdomain || "");

    if (!normalized) {
      res.status(400).json({ error: "Subdomínio inválido." });
      return;
    }

    const invite = await prisma.setupInvite.findFirst({
      where: {
        subdomain: normalized,
        used_at: null,
      },
      orderBy: { created_at: "desc" },
    });

    if (!invite) {
      res.status(404).json({ error: "Convite não encontrado para este subdomínio." });
      return;
    }

    const token = crypto.randomBytes(24).toString("hex");
    const inviteExpiresAt = addDays(new Date(), env.inviteExpirationDays);

    const updatedInvite = await prisma.setupInvite.update({
      where: { id: invite.id },
      data: {
        token,
        invite_expires_at: inviteExpiresAt,
      },
    });

    res.json({
      token: updatedInvite.token,
      invite_url: `${env.appBaseUrl.replace(/\/+$/, "")}/setup/${updatedInvite.token}`,
      access_url: buildTenantAccessUrl(updatedInvite.subdomain),
      invite_expires_at: updatedInvite.invite_expires_at,
    });
  } catch {
    res.status(500).json({ error: "Não foi possível regenerar o convite." });
  }
}
