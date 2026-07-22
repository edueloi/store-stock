import type { Request, Response } from "express";
import { prisma } from "../config/prisma";
import type { AuthenticatedRequest } from "../types/auth";
import { localDateString } from "../utils/date";

function getTenantId(req: Request) {
  return (req as AuthenticatedRequest).user.tenantId;
}

function getActor(req: Request): string {
  const u = (req as AuthenticatedRequest).user;
  return (u as any).name ?? (u as any).email ?? "Sistema";
}

const QUOTE_INCLUDE = {
  items: true,
  services: true,
  actions: { orderBy: { created_at: "desc" as const } },
};

async function logQuoteAction(
  tenantId: number,
  quoteId: number,
  action: string,
  opts?: { fromStatus?: string; toStatus?: string; actor?: string; note?: string; meta?: object },
) {
  await prisma.quoteAction.create({
    data: {
      tenant_id: tenantId,
      quote_id: quoteId,
      action,
      from_status: opts?.fromStatus ?? null,
      to_status: opts?.toStatus ?? null,
      actor: opts?.actor ?? null,
      note: opts?.note ?? null,
      meta: opts?.meta ?? undefined,
    },
  });
}

async function recomputeQuoteTotals(quoteId: number) {
  const quote = await prisma.quote.findUnique({
    where: { id: quoteId },
    include: { items: true, services: true },
  });
  if (!quote) return;
  const itemsSubtotal = quote.items.reduce((sum, i) => sum + Number(i.total), 0);
  const servicesSubtotal = quote.services.reduce((sum, s) => sum + Number(s.total), 0);
  const subtotal = itemsSubtotal + servicesSubtotal;
  const discountAmt = quote.discount_type === "percent"
    ? (subtotal * Number(quote.discount_value)) / 100
    : Math.min(Number(quote.discount_value), subtotal);
  const totalAmount = Math.max(0, Math.round((subtotal - discountAmt) * 100) / 100);
  await prisma.quote.update({
    where: { id: quoteId },
    data: { subtotal, total_amount: totalAmount },
  });
  return { subtotal, totalAmount };
}

export async function listQuotes(req: Request, res: Response) {
  try {
    const tenantId = getTenantId(req);
    const quotes = await prisma.quote.findMany({
      where: { tenant_id: tenantId },
      include: { items: true, services: true },
      orderBy: { created_at: "desc" },
    });
    res.json(quotes);
  } catch {
    res.status(500).json({ error: "Falha ao listar orçamentos" });
  }
}

export async function getQuoteById(req: Request, res: Response) {
  try {
    const tenantId = getTenantId(req);
    const quote = await prisma.quote.findFirst({
      where: { id: Number(req.params.id), tenant_id: tenantId },
      include: QUOTE_INCLUDE,
    });
    if (!quote) return res.status(404).json({ error: "Orçamento não encontrado" });
    res.json(quote);
  } catch {
    res.status(500).json({ error: "Falha ao buscar orçamento" });
  }
}

export async function createQuote(req: Request, res: Response) {
  try {
    const tenantId = getTenantId(req);

    const last = await prisma.quote.findFirst({
      where: { tenant_id: tenantId },
      orderBy: { number: "desc" },
      select: { number: true },
    });
    const nextNumber = (last?.number ?? 0) + 1;

    const {
      customer_name,
      customer_phone,
      customer_email,
      customer_id,
      discount_type,
      discount_value,
      validity_days,
      notes,
      items,
      services,
    } = req.body as {
      customer_name: string;
      customer_phone?: string;
      customer_email?: string;
      customer_id?: number;
      discount_type?: string;
      discount_value?: number;
      validity_days?: number;
      notes?: string;
      items: Array<{ product_id?: number; name: string; quantity: number; unit_price: number; total: number; dimensions_label?: string | null }>;
      services?: Array<{ id: number; name: string; price: number; quantity?: number }>;
    };

    // Nunca confia no subtotal/total mandado pelo cliente — recalcula a partir
    // dos itens/serviços e do desconto, no mesmo padrão já usado em ServiceOrder.
    const itemRows = (items ?? []).map((i) => ({
      product_id: i.product_id || null,
      name: i.name,
      quantity: i.quantity,
      unit_price: i.unit_price,
      total: Math.round(i.unit_price * i.quantity * 100) / 100,
      dimensions_label: i.dimensions_label || null,
    }));
    const serviceRows = (services ?? []).map((s) => ({
      service_id: s.id,
      name: s.name,
      unit_price: s.price,
      quantity: s.quantity ?? 1,
      total: Math.round(s.price * (s.quantity ?? 1) * 100) / 100,
    }));
    const itemsSubtotal = itemRows.reduce((sum, i) => sum + i.total, 0);
    const servicesSubtotal = serviceRows.reduce((sum, s) => sum + s.total, 0);
    const subtotalComputed = itemsSubtotal + servicesSubtotal;
    const discountTypeVal = discount_type || "percent";
    const discountValueVal = Number(discount_value) || 0;
    const discountAmt = discountTypeVal === "percent"
      ? (subtotalComputed * discountValueVal) / 100
      : Math.min(discountValueVal, subtotalComputed);
    const totalAmountComputed = Math.max(0, Math.round((subtotalComputed - discountAmt) * 100) / 100);

    const quote = await prisma.quote.create({
      data: {
        tenant_id: tenantId,
        number: nextNumber,
        customer_name,
        customer_phone: customer_phone || null,
        customer_email: customer_email || null,
        customer_id: customer_id || null,
        subtotal: subtotalComputed,
        discount_type: discountTypeVal,
        discount_value: discountValueVal,
        total_amount: totalAmountComputed,
        validity_days: validity_days || 7,
        notes: notes || null,
        status: "open",
        items: { create: itemRows },
        ...(serviceRows.length > 0 ? { services: { create: serviceRows } } : {}),
      },
      include: { items: true, services: true },
    });

    await logQuoteAction(tenantId, quote.id, "created", { toStatus: "open", actor: getActor(req) });

    res.json(quote);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha ao criar orçamento" });
  }
}

