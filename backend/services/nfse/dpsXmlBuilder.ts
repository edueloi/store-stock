import { create } from "xmlbuilder2";
import type { ServiceOrder, Tenant } from "@prisma/client";

import { gerarIdDPS } from "./dpsId";

// Campos mínimos obrigatórios do layout nacional da DPS (AnexoI-SEFIN_ADN-DPS_NFSe-SNNFSe).
// Grupos opcionais fora do escopo de venda comum (comExt, obra, intermediário, deduções) não
// são emitidos — servem só para cenários que a loja não usa (exportação de serviço, construção civil, etc).

export interface TomadorInput {
  nome?: string | null;
  cpf?: string | null;
  cnpj?: string | null;
}

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
  tomador?: TomadorInput | null;
}

export interface BuildDpsResult {
  idDPS: string;
  xml: string; // XML não assinado, pronto para assinatura
}

function onlyDigits(v: string | null | undefined): string {
  return (v ?? "").replace(/\D/g, "");
}

// Monta "AAAA-MM-DDTHH:mm:ss±HH:mm" na hora LOCAL do processo (America/Sao_Paulo em
// produção), exigido pelo tipo TSDateTimeUTC do layout nacional — que, apesar do nome,
// rejeita timestamps em UTC puro com sufixo "Z".
function formatDateTimeWithOffset(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const y = date.getFullYear();
  const mo = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  const h = pad(date.getHours());
  const mi = pad(date.getMinutes());
  const s = pad(date.getSeconds());

  const offsetMin = -date.getTimezoneOffset();
  const sign = offsetMin >= 0 ? "+" : "-";
  const absMin = Math.abs(offsetMin);
  const offsetStr = `${sign}${pad(Math.floor(absMin / 60))}:${pad(absMin % 60)}`;

  return `${y}-${mo}-${d}T${h}:${mi}:${s}${offsetStr}`;
}

export function buildDpsXml(input: BuildDpsInput): BuildDpsResult {
  const { tenant, serie, numero, aliquotaIss, codigoTributacaoNacional, descricaoServico, valorServico, tomador } = input;

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
  // dhEmi exige data/hora LOCAL com offset de fuso explícito (ex: -03:00), não UTC
  // com "Z" — o layout nacional rejeita UTC puro apesar do nome do tipo TSDateTimeUTC.
  const dhEmi = formatDateTimeWithOffset(now);
  // dCompet precisa usar a mesma data LOCAL de dhEmi (não UTC) — perto da meia-noite,
  // a data UTC pode cair um dia à frente da local e o servidor rejeita "competência
  // posterior à emissão".
  const pad2 = (n: number) => String(n).padStart(2, "0");
  const dCompet = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;

  const doc = create({ version: "1.0", encoding: "UTF-8" }).ele("DPS", { xmlns: "http://www.sped.fazenda.gov.br/nfse", versao: "1.00" });
  const infDPS = doc.ele("infDPS", { Id: idDPS });

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
  // <IM> só pode ser enviado se o município tiver informações complementares
  // registradas no CNC NFS-e (erro E0120 do próprio servidor quando enviado sem isso) —
  // como não consultamos o CNC hoje, omitimos por padrão para não quebrar a emissão.
  // <xNome> também é omitido quando o emitente é o próprio prestador (tpEmit=1,
  // caso sempre usado aqui) — o servidor rejeita com E0121 porque o nome já vem do CNC.

  // Grupo <end> é opcional no layout nacional e exige estrutura (endNac com cMun/CEP)
  // — omitido de propósito quando os campos de endereço não estão completos, em vez
  // de enviar malformado.
  if (tenant.address_street && tenant.address_zip) {
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
  // regApTribSN é obrigatório quando opSimpNac=3 (erro E0166 do próprio servidor):
  // 1 = tributos federais e municipal apurados pelo SN (caso padrão, sem retenção/
  // substituição tributária de ISS por fora do Simples).
  if (opSimpNac === 3) regTrib.ele("regApTribSN").txt("1");
  regTrib.ele("regEspTrib").txt("0"); // 0 = Nenhum regime especial

  if (tomador && (tomador.nome || tomador.cpf || tomador.cnpj)) {
    const toma = infDPS.ele("toma");
    const tomCpf = onlyDigits(tomador.cpf);
    const tomCnpj = onlyDigits(tomador.cnpj);
    if (tomCnpj) toma.ele("CNPJ").txt(tomCnpj);
    else if (tomCpf) toma.ele("CPF").txt(tomCpf);
    toma.ele("xNome").txt(tomador.nome || "Consumidor Final");
  }

  const serv = infDPS.ele("serv");
  const locPrest = serv.ele("locPrest");
  locPrest.ele("cLocPrestacao").txt(onlyDigits(tenant.nfse_codigo_municipio));
  const cServ = serv.ele("cServ");
  cServ.ele("cTribNac").txt(String(codigoTributacaoNacional).trim());
  cServ.ele("xDescServ").txt(descricaoServico.slice(0, 1000));

  const valores = infDPS.ele("valores");
  const vServPrest = valores.ele("vServPrest");
  vServPrest.ele("vServ").txt(valorServico.toFixed(2));

  const trib = valores.ele("trib");
  const tribMun = trib.ele("tribMun");
  tribMun.ele("tribISSQN").txt("1"); // 1 = Operação tributável
  tribMun.ele("tpRetISSQN").txt("1"); // 1 = Não retido
  // pAliq não pode ser informado quando o prestador apura o ISSQN pelo próprio Simples
  // Nacional (regApTribSN=1) — o servidor calcula a alíquota pela tabela do SN (erro
  // E0625 do próprio servidor real quando enviado nesse cenário).
  if (opSimpNac !== 3) tribMun.ele("pAliq").txt(aliquotaIss.toFixed(2));

  // tribFed é opcional (sem retenção de PIS/COFINS/INSS/IRRF/CSLL) — omitido.
  // totTrib é obrigatório (XSD TCInfoTributacao). Para ME/EPP (opSimpNac=3) o servidor
  // exige pTotTribSN (percentual aprox. da alíquota do Simples Nacional) em vez de
  // indTotTrib=0 (erro E0712 do próprio servidor quando indTotTrib é usado por ME/EPP).
  if (opSimpNac === 3) {
    trib.ele("totTrib").ele("pTotTribSN").txt(aliquotaIss.toFixed(2));
  } else {
    trib.ele("totTrib").ele("indTotTrib").txt("0");
  }

  return { idDPS, xml: doc.up().end() };
}
