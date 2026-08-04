import { Clock, Send, Search, ThumbsUp, Wrench, Package, FileCheck, CheckCircle2, XCircle } from "lucide-react";
import { createElement } from "react";
import { downloadHtmlAsPdf } from "../../lib/pdf";
import { buildDocumentHeaderHtml, buildDocumentTableHtml, DOCUMENT_BASE_CSS, fmtMoney } from "../../lib/documentPdf";
import type { Tenant as AppTenant } from "../../types";

// ─── Types ────────────────────────────────────────────────────────────────────

export type SOStatus =
  | "rascunho"
  | "orcamento_enviado"
  | "aguardando_aprovacao"
  | "aprovado"
  | "em_producao"
  | "finalizado"
  | "nota_emitida"
  | "entregue"
  | "cancelada";

export interface ChecklistItem {
  id: number;
  label: string;
  answer: "sim" | "nao" | "na" | null;
  observation: string | null;
  position: number;
}

export interface ServiceOrderPart {
  id: number;
  product_id: number | null;
  name: string;
  quantity: number;
  unit: string;
  unit_price: number;
  total_before_discount: number;
  discount_type: "percent" | "fixed";
  discount_value: number;
  total: number;
  no_charge: boolean;
  dimensions_label?: string | null;
}

export interface ServiceOrderPhoto {
  id: number;
  url: string;
  caption: string | null;
  kind: "intake" | "damage";
  created_at: string;
}

export interface ServiceOrderActionLog {
  id: number;
  action: string;
  from_status: string | null;
  to_status: string | null;
  actor: string | null;
  note: string | null;
  created_at: string;
}

export interface NfseInvoice {
  id: number;
  status: "pending" | "processing" | "authorized" | "rejected" | "error" | "cancelled";
  environment: string;
  serie: number;
  numero: number;
  chave_acesso: string | null;
  rejection_code: string | null;
  rejection_reason: string | null;
  authorized_at: string | null;
}

export interface ServiceOrder {
  id: number;
  number: number;
  customer_id: number | null;
  customer_name: string;
  customer_phone: string | null;
  equipment_category: string;
  equipment_type: string | null;
  equipment_brand: string | null;
  equipment_model: string | null;
  equipment_serial: string | null;
  equipment_accessories: string | null;
  reported_issue: string | null;
  seller_id: number | null;
  technician_id: number | null;
  technician: { id: number; name: string } | null;
  technician_name: string | null;
  status: SOStatus;
  priority: "normal" | "urgente";
  promised_at: string | null;
  service_value: number;
  parts_total: number;
  subtotal: number;
  discount_type: "percent" | "fixed";
  discount_value: number;
  total_amount: number;
  warranty_days: number | null;
  warranty_terms: string | null;
  observations: string | null;
  invoiced_order_id: number | null;
  invoiced_at: string | null;
  cancel_reason: string | null;
  created_at: string;
  checklist_items: ChecklistItem[];
  parts: ServiceOrderPart[];
  photos: ServiceOrderPhoto[];
  actions?: ServiceOrderActionLog[];
}

export interface Product {
  id: number;
  name: string;
  price: number;
  stock_quantity: number;
  is_active?: boolean;
  sale_unit?: "unidade" | "m2" | "linear";
  price_per_measure?: number;
  min_billable_quantity?: number;
}

export interface Customer {
  id: number;
  name: string;
  phone?: string;
}

export interface Seller {
  id: number;
  name: string;
  is_active?: boolean;
}

export interface Technician {
  id: number;
  name: string;
  is_active?: boolean;
}

export type Tenant = Pick<
  AppTenant,
  | "name" | "document" | "logo_url" | "whatsapp"
  | "address_street" | "address_number" | "address_complement" | "address_district"
  | "address_city" | "address_state" | "address_zip" | "address"
  | "primary_color" | "razao_social" | "inscricao_estadual" | "inscricao_municipal"
> & {
  card_fees?: Record<string, number[]>;
  policies?: { service_order_checklists?: Record<string, { label: string }[]> };
};

// ─── Payment engine (same as Quotes.tsx / PDV) ───────────────────────────────

export type PayMethod = "money" | "debit" | "credit" | "pix";
export type PayBrand = "visa" | "master" | "elo" | "amex" | "hiper" | "other";

export interface InvoicePayment {
  id: string;
  method: PayMethod;
  cardBrand: PayBrand;
  installments: number;
  amount: string;
}

export const PM_LABEL: Record<PayMethod, string> = { money: "Dinheiro", debit: "Débito", credit: "Crédito", pix: "PIX" };

export const CARD_BRANDS: { key: PayBrand; label: string; color: string }[] = [
  { key: "visa", label: "Visa", color: "#1A1F71" },
  { key: "master", label: "Mastercard", color: "#EB001B" },
  { key: "elo", label: "Elo", color: "#00A4E0" },
  { key: "amex", label: "Amex", color: "#2E77BC" },
  { key: "hiper", label: "Hipercard", color: "#B22222" },
  { key: "other", label: "Outra", color: "#64748b" },
];

