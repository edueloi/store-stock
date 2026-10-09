import { prisma } from "../config/prisma";
import { parsePaymentMethod, computeSegmentFeeRaw } from "./payment-method";

// Núcleo de pagamento compartilhado entre PDV (sales.controller), Faturar OS
// (service-orders.controller) e Converter Orçamento (quotes.controller):
// taxa de maquininha, repasse ao cliente, desconto/acréscimo extra e crediário.

export class SalePaymentError extends Error {
  status: number;
  extra?: Record<string, unknown>;
  constructor(status: number, message: string, extra?: Record<string, unknown>) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

const round2 = (v: number) => Math.round(v * 100) / 100;

export interface SalePaymentTotalsInput {
  // valor a ser cobrado neste pagamento, antes de desconto/acréscimo/taxa repassada
  baseAmount: number;
  pmString: string;
  cardFees: Record<string, number[]>;
  discount?: number;
  surcharge?: number;
  passFeeToCustomer?: boolean;
  passFeeByMethod?: Record<string, boolean> | null;
}

export function computeSalePaymentTotals(input: SalePaymentTotalsInput) {
  const { baseAmount, pmString, cardFees, passFeeToCustomer, passFeeByMethod } = input;
  const segments = parsePaymentMethod(pmString);
  const crediarioAmount = segments.find((s) => s.method === "crediario" && s.amount > 0)?.amount ?? 0;

  const discountVal = Math.min(Math.max(Number(input.discount) || 0, 0), baseAmount);
  const surchargeVal = Math.max(Number(input.surcharge) || 0, 0);

  const isPassFee = (method: string): boolean => {
    if (passFeeByMethod && passFeeByMethod[method] !== undefined) return !!passFeeByMethod[method];
    return !!passFeeToCustomer;
  };

  // A taxa incide sobre o valor efetivamente pago (já com desconto), como no PDV.
  const discountFactor = baseAmount > 0 ? Math.max(0, (baseAmount - discountVal) / baseAmount) : 1;
  const machineFee = segments.reduce((sum, seg) => sum + computeSegmentFeeRaw(seg, cardFees, discountFactor), 0);
  const passedFee = segments.reduce(
    (sum, seg) => (isPassFee(seg.method) ? sum + computeSegmentFeeRaw(seg, cardFees, discountFactor) : sum),
    0,
  );
  const roundedFee = round2(machineFee);
  const roundedPassedFee = round2(passedFee);
  const absorbedFee = round2(roundedFee - roundedPassedFee);
  const payableTotal = round2(baseAmount - discountVal + surchargeVal + roundedPassedFee);

  return {
    segments, crediarioAmount, discountVal, surchargeVal,
    roundedFee, roundedPassedFee, absorbedFee, payableTotal,
    netAmount: round2(payableTotal - absorbedFee),
  };
}

// Valida cliente e limite de crédito para a parte fiada.
export async function assertCrediarioAllowed(tenantId: number, customerId: number | null | undefined, crediarioAmount: number) {
  if (crediarioAmount <= 0) return;
  if (!customerId) throw new SalePaymentError(422, "Crediário requer um cliente selecionado");
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, tenant_id: tenantId },
    select: { credit_limit: true },
  });
  if (!customer) throw new SalePaymentError(404, "Cliente não encontrado");
  const creditLimit = customer.credit_limit ? Number(customer.credit_limit) : 0;
  if (creditLimit > 0) {
    const openDebts = await prisma.customerDebt.findMany({
      where: { tenant_id: tenantId, customer_id: customerId, status: "open" },
      select: { amount: true, amount_paid: true },
    });
    const openTotal = openDebts.reduce((s, d) => s + (Number(d.amount) - Number(d.amount_paid)), 0);
    if (openTotal + crediarioAmount > creditLimit + 0.005) {
      throw new SalePaymentError(422,
        `Limite de crédito excedido: em aberto R$ ${openTotal.toFixed(2)} + R$ ${crediarioAmount.toFixed(2)} > limite R$ ${creditLimit.toFixed(2)}`,
        { creditLimit, openTotal, requested: crediarioAmount },
      );
    }
  }
}

// Registra a parte fiada como dívida do cliente (vinculada ao Order), dividida em parcelas.
export async function createCrediarioDebt(params: {
  tenantId: number;
  customerId: number;
  orderId: number;
  description: string;
  crediarioAmount: number;
  installments?: number;
  firstDueDate?: string;
}) {
  const { tenantId, customerId, orderId, description, crediarioAmount } = params;
  const installmentsCount = Math.max(1, Math.floor(params.installments ?? 1));
  const firstDueDate = params.firstDueDate
    ? new Date(`${params.firstDueDate}T00:00:00`)
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
        order_id: orderId,
        description,
        amount: crediarioAmount,
        installments_count: installmentsCount,
        status: "open",
      },
    });

    const baseAmount = Math.floor((crediarioAmount / installmentsCount) * 100) / 100;
    let accumulated = 0;
    for (let i = 0; i < installmentsCount; i++) {
      const isLast = i === installmentsCount - 1;
      const amount = isLast ? round2(crediarioAmount - accumulated) : baseAmount;
      accumulated += amount;
      const dueDate = new Date(firstDueDate);
      dueDate.setMonth(dueDate.getMonth() + i);
      await tx.customerDebtInstallment.create({
        data: { tenant_id: tenantId, debt_id: debt.id, number: i + 1, due_date: dueDate, amount, status: "open" },
      });
    }
  });
}
