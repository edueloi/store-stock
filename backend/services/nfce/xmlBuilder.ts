import { create } from "xmlbuilder2";
import type { Order, OrderItem, Product, Tenant } from "@prisma/client";

import { gerarChaveAcesso } from "./chaveAcesso";

export interface PaymentSegment {
  method: "money" | "pix" | "debit" | "credit" | string;
  amount: number;
}

export interface BuildNfceInput {
  tenant: Tenant;
  order: Order;
  items: (OrderItem & { product: Product })[];
  payments: PaymentSegment[];
  numero: number;
  serie: number;
  customerDocument?: string; // CPF do consumidor, para Nota Fiscal Paulista
}

export interface BuildNfceResult {
  chaveAcesso: string;
  xml: string; // XML não assinado, pronto para assinatura
}

function onlyDigits(v: string | null | undefined): string {
  return (v ?? "").replace(/\D/g, "");
}

// Mapeia o token interno de forma de pagamento (usado em sales.controller.ts)
// para o código tPag exigido pelo layout da NFC-e.
const TPAG_MAP: Record<string, string> = {
  money: "01",
  pix: "17",
  debit: "04",
  credit: "03",
};

export function buildNfceXml(input: BuildNfceInput): BuildNfceResult {
  const { tenant, order, items, payments, numero, serie, customerDocument } = input;

  const now = new Date();
  const chaveAcesso = gerarChaveAcesso({
    uf: tenant.address_state || "SP",
    emissaoAno: now.getFullYear(),
    emissaoMes: now.getMonth() + 1,
    cnpj: tenant.document || "",
    serie,
    numero,
  });

  const dhEmi = now.toISOString().replace(/\.\d{3}Z$/, "-03:00");

  const doc = create({ version: "1.0", encoding: "UTF-8" })
    .ele("NFe", { xmlns: "http://www.portalfiscal.inf.br/nfe" })
    .ele("infNFe", { Id: `NFe${chaveAcesso}`, versao: "4.00" });

  // ── ide ──────────────────────────────────────────────────────────────────
  const ide = doc.ele("ide");
  ide.ele("cUF").txt(chaveAcesso.slice(0, 2));
  ide.ele("cNF").txt(chaveAcesso.slice(35, 43));
  ide.ele("natOp").txt("Venda ao consumidor");
  ide.ele("mod").txt("65");
  ide.ele("serie").txt(String(serie));
  ide.ele("nNF").txt(String(numero));
  ide.ele("dhEmi").txt(dhEmi);
  ide.ele("tpNF").txt("1"); // saída
  ide.ele("idDest").txt("1"); // operação interna
  ide.ele("cMunFG").txt("3550308"); // TODO: mapear município do tenant por IBGE
  ide.ele("tpImp").txt("4"); // DANFE NFC-e
  ide.ele("tpEmis").txt("1"); // emissão normal
  ide.ele("cDV").txt(chaveAcesso.slice(-1));
  ide.ele("tpAmb").txt(tenant.nfce_environment === "producao" ? "1" : "2");
  ide.ele("finNFe").txt("1"); // normal
  ide.ele("indFinal").txt("1"); // consumidor final
  ide.ele("indPres").txt("1"); // operação presencial
  ide.ele("procEmi").txt("0");
  ide.ele("verProc").txt("nexus-erp-1.0");

  // ── emit ─────────────────────────────────────────────────────────────────
  const emit = doc.ele("emit");
  emit.ele("CNPJ").txt(onlyDigits(tenant.document));
  emit.ele("xNome").txt(tenant.razao_social || tenant.name);
  if (tenant.name && tenant.name !== tenant.razao_social) {
    emit.ele("xFant").txt(tenant.name);
  }
  const enderEmit = emit.ele("enderEmit");
  enderEmit.ele("xLgr").txt(tenant.address_street || "");
  enderEmit.ele("nro").txt(tenant.address_number || "S/N");
  if (tenant.address_complement) enderEmit.ele("xCpl").txt(tenant.address_complement);
  enderEmit.ele("xBairro").txt(tenant.address_district || "");
  enderEmit.ele("cMun").txt("3550308"); // TODO: mapear município do tenant por IBGE
  enderEmit.ele("xMun").txt(tenant.address_city || "");
  enderEmit.ele("UF").txt(tenant.address_state || "SP");
  enderEmit.ele("CEP").txt(onlyDigits(tenant.address_zip));
  enderEmit.ele("cPais").txt("1058");
  enderEmit.ele("xPais").txt("Brasil");
  if (tenant.inscricao_estadual) emit.ele("IE").txt(onlyDigits(tenant.inscricao_estadual));
  emit.ele("CRT").txt(String(tenant.crt));

  // ── dest (opcional — Nota Fiscal Paulista) ────────────────────────────────
  if (customerDocument) {
    const digits = onlyDigits(customerDocument);
    const dest = doc.ele("dest");
    if (digits.length === 11) dest.ele("CPF").txt(digits);
    else if (digits.length === 14) dest.ele("CNPJ").txt(digits);
    dest.ele("indIEDest").txt("9"); // não contribuinte
  }

  // ── det (itens) ────────────────────────────────────────────────────────
  let vProdTotal = 0;
  items.forEach((item, idx) => {
    const nItem = idx + 1;
    const vUnCom = Number(item.unit_price);
    const vProd = Math.round(vUnCom * item.quantity * 100) / 100;
    vProdTotal += vProd;

    const det = doc.ele("det", { nItem: String(nItem) });
    const prod = det.ele("prod");
    prod.ele("cProd").txt(item.product.sku || String(item.product.id));
    prod.ele("cEAN").txt(item.product.barcode || "SEM GTIN");
    prod.ele("xProd").txt(item.product.name);
    prod.ele("NCM").txt(item.product.ncm || "00000000");
    if (item.product.cest) prod.ele("CEST").txt(item.product.cest);
    prod.ele("CFOP").txt(item.product.cfop || "5102");
    prod.ele("uCom").txt(item.product.unidade_comercial);
    prod.ele("qCom").txt(String(item.quantity));
    prod.ele("vUnCom").txt(vUnCom.toFixed(10));
    prod.ele("vProd").txt(vProd.toFixed(2));
    prod.ele("cEANTrib").txt(item.product.barcode || "SEM GTIN");
    prod.ele("uTrib").txt(item.product.unidade_tributavel);
    prod.ele("qTrib").txt(String(item.quantity));
    prod.ele("vUnTrib").txt(vUnCom.toFixed(10));
    prod.ele("indTot").txt("1");

    const imposto = det.ele("imposto");
    const icms = imposto.ele("ICMS");
    const isSimples = tenant.tax_regime === "simples_nacional" || tenant.tax_regime === "simples_excesso";
    if (isSimples) {
      const csosn = item.product.csosn || "102";
      const icmsSN = icms.ele(`ICMSSN${csosn}`);
      icmsSN.ele("orig").txt(String(item.product.origem));
      icmsSN.ele("CSOSN").txt(csosn);
    } else {
      const cst = item.product.cst_icms || "00";
      const icmsN = icms.ele(`ICMS${cst}`);
      icmsN.ele("orig").txt(String(item.product.origem));
      icmsN.ele("CST").txt(cst);
      if (item.product.icms_aliquota != null) {
        icmsN.ele("modBC").txt("3");
        icmsN.ele("vBC").txt(vProd.toFixed(2));
        icmsN.ele("pICMS").txt(Number(item.product.icms_aliquota).toFixed(2));
        icmsN.ele("vICMS").txt(((vProd * Number(item.product.icms_aliquota)) / 100).toFixed(2));
      }
    }

    const pis = imposto.ele("PIS").ele("PISNT");
    pis.ele("CST").txt(item.product.pis_cst || "07");

    const cofins = imposto.ele("COFINS").ele("COFINSNT");
    cofins.ele("CST").txt(item.product.cofins_cst || "07");
  });

  // ── total ─────────────────────────────────────────────────────────────
  const total = doc.ele("total");
  const icmsTot = total.ele("ICMSTot");
  icmsTot.ele("vBC").txt("0.00");
  icmsTot.ele("vICMS").txt("0.00");
  icmsTot.ele("vICMSDeson").txt("0.00");
  icmsTot.ele("vFCP").txt("0.00");
  icmsTot.ele("vBCST").txt("0.00");
  icmsTot.ele("vST").txt("0.00");
  icmsTot.ele("vFCPST").txt("0.00");
  icmsTot.ele("vFCPSTRet").txt("0.00");
  icmsTot.ele("vProd").txt(vProdTotal.toFixed(2));
  icmsTot.ele("vFrete").txt("0.00");
  icmsTot.ele("vSeg").txt("0.00");
  icmsTot.ele("vDesc").txt((order.discount_amount ? Number(order.discount_amount) : 0).toFixed(2));
  icmsTot.ele("vII").txt("0.00");
  icmsTot.ele("vIPI").txt("0.00");
  icmsTot.ele("vIPIDevol").txt("0.00");
  icmsTot.ele("vPIS").txt("0.00");
  icmsTot.ele("vCOFINS").txt("0.00");
  icmsTot.ele("vOutro").txt("0.00");
  icmsTot.ele("vNF").txt(Number(order.total_amount).toFixed(2));

  // ── transp ────────────────────────────────────────────────────────────
  doc.ele("transp").ele("modFrete").txt("9"); // sem frete

  // ── pag ───────────────────────────────────────────────────────────────
  const pag = doc.ele("pag");
  for (const seg of payments) {
    const detPag = pag.ele("detPag");
    detPag.ele("tPag").txt(TPAG_MAP[seg.method] ?? "99");
    detPag.ele("vPag").txt(seg.amount.toFixed(2));
  }

  const xml = doc.end({ prettyPrint: false });
  return { chaveAcesso, xml };
}
