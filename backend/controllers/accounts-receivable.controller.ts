import type { Request, Response } from "express";
import { prisma } from "../config/prisma";
import type { AuthenticatedRequest } from "../types/auth";

function getTenantId(req: Request) {
  return (req as AuthenticatedRequest).user.tenantId;
}

export async function listAccountsReceivable(req: Request, res: Response) {
  try {
    const items = await prisma.accountReceivable.findMany({
      where: { tenant_id: getTenantId(req) },
      orderBy: { due_date: "asc" },
    });
    res.json(items);
  } catch {
    res.status(500).json({ error: "Failed to fetch accounts receivable" });
  }
}

export async function createAccountReceivable(req: Request, res: Response) {
  try {
    const item = await prisma.accountReceivable.create({
      data: { ...req.body, tenant_id: getTenantId(req) },
    });
    res.json(item);
  } catch {
    res.status(500).json({ error: "Failed to create account receivable" });
  }
}

export async function updateAccountReceivable(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    const tenantId = getTenantId(req);
    const existing = await prisma.accountReceivable.findFirst({ where: { id, tenant_id: tenantId } });
    if (!existing) return res.status(404).json({ error: "Not found" });

    const updated = await prisma.accountReceivable.update({
      where: { id },
      data: req.body,
    });
    res.json(updated);
  } catch {
    res.status(500).json({ error: "Failed to update account receivable" });
  }
}

export async function deleteAccountReceivable(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    const tenantId = getTenantId(req);
    const existing = await prisma.accountReceivable.findFirst({ where: { id, tenant_id: tenantId } });
    if (!existing) return res.status(404).json({ error: "Not found" });

    await prisma.accountReceivable.delete({ where: { id } });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Failed to delete account receivable" });
  }
}

export async function receiveAccount(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    const tenantId = getTenantId(req);
    const existing = await prisma.accountReceivable.findFirst({ where: { id, tenant_id: tenantId } });
    if (!existing) return res.status(404).json({ error: "Not found" });

    const received_date = req.body.received_date || new Date().toISOString().split("T")[0];
    const updated = await prisma.accountReceivable.update({
      where: { id },
      data: { status: "received", received_date: new Date(received_date + "T12:00:00") },
    });
    res.json(updated);
  } catch {
    res.status(500).json({ error: "Failed to mark as received" });
  }
}
