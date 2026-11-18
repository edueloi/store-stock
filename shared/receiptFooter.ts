/** Mensagem opcional da loja, compartilhada pelo PDV, reimpressões e DANFE. */
export interface ReceiptFooterConfig {
  enabled: boolean;
  title: string;
  message: string;
}

export const RECEIPT_FOOTER_MESSAGE_LIMIT = 600;
export const RECEIPT_FOOTER_TITLE_LIMIT = 60;

const clean = (value: unknown, limit: number) => typeof value === "string"
  ? value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").replace(/\r\n?/g, "\n").slice(0, limit).trim()
  : "";

export function readReceiptFooterConfig(policies: unknown): ReceiptFooterConfig {
  const value = policies && typeof policies === "object" && !Array.isArray(policies)
    ? (policies as Record<string, unknown>).receipt_footer : null;
  const config = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  return {
    enabled: config.enabled === true,
    title: config.title === undefined ? "INFORMAÇÕES DA LOJA" : clean(config.title, RECEIPT_FOOTER_TITLE_LIMIT),
    message: clean(config.message, RECEIPT_FOOTER_MESSAGE_LIMIT),
  };
}

export function getReceiptFooter(policies: unknown): ReceiptFooterConfig | null {
  const config = readReceiptFooterConfig(policies);
  return config.enabled && config.message ? config : null;
}

export function wrapReceiptFooter(text: string, cols: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    let line = "";
    for (let word of paragraph.split(/\s+/).filter(Boolean)) {
      while (word.length > cols) {
        if (line) { lines.push(line); line = ""; }
        lines.push(word.slice(0, cols));
        word = word.slice(cols);
      }
      if (!line) line = word;
      else if (line.length + word.length + 1 <= cols) line += ` ${word}`;
      else { lines.push(line); line = word; }
    }
    lines.push(line);
  }
  return lines;
}

/** O chamador imprime a divisória anterior; o bloco termina com a divisória seguinte. */
export function formatReceiptFooterText(footer: ReceiptFooterConfig | null | undefined, cols = 42): string {
  if (!footer?.enabled || !footer.message) return "";
  const width = Math.max(24, Math.min(64, Math.floor(cols) || 42));
  const center = (line: string) => " ".repeat(Math.max(0, Math.floor((width - line.length) / 2))) + line;
  const lines = [
    ...(footer.title ? wrapReceiptFooter(footer.title.toLocaleUpperCase("pt-BR"), width) : []),
    ...wrapReceiptFooter(footer.message, width),
  ];
  return `${lines.map(center).join("\n")}\n${"-".repeat(width)}\n`;
}

export const buildReceiptFooterText = (policies: unknown, cols = 42) => formatReceiptFooterText(getReceiptFooter(policies), cols);

export function buildReceiptFooterHtml(policies: unknown): string {
  const footer = getReceiptFooter(policies);
  if (!footer) return "";
  const escape = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  return `<div style="break-inside:avoid;page-break-inside:avoid;margin:10px 0;padding:10px 4px;border-top:1px dashed #555;border-bottom:1px dashed #555;text-align:center;color:#000;font-size:11px;line-height:1.5">${footer.title ? `<strong style="display:block;margin-bottom:4px;letter-spacing:.4px">${escape(footer.title.toLocaleUpperCase("pt-BR"))}</strong>` : ""}<div style="white-space:pre-wrap;overflow-wrap:anywhere">${escape(footer.message)}</div></div>`;
}
