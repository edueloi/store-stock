import fs from "fs";
import forge from "node-forge";
import { SignedXml } from "xml-crypto";

export interface CertMaterial {
  privateKeyPem: string;
  certificatePem: string;
}

// Extrai chave privada + certificado X.509 de um arquivo .pfx/.p12 (certificado A1)
export function loadPfx(pfxPath: string, password: string): CertMaterial {
  const pfxDer = fs.readFileSync(pfxPath, "binary");
  const pfxAsn1 = forge.asn1.fromDer(pfxDer);
  const pfx = forge.pkcs12.pkcs12FromAsn1(pfxAsn1, password);

  const keyBags = pfx.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag];
  const certBags = pfx.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag];

  if (!keyBags || keyBags.length === 0) throw new Error("Certificado .pfx sem chave privada");
  if (!certBags || certBags.length === 0) throw new Error("Certificado .pfx sem certificado X.509");

  const privateKey = keyBags[0].key;
  const certificate = certBags[0].cert;
  if (!privateKey || !certificate) throw new Error("Falha ao extrair chave/certificado do .pfx");

  const privateKeyPem = forge.pki.privateKeyToPem(privateKey);
  const certificatePem = forge.pki.certificateToPem(certificate);

  return { privateKeyPem, certificatePem };
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