export async function updateQuoteStatus(req: Request, res: Response) {
  try {
    const tenantId = getTenantId(req);
    const id = Number(req.params.id);
    const { status } = req.body as { status: string };

    const existing = await prisma.quote.findFirst({ where: { id, tenant_id: tenantId } });
    if (!existing) return res.status(404).json({ error: "Orçamento não encontrado" });

    await prisma.quote.update({ where: { id }, data: { status } });
    await logQuoteAction(tenantId, id, "status_changed", {
      fromStatus: existing.status, toStatus: status, actor: getActor(req),
    });

    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Falha ao atualizar status" });
  }
}

export async function updateQuote(req: Request, res: Response) {
  try {
    const tenantId = getTenantId(req);
    const id = Number(req.params.id);

    const existing = await prisma.quote.findFirst({ where: { id, tenant_id: tenantId } });
    if (!existing) return res.status(404).json({ error: "Orçamento não encontrado" });
    if (existing.status !== "open") {
      return res.status(400).json({ error: "Só é possível editar orçamentos em aberto" });
    }

    const {
      customer_id,
      customer_name,
      customer_phone,
      customer_email,
      discount_type,
      discount_value,
      validity_days,
      notes,
      items,
      services,
    } = req.body as {
      customer_id?: number;
      customer_name?: string;
      customer_phone?: string;
      customer_email?: string;
      discount_type?: string;
      discount_value?: number;
      validity_days?: number;
      notes?: string;
      items?: Array<{ product_id?: number; name: string; quantity: number; unit_price: number; dimensions_label?: string | null }>;
      services?: Array<{ id: number; name: string; price: number; quantity?: number }>;
    };

    // Substitui items/services por completo (delete + recreate) dentro de uma
    // transaction — mais simples e correto do que tentar reconciliar linha a linha.
    await prisma.$transaction([
      prisma.quoteItem.deleteMany({ where: { quote_id: id } }),
      prisma.quoteService.deleteMany({ where: { quote_id: id } }),
    ]);

    await prisma.quote.update({
      where: { id },
      data: {
        ...(customer_id !== undefined && { customer_id: customer_id || null }),
        ...(customer_name !== undefined && { customer_name }),
        ...(customer_phone !== undefined && { customer_phone: customer_phone || null }),
        ...(customer_email !== undefined && { customer_email: customer_email || null }),
        ...(discount_type !== undefined && { discount_type }),
        ...(discount_value !== undefined && { discount_value }),
        ...(validity_days !== undefined && { validity_days }),
        ...(notes !== undefined && { notes: notes || null }),
        items: {
          create: (items ?? []).map((i) => ({
            product_id: i.product_id || null,
            name: i.name,
            quantity: i.quantity,
            unit_price: i.unit_price,
            total: Math.round(i.unit_price * i.quantity * 100) / 100,
            dimensions_label: i.dimensions_label || null,
          })),
        },
        ...(services && services.length > 0 ? {
          services: {
            create: services.map((s) => ({
              service_id: s.id,
              name: s.name,
              unit_price: s.price,
              quantity: s.quantity ?? 1,
              total: Math.round(s.price * (s.quantity ?? 1) * 100) / 100,
            })),
          },
        } : {}),
      },
    });

    await recomputeQuoteTotals(id);
    await logQuoteAction(tenantId, id, "edited", { actor: getActor(req) });

    const updated = await prisma.quote.findFirst({ where: { id, tenant_id: tenantId }, include: QUOTE_INCLUDE });
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha ao atualizar orçamento" });
  }
}

