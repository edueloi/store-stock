import fs from "fs";
import path from "path";

import type { Request, Response } from "express";
import multer from "multer";
import forge from "node-forge";

import { prisma } from "../config/prisma";
import { env } from "../config/env";
import type { AuthenticatedRequest } from "../types/auth";
import { buildTenantAccessUrl, normalizeSubdomain } from "../utils/tenant-domain";
import { parsePfx } from "../services/nfce/signer";

function getTenantId(req: Request) {
  return (req as AuthenticatedRequest).user.tenantId;
}

export async function getTenant(req: Request, res: Response) {
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: getTenantId(req) },
    });

    if (!tenant) {
      res.status(404).json({ error: "Tenant not found" });
      return;
    }

    // Nunca devolve a senha do certificado / token CSC ao frontend — só indica se estão configurados.
    const { nfce_cert_password, nfce_csc_token, ...safeTenant } = tenant;

    res.json({
      ...safeTenant,
      nfce_cert_configured: !!(tenant.nfce_cert_path && tenant.nfce_cert_password),
      nfce_csc_configured: !!(tenant.nfce_csc_id && tenant.nfce_csc_token),
      public_url: buildTenantAccessUrl(tenant.subdomain || tenant.slug),
    });
  } catch {
    res.status(500).json({ error: "Failed to fetch tenant" });
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
    if (b.crediario_interest_rate !== undefined) data.crediario_interest_rate = Number(b.crediario_interest_rate);
    if (b.crediario_grace_days !== undefined)    data.crediario_grace_days    = Number(b.crediario_grace_days);

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
    if (b.nfce_csc_token !== undefined)    data.nfce_csc_token    = b.nfce_csc_token;

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
    res.status(500).json({ error: "Failed to update tenant" });
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
      data: { nfce_cert_path: destPath, nfce_cert_password: password },
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
