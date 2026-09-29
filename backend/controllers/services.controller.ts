import type { Request, Response } from "express";
import { prisma } from "../config/prisma";
import type { AuthenticatedRequest } from "../types/auth";
import { deleteServiceImage } from "./upload.controller";
import { emitToTenant } from "../services/realtime.service";

function getTenantId(req: Request) {
  return (req as AuthenticatedRequest).user.tenantId;
}

export async function listServices(req: Request, res: Response) {
  try {
    const services = await prisma.service.findMany({
      where: { tenant_id: getTenantId(req) },
      include: { category_ref: { select: { id: true, name: true, icon: true, color: true } } },
      orderBy: [{ name: "asc" }],
    });
    res.json(services);
  } catch (err) {
    console.error("[listServices] error:", err);
    res.status(500).json({ error: "Failed to fetch services" });
  }
}

const ALLOWED_SALE_UNITS = ["unidade", "m2", "linear"];

export async function createService(req: Request, res: Response) {
  try {
    const {
      name, description, price, unit, category_id, is_active, image_url,
      sale_unit, price_per_measure, min_billable_quantity,
    } = req.body;
    const saleUnit = ALLOWED_SALE_UNITS.includes(sale_unit) ? sale_unit : "unidade";
    const isMeasured = saleUnit !== "unidade";
    const tenantId = getTenantId(req);

    // Nunca confia num category_id vindo do cliente sem confirmar que a
    // categoria pertence a este tenant — mesma trilha de segurança usada para
    // product_id/service_id em service-orders.controller.ts.
    let categoryId: number | null = null;
    if (category_id) {
      const cat = await prisma.serviceCategory.findFirst({ where: { id: Number(category_id), tenant_id: tenantId }, select: { id: true } });
      categoryId = cat?.id ?? null;
    }

    const service = await prisma.service.create({
      data: {
        tenant_id:   tenantId,
        name,
        description: description || null,
        // Serviço por medida: o preço "vitrine" é 0 — o valor real é calculado na
        // hora da venda a partir de price_per_measure + dimensões (igual Product).
        price:       isMeasured ? 0 : price,
        unit:        unit || "unidade",
        category_id: categoryId,
        is_active:   is_active !== false,
        image_url:   image_url || null,
        sale_unit:   saleUnit,
        price_per_measure:     isMeasured ? (Number(price_per_measure) || 0) : null,
        min_billable_quantity: isMeasured && min_billable_quantity ? Number(min_billable_quantity) : null,
      },
    });
    res.json(service);
  } catch (err) {
    console.error("[createService] error:", err);
    res.status(500).json({ error: "Failed to create service" });
  }
}

export async function updateService(req: Request, res: Response) {
  try {
    const id       = Number(req.params.id);
    const tenantId = getTenantId(req);
    const {
      name, description, price, unit, category_id, is_active, image_url,
      sale_unit, price_per_measure, min_billable_quantity,
    } = req.body;
    const saleUnit = ALLOWED_SALE_UNITS.includes(sale_unit) ? sale_unit : "unidade";
    const isMeasured = saleUnit !== "unidade";

    // Delete old image from disk if it's being replaced or cleared
    const existing = await prisma.service.findFirst({ where: { id, tenant_id: tenantId }, select: { image_url: true } });
    if (existing?.image_url && existing.image_url !== image_url) {
      deleteServiceImage(existing.image_url);
    }

    let categoryId: number | null = null;
    if (category_id) {
      const cat = await prisma.serviceCategory.findFirst({ where: { id: Number(category_id), tenant_id: tenantId }, select: { id: true } });
      categoryId = cat?.id ?? null;
    }

    await prisma.service.updateMany({
      where: { id, tenant_id: tenantId },
      data:  {
        name,
        description: description || null,
        price:       isMeasured ? 0 : price,
        unit:        unit || "unidade",
        category_id: categoryId,
        is_active,
        image_url:   image_url || null,
        sale_unit:   saleUnit,
        price_per_measure:     isMeasured ? (Number(price_per_measure) || 0) : null,
        min_billable_quantity: isMeasured && min_billable_quantity ? Number(min_billable_quantity) : null,
      },
    });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to update service" });
  }
}

export async function deleteService(req: Request, res: Response) {
  try {
    const id       = Number(req.params.id);
    const tenantId = getTenantId(req);
    const existing = await prisma.service.findFirst({ where: { id, tenant_id: tenantId }, select: { image_url: true } });
    if (existing?.image_url) deleteServiceImage(existing.image_url);
    await prisma.service.deleteMany({ where: { id, tenant_id: tenantId } });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to delete service" });
  }
}

// ─── Categorias de Serviço (ServiceCategory) ───────────────────────────────
// Mesmo padrão de categories.controller.ts (Product), mas tabela dedicada a
// Service — ver comentário no schema.prisma sobre por que não reaproveitar
// `categories`.

export async function listServiceCategories(req: Request, res: Response) {
  try {
    const categories = await prisma.serviceCategory.findMany({
      where: { tenant_id: getTenantId(req) },
      orderBy: { name: "asc" },
      include: { _count: { select: { services: true } } },
    });
    res.json(categories);
  } catch {
    res.status(500).json({ error: "Failed to fetch service categories" });
  }
}

export async function createServiceCategory(req: Request, res: Response) {
  try {
    const tenantId = getTenantId(req);
    const name = (req.body.name || "").trim();
    if (!name) { res.status(422).json({ error: "Informe o nome da categoria" }); return; }

    const category = await prisma.serviceCategory.create({
      data: {
        tenant_id: tenantId,
        name,
        icon:  req.body.icon || "wrench",
        color: req.body.color || "#2563eb",
      },
    });

    emitToTenant(tenantId, "service-category:changed", { categoryId: category.id });
    res.json(category);
  } catch {
    res.status(500).json({ error: "Failed to create service category" });
  }
}

export async function updateServiceCategory(req: Request, res: Response) {
  try {
    const tenantId = getTenantId(req);
    const categoryId = Number(req.params.id);
    const name = (req.body.name || "").trim();
    if (!name) { res.status(422).json({ error: "Informe o nome da categoria" }); return; }

    await prisma.serviceCategory.updateMany({
      where: { id: categoryId, tenant_id: tenantId },
      data: {
        name,
        icon:  req.body.icon || "wrench",
        color: req.body.color || "#2563eb",
      },
    });

    emitToTenant(tenantId, "service-category:changed", { categoryId });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to update service category" });
  }
}

// Exclusão sempre é permitida — serviços vinculados perdem a categoria via
// onDelete: SetNull (já configurado no schema, mesma escolha do Category de
// Product), em vez de bloquear a exclusão. Categoria de serviço é uma etiqueta
// organizacional leve; forçar o operador a desvincular serviços manualmente
// antes de excluir seria atrito desnecessário para esse caso de uso.
export async function deleteServiceCategory(req: Request, res: Response) {
  try {
    const tenantId = getTenantId(req);
    const categoryId = Number(req.params.id);

    await prisma.serviceCategory.deleteMany({ where: { id: categoryId, tenant_id: tenantId } });

    emitToTenant(tenantId, "service-category:changed", { categoryId });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to delete service category" });
  }
}
