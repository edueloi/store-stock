import type { Request, Response } from "express";

import { prisma } from "../config/prisma";
import type { AuthenticatedRequest } from "../types/auth";
import { awardPointsForOrder } from "./loyalty.controller";
import { localDateString } from "../utils/date";
import { emitirNfce } from "../services/nfce/emitir";

function getTenantId(req: Request) {
  return (req as AuthenticatedRequest).user.tenantId;
}

// Erro com status HTTP explícito, para que tanto createSale quanto quem mais
// chamar finalizeSaleOrder (ex.: faturamento de consignação) possam traduzi-lo
// para a resposta HTTP apropriada.
export class SaleError extends Error {
  status: number;
  extra?: Record<string, unknown>;
  constructor(status: number, message: string, extra?: Record<string, unknown>) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

interface SaleItemInput {
  id: number;
  quantity: number;
  price: number;
  selectedOptions?: Record<string, string> | null;
  dimensionsLabel?: string | null;
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

interface FinalizeSaleParams {
  tenantId: number;
  items: SaleItemInput[];
  services?: ServiceItemInput[];
  customerName?: string;
  customerId?: number;
  totalAmount: number;
  paymentMethod?: string;
  discount?: number;
  surcharge?: number;
  sellerId?: number;
  passFeeToCustomer?: boolean;
  passFeeByMethod?: Record<string, boolean>;
  clientSaleId?: string | null;
  soldAtDate?: string;
  // false quando o estoque dos itens já foi debitado antes (ex.: saída da consignação)
  decrementStock: boolean;
  // descrição customizada da entrada financeira (ex.: "Consignação #12 — Venda")
  descriptionPrefix?: string;
}

// Núcleo compartilhado de "virar uma venda de verdade": taxas de cartão, criação de
// Order/OrderItem/OrderService, débito de estoque (opcional), Finance, fidelidade e NFC-e.
// Usado tanto pelo PDV normal (createSale) quanto pelo faturamento de consignação, para
// garantir que ambos os caminhos produzam exatamente o mesmo resultado.
async function finalizeSaleOrder(params: FinalizeSaleParams): Promise<{ orderId: number }> {
  const {
    tenantId, items, services, customerName, customerId, totalAmount, paymentMethod,
    discount, surcharge, sellerId, passFeeToCustomer, passFeeByMethod, clientSaleId,
    soldAtDate, decrementStock, descriptionPrefix,
  } = params;

  // Resolve se um segmento de pagamento repassa taxa ao cliente
  const isPassFeeForSegment = (method: string): boolean => {
    if (passFeeByMethod && passFeeByMethod[method] !== undefined) return !!passFeeByMethod[method];
    return !!passFeeToCustomer;
  };

  {
    // Idempotency: offline-queued sales retry with the same clientSaleId —
    // if this sale was already processed, acknowledge it without duplicating
    if (clientSaleId) {
      const existing = await prisma.order.findUnique({
        where: { client_sale_id: clientSaleId },
        select: { id: true, tenant_id: true },
      });
      if (existing && existing.tenant_id === tenantId) {
        return { orderId: existing.id };
      }
    }

    // Load tenant card fees to compute machine fee internally
    const tenantData = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { card_fees: true },
    });
    const cardFees = (tenantData?.card_fees ?? {}) as Record<string, number[]>;

    const pmString    = paymentMethod || "money";
    const pmSegments  = parsePaymentMethod(pmString);

    const discountVal  = discount && discount > 0 ? Number(discount) : 0;
    const surchargeVal = surcharge && surcharge > 0 ? Number(surcharge) : 0;

    // gross = valor dos itens sem desconto nem acréscimo
    const grossAmount  = Math.round((totalAmount + discountVal - surchargeVal) * 100) / 100;

    // Taxa da maquininha incide sobre o valor EFETIVAMENTE PAGO (já com desconto),
    // nunca sobre o bruto. Como seg.amount pode vir desatualizado (ex.: valor fixado
    // antes do desconto), normalizamos cada segmento pelo fator de desconto:
    //   fator = (gross - desconto) / gross  →  proporção do que sobra após o desconto.
    const discountFactor = grossAmount > 0 ? Math.max(0, (grossAmount - discountVal) / grossAmount) : 1;
    const rateForSeg = (seg: typeof pmSegments[number]): number => {
      if (seg.method === "credit") return cardFees[seg.brand]?.[seg.installments - 1] ?? 0;
      if (seg.method === "debit")  return cardFees[`debit_${seg.brand}`]?.[0] ?? 0;
      if (seg.method === "pix")    return cardFees["pix"]?.[0] ?? 0;
      return 0;
    };

    // Calculate machine fee for all payment methods (credit, debit, pix)
    const machineFee  = pmSegments.reduce((sum, seg) => {
      if (seg.amount <= 0) return sum;
      const base = seg.amount * discountFactor; // base com desconto aplicado
      return sum + base * (rateForSeg(seg) / 100);
    }, 0);
    const roundedFee   = Math.round(machineFee * 100) / 100;

