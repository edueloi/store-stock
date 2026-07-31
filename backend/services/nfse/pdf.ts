import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import bwipjs from "bwip-js";

function formatMoney(v: number): string {
  return `R$ ${Number(v).toFixed(2).replace(".", ",")}`;
}

function formatCpfCnpj(v: string | null | undefined): string {
  const d = String(v || "").replace(/\D/g, "");
  if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  return v || "";
}

function formatPhone(v: string | null | undefined): string {
  const d = String(v || "").replace(/\D/g, "");
  if (d.length === 11) return d.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
  if (d.length === 10) return d.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
  return v || "";
}

export interface GenerateNfsePdfInput {
  logoBuffer?: Buffer | null;
  emitterName: string;
  emitterDisplayName?: string | null;
  emitterDocument: string;
  emitterIM?: string | null;
  emitterRegime: string;
  emitterAddress?: string | null;
  emitterEmail?: string | null;
  emitterPhone?: string | null;
  tomadorNome?: string | null;
  tomadorDocumento?: string | null;
  numero: number;
  serie: number;
  environment: "homologacao" | "producao";
  chaveAcesso?: string | null;
  authorizedAt?: Date | null;
  codigoVerificacao?: string | null;
  codigoTributacao: string;
  descricaoTributacao?: string | null;
  descricaoServico: string;
  valorServico: number;
  aliquotaIss?: number | null;
  valorIss?: number | null;
}

