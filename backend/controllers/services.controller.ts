import type { Request, Response } from "express";
import { prisma } from "../config/prisma";
import type { AuthenticatedRequest } from "../types/auth";

function getTenantId(req: Request) {
  return (req as AuthenticatedRequest).user.tenantId;
}

export async function listServices(req: Request, res: Response) {
  try {
    const services = await prisma.service.findMany({
      where: { tenant_id: getTenantId(req) },
      orderBy: { name: "asc" },
    });
    res.json(services);
  } catch {
    res.status(500).json({ error: "Failed to fetch services" });
  }
}

export async function createService(req: Request, res: Response) {
  try {
    const { name, description, price, is_active } = req.body;
    const service = await prisma.service.create({
      data: {
        tenant_id:   getTenantId(req),
        name,
        description: description || null,
        price,
        is_active:   is_active !== false,
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
    const { name, description, price, is_active } = req.body;
    await prisma.service.updateMany({
      where: { id, tenant_id: tenantId },
      data:  { name, description: description || null, price, is_active },
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
    await prisma.service.deleteMany({ where: { id, tenant_id: tenantId } });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to delete service" });
  }
}
