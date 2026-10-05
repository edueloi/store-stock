import fs from "fs";
import path from "path";

import type { Request, Response } from "express";
import multer from "multer";
import forge from "node-forge";

import { prisma } from "../config/prisma";
import { env } from "../config/env";
import type { AuthenticatedRequest } from "../types/auth";
import { buildTenantAccessUrl, normalizeSubdomain } from "../utils/tenant-domain";
import { decryptSecret, encryptSecret } from "../utils/secretCrypto";
import { parsePfx } from "../services/nfce/signer";
import { sendReportNow } from "../services/email-reports.service";
import { sendStoreEmailConnectionTest } from "../services/store-email.service";

function getTenantId(req: Request) {
  return (req as AuthenticatedRequest).user.tenantId;
}

type EmailConnectionInput = {
  provider?: string;
  email?: string;
  password?: string;
  host?: string;
  port?: number;
  secure?: boolean;
  from_name?: string;
};

const EMAIL_PROVIDER_DEFAULTS: Record<string, { host: string; port: number; secure: boolean }> = {
  gmail: { host: "smtp.gmail.com", port: 465, secure: true },
  outlook: { host: "smtp-mail.outlook.com", port: 587, secure: false },
  hotmail: { host: "smtp-mail.outlook.com", port: 587, secure: false },
  yahoo: { host: "smtp.mail.yahoo.com", port: 465, secure: true },
  icloud: { host: "smtp.mail.me.com", port: 587, secure: false },
};

class EmailConnectionValidationError extends Error {}

function prepareEmailConnection(input: EmailConnectionInput, currentValue: unknown, storeName = "") {
  const provider = String(input.provider || "custom").trim().toLowerCase();
  const email = String(input.email || "").trim().toLowerCase();
  const current = currentValue && typeof currentValue === "object" ? currentValue as Record<string, unknown> : {};
  const preset = EMAIL_PROVIDER_DEFAULTS[provider];
  const host = String(preset?.host || input.host || "").trim().toLowerCase();
  const port = Number(preset?.port || input.port);
  const secure = preset?.secure ?? Boolean(input.secure);
  const rawPassword = String(input.password || "").replace(/\s+/g, "");
  const storedPassword = typeof current.password === "string" ? current.password : "";

  if (!/^\S+@\S+\.\S+$/.test(email)) throw new EmailConnectionValidationError("Informe um endereço de e-mail válido.");
  if (!host || !Number.isInteger(port) || port < 1 || port > 65535) {
    throw new EmailConnectionValidationError("Informe um servidor SMTP e uma porta válidos.");
  }
  if (!rawPassword && !storedPassword) {
    throw new EmailConnectionValidationError("Informe a senha de aplicativo fornecida pelo seu e-mail.");
  }

  return {
    provider,
    email,
    host,
    port,
    secure,
    from_name: String(input.from_name || "").trim() || String(current.from_name || "").trim() || storeName || email,
    password: rawPassword ? encryptSecret(rawPassword) : storedPassword,
  };
}

// Só os dados da PRÓPRIA assinatura do tenant logado — nunca de outros tenants (isso é
// diferente do financeiro do super admin, que vê todos). Usado na tela "Assinatura" do menu.
export async function getMyBilling(req: Request, res: Response) {
  try {
    const subscription = await prisma.platformSubscription.findUnique({
      where: { tenant_id: getTenantId(req) },
      include: { invoices: { orderBy: { due_date: "desc" }, take: 12 } },
    });
    if (!subscription) { res.json(null); return; }
    res.json({
      ...subscription,
      value: Number(subscription.value),
      invoices: subscription.invoices.map((inv) => ({ ...inv, value: Number(inv.value) })),
    });
  } catch {
    res.status(500).json({ error: "Falha ao consultar a assinatura." });
  }
}

