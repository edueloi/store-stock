import nodemailer from "nodemailer";

import { prisma } from "../config/prisma";
import { decryptSecret } from "../utils/secretCrypto";
import { baseTemplate, sendSystemEmailForStore } from "./mailer.service";
import { buildSignatureFromTenant, type StoreSignatureInput } from "../utils/document-email-text";

export type StoreEmailConfig = {
  provider: string;
  email: string;
  password: string;
  host: string;
  port: number;
  secure: boolean;
  from_name?: string;
};

type StoredStoreEmailConfig = Omit<StoreEmailConfig, "password"> & { password?: string };

function getUsableConfig(value: unknown): StoreEmailConfig | null {
  if (!value || typeof value !== "object") return null;
  const config = value as StoredStoreEmailConfig;
  const password = decryptSecret(config.password);
  const port = Number(config.port);

  if (!config.email || !config.host || !password || !Number.isInteger(port) || port < 1 || port > 65535) {
    return null;
  }

  return {
    provider: config.provider || "custom",
    email: config.email,
    password,
    host: config.host,
    port,
    secure: Boolean(config.secure),
    from_name: config.from_name?.trim() || undefined,
  };
}

function createTransport(config: StoreEmailConfig) {
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: config.email, pass: config.password },
  });
}

export async function verifyStoreEmailConfig(value: unknown) {
  const config = getUsableConfig(value);
  if (!config) throw new Error("Conexão de e-mail incompleta. Salve um endereço e uma senha de aplicativo primeiro.");
  await createTransport(config).verify();
}

export type EmailSenderMode = "own" | "system";

export function normalizeEmailSenderMode(value: unknown): EmailSenderMode {
  return value === "system" ? "system" : "own";
}

export type TenantEmailMessage = {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  /** Reply-To usado no modo "system" quando a loja não tem e-mail próprio conectado. */
  replyTo?: string;
  attachments?: { filename: string; content: Buffer; contentType?: string }[];
};

/** Estado de envio da loja: qual modo está ativo e se há como enviar agora. */
export async function getTenantEmailSendingStatus(tenantId: number) {
  const tenant = await (prisma.tenant as any).findUnique({
    where: { id: tenantId },
    select: { email_config: true, email_sender_mode: true },
  });
  const mode = normalizeEmailSenderMode(tenant?.email_sender_mode);
  const ownConfigured = Boolean(getUsableConfig(tenant?.email_config));
  return { mode, own_configured: ownConfigured, can_send: mode === "system" || ownConfigured };
}

/**
 * Ponto único de envio de e-mails de documentos aos clientes. Decide o transporte
 * conforme tenant.email_sender_mode: "system" usa o SMTP do sistema (From com o nome
 * da loja, Reply-To da loja); "own" usa a conta própria conectada pela loja.
 */
export async function sendTenantEmail(tenantId: number, message: TenantEmailMessage) {
  const tenant = await (prisma.tenant as any).findUnique({
    where: { id: tenantId },
    select: { name: true, email_config: true, email_sender_mode: true },
  });
  if (!tenant) throw new Error("Loja não encontrada.");

  const config = getUsableConfig(tenant.email_config);
  const { replyTo, ...mail } = message;

  if (normalizeEmailSenderMode(tenant.email_sender_mode) === "system") {
    await sendSystemEmailForStore({
      storeName: tenant.name,
      replyTo: config?.email || replyTo || undefined,
      ...mail,
    });
    return;
  }

  if (!config) {
    throw new Error("A loja ainda não conectou um e-mail para envios aos clientes. Conecte uma conta ou ative o envio pelo sistema em Configurações > E-mail.");
  }
  await createTransport(config).sendMail({
    from: `"${config.from_name && config.from_name !== config.email ? config.from_name : tenant.name || config.email}" <${config.email}>`,
    ...mail,
  });
}

/** Mantido por compatibilidade: delega para sendTenantEmail. */
export const sendStoreEmail = sendTenantEmail;

/**
 * Dados para a assinatura dos e-mails: nome do usuário logado + contatos da loja.
 * "replyTo" é o e-mail de contato da loja (conta conectada) ou, na falta dele,
 * o e-mail do usuário que está enviando.
 */
export async function loadEmailSignature(
  tenantId: number,
  userId?: number,
): Promise<{ signature: StoreSignatureInput; replyTo?: string; senderName?: string }> {
  const [tenant, user] = await Promise.all([
    (prisma.tenant as any).findUnique({ where: { id: tenantId } }),
    userId ? prisma.user.findFirst({ where: { id: userId, tenant_id: tenantId }, select: { name: true, email: true } }) : null,
  ]);
  const config = getUsableConfig(tenant?.email_config);
  const senderName = user?.name?.trim() || undefined;
  return {
    signature: buildSignatureFromTenant(tenant ?? {}, senderName, config?.email),
    replyTo: config?.email || user?.email || undefined,
    senderName,
  };
}

export async function sendStoreEmailConnectionTest(tenantId: number) {
  const tenant = await (prisma.tenant as any).findUnique({
    where: { id: tenantId },
    select: { name: true, email_config: true },
  });
  if (!tenant) throw new Error("Loja não encontrada.");

  const config = getUsableConfig(tenant.email_config);
  if (!config) throw new Error("Salve um endereço e uma senha de aplicativo antes de testar.");

  const transporter = createTransport(config);
  await transporter.verify();
  await transporter.sendMail({
    from: `"${config.from_name || tenant.name}" <${config.email}>`,
    to: config.email,
    subject: "Teste de conexão de e-mail · BoxSys",
    html: baseTemplate(`
      <p style="margin:0 0 8px;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#10b981;">Conexão confirmada</p>
      <h1 style="margin:0 0 16px;font-size:24px;font-weight:900;color:#0f172a;line-height:1.2;">Seu e-mail da loja está pronto.</h1>
      <p style="margin:0;font-size:15px;color:#475569;line-height:1.6;">A BoxSys conseguiu enviar esta mensagem usando a conta <strong>${config.email}</strong>. Ela poderá ser usada nos envios de documentos aos seus clientes.</p>
    `),
  });
}
