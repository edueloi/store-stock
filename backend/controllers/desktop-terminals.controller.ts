import type { Request, Response } from "express";
import { prisma } from "../config/prisma";
import type { AuthenticatedRequest } from "../types/auth";

function getTenantId(req: Request) {
  return (req as AuthenticatedRequest).user.tenantId;
}

const PAIRING_CODE_TTL_MS = 10 * 60 * 1000;

function generateCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// Chamado pelo Electron ANTES de haver qualquer usuário logado nele — não passa
// por authenticateToken. Protegido só pela curta expiração do código (10 min) e
// por ele não revelar nada além do próprio código gerado.
export async function requestPairingCode(req: Request, res: Response) {
  const { terminal_uid } = req.body as { terminal_uid?: string };
  if (!terminal_uid) {
    res.status(400).json({ error: "terminal_uid é obrigatório" });
    return;
  }
  try {
    // Um terminal ainda não pareado pode pedir código de novo (ex.: expirou e
    // tentou de novo) — limpa qualquer código pendente anterior pra esse mesmo
    // terminal_uid antes de gerar um novo, evitando códigos órfãos acumulando.
    await prisma.desktopPairingCode.deleteMany({
      where: { terminal_uid, paired_at: null },
    });

    let code = generateCode();
    // Colisão de código de 6 dígitos com outro pareamento em andamento é rara,
    // mas o campo é único — tenta de novo em caso de colisão em vez de falhar.
    for (let attempts = 0; attempts < 5; attempts++) {
      const exists = await prisma.desktopPairingCode.findUnique({ where: { code } });
      if (!exists) break;
      code = generateCode();
    }

    await prisma.desktopPairingCode.create({
      data: { code, terminal_uid, expires_at: new Date(Date.now() + PAIRING_CODE_TTL_MS) },
    });
    res.json({ code, expires_in_seconds: PAIRING_CODE_TTL_MS / 1000 });
  } catch {
    res.status(500).json({ error: "Failed to generate pairing code" });
  }
}

// Polling do Electron enquanto a tela de pareamento estiver aberta — também sem
// autenticação, só confirma se ALGUÉM já resolveu o código pro terminal_uid dele.
export async function getPairingStatus(req: Request, res: Response) {
  const { terminal_uid } = req.params;
  try {
    const pending = await prisma.desktopPairingCode.findFirst({
      where: { terminal_uid },
      orderBy: { created_at: "desc" },
    });
    if (!pending) {
      res.json({ paired: false });
      return;
    }
    if (pending.paired_at && pending.tenant_id) {
      const terminal = await prisma.desktopTerminal.findUnique({
        where: { terminal_uid },
        select: { id: true, name: true, tenant_id: true },
      });
      res.json({ paired: true, terminal });
      return;
    }
    res.json({ paired: false, expired: pending.expires_at < new Date() });
  } catch {
    res.status(500).json({ error: "Failed to check pairing status" });
  }
}

// Chamado pelo PWA — usuário já autenticado, resolve o código digitado e
// vincula/cria o DesktopTerminal com o nome escolhido.
export async function pairTerminal(req: Request, res: Response) {
  const tenantId = getTenantId(req);
  const { code, name } = req.body as { code?: string; name?: string };
  if (!code || !name?.trim()) {
    res.status(400).json({ error: "Código e nome são obrigatórios" });
    return;
  }
  try {
    const pairing = await prisma.desktopPairingCode.findUnique({ where: { code } });
    if (!pairing) {
      res.status(404).json({ error: "Código inválido" });
      return;
    }
    if (pairing.paired_at) {
      res.status(409).json({ error: "Este código já foi utilizado" });
      return;
    }
    if (pairing.expires_at < new Date()) {
      res.status(410).json({ error: "Código expirado — gere um novo no terminal desktop" });
      return;
    }

    const terminal = await prisma.$transaction(async (tx) => {
      const created = await tx.desktopTerminal.upsert({
        where: { terminal_uid: pairing.terminal_uid },
        update: { tenant_id: tenantId, name: name.trim() },
        create: { terminal_uid: pairing.terminal_uid, tenant_id: tenantId, name: name.trim() },
      });
      await tx.desktopPairingCode.update({
        where: { code },
        data: { paired_at: new Date(), tenant_id: tenantId },
      });
      return created;
    });

    res.json({ success: true, terminal });
  } catch {
    res.status(500).json({ error: "Failed to pair terminal" });
  }
}

