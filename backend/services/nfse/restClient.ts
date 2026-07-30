import fs from "fs";
import https from "https";
import zlib from "zlib";
import axios from "axios";

// Sistema Nacional NFS-e (Sefin Nacional) — comunicação REST+JSON, autenticação mTLS
// (o certificado do contribuinte identifica quem está conectando na própria camada TLS,
// diferente do padrão SOAP da NFC-e que só assina o XML por cima de HTTP comum).
const BASE_URLS = {
  homologacao: "https://adn.producaorestrita.nfse.gov.br",
  producao: "https://adn.nfse.gov.br",
} as const;

export type NfseEnvironment = "homologacao" | "producao";

export interface NfseRestCallInput {
  environment: NfseEnvironment;
  method: "GET" | "POST";
  path: string; // ex: "/contribuintes/nfse"
  body?: unknown; // objeto JSON; se presente, é enviado como { "dpsXmlGZipB64": "<gzip+base64>" }
  pfxPath: string;
  pfxPassword: string;
  timeoutMs: number;
}

export interface NfseRestCallResult {
  ok: boolean;
  statusCode: number;
  data: Record<string, unknown> | null;
  raw: string;
  error?: string;
}

// Compacta o XML da DPS em GZip e codifica em base64, formato exigido pelo corpo da mensagem
// (reduz o tamanho do payload trafegado, conforme o manual de integração do Sistema Nacional).
export function gzipBase64(xml: string): string {
  return zlib.gzipSync(Buffer.from(xml, "utf-8")).toString("base64");
}

export function ungzipBase64(gzipB64: string): string {
  return zlib.gunzipSync(Buffer.from(gzipB64, "base64")).toString("utf-8");
}

export async function callNfseRest(input: NfseRestCallInput): Promise<NfseRestCallResult> {
  const { environment, method, path, body, pfxPath, pfxPassword, timeoutMs } = input;
  const url = `${BASE_URLS[environment]}${path}`;

  let pfx: Buffer;
  try {
    pfx = fs.readFileSync(pfxPath);
  } catch {
    return { ok: false, statusCode: 0, data: null, raw: "", error: `Certificado não encontrado: ${pfxPath}` };
  }

  // mTLS: o certificado do contribuinte autentica a própria conexão TLS (Extended Key Usage
  // "Autenticação Cliente"), exigido pelo Sistema Nacional NFS-e além da assinatura do XML.
  const httpsAgent = new https.Agent({
    pfx,
    passphrase: pfxPassword,
    rejectUnauthorized: true,
  });

  try {
    const response = await axios.request({
      url,
      method,
      data: body,
      httpsAgent,
      timeout: timeoutMs,
      headers: { "Content-Type": "application/json" },
      validateStatus: () => true,
    });

    const raw = typeof response.data === "string" ? response.data : JSON.stringify(response.data);
    return {
      ok: response.status >= 200 && response.status < 300,
      statusCode: response.status,
      data: typeof response.data === "object" ? response.data : null,
      raw,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, statusCode: 0, data: null, raw: "", error: message };
  }
}
