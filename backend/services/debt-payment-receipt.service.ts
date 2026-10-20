import PDFDocument from "pdfkit";

import { formatDate, formatDateTime, formatDocument, formatMoney, type StatementData } from "./customer-statement.service";

// Comprovante de um pagamento de crediário (uma página, formato de recibo) e o texto que o
// acompanha no WhatsApp. Mesmo conteúdo do e-mail de comprovante, em formato de mensagem.

const INK = "#172033";
const MUTED = "#64748b";
const LINE = "#d7dde8";
const GREEN = "#15803d";

export type DebtPaymentReceiptData = {
  store: StatementData["store"];
  customerName: string;
  description: string;
  paymentAmount: number;
  paymentMethod: string | null;
  paidAt: Date;
  total: number;
  paidTotal: number;
  remaining: number;
  /** Número do comprovante (id do pagamento). */
  receiptNumber: number;
  nextInstallment: { number: number; dueDate: Date; amount: number } | null;
};

export function createDebtPaymentReceiptPdf(data: DebtPaymentReceiptData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const L = 40;
    const W = 340;
    const doc = new PDFDocument({
      size: [W + L * 2, 520],
      margin: L,
      info: { Title: `Comprovante de pagamento - ${data.customerName}`, Author: data.store.name },
    });
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const rule = () => {
      const at = doc.y + 6;
      doc.moveTo(L, at).lineTo(L + W, at).strokeColor(LINE).lineWidth(1).stroke();
      doc.y = at + 8;
    };
    const row = (label: string, value: string, bold = false) => {
      const y = doc.y;
      doc.fillColor(MUTED).font("Helvetica").fontSize(9).text(label, L, y, { width: 150 });
      doc.fillColor(INK).font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(9.5).text(value, L + 150, y, { width: W - 150, align: "right" });
      doc.y = Math.max(doc.y, y + 14) + 2;
    };

    let y = L;
    if (data.store.logoBuffer) {
      try {
        doc.image(data.store.logoBuffer, L + W / 2 - 24, y, { fit: [48, 48] });
        y += 54;
      } catch {
        // formato que o pdfkit não lê: segue sem logo
      }
    }
    doc.fillColor(INK).font("Helvetica-Bold").fontSize(14).text(data.store.name, L, y, { width: W, align: "center" });
    doc.fillColor(MUTED).font("Helvetica").fontSize(8.5);
    if (data.store.document) doc.text(`CNPJ: ${formatDocument(data.store.document)}`, { width: W, align: "center" });
    if (data.store.address) doc.text(data.store.address, { width: W, align: "center" });
    if (data.store.phone) doc.text(`WhatsApp: ${data.store.phone}`, { width: W, align: "center" });

    rule();
    doc.fillColor(GREEN).font("Helvetica-Bold").fontSize(12).text("PAGAMENTO RECEBIDO", L, doc.y, { width: W, align: "center" });
    doc.fillColor(INK).font("Helvetica-Bold").fontSize(22).text(formatMoney(data.paymentAmount), L, doc.y + 2, { width: W, align: "center" });
    doc.fillColor(MUTED).font("Helvetica").fontSize(8.5).text(`Comprovante nº ${String(data.receiptNumber).padStart(6, "0")}`, L, doc.y + 2, { width: W, align: "center" });
    doc.y += 4;
    rule();

    row("Cliente", data.customerName);
    row("Referente a", data.description || "Crediário");
    row("Forma de pagamento", data.paymentMethod || "Não informada");
    row("Data do pagamento", formatDateTime(data.paidAt));
    rule();
    row("Valor total", formatMoney(data.total));
    row("Total pago até agora", formatMoney(data.paidTotal));
    row("Saldo em aberto", data.remaining > 0.004 ? formatMoney(data.remaining) : "Quitado", true);
    if (data.nextInstallment && data.remaining > 0.004) {
      row("Próximo vencimento", `${formatDate(data.nextInstallment.dueDate)} · ${formatMoney(data.nextInstallment.amount)}`);
    }
    rule();
    doc.fillColor(MUTED).font("Helvetica").fontSize(8).text("Este documento comprova o recebimento do valor acima. Obrigado pela preferência!", L, doc.y, { width: W, align: "center" });
    doc.end();
  });
}

/** Mensagem curta que acompanha o comprovante no WhatsApp. */
export function buildDebtPaymentWhatsappText(data: DebtPaymentReceiptData) {
  const firstName = data.customerName.trim().split(/\s+/)[0] || "cliente";
  const lines = [
    `Olá, ${firstName}! 👋`,
    `Aqui é da *${data.store.name}*.`,
    "",
    `✅ Recebemos o seu pagamento de *${formatMoney(data.paymentAmount)}*${data.paymentMethod ? ` (${data.paymentMethod})` : ""} em ${formatDate(data.paidAt)}.`,
    `📄 Referente a: ${data.description || "Crediário"}`,
  ];
  if (data.remaining > 0.004) {
    lines.push(`⏳ Saldo em aberto: *${formatMoney(data.remaining)}*`);
    if (data.nextInstallment) lines.push(`📅 Próximo vencimento: *${formatDate(data.nextInstallment.dueDate)}* (${formatMoney(data.nextInstallment.amount)})`);
  } else {
    lines.push("🎉 Seu crediário está *quitado*. Obrigado pela confiança!");
  }
  lines.push("", "Segue o comprovante em anexo. Qualquer dúvida, é só responder esta mensagem.");
  return lines.join("\n");
}
