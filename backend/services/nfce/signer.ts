import fs from "fs";
import path from "path";
import forge from "node-forge";
import { SignedXml } from "xml-crypto";

import { env } from "../../config/env";
import { askAgent } from "../fiscal-agent.service";

// Certificado A3 (token/cartão): a chave não sai do aparelho. O CNPJ fica "marcado" guardando em nfce_cert_path o texto
// "a3:<terminal>:<impressão digital>" (o resto do código só vê um caminho preenchido e segue igual). O certificado público fica
// num arquivo ao lado dos .pfx; assinar e falar com a SEFAZ passam pelo app desktop do computador com o token.
export const A3_PREFIX = "a3:";
export const isA3Path = (p: string | null | undefined): p is string => typeof p === "string" && p.startsWith(A3_PREFIX);
export function parseA3(p: string) { const [, terminalUid = "", thumbprint = ""] = p.split(":"); return { terminalUid, thumbprint: thumbprint.toUpperCase() }; }
export const a3CertFile = (thumbprint: string) => path.join(env.nfceCertsDir, `a3-${thumbprint.toUpperCase().replace(/[^A-F0-9]/g, "")}.cer`);

export interface CertMaterial {
  /** Presente só em certificado A3: quem assina é o app desktop deste terminal */
  remote?: { terminalUid: string; thumbprint: string };
  privateKeyPem: string;
  certificatePem: string;
  chainPem: string;
  titularCpf: string | null;
  titularCnpj: string | null;
}

// Extrai chave privada + certificado do titular + cadeia de certificação intermediária
// a partir dos bytes binários de um .pfx/.p12 (certificado A1). Certificados ICP-Brasil
// costumam empacotar a cadeia completa (titular + AC intermediária(s) + raiz) no mesmo
// .pfx — servidores mTLS (Sistema Nacional NFS-e) exigem receber essa cadeia junto do
// certificado do titular para conseguir validar a confiança até a raiz ICP-Brasil.
export function parsePfx(pfxDer: string, password: string): CertMaterial {
  const pfxAsn1 = forge.asn1.fromDer(pfxDer);
  const pfx = forge.pkcs12.pkcs12FromAsn1(pfxAsn1, password);

  const keyBags = pfx.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag];
  const certBags = pfx.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag];

  if (!keyBags || keyBags.length === 0) throw new Error("Certificado .pfx sem chave privada");
  if (!certBags || certBags.length === 0) throw new Error("Certificado .pfx sem certificado X.509");

  const privateKey = keyBags[0].key;
  if (!privateKey) throw new Error("Falha ao extrair chave privada do .pfx");

  const allCerts = certBags.map((b) => b.cert).filter((c): c is forge.pki.Certificate => Boolean(c));
  if (allCerts.length === 0) throw new Error("Falha ao extrair certificado do .pfx");

  // O certificado do titular é o único que não é usado como emissor de nenhum outro
  // certificado do pacote (todo mundo na cadeia, exceto a ponta, é "issuer" de alguém).
  const issuerNames = new Set(allCerts.map((c) => c.issuer.attributes.map((a) => `${a.shortName}=${a.value}`).join(",")));
  const isIssuerOfSomeone = (c: forge.pki.Certificate) => {
    const subjectName = c.subject.attributes.map((a) => `${a.shortName}=${a.value}`).join(",");
    return issuerNames.has(subjectName);
  };
  const leaf = allCerts.find((c) => !isIssuerOfSomeone(c)) || allCerts[0];
  const chain = allCerts.filter((c) => c !== leaf);

  // CPF/CNPJ do titular embutido no CN (padrão ICP-Brasil): e-CPF traz "CN=NOME:CPF"
  // (11 dígitos) e e-CNPJ (com identificação do responsável) traz "CN=NOME:CPF:CNPJ"
  // ou similar — NUNCA usamos os campos "OU" para isso, pois eles frequentemente
  // contêm o CNPJ da própria Autoridade Certificadora (AC), não o do titular.
  const cn = leaf.subject.getField("CN")?.value || "";
  const cpfMatch = cn.match(/:(\d{11})(?::|$)/);
  const cnpjMatch = cn.match(/:(\d{14})(?::|$)/);

  return {
    privateKeyPem: forge.pki.privateKeyToPem(privateKey),
    certificatePem: forge.pki.certificateToPem(leaf),
    chainPem: chain.map((c) => forge.pki.certificateToPem(c)).join("\n"),
    titularCpf: cpfMatch ? cpfMatch[1] : null,
    titularCnpj: cnpjMatch ? cnpjMatch[1] : null,
  };
}

