import https from "https";
import tls from "tls";
import axios from "axios";

import { loadPfx } from "./signer";
import { ICP_BRASIL_ROOT_CA } from "./icpBrasilCa";

// URLs dos webservices NFC-e da SEFAZ-SP (versão 4.00)
const URLS = {
  homologacao: {
    autorizacao: "https://homologacao.nfce.fazenda.sp.gov.br/ws/NFeAutorizacao4.asmx",
    retAutorizacao: "https://homologacao.nfce.fazenda.sp.gov.br/ws/NFeRetAutorizacao4.asmx",
    consultaProtocolo: "https://homologacao.nfce.fazenda.sp.gov.br/ws/NFeConsultaProtocolo4.asmx",
    statusServico: "https://homologacao.nfce.fazenda.sp.gov.br/ws/NFeStatusServico4.asmx",
    recepcaoEvento: "https://homologacao.nfce.fazenda.sp.gov.br/ws/NFeRecepcaoEvento4.asmx",
  },
  producao: {
    autorizacao: "https://nfce.fazenda.sp.gov.br/ws/NFeAutorizacao4.asmx",
    retAutorizacao: "https://nfce.fazenda.sp.gov.br/ws/NFeRetAutorizacao4.asmx",
    consultaProtocolo: "https://nfce.fazenda.sp.gov.br/ws/NFeConsultaProtocolo4.asmx",
    statusServico: "https://nfce.fazenda.sp.gov.br/ws/NFeStatusServico4.asmx",
    recepcaoEvento: "https://nfce.fazenda.sp.gov.br/ws/NFeRecepcaoEvento4.asmx",
  },
} as const;

export type NfceEnvironment = "homologacao" | "producao";
export type NfceService = keyof (typeof URLS)["homologacao"];

const SOAP_ACTIONS: Record<NfceService, string> = {
  autorizacao: "http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4/nfeAutorizacaoLote",
  retAutorizacao: "http://www.portalfiscal.inf.br/nfe/wsdl/NFeRetAutorizacao4/nfeRetAutorizacaoLote",
  consultaProtocolo: "http://www.portalfiscal.inf.br/nfe/wsdl/NFeConsultaProtocolo4/nfeConsultaNF",
  statusServico: "http://www.portalfiscal.inf.br/nfe/wsdl/NFeStatusServico4/nfeStatusServicoNF",
  recepcaoEvento: "http://www.portalfiscal.inf.br/nfe/wsdl/NFeRecepcaoEvento4/nfeRecepcaoEvento",
};

export interface SoapCallInput {
  environment: NfceEnvironment;
  service: NfceService;
  soapBody: string; // conteúdo interno já pronto (ex: <nfeDadosMsg>...</nfeDadosMsg>)
  pfxPath: string;
  pfxPassword: string;
  timeoutMs: number;
}

export interface SoapCallResult {
  ok: boolean;
  statusCode: number;
  rawResponse: string;
  error?: string;
}

function buildEnvelope(soapBody: string): string {
  return `<?xml version="1.0" encoding="utf-8"?>` +
    `<soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" ` +
    `xmlns:xsd="http://www.w3.org/2001/XMLSchema" ` +
    `xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">` +
    `<soap12:Body>${soapBody}</soap12:Body>` +
    `</soap12:Envelope>`;
}

export async function callSefazSoap(input: SoapCallInput): Promise<SoapCallResult> {
  const { environment, service, soapBody, pfxPath, pfxPassword, timeoutMs } = input;
  const url = URLS[environment][service];
  const envelope = buildEnvelope(soapBody);

  // Extraímos chave/cert em PEM via node-forge (em vez de passar pfx/passphrase brutos
  // ao https.Agent) porque o parser PKCS12 nativo do OpenSSL do Node rejeita alguns
  // certificados A1 emitidos com PBES2/AES-256 ("Unsupported PKCS12 PFX data"), que o
  // node-forge lê sem problema. Também envia a cadeia intermediária junto do certificado
  // do titular, exigida pela SEFAZ para validar a confiança até a raiz ICP-Brasil.
  let cert;
  try {
    cert = loadPfx(pfxPath, pfxPassword);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { ok: false, statusCode: 0, rawResponse: "", error: `Certificado inválido: ${message}` };
  }

  // A SEFAZ-SP (e outros hosts fiscais brasileiros) usa certificados TLS emitidos sob a
  // raiz ICP-Brasil, que não faz parte do bundle padrão de CAs confiáveis do Node — sem
  // incluí-la explicitamente aqui, a validação da conexão falha com "unable to get local
  // issuer certificate" mesmo com o certificado do servidor sendo legítimo.
  const httpsAgent = new https.Agent({
    key: cert.privateKeyPem,
    cert: cert.certificatePem + (cert.chainPem || ""),
    ca: [...tls.rootCertificates, ICP_BRASIL_ROOT_CA],
    rejectUnauthorized: true,
  });

  try {
    const response = await axios.post(url, envelope, {
      httpsAgent,
      timeout: timeoutMs,
      // O envelope é SOAP 1.2 (namespace soap-envelope), cuja especificação exige que a
      // action vá dentro do parâmetro "action" do Content-Type — não no header SOAPAction
      // separado (isso é convenção do SOAP 1.1). Vários endpoints ASMX .NET (como os da
      // SEFAZ) rejeitam a requisição com 403 puro do IIS, antes de chegar na aplicação,
      // quando essa combinação vem errada.
      headers: {
        "Content-Type": `application/soap+xml; charset=utf-8; action="${SOAP_ACTIONS[service]}"`,
      },
      validateStatus: () => true,
    });

    return {
      ok: response.status >= 200 && response.status < 300,
      statusCode: response.status,
      rawResponse: typeof response.data === "string" ? response.data : JSON.stringify(response.data),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, statusCode: 0, rawResponse: "", error: message };
  }
}

// Extrai o conteúdo de uma tag simples da resposta SOAP sem depender de um parser XML completo
export function extractTag(xml: string, tag: string): string | null {
  const match = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i").exec(xml);
  return match ? match[1].trim() : null;
}

// O retorno de autorização traz cStat/xMotivo em DOIS níveis: o do lote (retEnviNFe,
// ex. 104 "Lote processado") e o da nota em si, dentro de infProt (ex. 100 autorizado,
// ou uma rejeição como 394/703). extractTag() sozinho pega sempre a primeira ocorrência
// no XML, que é a do lote — mascarando o motivo real de rejeição da nota. Aqui isolamos
// o bloco infProt antes de buscar a tag, então pegamos o cStat/xMotivo/nProt corretos.
export function extractProtTag(xml: string, tag: string): string | null {
  const protMatch = /<infProt[^>]*>([\s\S]*?)<\/infProt>/i.exec(xml);
  if (!protMatch) return extractTag(xml, tag);
  return extractTag(protMatch[1], tag);
}
