import PDFDocument from "pdfkit";
import bwipjs from "bwip-js";

import { generateQrCodePng } from "./qrcode";

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
