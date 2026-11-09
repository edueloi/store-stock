// Condições comerciais do orçamento (prazo de entrega, forma de pagamento, entrada) — texto
// único usado na tela do orçamento, no PDF e na página de aprovação do cliente.

export type DownPaymentType = "none" | "percent" | "fixed";

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** "Sem entrada", "Entrada de 30% (R$ 300,00)", "Entrada de R$ 500,00" ou null quando não informada. */
export function describeDownPayment(
  type: string | null | undefined,
  value: number | string | null | undefined,
  total?: number | string | null,
): string | null {
  if (type === "none") return "Sem entrada";
  const v = Number(value);
  if (!(v > 0)) return null;
  if (type === "percent") {
    const t = Number(total);
    return t > 0 ? `Entrada de ${v}% (${brl(Math.round(t * v) / 100)})` : `Entrada de ${v}%`;
  }
  if (type === "fixed") return `Entrada de ${brl(v)}`;
  return null;
}

/** Linhas "Rótulo: valor" só dos campos preenchidos, na ordem em que aparecem nos documentos. */
export function commercialTermsLines(q: {
  delivery_deadline?: string | null;
  payment_terms?: string | null;
  down_payment_type?: string | null;
  down_payment_value?: number | string | null;
  total_amount?: number | string | null;
}): { label: string; value: string }[] {
  const lines: { label: string; value: string }[] = [];
  if (q.delivery_deadline?.trim()) lines.push({ label: "Prazo de entrega", value: q.delivery_deadline.trim() });
  if (q.payment_terms?.trim()) lines.push({ label: "Forma de pagamento", value: q.payment_terms.trim() });
  const down = describeDownPayment(q.down_payment_type, q.down_payment_value, q.total_amount);
  if (down) lines.push({ label: "Entrada", value: down });
  return lines;
}
