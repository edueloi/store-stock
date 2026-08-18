import { downloadHtmlAsPdf } from "./pdf";
import {
  buildDocumentHeaderHtml,
  buildDocumentTableHtml,
  DOCUMENT_BASE_CSS,
  fmtMoney,
  type DocumentTenant,
} from "./documentPdf";

const PM_LABEL: Record<string, string> = {
  money: "Dinheiro", debit: "Cartão de Débito", credit: "Cartão de Crédito", pix: "PIX",
};

export interface QuotePdfItem {
  product_id?: number | null;
  name: string;
  quantity: number;
  unit_price: number;
  total: number;
  dimensions_label?: string | null;
}

export interface QuotePdfService {
  name: string;
  quantity: number;
  unit_price: number;
}

export interface QuotePdfCustomer {
  name: string;
  phone?: string | null;
  email?: string | null;
  document?: string | null;
  address?: string | null;
}

export interface QuotePdfData {
  number: number;
  customer_name: string;
  customer_phone?: string | null;
  customer_email?: string | null;
  subtotal: number;
  discount_type: "percent" | "fixed";
  discount_value: number;
  total_amount: number;
  validity_days: number;
  notes?: string | null;
  status?: string;
  created_at: string;
  deposit_amount?: number | null;
  deposit_payment_method?: string | null;
  items: QuotePdfItem[];
  services?: QuotePdfService[];
}

function quoteItemUnit(dimLabel?: string | null): string {
  if (!dimLabel) return "UN";
  return /m²|m2/i.test(dimLabel) ? "M²" : "UN";
}

export async function generateQuotePDF(
  quote: QuotePdfData,
  tenant: DocumentTenant,
  opts?: { customer?: QuotePdfCustomer | null; sellerName?: string | null },
) {
  const brandColor = tenant.primary_color ?? "#2563eb";
  const dateStr = new Date(quote.created_at).toLocaleDateString("pt-BR");
  const validUntil = new Date(
    new Date(quote.created_at).getTime() + quote.validity_days * 86400000,
  ).toLocaleDateString("pt-BR");

  const header = buildDocumentHeaderHtml(tenant, {
    docTitle: "Orçamento",
    docNumber: String(quote.number).padStart(4, "0"),
    docDateLabel: "Emitido em",
    docDate: dateStr,
    extraTopRight: [`Válido até ${validUntil}`],
  });

  const itemsTable = buildDocumentTableHtml(
    [
      { label: "Cód", align: "center", width: "45px" },
      { label: "Descrição" },
      { label: "Un", align: "center", width: "40px" },
      { label: "Qtd", align: "center", width: "45px" },
      { label: "Preço Unit.", align: "right", width: "85px" },
      { label: "Total", align: "right", width: "85px" },
    ],
    [
      ...quote.items.map((i) => ({
        cells: [
          i.product_id ? String(i.product_id) : "—",
          i.name,
          quoteItemUnit(i.dimensions_label),
          String(i.quantity),
          fmtMoney(Number(i.unit_price)),
          fmtMoney(Number(i.total)),
        ],
        sub: i.dimensions_label ?? undefined,
      })),
      ...(quote.services ?? []).map((s) => ({
        cells: [
          "SERV",
          s.name,
          "UN",
          String(s.quantity),
          fmtMoney(Number(s.unit_price)),
          fmtMoney(Number(s.unit_price) * s.quantity),
        ],
      })),
    ],
  );

  const discountAmt = quote.discount_value > 0
    ? (quote.discount_type === "percent"
        ? (Number(quote.subtotal) * Number(quote.discount_value)) / 100
        : Number(quote.discount_value))
    : 0;
  const discountLabel = quote.discount_type === "percent"
    ? `Desconto (${quote.discount_value}%)`
    : "Desconto";

  const depositAmt = Number(quote.deposit_amount ?? 0);
  const remaining = Math.max(0, Number(quote.total_amount) - depositAmt);
  const paymentMethodLabel = quote.deposit_payment_method ? (PM_LABEL[quote.deposit_payment_method] ?? quote.deposit_payment_method) : "";

  const customer = opts?.customer;
  const clientLines = [
    customer?.document ? `${customer.document.replace(/\D/g, "").length > 11 ? "CNPJ" : "CPF"}: ${customer.document}` : "",
    [customer?.phone ?? quote.customer_phone, customer?.email ?? quote.customer_email].filter(Boolean).join("  |  "),
    customer?.address ?? "",
  ].filter(Boolean);

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8"/>
<title>Orçamento #${String(quote.number).padStart(4, "0")}</title>
<style>
  :root { --doc-brand: ${brandColor}; }
  ${DOCUMENT_BASE_CSS}
</style>
</head>
<body>

${header}

<div class="doc-section" style="display:flex;gap:24px;">
  <div style="flex:1;">
    <div class="doc-section-label">Cliente</div>
    <div class="doc-info-grid" style="grid-template-columns:1fr;">
      <div class="doc-info-row"><b>${quote.customer_name || customer?.name || "—"}</b></div>
      ${clientLines.map((l) => `<div class="doc-info-row">${l}</div>`).join("")}
    </div>
  </div>
  <div style="flex:1;">
    <div class="doc-section-label">Detalhes do Orçamento</div>
    <div class="doc-info-grid" style="grid-template-columns:1fr;">
      ${opts?.sellerName ? `<div class="doc-info-row">Atendente: <b>${opts.sellerName}</b></div>` : ""}
      <div class="doc-info-row">Validade: <b>${quote.validity_days} dia(s)</b> (até ${validUntil})</div>
      ${paymentMethodLabel ? `<div class="doc-info-row">Forma de pagamento: <b>${paymentMethodLabel}</b></div>` : ""}
    </div>
  </div>
</div>

<div class="doc-section">
  <div class="doc-section-label">Itens / Serviços</div>
  ${itemsTable}
</div>

<div class="doc-section">
  <div class="doc-totals">
    <div class="doc-totals-box">
      <div class="doc-totals-row"><span>Subtotal</span><span>${fmtMoney(Number(quote.subtotal))}</span></div>
      ${discountAmt > 0 ? `<div class="doc-totals-row"><span>${discountLabel}</span><span>- ${fmtMoney(discountAmt)}</span></div>` : ""}
      <div class="doc-totals-row grand"><span>TOTAL</span><span>${fmtMoney(Number(quote.total_amount))}</span></div>
      ${depositAmt > 0 ? `
      <div class="doc-totals-row" style="margin-top:8px"><span>Entrada paga</span><span>${fmtMoney(depositAmt)}</span></div>
      <div class="doc-totals-row"><span>Restante</span><span>${fmtMoney(remaining)}</span></div>` : ""}
    </div>
  </div>
</div>

${quote.notes ? `
<div class="doc-section">
  <div class="doc-section-label">Observações / Condições de Pagamento</div>
  <div class="doc-obs-box">${quote.notes}</div>
</div>` : ""}

<div class="doc-signatures">
  <div class="doc-sig-block">Assinatura e carimbo da empresa</div>
  <div class="doc-sig-block">Assinatura do cliente</div>
</div>

<div class="doc-footer">
  Documento emitido em ${new Date().toLocaleString("pt-BR")} — Este documento não tem valor fiscal.<br/>
  ** ORÇAMENTO/PEDIDO SEM VALOR FISCAL — EXIJA A NOTA FISCAL **
</div>

</body>
</html>`;

  await downloadHtmlAsPdf(html, `orcamento-${String(quote.number).padStart(4, "0")}-${(quote.customer_name || "cliente").replace(/\s+/g, "-")}.pdf`);
}
