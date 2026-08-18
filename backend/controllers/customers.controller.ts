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
        debts: { where: { status: "open" }, select: { amount: true, amount_paid: true } },
        _count: { select: { debts: true, customer_notes: true } },
      },
      orderBy: { name: "asc" },
    });

    const enriched = customers.map((c) => ({
      ...c,
      total_debt: c.debts.reduce((s, d) => s + (Number(d.amount) - Number(d.amount_paid)), 0),
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
        debts: {
          orderBy: { created_at: "desc" },
          include: {
            order: { include: { items: { include: { product: { select: { name: true } } } }, services: true } },
            payments: { orderBy: { paid_at: "desc" } },
            installments: { orderBy: { number: "asc" } },
          },
        },
        customer_notes: { orderBy: { created_at: "desc" } },
      },
    });

    if (!customer) return res.status(404).json({ error: "Cliente não encontrado" });

    // Purchase history from orders — por customer_id (confiável), com fallback por
    // nome só para pedidos legados sem customer_id preenchido.
    const orders = await prisma.order.findMany({
      where: {
        tenant_id: tenantId,
        status: "completed",
        OR: [
          { customer_id: customer.id },
          { customer_id: null, customer_name: customer.name },
        ],
      },
      orderBy: { created_at: "desc" },
      take: 50,
      include: { items: { include: { product: { select: { name: true } } } } },
    });

    // Expõe item.name direto (produto pode ter sido excluído depois da venda,
    // por isso o fallback), mantendo o shape que o frontend já espera.
    const mapItems = (items: { product?: { name: string } | null }[]) =>
      items.map((it) => ({ ...it, name: it.product?.name ?? null }));

    res.json({
      ...customer,
      debts: customer.debts.map((d) => ({
        ...d,
        order: d.order ? { ...d.order, items: mapItems(d.order.items) } : d.order,
      })),
      total_debt: customer.debts
        .filter((d) => d.status === "open")
        .reduce((s, d) => s + (Number(d.amount) - Number(d.amount_paid)), 0),
      orders: orders.map((o) => ({ ...o, items: mapItems(o.items) })),
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
      include: {
        order: { include: { items: { include: { product: { select: { name: true } } } }, services: true } },
        payments: { orderBy: { paid_at: "desc" } },
        installments: { orderBy: { number: "asc" } },
      },
    });
    res.json(debts.map((d) => ({
      ...d,
      order: d.order ? { ...d.order, items: d.order.items.map((it) => ({ ...it, name: it.product?.name ?? null })) } : d.order,
    })));
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

// Núcleo compartilhado de "registrar pagamento de uma dívida": grava o pagamento
// no ledger, atualiza o saldo/status da dívida e lança a receita no financeiro
// só pelo valor efetivamente pago agora — nunca pelo valor total da dívida.
async function registerDebtPayment(
  tenantId: number,
  debtId: number,
  amount: number,
  paymentMethod?: string | null,
  installmentId?: number | null,
) {
  const debt = await prisma.customerDebt.findFirst({ where: { id: debtId, tenant_id: tenantId } });
  if (!debt) throw new Error("NOT_FOUND");
  if (debt.status === "paid") throw new Error("ALREADY_PAID");

  const remaining = Number(debt.amount) - Number(debt.amount_paid);
  if (amount <= 0 || amount > remaining + 0.005) throw new Error("INVALID_AMOUNT");

  let installment = null;
  if (installmentId) {
    installment = await prisma.customerDebtInstallment.findFirst({
      where: { id: installmentId, debt_id: debtId, tenant_id: tenantId },
    });
    if (!installment) throw new Error("INSTALLMENT_NOT_FOUND");
    if (installment.status === "paid") throw new Error("INSTALLMENT_ALREADY_PAID");
    const installmentRemaining = Number(installment.amount) - Number(installment.amount_paid);
    if (amount > installmentRemaining + 0.005) throw new Error("INVALID_AMOUNT");
  }

  const customer = await prisma.customer.findUnique({ where: { id: debt.customer_id } });

  return prisma.$transaction(async (tx) => {
    const payment = await tx.customerDebtPayment.create({
      data: {
        tenant_id: tenantId,
        debt_id: debtId,
        installment_id: installmentId || null,
        amount,
        payment_method: paymentMethod || null,
      },
    });

    if (installment) {
      const installmentAmountPaid = Number(installment.amount_paid) + amount;
      const installmentFullyPaid = installmentAmountPaid >= Number(installment.amount) - 0.005;
      await tx.customerDebtInstallment.update({
        where: { id: installment.id },
        data: {
          amount_paid: installmentAmountPaid,
          status: installmentFullyPaid ? "paid" : "open",
          paid_at: installmentFullyPaid ? new Date() : installment.paid_at,
        },
      });
    }

    const newAmountPaid = Number(debt.amount_paid) + amount;
    const isFullyPaid = newAmountPaid >= Number(debt.amount) - 0.005;

    const updated = await tx.customerDebt.update({
      where: { id: debtId },
      data: {
        amount_paid: newAmountPaid,
        status: isFullyPaid ? "paid" : "open",
        paid_at: isFullyPaid ? new Date() : debt.paid_at,
      },
      include: { installments: { orderBy: { number: "asc" } } },
    });

    await tx.finance.create({
      data: {
        tenant_id: tenantId,
        type: "income",
        description: `Pagamento fiado — ${customer?.name ?? "Cliente"}: ${debt.description}`,
        amount,
        payment_method: paymentMethod || null,
        date: localDateString(),
      },
    });

    return { debt: updated, payment };
  });
}

