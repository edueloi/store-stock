import crypto from "crypto";

import { env } from "../config/env";

// Criptografia simétrica em repouso para segredos que o backend precisa reler em
// texto puro (senha do certificado A1, CSC token) — diferente de senha de usuário,
// não pode ser hash unidirecional (bcrypt), pois o certificado precisa ser reaberto
// a cada emissão de NFC-e/NFS-e.
//
// Formato armazenado: "v1:<iv base64>:<authTag base64>:<ciphertext base64>"
// Valores já existentes em texto puro (antes desta migração) não têm o prefixo
// "v1:" e são devolvidos como estão por decryptSecret — ver comentário abaixo.

const ALGORITHM = "aes-256-gcm";
const PREFIX = "v1:";

function getKey(): Buffer {
  const secret = env.secretEncryptionKey || env.jwtSecret;
  return crypto.createHash("sha256").update(secret).digest();
}

export function encryptSecret(plainText: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("base64")}:${authTag.toString("base64")}:${ciphertext.toString("base64")}`;
}

// Aceita tanto valores já criptografados (prefixo "v1:") quanto valores antigos
// em texto puro gravados antes desta migração — permite migrar gradualmente sem
// quebrar tenants que ainda não foram reescritos.
export function decryptSecret(stored: string | null | undefined): string | null {
  if (!stored) return null;
  if (!stored.startsWith(PREFIX)) return stored;

  const [ivB64, authTagB64, ciphertextB64] = stored.slice(PREFIX.length).split(":");
  if (!ivB64 || !authTagB64 || !ciphertextB64) return null;

  try {
    const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivB64, "base64"));
    decipher.setAuthTag(Buffer.from(authTagB64, "base64"));
    const plain = Buffer.concat([decipher.update(Buffer.from(ciphertextB64, "base64")), decipher.final()]);
    return plain.toString("utf8");
  } catch {
    return null;
  }
}
