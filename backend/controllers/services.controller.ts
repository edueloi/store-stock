import type { Request, Response } from "express";
import { prisma } from "../config/prisma";
import type { AuthenticatedRequest } from "../types/auth";
import { deleteServiceImage } from "./upload.controller";

function getTenantId(req: Request) {
  return (req as AuthenticatedRequest).user.tenantId;
}

export async function listServices(req: Request, res: Response) {
  try {
    const services = await prisma.service.findMany({
      where: { tenant_id: getTenantId(req) },
      orderBy: [{ category: "asc" }, { name: "asc" }],
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
      name, description, price, unit, category, is_active, image_url,
      sale_unit, price_per_measure, min_billable_quantity,
    } = req.body;
    const saleUnit = ALLOWED_SALE_UNITS.includes(sale_unit) ? sale_unit : "unidade";
    const isMeasured = saleUnit !== "unidade";

    const service = await prisma.service.create({
      data: {
        tenant_id:   getTenantId(req),
        name,
        description: description || null,
        // Serviço por medida: o preço "vitrine" é 0 — o valor real é calculado na
        // hora da venda a partir de price_per_measure + dimensões (igual Product).
        price:       isMeasured ? 0 : price,
        unit:        unit || "unidade",
        category:    category || "Geral",
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
      name, description, price, unit, category, is_active, image_url,
      sale_unit, price_per_measure, min_billable_quantity,
    } = req.body;
    const saleUnit = ALLOWED_SALE_UNITS.includes(sale_unit) ? sale_unit : "unidade";
    const isMeasured = saleUnit !== "unidade";

    // Delete old image from disk if it's being replaced or cleared
    const existing = await prisma.service.findFirst({ where: { id, tenant_id: tenantId }, select: { image_url: true } });
    if (existing?.image_url && existing.image_url !== image_url) {
      deleteServiceImage(existing.image_url);
    }

    await prisma.service.updateMany({
      where: { id, tenant_id: tenantId },
      data:  {
        name,
        description: description || null,
        price:       isMeasured ? 0 : price,
        unit:        unit || "unidade",
        category:    category || "Geral",
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
