import type { Request, Response } from "express";

import { prisma } from "../config/prisma";
import type { AuthenticatedRequest } from "../types/auth";

function getTenantId(req: Request) {
  return (req as AuthenticatedRequest).user.tenantId;
}

interface SaleItemInput {
  id: number;
  quantity: number;
  price: number;
}

// Parses "credit-visa-2x:120.00|money:30.00" into structured segments
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

export async function createSale(req: Request, res: Response) {
  const { items, customerName, totalAmount, paymentMethod, discount, sellerId } = req.body as {
    items: SaleItemInput[];
    customerName?: string;
    totalAmount: number;
    paymentMethod?: string;
    discount?: number;
    sellerId?: number;
  };

  try {
    const tenantId = getTenantId(req);

    // Load tenant card fees to compute machine fee internally
    const tenantData = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { card_fees: true },
    });
    const cardFees = (tenantData?.card_fees ?? {}) as Record<string, number[]>;

    // Calculate machine fee from credit payments
    const pmString    = paymentMethod || "money";
    const pmSegments  = parsePaymentMethod(pmString);
    const machineFee  = pmSegments.reduce((sum, seg) => {
      if (seg.method !== "credit" || seg.amount <= 0) return sum;
      const rate = cardFees[seg.brand]?.[seg.installments - 1] ?? 0;
      return sum + seg.amount * (rate / 100);
    }, 0);

    const discountVal  = discount && discount > 0 ? Number(discount) : 0;
    const roundedFee   = Math.round(machineFee * 100) / 100;
    const grossAmount  = Math.round((totalAmount + discountVal) * 100) / 100;

    // load seller name to denormalize
    let sellerName: string | null = null;
    if (sellerId) {
      const seller = await prisma.seller.findUnique({ where: { id: sellerId }, select: { name: true } });
      sellerName = seller?.name ?? null;
    }

    const order = await prisma.order.create({
      data: {
        tenant_id:       tenantId,
        seller_id:       sellerId ?? null,
        seller_name:     sellerName,
        customer_name:   customerName || "Balcão",
        total_amount:    totalAmount,
        gross_amount:    grossAmount,
        discount_amount: discountVal > 0 ? discountVal : null,
        fee_amount:      roundedFee > 0 ? roundedFee : null,
        status:          "completed",
        payment_method:  pmString,
        items: {
          create: items.map((item) => ({
            product_id: item.id,
            quantity: item.quantity,
            unit_price: item.price,
          })),
        },
      },
    });

    for (const item of items) {
      await prisma.product.update({
        where: { id: item.id },
        data: { stock_quantity: { decrement: item.quantity } },
      });
    }

    const methodSummary  = buildMethodSummary(pmString);
    const discountNote   = discountVal > 0 ? ` (desc. R$ ${discountVal.toFixed(2)})` : "";
    const now            = new Date();
    const netAmount      = Math.round((totalAmount - roundedFee) * 100) / 100;

    // Receita: líquido = após desconto e taxa. gross = antes do desconto.
    await prisma.finance.create({
      data: {
        tenant_id:       tenantId,
        type:            "income",
        description:     `Venda PDV #${order.id} — ${methodSummary}${discountNote}`,
        amount:          netAmount,
        gross_amount:    grossAmount,
        fee_amount:      roundedFee > 0 ? roundedFee : null,
        discount_amount: discountVal > 0 ? discountVal : null,
        date:            now,
      },
    });

    res.json({ success: true, orderId: order.id });
  } catch {
    res.status(500).json({ error: "Sale failed" });
  }
}
