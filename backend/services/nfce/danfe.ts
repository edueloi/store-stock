import PDFDocument from "pdfkit";
import bwipjs from "bwip-js";

import { generateQrCodePng } from "./qrcode";

function formatCpfCnpjDanfe(v: string | null | undefined): string {
  const d = String(v || "").replace(/\D/g, "");
  if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  return v || "";
}

export interface DanfeItem {
  code?: string | null;
  name: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  total: number;
}

export interface DanfeInput {
  storeName: string;
  storeDocument: string;
  storeStateRegistration?: string | null;
  storeAddress: string;
  chaveAcesso: string;
  numero: number;
  serie: number;
  emittedAt: Date;
  environment: "homologacao" | "producao";
  protocol?: string | null;
  items: DanfeItem[];
  totalAmount: number;
  changeAmount?: number | null;
  qrCodeUrl: string;
  paymentSummary: string;
  // texto de identificação do consumidor — "CONSUMIDOR NÃO IDENTIFICADO" ou nome/CPF-CNPJ
  customerLabel: string;
  // total aproximado de tributos (Lei 12.741/2012) — omitido quando não calculado
  approxTaxAmount?: number | null;
}

const WIDTH_MM = 80;
const MM_TO_PT = 2.8346;
const PAGE_WIDTH = WIDTH_MM * MM_TO_PT;

function formatMoney(v: number): string {
  return v.toFixed(2).replace(".", ",");
}

// Gera o PDF do cupom DANFE-NFCe — mesmo estilo visual "recibo corrido" do cupom
// térmico não-fiscal (fonte monoespaçada, divisórias tracejadas, sem quadros/caixas),
// só que com os elementos que a SEFAZ exige num DANFE: chave de acesso, código de
// barras, protocolo de autorização e QR Code de consulta.
export async function generateDanfePdf(input: DanfeInput): Promise<Buffer> {
  const barcodePng = await bwipjs.toBuffer({
    bcid: "code128",
    text: input.chaveAcesso,
    scale: 2,
    height: 10,
    includetext: false,
  });
  const qrPng = await generateQrCodePng(input.qrCodeUrl);

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const doc = new PDFDocument({ size: [PAGE_WIDTH, 2000], margin: 10 });
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const contentWidth = PAGE_WIDTH - 20;

    function dashedRule() {
      doc.dash(1, { space: 1 }).moveTo(10, doc.y).lineTo(PAGE_WIDTH - 10, doc.y).lineWidth(0.6).strokeColor("#000000").stroke();
      doc.undash();
      doc.moveDown(0.3);
    }

    doc.font("Courier-Bold").fontSize(11).text(input.storeName.toUpperCase(), { align: "center", width: contentWidth });
    doc.font("Courier").fontSize(7);
    doc.text(input.storeAddress, { align: "center", width: contentWidth });
    doc.text(input.storeDocument, { align: "center", width: contentWidth });
    doc.moveDown(0.3);
    dashedRule();

    doc.font("Courier-Bold").fontSize(8).text("DANFE NFC-e", { align: "center", width: contentWidth });
    doc.font("Courier").fontSize(6.5)
      .text("Documento Auxiliar da Nota Fiscal de Consumidor Eletrônica", { align: "center", width: contentWidth });
    if (input.environment === "homologacao") {
      doc.moveDown(0.2);
      doc.font("Courier-Bold").fontSize(7)
        .text("EMISSÃO EM AMBIENTE DE HOMOLOGAÇÃO — SEM VALOR FISCAL", { align: "center", width: contentWidth });
    }
    doc.moveDown(0.3);
    dashedRule();

    doc.font("Courier-Bold").fontSize(7).text("ITEM  CÓD.  DESCRIÇÃO", 10, doc.y, { width: contentWidth });
    doc.moveDown(0.2);
    doc.font("Courier").fontSize(7);
    let totalQuantity = 0;
    input.items.forEach((item, idx) => {
      totalQuantity += item.quantity;
      const code = item.code ? item.code : "---";
      doc.text(`${idx + 1}  ${code}  ${item.name}`, 10, doc.y, { width: contentWidth });
      doc.text(`   ${item.quantity} ${item.unit} x ${formatMoney(item.unitPrice)} = ${formatMoney(item.total)}`, 10, doc.y, { width: contentWidth });
      doc.moveDown(0.15);
    });
    dashedRule();

    doc.font("Courier").fontSize(7).text(`Qtde. Total de Itens: ${totalQuantity}`, { align: "center", width: contentWidth });
    doc.moveDown(0.3);

    doc.font("Courier-Bold").fontSize(9).text(`VALOR TOTAL R$ ${formatMoney(input.totalAmount)}`, { align: "center", width: contentWidth });
    doc.moveDown(0.2);
    doc.font("Courier").fontSize(7).text(`Forma de Pagamento: ${input.paymentSummary}`, { align: "center", width: contentWidth });
    if (input.changeAmount && input.changeAmount > 0) {
      doc.text(`Troco R$ ${formatMoney(input.changeAmount)}`, { align: "center", width: contentWidth });
    }
    doc.moveDown(0.3);
    dashedRule();

    doc.text(input.customerLabel, { align: "center", width: contentWidth });
    doc.moveDown(0.2);
    doc.text(`NFC-e nº ${input.numero}  Série ${input.serie}`, { align: "center", width: contentWidth });
    doc.text(`Emissão: ${input.emittedAt.toLocaleString("pt-BR")}`, { align: "center", width: contentWidth });
    if (input.protocol) doc.text(`Protocolo de autorização: ${input.protocol}`, { align: "center", width: contentWidth });
    if (input.approxTaxAmount != null) {
      doc.text(
        `Trib. Aprox. R$ ${formatMoney(input.approxTaxAmount)} Fonte: IBPT (Lei Federal 12.741/2012)`,
        { align: "center", width: contentWidth },
      );
    }
    doc.moveDown(0.4);
    dashedRule();

    const barcodeWidth = contentWidth * 0.9;
    doc.image(barcodePng, 10 + (contentWidth - barcodeWidth) / 2, doc.y, { width: barcodeWidth });
    doc.moveDown(3);

    doc.fontSize(6).text(
      input.chaveAcesso.replace(/(\d{4})/g, "$1 ").trim(),
      { align: "center", width: contentWidth },
    );
    doc.text("Consulte pela Chave de Acesso em www.nfce.fazenda.sp.gov.br", { align: "center", width: contentWidth });
    doc.moveDown(0.5);

    const qrSize = 120;
    doc.image(qrPng, 10 + (contentWidth - qrSize) / 2, doc.y, { width: qrSize, height: qrSize });
    doc.moveDown(0.3);

    doc.end();
  });
}