    // Taxa repassada ao cliente (soma dos segmentos com repasse ativo)
    const passedFee = pmSegments.reduce((sum, seg) => {
      if (!isPassFeeForSegment(seg.method) || seg.amount <= 0) return sum;
      const base = seg.amount * discountFactor;
      return sum + base * (rateForSeg(seg) / 100);
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

    // resolve customer name from id if provided
    let resolvedCustomerName = customerName || "Balcão";
    if (customerId) {
      const cust = await prisma.customer.findFirst({ where: { id: customerId, tenant_id: tenantId }, select: { name: true } });
      if (cust) resolvedCustomerName = cust.name;
    }

    // Validate all products exist before creating the order (skip if services-only sale)
    const productIds = items.map(i => i.id);
    if (productIds.length > 0) {
      const existingProducts = await prisma.product.findMany({
        where: { id: { in: productIds }, tenant_id: tenantId },
        select: { id: true },
      });
      const foundIds = existingProducts.map(p => p.id);
      const missingIds = productIds.filter(id => !foundIds.includes(id));
      if (missingIds.length > 0) {
        console.error("[createSale] products not found:", missingIds, "for tenant:", tenantId);
        throw new SaleError(422, "Produto não encontrado", { missingIds });
      }
    }

    console.log("[createSale] creating order, grossAmount:", grossAmount, "netAmount:", netAmount, "fee:", roundedFee);
    const order = await prisma.order.create({
      data: {
        tenant_id:       tenantId,
        seller_id:       sellerId ?? null,
        seller_name:     sellerName,
        customer_name:   resolvedCustomerName,
        customer_id:     customerId ?? null,
        total_amount:    totalAmount,
        gross_amount:    grossAmount,
        discount_amount: discountVal > 0 ? discountVal : null,
        fee_amount:      roundedFee > 0 ? roundedFee : null,
        status:          "completed",
        order_type:      items.length === 0 && services && services.length > 0 ? "services" : (services && services.length > 0 ? "mixed" : "products"),
        payment_method:  pmString,
        client_sale_id:  clientSaleId ?? null,
        items: {
          create: items.map((item) => ({
            product_id: item.id,
            quantity: item.quantity,
            unit_price: item.price,
            dimensions_label: item.dimensionsLabel ?? null,
          })),
        },
        ...(services && services.length > 0 ? {
          services: {
            create: services.map((svc) => ({
              service_id: svc.id,
              name: svc.name,
              unit_price: svc.price,
              quantity: 1,
            })),
          },
        } : {}),
      },
    });

    console.log("[createSale] order created id:", order.id, "— updating stock");
    if (decrementStock) {
      for (const item of items) {
        // Produtos vendidos por medida (m²/linear) não têm controle de estoque —
        // a peça é cortada sob medida, não há como inferir quanto resta em chapa/rolo.
        const productForStock = await prisma.product.findUnique({
          where: { id: item.id },
          select: { sale_unit: true, skus: true, variations: true },
        });
        if (productForStock?.sale_unit && productForStock.sale_unit !== "unidade") {
          continue;
        }

        // decrement total product stock
        await prisma.product.update({
          where: { id: item.id },
          data: { stock_quantity: { decrement: item.quantity } },
        });

        // if item has specific variation options, also decrement the matching SKU in the JSON
        if (item.selectedOptions && Object.keys(item.selectedOptions).length > 0) {
          const product = productForStock;
          if (product?.skus) {
            type SkuEntry = { combo: Record<string, string>; stock: number };
            const skus = product.skus as SkuEntry[];
            const opts = item.selectedOptions;
            const updated = skus.map((sku) => {
              const matches = Object.entries(opts).every(([k, v]) => sku.combo[k] === v);
              if (matches) return { ...sku, stock: Math.max(0, sku.stock - item.quantity) };
              return sku;
            });
            await prisma.product.update({
              where: { id: item.id },
              data: { skus: updated },
            });
          } else if (product?.variations) {
            // legacy variations format: [{ name, options: [{ value, stock }] }]
            type LegacyVariation = { name: string; options: { value: string; stock: number }[] };
            const variations = product.variations as LegacyVariation[];
            const opts = item.selectedOptions;
            const updated = variations.map((v) => ({
              ...v,
              options: v.options.map((o) => {
                const matches = opts[v.name] === o.value;
                return matches ? { ...o, stock: Math.max(0, o.stock - item.quantity) } : o;
              }),
            }));
            await prisma.product.update({
              where: { id: item.id },
              data: { variations: updated },
            });
          }
        }
      }
    } else {
      console.log("[createSale] decrementStock=false — skipping (stock already debited upstream)");
    }

    console.log("[createSale] stock updated — creating finance entry");
    const methodSummary  = buildMethodSummary(pmString);
    const discountNote   = discountVal > 0 ? ` (desc. R$ ${discountVal.toFixed(2)})` : "";
    const surchargeNote  = surchargeVal > 0 ? ` (acrés. R$ ${surchargeVal.toFixed(2)})` : "";
    const feeNote        = roundedPassedFee > 0 ? ` (taxa repassada R$ ${roundedPassedFee.toFixed(2)})` : "";
    // Quando taxa é repassada ao cliente: gross = totalAmount (inclui taxa), net = totalAmount, fee aparece como informativo
    // Quando loja absorve: gross = valor dos itens, net = totalAmount - taxa
    const defaultDescription = items.length === 0
      ? `Serviços PDV #${order.id} — ${methodSummary}${discountNote}${surchargeNote}${feeNote}`
      : (services && services.length > 0
        ? `Venda Mista PDV #${order.id} — ${methodSummary}${discountNote}${surchargeNote}${feeNote}`
        : `Venda PDV #${order.id} — ${methodSummary}${discountNote}${surchargeNote}${feeNote}`);
    await prisma.finance.create({
      data: {
        tenant_id:       tenantId,
        type:            "income",
        description:     descriptionPrefix
          ? `${descriptionPrefix} #${order.id} — ${methodSummary}${discountNote}${surchargeNote}${feeNote}`
          : defaultDescription,
        amount:          netAmount,
        gross_amount:    grossAmount,
        fee_amount:      roundedFee > 0 ? roundedFee : null,
        discount_amount: discountVal > 0 ? discountVal : null,
        payment_method:  pmString,
        source:          items.length === 0 ? "services" : (services && services.length > 0 ? "mixed" : "pdv"),
        order_id:        order.id,
        // offline sales synced later carry the original sale date
        date:            soldAtDate && /^\d{4}-\d{2}-\d{2}$/.test(soldAtDate) ? new Date(soldAtDate + "T00:00:00Z") : localDateString(),
      },
    });

    // award loyalty points if customer is identified
    if (customerId) {
      awardPointsForOrder(tenantId, customerId, order.id, totalAmount).catch(console.error);
    }

    // Emissão de NFC-e: dispara em segundo plano, sem travar a resposta do PDV.
    // A venda já está fechada; o status da nota evolui de forma assíncrona e é
    // consultável via GET /api/nfce/:orderId (reemissão manual em caso de erro).
    try {
      const tenantForNfce = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { nfce_environment: true, nfce_series: true, nfce_next_number: true },
      });
      if (tenantForNfce) {
        const series = tenantForNfce.nfce_series;
        const number = tenantForNfce.nfce_next_number;
        await prisma.tenant.update({
          where: { id: tenantId },
          data: { nfce_next_number: { increment: 1 } },
        });
        await prisma.nfceInvoice.create({
          data: {
            tenant_id: tenantId,
            order_id: order.id,
            status: "pending",
            environment: tenantForNfce.nfce_environment,
            series,
            number,
          },
        });
        emitirNfce(order.id).catch((e) => console.error("[emitirNfce] erro:", e));
      }
    } catch (e) {
      console.error("[createSale] falha ao agendar emissão de NFC-e:", e);
    }

