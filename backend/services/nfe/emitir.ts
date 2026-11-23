import fs from "fs";
import path from "path";

import type { Product } from "@prisma/client";

import { prisma } from "../../config/prisma";
import { env } from "../../config/env";
import { decryptSecret } from "../../utils/secretCrypto";
import { fiscalTenant, withIssuerAddress } from "../../utils/issuers";
import { emitToTenant } from "../realtime.service";
import { buildCancelamentoXml } from "../nfce/eventoXml";
import { loadPfx, assinarNfceAsync, assinarEventoAsync } from "../nfce/signer";
import { callSefazSoap, extractProtTag, extractTag } from "../nfce/soapClient";
import { paymentsFromOrder, ensureDir } from "../nfce/emitir";
import { buildNfeXml, cfopForDestination, type NfeRecipient, type NfeFreight } from "./xmlBuilder";
import { generateNfeDanfePdf, type NfeDanfeInput } from "./danfe";

// Prazo geral para cancelamento comum de NF-e (Ajuste SINIEF 07/05): 24 h da autorização.
export const PRAZO_CANCELAMENTO_NFE_HORAS = 24;

const FREIGHT_LABELS: Record<string, string> = {
  "0": "0 - Remetente (CIF)", "1": "1 - Destinatário (FOB)", "2": "2 - Terceiros", "3": "3 - Próprio (remetente)", "4": "4 - Próprio (destinatário)", "9": "9 - Sem transporte",
};

function isGtinPrefixRejection(xMotivo: string | null): boolean {
  return !!xMotivo && /gtin.*prefixo|cean.*prefixo/i.test(xMotivo);
}

/** Emite a NF-e do pedido e, ao TERMINAR (autorizada, rejeitada ou erro), avisa as telas abertas ("nfe:changed"). */
export async function emitirNfe(orderId: number): Promise<void> {
  try {
    await emitirNfeCore(orderId);
  } finally {
    try {
      const o = await prisma.order.findUnique({ where: { id: orderId }, select: { tenant_id: true } });
      if (o) emitToTenant(o.tenant_id, "nfe:changed", { orderId });
    } catch { /* aviso é opcional */ }
  }
}

