import type { Request, Response } from "express";

import { prisma } from "../config/prisma";
import type { AuthenticatedRequest } from "../types/auth";
import { emitToTenant } from "../services/realtime.service";

function getTenantId(req: Request) {
  return (req as AuthenticatedRequest).user.tenantId;
}

export async function listCategories(req: Request, res: Response) {
  try {
    const categories = await prisma.category.findMany({
      where: { tenant_id: getTenantId(req) },
      orderBy: { name: "asc" },
    });

    res.json(categories);
  } catch {
    res.status(500).json({ error: "Failed to fetch categories" });
  }
}

export async function createCategory(req: Request, res: Response) {
  try {
    const tenantId = getTenantId(req);
    const category = await prisma.category.create({
      data: {
        name: req.body.name,
        tenant_id: tenantId,
      },
    });

    emitToTenant(tenantId, "category:changed", { categoryId: category.id });

    res.json({ id: category.id });
  } catch {
    res.status(500).json({ error: "Failed to create category" });
  }
}

export async function updateCategory(req: Request, res: Response) {
  try {
    const tenantId = getTenantId(req);
    const categoryId = Number(req.params.id);

    await prisma.category.updateMany({
      where: {
        id: categoryId,
        tenant_id: tenantId,
      },
      data: { name: req.body.name },
    });

    emitToTenant(tenantId, "category:changed", { categoryId });

    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to update category" });
  }
}

export async function deleteCategory(req: Request, res: Response) {
  try {
    const tenantId = getTenantId(req);
    const categoryId = Number(req.params.id);

    await prisma.category.deleteMany({
      where: {
        id: categoryId,
        tenant_id: tenantId,
      },
    });

    emitToTenant(tenantId, "category:changed", { categoryId });

    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to delete category" });
  }
}
