import { create } from "xmlbuilder2";

// Mapa cUF (mesma tabela usada em chaveAcesso.ts)
const UF_CODES: Record<string, string> = {
  AC: "12", AL: "27", AP: "16", AM: "13", BA: "29", CE: "23", DF: "53",
  ES: "32", GO: "52", MA: "21", MT: "51", MS: "50", MG: "31", PA: "15",
  PB: "25", PR: "41", PE: "26", PI: "22", RJ: "33", RN: "24", RS: "43",
  RO: "11", RR: "14", SC: "42", SE: "28", SP: "35", TO: "17",
};

export interface EventoCancelamentoInput {
  uf: string;
  chaveAcesso: string;
  cnpj: string;
  environment: "homologacao" | "producao";
  protocoloAutorizacao: string;
  justificativa: string; // 15-255 caracteres
  nSeqEvento?: number;
}

function onlyDigits(v: string): string {
  return v.replace(/\D/g, "");
}

// Monta o XML do evento de cancelamento (tpEvento 110111), não assinado
export function buildCancelamentoXml(input: EventoCancelamentoInput): { xml: string; idEvento: string } {
  const cUF = UF_CODES[input.uf.toUpperCase()];
  if (!cUF) throw new Error(`UF desconhecida: ${input.uf}`);

  const nSeqEvento = input.nSeqEvento ?? 1;
  const tpEvento = "110111";
  const dhEvento = new Date().toISOString().replace(/\.\d{3}Z$/, "-03:00");
  const idEvento = `ID${tpEvento}${input.chaveAcesso}${String(nSeqEvento).padStart(2, "0")}`;

  const justificativa = input.justificativa.trim().slice(0, 255);
  if (justificativa.length < 15) {
    throw new Error("Justificativa de cancelamento deve ter ao menos 15 caracteres");
  }

  const doc = create({ version: "1.0", encoding: "UTF-8" })
    .ele("evento", { xmlns: "http://www.portalfiscal.inf.br/nfe", versao: "1.00" })
    .ele("infEvento", { Id: idEvento });

  doc.ele("cOrgao").txt(cUF);
  doc.ele("tpAmb").txt(input.environment === "producao" ? "1" : "2");
  doc.ele("CNPJ").txt(onlyDigits(input.cnpj));
  doc.ele("chNFe").txt(input.chaveAcesso);
  doc.ele("dhEvento").txt(dhEvento);
  doc.ele("tpEvento").txt(tpEvento);
  doc.ele("nSeqEvento").txt(String(nSeqEvento));
  doc.ele("verEvento").txt("1.00");

  const detEvento = doc.ele("detEvento", { versao: "1.00" });
  detEvento.ele("descEvento").txt("Cancelamento");
  detEvento.ele("nProt").txt(input.protocoloAutorizacao);
  detEvento.ele("xJust").txt(justificativa);

  const xml = doc.end({ prettyPrint: false });
  return { xml, idEvento };
}
