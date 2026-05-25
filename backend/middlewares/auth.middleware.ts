import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

import { env } from "../config/env";
import { prisma } from "../config/prisma";
import type { AuthenticatedRequest, AuthTokenPayload } from "../types/auth";
import { getTenantAccessState } from "../utils/tenant-access";

export async function authenticateToken(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.split(" ")[1];

  if (!token) {
    res.sendStatus(401);
    return;
  }

  try {
    const user = jwt.verify(token, env.jwtSecret) as AuthTokenPayload;

    if (!user.superAdmin && user.tenantId) {
      const tenant = await prisma.tenant.findUnique({
        where: { id: user.tenantId },
        select: { status: true, trial_ends_at: true },
      });

      if (!tenant) {
        res.status(403).json({ error: "Conta vinculada não encontrada." });
        return;
      }

      const accessState = getTenantAccessState(tenant);

      if (!accessState.allowed) {
        res.status(403).json({ error: accessState.reason });
        return;
      }
    }

    (req as AuthenticatedRequest).user = user;
    next();
  } catch {
    res.sendStatus(403);
  }
}

export function requireSuperAdmin(req: Request, res: Response, next: NextFunction) {
  const user = (req as AuthenticatedRequest).user;

  if (!user?.superAdmin || user.role !== "super_admin") {
    res.status(403).json({ error: "Acesso restrito ao super admin." });
    return;
  }

  next();
}
