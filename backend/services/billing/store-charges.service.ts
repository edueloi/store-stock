import crypto from "crypto";

import { env } from "../../config/env";
import { prisma } from "../../config/prisma";
import { decryptSecret, encryptSecret } from "../../utils/secretCrypto";
import {
  configureSubaccountWebhook,
  createAsaasSubaccount,
  createAsaasSubaccountCharge,
  createAsaasSubaccountCustomer,
  getPlatformWalletId,
  type AsaasSubaccountInput,
} from "./asaas.service";

// Cobranças do lojista via Asaas. Cada loja recebe na própria subconta; a taxa da
// plataforma (fee_percent, padrão 2%) é retirada por split para a carteira raiz.

export interface StoreChargeRules {
  discount?: { value: number; type: "FIXED" | "PERCENTAGE"; days: number };
  interest?: { percent: number };
  fine?: { percent: number };
}

let cachedPlatformWallet: string | null = null;
async function platformWalletId(): Promise<string> {
  if (process.env.ASAAS_PLATFORM_WALLET_ID) return process.env.ASAAS_PLATFORM_WALLET_ID;
  if (!cachedPlatformWallet) cachedPlatformWallet = await getPlatformWalletId();
  return cachedPlatformWallet;
}

const money = (n: number) => Math.round(n * 100) / 100;

async function loadGateway(tenantId: number) {
  const gateway = await prisma.storePaymentGateway.findUnique({
    where: { tenant_id_provider: { tenant_id: tenantId, provider: "asaas" } },
  });
  const credentials = (gateway?.credentials ?? {}) as Record<string, unknown>;
  const apiKey = decryptSecret(credentials.access_token as string | undefined);
  return { gateway, apiKey, credentials };
}

const webhookUrl = (tenantId: number) => `${env.appBaseUrl}/api/billing/webhook/store-asaas/${tenantId}`;

/** Cria a subconta Asaas do lojista. A chave só é devolvida uma vez, por isso é gravada ANTES de qualquer passo que possa falhar. */
export async function onboardStoreAsaas(tenantId: number, input: AsaasSubaccountInput) {
  const existing = await loadGateway(tenantId);
  if (existing.gateway?.wallet_id) throw new Error("Esta loja já possui uma conta de recebimento Asaas.");

  const sub = await createAsaasSubaccount(input);
  const webhookToken = crypto.randomBytes(24).toString("hex"); // 48 chars (Asaas exige >= 32)
  const credentials = {
    access_token: encryptSecret(sub.apiKey),
    webhook_token: encryptSecret(webhookToken),
    owner_email: input.email,
    webhook_ok: false,
  };
  await prisma.storePaymentGateway.upsert({
    where: { tenant_id_provider: { tenant_id: tenantId, provider: "asaas" } },
    create: { tenant_id: tenantId, provider: "asaas", enabled: true, environment: env.asaasEnvironment, credentials, wallet_id: sub.walletId },
    update: { enabled: true, environment: env.asaasEnvironment, credentials, wallet_id: sub.walletId },
  });

  // Webhook é complementar: se falhar, a conta já existe e a tentativa se repete em ensureStoreWebhook.
  await ensureStoreWebhook(tenantId).catch((error) => console.error("Webhook da subconta pendente:", error instanceof Error ? error.message : error));
  return { walletId: sub.walletId };
}

/** Registra o webhook da subconta se ainda não estiver registrado. Idempotente. */
export async function ensureStoreWebhook(tenantId: number): Promise<void> {
  const { gateway, apiKey, credentials } = await loadGateway(tenantId);
  if (!gateway?.wallet_id || !apiKey || credentials.webhook_ok === true) return;
  const token = decryptSecret(credentials.webhook_token as string | undefined);
  const email = String(credentials.owner_email || "");
  if (!token || !email) return;
  await configureSubaccountWebhook(apiKey, webhookUrl(tenantId), token, email);
  await prisma.storePaymentGateway.update({
    where: { id: gateway.id },
    data: { credentials: { ...credentials, webhook_ok: true } },
  });
}

export interface CreateStoreChargeInput {
  tenantId: number;
  value: number;
  customerName: string;
  customerCpfCnpj: string;
  customerEmail?: string;
  customerPhone?: string;
  description?: string;
  dueDate?: string; // padrão: hoje + 3 dias
  billingType?: "UNDEFINED" | "PIX" | "BOLETO" | "CREDIT_CARD";
  orderId?: number;
  rules?: StoreChargeRules; // sobrescreve o padrão da loja
}

