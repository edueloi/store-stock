export interface PaymentMethodSegment {
  method: string;
  brand: string;
  installments: number;
  amount: number;
}

// Parses "credit-visa-2x:120.00|money:30.00" into structured segments
export function parsePaymentMethod(pm: string): PaymentMethodSegment[] {
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

const METHOD_LABELS: Record<string, string> = {
  money: "Dinheiro", pix: "PIX", debit: "Débito", credit: "Crédito", crediario: "Crediário",
};

export function buildMethodSummary(pm: string): string {
  return parsePaymentMethod(pm).map(({ method, brand, installments }) => {
    const b = brand && brand !== "other" ? `/${brand.toUpperCase()}` : "";
    const i = method === "credit" && installments > 1 ? ` ${installments}X` : "";
    return `${METHOD_LABELS[method] ?? method}${b}${i}`;
  }).join(" + ");
}

// Taxa percentual (ex.: 2.5 = 2.5%) de um segmento de pagamento, dado o mapa de taxas
// configurado em tenant.card_fees. Crédito indexa por (bandeira, parcelas-1); débito e
// PIX sempre usam índice 0. Extraído de sales.controller.ts para ser compartilhado com
// o pagamento de dívida (customers.controller.ts) sem duplicar a regra.
export function rateForPaymentSegment(
  seg: Pick<PaymentMethodSegment, "method" | "brand" | "installments">,
  cardFees: Record<string, number[]>,
): number {
  if (seg.method === "credit") return cardFees[seg.brand]?.[seg.installments - 1] ?? 0;
  if (seg.method === "debit")  return cardFees[`debit_${seg.brand}`]?.[0] ?? 0;
  if (seg.method === "pix")    return cardFees["pix"]?.[0] ?? 0;
  return 0;
}

// Taxa de maquininha (R$) de um segmento, SEM arredondar — usada por sales.controller.ts,
// que soma todos os segmentos de uma venda e só arredonda o total no final (preserva o
// comportamento numérico exatamente como já era antes desta extração).
export function computeSegmentFeeRaw(
  seg: Pick<PaymentMethodSegment, "method" | "brand" | "installments" | "amount">,
  cardFees: Record<string, number[]>,
  discountFactor: number = 1,
): number {
  if (seg.amount <= 0) return 0;
  return seg.amount * discountFactor * (rateForPaymentSegment(seg, cardFees) / 100);
}

// Taxa de maquininha (R$) de um segmento, JÁ arredondada a centavos — usada quando o
// segmento vira um registro persistido isoladamente (ex.: pagamento de fiado com
// múltiplas formas, onde cada forma é sua própria linha, ao contrário da venda normal
// onde a taxa é agregada num único Order.fee_amount).
export function computeSegmentFee(
  seg: Pick<PaymentMethodSegment, "method" | "brand" | "installments" | "amount">,
  cardFees: Record<string, number[]>,
  discountFactor: number = 1,
): number {
  return Math.round(computeSegmentFeeRaw(seg, cardFees, discountFactor) * 100) / 100;
}
