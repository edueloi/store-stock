import { prisma } from "../../config/prisma";
import { getAsaasSubscription } from "./asaas.service";

interface AsaasWebhookPayment {
  id: string;
  subscription?: string;
  status: string;
  value: number;
  dueDate: string;
  paymentDate?: string | null;
  billingType?: string | null;
  invoiceUrl?: string | null;
}

interface AsaasWebhookPayload {
  event: string;
  payment?: AsaasWebhookPayment;
}

// Idempotente: upsert por asaas_payment_id — o Asaas não garante entrega única, pode
// reenviar o mesmo evento várias vezes, então nunca deve duplicar linha nem falhar em
// reprocessamento do mesmo evento.
export async function processAsaasWebhookEvent(payload: AsaasWebhookPayload) {
  const { event, payment } = payload;
  if (!payment?.subscription) {
    console.log(`Webhook Asaas ignorado (sem payment.subscription): ${event}`);
    return;
  }

  const subscription = await prisma.platformSubscription.findUnique({
    where: { asaas_subscription_id: payment.subscription },
  });
  if (!subscription) {
    console.log(`Webhook Asaas para assinatura desconhecida: ${payment.subscription}`);
    return;
  }

  // invoice_url/billing_type só entram no update quando o payload realmente os traz — um
  // payload que não inclua o campo (o Asaas nem sempre reenvia tudo em todo evento) não
  // deve apagar um valor já gravado por um evento anterior.
  const commonData = {
    status: statusForEvent(event, payment.status),
    value: payment.value,
    due_date: new Date(payment.dueDate),
    payment_date: payment.paymentDate ? new Date(payment.paymentDate) : null,
    raw_webhook_payload: payload as unknown as object,
  };

  await prisma.platformInvoice.upsert({
    where: { asaas_payment_id: payment.id },
    update: {
      ...commonData,
      ...(payment.billingType !== undefined ? { billing_type: payment.billingType } : {}),
      ...(payment.invoiceUrl !== undefined ? { invoice_url: payment.invoiceUrl } : {}),
    },
    create: {
      platform_subscription_id: subscription.id,
      asaas_payment_id: payment.id,
      billing_type: payment.billingType ?? null,
      invoice_url: payment.invoiceUrl ?? null,
      ...commonData,
    },
  });

  switch (event) {
    case "PAYMENT_RECEIVED":
    case "PAYMENT_CONFIRMED": {
      // Pagamento em dia reativa o tenant se ele estava suspenso por essa pendência.
      // next_due_date busca o valor autoritativo direto no Asaas (não calcula localmente
      // por ciclo — o Asaas é quem decide a data real do próximo vencimento).
      const asaasSubscription = await getAsaasSubscription(subscription.asaas_subscription_id).catch(() => null);
      await prisma.platformSubscription.update({
        where: { id: subscription.id },
        data: {
          status: "active",
          suspended_at: null,
          next_due_date: asaasSubscription ? new Date(asaasSubscription.nextDueDate) : subscription.next_due_date,
        },
      });
      if (subscription.suspended_at) {
        await prisma.tenant.update({ where: { id: subscription.tenant_id }, data: { status: "active" } });
      }
      break;
    }
    case "PAYMENT_OVERDUE": {
      // Não suspende aqui — só marca. O job diário decide a suspensão após o grace period.
      await prisma.platformSubscription.update({ where: { id: subscription.id }, data: { status: "overdue" } });
      break;
    }
    case "PAYMENT_REFUNDED":
    case "PAYMENT_CREATED":
      break; // já refletido no upsert de invoice acima
    default:
      console.log(`Webhook Asaas evento não tratado: ${event}`);
  }
}

function statusForEvent(event: string, fallback: string) {
  switch (event) {
    case "PAYMENT_RECEIVED": return "received";
    case "PAYMENT_CONFIRMED": return "confirmed";
    case "PAYMENT_OVERDUE": return "overdue";
    case "PAYMENT_REFUNDED": return "refunded";
    case "PAYMENT_CREATED": return "pending";
    default: return fallback.toLowerCase();
  }
}
