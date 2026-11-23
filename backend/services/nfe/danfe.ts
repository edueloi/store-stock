import PDFDocument from "pdfkit";
import bwipjs from "bwip-js";

// DANFE da NF-e (modelo 55) em A4, retrato. Documento auxiliar: o documento fiscal é o XML autorizado.

export interface NfeDanfeItem {
  code: string;
  name: string;
  ncm: string;
  cfop: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface NfeDanfeInput {
  environment: "homologacao" | "producao";
  chaveAcesso: string;
  numero: number;
  serie: number;
  natureza: string;
  protocolo: string | null;
  emittedAt: Date;
  emit: { name: string; document: string; ie: string | null; address: string; phone?: string | null };
  dest: { name: string; document: string; ie: string | null; address: string; email?: string | null; phone?: string | null };
  items: NfeDanfeItem[];
  totals: { products: number; freight: number; discount: number; other: number; total: number };
  freightLabel: string;
  carrierLabel: string | null;
  paymentSummary: string;
  additionalInfo: string | null;
}

const money = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const qty = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 4 });

export function formatDocument(raw: string): string {
  const d = (raw ?? "").replace(/\D/g, "");
  if (d.length === 14) return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
  if (d.length === 11) return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
  return raw;
}

const formatKey = (k: string) => k.replace(/(\d{4})(?=\d)/g, "$1 ").trim();