    return { orderId: order.id };
  }
}

export async function createSale(req: Request, res: Response) {
  const { items, services, customerName, customerId, totalAmount, paymentMethod, discount, surcharge, sellerId, passFeeToCustomer, passFeeByMethod, clientSaleId, soldAtDate } = req.body as {
    items: SaleItemInput[];
    services?: ServiceItemInput[];
    customerName?: string;
    customerId?: number;
    totalAmount: number;
    paymentMethod?: string;
    discount?: number;
    surcharge?: number;
    sellerId?: number;
    passFeeToCustomer?: boolean;
    passFeeByMethod?: Record<string, boolean>;
    clientSaleId?: string;
    soldAtDate?: string;
  };

  try {
    const tenantId = getTenantId(req);
    console.log("[createSale] tenant:", tenantId, "items:", JSON.stringify(items), "pm:", paymentMethod);

    const result = await finalizeSaleOrder({
      tenantId, items, services, customerName, customerId, totalAmount, paymentMethod,
      discount, surcharge, sellerId, passFeeToCustomer, passFeeByMethod, clientSaleId,
      soldAtDate, decrementStock: true,
    });

    res.json({ success: true, orderId: result.orderId });
  } catch (err) {
    console.error("[createSale] error:", err);
    if (err instanceof SaleError) {
      res.status(err.status).json({ error: err.message, ...err.extra });
      return;
    }
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: "Sale failed", detail: message });
  }
}

// Usado pelo faturamento de consignação: mesmo núcleo de finalizeSaleOrder, mas nunca
// decrementa estoque (os itens que "ficaram" já tiveram o estoque debitado quando a
// sacola de consignação saiu).
export async function finalizeSaleOrderForConsignment(
  params: Omit<FinalizeSaleParams, "decrementStock">
): Promise<{ orderId: number }> {
  return finalizeSaleOrder({ ...params, decrementStock: false });
}
