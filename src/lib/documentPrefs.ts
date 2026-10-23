// Preferência "não incluir valores" nos documentos impressos (orçamento e ordem de serviço):
// a escolha fica salva neste computador e vale também para quem gera o PDF direto de uma lista.
export type DocKind = "quote" | "service_order";

const key = (doc: DocKind) => `doc_pdf_hide_values_${doc}`;

export function getHideValuesPref(doc: DocKind): boolean {
  try { return localStorage.getItem(key(doc)) === "1"; } catch { return false; }
}

export function setHideValuesPref(doc: DocKind, value: boolean) {
  try { localStorage.setItem(key(doc), value ? "1" : "0"); } catch { /* sem armazenamento: vale só para esta tela */ }
}
