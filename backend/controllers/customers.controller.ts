import type { Request, Response } from "express";
import ExcelJS from "exceljs";
import * as XLSX from "xlsx";
import { prisma } from "../config/prisma";
import type { AuthenticatedRequest } from "../types/auth";
import { localDateString } from "../utils/date";
import { computeSegmentFee } from "../utils/payment-method";
import { emitToTenant } from "../services/realtime.service";

function getTenantId(req: Request) {
  return (req as AuthenticatedRequest).user.tenantId;
}

function getUserId(req: Request) {
  return (req as AuthenticatedRequest).user.userId;
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
        seller: { select: { id: true, name: true } },
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
        seller: { select: { id: true, name: true } },
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
      name, email, phone, document, address, notes, credit_limit, consignment_limit, risk_flag, risk_reason, birth_date,
      address_street, address_number, address_complement, address_district, address_city, address_state, address_zip, address_country,
      legal_name, trade_name, cnae_code, cnae_description, legal_nature, registration_status, registration_status_date,
      external_code, contact_name, fax, website, person_type, state_registration, state_registration_exempt, status,
      marital_status, profession, gender, birthplace, father_name, father_document, mother_name, mother_document,
      segment, seller_id, contact_type, nfe_email, customer_since, next_visit_at, tax_regime,
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
        consignment_limit: consignment_limit || null,
        risk_flag: risk_flag ?? false,
        risk_reason: risk_reason || null,
        birth_date: birth_date ? new Date(birth_date) : null,
        legal_name: legal_name || null,
        trade_name: trade_name || null,
        cnae_code: cnae_code || null,
        cnae_description: cnae_description || null,
        legal_nature: legal_nature || null,
        registration_status: registration_status || null,
        registration_status_date: registration_status_date ? new Date(registration_status_date) : null,
        external_code: external_code || null,
        contact_name: contact_name || null,
        fax: fax || null,
        website: website || null,
        person_type: person_type || "physical",
        state_registration: state_registration || null,
        state_registration_exempt: state_registration_exempt ?? false,
        status: status || "active",
        marital_status: marital_status || null,
        profession: profession || null,
        gender: gender || null,
        birthplace: birthplace || null,
        father_name: father_name || null,
        father_document: father_document || null,
        mother_name: mother_name || null,
        mother_document: mother_document || null,
        segment: segment || null,
        seller_id: seller_id ? Number(seller_id) : null,
        contact_type: contact_type || null,
        nfe_email: nfe_email || null,
        customer_since: customer_since ? new Date(customer_since) : null,
        next_visit_at: next_visit_at ? new Date(next_visit_at) : null,
        tax_regime: tax_regime || null,
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
      name, email, phone, document, address, notes, credit_limit, consignment_limit, risk_flag, risk_reason, birth_date,
      address_street, address_number, address_complement, address_district, address_city, address_state, address_zip, address_country,
      legal_name, trade_name, cnae_code, cnae_description, legal_nature, registration_status, registration_status_date,
      external_code, contact_name, fax, website, person_type, state_registration, state_registration_exempt, status,
      marital_status, profession, gender, birthplace, father_name, father_document, mother_name, mother_document,
      segment, seller_id, contact_type, nfe_email, customer_since, next_visit_at, tax_regime,
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
        ...(consignment_limit !== undefined && { consignment_limit: consignment_limit || null }),
        ...(risk_flag !== undefined && { risk_flag }),
        ...(risk_reason !== undefined && { risk_reason: risk_reason || null }),
        ...(birth_date !== undefined && { birth_date: birth_date ? new Date(birth_date) : null }),
        ...(legal_name !== undefined && { legal_name: legal_name || null }),
        ...(trade_name !== undefined && { trade_name: trade_name || null }),
        ...(cnae_code !== undefined && { cnae_code: cnae_code || null }),
        ...(cnae_description !== undefined && { cnae_description: cnae_description || null }),
        ...(legal_nature !== undefined && { legal_nature: legal_nature || null }),
        ...(registration_status !== undefined && { registration_status: registration_status || null }),
        ...(registration_status_date !== undefined && { registration_status_date: registration_status_date ? new Date(registration_status_date) : null }),
        ...(external_code !== undefined && { external_code: external_code || null }),
        ...(contact_name !== undefined && { contact_name: contact_name || null }),
        ...(fax !== undefined && { fax: fax || null }),
        ...(website !== undefined && { website: website || null }),
        ...(person_type !== undefined && { person_type: person_type || "physical" }),
        ...(state_registration !== undefined && { state_registration: state_registration || null }),
        ...(state_registration_exempt !== undefined && { state_registration_exempt: state_registration_exempt ?? false }),
        ...(status !== undefined && { status: status || "active" }),
        ...(marital_status !== undefined && { marital_status: marital_status || null }),
        ...(profession !== undefined && { profession: profession || null }),
        ...(gender !== undefined && { gender: gender || null }),
        ...(birthplace !== undefined && { birthplace: birthplace || null }),
        ...(father_name !== undefined && { father_name: father_name || null }),
        ...(father_document !== undefined && { father_document: father_document || null }),
        ...(mother_name !== undefined && { mother_name: mother_name || null }),
        ...(mother_document !== undefined && { mother_document: mother_document || null }),
        ...(segment !== undefined && { segment: segment || null }),
        ...(seller_id !== undefined && { seller_id: seller_id ? Number(seller_id) : null }),
        ...(contact_type !== undefined && { contact_type: contact_type || null }),
        ...(nfe_email !== undefined && { nfe_email: nfe_email || null }),
        ...(customer_since !== undefined && { customer_since: customer_since ? new Date(customer_since) : null }),
        ...(next_visit_at !== undefined && { next_visit_at: next_visit_at ? new Date(next_visit_at) : null }),
        ...(tax_regime !== undefined && { tax_regime: tax_regime || null }),
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

// Saldo de crédito de troca disponível do cliente (gerado por devoluções) —
// consumível como forma de pagamento numa venda nova no PDV.
export async function getCustomerCredits(req: Request, res: Response) {
  try {
    const tenantId = getTenantId(req);
    const customerId = Number(req.params.id);
    const credits = await prisma.customerCredit.findMany({
      where: { tenant_id: tenantId, customer_id: customerId, status: "active" },
      orderBy: { created_at: "asc" },
    });
    const balance = credits.reduce((sum, c) => sum + Number(c.balance), 0);
    res.json({ balance: Math.round(balance * 100) / 100, credits });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha ao buscar saldo de crédito" });
  }
}

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

    // Mesmo cuidado de registerDebtPaymentMulti: se a dívida quitou inteira mas
    // o pagamento não veio vinculado a uma parcela específica, fecha também as
    // parcelas que tivessem ficado abertas — evita dívida "paid" com parcela
    // órfã em "open".
    if (isFullyPaid && !installment) {
      const pendingInstallments = await tx.customerDebtInstallment.findMany({
        where: { debt_id: debtId, status: { not: "paid" } },
      });
      for (const inst of pendingInstallments) {
        await tx.customerDebtInstallment.update({
          where: { id: inst.id },
          data: { amount_paid: inst.amount, status: "paid", paid_at: new Date() },
        });
      }
    }

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

interface DebtPaymentSegmentInput {
  method: string;
  brand?: string;
  installments?: number;
  amount: number;
}

// Generalização de registerDebtPayment para N formas de pagamento simultâneas (ex.:
// metade dinheiro, metade crédito 2x) — um CustomerDebtPayment por segmento, cada um já
// com bandeira/parcelas/taxa de maquininha calculada, igual ao que a venda normal do
// PDV já faz (mas lá agregado numa string composta; aqui cada forma é sua própria
// linha, o que é mais simples de auditar e não precisa ratear taxa depois).
async function registerDebtPaymentMulti(
  tenantId: number,
  userId: number,
  debtId: number,
  segments: DebtPaymentSegmentInput[],
  installmentId?: number | null,
) {
  const totalAmount = Math.round(segments.reduce((s, p) => s + (Number(p.amount) || 0), 0) * 100) / 100;
  if (segments.length === 0 || totalAmount <= 0) throw new Error("INVALID_AMOUNT");

  const debt = await prisma.customerDebt.findFirst({ where: { id: debtId, tenant_id: tenantId } });
  if (!debt) throw new Error("NOT_FOUND");
  if (debt.status === "paid") throw new Error("ALREADY_PAID");

  const remaining = Number(debt.amount) - Number(debt.amount_paid);
  // Sem troco em fiado — quitar até o saldo devedor, nunca além (mesma tolerância de
  // arredondamento já usada em registerDebtPayment).
  if (totalAmount > remaining + 0.005) throw new Error("INVALID_AMOUNT");

  let installment = null;
  if (installmentId) {
    installment = await prisma.customerDebtInstallment.findFirst({
      where: { id: installmentId, debt_id: debtId, tenant_id: tenantId },
    });
    if (!installment) throw new Error("INSTALLMENT_NOT_FOUND");
    if (installment.status === "paid") throw new Error("INSTALLMENT_ALREADY_PAID");
    const installmentRemaining = Number(installment.amount) - Number(installment.amount_paid);
    if (totalAmount > installmentRemaining + 0.005) throw new Error("INVALID_AMOUNT");
  }

  const customer = await prisma.customer.findUnique({ where: { id: debt.customer_id } });
  const tenantData = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { card_fees: true, require_cash_session: true },
  });
  const cardFees = (tenantData?.card_fees ?? {}) as Record<string, number[]>;

  // Sessão de caixa aberta do operador — mesmo padrão de sales.controller.ts. Quando a
  // loja exige caixa aberto, bloqueia igual à venda normal; caso contrário, o pagamento
  // segue permitido mesmo sem sessão (só fica de fora do fechamento daquele dia).
  const openSession = await prisma.cashSession.findFirst({
    where: { tenant_id: tenantId, opened_by_id: userId, status: "open" },
    select: { id: true },
  });
  if (tenantData?.require_cash_session && !openSession) throw new Error("CASH_SESSION_REQUIRED");
  const cashSessionId = openSession?.id ?? null;

  return prisma.$transaction(async (tx) => {
    const createdPayments = [];
    for (const seg of segments) {
      const amount = Math.round((Number(seg.amount) || 0) * 100) / 100;
      if (amount <= 0) continue;
      const brand = seg.brand || "other";
      const installmentsCount = seg.installments && seg.installments > 1 ? seg.installments : 1;
      const fee = computeSegmentFee({ method: seg.method, brand, installments: installmentsCount, amount }, cardFees);
      const net = Math.round((amount - fee) * 100) / 100;

      const payment = await tx.customerDebtPayment.create({
        data: {
          tenant_id: tenantId,
          debt_id: debtId,
          installment_id: installmentId || null,
          amount,
          payment_method: seg.method,
          card_brand: (seg.method === "debit" || seg.method === "credit") ? brand : null,
          installments: seg.method === "credit" ? installmentsCount : null,
          gross_amount: amount,
          fee_amount: fee > 0 ? fee : null,
          net_amount: net,
          cash_session_id: cashSessionId,
        },
      });
      createdPayments.push(payment);
    }

    if (installment) {
      const installmentAmountPaid = Number(installment.amount_paid) + totalAmount;
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

    const newAmountPaid = Number(debt.amount_paid) + totalAmount;
    const isFullyPaid = newAmountPaid >= Number(debt.amount) - 0.005;

    // Se a dívida inteira foi quitada mas o pagamento não veio vinculado a uma
    // parcela específica (ex.: "pagar tudo" em vez de pagar parcela a parcela),
    // fecha também as CustomerDebtInstallment que ainda estivessem abertas —
    // sem isso a dívida "mãe" fica "paid" enquanto a(s) parcela(s) ficam órfãs
    // em "open" pra sempre, aparecendo como pendente em qualquer tela que leia
    // só a parcela (ex.: aba Crediário de Contas a Receber).
    if (isFullyPaid && !installment) {
      const pendingInstallments = await tx.customerDebtInstallment.findMany({
        where: { debt_id: debtId, status: { not: "paid" } },
      });
      for (const inst of pendingInstallments) {
        await tx.customerDebtInstallment.update({
          where: { id: inst.id },
          data: { amount_paid: inst.amount, status: "paid", paid_at: new Date() },
        });
      }
    }

    const updated = await tx.customerDebt.update({
      where: { id: debtId },
      data: {
        amount_paid: newAmountPaid,
        status: isFullyPaid ? "paid" : "open",
        paid_at: isFullyPaid ? new Date() : debt.paid_at,
      },
      include: { installments: { orderBy: { number: "asc" } } },
    });

    // Um Finance por segmento (não agregado) — cada CustomerDebtPayment já é sua
    // própria transação no ledger, e carrega a taxa exata do segmento sem precisar
    // ratear depois (Finance.payment_method também é uma coluna de método único, não
    // suportaria uma string composta tipo a de Order).
    for (const p of createdPayments) {
      await tx.finance.create({
        data: {
          tenant_id: tenantId,
          type: "income",
          description: `Pagamento fiado — ${customer?.name ?? "Cliente"}: ${debt.description}`,
          amount: Number(p.net_amount ?? p.amount),
          gross_amount: Number(p.gross_amount ?? p.amount),
          fee_amount: p.fee_amount ? Number(p.fee_amount) : null,
          payment_method: p.payment_method,
          source: "debt_payment",
          date: localDateString(),
        },
      });
    }

    return { debt: updated, payments: createdPayments };
  });
}

