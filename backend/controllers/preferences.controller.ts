import type { Request, Response } from "express";
import { prisma } from "../config/prisma";
import type { AuthenticatedRequest } from "../types/auth";

function getUserId(req: Request) {
  return (req as AuthenticatedRequest).user.userId;
}

export async function getPreference(req: Request, res: Response) {
  const userId = getUserId(req);
  const { key } = req.params;
  try {
    const pref = await prisma.userPreference.findUnique({
      where: { user_id_pref_key: { user_id: userId, pref_key: key } },
    });
    res.json(pref ? pref.value : null);
  } catch {
    res.status(500).json({ error: "Failed to get preference" });
  }
}

export async function setPreference(req: Request, res: Response) {
  const userId = getUserId(req);
  const { key } = req.params;
  const { value } = req.body;
  try {
    await prisma.userPreference.upsert({
      where: { user_id_pref_key: { user_id: userId, pref_key: key } },
      update: { value },
      create: { user_id: userId, pref_key: key, value },
    });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to set preference" });
  }
}