// Extrai chave privada + certificado X.509 de um arquivo .pfx/.p12 (certificado A1) já salvo em disco
export function loadPfx(pfxPath: string, password: string): CertMaterial {
  if (isA3Path(pfxPath)) {
    const { terminalUid, thumbprint } = parseA3(pfxPath);
    const file = a3CertFile(thumbprint);
    if (!terminalUid || !thumbprint || !fs.existsSync(file)) throw new Error("Certificado A3 não está cadastrado neste servidor. Escolha-o de novo em Configurações > Dados Fiscais.");
    const cert = forge.pki.certificateFromAsn1(forge.asn1.fromDer(fs.readFileSync(file, "binary")));
    const cn = cert.subject.getField("CN")?.value || "";
    const cpf = cn.match(/:(\d{11})(?::|$)/), cnpj = cn.match(/:(\d{14})(?::|$)/);
    return { remote: { terminalUid, thumbprint }, privateKeyPem: "", certificatePem: forge.pki.certificateToPem(cert), chainPem: "", titularCpf: cpf ? cpf[1] : null, titularCnpj: cnpj ? cnpj[1] : null };
  }
  const pfxDer = fs.readFileSync(pfxPath, "binary");
  return parsePfx(pfxDer, password);
}

// Assina um elemento identificado por Id dentro do XML (enveloped-signature, C14N, RSA-SHA1).
// Usado tanto para infNFe (autorização) quanto infEvento (cancelamento e outros eventos).
function assinarElemento(xml: string, localName: string, id: string, cert: CertMaterial): string {
  const sig = new SignedXml({
    privateKey: cert.privateKeyPem,
    publicCert: cert.certificatePem,
  });

  sig.addReference({
    xpath: `//*[local-name(.)='${localName}']`,
    uri: `#${id}`,
    digestAlgorithm: "http://www.w3.org/2000/09/xmldsig#sha1",
    transforms: [
      "http://www.w3.org/2000/09/xmldsig#enveloped-signature",
      "http://www.w3.org/TR/2001/REC-xml-c14n-20010315",
    ],
  });

  sig.canonicalizationAlgorithm = "http://www.w3.org/TR/2001/REC-xml-c14n-20010315";
  sig.signatureAlgorithm = "http://www.w3.org/2000/09/xmldsig#rsa-sha1";

  sig.computeSignature(xml, {
    location: { reference: `//*[local-name(.)='${localName}']`, action: "after" },
  });

  return sig.getSignedXml();
}

// Assina a tag infNFe do XML da NFC-e
export function assinarNfce(xml: string, chaveAcesso: string, cert: CertMaterial): string {
  return assinarElemento(xml, "infNFe", `NFe${chaveAcesso}`, cert);
}

// Assina a tag infEvento do XML de um evento (cancelamento, etc.)
export function assinarEvento(xml: string, idEvento: string, cert: CertMaterial): string {
  return assinarElemento(xml, "infEvento", idEvento, cert);
}

// Assina a tag infDPS do XML da DPS (NFS-e) — mesmo padrão de assinatura, id próprio do documento
export function assinarDPS(xml: string, idDPS: string, cert: CertMaterial): string {
  return assinarElemento(xml, "infDPS", idDPS, cert);
}