export async function payDebt(req: Request, res: Response) {
  try {
    const tenantId = getTenantId(req);
    const debtId = Number(req.params.debtId);

    const debt = await prisma.customerDebt.findFirst({ where: { id: debtId, tenant_id: tenantId } });
    if (!debt) return res.status(404).json({ error: "Dívida não encontrada" });

    const remaining = Number(debt.amount) - Number(debt.amount_paid);
    const { payment_method } = req.body as { payment_method?: string };
    const { debt: updated, payment } = await registerDebtPayment(tenantId, debtId, remaining, payment_method);

    res.json({ success: true, debt: updated, payment });
  } catch (err) {
    if (err instanceof Error && err.message === "NOT_FOUND") {
      return res.status(404).json({ error: "Dívida não encontrada" });
    }
    if (err instanceof Error && err.message === "ALREADY_PAID") {
      return res.status(422).json({ error: "Dívida já está quitada" });
    }
    console.error(err);
    res.status(500).json({ error: "Falha ao registrar pagamento" });
  }
}

export async function payDebtPartial(req: Request, res: Response) {
  try {
    const tenantId = getTenantId(req);
    const debtId = Number(req.params.debtId);
    const { amount, payment_method, installment_id } = req.body as {
      amount: number;
      payment_method?: string;
      installment_id?: number;
    };

    if (!amount || amount <= 0) {
      return res.status(422).json({ error: "Valor de pagamento inválido" });
    }

    const { debt: updated, payment } = await registerDebtPayment(
      tenantId, debtId, Number(amount), payment_method, installment_id,
    );
    res.json({ success: true, debt: updated, payment });
  } catch (err) {
    if (err instanceof Error && err.message === "NOT_FOUND") {
      return res.status(404).json({ error: "Dívida não encontrada" });
    }
    if (err instanceof Error && err.message === "ALREADY_PAID") {
      return res.status(422).json({ error: "Dívida já está quitada" });
    }
    if (err instanceof Error && err.message === "INVALID_AMOUNT") {
      return res.status(422).json({ error: "Valor maior que o saldo devedor ou inválido" });
    }
    if (err instanceof Error && err.message === "INSTALLMENT_NOT_FOUND") {
      return res.status(404).json({ error: "Parcela não encontrada" });
    }
    if (err instanceof Error && err.message === "INSTALLMENT_ALREADY_PAID") {
      return res.status(422).json({ error: "Parcela já está paga" });
    }
    console.error(err);
    res.status(500).json({ error: "Falha ao registrar pagamento" });
  }
}

