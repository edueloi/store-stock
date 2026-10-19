import PDFDocument from "pdfkit";

import {
  formatDate,
  formatDateTime,
  formatDocument,
  formatMoney,
  type StatementData,
} from "./customer-statement.service";

const INK = "#172033";
const MUTED = "#64748b";
const LINE = "#d7dde8";
const ZEBRA = "#f8fafc";
const GREEN = "#15803d";
const AMBER = "#b45309";
const RED = "#b91c1c";

const L = 36;
const W = 523;
const PAGE_BOTTOM = 56;

type Cell = string | { t: string; color?: string; bold?: boolean };
type Column = { label: string; width: number; align?: "left" | "right" };

const STATUS_LABEL = {
  paid: { t: "Pago", color: GREEN },
  credit_open: { t: "Crediário em aberto", color: AMBER },
  credit_paid: { t: "Crediário quitado", color: GREEN },
} as const;

/** Extrato do cliente (posição do crediário, compras e pagamentos) em A4, com cara de documento. */
export function createCustomerStatementPdf(data: StatementData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const doc = new PDFDocument({
      size: "A4",
      margin: L,
      bufferPages: true,
      info: { Title: `Extrato - ${data.customer.name}`, Author: data.store.name },
    });
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    let y = 36;
    const rule = (at: number) => doc.moveTo(L, at).lineTo(L + W, at).strokeColor(LINE).lineWidth(1).stroke();
    const ensure = (height: number) => {
      if (y + height > doc.page.height - PAGE_BOTTOM) { doc.addPage(); y = 36; return true; }
      return false;
    };

    // ── Cabeçalho da loja ────────────────────────────────────────────────
    let textX = L;
    if (data.store.logoBuffer) {
      try {
        doc.image(data.store.logoBuffer, L, y, { fit: [60, 60] });
        textX = L + 72;
      } catch {
        // formato de imagem que o pdfkit não lê (ex.: webp): segue sem logo
      }
    }
    doc.fillColor(INK).font("Helvetica-Bold").fontSize(15).text(data.store.name, textX, y + 2, { width: 340 });
    const storeLines = [
      data.store.document ? `CNPJ: ${formatDocument(data.store.document)}${data.store.stateRegistration ? `   ·   IE: ${data.store.stateRegistration}` : ""}` : "",
      data.store.address,
      data.store.phone ? `WhatsApp: ${data.store.phone}` : "",
    ].filter(Boolean);
    doc.fillColor(MUTED).font("Helvetica").fontSize(8.5);
    for (const line of storeLines) doc.text(line, textX, doc.y + 1, { width: 340 });
    const headerBottom = doc.y;

    doc.fillColor(MUTED).font("Helvetica-Bold").fontSize(8).text("DOCUMENTO", 400, y + 2, { width: L + W - 400, align: "right" });
    doc.fillColor(INK).font("Helvetica-Bold").fontSize(13).text("EXTRATO DO CLIENTE", 330, doc.y + 1, { width: L + W - 330, align: "right" });
    doc.fillColor(MUTED).font("Helvetica").fontSize(8.5).text(`Emitido em ${formatDateTime(data.generatedAt)}`, 330, doc.y + 1, { width: L + W - 330, align: "right" });

    y = Math.max(doc.y, headerBottom, 36 + 60) + 10;
    rule(y);
    y += 12;

    // ── Cliente ──────────────────────────────────────────────────────────
    doc.fillColor(MUTED).font("Helvetica-Bold").fontSize(8).text("CLIENTE", L, y);
    doc.fillColor(INK).font("Helvetica-Bold").fontSize(12).text(data.customer.name, L, doc.y + 2, { width: W });
    const customerInfo = [
      data.customer.document ? `CPF/CNPJ: ${formatDocument(data.customer.document)}` : "",
      data.customer.phone ? `Telefone: ${data.customer.phone}` : "",
    ].filter(Boolean).join("   ·   ");
    if (customerInfo) doc.fillColor(MUTED).font("Helvetica").fontSize(9).text(customerInfo, L, doc.y + 1, { width: W });
    y = doc.y + 12;

    // ── Resumo ───────────────────────────────────────────────────────────
    const { summary } = data;
    const boxes: Array<{ label: string; value: string; color: string; strong?: boolean }> = [
      { label: "TOTAL EM CREDIÁRIO", value: formatMoney(summary.openTotal), color: INK },
      { label: "JÁ PAGO", value: formatMoney(summary.openPaid), color: GREEN },
      { label: "FALTA PAGAR", value: formatMoney(summary.pending), color: summary.pending > 0.004 ? AMBER : GREEN, strong: true },
      { label: "EM ATRASO", value: summary.overdue > 0.004 ? formatMoney(summary.overdue) : "—", color: summary.overdue > 0.004 ? RED : MUTED },
    ];
    const gap = 8;
    const boxW = (W - gap * 3) / 4;
    boxes.forEach((box, i) => {
      const x = L + i * (boxW + gap);
      doc.roundedRect(x, y, boxW, 52, 5).lineWidth(box.strong ? 1.6 : 1).strokeColor(box.strong ? box.color : LINE).stroke();
      doc.fillColor(MUTED).font("Helvetica-Bold").fontSize(7).text(box.label, x + 9, y + 10, { width: boxW - 18 });
      doc.fillColor(box.color).font("Helvetica-Bold").fontSize(13).text(box.value, x + 9, y + 26, { width: boxW - 18 });
    });
    y += 52 + 8;
    doc.fillColor(MUTED).font("Helvetica").fontSize(8.5);
    if (summary.pending <= 0.004) {
      doc.fillColor(GREEN).font("Helvetica-Bold").text("Cliente em dia: nenhum valor pendente.", L, y, { width: W });
    } else if (summary.nextDue) {
      doc.text(`Próximo vencimento: ${formatDate(summary.nextDue.date)} - ${formatMoney(summary.nextDue.amount)}`, L, y, { width: W });
    }
    y = doc.y + 14;

    // ── Tabelas ──────────────────────────────────────────────────────────
    const cellText = (cell: Cell) => (typeof cell === "string" ? cell : cell.t);

    const drawHeader = (columns: Column[]) => {
      let x = L;
      doc.fillColor(MUTED).font("Helvetica-Bold").fontSize(7.5);
      for (const col of columns) {
        doc.text(col.label.toUpperCase(), x + 4, y, { width: col.width - 8, align: col.align ?? "left" });
        x += col.width;
      }
      y += 12;
      rule(y);
      y += 3;
    };

    const table = (title: string, columns: Column[], rows: Cell[][], emptyText: string) => {
      ensure(60);
      doc.fillColor(INK).font("Helvetica-Bold").fontSize(10).text(title, L, y);
      y = doc.y + 6;
      if (rows.length === 0) {
        doc.fillColor(MUTED).font("Helvetica").fontSize(9).text(emptyText, L, y, { width: W });
        y = doc.y + 16;
        return;
      }
      drawHeader(columns);
      rows.forEach((row, index) => {
        doc.font("Helvetica").fontSize(8.5);
        const heights = row.map((cell, i) => doc.heightOfString(cellText(cell), { width: columns[i].width - 8 }));
        const rowH = Math.max(...heights) + 8;
        if (ensure(rowH + 14)) {
          doc.fillColor(INK).font("Helvetica-Bold").fontSize(10).text(`${title} (continuação)`, L, y);
          y = doc.y + 6;
          drawHeader(columns);
        }
        if (index % 2 === 0) doc.rect(L, y - 1, W, rowH).fillColor(ZEBRA).fill();
        let x = L;
        row.forEach((cell, i) => {
          const spec = typeof cell === "string" ? { t: cell } : cell;
          doc.fillColor(spec.color ?? INK).font(spec.bold ? "Helvetica-Bold" : "Helvetica").fontSize(8.5)
            .text(spec.t, x + 4, y + 3, { width: columns[i].width - 8, align: columns[i].align ?? "left" });
          x += columns[i].width;
        });
        y += rowH;
      });
      y += 16;
    };

    table(
      "Parcelas em aberto",
      [
        { label: "Vencimento", width: 80 },
        { label: "Descrição", width: 233 },
        { label: "Parcela", width: 60 },
        { label: "Valor", width: 80, align: "right" },
        { label: "Situação", width: 70 },
      ],
      data.openInstallments.map((i) => [
        formatDate(i.dueDate),
        i.description,
        `${i.number}/${i.count}`,
        { t: formatMoney(i.remaining), bold: true },
        i.overdue ? { t: "Vencida", color: RED, bold: true } : { t: "A vencer", color: MUTED },
      ]),
      "Nenhuma parcela em aberto.",
    );

    table(
      "Compras",
      [
        { label: "Data e hora", width: 88 },
        { label: "Pedido", width: 50 },
        { label: "Itens", width: 160 },
        { label: "Valor", width: 70, align: "right" },
        { label: "Pendente", width: 65, align: "right" },
        { label: "Situação", width: 90 },
      ],
      data.purchases.map((p) => {
        const status = STATUS_LABEL[p.status];
        return [
          formatDateTime(p.createdAt),
          `#${String(p.id).padStart(5, "0")}`,
          p.itemsSummary,
          { t: formatMoney(p.total), bold: true },
          p.pending > 0.004 ? { t: formatMoney(p.pending), color: AMBER, bold: true } : { t: "—", color: MUTED },
          { t: status.t, color: status.color },
        ];
      }),
      "Nenhuma compra registrada.",
    );

    table(
      "Pagamentos recebidos",
      [
        { label: "Data e hora", width: 110 },
        { label: "Forma", width: 90 },
        { label: "Referente a", width: 233 },
        { label: "Valor", width: 90, align: "right" },
      ],
      data.payments.map((p) => [
        formatDateTime(p.paidAt),
        p.method,
        p.description,
        { t: formatMoney(p.amount), color: GREEN, bold: true },
      ]),
      "Nenhum pagamento registrado.",
    );

    // ── Rodapé em todas as páginas ───────────────────────────────────────
    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i += 1) {
      doc.switchToPage(range.start + i);
      const footerY = doc.page.height - 38;
      const oldBottom = doc.page.margins.bottom;
      doc.page.margins.bottom = 0; // sem isso o texto do rodapé abre uma página nova
      rule(footerY - 6);
      doc.fillColor(MUTED).font("Helvetica").fontSize(7.5)
        .text("Documento informativo, sem valor fiscal. Os valores refletem a posição na data de emissão.", L, footerY, { width: 400, lineBreak: false })
        .text(`Página ${i + 1} de ${range.count}`, L + W - 100, footerY, { width: 100, align: "right", lineBreak: false });
      doc.page.margins.bottom = oldBottom;
    }

    doc.end();
  });
}
