import type { Request, Response } from "express";
import { prisma } from "../config/prisma";
import type { AuthenticatedRequest } from "../types/auth";
import { emitToTenant } from "../services/realtime.service";
import { AccountValidationError, saveFinanceAccount, settleFinanceAccounts } from "../services/finance-accounts.service";

function getTenantId(req: Request) {
  return (req as AuthenticatedRequest).user.tenantId;
}

// Pendente e vencendo nos próximos `days` dias (default 3, mesmo horizonte do
// destaque "Vencendo em breve" na tela) OU já vencida — usado tanto pelo endpoint
// abaixo quanto pelo job diário de push notifications.
export async function countDueSoonPayables(tenantId: number, days = 3) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() + days);
  cutoff.setHours(23, 59, 59, 999);

  return prisma.accountPayable.count({
    where: { tenant_id: tenantId, status: "pending", due_date: { lte: cutoff } },
  });
}

export async function getDueSoonCount(req: Request, res: Response) {
  try {
    const tenantId = getTenantId(req);
    const days = Number(req.query.days) || 3;
    const count = await countDueSoonPayables(tenantId, days);
    res.json({ count });
  } catch {
    res.status(500).json({ error: "Failed to fetch due soon count" });
  }
}

export async function listAccountsPayable(req: Request, res: Response) {
  try {
    const items = await prisma.accountPayable.findMany({
      where: { tenant_id: getTenantId(req) },
      include: { series: true },
      orderBy: { due_date: "asc" },
    });
    res.json(items);
  } catch {
    res.status(500).json({ error: "Failed to fetch accounts payable" });
  }
}

interface ImportRow {
  description?: string;
  amount?: number | string;
  due_date?: string;
  supplier_name?: string;
  category?: string;
  cost_type?: string;
}

// Importação de planilha — best-effort por linha (uma linha inválida não derruba as
// outras); o front já valida antes de mandar, isso aqui é a segunda linha de defesa.
export async function importAccountsPayable(req: Request, res: Response) {
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
      const costType = r.cost_type === "fixed" || r.cost_type === "variable" ? r.cost_type : null;

      if (!description) { errors.push({ row: i + 1, error: "Descrição vazia" }); continue; }
      if (!amount || amount <= 0) { errors.push({ row: i + 1, error: "Valor inválido" }); continue; }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDateStr)) { errors.push({ row: i + 1, error: "Vencimento inválido" }); continue; }

      await prisma.accountPayable.create({
        data: {
          tenant_id: tenantId,
          description,
          amount,
          due_date: new Date(`${dueDateStr}T12:00:00`),
          supplier_name: r.supplier_name?.toString().trim() || null,
          category: r.category?.toString().trim() || null,
          cost_type: costType,
        },
      });
      created++;
    }

    if (created > 0) emitToTenant(tenantId, "finance:changed", { count: created });
    res.json({ created, errors });
  } catch (err) {
    console.error("importAccountsPayable error:", err);
    res.status(500).json({ error: "Falha ao importar planilha" });
  }
}

export async function createAccountPayable(req: Request, res: Response) {
  try {
    const tenantId = getTenantId(req);
    const result = await saveFinanceAccount("payable", tenantId, req.body);
    emitToTenant(tenantId, "finance:changed", {});
    res.json(result);
  } catch (error) {
    if (error instanceof AccountValidationError) { res.status(error.status).json({ error: error.message }); return; }
    console.error("createAccountPayable:", error);
    res.status(500).json({ error: "Não foi possível salvar a conta. Tente novamente." });
  }
}

export async function applyInterestPayable(req: Request, res: Response) {
  try {
    const tenantId = getTenantId(req);
    const id = Number(req.params.id);
    const { interest_amount } = req.body as { interest_amount?: number };

    const amount = Number(interest_amount);
    if (!amount || amount <= 0) {
      res.status(422).json({ error: "Valor de juros inválido" });
      return;
    }

    const existing = await prisma.accountPayable.findFirst({ where: { id, tenant_id: tenantId } });
    if (!existing) { res.status(404).json({ error: "Conta a pagar não encontrada" }); return; }
    if (existing.status === "paid") {
      res.status(422).json({ error: "Conta já está paga — não é possível aplicar juros" });
      return;
    }

    const updated = await prisma.accountPayable.update({
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
    console.error("applyInterestPayable error:", err);
    res.status(500).json({ error: "Falha ao aplicar juros" });
  }
}

export async function bulkDeleteAccountsPayable(req: Request, res: Response) {
  try {
    const tenantId = getTenantId(req);
    const { ids } = req.body as { ids?: number[] };

    if (!Array.isArray(ids) || ids.length === 0) {
      res.status(422).json({ error: "Informe ao menos uma conta para excluir" });
      return;
    }

    const result = await prisma.accountPayable.deleteMany({
      where: { id: { in: ids.map(Number) }, tenant_id: tenantId },
    });
    emitToTenant(tenantId, "finance:changed", { count: result.count });
    res.json({ success: true, count: result.count });
  } catch (err) {
    console.error("bulkDeleteAccountsPayable error:", err);
    res.status(500).json({ error: "Falha ao excluir contas" });
  }
}

export async function bulkPayAccountsPayable(req: Request, res: Response) {
  try {
    const tenantId = getTenantId(req);
    if (!Array.isArray(req.body.ids)) { res.status(422).json({ error: "Selecione as contas para baixar." }); return; }
    const result = await settleFinanceAccounts("payable", tenantId, req.body.ids, req.body);
    if (result.count) emitToTenant(tenantId, "finance:changed", { count: result.count });
    res.json({ success: true, count: result.count });
  } catch (error) {
    if (error instanceof AccountValidationError) { res.status(error.status).json({ error: error.message }); return; }
    console.error("bulkPayAccountsPayable:", error);
    res.status(500).json({ error: "Não foi possível salvar a conta. Tente novamente." });
  }
}

export async function updateAccountPayable(req: Request, res: Response) {
  try {
    const tenantId = getTenantId(req);
    const result = await saveFinanceAccount("payable", tenantId, req.body, Number(req.params.id));
    emitToTenant(tenantId, "finance:changed", {});
    res.json(result);
  } catch (error) {
    if (error instanceof AccountValidationError) { res.status(error.status).json({ error: error.message }); return; }
    console.error("updateAccountPayable:", error);
    res.status(500).json({ error: "Não foi possível salvar a conta. Tente novamente." });
  }
}

export async function deleteAccountPayable(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    const tenantId = getTenantId(req);
    const existing = await prisma.accountPayable.findFirst({ where: { id, tenant_id: tenantId } });
    if (!existing) return res.status(404).json({ error: "Not found" });

    await prisma.accountPayable.delete({ where: { id } });
    emitToTenant(tenantId, "finance:changed", { id });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Failed to delete account payable" });
  }
}

export async function payAccount(req: Request, res: Response) {
  try {
    const tenantId = getTenantId(req);
    const result = await settleFinanceAccounts("payable", tenantId, [Number(req.params.id)], req.body);
    if (result.count) emitToTenant(tenantId, "finance:changed", { count: result.count });
    res.json(result.items[0]);
  } catch (error) {
    if (error instanceof AccountValidationError) { res.status(error.status).json({ error: error.message }); return; }
    console.error("payAccount:", error);
    res.status(500).json({ error: "Não foi possível salvar a conta. Tente novamente." });
  }
}
