import type { Request, Response } from "express";
import { prisma } from "../config/prisma";
import type { AuthenticatedRequest } from "../types/auth";

function getTenantId(req: Request) {
  return (req as AuthenticatedRequest).user.tenantId;
}

export async function listQuotes(req: Request, res: Response) {
  try {
    const tenantId = getTenantId(req);
    const quotes = await prisma.quote.findMany({
      where: { tenant_id: tenantId },
      include: { items: true },
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
      include: { items: true },
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
      },
      include: { items: true },
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

export async function convertToOrder(req: Request, res: Response) {
  try {
    const tenantId = getTenantId(req);
    const quoteId = Number(req.params.id);

    const quote = await prisma.quote.findFirst({
      where: { id: quoteId, tenant_id: tenantId },
      include: { items: true },
    });
    if (!quote) return res.status(404).json({ error: "Orçamento não encontrado" });
    if (quote.status === "converted") return res.status(400).json({ error: "Orçamento já foi convertido em venda" });

    const { payment_method } = req.body;

    const order = await prisma.order.create({
      data: {
        tenant_id: tenantId,
        customer_name: quote.customer_name,
        customer_phone: quote.customer_phone || undefined,
        total_amount: quote.total_amount,
        status: "completed",
        payment_method: payment_method || "money",
        items: {
          create: quote.items.map((i) => ({
            product_id: i.product_id!,
            quantity: i.quantity,
            unit_price: i.unit_price,
          })),
        },
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

    const methodLabel: Record<string, string> = { money: "Dinheiro", card: "Cartão", pix: "PIX" };
    await prisma.finance.create({
      data: {
        tenant_id: tenantId,
        type: "income",
        description: `Venda (Orç. #${quote.number}) — ${methodLabel[payment_method] ?? payment_method ?? "Dinheiro"}`,
        amount: quote.total_amount,
        date: new Date(),
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
