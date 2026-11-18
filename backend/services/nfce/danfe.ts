import PDFDocument from "pdfkit";
import bwipjs from "bwip-js";
import { formatReceiptFooterText, type ReceiptFooterConfig } from "../../../shared/receiptFooter";

import { generateQrCodePng } from "./qrcode";

export function formatCpfCnpjDanfe(v: string | null | undefined): string {
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
  receiptFooter?: ReceiptFooterConfig | null;
  storeName: string;
  storeDocument: string;
  storeStateRegistration?: string | null;
  storeAddress: string;
  // Logo da loja (mesmo buffer lido de tenant.logo_url em uploads/, ver
  // nfse/emitir.ts) — só usado pelo DANFE A4; o cupom 80mm não tem espaço
  // pra imagem.
  logoBuffer?: Buffer | null;
  chaveAcesso: string;
  numero: number;
  serie: number;
  emittedAt: Date;
  environment: "homologacao" | "producao";
  protocol?: string | null;
  items: DanfeItem[];
  totalAmount: number;
  // Acréscimo manual aplicado na venda (campo "Acréscimo" do PDV) — a soma dos
  // itens não bate com totalAmount sem isso aparecer em algum lugar do
  // documento, senão o cliente estranha "total maior que a soma dos itens".
  surchargeAmount?: number | null;
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
    const qrY = doc.y;
    doc.image(qrPng, 10 + (contentWidth - qrSize) / 2, qrY, { width: qrSize, height: qrSize });
    if (input.receiptFooter) {
      doc.y = qrY + qrSize + 12;
      dashedRule();
      const footer = input.receiptFooter;
      if (footer.title) doc.font("Courier-Bold").fontSize(8).text(footer.title.toLocaleUpperCase("pt-BR"), 10, doc.y, { width: contentWidth, align: "center" });
      doc.moveDown(0.3);
      doc.font("Courier").fontSize(8).text(footer.message, 10, doc.y, { width: contentWidth, align: "center" });
      doc.moveDown(0.4);
      dashedRule();
    }
    doc.moveDown(0.3);

    doc.end();
  });
}

