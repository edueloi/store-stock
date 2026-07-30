import fs from "fs";
import path from "path";

import { prisma } from "../../config/prisma";
import { env } from "../../config/env";
import { buildDpsXml } from "./dpsXmlBuilder";
import { loadPfx, assinarDPS } from "../nfce/signer";
import { callNfseRest, gzipBase64, type NfseEnvironment } from "./restClient";
import { consultarAliquotaServico } from "./parametrosMunicipais";

function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
}

export interface EmitirNfseInput {
  serviceOrderId: number;
  codigoTributacaoNacional: string; // subitem da lista de serviços, ex: "70602"
  descricaoServico: string;
  valorServico: number; // normalmente o service_value da OS (mão de obra), não as peças
}

export async function emitirNfse(input: EmitirNfseInput): Promise<void> {
  const { serviceOrderId, codigoTributacaoNacional, descricaoServico, valorServico } = input;

  const serviceOrder = await prisma.serviceOrder.findUnique({ where: { id: serviceOrderId } });
  if (!serviceOrder) return;

  const tenant = await prisma.tenant.findUnique({ where: { id: serviceOrder.tenant_id } });
  if (!tenant) return;

  const invoice = await prisma.nfseInvoice.findUnique({ where: { service_order_id: serviceOrderId } });
  if (!invoice) return;

  await prisma.nfseInvoice.update({
    where: { id: invoice.id },
    data: { status: "processing", attempts: { increment: 1 }, last_attempt_at: new Date() },
  });

  try {
    if (!tenant.nfce_cert_path || !tenant.nfce_cert_password) {
      throw new Error("Certificado digital A1 não configurado para esta loja (Configurações > Dados Fiscais).");
    }
    if (!tenant.nfse_codigo_municipio) {
      throw new Error("Código do município (IBGE) não configurado para esta loja (Configurações > Dados Fiscais).");
    }

    const environment: NfseEnvironment = tenant.nfse_environment === "producao" ? "producao" : "homologacao";

    // Alíquota parametrizada pelo município (Tatuí e a maioria já aderiram ao Sistema
    // Nacional NFS-e) — só cai no valor manual se o município não estiver parametrizado.
    const parametros = await consultarAliquotaServico(
      environment, tenant.nfse_codigo_municipio, codigoTributacaoNacional,
      tenant.nfce_cert_path, tenant.nfce_cert_password, env.nfceTimeoutMs,
    );
    const aliquotaIss = parametros.aliquota ?? 5; // 5% como fallback conservador (teto legal do ISS)

    const { idDPS, xml } = buildDpsXml({
      tenant,
      serviceOrder,
      serie: invoice.serie,
      numero: invoice.numero,
      aliquotaIss,
      codigoTributacaoNacional,
      descricaoServico,
      valorServico,
    });

    const cert = loadPfx(tenant.nfce_cert_path, tenant.nfce_cert_password);
    const signedXml = assinarDPS(xml, idDPS, cert);

    const result = await callNfseRest({
      environment,
      method: "POST",
      path: "/nfse",
      body: { dpsXmlGZipB64: gzipBase64(signedXml) },
      pfxPath: tenant.nfce_cert_path,
      pfxPassword: tenant.nfce_cert_password,
      timeoutMs: env.nfceTimeoutMs,
    });

    if (!result.ok) {
      const data = (result.data ?? {}) as Record<string, unknown>;
      const mensagens = Array.isArray(data.mensagens) ? data.mensagens : [];
      const primeira = mensagens[0] as Record<string, unknown> | undefined;
      await prisma.nfseInvoice.update({
        where: { id: invoice.id },
        data: {
          status: "rejected",
          rejection_code: primeira ? String(primeira.codigo ?? "sem-codigo") : String(result.statusCode),
          rejection_reason: primeira ? String(primeira.descricao ?? "") : (result.error || result.raw || "Falha na comunicação com o Sistema Nacional NFS-e"),
        },
      });
      return;
    }

    const responseData = (result.data ?? {}) as { chaveAcesso?: string };
    const chaveAcesso = responseData.chaveAcesso ?? null;

    const monthDir = `${serviceOrder.created_at.getFullYear()}${String(serviceOrder.created_at.getMonth() + 1).padStart(2, "0")}`;
    const dir = path.join(env.nfceXmlDir, "nfse", String(tenant.id), monthDir);
    ensureDir(dir);

    const dpsPath = path.join(dir, `${idDPS}-dps.xml`);
    fs.writeFileSync(dpsPath, signedXml, "utf-8");

    const nfsePath = path.join(dir, `${idDPS}-nfse.xml`);
    fs.writeFileSync(nfsePath, result.raw, "utf-8");

    await prisma.nfseInvoice.update({
      where: { id: invoice.id },
      data: {
        status: "authorized",
        chave_acesso: chaveAcesso,
        authorized_at: new Date(),
        dps_xml_path: dpsPath,
        nfse_xml_path: nfsePath,
      },
    });

    await prisma.tenant.update({
      where: { id: tenant.id },
      data: { nfse_next_number: { increment: 1 } },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.nfseInvoice.update({
      where: { id: invoice.id },
      data: { status: "error", rejection_reason: message },
    });
  }
}
