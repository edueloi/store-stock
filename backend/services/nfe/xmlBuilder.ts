import { create } from "xmlbuilder2";
import type { Order, OrderItem, Product, Tenant } from "@prisma/client";

import { gerarChaveAcesso } from "../nfce/chaveAcesso";
import { onlyDigits, trimText, normalizeNcm, validGtinOrFallback, TPAG_MAP, TPAG_LABEL, type PaymentSegment } from "../nfce/xmlBuilder";

// NF-e (modelo 55): nota de MERCADORIA com destinatário identificado (venda B2B). Parte do mesmo layout 4.00 e dos mesmos
// grupos de imposto da NFC-e (xmlBuilder da NFC-e), mas com destinatário completo, frete/transporte e dados adicionais.

export interface NfeRecipient {
  document: string; // CPF ou CNPJ, só dígitos
  name: string;
  /** indicador de IE do destinatário: 1 = contribuinte de ICMS, 2 = contribuinte isento, 9 = não contribuinte */
  ie_indicator: "1" | "2" | "9";
  ie?: string | null;
  email?: string | null;
  phone?: string | null;
  address: {
    street: string;
    number: string;
    complement?: string | null;
    district: string;
    city: string;
    state: string;
    zip: string;
    city_code: string; // código IBGE do município (7 dígitos)
  };
}

export type NfeFreightMode = "0" | "1" | "2" | "3" | "4" | "9";
export interface NfeFreight {
  /** 0 = por conta do remetente (CIF), 1 = do destinatário (FOB), 2 = de terceiros, 3/4 = próprio, 9 = sem transporte */
  mode: NfeFreightMode;
  value: number;
  carrier?: { document?: string | null; name?: string | null; ie?: string | null; address?: string | null; city?: string | null; state?: string | null } | null;
}

export interface BuildNfeInput {
  tenant: Tenant;
  order: Order;
  items: (OrderItem & { product: Product })[];
  payments: PaymentSegment[];
  numero: number;
  serie: number;
  recipient: NfeRecipient;
  freight: NfeFreight;
  natureOfOperation: string;
  additionalInfo?: string | null;
  indPres: "1" | "9";
  finalConsumer: boolean;
}

export interface BuildNfeResult {
  chaveAcesso: string;
  xml: string; // não assinado
  totalNota: number; // vNF
}

const HOMOLOG_DEST_NAME = "NF-E EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL";

const r2 = (n: number) => Math.round(n * 100) / 100;

/** CFOP de saída: 5xxx dentro do estado, 6xxx para outro estado. */
export function cfopForDestination(cfop: string | null | undefined, idDest: 1 | 2): string {
  const base = /^\d{4}$/.test(String(cfop ?? "")) ? String(cfop) : "5102";
  if (idDest === 2 && base.startsWith("5")) return `6${base.slice(1)}`;
  if (idDest === 1 && base.startsWith("6")) return `5${base.slice(1)}`;
  return base;
}

