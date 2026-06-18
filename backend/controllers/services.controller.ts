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
  } catch {
    res.status(500).json({ error: "Failed to fetch services" });
  }
}

export async function createService(req: Request, res: Response) {
  try {
    const { name, description, price, unit, category, is_active, image_url } = req.body;
    const service = await prisma.service.create({
      data: {
        tenant_id:   getTenantId(req),
        name,
        description: description || null,
        price,
        unit:        unit || "unidade",
        category:    category || "Geral",
        is_active:   is_active !== false,
        image_url:   image_url || null,
      },
    });
    res.json(service);
  } catch {
    res.status(500).json({ error: "Failed to create service" });
  }
}

export async function updateService(req: Request, res: Response) {
  try {
    const id       = Number(req.params.id);
    const tenantId = getTenantId(req);
    const { name, description, price, unit, category, is_active, image_url } = req.body;

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
        price,
        unit:        unit || "unidade",
        category:    category || "Geral",
        is_active,
        image_url:   image_url || null,
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