export async function recordQuoteDeposit(req: Request, res: Response) {
  try {
    const tenantId = getTenantId(req);
    const id = Number(req.params.id);

    const quote = await prisma.quote.findFirst({ where: { id, tenant_id: tenantId } });
    if (!quote) return res.status(404).json({ error: "Orçamento não encontrado" });
    if (quote.status !== "open") {
      return res.status(400).json({ error: "Só é possível registrar entrada em orçamentos em aberto" });
    }

    const { amount, payment_method } = req.body as { amount: number; payment_method?: string };
    const depositAmount = Number(amount) || 0;
    if (depositAmount <= 0) return res.status(400).json({ error: "Valor da entrada inválido" });
    if (depositAmount > Number(quote.total_amount)) {
      return res.status(400).json({ error: "A entrada não pode ser maior que o total do orçamento" });
    }

    const pmString = payment_method || "money";
    const now = new Date();

    await prisma.quote.update({
      where: { id },
      data: {
        deposit_amount: depositAmount,
        deposit_payment_method: pmString,
        deposit_paid_at: now,
      },
    });

    const methodSummary = buildMethodSummary(pmString);
    await prisma.finance.create({
      data: {
        tenant_id: tenantId,
        type: "income",
        description: `Entrada — Orç. #${quote.number} — ${methodSummary}`,
        amount: depositAmount,
        gross_amount: depositAmount,
        date: localDateString(),
      },
    });

    await logQuoteAction(tenantId, id, "deposit_recorded", {
      actor: getActor(req),
      note: `Entrada de ${depositAmount.toFixed(2)} (${methodSummary})`,
      meta: { amount: depositAmount, payment_method: pmString },
    });

    const updated = await prisma.quote.findFirst({ where: { id, tenant_id: tenantId }, include: QUOTE_INCLUDE });
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha ao registrar entrada" });
  }
}

export async function deleteQuote(req: Request, res: Response) {
  try {
    const tenantId = getTenantId(req);
    await prisma.quote.deleteMany({
      where: { id: Number(req.params.id), tenant_id: tenantId },
    });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Falha ao deletar orçamento" });
  }
}

// ── shared helpers (mirrored from sales.controller) ─────────────────────────
function parsePaymentMethod(pm: string) {
  return pm.split("|").map((seg) => {
    const [methodPart, amountStr] = seg.split(":");
    const tokens = methodPart.split("-");
    return {
      method:       tokens[0] ?? "money",
      brand:        tokens[1] ?? "other",
      installments: tokens[2] ? parseInt(tokens[2].replace("x", ""), 10) : 1,
      amount:       parseFloat(amountStr ?? "0") || 0,
    };
  });
}

function buildMethodSummary(pm: string) {
  const labels: Record<string, string> = { money: "Dinheiro", pix: "PIX", debit: "Débito", credit: "Crédito" };
  return parsePaymentMethod(pm).map(({ method, brand, installments }) => {
    const b = brand && brand !== "other" ? `/${brand.toUpperCase()}` : "";
    const i = method === "credit" && installments > 1 ? ` ${installments}X` : "";
    return `${labels[method] ?? method}${b}${i}`;
  }).join(" + ");
}

