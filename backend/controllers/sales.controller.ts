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

interface ServiceItemInput { id: number; name: string; price: number }

export async function createSale(req: Request, res: Response) {
  const { items, services, customerName, totalAmount, paymentMethod, discount, surcharge, sellerId, passFeeToCustomer, passFeeByMethod } = req.body as {
    items: SaleItemInput[];
    services?: ServiceItemInput[];
    customerName?: string;
    totalAmount: number;
    paymentMethod?: string;
    discount?: number;
    surcharge?: number;
    sellerId?: number;
    passFeeToCustomer?: boolean;
    passFeeByMethod?: Record<string, boolean>;
  };

  // Resolve se um segmento de pagamento repassa taxa ao cliente
  const isPassFeeForSegment = (method: string): boolean => {
    if (passFeeByMethod && passFeeByMethod[method] !== undefined) return !!passFeeByMethod[method];
    return !!passFeeToCustomer;
  };

  try {
    const tenantId = getTenantId(req);

    // Load tenant card fees to compute machine fee internally
    const tenantData = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { card_fees: true },
    });
    const cardFees = (tenantData?.card_fees ?? {}) as Record<string, number[]>;

    // Calculate machine fee for all payment methods (credit, debit, pix)
    const pmString    = paymentMethod || "money";
    const pmSegments  = parsePaymentMethod(pmString);
    const machineFee  = pmSegments.reduce((sum, seg) => {
      if (seg.amount <= 0) return sum;
      let rate = 0;
      if (seg.method === "credit") rate = cardFees[seg.brand]?.[seg.installments - 1] ?? 0;
      else if (seg.method === "debit") rate = cardFees[`debit_${seg.brand}`]?.[0] ?? 0;
      else if (seg.method === "pix")   rate = cardFees["pix"]?.[0] ?? 0;
      return sum + seg.amount * (rate / 100);
    }, 0);

    const discountVal  = discount && discount > 0 ? Number(discount) : 0;
    const surchargeVal = surcharge && surcharge > 0 ? Number(surcharge) : 0;
    const roundedFee   = Math.round(machineFee * 100) / 100;

    // gross = valor dos itens sem desconto nem acréscimo
    const grossAmount  = Math.round((totalAmount + discountVal - surchargeVal) * 100) / 100;

    // Taxa repassada ao cliente (soma dos segmentos com repasse ativo)
    const passedFee = pmSegments.reduce((sum, seg) => {
      if (!isPassFeeForSegment(seg.method) || seg.amount <= 0) return sum;
      let rate = 0;
      if (seg.method === "credit") rate = cardFees[seg.brand]?.[seg.installments - 1] ?? 0;
      else if (seg.method === "debit") rate = cardFees[`debit_${seg.brand}`]?.[0] ?? 0;
      else if (seg.method === "pix")   rate = cardFees["pix"]?.[0] ?? 0;
      return sum + seg.amount * (rate / 100);
    }, 0);
    const roundedPassedFee = Math.round(passedFee * 100) / 100;

    // Líquido: se taxa repassada ao cliente, a loja fica com o totalAmount inteiro menos apenas a taxa absorvida
    // (totalAmount já inclui o passedFee, então subtrai só a taxa que a loja absorve = roundedFee - roundedPassedFee)
    const absorbedFee = Math.round((roundedFee - roundedPassedFee) * 100) / 100;
    const netAmount = Math.round((totalAmount - absorbedFee) * 100) / 100;

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
    const surchargeNote  = surchargeVal > 0 ? ` (acrés. R$ ${surchargeVal.toFixed(2)})` : "";
    const feeNote        = roundedPassedFee > 0 ? ` (taxa repassada R$ ${roundedPassedFee.toFixed(2)})` : "";
    const now            = new Date();

    // Quando taxa é repassada ao cliente: gross = totalAmount (inclui taxa), net = totalAmount, fee aparece como informativo
    // Quando loja absorve: gross = valor dos itens, net = totalAmount - taxa
    await prisma.finance.create({
      data: {
        tenant_id:       tenantId,
        type:            "income",
        description:     `Venda PDV #${order.id} — ${methodSummary}${discountNote}${surchargeNote}${feeNote}`,
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