export async function payDebtMulti(req: Request, res: Response) {
  try {
    const tenantId = getTenantId(req);
    const userId = getUserId(req);
    const debtId = Number(req.params.debtId);
    const { payments, installment_id } = req.body as {
      payments: DebtPaymentSegmentInput[];
      installment_id?: number;
    };

    if (!Array.isArray(payments) || payments.length === 0) {
      res.status(422).json({ error: "Informe ao menos uma forma de pagamento" });
      return;
    }

    const { debt: updated, payments: createdPayments } = await registerDebtPaymentMulti(
      tenantId, userId, debtId, payments, installment_id,
    );

    emitToTenant(tenantId, "finance:changed", { debtId });
    if (createdPayments.some((p) => p.cash_session_id)) {
      emitToTenant(tenantId, "cash-session:changed", { debtId });
    }

    res.json({ success: true, debt: updated, payments: createdPayments });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    const map: Record<string, [number, string]> = {
      NOT_FOUND: [404, "Dívida não encontrada"],
      ALREADY_PAID: [422, "Dívida já está quitada"],
      INVALID_AMOUNT: [422, "Valor maior que o saldo devedor ou inválido"],
      INSTALLMENT_NOT_FOUND: [404, "Parcela não encontrada"],
      INSTALLMENT_ALREADY_PAID: [422, "Parcela já está paga"],
      CASH_SESSION_REQUIRED: [409, "Abra o caixa antes de registrar este pagamento"],
    };
    const [status, error] = map[msg] ?? [500, "Falha ao registrar pagamento"];
    if (status === 500) console.error(err);
    res.status(status).json({ error });
  }
}

