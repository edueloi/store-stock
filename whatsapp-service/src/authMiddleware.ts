import type { NextFunction, Request, Response } from "express";

const INTERNAL_TOKEN = process.env.BAILEYS_INTERNAL_TOKEN ?? "";

export function requireInternalToken(req: Request, res: Response, next: NextFunction) {
  if (!INTERNAL_TOKEN) {
    res.status(500).json({ error: "BAILEYS_INTERNAL_TOKEN não configurado no serviço." });
    return;
  }

  if (req.headers["x-internal-token"] !== INTERNAL_TOKEN) {
    res.status(401).json({ error: "Token interno inválido." });
    return;
  }

  next();
}
