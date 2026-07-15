import fs from "fs";
import https from "https";
import axios from "axios";

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

  let pfx: Buffer;
  try {
    pfx = fs.readFileSync(pfxPath);
  } catch {
    return { ok: false, statusCode: 0, rawResponse: "", error: `Certificado não encontrado: ${pfxPath}` };
  }

  const httpsAgent = new https.Agent({
    pfx,
    passphrase: pfxPassword,
    rejectUnauthorized: true,
  });

  try {
    const response = await axios.post(url, envelope, {
      httpsAgent,
      timeout: timeoutMs,
      headers: {
        "Content-Type": "application/soap+xml; charset=utf-8",
        SOAPAction: SOAP_ACTIONS[service],
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
