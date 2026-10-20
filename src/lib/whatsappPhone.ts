/**
 * Telefone de um contato do WhatsApp para exibição. O WhatsApp às vezes identifica o contato por
 * um ID interno (14+ dígitos) que não é telefone: nesse caso não mostramos o número "falso".
 */
export function formatContactPhone(raw: string | null | undefined): string {
  const digits = (raw ?? "").replace(/\D/g, "");
  if (!digits) return "Sem telefone";
  if (digits.length > 13) return "Número oculto pelo WhatsApp";
  const local = digits.startsWith("55") && digits.length > 11 ? digits.slice(2) : digits;
  const ddi = digits.startsWith("55") && digits.length > 11 ? "+55 " : "";
  if (local.length === 11) return `${ddi}(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
  if (local.length === 10) return `${ddi}(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
  return `${ddi}${local}`;
}

/** true quando o valor é um telefone de verdade (não o ID interno do WhatsApp). */
export function isRealPhone(raw: string | null | undefined): boolean {
  const digits = (raw ?? "").replace(/\D/g, "");
  return digits.length > 0 && digits.length <= 13;
}