export async function createStoreCharge(input: CreateStoreChargeInput) {
  const { gateway, apiKey } = await loadGateway(input.tenantId);
  if (!gateway?.enabled || !apiKey) {
    throw new Error("A conta de recebimento Asaas desta loja ainda não está ativa.");
  }
  if (!(input.value > 0)) throw new Error("Informe um valor maior que zero.");

  // Loja que colou a própria chave (sem subconta da plataforma) cobra sem split nem taxa.
  const feePercent = gateway.wallet_id ? Number(gateway.fee_percent) : 0;
  const rules = (input.rules ?? (gateway.rules as StoreChargeRules | null) ?? {}) as StoreChargeRules;
  const dueDate = input.dueDate ?? new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);

  const customer = await createAsaasSubaccountCustomer(apiKey, {
    name: input.customerName,
    cpfCnpj: input.customerCpfCnpj.replace(/\D/g, ""),
    email: input.customerEmail,
    mobilePhone: input.customerPhone?.replace(/\D/g, ""),
  });

  const payment = await createAsaasSubaccountCharge(apiKey, {
    customer: customer.id,
    value: money(input.value),
    dueDate,
    billingType: input.billingType,
    description: input.description,
    externalReference: input.orderId ? `order:${input.orderId}` : undefined,
    discount: rules.discount && rules.discount.value > 0
      ? { value: rules.discount.value, type: rules.discount.type, dueDateLimitDays: rules.discount.days }
      : undefined,
    interest: rules.interest?.percent ? { value: rules.interest.percent } : undefined,
    fine: rules.fine?.percent ? { value: rules.fine.percent } : undefined,
    split: gateway.wallet_id ? [{ walletId: await platformWalletId(), percentualValue: feePercent }] : undefined,
  });

  return prisma.storeCharge.create({
    data: {
      tenant_id: input.tenantId,
      order_id: input.orderId ?? null,
      asaas_payment_id: payment.id,
      description: input.description ?? null,
      customer_name: input.customerName,
      value: money(input.value),
      fee_percent: feePercent,
      fee_amount: money((input.value * feePercent) / 100),
      billing_type: input.billingType ?? "UNDEFINED",
      due_date: new Date(`${dueDate}T00:00:00Z`),
      invoice_url: payment.invoiceUrl ?? null,
    },
  });
}

const STATUS_BY_EVENT: Record<string, string> = {
  PAYMENT_CONFIRMED: "received",
  PAYMENT_RECEIVED: "received",
  PAYMENT_OVERDUE: "overdue",
  PAYMENT_REFUNDED: "refunded",
  PAYMENT_DELETED: "cancelled",
};

/** Idempotente: o Asaas pode reenviar o mesmo evento; só atualiza a cobrança da própria loja. */
export async function processStoreAsaasWebhook(tenantId: number, token: unknown, payload: { event?: string; payment?: { id: string; paymentDate?: string | null } }) {
  const { gateway, credentials } = await loadGateway(tenantId);
  const expected = decryptSecret(credentials.webhook_token as string | undefined);
  if (!gateway || !expected || typeof token !== "string") return false;
  const a = Buffer.from(token), b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;

  const status = payload.event ? STATUS_BY_EVENT[payload.event] : undefined;
  if (!status || !payload.payment?.id) return true;

  const charge = await prisma.storeCharge.findFirst({ where: { asaas_payment_id: payload.payment.id, tenant_id: tenantId } });
  if (!charge) return true;
  await prisma.storeCharge.update({
    where: { id: charge.id },
    data: { status, paid_at: status === "received" ? new Date(payload.payment.paymentDate ?? Date.now()) : charge.paid_at },
  });
  if (status === "received" && charge.order_id) {
    await prisma.order.updateMany({ where: { id: charge.order_id, tenant_id: tenantId, status: "pending" }, data: { status: "completed" } });
  }
  return true;
}

/** apiKey (decifrada) da subconta da loja — nunca devolvida ao navegador. */
export async function getStoreAsaasKey(tenantId: number): Promise<string> {
  const { gateway, apiKey } = await loadGateway(tenantId);
  if (!gateway?.wallet_id || !apiKey) throw new Error("A conta de recebimento Asaas desta loja ainda não foi criada.");
  return apiKey;
}
