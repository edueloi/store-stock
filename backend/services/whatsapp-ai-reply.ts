/** Formato de conversa usado tanto no teste do painel quanto no WhatsApp real. */
export const WHATSAPP_AI_STYLE = [
  "Escreva como uma atendente prestativa: resposta direta, parágrafos curtos e uma pergunta útil por vez. Não repita saudações, não pressione a compra e não use frases de propaganda.",
  "No WhatsApp, negrito usa EXATAMENTE um asterisco de cada lado, sem espaços internos: *Bolsa Shoulder Luna* e *R$ 189,90*. Nunca use dois ou três asteriscos, títulos Markdown, tabelas ou links no formato [texto](url).",
  "Ao mostrar produtos, apresente no máximo 3 opções. Separe cada produto por uma linha em branco: '• *Nome do produto*\\n*R$ 189,90*\\nCores disponíveis: Preto, Caramelo e Bege'. Use apenas opções e disponibilidade confirmadas nos dados, sem inventar urgência ou dizer 'últimas unidades' sem quantidade real.",
  "Depois das opções, envie um único link filtrado em uma linha própria, introduzido por 'Veja no catálogo:'. Se ajudar a escolher, termine com uma pergunta curta, como 'Qual cor você prefere?'. Se o cliente já escolheu, confirme item, opção, quantidade e total e peça autorização para reservar por 24 horas.",
].join("\n");

export function normalizeWhatsappAiText(input: string): string {
  const text = input
    // Também remove comandos truncados; nenhum dado interno deve ir ao cliente.
    .replace(/\[\[\s*(?:TRANSFERIR|SEGURAR)\b[\s\S]*?(?:\]\]|$)/gi, "")
    .replace(/\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g, "$2")
    .replace(/\r\n?/g, "\n");

  // URLs são preservadas, inclusive caracteres usados em filtros de catálogo.
  return text.split(/(https?:\/\/[^\s]+)/g).map((part, index) => index % 2 ? part : part
    .replace(/^#{1,6}\s+(.+)$/gm, "*$1*")
    .replace(/\*+([^*\n]+)\*+/g, (_, content: string) => content.trim() ? `*${content.trim()}*` : "")
    .replace(/\*{2,}/g, "")
    .replace(/^[ \t]*- +/gm, "• ")
    .replace(/^[ \t]*\* +([^*\n]+)$/gm, "• $1")
  ).join("").replace(/[ \t]+$/gm, "").replace(/\n{3,}/g, "\n\n").trim();
}

export function parseWhatsappAiReply(reply: string) {
  const transfer = reply.match(/\[\[\s*TRANSFERIR\s*:\s*([a-z0-9_-]+)\s*\]\]/i);
  // Reservas continuam exigindo o comando completo, sem texto ou comandos adicionais.
  const hold = reply.match(/^\s*\[\[SEGURAR:(\{[\s\S]*\})\]\]\s*$/);
  const text = normalizeWhatsappAiText(reply);
  // Uma oferta de ajuda não é autorização para transferir o cliente.
  const offersTransfer = /\b(?:se (?:você )?(?:quiser|preferir|desejar)|posso (?:chamar|transferir|encaminhar)|quer que eu (?:chame|transfira|encaminhe))\b/i.test(text);
  return {
    text,
    transferDepartment: transfer && !offersTransfer ? transfer[1].toLowerCase() : null,
    holdJson: hold?.[1] ?? null,
  };
}

/** Pausa curta, inclusive para respostas longas, antes do envio automático. */
export function botTypingDelayMs(text: string): number {
  return Math.min(2_000, 1_000 + text.length * 4);
}
