import type { NextFunction, Request, Response } from "express";

import { env } from "../config/env";

// Autenticação por API Key fixa (header x-api-key) para a API externa server-to-server —
// separada do authenticateToken (JWT de sessão humana usado no resto do app).
export function requireApiKey(req: Request, res: Response, next: NextFunction) {
  const key = req.header("x-api-key");
  if (!env.externalApiKey) {
    res.status(503).json({ error: "API externa não configurada no servidor." });
    return;
  }
  if (!key || key !== env.externalApiKey) {
    res.status(401).json({ error: "API key inválida ou ausente." });
    return;
  }
  next();
}
