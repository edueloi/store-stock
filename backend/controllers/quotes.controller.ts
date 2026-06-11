import type { Request, Response } from "express";
import { prisma } from "../config/prisma";
import type { AuthenticatedRequest } from "../types/auth";
import { localDateString } from "../utils/date";

function getTenantId(req: Request) {
  return (req as AuthenticatedRequest).user.tenantId;
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
      include: { items: true, services: true },
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
      subtotal,
      discount_type,
      discount_value,
      total_amount,
      validity_days,
      notes,
      items,
      services,
    } = req.body;

    const quote = await prisma.quote.create({
      data: {
        tenant_id: tenantId,
        number: nextNumber,
        customer_name,
        customer_phone: customer_phone || null,
        customer_email: customer_email || null,
        customer_id: customer_id || null,
        subtotal,
        discount_type: discount_type || "percent",
        discount_value: discount_value || 0,
        total_amount,
        validity_days: validity_days || 7,
        notes: notes || null,
        status: "open",
        items: {
          create: (items as Array<{ product_id?: number; name: string; quantity: number; unit_price: number; total: number }>).map((i) => ({
            product_id: i.product_id || null,
            name: i.name,
            quantity: i.quantity,
            unit_price: i.unit_price,
            total: i.total,
          })),
        },
        ...(services && services.length > 0 ? {
          services: {
            create: (services as Array<{ id: number; name: string; price: number; quantity?: number }>).map((s) => ({
              service_id: s.id,
              name: s.name,
              unit_price: s.price,
              quantity: s.quantity ?? 1,
              total: s.price * (s.quantity ?? 1),
            })),
          },
        } : {}),
      },
      include: { items: true, services: true },
    });

    res.json(quote);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha ao criar orçamento" });
  }
}

export async function updateQuoteStatus(req: Request, res: Response) {
  try {
    const tenantId = getTenantId(req);
    const { status } = req.body;
    const quote = await prisma.quote.updateMany({
      where: { id: Number(req.params.id), tenant_id: tenantId },
      data: { status },
    });
    res.json({ success: true, count: quote.count });
  } catch {
    res.status(500).json({ error: "Falha ao atualizar status" });
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
    const discountVal = Number(quote.discount_value ?? 0);
    const grossAmount = Math.round((totalAmount + discountVal) * 100) / 100;
    const netAmount   = Math.round((totalAmount - roundedFee) * 100) / 100;

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
        await prisma.product.update({
          where: { id: item.product_id },
          data: { stock_quantity: { decrement: item.quantity } },
        });
      }
    }

    const methodSummary = buildMethodSummary(pmString);
    await prisma.finance.create({
      data: {
        tenant_id:       tenantId,
        type:            "income",
        description:     `Venda (Orç. #${quote.number}) — ${methodSummary}`,
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

    res.json({ success: true, orderId: order.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha ao converter orçamento" });
  }
}