export function newPayment(): InvoicePayment {
  return { id: Math.random().toString(36).slice(2), method: "money", cardBrand: "visa", installments: 1, amount: "" };
}

export function buildPmString(payments: InvoicePayment[]): string {
  return payments
    .filter((p) => Number(p.amount) > 0)
    .map((p) => {
      const brand = (p.method === "credit" || p.method === "debit") ? `-${p.cardBrand}` : "";
      const inst = p.method === "credit" && p.installments > 1 ? `-${p.installments}x` : "";
      return `${p.method}${brand}${inst}:${Number(p.amount).toFixed(2)}`;
    })
    .join("|");
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export const fmt = (v: number) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function maskPhone(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 10) return d.replace(/(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3").replace(/-$/, "");
  return d.replace(/(\d{2})(\d{5})(\d{0,4})/, "($1) $2-$3").replace(/-$/, "");
}
export function maskDoc(v: string) {
  const d = v.replace(/\D/g, "");
  if (d.length <= 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{0,2})/, "$1.$2.$3-$4").replace(/-$/, "").replace(/\.{1,}$/, "");
  return d.slice(0, 14).replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{0,2})/, "$1.$2.$3/$4-$5").replace(/-$/, "").replace(/\/$/, "");
}

export const authHeader = () => ({
  Authorization: `Bearer ${localStorage.getItem("token")}`,
  "Content-Type": "application/json",
});

export const authHeaderNoJson = () => ({
  Authorization: `Bearer ${localStorage.getItem("token")}`,
});

export const STATUS_META: Record<SOStatus, { label: string; color: string; icon: React.ReactNode }> = {
  rascunho: { label: "Rascunho", color: "text-slate-500 bg-slate-100", icon: createElement(Clock, { size: 12 }) },
  orcamento_enviado: { label: "Orçamento Enviado", color: "text-blue-600 bg-blue-50", icon: createElement(Send, { size: 12 }) },
  aguardando_aprovacao: { label: "Aguardando Aprovação", color: "text-amber-600 bg-amber-50", icon: createElement(Search, { size: 12 }) },
  aprovado: { label: "Aprovado", color: "text-teal-600 bg-teal-50", icon: createElement(ThumbsUp, { size: 12 }) },
  em_producao: { label: "Em Produção", color: "text-violet-600 bg-violet-50", icon: createElement(Wrench, { size: 12 }) },
  finalizado: { label: "Finalizado", color: "text-cyan-600 bg-cyan-50", icon: createElement(Package, { size: 12 }) },
  nota_emitida: { label: "Nota Emitida", color: "text-indigo-600 bg-indigo-50", icon: createElement(FileCheck, { size: 12 }) },
  entregue: { label: "Entregue", color: "text-emerald-600 bg-emerald-50", icon: createElement(CheckCircle2, { size: 12 }) },
  cancelada: { label: "Cancelada", color: "text-red-600 bg-red-50", icon: createElement(XCircle, { size: 12 }) },
};

export const STATUS_ORDER: SOStatus[] = [
  "rascunho",
  "orcamento_enviado",
  "aguardando_aprovacao",
  "aprovado",
  "em_producao",
  "finalizado",
  "nota_emitida",
  "entregue",
  "cancelada",
];

// ─── PDF template ─────────────────────────────────────────────────────────────

