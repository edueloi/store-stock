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

export async function getProduct(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    const tenantId = getTenantId(req);
    const product = await prisma.product.findFirst({
      where: { id, tenant_id: tenantId },
      include: { category: { select: { name: true } } },
    });
    if (!product) {
      res.status(404).json({ error: "Product not found" });
      return;
    }
    res.json({ ...product, category_name: product.category?.name ?? null });
  } catch {
    res.status(500).json({ error: "Failed to fetch product" });
  }
}

export async function createProduct(req: Request, res: Response) {
  try {
    const {
      images, variations, attributes, skus,
      tenant_id: _tid, id: _id, category, category_name,
      created_at, updated_at,
      ...rest
    } = req.body;
    const product = await prisma.product.create({
      data: {
        ...rest,
        tenant_id: getTenantId(req),
        images: Array.isArray(images) ? images : undefined,
        variations: Array.isArray(variations) ? variations : undefined,
        attributes: Array.isArray(attributes) ? attributes : undefined,
        skus: Array.isArray(skus) ? skus : undefined,
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

    // Delete removed images from disk
    const existing = await prisma.product.findFirst({ where: { id, tenant_id: tenantId }, select: { image_url: true, images: true } });
    if (existing) {
      if (req.body.image_url !== undefined && existing.image_url && existing.image_url !== req.body.image_url) {
        deleteProductImage(existing.image_url);
      }
      if (req.body.images !== undefined) {
        const oldImages = Array.isArray(existing.images) ? (existing.images as string[]) : [];
        const newImages: string[] = Array.isArray(req.body.images) ? req.body.images : [];
        oldImages.filter(u => !newImages.includes(u)).forEach(u => deleteProductImage(u));
      }
    }

    const {
      images, variations, attributes, skus,
      // strip non-column fields
      tenant_id: _tid, id: _id, category, category_name,
      created_at, updated_at,
      ...rest
    } = req.body;

    await prisma.product.updateMany({
      where: { id, tenant_id: tenantId },
      data: {
        ...rest,
        images: Array.isArray(images) ? images : undefined,
        variations: Array.isArray(variations) ? variations : undefined,
        attributes: Array.isArray(attributes) ? attributes : undefined,
        skus: Array.isArray(skus) ? skus : undefined,
      },
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

    const existing = await prisma.product.findFirst({ where: { id, tenant_id: tenantId }, select: { image_url: true, images: true } });
    if (existing?.image_url) deleteProductImage(existing.image_url);
    const extraImages = Array.isArray(existing?.images) ? (existing.images as string[]) : [];
    extraImages.forEach(url => deleteProductImage(url));

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
