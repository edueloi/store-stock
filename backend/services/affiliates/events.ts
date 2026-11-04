import crypto from "node:crypto";

import type { Prisma } from "@prisma/client";

import { env } from "../../config/env";
import { prisma } from "../../config/prisma";

// Fila de saída para a Develoi. Cada mudança relevante vira um AffiliateEvent; o loop abaixo entrega
// por POST assinado (HMAC-SHA256 do corpo, no mesmo formato dos webhooks da própria Develoi) e tenta
// de novo com espera crescente. Se a URL não estiver configurada, os eventos esperam na fila.
//
// Eventos: affiliate.applied, affiliate.updated, lead.created, lead.updated,
//          referral.created, referral.updated, commission.updated

const BACKOFF_MS = [60_000, 5 * 60_000, 15 * 60_000, 60 * 60_000, 6 * 60 * 60_000, 12 * 60 * 60_000, 24 * 60 * 60_000];
const MAX_ATTEMPTS = BACKOFF_MS.length + 1;
const TICK_MS = 10_000;

export async function emitAffiliateEvent(type: string, data: Record<string, unknown>) {
  try {
    await prisma.affiliateEvent.create({
      data: { type, payload: { type, occurredAt: new Date().toISOString(), data } as unknown as Prisma.InputJsonValue },
    });
  } catch (error) {
    // Um evento perdido nunca pode derrubar a operação que o gerou.
    console.error("Falha ao registrar evento de afiliado", { type, error: (error as Error).message });
  }
}

const sign = (body: string) => `sha256=${crypto.createHmac("sha256", env.affiliateWebhookSecret).update(body).digest("hex")}`;

async function deliver(event: { id: number; type: string; payload: unknown; attempts: number }) {
  const body = JSON.stringify(event.payload);
  try {
    const res = await fetch(env.develoiAffiliateWebhookUrl, {
      method: "POST",
      signal: AbortSignal.timeout(10_000),
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "boxsys-affiliates",
        "X-Boxsys-Event": event.type,
        "X-Boxsys-Delivery": String(event.id),
        "X-Boxsys-Signature": sign(body),
      },
      body,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    await prisma.affiliateEvent.update({ where: { id: event.id }, data: { delivered_at: new Date(), attempts: event.attempts + 1, last_error: null } });
  } catch (error) {
    const attempts = event.attempts + 1;
    await prisma.affiliateEvent.update({
      where: { id: event.id },
      data: {
        attempts,
        last_error: String((error as Error).message || error).slice(0, 180),
        // depois da última tentativa, deixa de reagendar (fica visível como falha no admin)
        next_try_at: new Date(Date.now() + (BACKOFF_MS[Math.min(attempts - 1, BACKOFF_MS.length - 1)] ?? 0)),
      },
    });
  }
}

let running = false;

async function tick() {
  if (running || !env.develoiAffiliateWebhookUrl || !env.affiliateWebhookSecret) return;
  running = true;
  try {
    const due = await prisma.affiliateEvent.findMany({
      where: { delivered_at: null, attempts: { lt: MAX_ATTEMPTS }, next_try_at: { lte: new Date() } },
      orderBy: { id: "asc" },
      take: 20,
    });
    for (const event of due) await deliver(event);
  } catch (error) {
    console.error("Loop de webhook de afiliados falhou", (error as Error).message);
  } finally {
    running = false;
  }
}

export function startAffiliateWebhookLoop() {
  setInterval(() => void tick(), TICK_MS).unref();
}
