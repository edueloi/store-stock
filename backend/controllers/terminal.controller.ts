import type { Request, Response } from "express";

import { prisma } from "../config/prisma";
import type { AuthenticatedRequest } from "../types/auth";
import { terminalServiceFromConfig } from "../services/terminals/terminal.service";
import type { TerminalProvider } from "../services/terminals/terminal.interface";

function getTenantId(req: Request) {
  return (req as AuthenticatedRequest).user.tenantId;
}

async function getTerminalConfig(tenantId: number) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { terminal_config: true },
  });
  return tenant?.terminal_config ?? null;
}

/** GET /api/terminals/config — retorna a config atual (sem expor o clientSecret completo) */
export async function getConfig(req: Request, res: Response) {
  try {
    const cfg = await getTerminalConfig(getTenantId(req));
    if (!cfg || typeof cfg !== "object") {
      res.json(null);
      return;
    }

    const safe = { ...(cfg as Record<string, unknown>) };
    if (safe.credentials && typeof safe.credentials === "object") {
      const creds = safe.credentials as Record<string, string>;
      safe.credentials = {
        ...creds,
        clientSecret: creds.clientSecret ? "••••••••" + creds.clientSecret.slice(-4) : "",
      };
    }

    res.json(safe);
  } catch {
    res.status(500).json({ error: "Erro ao buscar configuração de terminal." });
  }
}

/** PUT /api/terminals/config — salva/atualiza a config do provider */
export async function saveConfig(req: Request, res: Response) {
  try {
    const { provider, credentials, sandbox } = req.body as {
      provider: TerminalProvider;
      credentials: Record<string, string>;
      sandbox: boolean;
    };

    const validProviders: TerminalProvider[] = ["rede", "stone", "mercadopago", "cielo", "pagseguro"];
    if (!validProviders.includes(provider)) {
      res.status(400).json({ error: "Provider inválido." });
      return;
    }

    if (!credentials || typeof credentials !== "object") {
      res.status(400).json({ error: "Credenciais inválidas." });
      return;
    }

    const tenantId = getTenantId(req);

    // Busca config atual para preservar clientSecret se vier mascarado
    const current = await getTerminalConfig(tenantId);
    let finalCredentials = { ...credentials };

    if (
      current &&
      typeof current === "object" &&
      (current as Record<string, unknown>).credentials &&
      credentials.clientSecret?.startsWith("••••")
    ) {
      const currentCreds = (current as Record<string, unknown>).credentials as Record<string, string>;
      finalCredentials.clientSecret = currentCreds.clientSecret;
    }

    await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        terminal_config: {
          provider,
          credentials: finalCredentials,
          sandbox: Boolean(sandbox),
        },
      },
    });

    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Erro ao salvar configuração de terminal." });
  }
}

/** POST /api/terminals/ping — testa se as credenciais funcionam
 *  Aceita config no body (para testar antes de salvar) ou usa a config do banco */
export async function pingTerminal(req: Request, res: Response) {
  try {
    // Use config from body if provided (allows testing without saving first)
    const bodyConfig = req.body && req.body.provider ? req.body : null;
    const cfg = bodyConfig ?? (await getTerminalConfig(getTenantId(req)));

    // If body has masked secret (starts with ••••), restore from DB
    if (bodyConfig?.credentials?.clientSecret?.startsWith("••••")) {
      const dbCfg = await getTerminalConfig(getTenantId(req));
      if (dbCfg && typeof dbCfg === "object") {
        const dbCreds = (dbCfg as Record<string, unknown>).credentials as Record<string, string> | undefined;
        if (dbCreds?.clientSecret) {
          bodyConfig.credentials.clientSecret = dbCreds.clientSecret;
        }
      }
    }

    const service = terminalServiceFromConfig(cfg);
    if (!service) {
      res.status(400).json({ ok: false, error: "Terminal não configurado." });
      return;
    }

    const ok = await service.ping();
    res.json({ ok });
  } catch (err) {
    res.status(400).json({ ok: false, error: String(err) });
  }
}

/** POST /api/terminals/charge — inicia uma cobrança */
export async function charge(req: Request, res: Response) {
  try {
    const cfg = await getTerminalConfig(getTenantId(req));
    const service = terminalServiceFromConfig(cfg);
    if (!service) {
      res.status(400).json({ error: "Terminal não configurado." });
      return;
    }

    const { amount, installments, mode, description, orderId } = req.body;

    if (!amount || amount <= 0) {
      res.status(400).json({ error: "Valor inválido." });
      return;
    }

    const transaction = await service.charge({
      amount: Number(amount),
      installments: Number(installments ?? 1),
      mode: mode === "debit" ? "debit" : "credit",
      description,
      orderId,
    });

    res.json(transaction);
  } catch (err) {
    res.status(400).json({ error: String(err) });
  }
}

/** GET /api/terminals/transactions/:id — consulta status de uma transação */
export async function getTransaction(req: Request, res: Response) {
  try {
    const cfg = await getTerminalConfig(getTenantId(req));
    const service = terminalServiceFromConfig(cfg);
    if (!service) {
      res.status(400).json({ error: "Terminal não configurado." });
      return;
    }

    const transaction = await service.getTransaction(req.params.id);
    res.json(transaction);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
}

/** DELETE /api/terminals/transactions/:id — cancela/estorna uma transação
 *  Body opcional: { amount: number } para estorno parcial (em reais) */
export async function cancelTransaction(req: Request, res: Response) {
  try {
    const cfg = await getTerminalConfig(getTenantId(req));
    const service = terminalServiceFromConfig(cfg);
    if (!service) {
      res.status(400).json({ error: "Terminal não configurado." });
      return;
    }

    const amount = req.body?.amount ? Number(req.body.amount) : undefined;
    const transaction = await service.cancel(req.params.id, amount);
    res.json(transaction);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
}
