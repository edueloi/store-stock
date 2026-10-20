import type { Request, Response } from "express";
import { prisma } from "../config/prisma";
import type { AuthenticatedRequest } from "../types/auth";
import { emitToTenant } from "../services/realtime.service";
import { AccountValidationError, saveFinanceAccount, settleFinanceAccounts, deleteFinanceAccount, backfillRecurring } from "../services/finance-accounts.service";

function getTenantId(req: Request) {
  return (req as AuthenticatedRequest).user.tenantId;
}

export async function listAccountsReceivable(req: Request, res: Response) {
  try {
    await backfillRecurring("receivable", getTenantId(req)).catch((error) => console.error("backfillRecurring receivable:", error));
    const items = await prisma.accountReceivable.findMany({
      where: { tenant_id: getTenantId(req) },
      include: { series: true },
      orderBy: { due_date: "asc" },
    });
    res.json(items);
  } catch {
    res.status(500).json({ error: "Failed to fetch accounts receivable" });
  }
}

export async function createAccountReceivable(req: Request, res: Response) {
  try {
    const tenantId = getTenantId(req);
    const result = await saveFinanceAccount("receivable", tenantId, req.body);
    emitToTenant(tenantId, "finance:changed", {});
    res.json(result);
  } catch (error) {
    if (error instanceof AccountValidationError) { res.status(error.status).json({ error: error.message }); return; }
    console.error("createAccountReceivable:", error);
    res.status(500).json({ error: "Não foi possível salvar a conta. Tente novamente." });
  }
}

export async function applyInterestReceivable(req: Request, res: Response) {
  try {
    const tenantId = getTenantId(req);
    const id = Number(req.params.id);
    const { interest_amount } = req.body as { interest_amount?: number };

    const amount = Number(interest_amount);
    if (!amount || amount <= 0) {
      res.status(422).json({ error: "Valor de juros inválido" });
      return;
    }

    const existing = await prisma.accountReceivable.findFirst({ where: { id, tenant_id: tenantId } });
    if (!existing) { res.status(404).json({ error: "Conta a receber não encontrada" }); return; }
    if (existing.status === "received") {
      res.status(422).json({ error: "Conta já foi recebida — não é possível aplicar juros" });
      return;
    }

    const updated = await prisma.accountReceivable.update({
      where: { id },
      data: {
        amount: { increment: amount },
        interest_amount: { increment: amount },
        interest_applied_at: new Date(),
      },
    });
    emitToTenant(tenantId, "finance:changed", { id: updated.id });
    res.json(updated);
  } catch (err) {
    console.error("applyInterestReceivable error:", err);
    res.status(500).json({ error: "Falha ao aplicar juros" });
  }
}

export async function bulkDeleteAccountsReceivable(req: Request, res: Response) {
  try {
    const tenantId = getTenantId(req);
    const { ids } = req.body as { ids?: number[] };

    if (!Array.isArray(ids) || ids.length === 0) {
      res.status(422).json({ error: "Informe ao menos uma conta para excluir" });
      return;
    }

    const result = await prisma.accountReceivable.deleteMany({
      where: { id: { in: ids.map(Number) }, tenant_id: tenantId },
    });
    emitToTenant(tenantId, "finance:changed", { count: result.count });
    res.json({ success: true, count: result.count });
  } catch (err) {
    console.error("bulkDeleteAccountsReceivable error:", err);
    res.status(500).json({ error: "Falha ao excluir contas" });
  }
}

export async function bulkReceiveAccountsReceivable(req: Request, res: Response) {
  try {
    const tenantId = getTenantId(req);
    if (!Array.isArray(req.body.ids)) { res.status(422).json({ error: "Selecione as contas para baixar." }); return; }
    const result = await settleFinanceAccounts("receivable", tenantId, req.body.ids, req.body);
    if (result.count) emitToTenant(tenantId, "finance:changed", { count: result.count });
    res.json({ success: true, count: result.count });
  } catch (error) {
    if (error instanceof AccountValidationError) { res.status(error.status).json({ error: error.message }); return; }
    console.error("bulkReceiveAccountsReceivable:", error);
    res.status(500).json({ error: "Não foi possível salvar a conta. Tente novamente." });
  }
}

export async function updateAccountReceivable(req: Request, res: Response) {
  try {
    const tenantId = getTenantId(req);
    const result = await saveFinanceAccount("receivable", tenantId, req.body, Number(req.params.id));
    emitToTenant(tenantId, "finance:changed", {});
    res.json(result);
  } catch (error) {
    if (error instanceof AccountValidationError) { res.status(error.status).json({ error: error.message }); return; }
    console.error("updateAccountReceivable:", error);
    res.status(500).json({ error: "Não foi possível salvar a conta. Tente novamente." });
  }
}

export async function deleteAccountReceivable(req: Request, res: Response) {
  try {
    const tenantId = getTenantId(req);
    const scope = req.query.scope === "following" ? "following" : "this";
    const count = await deleteFinanceAccount("receivable", tenantId, Number(req.params.id), scope);
    emitToTenant(tenantId, "finance:changed", { id: Number(req.params.id), count });
    res.json({ ok: true, count });
  } catch (error) {
    if (error instanceof AccountValidationError) { res.status(error.status).json({ error: error.message }); return; }
    res.status(500).json({ error: "Failed to delete account" });
  }
}

export async function receiveAccount(req: Request, res: Response) {
  try {
    const tenantId = getTenantId(req);
    const result = await settleFinanceAccounts("receivable", tenantId, [Number(req.params.id)], req.body);
    if (result.count) emitToTenant(tenantId, "finance:changed", { count: result.count });
    res.json(result.items[0]);
  } catch (error) {
    if (error instanceof AccountValidationError) { res.status(error.status).json({ error: error.message }); return; }
    console.error("receiveAccount:", error);
    res.status(500).json({ error: "Não foi possível salvar a conta. Tente novamente." });
  }
}

interface ImportRow { description?: string; amount?: number | string; due_date?: string; customer_name?: string; category?: string; }

export async function importAccountsReceivable(req: Request, res: Response) {
  try {
    const tenantId = getTenantId(req);
    const { rows } = req.body as { rows?: ImportRow[] };
    if (!Array.isArray(rows) || rows.length === 0) {
      res.status(422).json({ error: "Nenhuma linha para importar" });
      return;
    }

    let created = 0;
    const errors: { row: number; error: string }[] = [];

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const description = (r.description || "").toString().trim();
      const amount = Number(r.amount);
      const dueDateStr = (r.due_date || "").toString().trim().substring(0, 10);

      if (!description) { errors.push({ row: i + 1, error: "Descrição vazia" }); continue; }
      if (!amount || amount <= 0) { errors.push({ row: i + 1, error: "Valor inválido" }); continue; }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDateStr)) { errors.push({ row: i + 1, error: "Vencimento inválido" }); continue; }

      await prisma.accountReceivable.create({
        data: {
          tenant_id: tenantId,
          description,
          amount,
          due_date: new Date(`${dueDateStr}T12:00:00`),
          customer_name: r.customer_name?.toString().trim() || null,
          category: r.category?.toString().trim() || null,
        },
      });
      created++;
    }

    if (created > 0) emitToTenant(tenantId, "finance:changed", { count: created });
    res.json({ created, errors });
  } catch (err) {
    console.error("importAccountsReceivable error:", err);
    res.status(500).json({ error: "Falha ao importar planilha" });
  }
}