export async function getTenant(req: Request, res: Response) {
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: getTenantId(req) },
    }) as any;

    if (!tenant) {
      res.status(404).json({ error: "Tenant not found" });
      return;
    }

    // Nunca devolve a senha do certificado / tokens CSC ao frontend — só indica se estão configurados.
    const {
      nfce_cert_password,
      nfce_csc_token,
      nfce_csc_token_homologacao,
      nfce_csc_token_producao,
      email_config,
      ...safeTenant
    } = tenant;

    res.json({
      ...safeTenant,
      nfce_cert_configured: !!(tenant.nfce_cert_path && tenant.nfce_cert_password),
      nfce_csc_configured: !!(tenant.nfce_csc_id && tenant.nfce_csc_token),
      nfce_csc_homologacao_configured: !!(tenant.nfce_csc_id_homologacao && tenant.nfce_csc_token_homologacao),
      nfce_csc_producao_configured: !!(tenant.nfce_csc_id_producao && tenant.nfce_csc_token_producao),
      // A senha nunca sai do servidor. O frontend recebe apenas o estado e os
      // dados necessários para mostrar a conta conectada.
      email_connection: email_config && typeof email_config === "object" ? {
        configured: Boolean((email_config as Record<string, unknown>).email && (email_config as Record<string, unknown>).password),
        provider: (email_config as Record<string, unknown>).provider || "custom",
        email: (email_config as Record<string, unknown>).email || "",
        host: (email_config as Record<string, unknown>).host || "",
        port: (email_config as Record<string, unknown>).port || "",
        secure: Boolean((email_config as Record<string, unknown>).secure),
        from_name: (email_config as Record<string, unknown>).from_name || "",
      } : null,
      public_url: buildTenantAccessUrl(tenant.subdomain || tenant.slug),
    });
  } catch {
    res.status(500).json({ error: "Failed to fetch tenant" });
  }
}

type StoreGatewayProvider = "mercadopago" | "asaas";

function gatewayProvider(value: unknown): StoreGatewayProvider | null {
  return value === "mercadopago" || value === "asaas" ? value : null;
}

/**
 * Lista somente o estado da integração. Tokens de Mercado Pago/Asaas são
 * segredos de cada loja e nunca saem do servidor, nem mascarados.
 */
export async function getStorePaymentGateways(req: Request, res: Response) {
  try {
    const gateways = await (prisma as any).storePaymentGateway.findMany({
      where: { tenant_id: getTenantId(req) },
      orderBy: { provider: "asc" },
      select: { provider: true, enabled: true, environment: true, credentials: true, updated_at: true },
    });

    res.json(gateways.map((gateway: any) => {
      const credentials = gateway.credentials && typeof gateway.credentials === "object"
        ? gateway.credentials as Record<string, unknown>
        : {};
      return {
        provider: gateway.provider,
        enabled: gateway.enabled,
        environment: gateway.environment,
        connected: Boolean(credentials.access_token),
        updated_at: gateway.updated_at,
      };
    }));
  } catch (error) {
    console.error("Falha ao listar gateways da loja", error);
    res.status(500).json({ error: "Não foi possível consultar as integrações de pagamento." });
  }
}

/** Salva uma conta recebedora que pertence exclusivamente ao tenant autenticado. */
export async function saveStorePaymentGateway(req: Request, res: Response) {
  try {
    const provider = gatewayProvider(req.params.provider);
    if (!provider) {
      res.status(422).json({ error: "Gateway de pagamento inválido." });
      return;
    }

    const body = req.body as { enabled?: unknown; environment?: unknown; access_token?: unknown; webhook_token?: unknown };
    const environment = body.environment === "production" ? "production" : "sandbox";
    const existing = await (prisma as any).storePaymentGateway.findUnique({
      where: { tenant_id_provider: { tenant_id: getTenantId(req), provider } },
      select: { credentials: true },
    });
    const previous = existing?.credentials && typeof existing.credentials === "object"
      ? existing.credentials as Record<string, unknown>
      : {};
    const suppliedToken = typeof body.access_token === "string" ? body.access_token.trim() : "";
    const suppliedWebhookToken = typeof body.webhook_token === "string" ? body.webhook_token.trim() : "";
    const credentials = {
      ...previous,
      ...(suppliedToken ? { access_token: encryptSecret(suppliedToken) } : {}),
      ...(suppliedWebhookToken ? { webhook_token: encryptSecret(suppliedWebhookToken) } : {}),
    };
    const connected = Boolean(credentials.access_token && decryptSecret(String(credentials.access_token)));
    const enabled = Boolean(body.enabled) && connected;

    const gateway = await (prisma as any).storePaymentGateway.upsert({
      where: { tenant_id_provider: { tenant_id: getTenantId(req), provider } },
      create: { tenant_id: getTenantId(req), provider, enabled, environment, credentials },
      update: { enabled, environment, credentials },
      select: { provider: true, enabled: true, environment: true, updated_at: true },
    });

    res.json({ ...gateway, connected });
  } catch (error) {
    console.error("Falha ao salvar gateway da loja", error);
    res.status(500).json({ error: "Não foi possível salvar a integração de pagamento." });
  }
}

