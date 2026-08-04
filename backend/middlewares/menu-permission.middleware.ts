import type { NextFunction, Request, Response } from "express";

import { prisma } from "../config/prisma";
import type { AuthenticatedRequest } from "../types/auth";
import type { MenuKey } from "../utils/menu-permissions";

// Bloqueia o acesso à rota se o usuário não tiver a permissão do menu correspondente.
// "admin" sempre passa, sem precisar de linha em UserMenuPermission.
export function requireMenuPermission(menu: MenuKey) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = (req as AuthenticatedRequest).user;
    if (user.role === "admin" || user.superAdmin) return next();

    const permission = await prisma.userMenuPermission.findUnique({
      where: { user_id_menu: { user_id: user.userId, menu } },
    });
    if (!permission) {
      res.status(403).json({ error: "Você não tem permissão para acessar este módulo" });
      return;
    }
    next();
  };
}
