import type { Request, Response } from "express";
import { prisma } from "../config/prisma";
import type { AuthenticatedRequest } from "../types/auth";
import { emitToTenant } from "../services/realtime.service";

function getTenantId(req: Request) {
  return (req as AuthenticatedRequest).user.tenantId;
}

// Pede pra um terminal desktop específico (já pareado, rodando em segundo
// plano na bandeja ou em primeiro plano — tanto faz) imprimir algo. O texto já
// vem pronto formatado pelo chamador (mesmo texto que a impressão local usaria
// via window.boxsysDesktop.printReceipt) — este endpoint só repassa via
// Socket.IO pro terminal certo, não conhece o formato do cupom/documento.
export async function requestRemotePrint(req: Request, res: Response) {
  const tenantId = getTenantId(req);
  const { terminal_id, role, text } = req.body as {
    terminal_id?: number; role?: string; text?: string;
  };
  if (!terminal_id || !role || !text) {
    res.status(400).json({ error: "terminal_id, role e text são obrigatórios" });
    return;
  }
  try {
    const terminal = await prisma.desktopTerminal.findFirst({
      where: { id: terminal_id, tenant_id: tenantId },
      select: { terminal_uid: true },
    });
    if (!terminal) {
      res.status(404).json({ error: "Terminal não encontrado" });
      return;
    }
    emitToTenant(tenantId, "print:requested", { terminal_uid: terminal.terminal_uid, role, text });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to request remote print" });
  }
}