// Aplica juros a uma parcela vencida — sempre uma ação explícita do operador (nunca
// acúmulo automático em background). O valor entra em `amount` da parcela (pra
// `remaining = amount - amount_paid` continuar funcionando em todo lugar sem mudança
// nenhuma) e também em `interest_amount`, só pra distinguir principal de juros depois
// em recibos/relatórios. Não gera CustomerDebtPayment (juros não é dinheiro recebido).
export async function applyInstallmentInterest(req: Request, res: Response) {
  try {
    const tenantId = getTenantId(req);
    const debtId = Number(req.params.debtId);
    const installmentId = Number(req.params.instId);
    const { interest_amount } = req.body as { interest_amount?: number };

    const amount = Number(interest_amount);
    if (!amount || amount <= 0) {
      return res.status(422).json({ error: "Valor de juros inválido" });
    }

    const installment = await prisma.customerDebtInstallment.findFirst({
      where: { id: installmentId, debt_id: debtId, tenant_id: tenantId },
    });
    if (!installment) return res.status(404).json({ error: "Parcela não encontrada" });
    if (installment.status === "paid") {
      return res.status(422).json({ error: "Parcela já está paga — não é possível aplicar juros" });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const updatedInstallment = await tx.customerDebtInstallment.update({
        where: { id: installmentId },
        data: {
          amount: { increment: amount },
          interest_amount: { increment: amount },
          interest_applied_at: new Date(),
        },
      });
      await tx.customerDebt.update({
        where: { id: debtId },
        data: { amount: { increment: amount } },
      });
      return updatedInstallment;
    });

    res.json({ success: true, installment: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha ao aplicar juros" });
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

export async function listDebtInstallments(req: Request, res: Response) {
  try {
    const tenantId = getTenantId(req);
    const debtId = Number(req.params.debtId);

    const debt = await prisma.customerDebt.findFirst({ where: { id: debtId, tenant_id: tenantId } });
    if (!debt) return res.status(404).json({ error: "Dívida não encontrada" });

    const installments = await prisma.customerDebtInstallment.findMany({
      where: { debt_id: debtId, tenant_id: tenantId },
      orderBy: { number: "asc" },
      include: { payments: { orderBy: { paid_at: "desc" } } },
    });

    res.json(installments);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha ao listar parcelas" });
  }
}

// Reconfigura o parcelamento de uma dívida (nº de parcelas + vencimento da 1ª) —
// só permitido enquanto nenhuma parcela tiver recebido pagamento algum.
export async function updateDebtInstallments(req: Request, res: Response) {
  try {
    const tenantId = getTenantId(req);
    const debtId = Number(req.params.debtId);
    const { installments_count, first_due_date } = req.body as {
      installments_count: number;
      first_due_date: string;
    };

    const installmentsCount = Math.max(1, Math.floor(Number(installments_count) || 1));
    if (!first_due_date) {
      return res.status(422).json({ error: "Data da 1ª parcela é obrigatória" });
    }

    const debt = await prisma.customerDebt.findFirst({
      where: { id: debtId, tenant_id: tenantId },
      include: { installments: true },
    });
    if (!debt) return res.status(404).json({ error: "Dívida não encontrada" });
    if (debt.status === "paid") return res.status(422).json({ error: "Dívida já está quitada" });

    const hasPayment = debt.installments.some((i) => Number(i.amount_paid) > 0);
    if (hasPayment) {
      return res.status(422).json({ error: "Não é possível reconfigurar parcelas com pagamento já registrado" });
    }

    const totalAmount = Number(debt.amount);
    const baseAmount = Math.floor((totalAmount / installmentsCount) * 100) / 100;
    const firstDueDate = new Date(`${first_due_date}T00:00:00`);

    const updated = await prisma.$transaction(async (tx) => {
      await tx.customerDebtInstallment.deleteMany({ where: { debt_id: debtId, tenant_id: tenantId } });

      let accumulated = 0;
      for (let i = 0; i < installmentsCount; i++) {
        const isLast = i === installmentsCount - 1;
        const amount = isLast
          ? Math.round((totalAmount - accumulated) * 100) / 100
          : baseAmount;
        accumulated += amount;

        const dueDate = new Date(firstDueDate);
        dueDate.setMonth(dueDate.getMonth() + i);

        await tx.customerDebtInstallment.create({
          data: {
            tenant_id: tenantId,
            debt_id: debtId,
            number: i + 1,
            due_date: dueDate,
            amount,
            status: "open",
          },
        });
      }

      return tx.customerDebt.update({
        where: { id: debtId },
        data: { installments_count: installmentsCount },
        include: { installments: { orderBy: { number: "asc" } } },
      });
    });

    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha ao reconfigurar parcelas" });
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
    // Prisma não agrega expressões calculadas (amount - amount_paid), então a
    // soma do saldo restante por cliente é feita em memória a partir das dívidas abertas.
    const openDebts = await prisma.customerDebt.findMany({
      where: { tenant_id: tenantId, status: "open" },
      select: { customer_id: true, amount: true, amount_paid: true },
    });

    const byCustomer = new Map<number, { total: number; count: number }>();
    for (const d of openDebts) {
      const remaining = Number(d.amount) - Number(d.amount_paid);
      const cur = byCustomer.get(d.customer_id) ?? { total: 0, count: 0 };
      byCustomer.set(d.customer_id, { total: cur.total + remaining, count: cur.count + 1 });
    }

    const customerIds = Array.from(byCustomer.keys());
    const customers = await prisma.customer.findMany({
      where: { id: { in: customerIds } },
      select: { id: true, name: true, phone: true, risk_flag: true },
    });

    const result = Array.from(byCustomer.entries()).map(([customerId, agg]) => {
      const c = customers.find((x) => x.id === customerId);
      return {
        customer_id: customerId,
        customer_name: c?.name ?? "–",
        customer_phone: c?.phone ?? null,
        risk_flag: c?.risk_flag ?? false,
        total_debt: agg.total,
        open_debts: agg.count,
      };
    }).sort((a, b) => b.total_debt - a.total_debt);

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha ao listar devedores" });
  }
}
