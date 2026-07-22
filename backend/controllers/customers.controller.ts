import type { Request, Response } from "express";
import { prisma } from "../config/prisma";
import type { AuthenticatedRequest } from "../types/auth";
import { localDateString } from "../utils/date";

function getTenantId(req: Request) {
  return (req as AuthenticatedRequest).user.tenantId;
}

// ─── Customers ────────────────────────────────────────────────────────────────

export async function listCustomers(req: Request, res: Response) {
  try {
    const tenantId = getTenantId(req);
    const customers = await prisma.customer.findMany({
      where: { tenant_id: tenantId },
      include: {
        debts: { where: { status: "open" }, select: { amount: true } },
        _count: { select: { debts: true, customer_notes: true } },
      },
      orderBy: { name: "asc" },
    });

    const enriched = customers.map((c) => ({
      ...c,
      total_debt: c.debts.reduce((s, d) => s + Number(d.amount), 0),
      open_debts: c.debts.length,
    }));

    res.json(enriched);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha ao listar clientes" });
  }
}

export async function getCustomer(req: Request, res: Response) {
  try {
    const tenantId = getTenantId(req);
    const id = Number(req.params.id);

    const customer = await prisma.customer.findFirst({
      where: { id, tenant_id: tenantId },
      include: {
        debts: { orderBy: { created_at: "desc" } },
        customer_notes: { orderBy: { created_at: "desc" } },
      },
    });

    if (!customer) return res.status(404).json({ error: "Cliente não encontrado" });

    // Purchase history from orders
    const orders = await prisma.order.findMany({
      where: {
        tenant_id: tenantId,
        customer_name: customer.name,
        status: "completed",
      },
      orderBy: { created_at: "desc" },
      take: 50,
      include: { items: true },
    });

    res.json({
      ...customer,
      total_debt: customer.debts
        .filter((d) => d.status === "open")
        .reduce((s, d) => s + Number(d.amount), 0),
      orders,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha ao buscar cliente" });
  }
}

export async function createCustomer(req: Request, res: Response) {
  try {
    const {
      name, email, phone, document, address, notes, credit_limit, risk_flag, risk_reason, birth_date,
      address_street, address_number, address_complement, address_district, address_city, address_state, address_zip, address_country,
    } = req.body;
    const customer = await prisma.customer.create({
      data: {
        tenant_id: getTenantId(req),
        name,
        email: email || null,
        phone: phone || null,
        document: document || null,
        address: address || null,
        address_street: address_street || null,
        address_number: address_number || null,
        address_complement: address_complement || null,
        address_district: address_district || null,
        address_city: address_city || null,
        address_state: address_state || null,
        address_zip: address_zip || null,
        address_country: address_country || "Brasil",
        notes: notes || null,
        credit_limit: credit_limit || null,
        risk_flag: risk_flag ?? false,
        risk_reason: risk_reason || null,
        birth_date: birth_date ? new Date(birth_date) : null,
      },
    });
    res.json(customer);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha ao criar cliente" });
  }
}

export async function updateCustomer(req: Request, res: Response) {
  try {
    const tenantId = getTenantId(req);
    const id = Number(req.params.id);
    const {
      name, email, phone, document, address, notes, credit_limit, risk_flag, risk_reason, birth_date,
      address_street, address_number, address_complement, address_district, address_city, address_state, address_zip, address_country,
    } = req.body;

    await prisma.customer.updateMany({
      where: { id, tenant_id: tenantId },
      data: {
        ...(name !== undefined && { name }),
        ...(email !== undefined && { email: email || null }),
        ...(phone !== undefined && { phone: phone || null }),
        ...(document !== undefined && { document: document || null }),
        ...(address !== undefined && { address: address || null }),
        ...(address_street !== undefined && { address_street: address_street || null }),
        ...(address_number !== undefined && { address_number: address_number || null }),
        ...(address_complement !== undefined && { address_complement: address_complement || null }),
        ...(address_district !== undefined && { address_district: address_district || null }),
        ...(address_city !== undefined && { address_city: address_city || null }),
        ...(address_state !== undefined && { address_state: address_state || null }),
        ...(address_zip !== undefined && { address_zip: address_zip || null }),
        ...(address_country !== undefined && { address_country: address_country || null }),
        ...(notes !== undefined && { notes: notes || null }),
        ...(credit_limit !== undefined && { credit_limit: credit_limit || null }),
        ...(risk_flag !== undefined && { risk_flag }),
        ...(risk_reason !== undefined && { risk_reason: risk_reason || null }),
        ...(birth_date !== undefined && { birth_date: birth_date ? new Date(birth_date) : null }),
      },
    });

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha ao atualizar cliente" });
  }
}

export async function deleteCustomer(req: Request, res: Response) {
  try {
    const tenantId = getTenantId(req);
    await prisma.customer.deleteMany({
      where: { id: Number(req.params.id), tenant_id: tenantId },
    });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha ao excluir cliente" });
  }
}

// ─── Debts (Fiado) ────────────────────────────────────────────────────────────

export async function listDebts(req: Request, res: Response) {
  try {
    const tenantId = getTenantId(req);
    const customerId = Number(req.params.id);
    const debts = await prisma.customerDebt.findMany({
      where: { tenant_id: tenantId, customer_id: customerId },
      orderBy: { created_at: "desc" },
    });
    res.json(debts);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha ao listar dívidas" });
  }
}

export async function createDebt(req: Request, res: Response) {
  try {
    const tenantId = getTenantId(req);
    const customerId = Number(req.params.id);
    const { description, amount, due_date } = req.body;

    const debt = await prisma.customerDebt.create({
      data: {
        tenant_id: tenantId,
        customer_id: customerId,
        description,
        amount,
        due_date: due_date ? new Date(due_date) : null,
        status: "open",
      },
    });
    res.json(debt);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha ao criar fiado" });
  }
}

export async function payDebt(req: Request, res: Response) {
  try {
    const tenantId = getTenantId(req);
    const debtId = Number(req.params.debtId);

    const debt = await prisma.customerDebt.findFirst({
      where: { id: debtId, tenant_id: tenantId },
    });
    if (!debt) return res.status(404).json({ error: "Dívida não encontrada" });

    await prisma.customerDebt.update({
      where: { id: debtId },
      data: { status: "paid", paid_at: new Date() },
    });

    // Register income in finance
    const customer = await prisma.customer.findUnique({ where: { id: debt.customer_id } });
    await prisma.finance.create({
      data: {
        tenant_id: tenantId,
        type: "income",
        description: `Pagamento fiado — ${customer?.name ?? "Cliente"}: ${debt.description}`,
        amount: debt.amount,
        date: localDateString(),
      },
    });

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha ao registrar pagamento" });
  }
}

export async function deleteDebt(req: Request, res: Response) {
  try {
    const tenantId = getTenantId(req);
    await prisma.customerDebt.deleteMany({
      where: { id: Number(req.params.debtId), tenant_id: tenantId },
    });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha ao excluir dívida" });
  }
}

// ─── Notes ────────────────────────────────────────────────────────────────────

export async function createNote(req: Request, res: Response) {
  try {
    const tenantId = getTenantId(req);
    const customerId = Number(req.params.id);
    const { body } = req.body;

    const note = await prisma.customerNote.create({
      data: { tenant_id: tenantId, customer_id: customerId, body },
    });
    res.json(note);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha ao criar nota" });
  }
}

export async function deleteNote(req: Request, res: Response) {
  try {
    const tenantId = getTenantId(req);
    await prisma.customerNote.deleteMany({
      where: { id: Number(req.params.noteId), tenant_id: tenantId },
    });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha ao excluir nota" });
  }
}

// ─── Debtors list (all tenants debtors summary) ──────────────────────────────

export async function listDebtors(req: Request, res: Response) {
  try {
    const tenantId = getTenantId(req);
    const debtors = await prisma.customerDebt.groupBy({
      by: ["customer_id"],
      where: { tenant_id: tenantId, status: "open" },
      _sum: { amount: true },
      _count: { id: true },
    });

    const customerIds = debtors.map((d) => d.customer_id);
    const customers = await prisma.customer.findMany({
      where: { id: { in: customerIds } },
      select: { id: true, name: true, phone: true, risk_flag: true },
    });

    const result = debtors.map((d) => {
      const c = customers.find((x) => x.id === d.customer_id);
      return {
        customer_id: d.customer_id,
        customer_name: c?.name ?? "–",
        customer_phone: c?.phone ?? null,
        risk_flag: c?.risk_flag ?? false,
        total_debt: Number(d._sum.amount ?? 0),
        open_debts: d._count.id,
      };
    }).sort((a, b) => b.total_debt - a.total_debt);

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha ao listar devedores" });
  }
}
