/**
 * Telefone de WhatsApp no padrão do sistema: máscara "+55 (DD) 9XXXX-XXXX" com o 55 do Brasil sempre na frente.
 * O operador digita só DDD + número; os dígitos do valor mascarado já saem com o 55 (ex.: "5515992675429"), que é o que o WhatsApp exige.
 */
export function maskBrWhatsapp(raw: string): string {
  let d = raw.replace(/\D/g, "");
  if (raw.trim().startsWith("+55")) d = d.slice(2); // o 55 do prefixo já mascarado não é o DDD
  else if (d.length > 11 && d.startsWith("55")) d = d.slice(2); // número colado já com o 55
  d = d.slice(0, 11);
  if (!d) return "";
  if (d.length <= 2) return `+55 (${d}`;
  if (d.length <= 6) return `+55 (${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `+55 (${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `+55 (${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/** Só os dígitos do valor mascarado, já com o 55 ("5515992675429"). */
export const whatsappDigits = (masked: string) => masked.replace(/\D/g, "");

/** DDI 55 + DDD + 8 ou 9 dígitos = 12 ou 13 dígitos. */
export const isValidBrWhatsapp = (masked: string) => {
  const n = whatsappDigits(masked).length;
  return n === 12 || n === 13;
};

export const WHATSAPP_PLACEHOLDER = "+55 (11) 91234-5678";
