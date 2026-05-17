import type { Request, Response } from "express";

import { prisma } from "../config/prisma";
import type { AuthenticatedRequest } from "../types/auth";

function getTenantId(req: Request) {
  return (req as AuthenticatedRequest).user.tenantId;
}

export async function listSuppliers(req: Request, res: Response) {
  try {
    const suppliers = await prisma.supplier.findMany({
      where: { tenant_id: getTenantId(req) },
      orderBy: { name: "asc" },
    });

    res.json(suppliers);
  } catch {
    res.status(500).json({ error: "Failed to fetch suppliers" });
  }
}

export async function createSupplier(req: Request, res: Response) {
  try {
    const supplier = await prisma.supplier.create({
      data: {
        ...req.body,
        tenant_id: getTenantId(req),
      },
    });

    res.json({ id: supplier.id });
  } catch {
    res.status(500).json({ error: "Failed to create supplier" });
  }
}

export async function updateSupplier(req: Request, res: Response) {
  try {
    await prisma.supplier.updateMany({
      where: {
        id: Number(req.params.id),
        tenant_id: getTenantId(req),
      },
      data: req.body,
    });

    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to update supplier" });
  }
}

export async function deleteSupplier(req: Request, res: Response) {
  try {
    await prisma.supplier.deleteMany({
      where: {
        id: Number(req.params.id),
        tenant_id: getTenantId(req),
      },
    });

    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to delete supplier" });
  }
}
