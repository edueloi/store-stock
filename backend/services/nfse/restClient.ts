import crypto from "crypto";
import https from "https";
import tls from "tls";
import zlib from "zlib";
import axios from "axios";

import { loadPfx, isA3Path, parseA3 } from "../nfce/signer";
import { askAgent } from "../fiscal-agent.service";
import { ICP_BRASIL_ROOT_CA } from "../nfce/icpBrasilCa";

// Sistema Nacional NFS-e — comunicação REST+JSON, autenticação mTLS (o certificado do
// contribuinte identifica quem está conectando na própria camada TLS). São dois serviços
// em hosts distintos, confirmados via os swaggers reais (não documentados de forma óbvia
// no manual em PDF): emissão de NFS-e fica no Sefin Nacional; parâmetros municipais
// (alíquota de ISS etc.) ficam no serviço de "parametrizacao" no host ADN.
const BASE_URLS = {
  // Emissão de NFS-e (POST /nfse), consulta por chave de acesso, DPS, eventos
  sefin: {
    homologacao: "https://sefin.producaorestrita.nfse.gov.br/SefinNacional",
    producao: "https://sefin.nfse.gov.br/SefinNacional",
  },
  // Parâmetros municipais (alíquota ISS, convênio, regimes especiais, retenções)
  parametrizacao: {
    homologacao: "https://adn.producaorestrita.nfse.gov.br/parametrizacao",
    producao: "https://adn.nfse.gov.br/parametrizacao",
  },
} as const;

export type NfseEnvironment = "homologacao" | "producao";
export type NfseService = "sefin" | "parametrizacao";

export interface NfseRestCallInput {
  environment: NfseEnvironment;
  method: "GET" | "POST";
  service?: NfseService; // default "sefin"
  path: string; // ex: "/nfse"
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
export function gzipBase64(xml: string): string {
  return zlib.gzipSync(Buffer.from(xml, "utf-8")).toString("base64");
}

export function ungzipBase64(gzipB64: string): string {
  return zlib.gunzipSync(Buffer.from(gzipB64, "base64")).toString("utf-8");
}

export async function callNfseRest(input: NfseRestCallInput): Promise<NfseRestCallResult> {
  const { environment, method, service = "sefin", path, body, pfxPath, pfxPassword, timeoutMs } = input;
  const url = `${BASE_URLS[service][environment]}${path}`;

  // Certificado A3: a conexão (mTLS) com o Sistema Nacional NFS-e sai do computador do token
  if (isA3Path(pfxPath)) {
    const { terminalUid, thumbprint } = parseA3(pfxPath);
    const r = await askAgent(terminalUid, "http", {
      thumbprint, url, method, body: body === undefined ? "" : JSON.stringify(body), headers: {}, contentType: "application/json",
      caDers: [new crypto.X509Certificate(ICP_BRASIL_ROOT_CA).raw.toString("base64")], timeoutSec: Math.ceil(timeoutMs / 1000),
    }, timeoutMs + 20_000);
    if (!r.ok) return { ok: false, statusCode: 0, data: null, raw: "", error: String(r.error || "Falha ao falar com o Sistema Nacional pelo app desktop.") };
    const status = Number(r.status) || 0;
    const raw = String(r.body ?? "");
    let data: unknown = null;
    try { data = JSON.parse(raw); } catch { /* resposta não é JSON */ }
    return { ok: status >= 200 && status < 300, statusCode: status, data: data && typeof data === "object" ? (data as Record<string, unknown>) : null, raw };
  }

  // mTLS: o certificado do contribuinte autentica a própria conexão TLS, exigido pelo
  // Sistema Nacional NFS-e além da assinatura do XML. Extraímos chave/cert em PEM via
  // node-forge (em vez de passar pfx/passphrase brutos ao https.Agent) porque o parser
  // PKCS12 nativo do OpenSSL do Node rejeita alguns certificados A1 emitidos com
  // PBES2/AES-256 ("Unsupported PKCS12 PFX data"), que o node-forge lê sem problema.
  let cert;
  try {
    cert = loadPfx(pfxPath, pfxPassword);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { ok: false, statusCode: 0, data: null, raw: "", error: `Certificado inválido: ${message}` };
  }

  // Envia o certificado do titular + cadeia intermediária concatenados — o servidor
  // mTLS precisa da cadeia completa para validar a confiança até a raiz ICP-Brasil.
  // Mesma raiz ICP-Brasil usada pelo cliente SOAP da NFC-e (ver soapClient.ts/icpBrasilCa.ts)
  // — alguns hosts do Sistema Nacional NFS-e também podem depender dela na cadeia TLS.
  const httpsAgent = new https.Agent({
    key: cert.privateKeyPem,
    cert: cert.certificatePem + (cert.chainPem || ""),
    ca: [...tls.rootCertificates, ICP_BRASIL_ROOT_CA],
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
