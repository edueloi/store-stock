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
      include: { _count: { select: { products: true } } },
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
        icon: req.body.icon || "package",
        color: req.body.color || "#2563eb",
        cover_url: req.body.cover_url || null,
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
      data: {
        name: req.body.name,
        icon: req.body.icon || "package",
        color: req.body.color || "#2563eb",
        cover_url: req.body.cover_url || null,
      },
    });

    emitToTenant(tenantId, "category:changed", { categoryId });

    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to update category" });
  }
}

export async function assignProductsToCategory(req: Request, res: Response) {
  try {
    const tenantId = getTenantId(req);
    const categoryId = Number(req.params.id);
    const productIds = Array.isArray(req.body.product_ids)
      ? req.body.product_ids.map(Number).filter(Number.isInteger)
      : [];

    const category = await prisma.category.findFirst({ where: { id: categoryId, tenant_id: tenantId }, select: { id: true } });
    if (!category) { res.status(404).json({ error: "Categoria não encontrada" }); return; }

    // Um produto pertence a uma única categoria. Este lote mostra apenas produtos sem categoria no cliente
    // e reforça a mesma regra no servidor para evitar substituição acidental.
    await prisma.product.updateMany({
      where: { id: { in: productIds }, tenant_id: tenantId, category_id: null },
      data: { category_id: categoryId },
    });

    emitToTenant(tenantId, "category:changed", { categoryId });
    emitToTenant(tenantId, "product:changed", { categoryId });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Não foi possível adicionar os produtos" });
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
