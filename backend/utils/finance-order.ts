// Um recebimento de fiado pode citar a venda original na descrição. Essa
// referência não autoriza alterar a venda ao editar a receita do recebimento.
export function financeOrderId(entry: { source?: string | null; order_id?: number | null; description?: string | null }) {
  if (entry.source === "debt_payment" || entry.source === "debt_payment_reversal") return null;
  if (entry.order_id) return entry.order_id;
  if (entry.source && !["pdv", "services", "mixed"].includes(entry.source)) return null;
  const match = (entry.description ?? "").match(/^(?:Venda(?: Mista)?|Serviços) PDV\s*#(\d+)/i);
  return match ? Number(match[1]) : null;
}
