import type { Request, Response } from "express";

import { env } from "../config/env";
import { processAsaasWebhookEvent } from "../services/billing/asaas-webhook.service";

export async function asaasWebhookHandler(req: Request, res: Response) {
  const token = req.headers["asaas-access-token"];
  if (!env.asaasWebhookToken || token !== env.asaasWebhookToken) {
    res.sendStatus(401);
    return;
  }

  try {
    await processAsaasWebhookEvent(req.body);
    res.sendStatus(200);
  } catch (error) {
    console.error("asaasWebhookHandler error:", error);
    // Asaas reenvia em caso de erro — aceitável, o processamento é idempotente.
    res.sendStatus(500);
  }
}
