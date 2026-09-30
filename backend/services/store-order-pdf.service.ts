import PDFDocument from "pdfkit";

type StoreOrderPdfInput = {
  storeName: string;
  orderNumber: number;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  createdAt: Date;
  items: Array<{ name: string; sku?: string | null; quantity: number; unitPrice: number }>;
  total: number;
};

const money = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** PDF simples e imprimível para a fábrica separar e confirmar encomendas. */
export function createStoreOrderPdf(input: StoreOrderPdfInput): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const doc = new PDFDocument({ size: "A4", margin: 42 });
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const width = 511;
    const line = () => doc.moveTo(42, doc.y).lineTo(553, doc.y).strokeColor("#d7dde8").lineWidth(1).stroke();
    doc.fillColor("#172033").font("Helvetica-Bold").fontSize(18).text(input.storeName);
    doc.fillColor("#64748b").font("Helvetica-Bold").fontSize(9).text("SOLICITAÇÃO DE ENCOMENDA", { align: "right", continued: false });
    doc.fillColor("#172033").font("Helvetica-Bold").fontSize(15).text(`#${String(input.orderNumber).padStart(6, "0")}`, { align: "right" });
    doc.moveDown(1); line(); doc.moveDown(0.9);

    doc.fillColor("#64748b").font("Helvetica-Bold").fontSize(8).text("CLIENTE");
    doc.fillColor("#172033").font("Helvetica-Bold").fontSize(12).text(input.customerName);
    doc.fillColor("#475569").font("Helvetica").fontSize(9).text(`WhatsApp: ${input.customerPhone}${input.customerEmail ? `   ·   E-mail: ${input.customerEmail}` : ""}`);
    doc.fillColor("#64748b").fontSize(9).text(`Solicitado em ${input.createdAt.toLocaleString("pt-BR")}`);
    doc.moveDown(1); line(); doc.moveDown(0.7);

    doc.fillColor("#64748b").font("Helvetica-Bold").fontSize(8).text("ITENS SOLICITADOS");
    doc.moveDown(0.5);
    let y = doc.y;
    doc.fillColor("#64748b").font("Helvetica-Bold").fontSize(8);
    doc.text("PRODUTO", 42, y, { width: 285 });
    doc.text("QTD.", 340, y, { width: 45, align: "right" });
    doc.text("UNITÁRIO", 400, y, { width: 68, align: "right" });
    doc.text("TOTAL", 478, y, { width: 75, align: "right" });
    doc.moveDown(0.7); line(); doc.moveDown(0.45);

    for (const item of input.items) {
      if (doc.y > 710) { doc.addPage(); }
      y = doc.y;
      doc.fillColor("#172033").font("Helvetica-Bold").fontSize(9).text(item.name, 42, y, { width: 280 });
      if (item.sku) doc.fillColor("#64748b").font("Helvetica").fontSize(7).text(`Código: ${item.sku}`, 42, doc.y + 1, { width: 280 });
      doc.fillColor("#334155").font("Helvetica").fontSize(9).text(String(item.quantity), 340, y, { width: 45, align: "right" });
      doc.text(money(item.unitPrice), 390, y, { width: 78, align: "right" });
      doc.fillColor("#172033").font("Helvetica-Bold").text(money(item.unitPrice * item.quantity), 470, y, { width: 83, align: "right" });
      doc.moveDown(item.sku ? 1.15 : 0.75);
      line(); doc.moveDown(0.4);
    }

    doc.moveDown(0.5);
    doc.fillColor("#172033").font("Helvetica-Bold").fontSize(13).text(`Total estimado: ${money(input.total)}`, { align: "right", width });
    doc.moveDown(1.4);
    doc.fillColor("#64748b").font("Helvetica").fontSize(8).text("Este pedido é uma solicitação de encomenda. A produção, prazo, disponibilidade, frete e pagamento devem ser confirmados com o cliente.", { width, align: "center" });
    doc.end();
  });
}
