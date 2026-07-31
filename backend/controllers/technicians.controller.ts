import type { Request, Response } from "express";
import { prisma } from "../config/prisma";
import type { AuthenticatedRequest } from "../types/auth";

function getTenantId(req: Request) {
  return (req as AuthenticatedRequest).user.tenantId;
}

export async function listTechnicians(req: Request, res: Response) {
  try {
    const technicians = await prisma.technician.findMany({
      where: { tenant_id: getTenantId(req) },
      orderBy: { name: "asc" },
    });
    res.json(technicians);
  } catch {
    res.status(500).json({ error: "Falha ao listar técnicos" });
  }
}

export async function createTechnician(req: Request, res: Response) {
  try {
    const technician = await prisma.technician.create({
      data: {
        tenant_id: getTenantId(req),
        name:      req.body.name,
        phone:     req.body.phone    || null,
        document:  req.body.document || null,
        is_active: req.body.is_active ?? true,
        notes:     req.body.notes    || null,
      },
    });
    res.json(technician);
  } catch {
    res.status(500).json({ error: "Falha ao criar técnico" });
  }
}

export async function updateTechnician(req: Request, res: Response) {
  try {
    const tenantId = getTenantId(req);
    const existing = await prisma.technician.findFirst({
      where: { id: Number(req.params.id), tenant_id: tenantId },
    });
    if (!existing) return res.status(404).json({ error: "Técnico não encontrado" });

    const technician = await prisma.technician.update({
      where: { id: Number(req.params.id) },
      data: {
        name:      req.body.name,
        phone:     req.body.phone    || null,
        document:  req.body.document || null,
        is_active: req.body.is_active ?? existing.is_active,
        notes:     req.body.notes    || null,
      },
    });
    res.json(technician);
  } catch {
    res.status(500).json({ error: "Falha ao atualizar técnico" });
  }
}

export async function deleteTechnician(req: Request, res: Response) {
  try {
    const tenantId = getTenantId(req);
    await prisma.technician.deleteMany({
      where: { id: Number(req.params.id), tenant_id: tenantId },
    });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Falha ao deletar técnico" });
  }
}
