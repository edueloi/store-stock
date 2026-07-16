import type { Request, Response } from "express";

import type { AuthenticatedRequest } from "../types/auth";
import {
  assignWhatsappConversation,
  closeWhatsappConversation,
  createWhatsappAgent,
  deleteWhatsappAgent,
  getWhatsappConnectionStatus,
  getWhatsappConversationMessages,
  getWhatsappOverview,
  pingWhatsappEvolution,
  processWhatsappWebhook,
  sendWhatsappManualMessage,
  sendWhatsappTestMenu,
  updateWhatsappAgent,
  updateWhatsappWorkspace,
} from "../services/whatsapp.service";

function getTenantId(req: Request) {
  return (req as AuthenticatedRequest).user?.tenantId;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return "Erro interno no módulo de WhatsApp.";
}

export async function getWhatsappModuleOverview(req: Request, res: Response) {
  const tenantId = getTenantId(req);

  if (!tenantId) {
    res.sendStatus(403);
    return;
  }

  try {
    const overview = await getWhatsappOverview(tenantId);
    res.json(overview);
  } catch (error) {
    res.status(500).json({ error: getErrorMessage(error) });
  }
}

export async function saveWhatsappWorkspace(req: Request, res: Response) {
  const tenantId = getTenantId(req);

  if (!tenantId) {
    res.sendStatus(403);
    return;
  }

  try {
    const workspace = await updateWhatsappWorkspace(tenantId, req.body ?? {});
    res.json(workspace);
  } catch (error) {
    res.status(400).json({ error: getErrorMessage(error) });
  }
}

export async function pingWhatsappProvider(req: Request, res: Response) {
  const tenantId = getTenantId(req);

  if (!tenantId) {
    res.sendStatus(403);
    return;
  }

  try {
    const data = await pingWhatsappEvolution(tenantId);
    res.json({ ok: true, data });
  } catch (error) {
    res.status(400).json({ ok: false, error: getErrorMessage(error) });
  }
}

export async function connectWhatsappHandler(req: Request, res: Response) {
  const tenantId = getTenantId(req);

  if (!tenantId) {
    res.sendStatus(403);
    return;
  }

  try {
    const status = await getWhatsappConnectionStatus(tenantId);
    res.json(status);
  } catch (error) {
    res.status(400).json({ error: getErrorMessage(error) });
  }
}

export async function getWhatsappConnectionStatusHandler(req: Request, res: Response) {
  const tenantId = getTenantId(req);

  if (!tenantId) {
    res.sendStatus(403);
    return;
  }

  try {
    const status = await getWhatsappConnectionStatus(tenantId);
    res.json(status);
  } catch (error) {
    res.status(400).json({ error: getErrorMessage(error) });
  }
}

export async function sendWhatsappMenuTest(req: Request, res: Response) {
  const tenantId = getTenantId(req);
  const phone = String(req.body?.phone ?? "");

  if (!tenantId) {
    res.sendStatus(403);
    return;
  }

  try {
    await sendWhatsappTestMenu(tenantId, phone);
    res.json({ ok: true });
  } catch (error) {
    res.status(400).json({ error: getErrorMessage(error) });
  }
}

export async function createWhatsappAgentHandler(req: Request, res: Response) {
  const tenantId = getTenantId(req);

  if (!tenantId) {
    res.sendStatus(403);
    return;
  }

  try {
    const agent = await createWhatsappAgent(tenantId, req.body ?? {});
    res.status(201).json(agent);
  } catch (error) {
    res.status(400).json({ error: getErrorMessage(error) });
  }
}

export async function updateWhatsappAgentHandler(req: Request, res: Response) {
  const tenantId = getTenantId(req);
  const agentId = Number(req.params.id);

  if (!tenantId) {
    res.sendStatus(403);
    return;
  }

  try {
    const agent = await updateWhatsappAgent(tenantId, agentId, req.body ?? {});
    res.json(agent);
  } catch (error) {
    res.status(400).json({ error: getErrorMessage(error) });
  }
}

export async function deleteWhatsappAgentHandler(req: Request, res: Response) {
  const tenantId = getTenantId(req);
  const agentId = Number(req.params.id);

  if (!tenantId) {
    res.sendStatus(403);
    return;
  }

  try {
    await deleteWhatsappAgent(tenantId, agentId);
    res.json({ ok: true });
  } catch (error) {
    res.status(400).json({ error: getErrorMessage(error) });
  }
}

export async function getWhatsappConversationMessagesHandler(req: Request, res: Response) {
  const tenantId = getTenantId(req);
  const conversationId = Number(req.params.id);

  if (!tenantId) {
    res.sendStatus(403);
    return;
  }

  try {
    const payload = await getWhatsappConversationMessages(tenantId, conversationId);
    res.json(payload);
  } catch (error) {
    res.status(404).json({ error: getErrorMessage(error) });
  }
}

export async function assignWhatsappConversationHandler(req: Request, res: Response) {
  const tenantId = getTenantId(req);
  const conversationId = Number(req.params.id);
  const agentId = Number(req.body?.agent_id);

  if (!tenantId) {
    res.sendStatus(403);
    return;
  }

  try {
    const payload = await assignWhatsappConversation(tenantId, conversationId, agentId);
    res.json(payload);
  } catch (error) {
    res.status(400).json({ error: getErrorMessage(error) });
  }
}

export async function closeWhatsappConversationHandler(req: Request, res: Response) {
  const tenantId = getTenantId(req);
  const conversationId = Number(req.params.id);
  const reason = String(req.body?.reason ?? "manual");

  if (!tenantId) {
    res.sendStatus(403);
    return;
  }

  try {
    await closeWhatsappConversation(tenantId, conversationId, reason);
    res.json({ ok: true });
  } catch (error) {
    res.status(400).json({ error: getErrorMessage(error) });
  }
}

export async function sendWhatsappConversationMessageHandler(req: Request, res: Response) {
  const tenantId = getTenantId(req);
  const conversationId = Number(req.params.id);
  const text = String(req.body?.text ?? "");
  const author = req.body?.author ? String(req.body.author) : undefined;

  if (!tenantId) {
    res.sendStatus(403);
    return;
  }

  try {
    const payload = await sendWhatsappManualMessage(tenantId, conversationId, text, author);
    res.json(payload);
  } catch (error) {
    res.status(400).json({ error: getErrorMessage(error) });
  }
}

export async function whatsappWebhookHandler(req: Request, res: Response) {
  const tenantSlug = String(req.params.tenantSlug ?? "");

  try {
    const result = await processWhatsappWebhook(
      tenantSlug,
      (req.body ?? {}) as Record<string, unknown>,
      req.headers,
    );
    res.json(result);
  } catch (error) {
    console.error("whatsappWebhookHandler error:", error);
    res.status(500).json({ error: getErrorMessage(error) });
  }
}
