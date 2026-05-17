import type { Request, Response } from "express";

import { prisma } from "../config/prisma";
import type { AuthenticatedRequest } from "../types/auth";

function getTenantId(req: Request) {
  return (req as AuthenticatedRequest).user.tenantId;
}

export async function listCategories(req: Request, res: Response) {
  try {
    const categories = await prisma.category.findMany({
      where: { tenant_id: getTenantId(req) },
    });

    res.json(categories);
  } catch {
    res.status(500).json({ error: "Failed to fetch categories" });
  }
}

export async function createCategory(req: Request, res: Response) {
  try {
    const category = await prisma.category.create({
      data: {
        name: req.body.name,
        tenant_id: getTenantId(req),
      },
    });

    res.json({ id: category.id });
  } catch {
    res.status(500).json({ error: "Failed to create category" });
  }
}

export async function updateCategory(req: Request, res: Response) {
  try {
    await prisma.category.updateMany({
      where: {
        id: Number(req.params.id),
        tenant_id: getTenantId(req),
      },
      data: { name: req.body.name },
    });

    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to update category" });
  }
}

export async function deleteCategory(req: Request, res: Response) {
  try {
    await prisma.category.deleteMany({
      where: {
        id: Number(req.params.id),
        tenant_id: getTenantId(req),
      },
    });

    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to delete category" });
  }
}
