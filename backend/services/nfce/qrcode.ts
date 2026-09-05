import QRCode from "qrcode";

// URL de consulta por QR Code é um endpoint ESPECÍFICO, diferente da URL de consulta
// manual por chave digitada — a SEFAZ-SP separa os dois (ver /NFCeConsultaPublica/...
// no portal). Manter aqui em vez de reaproveitar a URL de consulta manual evita
// confundir os dois endpoints se algum dia divergirem.
const QR_HOSTS: Record<"homologacao" | "producao", string> = {
  homologacao: "https://www.homologacao.nfce.fazenda.sp.gov.br/NFCeConsultaPublica/Paginas/ConsultaQRCode.aspx",
  producao: "https://www.nfce.fazenda.sp.gov.br/NFCeConsultaPublica/Paginas/ConsultaQRCode.aspx",
};

// URL de consulta por chave digitada manualmente (tag urlChave do infNFeSupl) — endpoint
// diferente do de consulta por QR Code acima, a SEFAZ-SP separa os dois.
const URL_CHAVE_HOSTS: Record<"homologacao" | "producao", string> = {
  homologacao: "https://www.homologacao.nfce.fazenda.sp.gov.br/consulta",
  producao: "https://www.nfce.fazenda.sp.gov.br/consulta",
};

export function buildUrlChave(environment: "homologacao" | "producao"): string {
  return URL_CHAVE_HOSTS[environment];
}

export interface QrCodeInput {
  chaveAcesso: string;
  environment: "homologacao" | "producao";
}

// Monta a URL de consulta do QR Code da NFC-e — formato versão 3 (NT 2025.001), que já
// substituiu a v2 (CSC + hash SHA-1, usada aqui até então) na SEFAZ-SP. A assinatura
// digital RSA que a v3 exige é só pra emissão em CONTINGÊNCIA (tpEmis=9) — como este
// projeto sempre emite em modo normal (tpEmis=1, síncrono, ver xmlBuilder.ts), o formato
// aqui é o mais simples possível: "<url>?p=<chave 44 dígitos>|3|<tpAmb>", sem CSC, sem
// hash, sem assinatura. Enviar no formato v2 antigo faz a SEFAZ rejeitar a nota na
// validação de schema (pattern do XSD só aceita "|3|", não mais "|2|...").
export function buildQrCodeUrl(input: QrCodeInput): string {
  const { chaveAcesso, environment } = input;
  const tpAmb = environment === "producao" ? "1" : "2";
  return `${QR_HOSTS[environment]}?p=${chaveAcesso}|3|${tpAmb}`;
}

export async function generateQrCodePng(qrCodeUrl: string): Promise<Buffer> {
  return QRCode.toBuffer(qrCodeUrl, { width: 200, margin: 1 });
}
