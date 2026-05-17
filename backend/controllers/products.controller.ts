import type { Request, Response } from "express";

import { prisma } from "../config/prisma";
import { deleteProductImage } from "./upload.controller";
import type { AuthenticatedRequest } from "../types/auth";

function getTenantId(req: Request) {
  return (req as AuthenticatedRequest).user.tenantId;
}

export async function listProducts(req: Request, res: Response) {
  try {
    const products = await prisma.product.findMany({
      where: { tenant_id: getTenantId(req) },
      include: {
        category: {
          select: { name: true },
        },
      },
    });

    res.json(
      products.map((product) => ({
        ...product,
        category_name: product.category?.name ?? null,
      }))
    );
  } catch {
    res.status(500).json({ error: "Failed to fetch products" });
  }
}

export async function createProduct(req: Request, res: Response) {
  try {
    const product = await prisma.product.create({
      data: {
        ...req.body,
        tenant_id: getTenantId(req),
      },
    });

    res.json({ id: product.id });
  } catch {
    res.status(500).json({ error: "Failed to create product" });
  }
}

export async function updateProduct(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    const tenantId = getTenantId(req);

    // If a new image is being set, delete the old one
    if (req.body.image_url !== undefined) {
      const existing = await prisma.product.findFirst({ where: { id, tenant_id: tenantId }, select: { image_url: true } });
      if (existing?.image_url && existing.image_url !== req.body.image_url) {
        deleteProductImage(existing.image_url);
      }
    }

    await prisma.product.updateMany({
      where: { id, tenant_id: tenantId },
      data: req.body,
    });

    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to update product" });
  }
}

export async function deleteProduct(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    const tenantId = getTenantId(req);

    const existing = await prisma.product.findFirst({ where: { id, tenant_id: tenantId }, select: { image_url: true } });
    if (existing?.image_url) deleteProductImage(existing.image_url);

    await prisma.product.deleteMany({ where: { id, tenant_id: tenantId } });

    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to delete product" });
  }
}

export async function adjustProductStock(req: Request, res: Response) {
  const { productId, quantity, type, reason } = req.body;

  try {
    const tenantId = getTenantId(req);
    const product = await prisma.product.findFirst({
      where: {
        id: productId,
        tenant_id: tenantId,
      },
    });

    if (!product) {
      res.status(404).json({ error: "Product not found" });
      return;
    }

    await prisma.$transaction([
      prisma.product.update({
        where: { id: productId },
        data: {
          stock_quantity: { increment: quantity },
        },
      }),
      prisma.stockMovement.create({
        data: {
          tenant_id: tenantId,
          product_id: productId,
          quantity,
          type,
          reason,
        },
      }),
    ]);

    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Stock adjustment failed" });
  }
}

export async function listProductMovements(req: Request, res: Response) {
  try {
    const movements = await prisma.stockMovement.findMany({
      where: { tenant_id: getTenantId(req) },
      include: {
        product: {
          select: { name: true },
        },
      },
      orderBy: { created_at: "desc" },
      take: 50,
    });

    res.json(
      movements.map((movement) => ({
        ...movement,
        product_name: movement.product.name,
      }))
    );
  } catch {
    res.status(500).json({ error: "Failed to fetch movements" });
  }
}
