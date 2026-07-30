import { create } from "xmlbuilder2";
import type { ServiceOrder, Tenant } from "@prisma/client";

import { gerarIdDPS } from "./dpsId";

// Campos mínimos obrigatórios do layout nacional da DPS (AnexoI-SEFIN_ADN-DPS_NFSe-SNNFSe).
// Grupos opcionais fora do escopo de venda comum (comExt, obra, intermediário, deduções) não
// são emitidos — servem só para cenários que a loja não usa (exportação de serviço, construção civil, etc).

export interface BuildDpsInput {
  tenant: Tenant;
  serviceOrder: ServiceOrder;
  serie: number;
  numero: number;
  // Alíquota do ISS (%) para o código de serviço, já resolvida via API de parâmetros municipais
  // (ou informada manualmente se o município não estiver parametrizado no Sistema Nacional).
  aliquotaIss: number;
  codigoTributacaoNacional: string; // subitem da lista de serviços (LC 116/03), ex: "1401" = 14.01
  descricaoServico: string;
  valorServico: number;
}

export interface BuildDpsResult {
  idDPS: string;
  xml: string; // XML não assinado, pronto para assinatura
}

function onlyDigits(v: string | null | undefined): string {
  return (v ?? "").replace(/\D/g, "");
}

export function buildDpsXml(input: BuildDpsInput): BuildDpsResult {
  const { tenant, serviceOrder, serie, numero, aliquotaIss, codigoTributacaoNacional, descricaoServico, valorServico } = input;

  if (!tenant.nfse_codigo_municipio) {
    throw new Error("Código do município (IBGE) não configurado para esta loja (Configurações > Dados Fiscais)");
  }
  const cnpjDigits = onlyDigits(tenant.document);
  const isCnpj = cnpjDigits.length > 11;

  const { id: idDPS } = gerarIdDPS({
    codigoMunicipio: tenant.nfse_codigo_municipio,
    cnpj: isCnpj ? cnpjDigits : undefined,
    cpf: isCnpj ? undefined : cnpjDigits,
    serie,
    numero,
  });

  const now = new Date();
  const dhEmi = now.toISOString().replace(/\.\d{3}Z$/, "Z");
  const dCompet = now.toISOString().slice(0, 10);

  const doc = create({ version: "1.0", encoding: "UTF-8" }).ele("DPS", { xmlns: "http://www.sped.fazenda.gov.br/nfse" });
  const infDPS = doc.ele("infDPS", { Id: idDPS, versao: "1.00" });

  infDPS.ele("tpAmb").txt(tenant.nfse_environment === "producao" ? "1" : "2");
  infDPS.ele("dhEmi").txt(dhEmi);
  infDPS.ele("verAplic").txt("1.0.0");
  infDPS.ele("serie").txt(String(serie).padStart(5, "0"));
  infDPS.ele("nDPS").txt(String(numero));
  infDPS.ele("dCompet").txt(dCompet);
  infDPS.ele("tpEmit").txt("1"); // 1 = prestador do serviço
  infDPS.ele("cLocEmi").txt(onlyDigits(tenant.nfse_codigo_municipio));

  const prest = infDPS.ele("prest");
  if (isCnpj) prest.ele("CNPJ").txt(cnpjDigits);
  else prest.ele("CPF").txt(cnpjDigits);
  if (tenant.nfse_inscricao_municipal) prest.ele("IM").txt(tenant.nfse_inscricao_municipal);
  prest.ele("xNome").txt(tenant.razao_social || tenant.name);

  if (tenant.address_street) {
    const end = prest.ele("end");
    const endNac = end.ele("endNac");
    endNac.ele("cMun").txt(onlyDigits(tenant.nfse_codigo_municipio));
    endNac.ele("CEP").txt(onlyDigits(tenant.address_zip).padStart(8, "0"));
    end.ele("xLgr").txt(tenant.address_street);
    end.ele("nro").txt(tenant.address_number || "S/N");
    if (tenant.address_complement) end.ele("xCpl").txt(tenant.address_complement);
    end.ele("xBairro").txt(tenant.address_district || "");
  }
  if (tenant.whatsapp) prest.ele("fone").txt(onlyDigits(tenant.whatsapp));

  const regTrib = prest.ele("regTrib");
  // opSimpNac: 1 Não Optante | 2 MEI | 3 ME/EPP — deriva do tax_regime já cadastrado para a NFC-e
  const opSimpNac = tenant.tax_regime === "simples_nacional" ? 3 : 1;
  regTrib.ele("opSimpNac").txt(String(opSimpNac));
  regTrib.ele("regEspTrib").txt("0"); // 0 = Nenhum regime especial

  if (serviceOrder.customer_id || serviceOrder.customer_name) {
    const toma = infDPS.ele("toma");
    // Sem CPF/CNPJ do cliente cadastrado, a DPS pode ser emitida sem o grupo <toma> (0-1) —
    // aqui só preenchemos xNome quando não há documento, o que a maioria dos municípios aceita
    // para NFS-e de consumidor final não identificado fiscalmente.
    toma.ele("xNome").txt(serviceOrder.customer_name || "Consumidor Final");
  }

  const serv = infDPS.ele("serv");
  const locPrest = serv.ele("locPrest");
  locPrest.ele("cLocPrestacao").txt(onlyDigits(tenant.nfse_codigo_municipio));
  const cServ = serv.ele("cServ");
  cServ.ele("cTribNac").txt(codigoTributacaoNacional);
  cServ.ele("xDescServ").txt(descricaoServico.slice(0, 1000));

  const valores = infDPS.ele("valores");
  const vServPrest = valores.ele("vServPrest");
  vServPrest.ele("vServ").txt(valorServico.toFixed(2));

  const trib = valores.ele("trib");
  const tribMun = trib.ele("tribMun");
  tribMun.ele("tribISSQN").txt("1"); // 1 = Operação tributável
  tribMun.ele("tpRetISSQN").txt("1"); // 1 = Não retido
  tribMun.ele("pAliq").txt(aliquotaIss.toFixed(2));

  return { idDPS, xml: doc.up().end() };
}
