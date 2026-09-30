import nodemailer from "nodemailer";

import { prisma } from "../config/prisma";
import { decryptSecret } from "../utils/secretCrypto";
import { baseTemplate } from "./mailer.service";

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

export async function sendStoreEmail(
  tenantId: number,
  message: {
    to: string | string[];
    subject: string;
    text?: string;
    html?: string;
    attachments?: { filename: string; content: Buffer; contentType?: string }[];
  },
) {
  const tenant = await (prisma.tenant as any).findUnique({
    where: { id: tenantId },
    select: { name: true, email_config: true },
  });
  const config = getUsableConfig(tenant?.email_config);
  if (!config) throw new Error("A loja ainda não conectou um e-mail para envios aos clientes.");

  await createTransport(config).sendMail({
    from: `"${config.from_name && config.from_name !== config.email ? config.from_name : tenant.name || config.email}" <${config.email}>`,
    ...message,
  });
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