export function buildServiceOrderIntakeHtml(so: ServiceOrder, tenant: Tenant | null): string {
  const brandColor = tenant?.primary_color ?? "#2563eb";
  const orderNum = String(so.number).padStart(6, "0");
  const orderDate = new Date(so.created_at).toLocaleDateString("pt-BR");
  const responsavel = so.technician_name || so.technician?.name || (so.seller_id ? "Vendedor cadastrado" : "—");
  const promisedStr = so.promised_at ? new Date(so.promised_at + "T12:00:00").toLocaleDateString("pt-BR") : "";

  const answerLabel = (a: ChecklistItem["answer"]) => (a === "sim" ? "Sim" : a === "nao" ? "Não" : a === "na" ? "N/A" : "—");

  const checklistTable = so.checklist_items.length
    ? buildDocumentTableHtml(
        [
          { label: "Item" },
          { label: "Situação", align: "center", width: "70px" },
          { label: "Observação" },
        ],
        so.checklist_items
          .slice()
          .sort((a, b) => a.position - b.position)
          .map((item) => ({ cells: [item.label, answerLabel(item.answer), item.observation ?? "—"] })),
      )
    : "";

  const partsTable = so.parts.length
    ? buildDocumentTableHtml(
        [
          { label: "Cód", align: "center", width: "45px" },
          { label: "Descrição" },
          { label: "Un", align: "center", width: "40px" },
          { label: "Qtd", align: "center", width: "45px" },
          { label: "Valor Unit.", align: "right", width: "80px" },
          { label: "Total", align: "right", width: "80px" },
        ],
        so.parts.map((p) => ({
          cells: [
            p.product_id ? String(p.product_id) : "—",
            p.name,
            p.unit || "UN",
            String(p.quantity),
            p.no_charge ? "Sem cobrança" : fmtMoney(p.unit_price),
            p.no_charge ? "—" : fmtMoney(p.total),
          ],
          sub: p.dimensions_label ?? undefined,
        })),
      )
    : "";

  const priorityBadge = so.priority === "urgente"
    ? `<span style="display:inline-block;background:#fee2e2;color:#dc2626;font-weight:700;font-size:9.5px;text-transform:uppercase;letter-spacing:1px;padding:3px 8px;border-radius:5px;margin-left:8px">Urgente</span>`
    : "";

  const header = buildDocumentHeaderHtml(tenant, {
    docTitle: `Ordem de Serviço${priorityBadge}`,
    docNumber: orderNum,
    docDateLabel: "Entrada",
    docDate: orderDate,
    extraTopRight: promisedStr ? [`Previsão: ${promisedStr}`] : [],
  });

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8"/>
<title>Ordem de Serviço #${orderNum}</title>
<style>
  :root { --doc-brand: ${brandColor}; }
  ${DOCUMENT_BASE_CSS}
</style>
</head>
<body>

${header}

<div class="doc-section">
  <div class="doc-section-label">Dados do Cliente</div>
  <div class="doc-info-grid">
    <div class="doc-info-row">Cliente: <b>${so.customer_name}</b></div>
    ${so.customer_phone ? `<div class="doc-info-row">Contato: <b>${so.customer_phone}</b></div>` : ""}
    <div class="doc-info-row">Responsável: <b>${responsavel}</b></div>
  </div>
</div>

<div class="doc-section">
  <div class="doc-section-label">Equipamento / Serviço</div>
  <div class="doc-info-grid">
    <div class="doc-info-row">Categoria: <b>${so.equipment_category}</b></div>
    ${so.equipment_type ? `<div class="doc-info-row">Tipo: <b>${so.equipment_type}</b></div>` : ""}
    ${so.equipment_brand ? `<div class="doc-info-row">Marca: <b>${so.equipment_brand}</b></div>` : ""}
    ${so.equipment_model ? `<div class="doc-info-row">Modelo: <b>${so.equipment_model}</b></div>` : ""}
    ${so.equipment_serial ? `<div class="doc-info-row">Série/IMEI: <b>${so.equipment_serial}</b></div>` : ""}
  </div>
  ${so.equipment_accessories ? `<div class="doc-obs-box"><b>Acessórios:</b> ${so.equipment_accessories}</div>` : ""}
</div>

${so.reported_issue ? `
<div class="doc-section">
  <div class="doc-section-label">Defeito Relatado pelo Cliente</div>
  <div class="doc-obs-box">${so.reported_issue}</div>
</div>` : ""}

${checklistTable ? `
<div class="doc-section">
  <div class="doc-section-label">Checklist de Entrada</div>
  ${checklistTable}
</div>` : ""}

${partsTable ? `
<div class="doc-section">
  <div class="doc-section-label">Peças / Itens</div>
  ${partsTable}
</div>` : ""}

<div class="doc-section">
  <div class="doc-totals">
    <div class="doc-totals-box">
      <div class="doc-totals-row"><span>Mão de obra</span><span>${fmtMoney(so.service_value)}</span></div>
      <div class="doc-totals-row"><span>Peças / Itens</span><span>${fmtMoney(so.parts_total)}</span></div>
      <div class="doc-totals-row grand"><span>TOTAL</span><span>${fmtMoney(so.total_amount)}</span></div>
    </div>
  </div>
</div>

${(so.warranty_days || so.warranty_terms) ? `
<div class="doc-section">
  <div class="doc-section-label">Garantia</div>
  <div class="doc-obs-box">${so.warranty_days ? `${so.warranty_days} dias` : ""}${so.warranty_days && so.warranty_terms ? " — " : ""}${so.warranty_terms ?? ""}</div>
</div>` : ""}

${so.observations ? `
<div class="doc-section">
  <div class="doc-section-label">Observações Internas</div>
  <div class="doc-obs-box">${so.observations}</div>
</div>` : ""}

<div class="doc-section" style="font-size:10px;color:#94a3b8;font-style:italic;">
  O equipamento/serviço acima foi recebido no estado descrito neste documento. A loja não se responsabiliza por condições não registradas neste checklist.
</div>

<div class="doc-signatures">
  <div class="doc-sig-block">Assinatura do Responsável pela Loja</div>
  <div class="doc-sig-block">Assinatura do Cliente</div>
</div>

<div class="doc-footer">
  Documento emitido em ${new Date().toLocaleString("pt-BR")} — Este documento não tem valor fiscal.
</div>

</body>
</html>`;
}

export async function downloadServiceOrderPdf(so: ServiceOrder, tenant: Tenant | null) {
  const html = buildServiceOrderIntakeHtml(so, tenant);
  await downloadHtmlAsPdf(html, `ordem-servico-${String(so.number).padStart(6, "0")}.pdf`);
}