// Desfaz um pagamento de dívida/parcela já registrado — usado quando o operador
// marcou um pagamento por engano. Exclui o CustomerDebtPayment, subtrai o valor da
// parcela (se vinculada) e da dívida, voltando status/amount_paid pro estado
// anterior. Não apaga o Finance original (sem vínculo direto de volta pro
// pagamento, arriscado demais localizar e excluir o certo) — em vez disso cria um
// lançamento de estorno (amount negativo), mantendo o histórico contábil auditável.
export async function reverseDebtPayment(req: Request, res: Response) {
  try {
    const tenantId = getTenantId(req);
    const debtId = Number(req.params.debtId);
    const paymentId = Number(req.params.paymentId);

    const payment = await prisma.customerDebtPayment.findFirst({
      where: { id: paymentId, debt_id: debtId, tenant_id: tenantId },
    });
    if (!payment) {
      res.status(404).json({ error: "Pagamento não encontrado" });
      return;
    }

    const debt = await prisma.customerDebt.findFirst({ where: { id: debtId, tenant_id: tenantId } });
    if (!debt) {
      res.status(404).json({ error: "Dívida não encontrada" });
      return;
    }

    const customer = await prisma.customer.findUnique({ where: { id: debt.customer_id } });
    const amount = Number(payment.amount);

    await prisma.$transaction(async (tx) => {
      if (payment.installment_id) {
        const installment = await tx.customerDebtInstallment.findUnique({ where: { id: payment.installment_id } });
        if (installment) {
          const newInstallmentPaid = Math.max(0, Number(installment.amount_paid) - amount);
          await tx.customerDebtInstallment.update({
            where: { id: installment.id },
            data: {
              amount_paid: newInstallmentPaid,
              status: "open",
              paid_at: null,
            },
          });
        }
      }

      const newDebtPaid = Math.max(0, Number(debt.amount_paid) - amount);
      await tx.customerDebt.update({
        where: { id: debtId },
        data: {
          amount_paid: newDebtPaid,
          status: "open",
          paid_at: null,
        },
      });

      await tx.customerDebtPayment.delete({ where: { id: paymentId } });

      await tx.finance.create({
        data: {
          tenant_id: tenantId,
          type: "expense",
          description: `Estorno de pagamento fiado — ${customer?.name ?? "Cliente"}: ${debt.description}`,
          amount,
          payment_method: payment.payment_method,
          source: "debt_payment_reversal",
          date: localDateString(),
        },
      });
    });

    const updated = await prisma.customerDebt.findUnique({
      where: { id: debtId },
      include: { installments: { orderBy: { number: "asc" } }, payments: { orderBy: { paid_at: "desc" } } },
    });

    emitToTenant(tenantId, "finance:changed", { debtId });
    if (payment.cash_session_id) emitToTenant(tenantId, "cash-session:changed", { debtId });

    res.json({ success: true, debt: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha ao estornar pagamento" });
  }
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

// Todas as parcelas de crediário em aberto do tenant (não só de um cliente),
// pra alimentar a aba "Crediário" em Contas a Receber e o badge/toast de
// parcelas vencidas — "overdue"/"vencido" é sempre derivado comparando
// due_date com hoje, igual já é feito em CustomerDebtInstallment em toda a
// tela (não existe esse status persistido no banco).
export async function listOpenInstallments(req: Request, res: Response) {
  try {
    const tenantId = getTenantId(req);
    const installments = await prisma.customerDebtInstallment.findMany({
      where: { tenant_id: tenantId, status: "open" },
      include: {
        debt: {
          select: {
            id: true,
            description: true,
            customer: { select: { id: true, name: true, phone: true, risk_flag: true } },
          },
        },
      },
      orderBy: { due_date: "asc" },
    });

    const result = installments.map((inst) => ({
      id: inst.id,
      debt_id: inst.debt_id,
      customer_id: inst.debt.customer.id,
      customer_name: inst.debt.customer.name,
      customer_phone: inst.debt.customer.phone,
      risk_flag: inst.debt.customer.risk_flag,
      description: inst.debt.description,
      number: inst.number,
      due_date: inst.due_date,
      amount: Number(inst.amount),
      amount_paid: Number(inst.amount_paid),
      remaining: Math.round((Number(inst.amount) - Number(inst.amount_paid)) * 100) / 100,
    }));

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha ao listar parcelas em aberto" });
  }
}

// ─── Import / Export (planilha Excel) ────────────────────────────────────────
//
// Colunas exatas, nesta ordem, espelhando a planilha legada do sistema anterior:
// Código | Nome | Fantasia | Endereço | Número | Complemento | Bairro | CEP | Cidade | UF |
// Contatos | Fone | Fax | Celular | E-mail | Web Site | Tipo pessoa | CNPJ/CPF | IE/RG |
// IE isento | Situação | Observações | Estado civil | Profissão | Sexo | Data nasc. |
// Naturalidade | Nome pai | CPF pai | Nome mãe | CPF mãe | Segmento | Vendedor |
// Tipo contato | E-mail para envio NFe | Limite de crédito | Cliente desde | Próxima visita |
// Regime tributário
//
// Convenção adotada (o sistema não distingue "Fone" de "Celular" hoje): a coluna
// "Fone" recebe o `phone` existente; "Celular" fica sempre vazia na exportação e é
// ignorada na importação. Ver relatório final para detalhes.
const EXPORT_COLUMNS = [
  "Código", "Nome", "Fantasia", "Endereço", "Número", "Complemento", "Bairro", "CEP", "Cidade", "UF",
  "Contatos", "Fone", "Fax", "Celular", "E-mail", "Web Site", "Tipo pessoa", "CNPJ/CPF", "IE/RG",
  "IE isento", "Situação", "Observações", "Estado civil", "Profissão", "Sexo", "Data nasc.",
  "Naturalidade", "Nome pai", "CPF pai", "Nome mãe", "CPF mãe", "Segmento", "Vendedor",
  "Tipo contato", "E-mail para envio NFe", "Limite de crédito", "Cliente desde", "Próxima visita",
  "Regime tributário",
] as const;

function formatDateBR(d: Date | null | undefined): string {
  if (!d) return "";
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return "";
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = date.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function personTypeLabel(personType: string | null | undefined): string {
  return personType === "legal" ? "Pessoa Jurídica" : "Pessoa Física";
}

export async function exportCustomers(req: Request, res: Response) {
  try {
    const tenantId = getTenantId(req);
    const customers = await prisma.customer.findMany({
      where: { tenant_id: tenantId },
      include: { seller: { select: { name: true } } },
      orderBy: { name: "asc" },
    });

    const wb = new ExcelJS.Workbook();
    wb.creator = "BoxSys Store";
    wb.created = new Date();

    const ws = wb.addWorksheet("Clientes");
    ws.columns = EXPORT_COLUMNS.map((header) => ({ header, key: header, width: 18 }));

    const headerRow = ws.getRow(1);
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A5F" } };
      cell.alignment = { horizontal: "center", vertical: "middle" };
    });
    headerRow.height = 20;

    for (const c of customers) {
      ws.addRow({
        "Código": c.external_code ?? "",
        "Nome": c.name ?? "",
        "Fantasia": c.trade_name ?? "",
        "Endereço": c.address_street ?? "",
        "Número": c.address_number ?? "",
        "Complemento": c.address_complement ?? "",
        "Bairro": c.address_district ?? "",
        "CEP": c.address_zip ?? "",
        "Cidade": c.address_city ?? "",
        "UF": c.address_state ?? "",
        "Contatos": c.contact_name ?? "",
        "Fone": c.phone ?? "",
        "Fax": c.fax ?? "",
        "Celular": "", // não há campo separado de celular no sistema hoje — ver comentário acima
        "E-mail": c.email ?? "",
        "Web Site": c.website ?? "",
        "Tipo pessoa": personTypeLabel(c.person_type),
        "CNPJ/CPF": c.document ?? "",
        "IE/RG": c.state_registration ?? "",
        "IE isento": c.state_registration_exempt ? "Sim" : "Não",
        "Situação": c.status === "inactive" ? "Inativo" : "Ativo",
        "Observações": c.notes ?? "",
        "Estado civil": c.marital_status ?? "",
        "Profissão": c.profession ?? "",
        "Sexo": c.gender ?? "",
        "Data nasc.": formatDateBR(c.birth_date),
        "Naturalidade": c.birthplace ?? "",
        "Nome pai": c.father_name ?? "",
        "CPF pai": c.father_document ?? "",
        "Nome mãe": c.mother_name ?? "",
        "CPF mãe": c.mother_document ?? "",
        "Segmento": c.segment ?? "",
        "Vendedor": c.seller?.name ?? "",
        "Tipo contato": c.contact_type ?? "",
        "E-mail para envio NFe": c.nfe_email ?? "",
        "Limite de crédito": c.credit_limit != null ? Number(c.credit_limit) : "",
        "Cliente desde": formatDateBR(c.customer_since),
        "Próxima visita": formatDateBR(c.next_visit_at),
        "Regime tributário": c.tax_regime ?? "",
      });
    }

    const buf = await wb.xlsx.writeBuffer();
    const today = new Date().toISOString().split("T")[0];
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="clientes_${today}.xlsx"`);
    res.send(Buffer.from(buf));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha ao exportar clientes" });
  }
}

// Aceita "01/02/2030" (dd/mm/yyyy) ou serial number do Excel (dias desde
// 1899-12-30, incluindo o bug histórico do ano bissexto de 1900 que o próprio
// Excel usa como referência).
function parseExcelDate(value: unknown): Date | null {
  if (value == null || value === "") return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed) return null;
    return new Date(parsed.y, parsed.m - 1, parsed.d);
  }
  const str = String(value).trim();
  const brMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (brMatch) {
    const [, dd, mm, yyyy] = brMatch;
    const date = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const date = new Date(str);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
}

function normalizeDoc(value: unknown): string {
  return String(value ?? "").replace(/\D/g, "");
}

function cellStr(value: unknown): string {
  if (value == null) return "";
  return String(value).trim();
}

function parsePersonType(value: unknown): string | undefined {
  const s = cellStr(value).toLowerCase();
  if (!s) return undefined;
  if (s.includes("jur")) return "legal"; // "Pessoa Jurídica", "Jurídica", "PJ"
  if (s.includes("fis") || s.includes("fís")) return "physical"; // "Pessoa Física", "Física", "PF"
  if (s === "pj") return "legal";
  if (s === "pf") return "physical";
  return undefined;
}

function parseBoolYesNo(value: unknown): boolean {
  const s = cellStr(value).toLowerCase();
  return s === "sim" || s === "yes" || s === "true" || s === "1";
}

interface ImportRowResult {
  row: number;
  message: string;
}

// Recebe um arquivo .xlsx (multer memoryStorage), parseia com o mesmo mapeamento
// de colunas do export e faz upsert por tenant — casando por document (CNPJ/CPF
// normalizado) e, na ausência dele, por external_code (coluna "Código"). Nunca
// aborta a importação inteira por causa de uma linha ruim: cada erro de linha é
// coletado em `errors` e a linha é pulada.
export async function importCustomers(req: Request, res: Response) {
  try {
    const tenantId = getTenantId(req);
    if (!req.file) {
      res.status(400).json({ error: "Nenhum arquivo enviado" });
      return;
    }

    const workbook = XLSX.read(req.file.buffer, { type: "buffer", cellDates: false });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      res.status(422).json({ error: "Planilha vazia ou sem abas" });
      return;
    }
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

    const sellers = await prisma.seller.findMany({
      where: { tenant_id: tenantId },
      select: { id: true, name: true },
    });
    const sellerByName = new Map(sellers.map((s) => [s.name.trim().toLowerCase(), s.id]));

    let created = 0;
    let updated = 0;
    const errors: ImportRowResult[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const excelRowNumber = i + 2; // linha 1 é o cabeçalho

      try {
        const name = cellStr(row["Nome"]);
        if (!name) {
          errors.push({ row: excelRowNumber, message: "Nome não informado — linha ignorada" });
          continue;
        }

        const document = normalizeDoc(row["CNPJ/CPF"]);
        const externalCode = cellStr(row["Código"]);

        // Casa por document (normalizado) OU, se document vier vazio, por external_code.
        let existing = null;
        if (document) {
          existing = await prisma.customer.findFirst({
            where: { tenant_id: tenantId, document },
          });
        }
        if (!existing && externalCode) {
          existing = await prisma.customer.findFirst({
            where: { tenant_id: tenantId, external_code: externalCode },
          });
        }

        const sellerName = cellStr(row["Vendedor"]);
        const sellerId = sellerName ? sellerByName.get(sellerName.toLowerCase()) ?? null : undefined;

        const personType = parsePersonType(row["Tipo pessoa"]);

        const creditLimitRaw = row["Limite de crédito"];
        const creditLimit = creditLimitRaw !== "" && creditLimitRaw != null && !Number.isNaN(Number(creditLimitRaw))
          ? Number(creditLimitRaw)
          : undefined;

        // Monta o objeto só com os campos que vieram preenchidos na linha — no
        // update isso preserva dados existentes que a planilha não trouxe (nunca
        // sobrescreve com string vazia).
        const fields: Record<string, unknown> = {};
        const setIfPresent = (key: string, value: unknown) => {
          if (value !== undefined && value !== "" && value !== null) fields[key] = value;
        };

        setIfPresent("name", name);
        setIfPresent("trade_name", cellStr(row["Fantasia"]) || undefined);
        setIfPresent("address_street", cellStr(row["Endereço"]) || undefined);
        setIfPresent("address_number", cellStr(row["Número"]) || undefined);
        setIfPresent("address_complement", cellStr(row["Complemento"]) || undefined);
        setIfPresent("address_district", cellStr(row["Bairro"]) || undefined);
        setIfPresent("address_zip", cellStr(row["CEP"]).replace(/\D/g, "") || undefined);
        setIfPresent("address_city", cellStr(row["Cidade"]) || undefined);
        setIfPresent("address_state", cellStr(row["UF"]) || undefined);
        setIfPresent("contact_name", cellStr(row["Contatos"]) || undefined);
        setIfPresent("phone", cellStr(row["Fone"]).replace(/\D/g, "") || undefined);
        setIfPresent("fax", cellStr(row["Fax"]).replace(/\D/g, "") || undefined);
        setIfPresent("email", cellStr(row["E-mail"]) || undefined);
        setIfPresent("website", cellStr(row["Web Site"]) || undefined);
        if (personType) fields.person_type = personType;
        setIfPresent("document", document || undefined);
        setIfPresent("state_registration", cellStr(row["IE/RG"]) || undefined);
        fields.state_registration_exempt = parseBoolYesNo(row["IE isento"]);
        setIfPresent("status", cellStr(row["Situação"]).toLowerCase().includes("inativ") ? "inactive" : cellStr(row["Situação"]) ? "active" : undefined);
        setIfPresent("notes", cellStr(row["Observações"]) || undefined);
        setIfPresent("marital_status", cellStr(row["Estado civil"]) || undefined);
        setIfPresent("profession", cellStr(row["Profissão"]) || undefined);
        setIfPresent("gender", cellStr(row["Sexo"]) || undefined);
        const birthDate = parseExcelDate(row["Data nasc."]);
        if (birthDate) fields.birth_date = birthDate;
        setIfPresent("birthplace", cellStr(row["Naturalidade"]) || undefined);
        setIfPresent("father_name", cellStr(row["Nome pai"]) || undefined);
        setIfPresent("father_document", normalizeDoc(row["CPF pai"]) || undefined);
        setIfPresent("mother_name", cellStr(row["Nome mãe"]) || undefined);
        setIfPresent("mother_document", normalizeDoc(row["CPF mãe"]) || undefined);
        setIfPresent("segment", cellStr(row["Segmento"]) || undefined);
        if (sellerId !== undefined) fields.seller_id = sellerId;
        setIfPresent("contact_type", cellStr(row["Tipo contato"]) || undefined);
        setIfPresent("nfe_email", cellStr(row["E-mail para envio NFe"]) || undefined);
        if (creditLimit !== undefined) fields.credit_limit = creditLimit;
        const customerSince = parseExcelDate(row["Cliente desde"]);
        if (customerSince) fields.customer_since = customerSince;
        const nextVisit = parseExcelDate(row["Próxima visita"]);
        if (nextVisit) fields.next_visit_at = nextVisit;
        setIfPresent("tax_regime", cellStr(row["Regime tributário"]) || undefined);
        if (externalCode) fields.external_code = externalCode;

        if (existing) {
          await prisma.customer.updateMany({
            where: { id: existing.id, tenant_id: tenantId },
            data: fields,
          });
          updated++;
        } else {
          await prisma.customer.create({
            data: {
              tenant_id: tenantId,
              name,
              ...fields,
            } as Parameters<typeof prisma.customer.create>[0]["data"],
          });
          created++;
        }
      } catch (rowErr) {
        const message = rowErr instanceof Error ? rowErr.message : "Erro desconhecido ao processar linha";
        errors.push({ row: excelRowNumber, message });
      }
    }

    res.json({ created, updated, errors });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha ao importar planilha de clientes" });
  }
}
