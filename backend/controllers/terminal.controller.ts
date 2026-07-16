import type { Request, Response } from "express";

import { prisma } from "../config/prisma";
import type { AuthenticatedRequest } from "../types/auth";
import { terminalServiceFromConfig } from "../services/terminals/terminal.service";
import type { TerminalProvider, TerminalTransaction as TerminalTransactionResult } from "../services/terminals/terminal.interface";

function getTenantId(req: Request) {
  return (req as AuthenticatedRequest).user.tenantId;
}

// Chaves de credenciais sensíveis que devem ser mascaradas ao expor a config —
// cada provider usa um nome de campo diferente para seu segredo principal.
const SECRET_KEYS = ["clientSecret", "accessToken", "merchantKey", "token"];

function maskSecrets(credentials: Record<string, string>): Record<string, string> {
  const masked = { ...credentials };
  for (const key of SECRET_KEYS) {
    const value = masked[key];
    if (value) {
      masked[key] = "••••••••" + value.slice(-4);
    }
  }
  return masked;
}

/** Restaura os segredos mascarados (••••) com os valores reais salvos no banco. */
function restoreMaskedSecrets(
  incoming: Record<string, string>,
  saved: Record<string, string> | undefined,
): Record<string, string> {
  const restored = { ...incoming };
  if (!saved) return restored;
  for (const key of SECRET_KEYS) {
    if (restored[key]?.startsWith("••••")) {
      restored[key] = saved[key] ?? "";
    }
  }
  return restored;
}

async function getTerminalConfig(tenantId: number) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { terminal_config: true },
  });
  return tenant?.terminal_config ?? null;
}

async function persistTransaction(
  tenantId: number,
  provider: string,
  environment: string,
  orderId: number | undefined,
  deviceId: string | undefined,
  tx: TerminalTransactionResult,
) {
  await prisma.terminalTransaction.create({
    data: {
      tenant_id: tenantId,
      order_id: orderId ?? null,
      provider,
      environment,
      status: tx.status,
      external_id: tx.id || null,
      nsu: tx.nsu ?? null,
      authorization_code: tx.authorizationCode ?? null,
      brand: tx.brand ?? null,
      mode: tx.mode ?? null,
      installments: tx.installments ?? 1,
      amount: tx.amount ?? 0,
      device_id: deviceId ?? null,
      raw_response: (tx.rawResponse ?? null) as any,
    },
  });
}

/** GET /api/terminals/config — retorna a config atual (sem expor segredos completos) */
export async function getConfig(req: Request, res: Response) {
  try {
    const cfg = await getTerminalConfig(getTenantId(req));
    if (!cfg || typeof cfg !== "object") {
      res.json(null);
      return;
    }

    const safe = { ...(cfg as Record<string, unknown>) };
    if (safe.credentials && typeof safe.credentials === "object") {
      safe.credentials = maskSecrets(safe.credentials as Record<string, string>);
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

    const current = await getTerminalConfig(tenantId);
    const currentCreds =
      current && typeof current === "object"
        ? ((current as Record<string, unknown>).credentials as Record<string, string> | undefined)
        : undefined;

    const finalCredentials = restoreMaskedSecrets(credentials, currentCreds);

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
    const bodyConfig = req.body && req.body.provider ? req.body : null;
    const cfg = bodyConfig ?? (await getTerminalConfig(getTenantId(req)));

    if (bodyConfig?.credentials) {
      const hasMasked = SECRET_KEYS.some((k) => bodyConfig.credentials[k]?.startsWith("••••"));
      if (hasMasked) {
        const dbCfg = await getTerminalConfig(getTenantId(req));
        const dbCreds =
          dbCfg && typeof dbCfg === "object"
            ? ((dbCfg as Record<string, unknown>).credentials as Record<string, string> | undefined)
            : undefined;
        bodyConfig.credentials = restoreMaskedSecrets(bodyConfig.credentials, dbCreds);
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
    const tenantId = getTenantId(req);
    const cfg = await getTerminalConfig(tenantId);
    const service = terminalServiceFromConfig(cfg);
    if (!service) {
      res.status(400).json({ error: "Terminal não configurado." });
      return;
    }

    const { amount, installments, mode, description, orderId, deviceId } = req.body;

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
      deviceId,
    });

    const cfgObj = cfg as Record<string, unknown>;
    await persistTransaction(
      tenantId,
      service.providerName,
      cfgObj.sandbox ? "sandbox" : "production",
      orderId ? Number(orderId) : undefined,
      deviceId,
      transaction,
    );

    res.json(transaction);
  } catch (err) {
    res.status(400).json({ error: String(err) });
  }
}

/** GET /api/terminals/transactions/:id — consulta status de uma transação (e atualiza o registro salvo) */
export async function getTransaction(req: Request, res: Response) {
  try {
    const tenantId = getTenantId(req);
    const cfg = await getTerminalConfig(tenantId);
    const service = terminalServiceFromConfig(cfg);
    if (!service) {
      res.status(400).json({ error: "Terminal não configurado." });
      return;
    }

    const transaction = await service.getTransaction(req.params.id);

    // Atualiza o registro persistido, se existir, com o status/dados mais recentes
    // (relevante para o fluxo assíncrono do Mercado Pago Point).
    await prisma.terminalTransaction
      .updateMany({
        where: { tenant_id: tenantId, external_id: req.params.id },
        data: {
          status: transaction.status,
          nsu: transaction.nsu ?? null,
          authorization_code: transaction.authorizationCode ?? null,
          brand: transaction.brand ?? null,
          amount: transaction.amount || undefined,
          raw_response: (transaction.rawResponse ?? null) as any,
        },
      })
      .catch(() => undefined);

    res.json(transaction);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
}

/** DELETE /api/terminals/transactions/:id — cancela/estorna uma transação
 *  Body opcional: { amount: number } para estorno parcial (em reais) */
export async function cancelTransaction(req: Request, res: Response) {
  try {
    const tenantId = getTenantId(req);
    const cfg = await getTerminalConfig(tenantId);
    const service = terminalServiceFromConfig(cfg);
    if (!service) {
      res.status(400).json({ error: "Terminal não configurado." });
      return;
    }

    const amount = req.body?.amount ? Number(req.body.amount) : undefined;
    const transaction = await service.cancel(req.params.id, amount);

    await prisma.terminalTransaction
      .updateMany({
        where: { tenant_id: tenantId, external_id: req.params.id },
        data: { status: transaction.status, raw_response: (transaction.rawResponse ?? null) as any },
      })
      .catch(() => undefined);

    res.json(transaction);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
}

/** GET /api/terminals/transactions — lista transações de maquininha (relatório), com filtros básicos */
export async function listTransactions(req: Request, res: Response) {
  try {
    const tenantId = getTenantId(req);
    const { provider, status, from, to } = req.query as Record<string, string | undefined>;

    const where: Record<string, unknown> = { tenant_id: tenantId };
    if (provider) where.provider = provider;
    if (status) where.status = status;
    if (from || to) {
      where.created_at = {
        ...(from ? { gte: new Date(from) } : {}),
        ...(to ? { lte: new Date(to) } : {}),
      };
    }

    const transactions = await prisma.terminalTransaction.findMany({
      where,
      orderBy: { created_at: "desc" },
      take: 500,
    });

    res.json(transactions);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
}
