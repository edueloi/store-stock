import type { Request, Response } from "express";

import { prisma } from "../config/prisma";
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
