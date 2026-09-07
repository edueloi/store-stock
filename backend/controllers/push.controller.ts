import type { Request, Response } from "express";
import { prisma } from "../config/prisma";
import { env } from "../config/env";
import type { AuthenticatedRequest } from "../types/auth";

function getUser(req: Request) {
  return (req as AuthenticatedRequest).user;
}

export async function getVapidPublicKey(_req: Request, res: Response) {
  res.json({ publicKey: env.vapidPublicKey });
}

export async function subscribe(req: Request, res: Response) {
  const { userId, tenantId } = getUser(req);
  const { endpoint, keys } = req.body as {
    endpoint?: string;
    keys?: { p256dh?: string; auth?: string };
  };
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    res.status(400).json({ error: "Subscription inválida" });
    return;
  }
  try {
    await prisma.pushSubscription.upsert({
      where: { user_id_endpoint: { user_id: userId, endpoint } },
      update: { p256dh: keys.p256dh, auth: keys.auth, user_agent: req.headers["user-agent"] || null },
      create: {
        user_id: userId,
        tenant_id: tenantId,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
        user_agent: req.headers["user-agent"] || null,
      },
    });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to save push subscription" });
  }
}

export async function unsubscribe(req: Request, res: Response) {
  const { userId } = getUser(req);
  const { endpoint } = req.body as { endpoint?: string };
  if (!endpoint) {
    res.status(400).json({ error: "endpoint é obrigatório" });
    return;
  }
  try {
    await prisma.pushSubscription.deleteMany({ where: { user_id: userId, endpoint } });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to remove push subscription" });
  }
}
