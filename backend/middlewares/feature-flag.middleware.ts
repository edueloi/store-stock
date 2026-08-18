import type { NextFunction, Request, Response } from "express";

import { prisma } from "../config/prisma";
import type { AuthenticatedRequest } from "../types/auth";

// Módulos liberados por tenant pelo Super Admin (Tenant.<flag>_enabled). Bloqueia
// a rota inteira com 403 se o tenant não tiver o módulo habilitado.
export function requireTenantFeature(flag: "fluxo_producao_enabled") {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = (req as AuthenticatedRequest).user;
    if (!user.tenantId) { res.sendStatus(403); return; }

    const tenant = await prisma.tenant.findUnique({
      where: { id: user.tenantId },
      select: { fluxo_producao_enabled: true },
    });
    if (!tenant || !tenant[flag]) {
      res.status(403).json({ error: "Este módulo não está habilitado para sua loja." });
      return;
    }
    next();
  };
}
