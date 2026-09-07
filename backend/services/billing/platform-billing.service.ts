import { prisma } from "../../config/prisma";
import { env } from "../../config/env";
import {
  cancelAsaasSubscription,
  createAsaasCustomer,
  createAsaasSubscription,
  listAsaasSubscriptionPayments,
} from "./asaas.service";

interface TenantForBilling {
  id: number;
  name: string;
  document: string | null;
  whatsapp: string;
}

// Cria o customer + a assinatura no Asaas (sempre billingType UNDEFINED — o tenant escolhe
// Pix/Boleto/Cartão na fatura hospedada) e grava o PlatformSubscription local. A resposta de
// POST /subscriptions não traz invoiceUrl (confirmado testando contra sandbox) — só vem no
// payment individual gerado pela assinatura, por isso buscamos os payments logo em seguida
// pra já povoar a primeira PlatformInvoice com o link, sem depender do webhook chegar a tempo.
export async function createPlatformSubscriptionForTenant(tenantId: number, value: number) {
  const existing = await prisma.platformSubscription.findUnique({ where: { tenant_id: tenantId } });
  if (existing) return existing;

  const tenant = await prisma.tenant.findUniqueOrThrow({
    where: { id: tenantId },
    select: { id: true, name: true, document: true, whatsapp: true },
  }) as TenantForBilling;

  if (!tenant.document) {
    throw new Error("Tenant sem CPF/CNPJ cadastrado — necessário para criar cobrança no Asaas.");
  }

  const customer = await createAsaasCustomer({
    name: tenant.name,
    cpfCnpj: tenant.document.replace(/\D/g, ""),
    mobilePhone: tenant.whatsapp?.replace(/\D/g, "") || undefined,
    externalReference: String(tenant.id),
  });

  const nextDueDate = new Date();
  nextDueDate.setDate(nextDueDate.getDate() + 30);

  const subscription = await createAsaasSubscription({
    customer: customer.id,
    value,
    nextDueDate: nextDueDate.toISOString().slice(0, 10),
    cycle: "MONTHLY",
    description: `Assinatura Box Sys — ${tenant.name}`,
    externalReference: String(tenant.id),
  });

  const created = await prisma.platformSubscription.create({
    data: {
      tenant_id: tenant.id,
      asaas_customer_id: customer.id,
      asaas_subscription_id: subscription.id,
      billing_cycle: subscription.cycle,
      status: "active",
      value,
      next_due_date: new Date(subscription.nextDueDate),
      grace_period_days: env.platformBillingGraceDaysDefault,
      environment: env.asaasEnvironment,
    },
  });

  // Best-effort: se falhar em popular a fatura inicial, o webhook PAYMENT_CREATED
  // ainda vai chegar e resolver isso — não deve derrubar a criação da assinatura.
  await syncInitialInvoice(created.id, subscription.id).catch((error) => {
    console.error(`Falha ao sincronizar fatura inicial da assinatura ${subscription.id}:`, error);
  });

  return created;
}

async function syncInitialInvoice(platformSubscriptionId: number, asaasSubscriptionId: string) {
  const payments = await listAsaasSubscriptionPayments(asaasSubscriptionId);
  const first = payments[0];
  if (!first) return;

  await prisma.platformInvoice.upsert({
    where: { asaas_payment_id: first.id },
    update: {
      status: first.status.toLowerCase(),
      value: first.value,
      due_date: new Date(first.dueDate),
      invoice_url: first.invoiceUrl ?? null,
      billing_type: first.billingType ?? null,
    },
    create: {
      platform_subscription_id: platformSubscriptionId,
      asaas_payment_id: first.id,
      status: first.status.toLowerCase(),
      value: first.value,
      due_date: new Date(first.dueDate),
      invoice_url: first.invoiceUrl ?? null,
      billing_type: first.billingType ?? null,
    },
  });
}

export async function cancelPlatformSubscriptionForTenant(tenantId: number) {
  const subscription = await prisma.platformSubscription.findUnique({ where: { tenant_id: tenantId } });
  if (!subscription) throw new Error("Este tenant não tem assinatura Asaas configurada.");

  await cancelAsaasSubscription(subscription.asaas_subscription_id);
  return prisma.platformSubscription.update({
    where: { id: subscription.id },
    data: { status: "cancelled", cancelled_at: new Date() },
  });
}
