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

export async function createFinanceEntry(req: Request, res: Response) {
  try {
    const entry = await prisma.finance.create({
      data: {
        ...req.body,
        tenant_id: getTenantId(req),
      },
    });

    res.json({ id: entry.id });
  } catch {
    res.status(500).json({ error: "Failed to create finance entry" });
  }
}

export async function updateFinanceEntry(req: Request, res: Response) {
  try {
    const tenantId = getTenantId(req);
    const { id } = req.params;
    const existing = await prisma.finance.findFirst({ where: { id: Number(id), tenant_id: tenantId } });
    if (!existing) return res.status(404).json({ error: "Not found" });

    const { tenant_id, id: _id, created_at, updated_at, ...data } = req.body;
    // Normaliza a data para YYYY-MM-DD usando fuso local, evitando conversão UTC
    if (data.date) {
      data.date = data.date.toString().substring(0, 10);
    }
    await prisma.finance.update({ where: { id: Number(id) }, data });
    res.json({ ok: true });
  } catch {
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
