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

// Mesma validação usada em sellers.controller.ts: user_id é @unique em
// Technician, então sem checar antes o Prisma rejeitaria com erro cru de
// constraint em vez de uma mensagem que o lojista entende.
async function validateTechnicianUserLink(tenantId: number, userId: number | null, excludeTechnicianId?: number) {
  if (userId == null) return null;
  const user = await prisma.user.findFirst({ where: { id: userId, tenant_id: tenantId } });
  if (!user) return "Usuário não encontrado.";
  const already = await prisma.technician.findFirst({ where: { user_id: userId, id: { not: excludeTechnicianId ?? -1 } } });
  if (already) return `Este usuário já está vinculado ao técnico "${already.name}".`;
  return null;
}

export async function createTechnician(req: Request, res: Response) {
  try {
    const tenantId = getTenantId(req);
    const userId = req.body.user_id ? Number(req.body.user_id) : null;
    const linkError = await validateTechnicianUserLink(tenantId, userId);
    if (linkError) { res.status(422).json({ error: linkError }); return; }

    const technician = await prisma.technician.create({
      data: {
        tenant_id: tenantId,
        name:      req.body.name,
        phone:     req.body.phone    || null,
        document:  req.body.document || null,
        is_active: req.body.is_active ?? true,
        notes:     req.body.notes    || null,
        user_id:   userId,
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
    const technicianId = Number(req.params.id);
    const existing = await prisma.technician.findFirst({
      where: { id: technicianId, tenant_id: tenantId },
    });
    if (!existing) return res.status(404).json({ error: "Técnico não encontrado" });

    const userId = req.body.user_id !== undefined
      ? (req.body.user_id ? Number(req.body.user_id) : null)
      : existing.user_id;
    const linkError = await validateTechnicianUserLink(tenantId, userId, technicianId);
    if (linkError) { res.status(422).json({ error: linkError }); return; }

    const technician = await prisma.technician.update({
      where: { id: technicianId },
      data: {
        name:      req.body.name,
        phone:     req.body.phone    || null,
        document:  req.body.document || null,
        is_active: req.body.is_active ?? existing.is_active,
        notes:     req.body.notes    || null,
        user_id:   userId,
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