export async function updateTenant(req: Request, res: Response) {
  try {
    const b = req.body;

    // Build update payload with only the fields present in the request body
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: Record<string, any> = {};

    if (b.name !== undefined)               data.name               = b.name;
    if (b.whatsapp !== undefined)           data.whatsapp           = b.whatsapp;
    if (b.document !== undefined)           data.document           = b.document;
    if (b.about_text !== undefined)         data.about_text         = b.about_text;
    if (b.hero_tagline !== undefined)       data.hero_tagline       = b.hero_tagline;
    if (b.footer_text !== undefined)        data.footer_text        = b.footer_text;
    if (b.logo_url !== undefined)           data.logo_url           = b.logo_url;
    if (b.banner_url !== undefined)         data.banner_url         = b.banner_url;
    if (b.instagram_url !== undefined)      data.instagram_url      = b.instagram_url;
    if (b.facebook_url !== undefined)       data.facebook_url       = b.facebook_url;
    if (b.address !== undefined)            data.address            = b.address;
    if (b.address_street !== undefined)     data.address_street     = b.address_street;
    if (b.address_number !== undefined)     data.address_number     = b.address_number;
    if (b.address_complement !== undefined) data.address_complement = b.address_complement;
    if (b.address_district !== undefined)   data.address_district   = b.address_district;
    if (b.address_city !== undefined)       data.address_city       = b.address_city;
    if (b.address_state !== undefined)      data.address_state      = b.address_state;
    if (b.address_zip !== undefined)        data.address_zip        = b.address_zip;
    if (b.show_address !== undefined)       data.show_address       = b.show_address;
    if (b.template_id !== undefined)        data.template_id        = b.template_id;
    if (b.primary_color !== undefined)      data.primary_color      = b.primary_color;
    if (b.featured_limit !== undefined)     data.featured_limit     = Number(b.featured_limit);
    if (b.bestseller_limit !== undefined)   data.bestseller_limit   = Number(b.bestseller_limit);
    if (b.business_hours !== undefined)     data.business_hours     = b.business_hours;
    if (b.payment_methods !== undefined)    data.payment_methods    = b.payment_methods;
    if (b.policies !== undefined)           data.policies           = b.policies;
    if (b.card_fees !== undefined)          data.card_fees          = b.card_fees;
    if (b.pass_fee_to_customer !== undefined) data.pass_fee_to_customer = Boolean(b.pass_fee_to_customer);
    if (b.max_installments !== undefined)   data.max_installments   = Number(b.max_installments);
    if (b.enabled_brands !== undefined)     data.enabled_brands     = b.enabled_brands;
    if (b.pass_fee_by_method !== undefined) data.pass_fee_by_method = b.pass_fee_by_method;
    if (b.require_cash_session !== undefined) data.require_cash_session = Boolean(b.require_cash_session);
    if (b.print_cash_close_receipt !== undefined) data.print_cash_close_receipt = Boolean(b.print_cash_close_receipt);
    if (b.logout_on_cash_close !== undefined) data.logout_on_cash_close = Boolean(b.logout_on_cash_close);
    if (b.sell_without_stock_control !== undefined) data.sell_without_stock_control = Boolean(b.sell_without_stock_control);
    if (b.auto_print_receipt !== undefined) data.auto_print_receipt = Boolean(b.auto_print_receipt);
    if (b.crediario_interest_rate !== undefined) data.crediario_interest_rate = Math.min(30, Math.max(0, Number(b.crediario_interest_rate) || 0));
    if (b.crediario_grace_days !== undefined)    data.crediario_grace_days    = Math.min(90, Math.max(0, Number(b.crediario_grace_days) || 0));
    if (b.return_deadline_days !== undefined)    data.return_deadline_days    = b.return_deadline_days === null ? null : Math.min(365, Math.max(0, Number(b.return_deadline_days) || 0));
    if (b.weekly_report_enabled !== undefined)  data.weekly_report_enabled  = Boolean(b.weekly_report_enabled);
    if (b.monthly_report_enabled !== undefined) data.monthly_report_enabled = Boolean(b.monthly_report_enabled);
    if (b.report_recipient_emails !== undefined) {
      data.report_recipient_emails = Array.isArray(b.report_recipient_emails)
        ? b.report_recipient_emails.filter((e: unknown) => typeof e === "string" && e.trim()).map((e: string) => e.trim())
        : null;
    }
    if (b.email_connection !== undefined) {
      if (b.email_connection === null) {
        data.email_config = null;
      } else if (typeof b.email_connection === "object") {
        const current = await (prisma.tenant as any).findUnique({
          where: { id: getTenantId(req) },
          select: { name: true, email_config: true },
        });
        data.email_config = prepareEmailConnection(b.email_connection as EmailConnectionInput, current?.email_config, current?.name);
      } else {
        res.status(422).json({ error: "Configuração de e-mail inválida." });
        return;
      }
    }

    // Dados fiscais
    if (b.razao_social !== undefined)        data.razao_social        = b.razao_social;
    if (b.inscricao_estadual !== undefined)  data.inscricao_estadual  = b.inscricao_estadual;
    if (b.inscricao_municipal !== undefined) data.inscricao_municipal = b.inscricao_municipal;
    if (b.cnae_fiscal !== undefined)         data.cnae_fiscal         = b.cnae_fiscal;
    if (b.tax_regime !== undefined)          data.tax_regime          = b.tax_regime;
    if (b.crt !== undefined)                 data.crt                 = Number(b.crt);

    // NFC-e
    if (b.nfce_environment !== undefined)  data.nfce_environment  = b.nfce_environment;
    if (b.nfce_series !== undefined)       data.nfce_series       = Number(b.nfce_series);
    if (b.nfce_next_number !== undefined)  data.nfce_next_number  = Number(b.nfce_next_number);
    if (b.nfce_csc_id !== undefined)       data.nfce_csc_id       = b.nfce_csc_id;
    if (b.nfce_csc_token !== undefined)    data.nfce_csc_token    = b.nfce_csc_token ? encryptSecret(b.nfce_csc_token) : b.nfce_csc_token;
    // CSC/idCSC são registros SEPARADOS por ambiente na SEFAZ (o de homologação não vale
    // em produção, e vice-versa) — mantidos em pares próprios pra não perder o CSC de um
    // ambiente ao configurar o outro (nfce_csc_id/nfce_csc_token acima seguem existindo
    // só como fallback legado).
    if (b.nfce_csc_id_homologacao !== undefined)    data.nfce_csc_id_homologacao    = b.nfce_csc_id_homologacao;
    if (b.nfce_csc_token_homologacao !== undefined) data.nfce_csc_token_homologacao = b.nfce_csc_token_homologacao ? encryptSecret(b.nfce_csc_token_homologacao) : b.nfce_csc_token_homologacao;
    if (b.nfce_csc_id_producao !== undefined)       data.nfce_csc_id_producao       = b.nfce_csc_id_producao;
    if (b.nfce_csc_token_producao !== undefined)    data.nfce_csc_token_producao    = b.nfce_csc_token_producao ? encryptSecret(b.nfce_csc_token_producao) : b.nfce_csc_token_producao;

    // NFS-e (Sistema Nacional NFS-e)
    if (b.nfse_environment !== undefined)         data.nfse_environment         = b.nfse_environment;
    if (b.nfse_codigo_municipio !== undefined)     data.nfse_codigo_municipio     = b.nfse_codigo_municipio;
    if (b.nfse_inscricao_municipal !== undefined)  data.nfse_inscricao_municipal  = b.nfse_inscricao_municipal;
    if (b.nfse_serie !== undefined)                data.nfse_serie                = Number(b.nfse_serie);
    if (b.nfse_next_number !== undefined)          data.nfse_next_number          = Number(b.nfse_next_number);

    // Only update slug/subdomain if explicitly provided and non-empty
    if (b.subdomain || b.slug) {
      const normalizedPublicId = normalizeSubdomain(b.subdomain || b.slug);
      if (normalizedPublicId) {
        data.slug      = normalizedPublicId;
        data.subdomain = normalizedPublicId;
      }
    }

    await prisma.tenant.update({
      where: { id: getTenantId(req) },
      data,
    });

    res.json({ message: "Tenant updated" });
  } catch (err) {
    console.error("updateTenant error:", err);
    const message = err instanceof Error ? err.message : "Failed to update tenant";
    res.status(err instanceof EmailConnectionValidationError ? 422 : 500).json({ error: message });
  }
}