async function emitirNfeCore(orderId: number): Promise<void> {
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { items: { include: { product: true } } } });
  if (!order) return;
  const invoice = await prisma.nfeInvoice.findUnique({ where: { order_id: orderId } });
  if (!invoice) return;

  const tenantRaw = await fiscalTenant(order.tenant_id, invoice.issuer_id);
  const tenant = tenantRaw ? await withIssuerAddress(tenantRaw, invoice.issuer_id) : tenantRaw;
  if (!tenant) return;
  tenant.nfce_cert_password = decryptSecret(tenant.nfce_cert_password);

  const fail = async (code: string, reason: string, status: "rejected" | "error" = "rejected") => {
    await prisma.nfeInvoice.update({ where: { id: invoice.id }, data: { status, rejection_code: code, rejection_reason: reason } });
  };

  if (order.items.length === 0) { await fail("sem-itens", "Este pedido não tem produtos. A NF-e é para mercadorias; serviço sai pela NFS-e."); return; }
  const recipient = invoice.recipient as unknown as NfeRecipient | null;
  const freight = (invoice.freight as unknown as NfeFreight | null) ?? { mode: "9", value: 0 };
  if (!recipient?.document || !recipient.address?.city_code) { await fail("sem-destinatario", "Destinatário incompleto. Preencha os dados do cliente e emita de novo."); return; }

  await prisma.nfeInvoice.update({ where: { id: invoice.id }, data: { status: "processing", attempts: { increment: 1 }, last_attempt_at: new Date() } });

  async function attempt(forceNoGtin: boolean): Promise<string | null> {
    if (!tenant!.nfce_cert_path || !tenant!.nfce_cert_password) {
      throw new Error("Certificado digital A1 não configurado para este CNPJ (Configurações > Dados Fiscais).");
    }
    const payments = paymentsFromOrder(order!.payment_method, Number(order!.total_amount), Number(order!.change_amount) || 0);
    const itemsForXml = order!.items.map((item) => ({
      ...item,
      product: item.product
        ? (forceNoGtin ? { ...item.product, barcode: null } : item.product)
        : ({
          name: item.name || "Item avulso", sku: null, barcode: null, ncm: item.ncm || "00000000", cest: null, cfop: "5102",
          unidade_comercial: "UN", unidade_tributavel: "UN", origem: 0, csosn: "102", cst_icms: "00", icms_aliquota: null, pis_cst: "07", cofins_cst: "07",
        } as Product),
    }));

    const { chaveAcesso, xml, totalNota } = buildNfeXml({
      tenant: tenant!, order: order!, items: itemsForXml, payments, numero: invoice!.number, serie: invoice!.series,
      recipient, freight, natureOfOperation: invoice!.nature || "Venda de mercadoria", additionalInfo: invoice!.additional_info,
      indPres: invoice!.ind_pres === "9" ? "9" : "1", finalConsumer: invoice!.final_consumer,
    });

    const cert = loadPfx(tenant!.nfce_cert_path!, tenant!.nfce_cert_password!);
    const signedWithDecl = await assinarNfceAsync(xml, chaveAcesso, cert);
    const signedXml = signedWithDecl.replace(/^<\?xml[^?]*\?>/, ""); // declaração XML não pode ir dentro do envelope SOAP
    const environment = tenant!.nfce_environment === "producao" ? "producao" : "homologacao";

    const soapBody =
      `<nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4">` +
      `<enviNFe versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe"><idLote>${Date.now()}</idLote><indSinc>1</indSinc>${signedXml}</enviNFe>` +
      `</nfeDadosMsg>`;

    const result = await callSefazSoap({
      model: "nfe", environment, service: "autorizacao", soapBody,
      pfxPath: tenant!.nfce_cert_path!, pfxPassword: tenant!.nfce_cert_password!, timeoutMs: env.nfceTimeoutMs,
    });
    if (!result.ok) {
      console.error(`[emitirNfe] falha SEFAZ — status=${result.statusCode} tenant=${tenant!.id} order=${orderId}`, result.error || result.rawResponse?.slice(0, 600) || "(sem corpo)");
      throw new Error(result.error || `Falha na comunicação com a SEFAZ (HTTP ${result.statusCode})`);
    }

    const cStat = extractProtTag(result.rawResponse, "cStat");
    const xMotivo = extractProtTag(result.rawResponse, "xMotivo");
    const nProt = extractProtTag(result.rawResponse, "nProt");
    const monthDir = `${order!.created_at.getFullYear()}${String(order!.created_at.getMonth() + 1).padStart(2, "0")}`;

    // 100 = autorizada; 150 = autorizada fora do prazo
    if (cStat !== "100" && cStat !== "150") {
      try {
        const dir = path.join(env.nfceXmlDir, String(tenant!.id), "nfe", "rejected", monthDir);
        ensureDir(dir);
        fs.writeFileSync(path.join(dir, `${chaveAcesso}-rejected.xml`), signedWithDecl, "utf-8");
      } catch (e) { console.error("[emitirNfe] não salvou o XML rejeitado:", e); }
      await prisma.nfeInvoice.update({
        where: { id: invoice!.id },
        data: { status: "rejected", rejection_code: cStat ?? "sem-retorno", rejection_reason: xMotivo ?? "SEFAZ não retornou motivo" },
      });
      return xMotivo;
    }

    // XML de distribuição: nfeProc = NF-e assinada + protocolo de autorização
    const protXml = /<protNFe[\s\S]*?<\/protNFe>/i.exec(result.rawResponse)?.[0] ?? "";
    const nfeProc = protXml
      ? `<?xml version="1.0" encoding="UTF-8"?><nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">${signedXml}${protXml}</nfeProc>`
      : signedWithDecl;
    const dir = path.join(env.nfceXmlDir, String(tenant!.id), "nfe", monthDir);
    ensureDir(dir);
    const xmlPath = path.join(dir, `${chaveAcesso}-nfe.xml`);
    fs.writeFileSync(xmlPath, nfeProc, "utf-8");

    const a = recipient.address;
    const t = tenant!;
    const emittedAt = new Date();
    // logo_url é um path relativo tipo "/uploads/logos/<tenant>/<arquivo>" dentro de public/
    let logoBuffer: Buffer | null = null;
    if (t.logo_url?.startsWith("/uploads/")) {
      try { logoBuffer = fs.readFileSync(path.join(process.cwd(), "public", t.logo_url)); } catch { /* sem logo */ }
    }
    const danfeInput: NfeDanfeInput = {
      environment: environment === "producao" ? "producao" : "homologacao",
      chaveAcesso, numero: invoice!.number, serie: invoice!.series,
      natureza: invoice!.nature || "Venda de mercadoria", protocolo: nProt, emittedAt,
      emit: {
        name: t.razao_social || t.name, document: t.document ?? "", ie: t.inscricao_estadual,
        address: [t.address_street, t.address_number, t.address_district, t.address_city && t.address_state ? `${t.address_city}/${t.address_state}` : "", t.address_zip ? `CEP ${t.address_zip}` : ""].filter(Boolean).join(" - "),
        phone: t.whatsapp,
      },
      dest: {
        name: recipient.name, document: recipient.document, ie: recipient.ie_indicator === "1" ? (recipient.ie ?? null) : null,
        address: [a.street, a.number, a.complement, a.district, `${a.city}/${a.state}`, a.zip ? `CEP ${a.zip}` : ""].filter(Boolean).join(" - "),
        email: recipient.email, phone: recipient.phone,
      },
      items: itemsForXml.map((it) => ({
        code: it.product.sku || String(it.product.id || it.id), name: it.product.name, ncm: String(it.product.ncm ?? "").replace(/\D/g, "").padEnd(8, "0").slice(0, 8),
        cfop: cfopForDestination(it.product.cfop, a.state.toUpperCase() === (t.address_state || "SP").toUpperCase() ? 1 : 2),
        unit: it.product.unidade_comercial, quantity: it.quantity, unitPrice: Number(it.unit_price), total: Math.round(Number(it.unit_price) * it.quantity * 100) / 100,
      })),
      totals: {
        products: itemsForXml.reduce((s, it) => s + Math.round(Number(it.unit_price) * it.quantity * 100) / 100, 0),
        freight: Number(freight.value) || 0, discount: Number(order!.discount_amount ?? 0),
        other: Math.max(0, Math.round((Number(order!.total_amount) - (itemsForXml.reduce((s, it) => s + Math.round(Number(it.unit_price) * it.quantity * 100) / 100, 0) - Number(order!.discount_amount ?? 0))) * 100) / 100),
        total: totalNota,
      },
      freightLabel: FREIGHT_LABELS[freight.mode] ?? freight.mode,
      carrierLabel: freight.carrier?.name ?? null,
      paymentSummary: payments.map((p) => `${({ money: "Dinheiro", pix: "PIX", debit: "Débito", credit: "Crédito", crediario: "Crediário", boleto: "Boleto" } as Record<string, string>)[p.method] ?? p.method}: R$ ${p.amount.toFixed(2)}`).join(" + "),
      additionalInfo: invoice!.additional_info,
      logoBuffer,
    };
    const danfePath = path.join(dir, `${chaveAcesso}-danfe.pdf`);
    fs.writeFileSync(danfePath, await generateNfeDanfePdf(danfeInput));

    await prisma.nfeInvoice.update({
      where: { id: invoice!.id },
      data: { status: "authorized", access_key: chaveAcesso, protocol: nProt, authorized_at: emittedAt, xml_path: xmlPath, danfe_path: danfePath, rejection_code: null, rejection_reason: null },
    });
    return null;
  }

  try {
    const xMotivo = await attempt(false);
    if (xMotivo && isGtinPrefixRejection(xMotivo)) {
      console.warn(`[emitirNfe] retry sem GTIN — tenant=${tenant.id} order=${orderId}`);
      await attempt(true);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[emitirNfe] erro — tenant=${tenant.id} order=${orderId}:`, err);
    await prisma.nfeInvoice.update({ where: { id: invoice.id }, data: { status: "error", rejection_reason: message } });
  }
}

export interface CancelarNfeResult { success: boolean; error?: string }

export async function cancelarNfe(orderId: number, justificativa: string): Promise<CancelarNfeResult> {
  const invoice = await prisma.nfeInvoice.findUnique({ where: { order_id: orderId } });
  if (!invoice) return { success: false, error: "NF-e não encontrada para este pedido" };
  if (invoice.status !== "authorized") return { success: false, error: "Somente notas autorizadas podem ser canceladas" };
  if (!invoice.access_key || !invoice.protocol) return { success: false, error: "Nota sem chave de acesso ou protocolo de autorização" };
  if (justificativa.trim().length < 15) return { success: false, error: "A justificativa deve ter ao menos 15 caracteres" };
  if (invoice.authorized_at) {
    const horas = (Date.now() - invoice.authorized_at.getTime()) / 3_600_000;
    if (horas > PRAZO_CANCELAMENTO_NFE_HORAS) {
      return { success: false, error: `Prazo de cancelamento (${PRAZO_CANCELAMENTO_NFE_HORAS} h) expirado. Fora do prazo, o cancelamento é feito direto na SEFAZ.` };
    }
  }

  const tenant = await fiscalTenant(invoice.tenant_id, invoice.issuer_id);
  if (!tenant) return { success: false, error: "Loja não encontrada" };
  tenant.nfce_cert_password = decryptSecret(tenant.nfce_cert_password);
  if (!tenant.nfce_cert_path || !tenant.nfce_cert_password) return { success: false, error: "Certificado digital A1 não configurado para este CNPJ" };

  try {
    const environment = tenant.nfce_environment === "producao" ? "producao" : "homologacao";
    const { xml, idEvento } = buildCancelamentoXml({
      uf: tenant.address_state || "SP", chaveAcesso: invoice.access_key, cnpj: tenant.document || "", environment,
      protocoloAutorizacao: invoice.protocol, justificativa,
    });
    const cert = loadPfx(tenant.nfce_cert_path, tenant.nfce_cert_password);
    const signedWithDecl = await assinarEventoAsync(xml, idEvento, cert);
    const signedXml = signedWithDecl.replace(/^<\?xml[^?]*\?>/, "");
    const soapBody =
      `<nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeRecepcaoEvento4">` +
      `<envEvento xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.00"><idLote>${Date.now()}</idLote>${signedXml}</envEvento></nfeDadosMsg>`;
    const result = await callSefazSoap({
      model: "nfe", environment, service: "recepcaoEvento", soapBody,
      pfxPath: tenant.nfce_cert_path, pfxPassword: tenant.nfce_cert_password, timeoutMs: env.nfceTimeoutMs,
    });
    if (!result.ok) return { success: false, error: result.error || `Falha na comunicação com a SEFAZ (HTTP ${result.statusCode})` };

    const infEvento = /<infEvento[^>]*>([\s\S]*?)<\/infEvento>/i.exec(result.rawResponse)?.[1] ?? "";
    const cStat = infEvento ? extractTag(infEvento, "cStat") : extractTag(result.rawResponse, "cStat");
    const xMotivo = infEvento ? extractTag(infEvento, "xMotivo") : extractTag(result.rawResponse, "xMotivo");
    const nProt = infEvento ? extractTag(infEvento, "nProt") : extractTag(result.rawResponse, "nProt");
    // 135/136 = evento registrado; 155 = homologado fora do prazo; 573/218 = a SEFAZ já tem o cancelamento
    if (!["135", "136", "155", "573", "218"].includes(cStat ?? "")) {
      return { success: false, error: `${xMotivo ?? "A SEFAZ rejeitou o cancelamento"} (cStat ${cStat ?? "?"})` };
    }

    const d = invoice.authorized_at ?? new Date();
    const dir = path.join(env.nfceXmlDir, String(tenant.id), "nfe", `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`);
    ensureDir(dir);
    const cancelPath = path.join(dir, `${invoice.access_key}-cancelamento.xml`);
    fs.writeFileSync(cancelPath, signedWithDecl, "utf-8");
    await prisma.nfeInvoice.update({
      where: { id: invoice.id },
      data: { status: "cancelled", cancel_protocol: nProt, cancel_reason: justificativa, cancelled_at: new Date(), cancel_xml_path: cancelPath },
    });
    emitToTenant(invoice.tenant_id, "nfe:changed", { orderId });
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}
