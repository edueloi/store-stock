import type { NextFunction, Request, Response } from "express";

// Avisa o grafica-system na hora em que algo muda na loja ligada a ele (Artes VA), para ele sincronizar sem esperar
// a rodada de 60 s. Sem GRAFICA_SYNC_URL (ex.: http://127.0.0.1:3300) a integração fica desligada.
let timer: NodeJS.Timeout | null = null;

function ping() {
  const base = (process.env.GRAFICA_SYNC_URL ?? "").replace(/\/$/, "");
  const token = process.env.SYNC_TOKEN ?? "";
  if (!base || token.length < 24) return;
  if (timer) return; // junta várias gravações seguidas num único aviso
  timer = setTimeout(() => {
    timer = null;
    fetch(`${base}/api/internal/store-sync/ping`, { method: "POST", headers: { "x-sync-token": token }, signal: AbortSignal.timeout(5000) }).catch(() => {});
  }, 1500);
}

export function graficaSyncNotifier(req: Request, res: Response, next: NextFunction) {
  const tenantId = Number(process.env.GRAFICA_SYNC_TENANT_ID);
  if (tenantId > 0 && process.env.GRAFICA_SYNC_URL && !["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    res.on("finish", () => {
      if (res.statusCode >= 400 || req.originalUrl.startsWith("/api/internal/")) return;
      if ((req as any).user?.tenantId === tenantId) ping();
    });
  }
  next();
}