// ─── Certificado digital A1 (NFC-e) ────────────────────────────────────────────
// Guardado fora de public/ (env.nfceCertsDir) — nunca deve ser servido estaticamente.

export const uploadNfceCert = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [".pfx", ".p12"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error("Envie um arquivo de certificado .pfx ou .p12"));
  },
});

export async function uploadNfceCertificate(req: Request, res: Response) {
  try {
    const tenantId = getTenantId(req);
    const { password } = req.body as { password?: string };
    if (!req.file) { res.status(400).json({ error: "Nenhum arquivo enviado" }); return; }
    if (!password) { res.status(400).json({ error: "Informe a senha do certificado" }); return; }

    // Valida o certificado abrindo-o com a senha informada antes de persistir qualquer coisa —
    // uma senha errada ou arquivo corrompido nunca deve virar configuração salva.
    let certificatePem: string;
    let validUntil: string;
    let subjectName: string;
    try {
      const parsed = parsePfx(req.file.buffer.toString("binary"), password);
      certificatePem = parsed.certificatePem;
      const cert = forge.pki.certificateFromPem(certificatePem);
      validUntil = cert.validity.notAfter.toISOString();
      subjectName = cert.subject.getField("CN")?.value ?? "—";
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(422).json({ error: `Certificado inválido ou senha incorreta: ${message}` });
      return;
    }

    fs.mkdirSync(env.nfceCertsDir, { recursive: true });
    const filename = `${tenantId}-${Date.now()}.pfx`;
    const destPath = path.join(env.nfceCertsDir, filename);
    fs.writeFileSync(destPath, req.file.buffer);

    const previous = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { nfce_cert_path: true } });
    await prisma.tenant.update({
      where: { id: tenantId },
      data: { nfce_cert_path: destPath, nfce_cert_password: encryptSecret(password) },
    });
    if (previous?.nfce_cert_path && previous.nfce_cert_path !== destPath) {
      fs.unlink(previous.nfce_cert_path, () => {});
    }

    res.json({ success: true, subjectName, validUntil });
  } catch (err) {
    console.error("uploadNfceCertificate error:", err);
    res.status(500).json({ error: "Falha ao enviar certificado" });
  }
}

