import crypto from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

import { env } from "../../config/env";
import { prisma } from "../../config/prisma";

// O token do afiliado é assinado com um segredo DERIVADO do segredo do sistema. Assim ele nunca
// é aceito pelo authenticateToken do painel das lojas (que verifica com o segredo principal),
// e um token de lojista nunca abre o painel do afiliado.
const affiliateSecret = () => crypto.createHmac("sha256", env.jwtSecret).update("affiliate-portal").digest("hex");

export interface AffiliateTokenPayload {
  affiliateId: number;
  kind: "affiliate";
  /** a sessão nasceu de um link mágico (recuperação de senha): por 30 min dá para trocar a senha sem a atual */
  via?: "link";
  iat?: number;
}

export function signAffiliateToken(affiliateId: number, via?: "link") {
  const payload: AffiliateTokenPayload = { affiliateId, kind: "affiliate", ...(via ? { via } : {}) };
  return jwt.sign(payload, affiliateSecret(), { expiresIn: "30d" });
}

// ─── Senha ────────────────────────────────────────────────────────────────
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 72; // limite do bcrypt

export function passwordProblem(password: unknown): string | null {
  if (typeof password !== "string" || password.length < PASSWORD_MIN) return `A senha precisa ter ao menos ${PASSWORD_MIN} caracteres.`;
  if (password.length > PASSWORD_MAX) return `A senha pode ter no máximo ${PASSWORD_MAX} caracteres.`;
  return null;
}

export const hashPassword = (password: string) => bcrypt.hash(password, 10);

// hash descartável para gastar o mesmo tempo quando o e-mail não existe (não revela quem é afiliado)
const DUMMY_HASH = bcrypt.hashSync("senha-descartavel-para-igualar-o-tempo", 10);
export async function checkPassword(password: string, hash: string | null | undefined) {
  const ok = await bcrypt.compare(password, hash || DUMMY_HASH);
  return Boolean(hash) && ok;
}

export const sha256 = (value: string) => crypto.createHash("sha256").update(value).digest("hex");

/** Cria um link mágico de uso único (20 min). Guarda só o hash; devolve o token puro para o e-mail. */
export async function createLoginToken(affiliateId: number) {
  const token = crypto.randomBytes(32).toString("base64url");
  await prisma.affiliateLoginToken.create({
    data: { affiliate_id: affiliateId, token_hash: sha256(token), expires_at: new Date(Date.now() + 20 * 60_000) },
  });
  // limpeza oportunista de tokens antigos
  void prisma.affiliateLoginToken
    .deleteMany({ where: { expires_at: { lt: new Date(Date.now() - 24 * 3600_000) } } })
    .catch(() => undefined);
  return token;
}

/** Troca o link mágico por uma sessão. Retorna null se inválido, expirado ou já usado. */
export async function consumeLoginToken(token: string) {
  const row = await prisma.affiliateLoginToken.findUnique({ where: { token_hash: sha256(token) }, include: { affiliate: true } });
  if (!row || row.used_at || row.expires_at < new Date()) return null;
  if (row.affiliate.status === "suspended" || row.affiliate.status === "rejected") return null;

  const claimed = await prisma.affiliateLoginToken.updateMany({ where: { id: row.id, used_at: null }, data: { used_at: new Date() } });
  if (claimed.count !== 1) return null; // outro pedido usou primeiro

  await prisma.affiliate.update({ where: { id: row.affiliate_id }, data: { last_login_at: new Date() } });
  return row.affiliate;
}

export interface AffiliateRequest extends Request {
  affiliate: NonNullable<Awaited<ReturnType<typeof prisma.affiliate.findUnique>>>;
  /** sessão aberta por link mágico há menos de 30 min */
  freshLink: boolean;
}

export async function authenticateAffiliate(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    res.status(401).json({ error: "Entre para ver o seu painel." });
    return;
  }
  try {
    const payload = jwt.verify(token, affiliateSecret()) as AffiliateTokenPayload;
    if (payload.kind !== "affiliate") throw new Error("kind");
    const affiliate = await prisma.affiliate.findUnique({ where: { id: payload.affiliateId } });
    if (!affiliate || affiliate.status === "suspended" || affiliate.status === "rejected") {
      res.status(403).json({ error: "Este acesso está desativado. Fale com a equipe BoxSys." });
      return;
    }
    (req as AffiliateRequest).affiliate = affiliate;
    (req as AffiliateRequest).freshLink = payload.via === "link" && Date.now() / 1000 - (payload.iat ?? 0) < 1800;
    next();
  } catch {
    res.status(401).json({ error: "Sua sessão expirou. Entre novamente." });
  }
}
