import type { Request, Response } from "express";
import { prisma } from "../config/prisma";
import type { AuthenticatedRequest } from "../types/auth";
import { emitToTerminal } from "../services/realtime.service";

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
      select: {
        terminal_uid: true,
        printers: { where: { role }, select: { id: true }, take: 1 },
      },
    });
    if (!terminal) {
      res.status(404).json({ error: "Terminal não encontrado" });
      return;
    }
    if (terminal.printers.length === 0) {
      res.status(422).json({ error: `Nenhuma impressora configurada para "${role}" neste terminal` });
      return;
    }
    if (!emitToTerminal(terminal.terminal_uid, "print:requested", { role, text })) {
      res.status(409).json({ error: "Terminal está offline. Abra o app desktop vinculado e tente novamente." });
      return;
    }
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to request remote print" });
  }
}
