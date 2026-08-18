import type { Request, Response } from "express";

import { prisma } from "../config/prisma";
import type { AuthenticatedRequest } from "../types/auth";
import { awardPointsForOrder } from "./loyalty.controller";
import { localDateString } from "../utils/date";
import { parsePaymentMethod, buildMethodSummary } from "../utils/payment-method";
import { decrementProductStock, returnProductStock } from "../utils/stock-adjust";

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
  // id da HeldSaleItem de origem, quando esta linha veio de uma venda em espera
  // retomada — usado para não debitar de novo um estoque já reservado no hold.
  heldSaleItemId?: number | null;
}

interface ServiceItemInput { id: number; name: string; price: number; dimensionsLabel?: string | null }

interface FinalizeSaleParams {
  tenantId: number;
  items: SaleItemInput[];
  services?: ServiceItemInput[];
  customerName?: string;
  customerId?: number;
  // CPF/CNPJ avulso informado no PDV (sem cliente cadastrado), para identificar o
  // destinatário na NFC-e — ex.: cliente pede "nota fiscal paulista" (crédito de ICMS/IPVA).
  customerDocument?: string;
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
  // presente quando esta venda está finalizando uma venda em espera (comanda) retomada —
  // os itens que carregarem heldSaleItemId correspondente não são debitados de novo.
  heldSaleId?: number | null;
  // descrição customizada da entrada financeira (ex.: "Consignação #12 — Venda")
  descriptionPrefix?: string;
  // nº de parcelas do crediário (default 1) e vencimento da 1ª parcela (default hoje +30d)
  crediarioInstallments?: number;
  crediarioFirstDueDate?: string;
  // sessão de caixa aberta no momento da venda (obrigatória quando o tenant exige controle de caixa)
  cashSessionId?: number | null;
  // true quando esta chamada é a sincronização de uma venda feita offline — nesse caso
  // não exigimos que a sessão ainda esteja "open" (pode ter sido fechada nesse meio-tempo)
  isOfflineSync?: boolean;
}

