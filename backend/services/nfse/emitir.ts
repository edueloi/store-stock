import fs from "fs";
import path from "path";

import { prisma } from "../../config/prisma";
import { env } from "../../config/env";
import { buildDpsXml, type TomadorInput } from "./dpsXmlBuilder";
import { loadPfx, assinarDPS } from "../nfce/signer";
import { callNfseRest, gzipBase64, ungzipBase64, type NfseEnvironment } from "./restClient";
import { consultarAliquotaServico } from "./parametrosMunicipais";
import { generateNfsePdf } from "./pdf";
import { advanceServiceOrderToNotaEmitida } from "../../utils/stage-permissions";

function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
}

// Extrai um valor simples de tag XML sem depender de parser completo (o XML de
// retorno do governo é bem estruturado e sem CDATA nesses campos).
function extractTag(xml: string, tag: string): string | null {
  const m = xml.match(new RegExp(`<${tag}>([^<]*)</${tag}>`));
  return m ? m[1] : null;
}

export interface EmitirNfseInput {
  serviceOrderId: number;
  codigoTributacaoNacional: string; // subitem da lista de serviços, ex: "70602"
  descricaoServico: string;
  valorServico: number; // normalmente o service_value da OS (mão de obra), não as peças
}

// Resolve nome/documento de quem contratou o serviço: cliente cadastrado (se a OS
// estiver vinculada a um) ou, na falta de documento, só o nome informado na OS.
async function resolveTomador(serviceOrder: { customer_id: number | null; customer_name: string }): Promise<TomadorInput | null> {
  if (serviceOrder.customer_id) {
    const customer = await prisma.customer.findUnique({
      where: { id: serviceOrder.customer_id },
      select: { name: true, document: true },
    });
    if (customer) {
      const digits = (customer.document || "").replace(/\D/g, "");
      return {
        nome: customer.name,
        cpf: digits.length <= 11 ? digits : undefined,
        cnpj: digits.length > 11 ? digits : undefined,
      };
    }
  }
  if (serviceOrder.customer_name) {
    return { nome: serviceOrder.customer_name };
  }
  return null;
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

    // Alíquota parametrizada pelo município (a maioria já aderiu ao Sistema Nacional
    // NFS-e) — só cai no valor manual se o município não estiver parametrizado.
    const parametros = await consultarAliquotaServico(
      environment, tenant.nfse_codigo_municipio, codigoTributacaoNacional,
      tenant.nfce_cert_path, tenant.nfce_cert_password, env.nfceTimeoutMs,
    );
    const aliquotaIss = parametros.aliquota ?? 5; // 5% como fallback conservador (teto legal do ISS)

    const tomador = await resolveTomador(serviceOrder);

    const { idDPS, xml } = buildDpsXml({
      tenant,
      serviceOrder,
      serie: invoice.serie,
      numero: invoice.numero,
      aliquotaIss,
      codigoTributacaoNacional,
      descricaoServico,
      valorServico,
      tomador,
    });

    const cert = loadPfx(tenant.nfce_cert_path, tenant.nfce_cert_password);

    // O Sistema Nacional NFS-e exige que a assinatura seja feita com o certificado do
    // próprio emitente da DPS (erro E0718 quando não bate) — validamos aqui para dar
    // uma mensagem clara em vez do erro genérico do governo.
    const tenantDocDigits = (tenant.document || "").replace(/\D/g, "");
    const isTenantCnpj = tenantDocDigits.length > 11;
    if (isTenantCnpj && cert.titularCnpj && cert.titularCnpj !== tenantDocDigits) {
      throw new Error("O certificado digital enviado não corresponde ao CNPJ cadastrado como emitente. Para emitir em nome do CNPJ, é necessário um certificado e-CNPJ da empresa (o e-CPF pessoal não é aceito pelo Sistema Nacional NFS-e para assinar em nome do CNPJ).");
    }
    if (isTenantCnpj && !cert.titularCnpj && cert.titularCpf) {
      throw new Error("O certificado enviado é um e-CPF (pessoa física), mas o emitente está cadastrado com CNPJ. É necessário um certificado e-CNPJ da empresa para emitir NFS-e em nome do CNPJ.");
    }
    if (!isTenantCnpj && cert.titularCpf && cert.titularCpf !== tenantDocDigits) {
      throw new Error("O certificado digital enviado não corresponde ao CPF cadastrado como emitente.");
    }

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
      // Schema real (NFSePostResponseErro): { erros: [{ Codigo, Descricao, Complemento }] }
      // (a resposta real vem com maiúscula inicial, diferente do swagger documentado em minúsculo)
      const data = (result.data ?? {}) as { erros?: Array<Record<string, unknown>> };
      const erros = Array.isArray(data.erros) ? data.erros : [];
      const primeiro = erros[0];
      const codigo = primeiro?.Codigo ?? primeiro?.codigo;
      const descricao = primeiro?.Descricao ?? primeiro?.descricao;
      const complemento = primeiro?.Complemento ?? primeiro?.complemento;
      await prisma.nfseInvoice.update({
        where: { id: invoice.id },
        data: {
          status: "rejected",
          rejection_code: codigo ? String(codigo) : String(result.statusCode),
          rejection_reason: codigo
            ? [descricao, complemento].filter(Boolean).join(" — ")
            : (result.error || result.raw || "Falha na comunicação com o Sistema Nacional NFS-e"),
        },
      });
      return;
    }

    // Schema real (NFSePostResponseSucesso): { chaveAcesso, idDps, nfseXmlGZipB64, ... }
    const responseData = (result.data ?? {}) as { chaveAcesso?: string; nfseXmlGZipB64?: string };
    const chaveAcesso = responseData.chaveAcesso ?? null;
    const nfseXml = responseData.nfseXmlGZipB64 ? ungzipBase64(responseData.nfseXmlGZipB64) : result.raw;

    const monthDir = `${serviceOrder.created_at.getFullYear()}${String(serviceOrder.created_at.getMonth() + 1).padStart(2, "0")}`;
    const dir = path.join(env.nfceXmlDir, "nfse", String(tenant.id), monthDir);
    ensureDir(dir);

    const dpsPath = path.join(dir, `${idDPS}-dps.xml`);
    fs.writeFileSync(dpsPath, signedXml, "utf-8");

    const nfsePath = path.join(dir, `${idDPS}-nfse.xml`);
    fs.writeFileSync(nfsePath, nfseXml, "utf-8");

    const xTribNac = extractTag(nfseXml, "xTribNac"); // descrição oficial do código de tributação, vinda do governo
    const codigoVerificacao = extractTag(nfseXml, "nDFSe");

    const opSimpNac = tenant.tax_regime === "simples_nacional";
    const pdfBuffer = await generateNfsePdf({
      emitterName: tenant.razao_social || tenant.name,
      emitterDisplayName: tenant.name,
      emitterDocument: tenant.document || "",
      emitterIM: tenant.nfse_inscricao_municipal,
      emitterRegime: opSimpNac ? "Simples Nacional (ME/EPP)" : "Não optante do Simples Nacional",
      emitterAddress: [tenant.address_street, tenant.address_number].filter(Boolean).join(", ") || tenant.address || "",
      emitterPhone: tenant.whatsapp,
      tomadorNome: tomador?.nome,
      tomadorDocumento: tomador?.cpf || tomador?.cnpj,
      numero: invoice.numero,
      serie: invoice.serie,
      environment,
      chaveAcesso,
      authorizedAt: new Date(),
      codigoVerificacao,
      codigoTributacao: codigoTributacaoNacional,
      descricaoTributacao: xTribNac ? xTribNac.replace(/\.$/, "") : null,
      descricaoServico,
      valorServico,
      // Alíquota só é exibida como percentual do ISS quando o regime não é Simples
      // Nacional — para opSimpNac=3, o mesmo número é só a estimativa usada em
      // pTotTribSN (não é a alíquota do ISS em si, que é apurada pelo SN).
      aliquotaIss: opSimpNac ? null : aliquotaIss,
      valorIss: null,
    });
    const pdfPath = path.join(dir, `${idDPS}-nfse.pdf`);
    fs.writeFileSync(pdfPath, pdfBuffer);

    await prisma.nfseInvoice.update({
      where: { id: invoice.id },
      data: {
        status: "authorized",
        chave_acesso: chaveAcesso,
        codigo_verificacao: codigoVerificacao,
        authorized_at: new Date(),
        dps_xml_path: dpsPath,
        nfse_xml_path: nfsePath,
        nfse_pdf_path: pdfPath,
        rejection_code: null,
        rejection_reason: null,
      },
    });

    await prisma.tenant.update({
      where: { id: tenant.id },
      data: { nfse_next_number: { increment: 1 } },
    });

    await advanceServiceOrderToNotaEmitida(serviceOrderId, "Sistema (NFS-e)");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.nfseInvoice.update({
      where: { id: invoice.id },
      data: { status: "error", rejection_reason: message },
    });
  }
}
