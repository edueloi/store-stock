import type { Request, Response } from "express";
import { prisma } from "../config/prisma";
import type { AuthenticatedRequest } from "../types/auth";
import { emitToTenant } from "../services/realtime.service";
import { generateInstallments, advanceDate, type RecurrenceInput, type IntervalUnit } from "../utils/finance-series";

function getTenantId(req: Request) {
  return (req as AuthenticatedRequest).user.tenantId;
}

export async function listAccountsPayable(req: Request, res: Response) {
  try {
    const items = await prisma.accountPayable.findMany({
      where: { tenant_id: getTenantId(req) },
      include: { series: { select: { installments_count: true, total_amount: true, interest_rate: true, interest_period: true, interest_grace_days: true } } },
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

function parseBody(body: Record<string, unknown>) {
  const data = { ...body };
  if (typeof data.due_date === "string" && data.due_date.length === 10) {
    data.due_date = new Date(data.due_date + "T12:00:00") as unknown as string;
  }
  if (typeof data.paid_date === "string" && data.paid_date.length === 10) {
    data.paid_date = new Date(data.paid_date + "T12:00:00") as unknown as string;
  }
  return data;
}

export async function createAccountPayable(req: Request, res: Response) {
  try {
    const tenantId = getTenantId(req);
    const { recurrence, ...body } = req.body as Record<string, unknown> & { recurrence?: RecurrenceInput & { interest_rate?: number; interest_period?: string; interest_grace_days?: number } };

    if (!recurrence) {
      const item = await prisma.accountPayable.create({
        data: { ...parseBody(body), tenant_id: tenantId } as Parameters<typeof prisma.accountPayable.create>[0]["data"],
      });
      emitToTenant(tenantId, "finance:changed", { id: item.id });
      res.json(item);
      return;
    }

    const parsedBody = parseBody(body) as Record<string, unknown>;
    const firstDueDate = parsedBody.due_date as Date;
    const totalAmount = recurrence.value_mode === "variable"
      ? (recurrence.amounts ?? []).reduce((a, b) => a + Number(b), 0)
      : Number(body.amount);

    let installments;
    try {
      installments = generateInstallments(totalAmount, firstDueDate, recurrence);
    } catch (e) {
      res.status(422).json({ error: e instanceof Error ? e.message : "Recorrência inválida" });
      return;
    }

    const created = await prisma.$transaction(async (tx) => {
      const series = await tx.financeSeries.create({
        data: {
          tenant_id: tenantId,
          kind: "payable",
          description: String(parsedBody.description ?? ""),
          category: (parsedBody.category as string) ?? null,
          party_name: (parsedBody.supplier_name as string) ?? null,
          total_amount: totalAmount,
          installments_count: installments.length,
          interval_unit: recurrence.interval_unit,
          interval_count: recurrence.interval_count ?? 1,
          value_mode: recurrence.value_mode ?? "fixed",
          interest_rate: recurrence.interest_rate ?? 0,
          interest_period: recurrence.interest_period ?? "month",
          interest_grace_days: recurrence.interest_grace_days ?? 0,
          notes: (parsedBody.notes as string) ?? null,
        },
      });

      const rows = [];
      for (const inst of installments) {
        rows.push(await tx.accountPayable.create({
          data: {
            tenant_id: tenantId,
            description: String(parsedBody.description ?? ""),
            amount: inst.amount,
            due_date: inst.due_date,
            category: (parsedBody.category as string) ?? null,
            supplier_name: (parsedBody.supplier_name as string) ?? null,
            notes: (parsedBody.notes as string) ?? null,
            series_id: series.id,
            installment_number: inst.installment_number,
            cost_type: (parsedBody.cost_type as string) ?? null,
          },
        }));
      }
      return rows;
    });

    emitToTenant(tenantId, "finance:changed", { count: created.length });
    res.json({ installments: created });
  } catch (err) {
    console.error("createAccountPayable error:", err);
    res.status(500).json({ error: "Failed to create account payable" });
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

export async function bulkPayAccountsPayable(req: Request, res: Response) {
  try {
    const tenantId = getTenantId(req);
    const { ids, paid_date } = req.body as { ids?: number[]; paid_date?: string };

    if (!Array.isArray(ids) || ids.length === 0) {
      res.status(422).json({ error: "Informe ao menos uma conta para marcar como paga" });
      return;
    }

    const date = new Date(`${paid_date || new Date().toISOString().split("T")[0]}T12:00:00`);
    const recurring = await prisma.accountPayable.findMany({
      where: { id: { in: ids.map(Number) }, tenant_id: tenantId, is_recurring: true, recurrence_interval_unit: { not: null } },
    });
    const result = await prisma.accountPayable.updateMany({
      where: { id: { in: ids.map(Number) }, tenant_id: tenantId },
      data: { status: "paid", paid_date: date },
    });
    for (const existing of recurring) {
      const nextDue = advanceDate(new Date(existing.due_date), existing.recurrence_interval_unit as IntervalUnit, existing.recurrence_interval_count ?? 1);
      await prisma.accountPayable.create({
        data: {
          tenant_id: tenantId,
          description: existing.description,
          amount: existing.amount,
          due_date: nextDue,
          category: existing.category,
          supplier_name: existing.supplier_name,
          notes: existing.notes,
          is_recurring: true,
          recurrence_interval_unit: existing.recurrence_interval_unit,
          recurrence_interval_count: existing.recurrence_interval_count,
          cost_type: existing.cost_type,
        },
      });
    }
    emitToTenant(tenantId, "finance:changed", { count: result.count });
    res.json({ success: true, count: result.count });
  } catch (err) {
    console.error("bulkPayAccountsPayable error:", err);
    res.status(500).json({ error: "Falha ao marcar contas como pagas" });
  }
}

export async function updateAccountPayable(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    const tenantId = getTenantId(req);
    const existing = await prisma.accountPayable.findFirst({ where: { id, tenant_id: tenantId } });
    if (!existing) return res.status(404).json({ error: "Not found" });

    const updated = await prisma.accountPayable.update({
      where: { id },
      data: parseBody(req.body),
    });
    emitToTenant(tenantId, "finance:changed", { id: updated.id });
    res.json(updated);
  } catch (err) {
    console.error("updateAccountPayable error:", err);
    res.status(500).json({ error: "Failed to update account payable" });
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
    const id = Number(req.params.id);
    const tenantId = getTenantId(req);
    const existing = await prisma.accountPayable.findFirst({ where: { id, tenant_id: tenantId } });
    if (!existing) return res.status(404).json({ error: "Not found" });

    const { paid_date: bodyPaidDate, continue_recurring } = req.body as { paid_date?: string; continue_recurring?: boolean };
    const paid_date = bodyPaidDate || new Date().toISOString().split("T")[0];
    const updated = await prisma.accountPayable.update({
      where: { id },
      data: { status: "paid", paid_date: new Date(paid_date + "T12:00:00") },
    });

    // Conta de valor variável que se repete indefinidamente (água, energia) — ao pagar,
    // já cria o lançamento do próximo período como estimativa (mesmo valor), pendente,
    // pra não depender de o operador lembrar de cadastrar de novo todo mês. O operador
    // pode desmarcar "continue_recurring" nesse pagamento pra encerrar a recorrência
    // aqui (senão ela se perpetuaria pra sempre sem nenhum jeito de parar).
    if (existing.is_recurring && existing.recurrence_interval_unit && continue_recurring !== false) {
      const nextDue = advanceDate(new Date(existing.due_date), existing.recurrence_interval_unit as IntervalUnit, existing.recurrence_interval_count ?? 1);
      await prisma.accountPayable.create({
        data: {
          tenant_id: tenantId,
          description: existing.description,
          amount: existing.amount,
          due_date: nextDue,
          category: existing.category,
          supplier_name: existing.supplier_name,
          notes: existing.notes,
          is_recurring: true,
          recurrence_interval_unit: existing.recurrence_interval_unit,
          recurrence_interval_count: existing.recurrence_interval_count,
          cost_type: existing.cost_type,
        },
      });
    }

    emitToTenant(tenantId, "finance:changed", { id: updated.id });
    res.json(updated);
  } catch {
    res.status(500).json({ error: "Failed to mark as paid" });
  }
}