export async function generateNfeDanfePdf(input: NfeDanfeInput): Promise<Buffer> {
  const barcodePng = await bwipjs.toBuffer({ bcid: "code128", text: input.chaveAcesso, scale: 2, height: 10, includetext: false });

  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 28 });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const left = 28;
    const width = doc.page.width - 56;
    const ink = "#0f172a";
    const muted = "#475569";
    const line = "#64748b";

    const box = (x: number, y: number, w: number, h: number) => doc.rect(x, y, w, h).lineWidth(0.6).strokeColor(line).stroke();
    const field = (label: string, value: string, x: number, y: number, w: number, h = 26, bold = false) => {
      box(x, y, w, h);
      doc.font("Helvetica").fontSize(5.8).fillColor(muted).text(label.toUpperCase(), x + 3, y + 2.5, { width: w - 6 });
      doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(8).fillColor(ink).text(value || "—", x + 3, y + 11, { width: w - 6, height: h - 12, ellipsis: true });
    };
    const title = (label: string, y: number) => {
      doc.font("Helvetica-Bold").fontSize(7).fillColor(ink).text(label.toUpperCase(), left, y);
      return y + 10;
    };

    // ── cabeçalho: emitente | DANFE | código de barras ──
    let y = 28;
    const h1 = 84;
    box(left, y, width * 0.38, h1);
    doc.font("Helvetica-Bold").fontSize(10).fillColor(ink).text(input.emit.name, left + 6, y + 8, { width: width * 0.38 - 12 });
    doc.font("Helvetica").fontSize(7.5).fillColor(muted).text(input.emit.address, left + 6, doc.y + 3, { width: width * 0.38 - 12 });
    if (input.emit.phone) doc.text(`Fone: ${input.emit.phone}`, left + 6, doc.y + 2, { width: width * 0.38 - 12 });

    const midX = left + width * 0.38;
    const midW = width * 0.2;
    box(midX, y, midW, h1);
    doc.font("Helvetica-Bold").fontSize(13).fillColor(ink).text("DANFE", midX, y + 6, { width: midW, align: "center" });
    doc.font("Helvetica").fontSize(6).fillColor(muted).text("Documento Auxiliar da Nota Fiscal Eletrônica", midX + 4, y + 23, { width: midW - 8, align: "center" });
    doc.font("Helvetica").fontSize(7).fillColor(ink).text("0 - ENTRADA\n1 - SAÍDA", midX + 8, y + 40, { width: midW - 16 });
    box(midX + midW - 24, y + 42, 16, 16);
    doc.font("Helvetica-Bold").fontSize(10).text("1", midX + midW - 24, y + 45, { width: 16, align: "center" });
    doc.font("Helvetica-Bold").fontSize(8).text(`Nº ${input.numero}   Série ${input.serie}`, midX, y + 66, { width: midW, align: "center" });

    const rightX = midX + midW;
    const rightW = left + width - rightX;
    box(rightX, y, rightW, h1);
    doc.image(barcodePng, rightX + 6, y + 6, { width: rightW - 12, height: 30 });
    doc.font("Helvetica").fontSize(5.8).fillColor(muted).text("CHAVE DE ACESSO", rightX + 4, y + 41, { width: rightW - 8 });
    doc.font("Helvetica-Bold").fontSize(7.2).fillColor(ink).text(formatKey(input.chaveAcesso), rightX + 4, y + 49, { width: rightW - 8 });
    doc.font("Helvetica").fontSize(5.8).fillColor(muted).text("Consulta de autenticidade no portal nacional da NF-e (www.nfe.fazenda.gov.br/portal) ou no site da SEFAZ autorizadora.", rightX + 4, y + 66, { width: rightW - 8 });

    y += h1;
    field("Natureza da operação", input.natureza, left, y, width * 0.58, 26, true);
    field("Protocolo de autorização de uso", input.protocolo ? `${input.protocolo} - ${input.emittedAt.toLocaleString("pt-BR")}` : "—", left + width * 0.58, y, width * 0.42, 26);
    y += 26;
    field("Inscrição estadual", input.emit.ie ?? "", left, y, width * 0.3);
    field("CNPJ do emitente", formatDocument(input.emit.document), left + width * 0.3, y, width * 0.3);
    field("Data de emissão", input.emittedAt.toLocaleDateString("pt-BR"), left + width * 0.6, y, width * 0.4);
    y += 34;

    // ── destinatário ──
    y = title("Destinatário / Remetente", y);
    field("Nome / Razão social", input.dest.name, left, y, width * 0.62, 26, true);
    field("CNPJ / CPF", formatDocument(input.dest.document), left + width * 0.62, y, width * 0.38);
    y += 26;
    field("Endereço", input.dest.address, left, y, width * 0.62);
    field("Inscrição estadual", input.dest.ie ?? "", left + width * 0.62, y, width * 0.38);
    y += 26;
    field("E-mail", input.dest.email ?? "", left, y, width * 0.62);
    field("Telefone", input.dest.phone ?? "", left + width * 0.62, y, width * 0.38);
    y += 34;

    // ── cálculo do imposto / totais ──
    y = title("Cálculo do imposto", y);
    const colW = width / 5;
    [
      ["Valor dos produtos", money(input.totals.products)],
      ["Valor do frete", money(input.totals.freight)],
      ["Desconto", money(input.totals.discount)],
      ["Outras despesas", money(input.totals.other)],
      ["Valor total da nota", money(input.totals.total)],
    ].forEach(([label, value], i) => field(label, value, left + i * colW, y, colW, 26, i === 4));
    y += 34;

    // ── transportador ──
    y = title("Transportador / Volumes", y);
    field("Frete por conta", input.freightLabel, left, y, width * 0.4);
    field("Transportadora", input.carrierLabel ?? "—", left + width * 0.4, y, width * 0.6);
    y += 34;

    // ── itens ──
    y = title("Dados dos produtos / serviços", y);
    const cols = [
      { label: "Código", w: 0.1 }, { label: "Descrição", w: 0.34 }, { label: "NCM", w: 0.09 }, { label: "CFOP", w: 0.06 },
      { label: "Un", w: 0.05 }, { label: "Qtd", w: 0.08 }, { label: "Vl. unit.", w: 0.13 }, { label: "Vl. total", w: 0.15 },
    ];
    const drawHeader = (yy: number) => {
      let cx = left;
      doc.rect(left, yy, width, 14).fillAndStroke("#e2e8f0", line);
      cols.forEach((c) => {
        const w = width * c.w;
        doc.font("Helvetica-Bold").fontSize(6.2).fillColor(ink).text(c.label.toUpperCase(), cx + 3, yy + 4, { width: w - 6 });
        cx += w;
      });
      return yy + 14;
    };
    y = drawHeader(y);
    input.items.forEach((it) => {
      const descH = doc.font("Helvetica").fontSize(7).heightOfString(it.name, { width: width * 0.34 - 6 });
      const rowH = Math.max(14, descH + 6);
      if (y + rowH > doc.page.height - 120) { doc.addPage(); y = drawHeader(28); }
      const values = [it.code, it.name, it.ncm, it.cfop, it.unit, qty(it.quantity), money(it.unitPrice), money(it.total)];
      let cx = left;
      cols.forEach((c, i) => {
        const w = width * c.w;
        doc.font("Helvetica").fontSize(7).fillColor(ink).text(values[i], cx + 3, y + 3, { width: w - 6, align: i >= 5 ? "right" : "left" });
        cx += w;
      });
      doc.moveTo(left, y + rowH).lineTo(left + width, y + rowH).lineWidth(0.4).strokeColor("#cbd5e1").stroke();
      y += rowH;
    });
    y += 10;

    // ── pagamento / dados adicionais ──
    if (y + 90 > doc.page.height - 60) { doc.addPage(); y = 28; }
    y = title("Pagamento", y);
    field("Forma de pagamento", input.paymentSummary, left, y, width);
    y += 34;
    y = title("Dados adicionais", y);
    const noteH = Math.max(40, doc.font("Helvetica").fontSize(7.5).heightOfString(input.additionalInfo ?? "", { width: width - 8 }) + 12);
    box(left, y, width, noteH);
    doc.font("Helvetica").fontSize(7.5).fillColor(ink).text(input.additionalInfo || "—", left + 4, y + 5, { width: width - 8 });

    if (input.environment === "homologacao") {
      doc.font("Helvetica-Bold").fontSize(8).fillColor("#b91c1c")
        .text("NF-e EMITIDA EM AMBIENTE DE HOMOLOGAÇÃO — SEM VALOR FISCAL", left, doc.page.height - 44, { width, align: "center" });
    }
    doc.end();
  });
}
