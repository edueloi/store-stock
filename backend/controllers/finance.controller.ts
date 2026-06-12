import type { Request, Response } from "express";

import { prisma } from "../config/prisma";
import { localDateString } from "../utils/date";
import type { AuthenticatedRequest } from "../types/auth";

function getTenantId(req: Request) {
  return (req as AuthenticatedRequest).user.tenantId;
}

export async function listFinanceEntries(req: Request, res: Response) {
  try {
    const entries = await prisma.finance.findMany({
      where: { tenant_id: getTenantId(req) },
      orderBy: { date: "desc" },
    });

    res.json(entries);
  } catch {
    res.status(500).json({ error: "Failed to fetch finance entries" });
  }
}

function parseDateField(raw: unknown): Date | undefined {
  if (!raw) return undefined;
  const s = String(raw).substring(0, 10);
  return new Date(s + "T00:00:00Z");
}

export async function createFinanceEntry(req: Request, res: Response) {
  try {
    const { date, ...rest } = req.body;
    const entry = await prisma.finance.create({
      data: {
        ...rest,
        tenant_id: getTenantId(req),
        date: parseDateField(date) ?? localDateString(),
      },
    });

    res.json({ id: entry.id });
  } catch (err) {
    console.error("[createFinanceEntry]", err);
    res.status(500).json({ error: "Failed to create finance entry" });
  }
}

export async function updateFinanceEntry(req: Request, res: Response) {
  try {
    const tenantId = getTenantId(req);
    const { id } = req.params;
    const existing = await prisma.finance.findFirst({ where: { id: Number(id), tenant_id: tenantId } });
    if (!existing) return res.status(404).json({ error: "Not found" });

    const { tenant_id, id: _id, created_at, updated_at, date, ...rest } = req.body;
    await prisma.finance.update({
      where: { id: Number(id) },
      data: {
        ...rest,
        ...(date ? { date: parseDateField(date) } : {}),
      },
    });

    // Sync back to the linked order if description references a PDV order
    const description: string = rest.description ?? existing.description ?? "";
    const orderMatch = description.match(/PDV\s*#(\d+)/i);
    if (orderMatch) {
      const orderId = Number(orderMatch[1]);
      const order = await prisma.order.findFirst({ where: { id: orderId, tenant_id: tenantId } });
      if (order) {
        const newAmount      = rest.amount          != null ? Number(rest.amount)          : undefined;
        const newDiscount    = rest.discount_amount != null ? Number(rest.discount_amount) : undefined;
        const newFee         = rest.fee_amount      != null ? Number(rest.fee_amount)      : undefined;
        const newGross       = rest.gross_amount    != null ? Number(rest.gross_amount)    : undefined;
        const newPm: string | undefined = rest.payment_method ?? undefined;

        await prisma.order.update({
          where: { id: orderId },
          data: {
            ...(newAmount   != null ? { total_amount:    newAmount   } : {}),
            ...(newGross    != null ? { gross_amount:    newGross    } : {}),
            ...(newDiscount != null ? { discount_amount: newDiscount } : {}),
            ...(newFee      != null ? { fee_amount:      newFee      } : {}),
            ...(newPm               ? { payment_method:  newPm       } : {}),
          },
        });
      }
    }

    res.json({ ok: true });
  } catch (err) {
    console.error("[updateFinanceEntry]", err);
    res.status(500).json({ error: "Failed to update finance entry" });
  }
}

export async function deleteFinanceEntry(req: Request, res: Response) {
  try {
    const tenantId = getTenantId(req);
    const { id } = req.params;
    const existing = await prisma.finance.findFirst({ where: { id: Number(id), tenant_id: tenantId } });
    if (!existing) return res.status(404).json({ error: "Not found" });

    await prisma.finance.delete({ where: { id: Number(id) } });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Failed to delete finance entry" });
  }
}

export async function deleteManyFinanceEntries(req: Request, res: Response) {
  try {
    const tenantId = getTenantId(req);
    const { ids } = req.body as { ids: number[] };
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: "ids required" });

    await prisma.finance.deleteMany({ where: { id: { in: ids }, tenant_id: tenantId } });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Failed to delete finance entries" });
  }
}
