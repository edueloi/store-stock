import fs from "fs";
import { fiscalTenant } from "../../utils/issuers";
import path from "path";

import { prisma } from "../../config/prisma";
import { env } from "../../config/env";
import { decryptSecret } from "../../utils/secretCrypto";
import { buildCancelamentoXml } from "./eventoXml";
import { loadPfx, assinarEventoAsync } from "./signer";
import { callSefazSoap, extractTag } from "./soapClient";

// Prazo regulamentar (Ajuste SINIEF 19/16, cláusula 15ª) para cancelamento comum de NFC-e.
// Fora desse prazo o cancelamento simples é rejeitado pela SEFAZ (exige processo extemporâneo,
// fora do escopo desta implementação).
export const PRAZO_CANCELAMENTO_MINUTOS = 30;

export interface CancelarNfceResult {
  success: boolean;
  error?: string;
}

export async function cancelarNfce(orderId: number, justificativa: string): Promise<CancelarNfceResult> {
  const invoice = await prisma.nfceInvoice.findUnique({ where: { order_id: orderId } });
  if (!invoice) return { success: false, error: "Nota fiscal não encontrada para este pedido" };
  if (invoice.status !== "authorized") return { success: false, error: "Somente notas autorizadas podem ser canceladas" };
  if (!invoice.access_key || !invoice.protocol) return { success: false, error: "Nota sem chave de acesso ou protocolo de autorização" };

  if (justificativa.trim().length < 15) {
    return { success: false, error: "Justificativa deve ter ao menos 15 caracteres" };
  }

  if (invoice.authorized_at) {
    const minutosDesdeAutorizacao = (Date.now() - invoice.authorized_at.getTime()) / 60000;
    if (minutosDesdeAutorizacao > PRAZO_CANCELAMENTO_MINUTOS) {
      return {
        success: false,
        error: `Prazo de cancelamento (${PRAZO_CANCELAMENTO_MINUTOS} min) expirado — nota autorizada há ${Math.floor(minutosDesdeAutorizacao)} min. Cancelamento extemporâneo não é suportado.`,
      };
    }
  }

  const tenant = await fiscalTenant(invoice.tenant_id, invoice.issuer_id);
  if (!tenant) return { success: false, error: "Loja não encontrada" };
  tenant.nfce_cert_password = decryptSecret(tenant.nfce_cert_password);
  if (!tenant.nfce_cert_path || !tenant.nfce_cert_password) {
    return { success: false, error: "Certificado digital A1 não configurado para esta loja" };
  }

  try {
    const environment = tenant.nfce_environment === "producao" ? "producao" : "homologacao";

    const { xml, idEvento } = buildCancelamentoXml({
      uf: tenant.address_state || "SP",
      chaveAcesso: invoice.access_key,
      cnpj: tenant.document || "",
      environment,
      protocoloAutorizacao: invoice.protocol,
      justificativa,
    });

    const cert = loadPfx(tenant.nfce_cert_path, tenant.nfce_cert_password);
    const signedXmlWithDecl = await assinarEventoAsync(xml, idEvento, cert);
    // Mesmo problema documentado em emitir.ts: a declaração XML ("<?xml ...?>") que
    // assinarEvento preserva do documento original é ilegal no meio de outro elemento —
    // embutir isso dentro de <envEvento> quebra o parsing do envelope SOAP e a SEFAZ
    // rejeita com HTTP 400 e corpo vazio, sem chegar a retornar cStat/xMotivo.
    const signedXml = signedXmlWithDecl.replace(/^<\?xml[^?]*\?>/, "");

    const soapBody =
      `<nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeRecepcaoEvento4">` +
      `<envEvento xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.00">` +
      `<idLote>${Date.now()}</idLote>${signedXml}</envEvento>` +
      `</nfeDadosMsg>`;

    const result = await callSefazSoap({
      environment,
      service: "recepcaoEvento",
      soapBody,
      pfxPath: tenant.nfce_cert_path,
      pfxPassword: tenant.nfce_cert_password,
      timeoutMs: env.nfceTimeoutMs,
    });

    if (!result.ok) {
      return { success: false, error: result.error || `Falha na comunicação com a SEFAZ (HTTP ${result.statusCode})` };
    }

    // O retorno traz cStat em DOIS níveis: o do lote (retEnvEvento, ex. 128 "Lote de Evento
    // Processado") e o do evento em si (retEvento/infEvento: 135/136/155 ou uma rejeição).
    // extractTag() pega a primeira ocorrência (o lote) — por isso lemos o bloco do evento.
    const infEvento = /<infEvento[^>]*>([\s\S]*?)<\/infEvento>/i.exec(result.rawResponse)?.[1] ?? "";
    const loteStat = extractTag(result.rawResponse, "cStat");
    const loteMotivo = extractTag(result.rawResponse, "xMotivo");
    const cStat = infEvento ? extractTag(infEvento, "cStat") : loteStat;
    const xMotivo = infEvento ? extractTag(infEvento, "xMotivo") : loteMotivo;
    const nProt = infEvento ? extractTag(infEvento, "nProt") : extractTag(result.rawResponse, "nProt");

    // 135/136 = evento registrado e vinculado à NF-e; 155 = cancelamento homologado fora de prazo
    // 573 (duplicidade de evento) e 218 (já cancelada) = a SEFAZ já tem o cancelamento: só sincroniza o status
    if (!["135", "136", "155", "573", "218"].includes(cStat ?? "")) {
      return { success: false, error: `${xMotivo ?? "SEFAZ rejeitou o cancelamento"} (cStat ${cStat ?? "?"})` };
    }

    const monthDir = invoice.authorized_at
      ? `${invoice.authorized_at.getFullYear()}${String(invoice.authorized_at.getMonth() + 1).padStart(2, "0")}`
      : `${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, "0")}`;
    const dir = path.join(env.nfceXmlDir, String(tenant.id), monthDir);
    fs.mkdirSync(dir, { recursive: true });
    const cancelXmlPath = path.join(dir, `${invoice.access_key}-cancelamento.xml`);
    fs.writeFileSync(cancelXmlPath, signedXmlWithDecl, "utf-8");

    await prisma.nfceInvoice.update({
      where: { id: invoice.id },
      data: {
        status: "cancelled",
        cancel_protocol: nProt,
        cancel_reason: justificativa,
        cancelled_at: new Date(),
        cancel_xml_path: cancelXmlPath,
      },
    });

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}
