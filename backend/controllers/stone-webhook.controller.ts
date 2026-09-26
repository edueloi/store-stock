import type { Request, Response } from "express";

import { prisma } from "../config/prisma";

// Payload de webhook da Stone Connect (charge.paid / charge.refunded).
// Doc: https://connect-stone.stone.com.br/reference/recebendo-um-pagamento
// A Stone não documenta um segredo de assinatura HMAC nesta versão do Connect —
// a validação de origem confiável é feita indiretamente: só processamos eventos
// cujo order_id já exista em uma TerminalTransaction "pending" registrada por
// nós (criada em terminal.controller.ts:charge, provider "stone").
interface StoneWebhookPayload {
  id: string;
  type: "charge.paid" | "charge.refunded" | string;
  data: {
    id: string; // id da charge
    order_id?: string; // id do pedido (o que salvamos como external_id)
    code?: string;
    amount?: number;
    status?: string;
    payment_method?: string;
    metadata?: {
      scheme_name?: string;
      authorization_code?: string;
      terminal_serial_number?: string;
      account_funding_source?: string;
      transaction_timestamp?: string;
    };
    canceled_amount?: number;
    canceled_at?: string;
  };
}

/** POST /api/webhook/stone — recebe confirmação assíncrona de pagamento/estorno da Stone Connect */
export async function stoneWebhookHandler(req: Request, res: Response) {
  try {
    const payload = req.body as StoneWebhookPayload;
    const orderId = payload?.data?.order_id ?? payload?.data?.id;

    if (!orderId || !payload?.type) {
      res.sendStatus(400);
      return;
    }

    const status =
      payload.type === "charge.paid" ? "approved" :
      payload.type === "charge.refunded" ? "cancelled" :
      null;

    if (!status) {
      // Evento não tratado (ex: charge.pending, order.updated) — confirma recebimento
      // sem processar, para a Stone não ficar reenviando.
      res.sendStatus(200);
      return;
    }

    await prisma.terminalTransaction.updateMany({
      where: { provider: "stone", external_id: orderId },
      data: {
        status,
        nsu: payload.data.id ?? undefined,
        authorization_code: payload.data.metadata?.authorization_code ?? undefined,
        brand: payload.data.metadata?.scheme_name?.toLowerCase() ?? undefined,
        raw_response: payload as any,
      },
    });

    res.sendStatus(200);
  } catch (error) {
    console.error("stoneWebhookHandler error:", error);
    // Reenvio pela Stone é aceitável — updateMany é idempotente.
    res.sendStatus(500);
  }
}
