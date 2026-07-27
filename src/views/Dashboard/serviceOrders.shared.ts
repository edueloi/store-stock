import { Clock, Search, Wrench, Package, CheckCircle2, XCircle } from "lucide-react";
import { createElement } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export type SOStatus = "rascunho" | "aberta" | "em_analise" | "em_conserto" | "pronto_retirada" | "entregue" | "cancelada";

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
  unit_price: number;
  total: number;
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
  technician_name: string | null;
  status: SOStatus;
  priority: "normal" | "urgente";
  promised_at: string | null;
  service_value: number;
  parts_total: number;
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

export interface Tenant {
  name: string;
  document?: string;
  logo_url?: string;
  whatsapp?: string;
  address_street?: string;
  address_number?: string;
  address_complement?: string;
  address_district?: string;
  address_city?: string;
  address_state?: string;
  address_zip?: string;
  address?: string;
  primary_color?: string;
  card_fees?: Record<string, number[]>;
  policies?: { service_order_checklists?: Record<string, { label: string }[]> };
}

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
  aberta: { label: "Aberta", color: "text-blue-600 bg-blue-50", icon: createElement(Clock, { size: 12 }) },
  em_analise: { label: "Em Análise", color: "text-amber-600 bg-amber-50", icon: createElement(Search, { size: 12 }) },
  em_conserto: { label: "Em Conserto", color: "text-violet-600 bg-violet-50", icon: createElement(Wrench, { size: 12 }) },
  pronto_retirada: { label: "Pronto p/ Retirada", color: "text-cyan-600 bg-cyan-50", icon: createElement(Package, { size: 12 }) },
  entregue: { label: "Entregue", color: "text-emerald-600 bg-emerald-50", icon: createElement(CheckCircle2, { size: 12 }) },
  cancelada: { label: "Cancelada", color: "text-red-600 bg-red-50", icon: createElement(XCircle, { size: 12 }) },
};

export const STATUS_ORDER: SOStatus[] = ["rascunho", "aberta", "em_analise", "em_conserto", "pronto_retirada", "entregue", "cancelada"];

// ─── PDF template ─────────────────────────────────────────────────────────────