export async function deleteNfceCertificate(req: Request, res: Response) {
  try {
    const tenantId = getTenantId(req);
    const previous = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { nfce_cert_path: true } });

    await prisma.tenant.update({
      where: { id: tenantId },
      data: { nfce_cert_path: null, nfce_cert_password: null },
    });

    if (previous?.nfce_cert_path) fs.unlink(previous.nfce_cert_path, () => {});

    res.json({ success: true });
  } catch (err) {
    console.error("deleteNfceCertificate error:", err);
    res.status(500).json({ error: "Falha ao remover certificado" });
  }
}

// Dispara o relatório (semanal ou mensal) na hora, pro tenant logado — usado
// pelo botão "Enviar agora" em Configurações, pra validar o envio sem esperar
// o próximo disparo automático (segunda de manhã / dia 1º do mês).
export async function sendReportNowHandler(req: Request, res: Response) {
  try {
    const tenantId = getTenantId(req);
    const { kind } = req.body as { kind?: "weekly" | "monthly" };
    if (kind !== "weekly" && kind !== "monthly") {
      res.status(422).json({ error: "Informe kind: 'weekly' ou 'monthly'" });
      return;
    }
    await sendReportNow(tenantId, kind);
    res.json({ success: true });
  } catch (err) {
    console.error("sendReportNowHandler error:", err);
    res.status(500).json({ error: "Falha ao enviar relatório" });
  }
}

// Confirma autenticação SMTP e envia uma mensagem para a própria conta da loja.
// É uma ação explícita do administrador, usada na tela Configurações > Conectar e-mail.
export async function testEmailConnection(req: Request, res: Response) {
  try {
    await sendStoreEmailConnectionTest(getTenantId(req));
    res.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Não foi possível conectar ao e-mail.";
    res.status(422).json({ error: message });
  }
}

// Histórico de envios automáticos (alertas financeiros por WhatsApp,
// relatórios por email) — pra o lojista conferir o que foi mandado e quando.
export async function listAutomatedMessageLogs(req: Request, res: Response) {
  try {
    const tenantId = getTenantId(req);
    const logs = await prisma.automatedMessageLog.findMany({
      where: { tenant_id: tenantId },
      orderBy: { created_at: "desc" },
      take: 100,
    });
    res.json(logs);
  } catch (err) {
    console.error("listAutomatedMessageLogs error:", err);
    res.status(500).json({ error: "Falha ao buscar histórico de envios" });
  }
}
