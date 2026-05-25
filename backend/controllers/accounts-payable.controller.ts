import type { Request, Response } from "express";
import { prisma } from "../config/prisma";
import type { AuthenticatedRequest } from "../types/auth";

function getTenantId(req: Request) {
  return (req as AuthenticatedRequest).user.tenantId;
}

export async function listAccountsPayable(req: Request, res: Response) {
  try {
    const items = await prisma.accountPayable.findMany({
      where: { tenant_id: getTenantId(req) },
      orderBy: { due_date: "asc" },
    });
    res.json(items);
  } catch {
    res.status(500).json({ error: "Failed to fetch accounts payable" });
  }
}

export async function createAccountPayable(req: Request, res: Response) {
  try {
    const item = await prisma.accountPayable.create({
      data: { ...req.body, tenant_id: getTenantId(req) },
    });
    res.json(item);
  } catch {
    res.status(500).json({ error: "Failed to create account payable" });
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
      data: req.body,
    });
    res.json(updated);
  } catch {
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

    const paid_date = req.body.paid_date || new Date().toISOString().split("T")[0];
    const updated = await prisma.accountPayable.update({
      where: { id },
      data: { status: "paid", paid_date: new Date(paid_date + "T12:00:00") },
    });
    res.json(updated);
  } catch {
    res.status(500).json({ error: "Failed to mark as paid" });
  }
}