// Núcleo compartilhado de "virar uma venda de verdade": taxas de cartão, criação de
// Order/OrderItem/OrderService, débito de estoque (opcional), Finance, fidelidade e NFC-e.
// Usado tanto pelo PDV normal (createSale) quanto pelo faturamento de consignação, para
// garantir que ambos os caminhos produzam exatamente o mesmo resultado.
async function finalizeSaleOrder(params: FinalizeSaleParams): Promise<{ orderId: number }> {
  const {
    tenantId, items, services, customerName, customerId, customerDocument, totalAmount, paymentMethod,
    discount, surcharge, sellerId, passFeeToCustomer, passFeeByMethod, clientSaleId,
    soldAtDate, decrementStock, descriptionPrefix,
    crediarioInstallments, crediarioFirstDueDate,
    cashSessionId, isOfflineSync, heldSaleId,
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
      select: { card_fees: true, require_cash_session: true },
    });
    const cardFees = (tenantData?.card_fees ?? {}) as Record<string, number[]>;

    // Bloqueia a venda se o tenant exige controle de caixa e não há sessão válida informada
    let resolvedCashSessionId: number | null = cashSessionId ?? null;
    if (tenantData?.require_cash_session) {
      if (!resolvedCashSessionId) {
        throw new SaleError(409, "É necessário abrir o caixa antes de registrar vendas.");
      }
      const session = await prisma.cashSession.findFirst({
        where: {
          id: resolvedCashSessionId,
          tenant_id: tenantId,
          ...(isOfflineSync ? {} : { status: "open" }),
        },
        select: { id: true },
      });
      if (!session) {
        throw new SaleError(409, "Sessão de caixa inválida ou já fechada. Abra o caixa novamente para continuar vendendo.");
      }
    }

    const pmString    = paymentMethod || "money";
    const pmSegments  = parsePaymentMethod(pmString);

    // Crediário: parte da venda que fica como dívida do cliente, quitada depois.
    const crediarioAmount = pmSegments.find((s) => s.method === "crediario" && s.amount > 0)?.amount ?? 0;
    if (crediarioAmount > 0) {
      if (!customerId) {
        throw new SaleError(422, "Crediário requer um cliente selecionado");
      }
      const crediarioCustomer = await prisma.customer.findFirst({
        where: { id: customerId, tenant_id: tenantId },
        select: { credit_limit: true, name: true },
      });
      if (!crediarioCustomer) {
        throw new SaleError(404, "Cliente não encontrado");
      }
      const creditLimit = crediarioCustomer.credit_limit ? Number(crediarioCustomer.credit_limit) : 0;
      if (creditLimit > 0) {
        const openDebts = await prisma.customerDebt.findMany({
          where: { tenant_id: tenantId, customer_id: customerId, status: "open" },
          select: { amount: true, amount_paid: true },
        });
        const openTotal = openDebts.reduce((s, d) => s + (Number(d.amount) - Number(d.amount_paid)), 0);
        if (openTotal + crediarioAmount > creditLimit + 0.005) {
          throw new SaleError(422,
            `Limite de crédito excedido: em aberto R$ ${openTotal.toFixed(2)} + R$ ${crediarioAmount.toFixed(2)} > limite R$ ${creditLimit.toFixed(2)}`,
            { creditLimit, openTotal, requested: crediarioAmount },
          );
        }
      }
    }

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

    // Venda em espera (comanda) retomada e sendo finalizada agora: reivindica a venda em
    // espera atomicamente (nenhuma outra chamada pode cancelar/finalizar a mesma ao mesmo
    // tempo), e calcula quanto de cada linha do carrinho já teve o estoque reservado no
    // momento do "segurar venda" — essa parte não pode ser debitada de novo.
    // Chaveado pelo id da HeldSaleItem (não pelo product_id), porque o mesmo produto pode
    // aparecer em mais de uma linha do carrinho com variações diferentes.
    const reservedForItem: number[] = new Array(items.length).fill(0);
    let heldSaleItemsToResolve: { id: number; product_id: number; selected_options: unknown; quantity: number; remaining: number }[] = [];

    if (heldSaleId) {
      const claim = await prisma.heldSale.updateMany({
        where: { id: heldSaleId, tenant_id: tenantId, status: { in: ["held", "resumed"] } },
        data: { status: "completed" },
      });
      if (claim.count === 0) {
        throw new SaleError(409, "Esta venda em espera já foi cancelada ou finalizada em outro lugar.");
      }

      const heldItems = await prisma.heldSaleItem.findMany({
        where: { held_sale_id: heldSaleId },
      });
      heldSaleItemsToResolve = heldItems.map((h) => ({
        id: h.id, product_id: h.product_id, selected_options: h.selected_options, quantity: h.quantity, remaining: h.quantity,
      }));
      const remainingById = new Map(heldSaleItemsToResolve.map((h) => [h.id, h] as const));

      items.forEach((item, idx) => {
        if (!item.heldSaleItemId) return;
        const row = remainingById.get(item.heldSaleItemId);
        if (!row) return; // não pertence a esta venda em espera — trata como item novo, debita normal
        const claimed = Math.min(row.remaining, item.quantity);
        row.remaining -= claimed;
        reservedForItem[idx] = claimed;
      });
    }

    console.log("[createSale] creating order, grossAmount:", grossAmount, "netAmount:", netAmount, "fee:", roundedFee);
    const order = await prisma.order.create({
      data: {
        tenant_id:       tenantId,
        seller_id:       sellerId ?? null,
        seller_name:     sellerName,
        customer_name:   resolvedCustomerName,
        customer_id:     customerId ?? null,
        customer_document: customerDocument ? customerDocument.replace(/\D/g, "") : null,
        total_amount:    totalAmount,
        gross_amount:    grossAmount,
        discount_amount: discountVal > 0 ? discountVal : null,
        fee_amount:      roundedFee > 0 ? roundedFee : null,
        status:          "completed",
        order_type:      items.length === 0 && services && services.length > 0 ? "services" : (services && services.length > 0 ? "mixed" : "products"),
        payment_method:  pmString,
        client_sale_id:  clientSaleId ?? null,
        cash_session_id: resolvedCashSessionId,
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
              dimensions_label: svc.dimensionsLabel ?? null,
            })),
          },
        } : {}),
      },
    });

    console.log("[createSale] order created id:", order.id, "— updating stock");
    if (decrementStock) {
      for (let idx = 0; idx < items.length; idx++) {
        const item = items[idx];
        // Produtos vendidos por medida (m²/linear) não têm controle de estoque —
        // a peça é cortada sob medida, não há como inferir quanto resta em chapa/rolo.
        const productForStock = await prisma.product.findUnique({
          where: { id: item.id },
          select: { sale_unit: true },
        });
        if (productForStock?.sale_unit && productForStock.sale_unit !== "unidade") {
          continue;
        }

        const toDecrement = Math.max(0, item.quantity - reservedForItem[idx]);
        if (toDecrement > 0) {
          await decrementProductStock(item.id, toDecrement, item.selectedOptions);
        }
      }
    } else {
      console.log("[createSale] decrementStock=false — skipping (stock already debited upstream)");
    }

    // Qualquer HeldSaleItem que sobrou com quantidade não reclamada pelo carrinho final
    // (item removido ou reduzido depois de retomar a venda em espera) devolve a sobra ao
    // estoque agora e é marcada "returned"; o que foi reclamado vira "kept".
    if (heldSaleId && heldSaleItemsToResolve.length > 0) {
      for (const row of heldSaleItemsToResolve) {
        if (row.remaining > 0) {
          await returnProductStock(row.product_id, row.remaining, row.selected_options as Record<string, string> | null);
        }
        const claimed = row.quantity - row.remaining;
        await prisma.heldSaleItem.update({
          where: { id: row.id },
          data: { resolution: claimed > 0 ? "kept" : "returned", resolved_at: new Date() },
        });
      }
      await prisma.heldSale.update({
        where: { id: heldSaleId },
        data: { invoiced_order_id: order.id, invoiced_at: new Date() },
      });
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

    // A parte fiada (crediário) não é receita de caixa agora — só quando o
    // cliente pagar a dívida (mesmo princípio já usado em payDebt). O Finance
    // desta venda reflete só o que efetivamente entrou no caixa/recebível imediato.
    const nonCrediarioNet   = Math.round((netAmount - crediarioAmount) * 100) / 100;
    const nonCrediarioGross = Math.round((grossAmount - crediarioAmount) * 100) / 100;
    if (nonCrediarioNet > 0.009) {
      await prisma.finance.create({
        data: {
          tenant_id:       tenantId,
          type:            "income",
          description:     descriptionPrefix
            ? `${descriptionPrefix} #${order.id} — ${methodSummary}${discountNote}${surchargeNote}${feeNote}`
            : defaultDescription,
          amount:          nonCrediarioNet,
          gross_amount:    nonCrediarioGross,
          fee_amount:      roundedFee > 0 ? roundedFee : null,
          discount_amount: discountVal > 0 ? discountVal : null,
          payment_method:  pmString,
          source:          items.length === 0 ? "services" : (services && services.length > 0 ? "mixed" : "pdv"),
          order_id:        order.id,
          // offline sales synced later carry the original sale date
          date:            soldAtDate && /^\d{4}-\d{2}-\d{2}$/.test(soldAtDate) ? new Date(soldAtDate + "T00:00:00Z") : localDateString(),
        },
      });
    } else {
      console.log("[createSale] venda 100% crediário — Finance não criado agora, só ao pagar a dívida");
    }

    // Registra a parte fiada como dívida do cliente, vinculada a esta Order, já dividida em parcelas
    if (crediarioAmount > 0 && customerId) {
      const installmentsCount = Math.max(1, Math.floor(crediarioInstallments ?? 1));

      const firstDueDate = crediarioFirstDueDate
        ? new Date(`${crediarioFirstDueDate}T00:00:00`)
        : (() => {
            const d = new Date();
            d.setDate(d.getDate() + 30);
            return d;
          })();

      await prisma.$transaction(async (tx) => {
        const debt = await tx.customerDebt.create({
          data: {
            tenant_id: tenantId,
            customer_id: customerId,
            order_id: order.id,
            description: `Venda PDV #${order.id}`,
            amount: crediarioAmount,
            installments_count: installmentsCount,
            status: "open",
          },
        });

        const baseAmount = Math.floor((crediarioAmount / installmentsCount) * 100) / 100;
        let accumulated = 0;

        for (let i = 0; i < installmentsCount; i++) {
          const isLast = i === installmentsCount - 1;
          const amount = isLast
            ? Math.round((crediarioAmount - accumulated) * 100) / 100
            : baseAmount;
          accumulated += amount;

          const dueDate = new Date(firstDueDate);
          dueDate.setMonth(dueDate.getMonth() + i);

          await tx.customerDebtInstallment.create({
            data: {
              tenant_id: tenantId,
              debt_id: debt.id,
              number: i + 1,
              due_date: dueDate,
              amount,
              status: "open",
            },
          });
        }
      });
    }

    // award loyalty points if customer is identified
    if (customerId) {
      awardPointsForOrder(tenantId, customerId, order.id, totalAmount).catch(console.error);
    }

    return { orderId: order.id };
  }
}