// Assina a tag infPedReg do XML de um evento de NFS-e (cancelamento, etc.) — mesmo padrão
// de assinatura da DPS, mas o elemento raiz assinado é diferente (infPedReg, não infDPS).
export function assinarPedRegEvento(xml: string, idEvento: string, cert: CertMaterial): string {
  return assinarElemento(xml, "infPedReg", idEvento, cert);
}

// ── Assinatura com certificado A3 (feita no app desktop) ─────────────────────────────────────────────────
// Mesmo documento e mesma assinatura XML do A1 (C14N, enveloped, RSA-SHA1); só o cálculo da assinatura (a parte que usa a chave
// privada) é feito no PC do token. O xml-crypto monta tudo e pede o valor da assinatura por esta classe.
function assinarElementoRemoto(xml: string, localName: string, id: string, cert: CertMaterial): Promise<string> {
  const remote = cert.remote!;
  class RemoteRsaSha1 {
    getAlgorithmName() { return "http://www.w3.org/2000/09/xmldsig#rsa-sha1"; }
    getSignature(signedInfo: unknown, _key: unknown, callback?: (err: Error | null, sig?: string) => void): unknown {
      const data = Buffer.from(String(signedInfo), "utf8");
      void askAgent(remote.terminalUid, "sign", { thumbprint: remote.thumbprint, dataBase64: data.toString("base64"), hash: "SHA1" }).then((r) => {
        if (r.ok && typeof r.signature === "string") callback?.(null, r.signature);
        else callback?.(new Error(String(r.error || "O app não conseguiu assinar com o certificado A3.")));
      });
      return undefined;
    }
    verifySignature() { return false; }
  }
  return new Promise<string>((resolve, reject) => {
    const sig = new SignedXml({ privateKey: "remoto", publicCert: cert.certificatePem });
    (sig as unknown as { SignatureAlgorithms: Record<string, unknown> }).SignatureAlgorithms = { "http://www.w3.org/2000/09/xmldsig#rsa-sha1": RemoteRsaSha1 };
    sig.addReference({
      xpath: `//*[local-name(.)='${localName}']`,
      uri: `#${id}`,
      digestAlgorithm: "http://www.w3.org/2000/09/xmldsig#sha1",
      transforms: ["http://www.w3.org/2000/09/xmldsig#enveloped-signature", "http://www.w3.org/TR/2001/REC-xml-c14n-20010315"],
    });
    sig.canonicalizationAlgorithm = "http://www.w3.org/TR/2001/REC-xml-c14n-20010315";
    sig.signatureAlgorithm = "http://www.w3.org/2000/09/xmldsig#rsa-sha1";
    sig.computeSignature(xml, { location: { reference: `//*[local-name(.)='${localName}']`, action: "after" } }, (err) => (err ? reject(err) : resolve(sig.getSignedXml())));
  });
}

// Versões assíncronas: A3 → app desktop; A1 → exatamente o caminho de sempre.
export async function assinarNfceAsync(xml: string, chaveAcesso: string, cert: CertMaterial): Promise<string> {
  return cert.remote ? assinarElementoRemoto(xml, "infNFe", `NFe${chaveAcesso}`, cert) : assinarNfce(xml, chaveAcesso, cert);
}
export async function assinarEventoAsync(xml: string, idEvento: string, cert: CertMaterial): Promise<string> {
  return cert.remote ? assinarElementoRemoto(xml, "infEvento", idEvento, cert) : assinarEvento(xml, idEvento, cert);
}
export async function assinarDPSAsync(xml: string, idDPS: string, cert: CertMaterial): Promise<string> {
  return cert.remote ? assinarElementoRemoto(xml, "infDPS", idDPS, cert) : assinarDPS(xml, idDPS, cert);
}
export async function assinarPedRegEventoAsync(xml: string, idEvento: string, cert: CertMaterial): Promise<string> {
  return cert.remote ? assinarElementoRemoto(xml, "infPedReg", idEvento, cert) : assinarPedRegEvento(xml, idEvento, cert);
}
