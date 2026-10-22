import PDFDocument from "pdfkit";
import sharp from "sharp";

export type ReservationReceipt = {
  storeName: string;
  storePhone?: string;
  storeDocument?: string;
  storeAddress?: string;
  logoBuffer?: Buffer | null;
  number: number;
  customerName: string;
  customerPhone: string;
  createdAt: Date;
  expiresAt: Date;
  total: number;
  items: Array<{ name: string; quantity: number; unit_price: number; selected_options: Record<string, string> | null }>;
};

const money = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const reservationDate = (date: Date) => new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short",
}).format(date);
const phone = (value: string) => {
  const digits = value.replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
  return digits.replace(/^(\d{2})(\d{4,5})(\d{4})$/, "($1) $2-$3");
};
const document = (value: string) => {
  const digits = value.replace(/\D/g, "");
  return digits.length === 14 ? digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5")
    : digits.length === 11 ? digits.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4") : value;
};

/** Comprovante gerado a partir da reserva persistida, nunca do texto/preço sugerido pela IA. */
export async function createWhatsappReservationPdf(input: ReservationReceipt): Promise<Buffer> {
  // Logos cadastrados também podem ser WebP/GIF; PDFKit recebe PNG em todos os casos.
  const logo = input.logoBuffer ? await sharp(input.logoBuffer, { limitInputPixels: 16_000_000 })
    .rotate().resize(240, 240, { fit: "inside", withoutEnlargement: true }).png().toBuffer().catch(() => null) : null;
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 42, bufferPages: true, info: {
      Title: `Comprovante de reserva ${input.number} - ${input.storeName}`, Author: input.storeName,
    } });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    const left = 42, width = 511;
    const ink = "#20252b", muted = "#60666d";
    const label = (text: string, x: number, y: number, w = width) => doc.font("Helvetica-Bold").fontSize(8).fillColor(muted).text(text, x, y, { width: w });
    const rule = (y: number) => doc.moveTo(left, y).lineTo(left + width, y).lineWidth(0.6).strokeColor("#c6c9cd").stroke();

    rule(34);
    let nameX = left;
    if (logo) {
      doc.image(logo, left, 49, { fit: [62, 62] }); nameX += 76;
    }
    doc.font("Helvetica-Bold").fontSize(16).fillColor(ink).text(input.storeName, nameX, 49, { width: width - (nameX - left) });
    let headingBottom = Math.max(doc.y, 105);
    const storeLines = [
      input.storeDocument ? `CNPJ/CPF: ${document(input.storeDocument)}` : "",
      input.storePhone ? `Telefone / WhatsApp: ${phone(input.storePhone)}` : "",
      input.storeAddress || "",
    ].filter(Boolean);
    if (storeLines.length) {
      doc.font("Helvetica").fontSize(8).fillColor(muted).text(storeLines.join("\n"), nameX, doc.y + 5, { width: width - (nameX - left), lineGap: 3 });
      headingBottom = Math.max(doc.y, 111);
    }
    let y = headingBottom + 19;
    rule(y);
    doc.font("Helvetica-Bold").fontSize(15).fillColor(ink).text("COMPROVANTE DE RESERVA", left, y + 17, { width, align: "center" });
    y += 57;
    doc.rect(left, y, width, 57).lineWidth(0.6).strokeColor("#c6c9cd").stroke();
    label("RESERVA Nº", left + 12, y + 11, 110);
    label("EMISSÃO", left + 145, y + 11, 160);
    label("VALIDADE: 24 HORAS", left + 325, y + 11, 175);
    doc.font("Helvetica-Bold").fontSize(12).fillColor(ink).text(String(input.number).padStart(6, "0"), left + 12, y + 29, { width: 110 });
    doc.font("Helvetica").fontSize(10).text(reservationDate(input.createdAt), left + 145, y + 29, { width: 160 });
    doc.font("Helvetica-Bold").text(reservationDate(input.expiresAt), left + 325, y + 29, { width: 175 });
    y += 77;
    label("CLIENTE", left, y);
    doc.font("Helvetica-Bold").fontSize(11).fillColor(ink).text(input.customerName, left, y + 16, { width: 330 });
    const nameBottom = doc.y;
    label("TELEFONE / WHATSAPP", 398, y, 155);
    doc.font("Helvetica").fontSize(10).fillColor(ink).text(phone(input.customerPhone), 398, y + 16, { width: 155 });
    y = Math.max(doc.y, nameBottom) + 26;

    const tableHeading = () => {
      doc.rect(left, y - 8, width, 27).fill("#f1f2f3");
      label("PRODUTO / OPÇÕES", left + 6, y, 264);
      label("QTD.", 326, y, 35);
      label("UNITÁRIO", 376, y, 75);
      label("SUBTOTAL", 470, y, 83);
      y += 22; rule(y); y += 13;
    };
    tableHeading();
    for (const item of input.items) {
      const options = Object.entries(item.selected_options ?? {}).map(([key, value]) => `${key}: ${value}`).join("  |  ");
      doc.font("Helvetica-Bold").fontSize(10);
      const nameHeight = doc.heightOfString(item.name, { width: 270 });
      doc.font("Helvetica").fontSize(8);
      const optionsHeight = options ? doc.heightOfString(options, { width: 270 }) + 5 : 0;
      const rowHeight = Math.max(25, nameHeight + optionsHeight) + 23;
      if (y + rowHeight > 728) { doc.addPage(); y = 48; tableHeading(); }
      doc.font("Helvetica-Bold").fontSize(10).fillColor(ink).text(item.name, left, y, { width: 270 });
      if (options) doc.font("Helvetica").fontSize(8).fillColor(muted).text(options, left, y + nameHeight + 5, { width: 270 });
      doc.font("Helvetica").fontSize(10).fillColor(ink).text(String(item.quantity), 326, y, { width: 35, align: "center" });
      doc.fontSize(9).text(money(item.unit_price), 366, y, { width: 85, align: "right" });
      doc.font("Helvetica-Bold").text(money(item.quantity * item.unit_price), 460, y, { width: 93, align: "right" });
      y += rowHeight; rule(y - 10);
    }
    if (y + 188 > 752) { doc.addPage(); y = 48; }
    doc.font("Helvetica-Bold").fontSize(10).fillColor(ink).text("TOTAL DA RESERVA", left, y + 14, { width: 250 });
    doc.fontSize(17).text(money(input.total), 320, y + 9, { width: 233, align: "right" });
    rule(y + 43);
    y += 64;
    label("ATENDIMENTO NO BALCÃO", left, y);
    doc.font("Helvetica").fontSize(10).fillColor(ink).text("Basta informar seu nome, telefone ou número da reserva. A apresentação deste comprovante é opcional.", left, y + 17, { width, lineGap: 3 });
    y = doc.y + 15;
    doc.fontSize(8).fillColor(muted).text("A reserva é válida por 24 horas, conforme a data e hora indicadas acima (horário de Brasília). Após esse prazo, os itens são liberados automaticamente. Entrega, retirada e pagamento devem ser combinados com a loja.", left, y, { width, lineGap: 3 });
    doc.text("Documento de reserva. Não é nota fiscal e não comprova pagamento.", left, doc.y + 8, { width });

    const range = doc.bufferedPageRange();
    for (let page = range.start; page < range.start + range.count; page++) {
      doc.switchToPage(page);
      rule(778);
      doc.font("Helvetica").fontSize(7).fillColor(muted).text(`Reserva #${String(input.number).padStart(6, "0")}  |  ${page + 1} / ${range.count}`, left, 788, { width, align: "right", lineBreak: false });
    }
    doc.end();
  });
}
