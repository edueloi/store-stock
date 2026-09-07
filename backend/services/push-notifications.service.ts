import webpush from "web-push";

import { prisma } from "../config/prisma";
import { env } from "../config/env";
import { getTenantAccessState } from "../utils/tenant-access";
import { countDueSoonPayables } from "../controllers/accounts-payable.controller";

const JOB_INTERVAL_MS = 24 * 60 * 60 * 1000;

let jobLoopStarted = false;
let vapidConfigured = false;

function ensureVapidConfigured() {
  if (vapidConfigured) return true;
  if (!env.vapidPublicKey || !env.vapidPrivateKey) return false;
  webpush.setVapidDetails(env.vapidSubject, env.vapidPublicKey, env.vapidPrivateKey);
  vapidConfigured = true;
  return true;
}

// Envia pra todas as subscriptions de um usuário; remove do banco qualquer
// subscription que o navegador/dispositivo já não reconhece mais (410 Gone /
// 404 Not Found — resposta padrão do web-push quando o endpoint expirou).
async function sendToUser(userId: number, payload: Record<string, unknown>) {
  const subscriptions = await prisma.pushSubscription.findMany({ where: { user_id: userId } });

  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload)
      );
    } catch (error) {
      const statusCode = (error as { statusCode?: number })?.statusCode;
      if (statusCode === 404 || statusCode === 410) {
        await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
      } else {
        console.error(`Falha ao enviar push pro usuário ${userId}:`, error);
      }
    }
  }
}

// Uma vez por dia, para cada tenant ativo, monta um digest combinando contas a
// pagar vencendo/vencidas + produtos em estoque crítico, e manda pra cada
// usuário do tenant que tiver a preferência ligada e ao menos uma subscription.
export async function runPushNotificationsJob() {
  if (!ensureVapidConfigured()) return;

  const tenants = await prisma.tenant.findMany({
    select: { id: true, status: true, trial_ends_at: true },
  });

  for (const tenant of tenants) {
    if (!getTenantAccessState(tenant).allowed) continue;

    const dueSoonCount = await countDueSoonPayables(tenant.id);
    // Prisma não compara duas colunas da mesma tabela direto no where — filtra em
    // memória (mesmo padrão de getLowStockCount, volume baixo, roda 1x/dia).
    const activeProducts = await prisma.product.findMany({
      where: { tenant_id: tenant.id, is_active: true },
      select: { stock_quantity: true, min_stock: true },
    });
    const lowStockCount = activeProducts.filter((p) => p.stock_quantity <= p.min_stock).length;

    if (dueSoonCount === 0 && lowStockCount === 0) continue;

    const usersWithPushEnabled = await prisma.userPreference.findMany({
      where: { pref_key: "push_notifications_enabled", value: { equals: true } },
      select: { user_id: true },
    });
    if (usersWithPushEnabled.length === 0) continue;

    const tenantUserIds = new Set(
      (await prisma.user.findMany({ where: { tenant_id: tenant.id }, select: { id: true } })).map((u) => u.id)
    );

    const parts: string[] = [];
    if (dueSoonCount > 0) parts.push(`${dueSoonCount} conta(s) a pagar vencendo`);
    if (lowStockCount > 0) parts.push(`${lowStockCount} produto(s) com estoque crítico`);

    for (const { user_id: userId } of usersWithPushEnabled) {
      if (!tenantUserIds.has(userId)) continue;
      await sendToUser(userId, {
        title: "BoxSys PDV",
        body: parts.join(" · "),
        url: dueSoonCount > 0 && lowStockCount === 0 ? "/admin/financeiro/contas-a-pagar" : "/admin/estoque",
      });
    }
  }
}

export function startPushNotificationsLoop() {
  if (jobLoopStarted) return;
  jobLoopStarted = true;

  const timer = setInterval(() => {
    runPushNotificationsJob().catch((error) => {
      console.error("Job de push notifications falhou:", error);
    });
  }, JOB_INTERVAL_MS);

  timer.unref?.();
}
