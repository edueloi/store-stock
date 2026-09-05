import PDFDocument from "pdfkit";
import bwipjs from "bwip-js";

import { generateQrCodePng } from "./qrcode";

export interface DanfeItem {
  name: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  total: number;
}

export interface DanfeInput {
  storeName: string;
  storeDocument: string;
  storeAddress: string;
  chaveAcesso: string;
  numero: number;
  serie: number;
  emittedAt: Date;
  environment: "homologacao" | "producao";
  protocol?: string | null;
  items: DanfeItem[];
  totalAmount: number;
  qrCodeUrl: string;
  paymentSummary: string;
}

const WIDTH_MM = 80;
const MM_TO_PT = 2.8346;
const PAGE_WIDTH = WIDTH_MM * MM_TO_PT;

function formatMoney(v: number): string {
  return v.toFixed(2).replace(".", ",");
}

// Gera o PDF do cupom DANFE-NFCe (layout simplificado 80mm)
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
    const colorRule = "#000000";

    function solidRule() {
      doc.undash();
      doc.moveTo(10, doc.y).lineTo(PAGE_WIDTH - 10, doc.y).lineWidth(0.75).strokeColor(colorRule).stroke();
      doc.moveDown(0.25);
    }

    // Caixa de identificação do documento — mesmo papel que o quadro "DANFE" no canto
    // superior direito de uma NF-e modelo 1, adaptado pro cupom 80mm: identifica o tipo
    // de documento antes mesmo do cabeçalho da loja, como um formulário oficial impresso.
    const badgeY = doc.y;
    const badgeH = 26;
    doc.rect(10, badgeY, contentWidth, badgeH).lineWidth(1).strokeColor(colorRule).stroke();
    doc.moveTo(10, badgeY + 14).lineTo(PAGE_WIDTH - 10, badgeY + 14).lineWidth(0.5).strokeColor(colorRule).stroke();
    doc.font("Helvetica-Bold").fontSize(8).fillColor(colorRule)
      .text("DANFE NFC-e", 10, badgeY + 2, { width: contentWidth, align: "center" });
    doc.font("Helvetica").fontSize(6)
      .text("Documento Auxiliar da Nota Fiscal de Consumidor Eletrônica", 10, badgeY + 16, { width: contentWidth, align: "center" });
    doc.y = badgeY + badgeH + 6;

    doc.font("Helvetica-Bold").fontSize(9).text(input.storeName, { align: "center", width: contentWidth });
    doc.font("Helvetica").fontSize(7);
    doc.text(input.storeDocument, { align: "center", width: contentWidth });
    doc.text(input.storeAddress, { align: "center", width: contentWidth });
    doc.moveDown(0.4);

    if (input.environment === "homologacao") {
      doc.font("Helvetica-Bold").text("EMISSÃO EM AMBIENTE DE HOMOLOGAÇÃO — SEM VALOR FISCAL", { align: "center", width: contentWidth });
      doc.font("Helvetica");
    }
    doc.moveDown(0.3);
    solidRule();

    // Quadro dos itens, com linhas verticais separando as colunas — mesmo tratamento
    // visual do corpo de uma NF-e modelo 1 (grade "DADOS DO PRODUTO/SERVIÇO"), adaptado
    // pra largura estreita do cupom (colunas empilhadas verticalmente por item em vez de
    // uma única linha, que não caberia em 80mm).
    const itemsBoxY = doc.y;
    doc.font("Helvetica-Bold").fontSize(7).text("ITEM   DESCRIÇÃO", 10, itemsBoxY + 3, { width: contentWidth });
    doc.moveDown(0.2);
    doc.font("Helvetica");
    input.items.forEach((item, idx) => {
      const rowY = doc.y;
      doc.text(`${idx + 1}  ${item.name}`, 10, rowY, { width: contentWidth });
      doc.text(`   ${item.quantity} ${item.unit} x ${formatMoney(item.unitPrice)} = ${formatMoney(item.total)}`, 10, doc.y, { width: contentWidth });
      doc.moveDown(0.15);
      doc.moveTo(10, doc.y).lineTo(PAGE_WIDTH - 10, doc.y).lineWidth(0.4).strokeColor("#94a3b8").dash(1, { space: 1 }).stroke();
      doc.moveDown(0.15);
    });
    doc.undash();
    doc.rect(10, itemsBoxY, contentWidth, doc.y - itemsBoxY).lineWidth(0.75).strokeColor(colorRule).stroke();
    doc.moveDown(0.3);

    // Quadro do total — mesmo tratamento do bloco "CÁLCULO DO IMPOSTO" de uma NF-e
    // modelo 1: valores relevantes destacados dentro de uma caixa fechada.
    const totalBoxY = doc.y;
    const totalBoxH = 30;
    doc.rect(10, totalBoxY, contentWidth, totalBoxH).lineWidth(1).strokeColor(colorRule).stroke();
    doc.font("Helvetica-Bold").fontSize(9).text(`TOTAL R$ ${formatMoney(input.totalAmount)}`, 10, totalBoxY + 4, { width: contentWidth, align: "center" });
    doc.font("Helvetica").fontSize(7).text(input.paymentSummary, 10, totalBoxY + 18, { width: contentWidth, align: "center" });
    doc.y = totalBoxY + totalBoxH + 8;

    doc.font("Helvetica").fontSize(7);
    doc.text(`NFC-e nº ${input.numero}  Série ${input.serie}`, { align: "center", width: contentWidth });
    doc.text(`Emissão: ${input.emittedAt.toLocaleString("pt-BR")}`, { align: "center", width: contentWidth });
    if (input.protocol) doc.text(`Protocolo de autorização: ${input.protocol}`, { align: "center", width: contentWidth });
    doc.moveDown(0.4);
    solidRule();

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
    const qrBoxY = doc.y;
    doc.rect(10 + (contentWidth - qrSize) / 2 - 4, qrBoxY - 4, qrSize + 8, qrSize + 8).lineWidth(0.75).strokeColor(colorRule).stroke();
    doc.image(qrPng, 10 + (contentWidth - qrSize) / 2, qrBoxY, { width: qrSize, height: qrSize });

    doc.end();
  });
}