export async function listTerminals(req: Request, res: Response) {
  const tenantId = getTenantId(req);
  try {
    const terminals = await prisma.desktopTerminal.findMany({
      where: { tenant_id: tenantId },
      include: { printers: true },
      orderBy: { name: "asc" },
    });
    res.json(terminals);
  } catch {
    res.status(500).json({ error: "Failed to list terminals" });
  }
}

export async function deleteTerminal(req: Request, res: Response) {
  const tenantId = getTenantId(req);
  const id = Number(req.params.id);
  try {
    const result = await prisma.desktopTerminal.deleteMany({ where: { id, tenant_id: tenantId } });
    if (result.count === 0) {
      res.status(404).json({ error: "Terminal não encontrado" });
      return;
    }
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to delete terminal" });
  }
}

// Confirma que o terminal pertence ao tenant do usuário autenticado antes de
// qualquer operação em suas impressoras — evita um tenant mexer em impressora
// de outro só adivinhando um terminal_id.
async function assertTerminalOwnership(tenantId: number, terminalId: number) {
  const terminal = await prisma.desktopTerminal.findFirst({ where: { id: terminalId, tenant_id: tenantId } });
  return !!terminal;
}

export async function createPrinter(req: Request, res: Response) {
  const tenantId = getTenantId(req);
  const terminalId = Number(req.params.terminalId);
  const { label, role, config, is_default } = req.body as {
    label?: string; role?: string; config?: unknown; is_default?: boolean;
  };
  if (!label?.trim() || !role || !config) {
    res.status(400).json({ error: "label, role e config são obrigatórios" });
    return;
  }
  try {
    if (!(await assertTerminalOwnership(tenantId, terminalId))) {
      res.status(404).json({ error: "Terminal não encontrado" });
      return;
    }
    // Só uma impressora padrão por role/terminal — desmarca as demais do mesmo
    // role antes de criar esta como padrão, pra nunca ter duas competindo.
    if (is_default) {
      await prisma.desktopPrinter.updateMany({
        where: { terminal_id: terminalId, role },
        data: { is_default: false },
      });
    }
    const printer = await prisma.desktopPrinter.create({
      data: { terminal_id: terminalId, label: label.trim(), role, config: config as object, is_default: !!is_default },
    });
    res.json(printer);
  } catch {
    res.status(500).json({ error: "Failed to create printer" });
  }
}

export async function updatePrinter(req: Request, res: Response) {
  const tenantId = getTenantId(req);
  const terminalId = Number(req.params.terminalId);
  const printerId = Number(req.params.printerId);
  const { label, role, config, is_default } = req.body as {
    label?: string; role?: string; config?: unknown; is_default?: boolean;
  };
  try {
    if (!(await assertTerminalOwnership(tenantId, terminalId))) {
      res.status(404).json({ error: "Terminal não encontrado" });
      return;
    }
    if (is_default && role) {
      await prisma.desktopPrinter.updateMany({
        where: { terminal_id: terminalId, role, NOT: { id: printerId } },
        data: { is_default: false },
      });
    }
    const result = await prisma.desktopPrinter.updateMany({
      where: { id: printerId, terminal_id: terminalId },
      data: {
        ...(label !== undefined ? { label: label.trim() } : {}),
        ...(role !== undefined ? { role } : {}),
        ...(config !== undefined ? { config: config as object } : {}),
        ...(is_default !== undefined ? { is_default } : {}),
      },
    });
    if (result.count === 0) {
      res.status(404).json({ error: "Impressora não encontrada" });
      return;
    }
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to update printer" });
  }
}

export async function deletePrinter(req: Request, res: Response) {
  const tenantId = getTenantId(req);
  const terminalId = Number(req.params.terminalId);
  const printerId = Number(req.params.printerId);
  try {
    if (!(await assertTerminalOwnership(tenantId, terminalId))) {
      res.status(404).json({ error: "Terminal não encontrado" });
      return;
    }
    const result = await prisma.desktopPrinter.deleteMany({ where: { id: printerId, terminal_id: terminalId } });
    if (result.count === 0) {
      res.status(404).json({ error: "Impressora não encontrada" });
      return;
    }
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to delete printer" });
  }
}