export function buildServiceOrderIntakeHtml(so: ServiceOrder, tenant: Tenant | null): string {
  const storeName = tenant?.name ?? "Estabelecimento";
  const docLabel = (doc: string) => {
    const digits = doc.replace(/\D/g, "");
    if (digits.length > 11) return "CNPJ";
    if (digits.length > 0) return "CPF";
    return "Documento";
  };
  const storeDoc = tenant?.document ? `${docLabel(tenant.document)}: ${tenant.document}` : "";
  const brandColor = tenant?.primary_color ?? "#2563eb";
  const storeAddr = (() => {
    if (tenant?.address_street) {
      const parts = [
        `${tenant.address_street}${tenant.address_number ? ", " + tenant.address_number : ""}`,
        tenant.address_complement,
        tenant.address_district,
        tenant.address_city && tenant.address_state ? `${tenant.address_city} - ${tenant.address_state}` : tenant?.address_city ?? tenant?.address_state ?? "",
        tenant?.address_zip,
      ].filter(Boolean);
      return parts.join(", ");
    }
    return tenant?.address ?? "";
  })();
  const storePhone = tenant?.whatsapp ? `WhatsApp: ${tenant.whatsapp}` : "";
  const rawLogo = tenant?.logo_url ?? "";
  const storeLogo = rawLogo && !rawLogo.startsWith("http") ? `${window.location.origin}${rawLogo}` : rawLogo;

  const orderNum = String(so.number).padStart(6, "0");
  const orderDate = new Date(so.created_at).toLocaleDateString("pt-BR");
  const responsavel = so.technician_name || (so.seller_id ? "Vendedor cadastrado" : "—");

  const answerLabel = (a: ChecklistItem["answer"]) => (a === "sim" ? "Sim" : a === "nao" ? "Não" : a === "na" ? "N/A" : "—");

  const checklistRows = so.checklist_items
    .sort((a, b) => a.position - b.position)
    .map(
      (item) => `
    <tr>
      <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;font-size:14px">${item.label}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;text-align:center;font-weight:900;font-size:14px">${answerLabel(item.answer)}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;font-size:13px;color:#555">${item.observation ?? ""}</td>
    </tr>`
    )
    .join("");

  const partsRows = so.parts
    .map(
      (p) => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;font-size:13px">${p.name}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;text-align:center;font-size:13px">${p.quantity}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;text-align:right;font-size:13px">${fmt(p.unit_price)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;text-align:right;font-size:13px;font-weight:700">${fmt(p.total)}</td>
    </tr>`
    )
    .join("");

  const priorityBadge = so.priority === "urgente"
    ? `<span style="display:inline-block;background:#fee2e2;color:#dc2626;font-weight:900;font-size:11px;text-transform:uppercase;letter-spacing:1px;padding:4px 10px;border-radius:6px;margin-left:8px">Urgente</span>`
    : "";

  const promisedStr = so.promised_at ? new Date(so.promised_at + "T12:00:00").toLocaleDateString("pt-BR") : "";

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8"/>
<title>Ordem de Serviço #${orderNum}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 15px; color: #1e293b; background: #fff; padding: 40px 48px; max-width: 794px; margin: 0 auto; }
  .header { display: flex; align-items: center; justify-content: space-between; padding-bottom: 16px; margin-bottom: 4px; }
  .logo { width: 60px; height: 60px; object-fit: contain; }
  .logo-placeholder { width: 60px; height: 60px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 10px; color: #cbd5e1; text-align: center; }
  .store-info { text-align: right; }
  .store-name { font-size: 17px; font-weight: 700; color: #0f172a; }
  .store-meta { font-size: 11px; color: #94a3b8; margin-top: 3px; line-height: 1.6; }
  .accent-rule { border: none; border-top: 2px solid ${brandColor}; margin-bottom: 22px; }
  .title-block { text-align: center; margin: 0 0 26px; }
  .title-block h1 { font-size: 19px; font-weight: 700; color: ${brandColor}; letter-spacing: 0.5px; }
  .section { margin-bottom: 22px; }
  .section-label { font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.2px; color: #94a3b8; margin-bottom: 9px; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 20px; }
  .info-row { font-size: 13.5px; color: #475569; }
  .info-row span { font-weight: 700; color: #0f172a; }
  table { width: 100%; border-collapse: collapse; font-size: 13.5px; }
  thead tr { border-bottom: 1.5px solid #e2e8f0; }
  thead th { padding: 8px 10px; text-align: left; font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #94a3b8; }
  thead th:nth-child(2) { text-align: center; }
  tbody td { border-bottom: 1px solid #f1f5f9; }
  .obs-box { border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 16px; margin-top: 8px; font-size: 14px; line-height: 1.6; background: #fafafa; }
  .signatures { display: flex; justify-content: space-between; gap: 40px; margin-top: 56px; }
  .sig-block { flex: 1; border-top: 1px solid #cbd5e1; padding-top: 10px; text-align: center; font-size: 13px; color: #64748b; }
  .footer { text-align: center; font-size: 11px; color: #cbd5e1; margin-top: 36px; border-top: 1px solid #f1f5f9; padding-top: 14px; line-height: 1.8; }
</style>
</head>
<body>

<div class="header">
  ${storeLogo ? `<img src="${storeLogo}" class="logo" alt="Logo"/>` : `<div class="logo-placeholder">LOGO</div>`}
  <div class="store-info">
    <div class="store-name">${storeName}</div>
    <div class="store-meta">
      ${storeDoc ? storeDoc + "<br/>" : ""}
      ${storeAddr ? storeAddr + "<br/>" : ""}
      ${storePhone ? storePhone : ""}
    </div>
  </div>
</div>
<hr class="accent-rule"/>

<div class="title-block">
  <h1>Ordem de Serviço Nº ${orderNum}${priorityBadge}</h1>
</div>

<div class="section">
  <div class="section-label">Dados do Cliente</div>
  <div class="info-grid">
    <div class="info-row">Cliente: <span>${so.customer_name}</span></div>
    ${so.customer_phone ? `<div class="info-row">Contato: <span>${so.customer_phone}</span></div>` : ""}
    <div class="info-row">Data de Entrada: <span>${orderDate}</span></div>
    <div class="info-row">Responsável: <span>${responsavel}</span></div>
    ${promisedStr ? `<div class="info-row">Previsão de Entrega: <span>${promisedStr}</span></div>` : ""}
  </div>
</div>

<div class="section">
  <div class="section-label">Equipamento</div>
  <div class="info-grid">
    <div class="info-row">Categoria: <span>${so.equipment_category}</span></div>
    ${so.equipment_type ? `<div class="info-row">Tipo: <span>${so.equipment_type}</span></div>` : ""}
    ${so.equipment_brand ? `<div class="info-row">Marca: <span>${so.equipment_brand}</span></div>` : ""}
    ${so.equipment_model ? `<div class="info-row">Modelo: <span>${so.equipment_model}</span></div>` : ""}
    ${so.equipment_serial ? `<div class="info-row">Série/IMEI: <span>${so.equipment_serial}</span></div>` : ""}
  </div>
  ${so.equipment_accessories ? `<div class="obs-box"><strong>Acessórios:</strong> ${so.equipment_accessories}</div>` : ""}
</div>

${so.reported_issue ? `
<div class="section">
  <div class="section-label">Defeito Relatado pelo Cliente</div>
  <div class="obs-box">${so.reported_issue}</div>
</div>` : ""}

${checklistRows ? `
<div class="section">
  <div class="section-label">Checklist de Entrada</div>
  <table>
    <thead>
      <tr>
        <th>Item</th>
        <th style="text-align:center">Situação</th>
        <th>Observação</th>
      </tr>
    </thead>
    <tbody>
      ${checklistRows}
    </tbody>
  </table>
</div>` : ""}

${partsRows ? `
<div class="section">
  <div class="section-label">Peças Utilizadas</div>
  <table>
    <thead>
      <tr>
        <th>Peça</th>
        <th style="text-align:center">Qtd.</th>
        <th style="text-align:right">Valor Unit.</th>
        <th style="text-align:right">Total</th>
      </tr>
    </thead>
    <tbody>
      ${partsRows}
    </tbody>
  </table>
</div>` : ""}

<div class="section">
  <div class="section-label">Valores</div>
  <div class="info-grid">
    <div class="info-row">Mão de obra: <span>${fmt(so.service_value)}</span></div>
    <div class="info-row">Peças: <span>${fmt(so.parts_total)}</span></div>
  </div>
  <div class="obs-box" style="display:flex;justify-content:space-between;align-items:center;font-weight:700;font-size:16px;background:${brandColor};color:#fff;border:none;">
    <span>TOTAL</span><span>${fmt(so.total_amount)}</span>
  </div>
</div>

${(so.warranty_days || so.warranty_terms) ? `
<div class="section">
  <div class="section-label">Garantia</div>
  <div class="obs-box">${so.warranty_days ? `${so.warranty_days} dias` : ""}${so.warranty_days && so.warranty_terms ? " — " : ""}${so.warranty_terms ?? ""}</div>
</div>` : ""}

${so.observations ? `
<div class="section">
  <div class="section-label">Observações Internas do Técnico</div>
  <div class="obs-box">${so.observations}</div>
</div>` : ""}

<div class="section" style="font-size:12px;color:#555;font-style:italic;">
  O equipamento acima foi recebido no estado descrito neste documento. A loja não se responsabiliza por condições não registradas neste checklist.
</div>

<div class="signatures">
  <div class="sig-block">
    <br/><br/>
    ${storeName}<br/>Assinatura do Responsável pela Loja
  </div>
  <div class="sig-block">
    <br/><br/>
    ${so.customer_name}<br/>Assinatura do Cliente
  </div>
</div>

<div class="footer">
  Documento emitido em ${new Date().toLocaleString("pt-BR")} &nbsp;|&nbsp; ${storeName}
  ${storeDoc ? "&nbsp;|&nbsp; " + storeDoc : ""}
</div>

</body>
</html>`;
}