// Cupom fiscal (DANFE NFC-e) em TEXTO, para a impressora térmica (ESC/POS) do PDV: mesmo conteúdo do cupom em PDF
// (empresa, itens, total, pagamento, consumidor, nº/série, protocolo, chave) em colunas fixas. O QR Code vai como o marcador
// [[QR:url]], que o app desktop troca pelo comando de QR Code da impressora (ver desktop/printer.cjs).
export function buildCupomText(input: DanfeInput, cols = 42): string {
  const W = Math.max(24, Math.min(64, Math.floor(cols) || 42));
  const rule = "-".repeat(W);
  const money = (v: number) => formatMoney(Number(v) || 0);
  const wrap = (text: string, width = W): string[] => {
    const out: string[] = [];
    for (const para of String(text ?? "").split("\n")) {
      let line = "";
      for (let word of para.split(/\s+/).filter(Boolean)) {
        while (word.length > width) { if (line) { out.push(line); line = ""; } out.push(word.slice(0, width)); word = word.slice(width); }
        if (!line) line = word;
        else if (line.length + 1 + word.length <= width) line += ` ${word}`;
        else { out.push(line); line = word; }
      }
      out.push(line);
    }
    return out;
  };
  const center = (text: string) => wrap(text).map((l) => " ".repeat(Math.max(0, Math.floor((W - l.length) / 2))) + l).join("\n");
  const row = (left: string, right: string) => {
    const gap = W - left.length - right.length;
    return gap >= 1 ? left + " ".repeat(gap) + right : `${wrap(left).join("\n")}\n${" ".repeat(Math.max(0, W - right.length))}${right}`;
  };

  const lines: string[] = [];
  lines.push(center(input.storeName.toUpperCase()));
  if (input.storeDocument) lines.push(center(input.storeDocument + (input.storeStateRegistration ? `  IE: ${input.storeStateRegistration}` : "")));
  if (input.storeAddress) lines.push(center(input.storeAddress));
  lines.push(rule);
  lines.push(center("DANFE NFC-e"));
  lines.push(center("Documento Auxiliar da Nota Fiscal de Consumidor Eletrônica"));
  if (input.environment === "homologacao") lines.push(center("EMISSÃO EM AMBIENTE DE HOMOLOGAÇÃO - SEM VALOR FISCAL"));
  lines.push(rule);

  let totalQuantity = 0;
  input.items.forEach((item, idx) => {
    totalQuantity += item.quantity;
    lines.push(wrap(`${String(idx + 1).padStart(2, "0")} ${item.code || "---"} ${item.name}`).join("\n"));
    lines.push(row(`   ${Number(item.quantity)} ${item.unit} x ${money(item.unitPrice)}`, money(item.total)));
  });
  lines.push(rule);
  lines.push(row("Qtde. total de itens", String(totalQuantity)));
  if (input.surchargeAmount && input.surchargeAmount > 0) lines.push(row("Acréscimo", `R$ ${money(input.surchargeAmount)}`));
  lines.push(row("VALOR TOTAL R$", money(input.totalAmount)));
  lines.push(wrap(`Forma de pagamento: ${input.paymentSummary}`).join("\n"));
  if (input.changeAmount && input.changeAmount > 0) lines.push(row("Troco R$", money(input.changeAmount)));
  lines.push(rule);
  lines.push(center(input.customerLabel));
  lines.push(center(`NFC-e nº ${input.numero}  Série ${input.serie}`));
  lines.push(center(`Emissão: ${input.emittedAt.toLocaleString("pt-BR")}`));
  if (input.protocol) lines.push(center(`Protocolo de autorização: ${input.protocol}`));
  if (input.approxTaxAmount != null) lines.push(center(`Trib. aprox. R$ ${money(input.approxTaxAmount)} Fonte: IBPT (Lei 12.741/2012)`));
  lines.push(rule);
  lines.push(center("CHAVE DE ACESSO"));
  lines.push(center(input.chaveAcesso.replace(/(\d{4})/g, "$1 ").trim()));
  lines.push(center("Consulte pela Chave de Acesso em www.nfce.fazenda.sp.gov.br"));
  lines.push(`[[QR:${input.qrCodeUrl}]]`);
  if (input.receiptFooter) lines.push(rule, formatReceiptFooterText(input.receiptFooter, W).trimEnd());
  return lines.join("\n");
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
    if (input.logoBuffer) {
      doc.image(input.logoBuffer, 42, headerTop, { fit: [56, 56] });
    } else {
      doc.rect(42, headerTop, 56, 56).lineWidth(1).strokeColor(colorBorder).stroke();
      doc.fillColor(colorText).font("Helvetica-Bold").fontSize(20)
        .text((input.storeName || "?").charAt(0).toUpperCase(), 42, headerTop + 15, { width: 56, align: "center" });
    }

    const textX = 42 + 56 + 14;
    const textWidth = pageWidth - 56 - 14 - 170 - 12;
    doc.fillColor(colorText).font("Helvetica-Bold").fontSize(12)
      .text(input.storeName || "", textX, headerTop, { width: textWidth });
    doc.font("Helvetica").fontSize(8).fillColor(colorMuted);
    doc.text(`CNPJ: ${formatCpfCnpjDanfe(input.storeDocument.replace(/\D/g, ""))}`, textX, doc.y + 2, { width: textWidth });
    if (input.storeAddress) doc.text(input.storeAddress, textX, doc.y + 1, { width: textWidth });
    if (input.storeStateRegistration) doc.text(`IE: ${input.storeStateRegistration}`, textX, doc.y + 1, { width: textWidth });

    const badgeX = doc.page.width - 42 - 160;
    const badgeDividerY = headerTop + 30;
    doc.rect(badgeX, headerTop, 160, 64).lineWidth(1).strokeColor(colorBorder).stroke();
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

    doc.y = headerTop + 74;
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
    const vProdTotal = input.items.reduce((sum, item) => sum + item.total, 0);
    const surcharge = input.surchargeAmount != null && input.surchargeAmount > 0.009 ? input.surchargeAmount : null;
    if (surcharge != null) {
      // Quando a venda é a prazo (crediário), o "Acréscimo" normalmente é juros
      // de parcelamento — rótulo mais claro que só "Acréscimo" genérico.
      const isCrediario = /crediário/i.test(input.paymentSummary);
      const surchargeLabel = isCrediario ? "Acréscimo (venda a prazo)" : "Acréscimo";
      doc.font("Helvetica").fontSize(8).fillColor(colorMuted)
        .text(`Subtotal dos itens: ${formatMoney(vProdTotal)}    +    ${surchargeLabel}: ${formatMoney(surcharge)}`, 36, doc.y, { width: pageWidth });
      doc.moveDown(0.5);
    }
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

    const receiptFooterHeight = input.receiptFooter
      ? 32 + (input.receiptFooter.title ? 14 : 0) + doc.font("Helvetica").fontSize(9).heightOfString(input.receiptFooter.message, { width: pageWidth - 24 })
      : 0;
    if (input.receiptFooter && doc.y + 116 + receiptFooterHeight > doc.page.height - 60) doc.addPage();
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

    if (input.receiptFooter) {
      const noticeY = footerY + 104;
      doc.roundedRect(36, noticeY, pageWidth, receiptFooterHeight, 4).lineWidth(0.6).fillAndStroke("#f8fafc", colorBorder);
      let textY = noticeY + 12;
      if (input.receiptFooter.title) {
        doc.font("Helvetica-Bold").fontSize(9).fillColor(colorText).text(input.receiptFooter.title.toLocaleUpperCase("pt-BR"), 48, textY, { width: pageWidth - 24, align: "center" });
        textY = doc.y + 4;
      }
      doc.font("Helvetica").fontSize(9).fillColor(colorText).text(input.receiptFooter.message, 48, textY, { width: pageWidth - 24, align: "center" });
    }

    if (input.environment === "homologacao") {
      doc.font("Helvetica-Bold").fontSize(6.5).fillColor("#b91c1c")
        .text("EMISSÃO EM AMBIENTE DE HOMOLOGAÇÃO — SEM VALOR FISCAL", 36, doc.page.height - 50, { width: pageWidth, align: "center" });
    }

    doc.end();
  });
}
