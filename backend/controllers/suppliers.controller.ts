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

// Fornecedor não tem vínculo formal (FK) com Contas a Pagar hoje — supplier_name lá é
// texto livre, então casamos pelo nome (mesma convenção do Combobox de fornecedor no
// formulário de Contas a Pagar, que já usa o nome do fornecedor como identidade).
export async function getSupplierSummary(req: Request, res: Response) {
  try {
    const tenantId = getTenantId(req);
    const supplier = await prisma.supplier.findFirst({
      where: { id: Number(req.params.id), tenant_id: tenantId },
      select: { name: true },
    });
    if (!supplier) { res.status(404).json({ error: "Fornecedor não encontrado" }); return; }

    // MySQL usa collation case-insensitive por padrão (utf8mb4_general_ci) — não existe
    // (nem é necessário) o `mode: "insensitive"` do conector Postgres do Prisma aqui.
    const bills = await prisma.accountPayable.findMany({
      where: { tenant_id: tenantId, supplier_name: supplier.name },
      orderBy: { due_date: "desc" },
      select: { id: true, description: true, amount: true, due_date: true, paid_date: true, status: true },
    });

    const totalPending = bills.filter(b => b.status === "pending" || b.status === "overdue")
      .reduce((s, b) => s + Number(b.amount), 0);
    const totalPaid = bills.filter(b => b.status === "paid").reduce((s, b) => s + Number(b.amount), 0);

    res.json({
      totalPending,
      totalPaid,
      billsCount: bills.length,
      recentBills: bills.slice(0, 8),
    });
  } catch (err) {
    console.error("[getSupplierSummary]", err);
    res.status(500).json({ error: "Failed to fetch supplier summary" });
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
