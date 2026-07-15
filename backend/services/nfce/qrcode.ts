import crypto from "crypto";
import QRCode from "qrcode";

const QR_HOSTS: Record<"homologacao" | "producao", string> = {
  homologacao: "https://www.homologacao.nfce.fazenda.sp.gov.br/qrcode",
  producao: "https://www.nfce.fazenda.sp.gov.br/qrcode",
};

export interface QrCodeInput {
  chaveAcesso: string;
  environment: "homologacao" | "producao";
  cscId: string;
  cscToken: string;
  versaoQRCode?: string; // "2"
}

// Monta a URL de consulta do QR Code da NFC-e e calcula o hash de segurança (SHA-1)
export function buildQrCodeUrl(input: QrCodeInput): string {
  const { chaveAcesso, environment, cscId, cscToken, versaoQRCode = "2" } = input;
  const tpAmb = environment === "producao" ? "1" : "2";

  const params = `${chaveAcesso}|${versaoQRCode}|${tpAmb}|${cscId}`;
  const hash = crypto.createHash("sha1").update(`${params}${cscToken}`).digest("hex");

  return `${QR_HOSTS[environment]}?p=${params}|${hash}`;
}

export async function generateQrCodePng(qrCodeUrl: string): Promise<Buffer> {
  return QRCode.toBuffer(qrCodeUrl, { width: 200, margin: 1 });
}
