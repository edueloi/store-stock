import fs from "fs";
import path from "path";

import { prisma } from "../../config/prisma";
import { env } from "../../config/env";
import { decryptSecret } from "../../utils/secretCrypto";
import { buildNfceXml, type PaymentSegment } from "./xmlBuilder";
import { loadPfx, assinarNfce } from "./signer";
import { callSefazSoap, extractTag } from "./soapClient";
import { buildQrCodeUrl } from "./qrcode";
import { generateDanfePdf } from "./danfe";

// Traduz o "tPag" derivado do token de pagamento do PDV (ver sales.controller.ts)
export function paymentsFromOrder(paymentMethod: string | null): PaymentSegment[] {
  if (!paymentMethod) return [{ method: "money", amount: 0 }];
  return paymentMethod.split("|").map((seg) => {
    const [methodPart, amountStr] = seg.split(":");
    const method = methodPart.split("-")[0] ?? "money";
    return { method, amount: parseFloat(amountStr ?? "0") || 0 };
  });
}

function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
}

export async function emitirNfce(orderId: number): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: { include: { product: true } } },
  });
  if (!order) return;

  const tenant = await prisma.tenant.findUnique({ where: { id: order.tenant_id } });
  if (!tenant) return;
  tenant.nfce_cert_password = decryptSecret(tenant.nfce_cert_password);
  tenant.nfce_csc_token = decryptSecret(tenant.nfce_csc_token);

  const invoice = await prisma.nfceInvoice.findUnique({ where: { order_id: orderId } });
  if (!invoice) return;

  await prisma.nfceInvoice.update({
    where: { id: invoice.id },
    data: { status: "processing", attempts: { increment: 1 }, last_attempt_at: new Date() },
  });

  try {
    if (!tenant.nfce_cert_path || !tenant.nfce_cert_password) {
      throw new Error("Certificado digital A1 não configurado para esta loja (Configurações > Dados Fiscais).");
    }
    if (!tenant.nfce_csc_id || !tenant.nfce_csc_token) {
      throw new Error("CSC (Código de Segurança do Contribuinte) não configurado para esta loja.");
    }

    const payments = paymentsFromOrder(order.payment_method);
    const numero = invoice.number;
    const serie = invoice.series;

    // CPF/CNPJ do destinatário na nota (ex.: "Nota Fiscal Paulista" e programas estaduais
    // equivalentes) — prioriza o documento avulso digitado na venda; se não houver, usa o
    // documento do cliente cadastrado vinculado ao pedido.
    let customerDocument = order.customer_document ?? undefined;
    if (!customerDocument && order.customer_id) {
      const customer = await prisma.customer.findUnique({
        where: { id: order.customer_id },
        select: { document: true },
      });
      customerDocument = customer?.document ?? undefined;
    }

    const { chaveAcesso, xml } = buildNfceXml({
      tenant,
      order,
      items: order.items,
      payments,
      numero,
      serie,
      customerDocument,
    });

    const cert = loadPfx(tenant.nfce_cert_path, tenant.nfce_cert_password);
    const signedXml = assinarNfce(xml, chaveAcesso, cert);

    const environment = tenant.nfce_environment === "producao" ? "producao" : "homologacao";
    const soapBody =
      `<nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4">` +
      `<enviNFe versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe">` +
      `<idLote>${Date.now()}</idLote><indSinc>1</indSinc>${signedXml}</enviNFe>` +
      `</nfeDadosMsg>`;

    const result = await callSefazSoap({
      environment,
      service: "autorizacao",
      soapBody,
      pfxPath: tenant.nfce_cert_path,
      pfxPassword: tenant.nfce_cert_password,
      timeoutMs: env.nfceTimeoutMs,
    });

    if (!result.ok) {
      console.error(
        `[emitirNfce] SEFAZ rejeitou — status=${result.statusCode} tenant=${tenant.id} order=${orderId} env=${environment}`,
        result.error || result.rawResponse?.slice(0, 1000) || "(sem corpo)",
      );
      // Uma página de erro do IIS (em vez de um retorno SOAP com cStat/xMotivo) indica
      // rejeição de infraestrutura/credenciamento da SEFAZ, não um problema de dados da
      // nota — mensagem genérica de "falha de comunicação" seria enganosa aqui.
      const isInfraFailure = !result.error && result.rawResponse && /<html/i.test(result.rawResponse);
      throw new Error(
        isInfraFailure
          ? `A SEFAZ-SP recusou a conexão (HTTP ${result.statusCode}), sem retornar um erro de validação da nota. ` +
            "Causa mais comum: o CNPJ/certificado ainda não está credenciado para emissão de NFC-e junto à SEFAZ-SP " +
            "(credenciamento feito no Posto Fiscal ou no portal da Sefaz-SP, é anterior e separado do certificado digital)."
          : (result.error || `Falha na comunicação com a SEFAZ (HTTP ${result.statusCode})`),
      );
    }

    const cStat = extractTag(result.rawResponse, "cStat");
    const xMotivo = extractTag(result.rawResponse, "xMotivo");
    const protNFe = extractTag(result.rawResponse, "nProt");

    // cStat 100 = Autorizado o uso da NF-e
    if (cStat !== "100") {
      await prisma.nfceInvoice.update({
        where: { id: invoice.id },
        data: {
          status: "rejected",
          rejection_code: cStat ?? "sem-retorno",
          rejection_reason: xMotivo ?? "SEFAZ não retornou motivo",
        },
      });
      return;
    }

    // Autorizada — salva XML, gera QR Code e DANFE
    const monthDir = `${order.created_at.getFullYear()}${String(order.created_at.getMonth() + 1).padStart(2, "0")}`;
    const dir = path.join(env.nfceXmlDir, String(tenant.id), monthDir);
    ensureDir(dir);

    const xmlPath = path.join(dir, `${chaveAcesso}-nfce.xml`);
    fs.writeFileSync(xmlPath, signedXml, "utf-8");

    const qrCodeUrl = buildQrCodeUrl({
      chaveAcesso,
      environment,
      cscId: tenant.nfce_csc_id,
      cscToken: tenant.nfce_csc_token,
    });

    const paymentLabels: Record<string, string> = { money: "Dinheiro", pix: "PIX", debit: "Débito", credit: "Crédito" };
    const paymentSummary = payments.map((p) => `${paymentLabels[p.method] ?? p.method}: R$ ${p.amount.toFixed(2)}`).join(" + ");

    const danfeBuffer = await generateDanfePdf({
      storeName: tenant.razao_social || tenant.name,
      storeDocument: `CNPJ: ${tenant.document ?? ""}`,
      storeAddress: [tenant.address_street, tenant.address_number, tenant.address_city, tenant.address_state].filter(Boolean).join(", "),
      chaveAcesso,
      numero,
      serie,
      emittedAt: new Date(),
      environment,
      protocol: protNFe,
      items: order.items.map((item) => ({
        name: item.product.name,
        quantity: item.quantity,
        unit: item.product.unidade_comercial,
        unitPrice: Number(item.unit_price),
        total: Number(item.unit_price) * item.quantity,
      })),
      totalAmount: Number(order.total_amount),
      qrCodeUrl,
      paymentSummary,
    });

    const danfePath = path.join(dir, `${chaveAcesso}-danfe.pdf`);
    fs.writeFileSync(danfePath, danfeBuffer);

    await prisma.nfceInvoice.update({
      where: { id: invoice.id },
      data: {
        status: "authorized",
        access_key: chaveAcesso,
        protocol: protNFe,
        authorized_at: new Date(),
        xml_path: xmlPath,
        danfe_path: danfePath,
        qrcode_url: qrCodeUrl,
        rejection_code: null,
        rejection_reason: null,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[emitirNfce] erro — tenant=${tenant.id} order=${orderId}:`, err);
    await prisma.nfceInvoice.update({
      where: { id: invoice.id },
      data: { status: "error", rejection_reason: message },
    });
  }
}