// Documento A4 formal da NFC-e — mesmo espírito do generateNfsePdf (moldura de
// documento oficial, seções com título, tabela de valores), só que com uma
// tabela de itens de produto no lugar da discriminação de serviço única. É o
// PDF servido pelo botão "DANFE" na tela de Notas Fiscais e enviado por
// WhatsApp — o cupom estreito de generateDanfePdf (acima) continua existindo
// só internamente (danfe_path), sem exposição na UI.
export async function generateDanfeA4Pdf(input: DanfeInput): Promise<Buffer> {
  const barcodePng = await bwipjs.toBuffer({
    bcid: "code128",
    text: input.chaveAcesso,
    scale: 2,
    height: 12,
    includetext: false,
  });
  const qrPng = await generateQrCodePng(input.qrCodeUrl);

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const doc = new PDFDocument({ size: "A4", margin: 36 });
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const pageWidth = doc.page.width - 72;
    const colorPrimary = "#1e293b";
    const colorPrimaryLight = "#f1f5f9";
    const colorText = "#0f172a";
    const colorMuted = "#475569";
    const colorBorder = "#94a3b8";
    void colorPrimary;

    const pageTop = doc.y;
    doc.rect(30, pageTop, doc.page.width - 60, doc.page.height - pageTop - 30).lineWidth(1).strokeColor(colorBorder).stroke();

    const headerTop = pageTop + 10;
    doc.rect(42, headerTop, 56, 56).lineWidth(1).strokeColor(colorBorder).stroke();
    doc.fillColor(colorText).font("Helvetica-Bold").fontSize(20)
      .text((input.storeName || "?").charAt(0).toUpperCase(), 42, headerTop + 15, { width: 56, align: "center" });

    const textX = 42 + 56 + 14;
    const textWidth = pageWidth - 56 - 14 - 170 - 12;
    doc.fillColor(colorText).font("Helvetica-Bold").fontSize(12)
      .text(input.storeName || "", textX, headerTop, { width: textWidth });
    doc.font("Helvetica").fontSize(8).fillColor(colorMuted);
    doc.text(input.storeDocument, textX, doc.y + 2, { width: textWidth });
    if (input.storeAddress) doc.text(input.storeAddress, textX, doc.y + 1, { width: textWidth });
    if (input.storeStateRegistration) doc.text(`IE: ${input.storeStateRegistration}`, textX, doc.y + 1, { width: textWidth });

    const badgeX = doc.page.width - 42 - 160;
    const badgeDividerY = headerTop + 24;
    doc.rect(badgeX, headerTop, 160, 56).lineWidth(1).strokeColor(colorBorder).stroke();
    doc.moveTo(badgeX, badgeDividerY).lineTo(badgeX + 160, badgeDividerY).lineWidth(0.75).strokeColor(colorBorder).stroke();
    doc.fillColor(colorText).font("Helvetica-Bold").fontSize(9)
      .text("DANFE NFC-e", badgeX, headerTop + 3, { width: 160, align: "center" });
    doc.fontSize(6).font("Helvetica").fillColor(colorMuted)
      .text("DOCUMENTO AUXILIAR DA NOTA FISCAL DE CONSUMIDOR ELETRÔNICA", badgeX, headerTop + 14, { width: 160, align: "center", characterSpacing: 0.3 });
    doc.font("Helvetica-Bold").fontSize(11).fillColor(colorText)
      .text(`Nº ${input.numero}  •  Série ${input.serie}`, badgeX, badgeDividerY + 5, { width: 160, align: "center" });
    if (input.environment !== "producao") {
      doc.font("Helvetica-Bold").fontSize(6.5).fillColor("#b91c1c")
        .text("HOMOLOGAÇÃO — SEM VALOR FISCAL", badgeX, badgeDividerY + 21, { width: 160, align: "center" });
    }

    doc.y = headerTop + 66;
    doc.moveTo(36, doc.y).lineTo(doc.page.width - 36, doc.y).lineWidth(1).strokeColor(colorBorder).stroke();
    doc.moveDown(0.7);

    function sectionTitle(label: string) {
      doc.moveDown(0.6);
      const y = doc.y;
      doc.rect(36, y, pageWidth, 14).fill(colorPrimaryLight);
      doc.font("Helvetica-Bold").fontSize(8).fillColor(colorText)
        .text(label.toUpperCase(), 40, y + 3, { characterSpacing: 0.5 });
      doc.y = y + 14;
      doc.moveDown(0.35);
      doc.fillColor(colorText);
    }

    function fieldRow(fields: { label: string; value?: string | null }[]) {
      const colWidth = pageWidth / fields.length;
      const y = doc.y;
      fields.forEach((f, i) => {
        const x = 36 + i * colWidth;
        doc.font("Helvetica").fontSize(7).fillColor(colorMuted).text(f.label.toUpperCase(), x, y, { width: colWidth - 8, characterSpacing: 0.3 });
        doc.font("Helvetica-Bold").fontSize(9.5).fillColor(colorText).text(f.value || "—", x, doc.y + 1, { width: colWidth - 8 });
      });
      doc.moveDown(0.9);
    }

    sectionTitle("Emitente");
    fieldRow([
      { label: "Razão social", value: input.storeName },
      { label: "CNPJ", value: formatCpfCnpjDanfe(input.storeDocument.replace(/\D/g, "")) },
    ]);
    if (input.storeAddress) {
      doc.font("Helvetica").fontSize(7).fillColor(colorMuted).text("ENDEREÇO", 36, doc.y, { characterSpacing: 0.3 });
      doc.font("Helvetica-Bold").fontSize(9.5).fillColor(colorText).text(input.storeAddress, 36, doc.y + 1, { width: pageWidth });
      doc.moveDown(0.6);
    }

    sectionTitle("Consumidor");
    doc.font("Helvetica-Bold").fontSize(9.5).fillColor(colorText).text(input.customerLabel, 36, doc.y, { width: pageWidth });
    doc.moveDown(0.6);

    sectionTitle("Itens");
    const tableY = doc.y;
    const cols = [
      { label: "Cód.", width: 0.12 },
      { label: "Descrição", width: 0.44 },
      { label: "Qtd.", width: 0.12 },
      { label: "Unit.", width: 0.16 },
      { label: "Total", width: 0.16 },
    ];
    let cx = 36;
    doc.font("Helvetica-Bold").fontSize(7).fillColor(colorMuted);
    cols.forEach((c) => {
      const w = pageWidth * c.width;
      doc.text(c.label.toUpperCase(), cx, tableY, { width: w, characterSpacing: 0.3 });
      cx += w;
    });
    doc.moveDown(0.4);
    doc.moveTo(36, doc.y).lineTo(36 + pageWidth, doc.y).lineWidth(0.5).strokeColor(colorBorder).stroke();
    doc.moveDown(0.3);

    let totalQuantity = 0;
    input.items.forEach((item) => {
      totalQuantity += item.quantity;
      const rowY = doc.y;
      cx = 36;
      const values = [
        item.code || "—",
        item.name,
        `${item.quantity} ${item.unit}`,
        formatMoney(item.unitPrice),
        formatMoney(item.total),
      ];
      doc.font("Helvetica").fontSize(8).fillColor(colorText);
      cols.forEach((c, i) => {
        const w = pageWidth * c.width;
        doc.text(values[i], cx, rowY, { width: w - 4 });
        cx += w;
      });
      doc.moveDown(0.5);
    });
    doc.moveTo(36, doc.y).lineTo(36 + pageWidth, doc.y).lineWidth(0.5).strokeColor(colorBorder).stroke();
    doc.moveDown(0.3);
    doc.font("Helvetica").fontSize(7).fillColor(colorMuted)
      .text(`Qtde. total de itens: ${totalQuantity}`, 36, doc.y, { width: pageWidth });
    doc.moveDown(0.6);

    sectionTitle("Valores");
    const boxY = doc.y;
    const boxH = 50;
    doc.rect(36, boxY, pageWidth, boxH).lineWidth(1).strokeColor(colorBorder).stroke();
    const valCols = [
      { label: "Forma de pagamento", value: input.paymentSummary, small: true },
      { label: "Troco", value: input.changeAmount ? formatMoney(input.changeAmount) : "—", small: false },
      { label: "Valor total", value: formatMoney(input.totalAmount), small: false },
    ];
    const vw = pageWidth / valCols.length;
    valCols.forEach((v, i) => {
      const x = 36 + i * vw;
      if (i > 0) doc.moveTo(x, boxY).lineTo(x, boxY + boxH).lineWidth(0.75).strokeColor(colorBorder).stroke();
      doc.font("Helvetica").fontSize(7).fillColor(colorMuted).text(v.label.toUpperCase(), x + 12, boxY + 9, { width: vw - 24, characterSpacing: 0.3 });
      doc.font("Helvetica-Bold").fontSize(v.small ? 9 : 13).fillColor(colorText).text(v.value, x + 12, boxY + (v.small ? 25 : 22), { width: vw - 24 });
    });
    doc.y = boxY + boxH + 10;
    if (input.approxTaxAmount != null) {
      doc.font("Helvetica-Oblique").fontSize(6.5).fillColor(colorMuted)
        .text(`Trib. aprox. R$ ${formatMoney(input.approxTaxAmount)} — Fonte: IBPT (Lei Federal 12.741/2012)`, 36, doc.y, { width: pageWidth });
      doc.moveDown(0.6);
    }

    sectionTitle("Identificação da NFC-e");
    fieldRow([
      { label: "Data/hora de emissão", value: input.emittedAt.toLocaleString("pt-BR") },
      { label: "Protocolo de autorização", value: input.protocol || "—" },
    ]);
    doc.font("Helvetica").fontSize(7).fillColor(colorMuted).text("CHAVE DE ACESSO", 36, doc.y, { characterSpacing: 0.3 });
    doc.font("Helvetica-Bold").fontSize(9.5).fillColor(colorText).text(input.chaveAcesso, 36, doc.y + 1, { width: pageWidth });
    doc.moveDown(0.8);

    const footerY = doc.y + 6;
    doc.moveTo(36, footerY).lineTo(doc.page.width - 36, footerY).strokeColor(colorBorder).lineWidth(1).stroke();

    const qrSize = 78;
    doc.image(qrPng, 36, footerY + 12, { width: qrSize, height: qrSize });

    const barcodeX = 36 + qrSize + 16;
    const barcodeWidth = pageWidth - qrSize - 16;
    doc.image(barcodePng, barcodeX, footerY + 24, { width: barcodeWidth, height: 32 });
    doc.font("Helvetica").fontSize(6.5).fillColor(colorMuted)
      .text(input.chaveAcesso, barcodeX, footerY + 58, { width: barcodeWidth, align: "center" });

    doc.font("Helvetica").fontSize(7).fillColor(colorMuted)
      .text("Consulte a autenticidade desta NFC-e pela Chave de Acesso em www.nfce.fazenda.sp.gov.br.",
        barcodeX, footerY + 68, { width: barcodeWidth });

    if (input.environment === "homologacao") {
      doc.font("Helvetica-Bold").fontSize(6.5).fillColor("#b91c1c")
        .text("EMISSÃO EM AMBIENTE DE HOMOLOGAÇÃO — SEM VALOR FISCAL", 36, doc.page.height - 50, { width: pageWidth, align: "center" });
    }

    doc.end();
  });
}