export function buildNfeXml(input: BuildNfeInput): BuildNfeResult {
  const { tenant, order, items, numero, serie, recipient, freight, natureOfOperation, additionalInfo, indPres, finalConsumer } = input;
  const isHomologacao = tenant.nfce_environment !== "producao"; // mesmo ambiente por CNPJ da NFC-e
  const emitterUf = (tenant.address_state || "SP").toUpperCase();
  const idDest: 1 | 2 = recipient.address.state.toUpperCase() === emitterUf ? 1 : 2;

  const now = new Date();
  const chaveAcesso = gerarChaveAcesso({
    uf: emitterUf,
    emissaoAno: now.getFullYear(),
    emissaoMes: now.getMonth() + 1,
    cnpj: tenant.document || "",
    serie,
    numero,
    mod: "55",
  });

  // horário de São Paulo (UTC-3), igual à NFC-e: toISOString() é UTC e deixaria o dhEmi 3h no futuro (cStat 703)
  const dhEmi = new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString().replace(/\.\d{3}Z$/, "-03:00");

  const doc = create({ version: "1.0", encoding: "UTF-8" })
    .ele("NFe", { xmlns: "http://www.portalfiscal.inf.br/nfe" })
    .ele("infNFe", { Id: `NFe${chaveAcesso}`, versao: "4.00" });

  // ── ide ──
  const ide = doc.ele("ide");
  ide.ele("cUF").txt(chaveAcesso.slice(0, 2));
  ide.ele("cNF").txt(chaveAcesso.slice(35, 43));
  ide.ele("natOp").txt(trimText(natureOfOperation).slice(0, 60) || "Venda de mercadoria");
  ide.ele("mod").txt("55");
  ide.ele("serie").txt(String(serie));
  ide.ele("nNF").txt(String(numero));
  ide.ele("dhEmi").txt(dhEmi);
  ide.ele("tpNF").txt("1"); // saída
  ide.ele("idDest").txt(String(idDest));
  const codigoMunicipio = tenant.nfse_codigo_municipio || "3550308";
  ide.ele("cMunFG").txt(codigoMunicipio);
  ide.ele("tpImp").txt("1"); // DANFE retrato
  ide.ele("tpEmis").txt("1");
  ide.ele("cDV").txt(chaveAcesso.slice(-1));
  ide.ele("tpAmb").txt(isHomologacao ? "2" : "1");
  ide.ele("finNFe").txt("1");
  ide.ele("indFinal").txt(finalConsumer ? "1" : "0");
  ide.ele("indPres").txt(indPres);
  if (indPres !== "1") ide.ele("indIntermed").txt("0"); // operação sem intermediador (obrigatório quando não é presencial)
  ide.ele("procEmi").txt("0");
  ide.ele("verProc").txt("nexus-erp-1.0");

  // ── emit ──
  const emit = doc.ele("emit");
  emit.ele("CNPJ").txt(onlyDigits(tenant.document));
  emit.ele("xNome").txt(trimText(tenant.razao_social || tenant.name));
  if (tenant.name && tenant.name !== tenant.razao_social) emit.ele("xFant").txt(trimText(tenant.name));
  const enderEmit = emit.ele("enderEmit");
  enderEmit.ele("xLgr").txt(trimText(tenant.address_street) || "Não informado");
  enderEmit.ele("nro").txt(trimText(tenant.address_number) || "S/N");
  if (tenant.address_complement) enderEmit.ele("xCpl").txt(trimText(tenant.address_complement));
  enderEmit.ele("xBairro").txt(trimText(tenant.address_district) || "Não informado");
  enderEmit.ele("cMun").txt(codigoMunicipio);
  enderEmit.ele("xMun").txt(trimText(tenant.address_city) || "Não informado");
  enderEmit.ele("UF").txt(emitterUf);
  enderEmit.ele("CEP").txt(onlyDigits(tenant.address_zip));
  enderEmit.ele("cPais").txt("1058");
  enderEmit.ele("xPais").txt("Brasil");
  if (tenant.inscricao_estadual) emit.ele("IE").txt(onlyDigits(tenant.inscricao_estadual));
  emit.ele("CRT").txt(String(tenant.crt));

  // ── dest (obrigatório na NF-e) ──
  const dest = doc.ele("dest");
  const destDigits = onlyDigits(recipient.document);
  if (destDigits.length === 14) dest.ele("CNPJ").txt(destDigits);
  else dest.ele("CPF").txt(destDigits);
  // em homologação a SEFAZ exige este texto fixo como nome do destinatário
  dest.ele("xNome").txt(isHomologacao ? HOMOLOG_DEST_NAME : trimText(recipient.name).slice(0, 60));
  const a = recipient.address;
  const enderDest = dest.ele("enderDest");
  enderDest.ele("xLgr").txt(trimText(a.street));
  enderDest.ele("nro").txt(trimText(a.number) || "S/N");
  if (a.complement && trimText(a.complement)) enderDest.ele("xCpl").txt(trimText(a.complement));
  enderDest.ele("xBairro").txt(trimText(a.district));
  enderDest.ele("cMun").txt(onlyDigits(a.city_code));
  enderDest.ele("xMun").txt(trimText(a.city));
  enderDest.ele("UF").txt(a.state.toUpperCase());
  enderDest.ele("CEP").txt(onlyDigits(a.zip));
  enderDest.ele("cPais").txt("1058");
  enderDest.ele("xPais").txt("Brasil");
  const phone = onlyDigits(recipient.phone);
  if (phone.length >= 6 && phone.length <= 14) enderDest.ele("fone").txt(phone);
  dest.ele("indIEDest").txt(recipient.ie_indicator);
  if (recipient.ie_indicator === "1" && onlyDigits(recipient.ie)) dest.ele("IE").txt(onlyDigits(recipient.ie));
  if (recipient.email && trimText(recipient.email)) dest.ele("email").txt(trimText(recipient.email).slice(0, 60));

  // ── det ──
  const freightValue = Math.max(0, r2(Number(freight.value) || 0));
  const vProdBruto = items.reduce((sum, item) => sum + r2(Number(item.unit_price) * item.quantity), 0);
  const vDescTotal = order.discount_amount ? Number(order.discount_amount) : 0;
  const vOutroTotal = Math.max(0, r2(Number(order.total_amount) - (vProdBruto - vDescTotal)));
  let vProdTotal = 0;
  let vOutroAcum = 0;
  let vFreteAcum = 0;
  const ibsCbs = { vBC: 0, vIBSUF: 0, vCBS: 0 };
  const isSimples = tenant.tax_regime === "simples_nacional" || tenant.tax_regime === "simples_excesso";

  items.forEach((item, idx) => {
    const isLast = idx === items.length - 1;
    const vUnCom = Number(item.unit_price);
    const vProd = r2(vUnCom * item.quantity);
    vProdTotal += vProd;
    // rateio proporcional (o último item absorve o arredondamento): a SEFAZ exige soma dos itens = total (vOutro e vFrete)
    const share = vProdBruto > 0 ? vProd / vProdBruto : 0;
    const vOutroItem = vOutroTotal <= 0 ? 0 : isLast ? r2(vOutroTotal - vOutroAcum) : r2(vOutroTotal * share);
    const vFreteItem = freightValue <= 0 ? 0 : isLast ? r2(freightValue - vFreteAcum) : r2(freightValue * share);
    vOutroAcum += vOutroItem;
    vFreteAcum += vFreteItem;

    const det = doc.ele("det", { nItem: String(idx + 1) });
    const prod = det.ele("prod");
    prod.ele("cProd").txt(item.product.sku || String(item.product.id));
    const gtin = validGtinOrFallback(item.product.barcode);
    prod.ele("cEAN").txt(gtin);
    prod.ele("xProd").txt(trimText(item.product.name));
    prod.ele("NCM").txt(normalizeNcm(item.product.ncm));
    if (/^\d{7}$/.test(String(item.product.cest ?? "").trim())) prod.ele("CEST").txt(String(item.product.cest).trim());
    prod.ele("CFOP").txt(cfopForDestination(item.product.cfop, idDest));
    prod.ele("uCom").txt(item.product.unidade_comercial);
    prod.ele("qCom").txt(String(item.quantity));
    prod.ele("vUnCom").txt(vUnCom.toFixed(10));
    prod.ele("vProd").txt(vProd.toFixed(2));
    prod.ele("cEANTrib").txt(gtin);
    prod.ele("uTrib").txt(item.product.unidade_tributavel);
    prod.ele("qTrib").txt(String(item.quantity));
    prod.ele("vUnTrib").txt(vUnCom.toFixed(10));
    if (vFreteItem > 0) prod.ele("vFrete").txt(vFreteItem.toFixed(2));
    if (vOutroItem > 0) prod.ele("vOutro").txt(vOutroItem.toFixed(2));
    prod.ele("indTot").txt("1");

    const imposto = det.ele("imposto");
    const icms = imposto.ele("ICMS");
    if (isSimples) {
      const csosn = item.product.csosn || "102";
      const sn = icms.ele(`ICMSSN${csosn}`);
      sn.ele("orig").txt(String(item.product.origem));
      sn.ele("CSOSN").txt(csosn);
    } else {
      const cst = item.product.cst_icms || "00";
      const n = icms.ele(`ICMS${cst}`);
      n.ele("orig").txt(String(item.product.origem));
      n.ele("CST").txt(cst);
      if (item.product.icms_aliquota != null) {
        n.ele("modBC").txt("3");
        n.ele("vBC").txt(vProd.toFixed(2));
        n.ele("pICMS").txt(Number(item.product.icms_aliquota).toFixed(2));
        n.ele("vICMS").txt(((vProd * Number(item.product.icms_aliquota)) / 100).toFixed(2));
      }
    }
    imposto.ele("PIS").ele("PISNT").ele("CST").txt(item.product.pis_cst || "07");
    imposto.ele("COFINS").ele("COFINSNT").ele("CST").txt(item.product.cofins_cst || "07");

    // IBS/CBS (Reforma Tributária) — mesmas alíquotas de transição de 2026 usadas na NFC-e
    const pIBSUF = 0.1;
    const pCBS = 0.9;
    const vIBSUF = r2((vProd * pIBSUF) / 100);
    const vCBS = r2((vProd * pCBS) / 100);
    ibsCbs.vBC += vProd; ibsCbs.vIBSUF += vIBSUF; ibsCbs.vCBS += vCBS;
    const g = imposto.ele("IBSCBS");
    g.ele("CST").txt("000");
    g.ele("cClassTrib").txt("000001");
    const gg = g.ele("gIBSCBS");
    gg.ele("vBC").txt(vProd.toFixed(2));
    const gUF = gg.ele("gIBSUF"); gUF.ele("pIBSUF").txt(pIBSUF.toFixed(2)); gUF.ele("vIBSUF").txt(vIBSUF.toFixed(2));
    const gMun = gg.ele("gIBSMun"); gMun.ele("pIBSMun").txt("0.00"); gMun.ele("vIBSMun").txt("0.00");
    gg.ele("vIBS").txt(vIBSUF.toFixed(2));
    const gC = gg.ele("gCBS"); gC.ele("pCBS").txt(pCBS.toFixed(2)); gC.ele("vCBS").txt(vCBS.toFixed(2));
  });

  // ── total ──
  const totalNota = r2(vProdTotal - vDescTotal + freightValue + vOutroAcum);
  const total = doc.ele("total");
  const t = total.ele("ICMSTot");
  for (const tag of ["vBC", "vICMS", "vICMSDeson", "vFCP", "vBCST", "vST", "vFCPST", "vFCPSTRet"]) t.ele(tag).txt("0.00");
  t.ele("vProd").txt(vProdTotal.toFixed(2));
  t.ele("vFrete").txt(freightValue.toFixed(2));
  t.ele("vSeg").txt("0.00");
  t.ele("vDesc").txt(vDescTotal.toFixed(2));
  for (const tag of ["vII", "vIPI", "vIPIDevol", "vPIS", "vCOFINS"]) t.ele(tag).txt("0.00");
  t.ele("vOutro").txt(vOutroAcum.toFixed(2));
  t.ele("vNF").txt(totalNota.toFixed(2));

  const tot = total.ele("IBSCBSTot");
  tot.ele("vBCIBSCBS").txt(ibsCbs.vBC.toFixed(2));
  const gIBS = tot.ele("gIBS");
  const gIBSUF = gIBS.ele("gIBSUF"); gIBSUF.ele("vDif").txt("0.00"); gIBSUF.ele("vDevTrib").txt("0.00"); gIBSUF.ele("vIBSUF").txt(ibsCbs.vIBSUF.toFixed(2));
  const gIBSMun = gIBS.ele("gIBSMun"); gIBSMun.ele("vDif").txt("0.00"); gIBSMun.ele("vDevTrib").txt("0.00"); gIBSMun.ele("vIBSMun").txt("0.00");
  gIBS.ele("vIBS").txt(ibsCbs.vIBSUF.toFixed(2));
  gIBS.ele("vCredPres").txt("0.00");
  gIBS.ele("vCredPresCondSus").txt("0.00");
  const gCBS = tot.ele("gCBS");
  gCBS.ele("vDif").txt("0.00"); gCBS.ele("vDevTrib").txt("0.00"); gCBS.ele("vCBS").txt(ibsCbs.vCBS.toFixed(2));
  gCBS.ele("vCredPres").txt("0.00"); gCBS.ele("vCredPresCondSus").txt("0.00");

  // ── transp ──
  const transp = doc.ele("transp");
  transp.ele("modFrete").txt(freight.mode);
  const c = freight.carrier;
  if (freight.mode !== "9" && c && trimText(c.name)) {
    const tr = transp.ele("transporta");
    const cd = onlyDigits(c.document);
    if (cd.length === 14) tr.ele("CNPJ").txt(cd);
    else if (cd.length === 11) tr.ele("CPF").txt(cd);
    tr.ele("xNome").txt(trimText(c.name).slice(0, 60));
    if (onlyDigits(c.ie)) tr.ele("IE").txt(onlyDigits(c.ie));
    if (trimText(c.address)) tr.ele("xEnder").txt(trimText(c.address).slice(0, 60));
    if (trimText(c.city)) tr.ele("xMun").txt(trimText(c.city).slice(0, 60));
    if (trimText(c.state)) tr.ele("UF").txt(trimText(c.state).toUpperCase().slice(0, 2));
  }

  // ── pag ── (soma dos pagamentos precisa cobrir o total da nota, que pode incluir o frete)
  const payments = input.payments.length ? input.payments.map((p) => ({ ...p })) : [{ method: "money", amount: totalNota }];
  const paidSum = payments.reduce((s, p) => s + p.amount, 0);
  if (paidSum < totalNota - 0.004) payments[payments.length - 1].amount = r2(payments[payments.length - 1].amount + (totalNota - paidSum));
  const pag = doc.ele("pag");
  for (const seg of payments) {
    const tPag = TPAG_MAP[seg.method] ?? "99";
    const detPag = pag.ele("detPag");
    detPag.ele("tPag").txt(tPag);
    if (tPag === "99") detPag.ele("xPag").txt(TPAG_LABEL[seg.method] || seg.method || "Outros");
    detPag.ele("vPag").txt(r2(seg.amount).toFixed(2));
    if (tPag === "03" || tPag === "04" || tPag === "17") detPag.ele("card").ele("tpIntegra").txt("2");
  }
  const troco = r2(payments.reduce((s, p) => s + p.amount, 0) - totalNota);
  if (troco > 0) pag.ele("vTroco").txt(troco.toFixed(2));

  // ── infAdic ──
  const notes = [
    trimText(additionalInfo),
    isSimples ? "DOCUMENTO EMITIDO POR ME OU EPP OPTANTE PELO SIMPLES NACIONAL. NAO GERA DIREITO A CREDITO FISCAL DE IPI." : "",
  ].filter(Boolean).join(" | ");
  if (notes) doc.ele("infAdic").ele("infCpl").txt(notes.slice(0, 5000));

  return { chaveAcesso, xml: doc.end({ prettyPrint: false }), totalNota };
}
