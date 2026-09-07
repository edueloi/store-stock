import { prisma } from "../../config/prisma";
import { listAsaasSubscriptionPayments } from "./asaas.service";

const JOB_INTERVAL_MS = 24 * 60 * 60 * 1000;

let jobLoopStarted = false;

// Uma vez por dia, suspende tenants cuja assinatura Asaas está overdue há mais do que o
// grace_period_days configurado, e ainda sem pagamento confirmado — mesmo molde de
// loyalty-notifications.service.ts / push-notifications.service.ts.
export async function runPlatformBillingSuspensionJob() {
  const overdueSubscriptions = await prisma.platformSubscription.findMany({
    where: { status: "overdue", suspended_at: null },
  });

  for (const sub of overdueSubscriptions) {
    if (!sub.next_due_date) continue;

    const graceDeadline = new Date(sub.next_due_date);
    graceDeadline.setDate(graceDeadline.getDate() + sub.grace_period_days);
    if (graceDeadline.getTime() > Date.now()) continue;

    // Fallback: confere direto na API do Asaas antes de suspender, caso um webhook
    // PAYMENT_RECEIVED tenha se perdido — nunca suspende quem já pagou.
    const latestPayments = await listAsaasSubscriptionPayments(sub.asaas_subscription_id).catch(() => null);
    const stillUnpaid = !latestPayments || !latestPayments.some((p) => p.status === "RECEIVED" || p.status === "CONFIRMED");
    if (!stillUnpaid) continue;

    await prisma.tenant.update({ where: { id: sub.tenant_id }, data: { status: "suspended" } });
    await prisma.platformSubscription.update({ where: { id: sub.id }, data: { suspended_at: new Date() } });
  }
}

export function startPlatformBillingSuspensionLoop() {
  if (jobLoopStarted) return;
  jobLoopStarted = true;

  const timer = setInterval(() => {
    runPlatformBillingSuspensionJob().catch((error) => {
      console.error("Job de suspensão por inadimplência falhou:", error);
    });
  }, JOB_INTERVAL_MS);

  timer.unref?.();
}
