import type { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../config/prisma";
import type { AuthenticatedRequest } from "../types/auth";
import { isMenuKey, MENU_KEYS, MENU_LABELS } from "../utils/menu-permissions";
import { isWorkflowStage, STAGE_LABELS, WORKFLOW_STAGES } from "../utils/workflow-stages";

export async function listTeam(req: Request, res: Response) {
  const authReq = req as AuthenticatedRequest;
  const tenantId = authReq.user?.tenantId;

  if (!tenantId) { res.sendStatus(403); return; }

  try {
    const users = await prisma.user.findMany({
      where: { tenant_id: tenantId },
      select: { id: true, name: true, email: true, phone: true, nickname: true, role: true, created_at: true },
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

  const { name, email, password, role, phone, nickname } = req.body;

  const ALLOWED_ROLES = ["admin", "staff", "pdv"];
  if (!ALLOWED_ROLES.includes(role)) {
    res.status(400).json({ error: "Perfil inválido." });
    return;
  }

  if (!name || !email || !password) {
    res.status(400).json({ error: "Nome, e-mail e senha são obrigatórios." });
    return;
  }

  const nick = typeof nickname === "string" ? nickname.trim() : "";

  try {
    const existing = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() }, select: { id: true } });
    if (existing) {
      res.status(400).json({ error: "Já existe um usuário com este e-mail." });
      return;
    }

    if (nick) {
      // Nick é único em TODO o sistema (não só nesta loja) — mesma regra do e-mail.
      const nickTaken = await prisma.user.findUnique({ where: { nickname: nick }, select: { id: true } });
      if (nickTaken) {
        res.status(400).json({ error: "Esse nick já está em uso por outro usuário." });
        return;
      }
    }

    const hashed = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        tenant_id: tenantId,
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password: hashed,
        role,
        phone: typeof phone === "string" && phone.trim() ? phone.trim() : null,
        nickname: nick || null,
      },
      select: { id: true, name: true, email: true, phone: true, nickname: true, role: true, created_at: true },
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

    const { name, email, password, role, phone, nickname } = req.body;
    const ALLOWED_ROLES = ["admin", "staff", "pdv"];

    if (typeof nickname === "string" && nickname.trim()) {
      const nick = nickname.trim();
      const nickTaken = await prisma.user.findFirst({ where: { nickname: nick, id: { not: memberId } }, select: { id: true } });
      if (nickTaken) {
        res.status(400).json({ error: "Esse nick já está em uso por outro usuário." });
        return;
      }
    }

    const data: Record<string, unknown> = {};
    if (name) data.name = name.trim();
    if (email) data.email = email.trim().toLowerCase();
    if (role && ALLOWED_ROLES.includes(role)) data.role = role;
    if (password) data.password = await bcrypt.hash(password, 10);
    if (phone !== undefined) data.phone = typeof phone === "string" && phone.trim() ? phone.trim() : null;
    if (nickname !== undefined) data.nickname = typeof nickname === "string" && nickname.trim() ? nickname.trim() : null;

    const updated = await prisma.user.update({
      where: { id: memberId },
      data,
      select: { id: true, name: true, email: true, phone: true, nickname: true, role: true, created_at: true },
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

// Catálogo estático de menus/etapas disponíveis, para a tela de permissões montar os checkboxes.
export function getPermissionOptions(_req: Request, res: Response) {
  res.json({
    menus: MENU_KEYS.map((key) => ({ key, label: MENU_LABELS[key] })),
    stages: WORKFLOW_STAGES.map((key) => ({ key, label: STAGE_LABELS[key] })),
  });
}

// ── Permissões individuais (menus do sistema + etapas de Orçamento/OS) ──────────
// "admin" sempre tem acesso total e não guarda linhas aqui — estas permissões só
// se aplicam a membros com outro role (staff/pdv).

export async function getTeamMemberPermissions(req: Request, res: Response) {
  const authReq = req as AuthenticatedRequest;
  const tenantId = authReq.user?.tenantId;
  const memberId = Number(req.params.id);

  if (!tenantId) { res.sendStatus(403); return; }
  if (authReq.user?.role !== "admin") {
    res.status(403).json({ error: "Apenas administradores podem ver permissões." });
    return;
  }

  try {
    const member = await prisma.user.findFirst({ where: { id: memberId, tenant_id: tenantId }, select: { id: true } });
    if (!member) { res.status(404).json({ error: "Membro não encontrado." }); return; }

    const [menus, stages] = await Promise.all([
      prisma.userMenuPermission.findMany({ where: { user_id: memberId }, select: { menu: true } }),
      prisma.userStagePermission.findMany({ where: { user_id: memberId }, select: { stage: true } }),
    ]);

    res.json({ menus: menus.map((m) => m.menu), stages: stages.map((s) => s.stage) });
  } catch {
    res.status(500).json({ error: "Erro ao buscar permissões." });
  }
}

export async function updateTeamMemberPermissions(req: Request, res: Response) {
  const authReq = req as AuthenticatedRequest;
  const tenantId = authReq.user?.tenantId;
  const memberId = Number(req.params.id);

  if (!tenantId) { res.sendStatus(403); return; }
  if (authReq.user?.role !== "admin") {
    res.status(403).json({ error: "Apenas administradores podem editar permissões." });
    return;
  }

  const { menus, stages } = req.body as { menus?: string[]; stages?: string[] };
  if (!Array.isArray(menus) || !Array.isArray(stages)) {
    res.status(400).json({ error: "Lista de menus e etapas inválida." });
    return;
  }

  const validMenus = menus.filter(isMenuKey);
  const validStages = stages.filter(isWorkflowStage);

  try {
    const member = await prisma.user.findFirst({ where: { id: memberId, tenant_id: tenantId }, select: { id: true } });
    if (!member) { res.status(404).json({ error: "Membro não encontrado." }); return; }

    await prisma.$transaction([
      prisma.userMenuPermission.deleteMany({ where: { user_id: memberId } }),
      prisma.userMenuPermission.createMany({ data: validMenus.map((menu) => ({ user_id: memberId, menu })) }),
      prisma.userStagePermission.deleteMany({ where: { user_id: memberId } }),
      prisma.userStagePermission.createMany({ data: validStages.map((stage) => ({ user_id: memberId, stage })) }),
    ]);

    res.json({ menus: validMenus, stages: validStages });
  } catch {
    res.status(500).json({ error: "Erro ao salvar permissões." });
  }
}
