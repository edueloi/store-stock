import crypto from "crypto";
import type { NextFunction, Request, Response } from "express";

import { env } from "../config/env";
import { prisma } from "../config/prisma";

// Credencial do próprio terminal desktop (sem usuário logado): HMAC do uid + tenant com o
// segredo do servidor. Não precisa de coluna no banco — excluir o terminal ou vinculá-lo a
// outro tenant invalida o token automaticamente (a conferência sempre consulta o terminal).
export function signTerminalToken(terminalUid: string, tenantId: number): string {
  return crypto.createHmac("sha256", env.jwtSecret).update(`terminal:${terminalUid}:${tenantId}`).digest("hex");
}

function tokensMatch(a: string, b: string) {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);
}

// Retorna o terminal se uid + token forem válidos, senão null.
export async function verifyTerminalCredentials(terminalUid: unknown, token: unknown) {
  if (typeof terminalUid !== "string" || typeof token !== "string" || !terminalUid || !token) return null;
  const terminal = await prisma.desktopTerminal.findUnique({
    where: { terminal_uid: terminalUid },
    select: { id: true, tenant_id: true, terminal_uid: true },
  });
  if (!terminal) return null;
  return tokensMatch(token, signTerminalToken(terminal.terminal_uid, terminal.tenant_id)) ? terminal : null;
}

export interface TerminalRequest extends Request {
  terminal: { id: number; tenant_id: number; terminal_uid: string };
}

export async function authenticateTerminal(req: Request, res: Response, next: NextFunction) {
  try {
    const terminal = await verifyTerminalCredentials(req.header("x-terminal-uid"), req.header("x-terminal-token"));
    if (!terminal) {
      res.status(401).json({ error: "Terminal não autorizado" });
      return;
    }
    (req as TerminalRequest).terminal = terminal;
    next();
  } catch {
    res.status(500).json({ error: "Failed to authenticate terminal" });
  }
}
