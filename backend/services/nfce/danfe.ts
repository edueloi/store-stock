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

    doc.font("Helvetica-Bold").fontSize(9).text(input.storeName, { align: "center", width: contentWidth });
    doc.font("Helvetica").fontSize(7);
    doc.text(input.storeDocument, { align: "center", width: contentWidth });
    doc.text(input.storeAddress, { align: "center", width: contentWidth });
    doc.moveDown(0.5);

    doc.text(
      input.environment === "homologacao" ? "EMISSÃO EM AMBIENTE DE HOMOLOGAÇÃO — SEM VALOR FISCAL" : "DOCUMENTO AUXILIAR DA NOTA FISCAL DE CONSUMIDOR ELETRÔNICA",
      { align: "center", width: contentWidth },
    );
    doc.moveDown(0.5);
    doc.moveTo(10, doc.y).lineTo(PAGE_WIDTH - 10, doc.y).dash(1, { space: 1 }).stroke();
    doc.moveDown(0.3);

    doc.font("Helvetica-Bold").text("ITEM  DESCRIÇÃO  QTD  UN  VL.UNIT  VL.TOTAL", { width: contentWidth });
    doc.font("Helvetica");
    input.items.forEach((item, idx) => {
      doc.text(`${idx + 1} ${item.name}`, { width: contentWidth });
      doc.text(`  ${item.quantity} ${item.unit} x ${formatMoney(item.unitPrice)} = ${formatMoney(item.total)}`, { width: contentWidth });
    });

    doc.moveDown(0.3);
    doc.moveTo(10, doc.y).lineTo(PAGE_WIDTH - 10, doc.y).dash(1, { space: 1 }).stroke();
    doc.moveDown(0.3);

    doc.font("Helvetica-Bold").fontSize(9).text(`TOTAL R$ ${formatMoney(input.totalAmount)}`, { width: contentWidth });
    doc.font("Helvetica").fontSize(7).text(input.paymentSummary, { width: contentWidth });
    doc.moveDown(0.5);

    doc.text(`NFC-e nº ${input.numero}  Série ${input.serie}`, { align: "center", width: contentWidth });
    doc.text(`Emissão: ${input.emittedAt.toLocaleString("pt-BR")}`, { align: "center", width: contentWidth });
    if (input.protocol) doc.text(`Protocolo de autorização: ${input.protocol}`, { align: "center", width: contentWidth });
    doc.moveDown(0.5);

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

    doc.end();
  });
}
