import { create } from "xmlbuilder2";

function onlyDigits(v: string | null | undefined): string {
  return (v ?? "").replace(/\D/g, "");
}

// Mesma lógica de formatDateTimeWithOffset em dpsXmlBuilder.ts — hora LOCAL com offset
// explícito, o layout nacional rejeita UTC puro com sufixo "Z" apesar do nome do tipo.
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
  const offH = pad(Math.floor(absMin / 60));
  const offM = pad(absMin % 60);

  return `${y}-${mo}-${d}T${h}:${mi}:${s}${sign}${offH}:${offM}`;
}

// tpEvento e101101 = Cancelamento de NFS-e (Anexo II — Leiautes RN Eventos SNNFSe)
const TP_EVENTO_CANCELAMENTO = "e101101";

export type MotivoCancelamentoNfse = "1" | "2" | "9"; // 1=erro na emissão, 2=serviço não prestado, 9=outros

export interface BuildCancelamentoNfseInput {
  chaveAcesso: string; // chave de acesso da NFS-e a cancelar (50 dígitos)
  cnpj?: string;
  cpf?: string;
  nSeqEvento?: number; // sequência do evento pra essa chave, default 1
  cMotivo: MotivoCancelamentoNfse;
  xMotivo: string; // justificativa, 15-255 caracteres
  environment: "homologacao" | "producao";
}

export interface BuildCancelamentoNfseResult {
  xml: string;
  idEvento: string;
}

// Monta o XML do "Pedido de Registro de Evento" (infPedReg) para cancelamento de NFS-e —
// mesmo modelo genérico de eventos do Sistema Nacional NFS-e (POST /nfse/{chave}/eventos),
// análogo ao envEvento da NFC-e mas com layout próprio (infPedReg/e101101).
export function buildCancelamentoNfseXml(input: BuildCancelamentoNfseInput): BuildCancelamentoNfseResult {
  const { chaveAcesso, cnpj, cpf, cMotivo, xMotivo, environment } = input;
  const nSeqEvento = input.nSeqEvento ?? 1;

  const justificativa = xMotivo.trim().slice(0, 255);
  if (justificativa.length < 15) {
    throw new Error("Justificativa de cancelamento deve ter ao menos 15 caracteres");
  }

  const cnpjDigits = onlyDigits(cnpj);
  const cpfDigits = onlyDigits(cpf);
  const isCnpj = cnpjDigits.length > 0;

  // Id do evento: "e101101" + chave de acesso (50) + sequência (2), mesmo padrão de
  // idDPS/idEvento — identificador único referenciado pela assinatura digital.
  const idEvento = `${TP_EVENTO_CANCELAMENTO}${chaveAcesso}${String(nSeqEvento).padStart(2, "0")}`;

  const dhEvento = formatDateTimeWithOffset(new Date());

  const doc = create({ version: "1.0", encoding: "UTF-8" })
    .ele("pedRegEvento", { xmlns: "http://www.sped.fazenda.gov.br/nfse" });
  const infPedReg = doc.ele("infPedReg", { Id: idEvento, versao: "1.00" });

  infPedReg.ele("tpAmb").txt(environment === "producao" ? "1" : "2");
  infPedReg.ele("verAplic").txt("1.0.0");
  infPedReg.ele("dhEvento").txt(dhEvento);
  infPedReg.ele("CNPJ_CPF_autor").txt(isCnpj ? cnpjDigits : cpfDigits);
  infPedReg.ele("chNFSe").txt(chaveAcesso);
  infPedReg.ele("nPedRegEvento").txt(String(nSeqEvento));

  const e101101 = infPedReg.ele("e101101");
  e101101.ele("xDesc").txt("Cancelamento de NFS-e");
  e101101.ele("cMotivo").txt(cMotivo);
  e101101.ele("xMotivo").txt(justificativa);

  return { xml: doc.end({ prettyPrint: false }), idEvento };
}
