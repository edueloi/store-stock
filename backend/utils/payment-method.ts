import { parsePaymentSegments } from "../../shared/paymentSegments";

export interface PaymentMethodSegment {
  method: string;
  brand: string;
  installments: number;
  amount: number;
}

// Parses "credit-visa-2x:120.00|money:30.00" into structured segments
export function parsePaymentMethod(pm: string, totalAmount = 0, changeAmount = 0): PaymentMethodSegment[] {
  return parsePaymentSegments(pm, totalAmount, changeAmount);
}

// O valor de cada forma de pagamento pode chegar DESATUALIZADO: o PDV preenche o valor com o
// total uma vez e, se o operador dá desconto depois, o valor da forma continua o antigo (ex.:
// PIX de R$ 89,77 numa venda de R$ 88,00). Se a soma das formas passa do que a venda realmente
// custou (+ troco), reduz todas proporcionalmente até bater.
// O inverso também acontece: o valor foi digitado e depois entraram mais itens (ex.: PIX de
// R$ 899,97 numa venda de R$ 1.058,48). Sem crediário/boleto (que ficam como dívida do cliente),
// o sistema já lançou o TOTAL como receita — então a diferença é completada na última forma, para
// o caixa, os relatórios e a nota fiscal (que rejeita "total dos pagamentos menor que o total da
// nota") baterem com o que a venda realmente é.
export function reconcileSegmentsToTotal(
  segs: PaymentMethodSegment[],
  totalAmount: number,
  changeAmount = 0,
): PaymentMethodSegment[] {
  const paid = segs.reduce((sum, s) => sum + s.amount, 0);
  const expected = Math.round((Number(totalAmount) + (Number(changeAmount) || 0)) * 100) / 100;
  if (!(expected > 0) || segs.length === 0) return segs;
  if (paid < expected - 0.009) {
    const hasDeferred = segs.some((s) => s.method === "crediario" || s.method === "boleto");
    if (hasDeferred || Math.abs(Number(changeAmount) || 0) > 0.005) return segs;
    const shortfall = Math.round((expected - paid) * 100) / 100;
    return segs.map((s, i) => (i === segs.length - 1 ? { ...s, amount: Math.round((s.amount + shortfall) * 100) / 100 } : s));
  }
  if (paid <= expected + 0.009) return segs;
  const factor = expected / paid;
  let accumulated = 0;
  return segs.map((s, i) => {
    const amount = i === segs.length - 1
      ? Math.round((expected - accumulated) * 100) / 100
      : Math.round(s.amount * factor * 100) / 100;
    accumulated += amount;
    return { ...s, amount };
  });
}

// Versão em texto ("pix:89.77" → "pix:88.00"): devolve a mesma string quando não há ajuste.
export function normalizePaymentMethodString(pm: string, totalAmount: number, changeAmount = 0): string {
  const segs = parsePaymentMethod(pm, totalAmount, changeAmount);
  const fixed = reconcileSegmentsToTotal(segs, totalAmount, changeAmount);
  if (fixed === segs) return pm;
  return fixed.map((s) => {
    const brand = (s.method === "credit" || s.method === "debit") ? `-${s.brand}` : "";
    const inst = s.method === "credit" && s.installments > 1 ? `-${s.installments}x` : "";
    return `${s.method}${brand}${inst}:${s.amount.toFixed(2)}`;
  }).join("|");
}

const METHOD_LABELS: Record<string, string> = {
  money: "Dinheiro", pix: "PIX", debit: "Débito", credit: "Crédito", crediario: "Crediário", boleto: "Boleto",
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
