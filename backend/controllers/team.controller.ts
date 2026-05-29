import type { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../config/prisma";
import type { AuthenticatedRequest } from "../types/auth";

export async function listTeam(req: Request, res: Response) {
  const authReq = req as AuthenticatedRequest;
  const tenantId = authReq.user?.tenantId;

  if (!tenantId) { res.sendStatus(403); return; }

  try {
    const users = await prisma.user.findMany({
      where: { tenant_id: tenantId },
      select: { id: true, name: true, email: true, role: true, created_at: true },
      orderBy: { created_at: "asc" },
    });
    res.json(users);
  } catch {
    res.status(500).json({ error: "Erro ao listar equipe." });
  }
}

export async function createTeamMember(req: Request, res: Response) {
  const authReq = req as AuthenticatedRequest;
  const tenantId = authReq.user?.tenantId;

  if (!tenantId) { res.sendStatus(403); return; }

  // Only admin can create team members
  if (authReq.user?.role !== "admin") {
    res.status(403).json({ error: "Apenas administradores podem convidar membros." });
    return;
  }

  const { name, email, password, role } = req.body;

  const ALLOWED_ROLES = ["admin", "staff", "pdv"];
  if (!ALLOWED_ROLES.includes(role)) {
    res.status(400).json({ error: "Perfil inválido." });
    return;
  }

  if (!name || !email || !password) {
    res.status(400).json({ error: "Nome, e-mail e senha são obrigatórios." });
    return;
  }

  try {
    const existing = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() }, select: { id: true } });
    if (existing) {
      res.status(400).json({ error: "Já existe um usuário com este e-mail." });
      return;
    }

    const hashed = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        tenant_id: tenantId,
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password: hashed,
        role,
      },
      select: { id: true, name: true, email: true, role: true, created_at: true },
    });

    res.status(201).json(user);
  } catch {
    res.status(500).json({ error: "Erro ao criar membro." });
  }
}

export async function updateTeamMember(req: Request, res: Response) {
  const authReq = req as AuthenticatedRequest;
  const tenantId = authReq.user?.tenantId;
  const memberId = Number(req.params.id);

  if (!tenantId) { res.sendStatus(403); return; }

  if (authReq.user?.role !== "admin") {
    res.status(403).json({ error: "Apenas administradores podem editar membros." });
    return;
  }

  try {
    // Ensure member belongs to this tenant
    const existing = await prisma.user.findFirst({
      where: { id: memberId, tenant_id: tenantId },
      select: { id: true, role: true },
    });

    if (!existing) {
      res.status(404).json({ error: "Membro não encontrado." });
      return;
    }

    const { name, email, password, role } = req.body;
    const ALLOWED_ROLES = ["admin", "staff", "pdv"];

    const data: Record<string, unknown> = {};
    if (name) data.name = name.trim();
    if (email) data.email = email.trim().toLowerCase();
    if (role && ALLOWED_ROLES.includes(role)) data.role = role;
    if (password) data.password = await bcrypt.hash(password, 10);

    const updated = await prisma.user.update({
      where: { id: memberId },
      data,
      select: { id: true, name: true, email: true, role: true, created_at: true },
    });

    res.json(updated);
  } catch {
    res.status(500).json({ error: "Erro ao atualizar membro." });
  }
}

export async function deleteTeamMember(req: Request, res: Response) {
  const authReq = req as AuthenticatedRequest;
  const tenantId = authReq.user?.tenantId;
  const memberId = Number(req.params.id);

  if (!tenantId) { res.sendStatus(403); return; }

  if (authReq.user?.role !== "admin") {
    res.status(403).json({ error: "Apenas administradores podem remover membros." });
    return;
  }

  // Prevent self-deletion
  if (authReq.user?.userId === memberId) {
    res.status(400).json({ error: "Você não pode remover sua própria conta." });
    return;
  }

  try {
    const existing = await prisma.user.findFirst({
      where: { id: memberId, tenant_id: tenantId },
      select: { id: true },
    });

    if (!existing) {
      res.status(404).json({ error: "Membro não encontrado." });
      return;
    }

    await prisma.user.delete({ where: { id: memberId } });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Erro ao remover membro." });
  }
}