// Gera o PDF de representação da NFS-e (não é um DANFE — NFS-e não tem documento
// auxiliar padronizado nesse formato; aqui é um documento A4 completo com os dados
// da nota, logo da loja, QR Code e código de barras da chave de acesso, para o
// cliente/prestador imprimir ou guardar).
export async function generateNfsePdf(input: GenerateNfsePdfInput): Promise<Buffer> {
  const {
    logoBuffer, emitterName, emitterDisplayName, emitterDocument, emitterIM, emitterRegime,
    emitterAddress, emitterEmail, emitterPhone,
    tomadorNome, tomadorDocumento,
    numero, serie, environment,
    chaveAcesso, authorizedAt, codigoVerificacao,
    codigoTributacao, descricaoTributacao,
    descricaoServico, valorServico, aliquotaIss, valorIss,
  } = input;

  // O QR code aponta para a consulta pública oficial já com a chave preenchida —
  // um texto solto com a chave não abre nada ao ser escaneado pela câmera do celular.
  const qrUrl = chaveAcesso
    ? `https://www.nfse.gov.br/ConsultaPublica/?tpc=1&chave=${chaveAcesso}`
    : "https://www.nfse.gov.br/consultapublica";
  const qrPng = await QRCode.toBuffer(qrUrl, { margin: 1, scale: 6 });
  const barcodePng = await bwipjs.toBuffer({
    bcid: "code128",
    text: chaveAcesso || "00000000000000000000000000000000000000000000000",
    scale: 2,
    height: 12,
    includetext: false,
  });

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const doc = new PDFDocument({ size: "A4", margin: 36 });
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const pageWidth = doc.page.width - 72;
    const colorPrimary = "#5b21b6";
    const colorPrimaryLight = "#f5f3ff";
    const colorText = "#1e293b";
    const colorMuted = "#64748b";
    const colorBorder = "#e2e8f0";

    const headerTop = doc.y;
    const headerName = emitterDisplayName || emitterName;
    if (logoBuffer) {
      doc.image(logoBuffer, 36, headerTop, { fit: [64, 64] });
    } else {
      doc.roundedRect(36, headerTop, 64, 64, 8).fill(colorPrimaryLight);
      doc.fillColor(colorPrimary).font("Helvetica-Bold").fontSize(22)
        .text((headerName || "?").charAt(0).toUpperCase(), 36, headerTop + 18, { width: 64, align: "center" });
    }

    const textX = 36 + 64 + 14;
    const textWidth = pageWidth - 64 - 14 - 170;
    doc.fillColor(colorText).font("Helvetica-Bold").fontSize(13)
      .text(headerName || "", textX, headerTop, { width: textWidth });
    doc.font("Helvetica").fontSize(8.5).fillColor(colorMuted);
    doc.text(`CNPJ/CPF: ${formatCpfCnpj(emitterDocument)}${emitterIM ? `   IM: ${emitterIM}` : ""}`, textX, doc.y + 2, { width: textWidth });
    if (emitterAddress) doc.text(emitterAddress, textX, doc.y + 1, { width: textWidth });
    const contactLine = [emitterPhone ? formatPhone(emitterPhone) : null, emitterEmail].filter(Boolean).join("   ");
    if (contactLine) doc.text(contactLine, textX, doc.y + 1, { width: textWidth });

    const badgeX = doc.page.width - 36 - 160;
    doc.roundedRect(badgeX, headerTop, 160, 64, 8).fillAndStroke(colorPrimaryLight, colorBorder);
    doc.fillColor(colorPrimary).font("Helvetica-Bold").fontSize(9)
      .text("NFS-e", badgeX, headerTop + 10, { width: 160, align: "center" });
    doc.fontSize(7.5).font("Helvetica").fillColor(colorMuted)
      .text("Nota Fiscal de Serviço Eletrônica", badgeX, doc.y + 1, { width: 160, align: "center" });
    doc.font("Helvetica-Bold").fontSize(11).fillColor(colorText)
      .text(`Nº ${numero}  •  Série ${serie}`, badgeX, headerTop + 38, { width: 160, align: "center" });
    if (environment !== "producao") {
      doc.font("Helvetica-Bold").fontSize(7).fillColor("#b45309")
        .text("HOMOLOGAÇÃO — SEM VALOR FISCAL", badgeX, headerTop + 52, { width: 160, align: "center" });
    }

    doc.y = headerTop + 74;
    doc.moveTo(36, doc.y).lineTo(doc.page.width - 36, doc.y).lineWidth(1.5).strokeColor(colorPrimary).stroke();
    doc.moveDown(0.8);

    function sectionTitle(label: string) {
      doc.moveDown(0.6);
      const y = doc.y;
      doc.rect(36, y, 3, 12).fill(colorPrimary);
      doc.font("Helvetica-Bold").fontSize(9).fillColor(colorPrimary)
        .text(label.toUpperCase(), 44, y, { characterSpacing: 0.5 });
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

    sectionTitle("Prestador do serviço");
    fieldRow([
      { label: "Razão social", value: emitterName },
      { label: "CNPJ/CPF", value: formatCpfCnpj(emitterDocument) },
    ]);
    fieldRow([
      { label: "Inscrição municipal", value: emitterIM || "Não informada" },
      { label: "Regime tributário", value: emitterRegime },
    ]);
    if (emitterAddress) {
      doc.font("Helvetica").fontSize(7).fillColor(colorMuted).text("ENDEREÇO", 36, doc.y, { characterSpacing: 0.3 });
      doc.font("Helvetica-Bold").fontSize(9.5).fillColor(colorText).text(emitterAddress, 36, doc.y + 1, { width: pageWidth });
      doc.moveDown(0.6);
    }

    sectionTitle("Tomador do serviço");
    fieldRow([
      { label: "Nome / Razão social", value: tomadorNome || "Consumidor final" },
      { label: "CPF/CNPJ", value: tomadorDocumento ? formatCpfCnpj(tomadorDocumento) : "Não informado" },
    ]);

    sectionTitle("Discriminação do serviço");
    fieldRow([
      { label: "Código de tributação (LC 116/03)", value: `${codigoTributacao}${descricaoTributacao ? ` — ${descricaoTributacao}` : ""}` },
    ]);
    doc.font("Helvetica").fontSize(9).fillColor(colorText)
      .text(descricaoServico || "", 36, doc.y, { width: pageWidth });
    doc.moveDown(0.6);

    sectionTitle("Valores");
    const boxY = doc.y;
    const boxH = 54;
    doc.roundedRect(36, boxY, pageWidth, boxH, 8).fillAndStroke("#f8fafc", colorBorder);
    const valCols = [
      { label: "Valor do serviço", value: formatMoney(valorServico) },
      { label: "Alíquota ISS", value: aliquotaIss != null ? `${Number(aliquotaIss).toFixed(2)}%` : "Apurado pelo Simples Nacional" },
      { label: "Valor aprox. ISS", value: valorIss != null ? formatMoney(valorIss) : "—" },
    ];
    const vw = pageWidth / valCols.length;
    valCols.forEach((v, i) => {
      const x = 36 + i * vw;
      doc.font("Helvetica").fontSize(7.5).fillColor(colorMuted).text(v.label.toUpperCase(), x + 14, boxY + 10, { width: vw - 28, characterSpacing: 0.3 });
      doc.font("Helvetica-Bold").fontSize(14).fillColor(i === 0 ? colorPrimary : colorText).text(v.value, x + 14, boxY + 24, { width: vw - 28 });
    });
    doc.y = boxY + boxH + 10;

    sectionTitle("Identificação da NFS-e");
    fieldRow([
      { label: "Data/hora de autorização", value: authorizedAt ? new Date(authorizedAt).toLocaleString("pt-BR") : "—" },
      { label: "Código de verificação", value: codigoVerificacao || "—" },
    ]);
    doc.font("Helvetica").fontSize(7).fillColor(colorMuted).text("CHAVE DE ACESSO", 36, doc.y, { characterSpacing: 0.3 });
    doc.font("Helvetica-Bold").fontSize(9.5).fillColor(colorText).text(chaveAcesso || "", 36, doc.y + 1, { width: pageWidth });
    doc.moveDown(0.8);

    const footerY = doc.y + 6;
    doc.moveTo(36, footerY).lineTo(doc.page.width - 36, footerY).strokeColor(colorBorder).lineWidth(1).stroke();

    const qrSize = 78;
    doc.image(qrPng, 36, footerY + 12, { width: qrSize, height: qrSize });

    const barcodeX = 36 + qrSize + 16;
    const barcodeWidth = pageWidth - qrSize - 16;
    doc.image(barcodePng, barcodeX, footerY + 24, { width: barcodeWidth, height: 32 });
    doc.font("Helvetica").fontSize(6.5).fillColor(colorMuted)
      .text(chaveAcesso || "", barcodeX, footerY + 58, { width: barcodeWidth, align: "center" });

    doc.font("Helvetica").fontSize(7).fillColor(colorMuted)
      .text("Consulte a autenticidade desta NFS-e no portal do Sistema Nacional NFS-e (nfse.gov.br) utilizando a chave de acesso acima.",
        barcodeX, footerY + 68, { width: barcodeWidth });

    doc.font("Helvetica-Oblique").fontSize(6.5).fillColor(colorMuted)
      .text("Documento gerado a partir dos dados da DPS/NFS-e do Sistema Nacional NFS-e. Não substitui a consulta oficial pela chave de acesso.",
        36, doc.page.height - 50, { width: pageWidth, align: "center" });

    doc.end();
  });
}
