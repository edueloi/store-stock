import fs from "fs";
import path from "path";

import { prisma } from "../../config/prisma";
import { env } from "../../config/env";
import { decryptSecret } from "../../utils/secretCrypto";
import { buildCancelamentoNfseXml, type MotivoCancelamentoNfse } from "./eventoXmlBuilder";
import { loadPfx, assinarDPS } from "../nfce/signer";
import { callNfseRest, gzipBase64, type NfseEnvironment } from "./restClient";

export interface CancelarNfseResult {
  success: boolean;
  error?: string;
}

export async function cancelarNfse(
  serviceOrderId: number,
  justificativa: string,
  motivo: MotivoCancelamentoNfse = "1",
): Promise<CancelarNfseResult> {
  const invoice = await prisma.nfseInvoice.findUnique({ where: { service_order_id: serviceOrderId } });
  if (!invoice) return { success: false, error: "NFS-e não encontrada para esta ordem de serviço" };
  if (invoice.status !== "authorized") return { success: false, error: "Somente notas autorizadas podem ser canceladas" };
  if (!invoice.chave_acesso) return { success: false, error: "Nota sem chave de acesso" };

  if (justificativa.trim().length < 15) {
    return { success: false, error: "Justificativa deve ter ao menos 15 caracteres" };
  }

  const tenant = await prisma.tenant.findUnique({ where: { id: invoice.tenant_id } });
  if (!tenant) return { success: false, error: "Loja não encontrada" };
  tenant.nfce_cert_password = decryptSecret(tenant.nfce_cert_password);
  if (!tenant.nfce_cert_path || !tenant.nfce_cert_password) {
    return { success: false, error: "Certificado digital A1 não configurado para esta loja" };
  }

  try {
    const environment: NfseEnvironment = invoice.environment === "producao" ? "producao" : "homologacao";
    const docDigits = (tenant.document || "").replace(/\D/g, "");
    const isCnpj = docDigits.length > 11;

    const { xml, idEvento } = buildCancelamentoNfseXml({
      chaveAcesso: invoice.chave_acesso,
      cnpj: isCnpj ? docDigits : undefined,
      cpf: isCnpj ? undefined : docDigits,
      cMotivo: motivo,
      xMotivo: justificativa,
      environment,
    });

    const cert = loadPfx(tenant.nfce_cert_path, tenant.nfce_cert_password);
    // Mesma assinatura enveloped-signature/C14N usada na DPS — assinarDPS já assina
    // qualquer elemento com Id (aqui, infPedReg em vez de infDPS).
    const signedXml = assinarDPS(xml, idEvento, cert);

    const result = await callNfseRest({
      environment,
      method: "POST",
      path: `/nfse/${invoice.chave_acesso}/eventos`,
      body: { pedRegEventoXmlGZipB64: gzipBase64(signedXml) },
      pfxPath: tenant.nfce_cert_path,
      pfxPassword: tenant.nfce_cert_password,
      timeoutMs: env.nfceTimeoutMs,
    });

    if (!result.ok) {
      const data = (result.data ?? {}) as { erros?: Array<Record<string, unknown>> };
      const erros = Array.isArray(data.erros) ? data.erros : [];
      const primeiro = erros[0];
      const descricao = primeiro?.Descricao ?? primeiro?.descricao;
      const complemento = primeiro?.Complemento ?? primeiro?.complemento;
      const rejectionReason = descricao
        ? [descricao, complemento].filter(Boolean).join(" — ")
        : (result.error || result.raw || `Falha na comunicação com o Sistema Nacional NFS-e (HTTP ${result.statusCode})`);
      return { success: false, error: rejectionReason };
    }

    const monthDir = invoice.authorized_at
      ? `${invoice.authorized_at.getFullYear()}${String(invoice.authorized_at.getMonth() + 1).padStart(2, "0")}`
      : `${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, "0")}`;
    const dir = path.join(env.nfceXmlDir, "nfse", String(tenant.id), monthDir);
    fs.mkdirSync(dir, { recursive: true });
    const cancelXmlPath = path.join(dir, `${invoice.chave_acesso}-cancelamento.xml`);
    fs.writeFileSync(cancelXmlPath, signedXml, "utf-8");

    await prisma.nfseInvoice.update({
      where: { id: invoice.id },
      data: {
        status: "cancelled",
        cancel_reason: justificativa,
        cancelled_at: new Date(),
      },
    });

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}
