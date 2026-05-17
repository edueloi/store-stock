import type { Request, Response } from "express";

import { prisma } from "../config/prisma";
import type { AuthenticatedRequest } from "../types/auth";

function getTenantId(req: Request) {
  return (req as AuthenticatedRequest).user.tenantId;
}

export async function listCustomers(req: Request, res: Response) {
  try {
    const customers = await prisma.customer.findMany({
      where: { tenant_id: getTenantId(req) },
    });

    res.json(customers);
  } catch {
    res.status(500).json({ error: "Failed to fetch customers" });
  }
}

export async function createCustomer(req: Request, res: Response) {
  try {
    const customer = await prisma.customer.create({
      data: {
        ...req.body,
        tenant_id: getTenantId(req),
      },
    });

    res.json({ id: customer.id });
  } catch {
    res.status(500).json({ error: "Failed to create customer" });
  }
}
