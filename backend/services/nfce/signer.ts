import fs from "fs";
import forge from "node-forge";
import { SignedXml } from "xml-crypto";

export interface CertMaterial {
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
