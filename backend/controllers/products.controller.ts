import type { Request, Response } from "express";

import { prisma } from "../config/prisma";
import { deleteProductImage } from "./upload.controller";
import type { AuthenticatedRequest } from "../types/auth";

function getTenantId(req: Request) {
  return (req as AuthenticatedRequest).user.tenantId;
}

export async function listProducts(req: Request, res: Response) {
  try {
    const onlyActive = req.query.active === "true";
    const products = await prisma.product.findMany({
      where: {
        tenant_id: getTenantId(req),
        ...(onlyActive ? { is_active: true } : {}),
      },
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

export async function getProductByBarcode(req: Request, res: Response) {
  try {
    const code = req.params.code;
    const tenantId = getTenantId(req);
    const product = await prisma.product.findFirst({
      where: { barcode: code, tenant_id: tenantId },
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

// Fields we track in history with human-readable labels
const TRACKED_FIELDS: Record<string, string> = {
  name:           "Nome",
  price:          "Preço de venda",
  cost_price:     "Custo unitário",
  discount_price: "Promoção",
  stock_quantity: "Estoque",
  sku:            "SKU",
  barcode:        "Código de barras",
  description:    "Descrição",
  is_active:      "Status ativo",
  is_featured:    "Destaque na home",
  category_id:    "Categoria",
};

function fmtHistoryVal(field: string, val: unknown): string {
  if (val === null || val === undefined || val === "") return "—";
  if (field === "price" || field === "cost_price" || field === "discount_price") {
    return `R$ ${Number(val).toFixed(2)}`;
  }
  if (field === "is_active")   return val ? "Ativo" : "Inativo";
  if (field === "is_featured") return val ? "Sim" : "Não";
  return String(val);
}

export async function updateProduct(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    const tenantId = getTenantId(req);

    // Load full existing record for diff
    const existing = await prisma.product.findFirst({
      where: { id, tenant_id: tenantId },
      select: {
        image_url: true, images: true,
        name: true, price: true, cost_price: true, discount_price: true,
        stock_quantity: true, sku: true, barcode: true, description: true,
        is_active: true, is_featured: true, category_id: true,
      },
    });

    if (existing) {
      // Handle removed images from disk
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

    // Record history for changed tracked fields
    if (existing) {
      const historyRows: { tenant_id: number; product_id: number; field: string; old_value: string | null; new_value: string | null }[] = [];
      for (const field of Object.keys(TRACKED_FIELDS)) {
        const inBody = field in rest ? rest[field] : undefined;
        if (inBody === undefined) continue;
        const oldRaw = (existing as Record<string, unknown>)[field];
        const newRaw = inBody;
        const oldStr = fmtHistoryVal(field, oldRaw);
        const newStr = fmtHistoryVal(field, newRaw);
        if (oldStr !== newStr) {
          historyRows.push({
            tenant_id:  tenantId,
            product_id: id,
            field:      TRACKED_FIELDS[field],
            old_value:  oldStr,
            new_value:  newStr,
          });
        }
      }
      if (historyRows.length > 0) {
        await prisma.productHistory.createMany({ data: historyRows });
      }
    }

    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to update product" });
  }
}

export async function getProductHistory(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    const tenantId = getTenantId(req);
    const history = await prisma.productHistory.findMany({
      where: { product_id: id, tenant_id: tenantId },
      orderBy: { created_at: "desc" },
      take: 100,
    });
    res.json(history);
  } catch {
    res.status(500).json({ error: "Failed to fetch product history" });
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
