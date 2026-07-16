import { Router } from "express";

import { connect, getStatus, logout, sendMessage } from "./sessionManager";

const router = Router();

router.post("/sessions/:tenantId/connect", async (req, res) => {
  const tenantId = Number(req.params.tenantId);
  const { tenantSlug, webhookSecret } = req.body as { tenantSlug?: string; webhookSecret?: string };

  if (!Number.isFinite(tenantId) || !tenantSlug || !webhookSecret) {
    res.status(400).json({ error: "tenantId, tenantSlug e webhookSecret são obrigatórios." });
    return;
  }

  try {
    const status = await connect(tenantId, tenantSlug, webhookSecret);
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.get("/sessions/:tenantId/status", async (req, res) => {
  const tenantId = Number(req.params.tenantId);
  if (!Number.isFinite(tenantId)) {
    res.status(400).json({ error: "tenantId inválido." });
    return;
  }

  const status = await getStatus(tenantId);
  res.json(status);
});

router.post("/sessions/:tenantId/logout", async (req, res) => {
  const tenantId = Number(req.params.tenantId);
  if (!Number.isFinite(tenantId)) {
    res.status(400).json({ error: "tenantId inválido." });
    return;
  }

  try {
    await logout(tenantId);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.post("/sessions/:tenantId/send", async (req, res) => {
  const tenantId = Number(req.params.tenantId);
  const { number, messageType, payload } = req.body as {
    number?: string;
    messageType?: "text" | "buttons" | "list";
    payload?: Record<string, unknown>;
  };

  if (!Number.isFinite(tenantId) || !number || !messageType) {
    res.status(400).json({ error: "tenantId, number e messageType são obrigatórios." });
    return;
  }

  try {
    const result = await sendMessage(tenantId, number, messageType, payload ?? {});
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: String(err) });
  }
});

export default router;
