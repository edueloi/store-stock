import type { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../config/prisma";
import type { AuthenticatedRequest } from "../types/auth";

// "Meu Perfil" — autoatendimento do próprio usuário logado (qualquer role, não só
// admin). Diferente de team.controller.ts, que é a tela de Equipe onde o admin
// gerencia OUTROS usuários.

export async function getMyProfile(req: Request, res: Response) {
  const userId = (req as AuthenticatedRequest).user.userId;
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, phone: true, nickname: true, role: true, created_at: true },
    });
    if (!user) { res.status(404).json({ error: "Usuário não encontrado." }); return; }
    res.json(user);
  } catch {
    res.status(500).json({ error: "Erro ao buscar perfil." });
  }
}

export async function updateMyProfile(req: Request, res: Response) {
  const userId = (req as AuthenticatedRequest).user.userId;
  const { phone, nickname, current_password, new_password } = req.body as {
    phone?: string; nickname?: string; current_password?: string; new_password?: string;
  };

  try {
    const existing = await prisma.user.findUnique({ where: { id: userId } });
    if (!existing) { res.status(404).json({ error: "Usuário não encontrado." }); return; }

    const data: Record<string, unknown> = {};

    if (phone !== undefined) data.phone = phone.trim() ? phone.trim() : null;

    if (nickname !== undefined) {
      const nick = nickname.trim();
      if (nick) {
        const nickTaken = await prisma.user.findFirst({ where: { nickname: nick, id: { not: userId } }, select: { id: true } });
        if (nickTaken) {
          res.status(400).json({ error: "Esse nick já está em uso por outro usuário." });
          return;
        }
      }
      data.nickname = nick || null;
    }

    if (new_password) {
      if (!current_password) {
        res.status(400).json({ error: "Informe a senha atual para definir uma nova." });
        return;
      }
      const validPassword = await bcrypt.compare(current_password, existing.password);
      if (!validPassword) {
        res.status(400).json({ error: "Senha atual incorreta." });
        return;
      }
      data.password = await bcrypt.hash(new_password, 10);
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data,
      select: { id: true, name: true, email: true, phone: true, nickname: true, role: true, created_at: true },
    });
    res.json(updated);
  } catch {
    res.status(500).json({ error: "Erro ao atualizar perfil." });
  }
}