export async function convertToOrder(req: Request, res: Response) {
  try {
    const tenantId = getTenantId(req);
    const quoteId  = Number(req.params.id);

    const quote = await prisma.quote.findFirst({
      where: { id: quoteId, tenant_id: tenantId },
      include: { items: true, services: true },
    });
    if (!quote) return res.status(404).json({ error: "Orçamento não encontrado" });
    if (quote.status === "converted") return res.status(400).json({ error: "Orçamento já foi convertido em venda" });

    const { payment_method, seller_id } = req.body as {
      payment_method?: string;
      seller_id?: number;
    };

    const pmString = payment_method || "money";

    // Load tenant card fees to compute machine fee
    const tenantData = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { card_fees: true },
    });
    const cardFees = (tenantData?.card_fees ?? {}) as Record<string, number[]>;

    // Calculate machine fee from credit segments
    const pmSegments = parsePaymentMethod(pmString);
    const machineFee = pmSegments.reduce((sum, seg) => {
      if (seg.method !== "credit" || seg.amount <= 0) return sum;
      const rate = cardFees[seg.brand]?.[seg.installments - 1] ?? 0;
      return sum + seg.amount * (rate / 100);
    }, 0);
    const roundedFee  = Math.round(machineFee * 100) / 100;
    const totalAmount = Number(quote.total_amount);
    const depositAmount = Number(quote.deposit_amount ?? 0);
    const amountDue   = Math.max(0, Math.round((totalAmount - depositAmount) * 100) / 100);
    const discountVal = Number(quote.discount_value ?? 0);
    const grossAmount = Math.round((totalAmount + discountVal) * 100) / 100;
    const netAmount   = Math.round((amountDue - roundedFee) * 100) / 100;

    // Load seller name
    let sellerName: string | null = null;
    if (seller_id) {
      const seller = await prisma.seller.findUnique({ where: { id: seller_id }, select: { name: true } });
      sellerName = seller?.name ?? null;
    }

    const order = await prisma.order.create({
      data: {
        tenant_id:       tenantId,
        seller_id:       seller_id ?? null,
        seller_name:     sellerName,
        customer_name:   quote.customer_name,
        customer_phone:  quote.customer_phone || undefined,
        total_amount:    totalAmount,
        gross_amount:    grossAmount,
        discount_amount: discountVal > 0 ? discountVal : null,
        fee_amount:      roundedFee > 0 ? roundedFee : null,
        status:          "completed",
        payment_method:  pmString,
        items: {
          create: quote.items.filter((i) => i.product_id).map((i) => ({
            product_id: i.product_id!,
            quantity:   i.quantity,
            unit_price: i.unit_price,
            dimensions_label: i.dimensions_label,
          })),
        },
        ...(quote.services.length > 0 ? {
          services: {
            create: quote.services.map((s) => ({
              service_id: s.service_id,
              name:       s.name,
              unit_price: s.unit_price,
              quantity:   s.quantity,
            })),
          },
        } : {}),
      },
    });

    for (const item of quote.items) {
      if (item.product_id) {
        const product = await prisma.product.findUnique({
          where: { id: item.product_id },
          select: { sale_unit: true },
        });
        // Produtos por medida (m²/linear) não têm controle de estoque.
        if (product?.sale_unit && product.sale_unit !== "unidade") continue;
        await prisma.product.update({
          where: { id: item.product_id },
          data: { stock_quantity: { decrement: item.quantity } },
        });
      }
    }

    const methodSummary = buildMethodSummary(pmString);
    const depositNote = depositAmount > 0 ? ` (saldo após entrada de ${depositAmount.toFixed(2)})` : "";
    await prisma.finance.create({
      data: {
        tenant_id:       tenantId,
        type:            "income",
        description:     `Venda (Orç. #${quote.number}) — ${methodSummary}${depositNote}`,
        amount:          netAmount,
        gross_amount:    grossAmount,
        fee_amount:      roundedFee > 0 ? roundedFee : null,
        discount_amount: discountVal > 0 ? discountVal : null,
        date:            localDateString(),
      },
    });

    await prisma.quote.update({
      where: { id: quoteId },
      data: { status: "converted", converted_order_id: order.id },
    });

    await logQuoteAction(tenantId, quoteId, "converted", {
      fromStatus: quote.status, toStatus: "converted", actor: getActor(req), meta: { order_id: order.id },
    });

    res.json({ success: true, orderId: order.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha ao converter orçamento" });
  }
}

// ── Auto-expiração de orçamentos ──────────────────────────────────────────────
// Mesmo padrão do único job em background já existente no projeto
// (startWhatsappMaintenanceLoop, backend/services/whatsapp.service.ts).

const QUOTE_EXPIRATION_INTERVAL_MS = 24 * 60 * 60 * 1000;
let quoteExpirationStarted = false;

export async function runQuoteExpirationJob() {
  try {
    const openQuotes = await prisma.quote.findMany({
      where: { status: "open" },
      select: { id: true, tenant_id: true, created_at: true, validity_days: true },
    });

    const now = Date.now();
    for (const q of openQuotes) {
      const expiresAt = new Date(q.created_at).getTime() + q.validity_days * 24 * 60 * 60 * 1000;
      if (expiresAt >= now) continue;

      await prisma.quote.update({ where: { id: q.id }, data: { status: "expired" } });
      await logQuoteAction(q.tenant_id, q.id, "expired", { fromStatus: "open", toStatus: "expired" });
    }
  } catch (err) {
    console.error("Quote expiration job failed:", err);
  }
}

export function startQuoteExpirationLoop() {
  if (quoteExpirationStarted) return;
  quoteExpirationStarted = true;

  const timer = setInterval(() => {
    runQuoteExpirationJob().catch((error) => {
      console.error("Quote expiration job failed:", error);
    });
  }, QUOTE_EXPIRATION_INTERVAL_MS);

  timer.unref?.();
}