export async function createSale(req: Request, res: Response) {
  const {
    items, services, customerName, customerId, customerDocument, totalAmount, paymentMethod, discount, surcharge,
    sellerId, passFeeToCustomer, passFeeByMethod, clientSaleId, soldAtDate,
    crediarioInstallments, crediarioFirstDueDate, cashSessionId, isOfflineSync, heldSaleId,
  } = req.body as {
    items: SaleItemInput[];
    services?: ServiceItemInput[];
    customerName?: string;
    customerId?: number;
    customerDocument?: string;
    totalAmount: number;
    paymentMethod?: string;
    discount?: number;
    surcharge?: number;
    sellerId?: number;
    passFeeToCustomer?: boolean;
    passFeeByMethod?: Record<string, boolean>;
    clientSaleId?: string;
    soldAtDate?: string;
    crediarioInstallments?: number;
    crediarioFirstDueDate?: string;
    cashSessionId?: number | null;
    isOfflineSync?: boolean;
    heldSaleId?: number | null;
  };

  try {
    const tenantId = getTenantId(req);
    console.log("[createSale] tenant:", tenantId, "items:", JSON.stringify(items), "pm:", paymentMethod);

    const result = await finalizeSaleOrder({
      tenantId, items, services, customerName, customerId, customerDocument, totalAmount, paymentMethod,
      discount, surcharge, sellerId, passFeeToCustomer, passFeeByMethod, clientSaleId,
      soldAtDate, decrementStock: true,
      crediarioInstallments, crediarioFirstDueDate,
      cashSessionId, isOfflineSync, heldSaleId,
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
