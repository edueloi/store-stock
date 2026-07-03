import { useState, useEffect, useCallback, useRef } from "react";
import {
  ClipboardList,
  Plus,
  Search,
  Trash2,
  X,
  ChevronDown,
  Package,
  User,
  UserPlus,
  Wrench,
  Camera,
  ImagePlus,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Banknote,
  CreditCard,
  QrCode,
  PlusCircle,
  FileDown,
  Receipt,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../../lib/utils";
import PageHeader from "../../components/layout/PageHeader";
import Combobox from "../../components/ui/Combobox";
import { downloadHtmlAsPdf } from "../../lib/pdf";

// ─── Types ────────────────────────────────────────────────────────────────────

type SOStatus = "aberta" | "em_analise" | "em_conserto" | "pronto_retirada" | "entregue" | "cancelada";

interface ChecklistItem {
  id: number;
  label: string;
  answer: "sim" | "nao" | "na" | null;
  observation: string | null;
  position: number;
}

interface ServiceOrderPart {
  id: number;
  product_id: number | null;
  name: string;
  quantity: number;
  unit_price: number;
  total: number;
}

interface ServiceOrderPhoto {
  id: number;
  url: string;
  caption: string | null;
  kind: "intake" | "damage";
  created_at: string;
}

interface ServiceOrderActionLog {
  id: number;
  action: string;
  from_status: string | null;
  to_status: string | null;
  actor: string | null;
  note: string | null;
  created_at: string;
}

interface ServiceOrder {
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
  seller_id: number | null;
  technician_name: string | null;
  status: SOStatus;
  service_value: number;
  parts_total: number;
  total_amount: number;
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

interface Product {
  id: number;
  name: string;
  price: number;
  stock_quantity: number;
  is_active?: boolean;
}

interface Customer {
  id: number;
  name: string;
  phone?: string;
}

interface Seller {
  id: number;
  name: string;
  is_active?: boolean;
}

interface Tenant {
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
  card_fees?: Record<string, number[]>;
  policies?: { service_order_checklists?: Record<string, { label: string }[]> };
}

// ─── Payment engine (same as Quotes.tsx / PDV) ───────────────────────────────

type PayMethod = "money" | "debit" | "credit" | "pix";
type PayBrand = "visa" | "master" | "elo" | "amex" | "hiper" | "other";

interface InvoicePayment {
  id: string;
  method: PayMethod;
  cardBrand: PayBrand;
  installments: number;
  amount: string;
}

const PM_LABEL: Record<PayMethod, string> = { money: "Dinheiro", debit: "Débito", credit: "Crédito", pix: "PIX" };

const CARD_BRANDS: { key: PayBrand; label: string; color: string }[] = [
  { key: "visa", label: "Visa", color: "#1A1F71" },
  { key: "master", label: "Mastercard", color: "#EB001B" },
  { key: "elo", label: "Elo", color: "#00A4E0" },
  { key: "amex", label: "Amex", color: "#2E77BC" },
  { key: "hiper", label: "Hipercard", color: "#B22222" },
  { key: "other", label: "Outra", color: "#64748b" },
];

function newPayment(): InvoicePayment {
  return { id: Math.random().toString(36).slice(2), method: "money", cardBrand: "visa", installments: 1, amount: "" };
}

function buildPmString(payments: InvoicePayment[]): string {
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

const fmt = (v: number) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const authHeader = () => ({
  Authorization: `Bearer ${localStorage.getItem("token")}`,
  "Content-Type": "application/json",
});

const authHeaderNoJson = () => ({
  Authorization: `Bearer ${localStorage.getItem("token")}`,
});

const STATUS_META: Record<SOStatus, { label: string; color: string; icon: React.ReactNode }> = {
  aberta: { label: "Aberta", color: "text-blue-600 bg-blue-50", icon: <Clock size={12} /> },
  em_analise: { label: "Em Análise", color: "text-amber-600 bg-amber-50", icon: <Search size={12} /> },
  em_conserto: { label: "Em Conserto", color: "text-violet-600 bg-violet-50", icon: <Wrench size={12} /> },
  pronto_retirada: { label: "Pronto p/ Retirada", color: "text-cyan-600 bg-cyan-50", icon: <Package size={12} /> },
  entregue: { label: "Entregue", color: "text-emerald-600 bg-emerald-50", icon: <CheckCircle2 size={12} /> },
  cancelada: { label: "Cancelada", color: "text-red-600 bg-red-50", icon: <XCircle size={12} /> },
};

const STATUS_ORDER: SOStatus[] = ["aberta", "em_analise", "em_conserto", "pronto_retirada", "entregue", "cancelada"];

function emptyForm() {
  return {
    customer_id: null as number | null,
    customer_name: "",
    customer_phone: "",
    equipment_category: "",
    equipment_type: "",
    equipment_brand: "",
    equipment_model: "",
    equipment_serial: "",
    equipment_accessories: "",
    seller_id: null as number | null,
    technician_name: "",
    responsibleMode: "seller" as "seller" | "technician",
    service_value: "",
    observations: "",
  };
}

// ─── PDF template ─────────────────────────────────────────────────────────────

function buildServiceOrderIntakeHtml(so: ServiceOrder, tenant: Tenant | null): string {
  const storeName = tenant?.name ?? "Estabelecimento";
  const storeDoc = tenant?.document ? `CPF/CNPJ: ${tenant.document}` : "";
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
      <td style="padding:8px 10px;border-bottom:1px solid #f0f0f0">${item.label}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #f0f0f0;text-align:center;font-weight:900">${answerLabel(item.answer)}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #f0f0f0;font-size:10px;color:#666">${item.observation ?? ""}</td>
    </tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8"/>
<title>Ordem de Serviço #${orderNum}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 12px; color: #1a1a1a; background: #fff; padding: 40px 48px; max-width: 794px; margin: 0 auto; }
  .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 3px solid #1a1a1a; padding-bottom: 18px; margin-bottom: 24px; }
  .logo { width: 80px; height: 80px; object-fit: contain; }
  .logo-placeholder { width: 80px; height: 80px; background: #f5f5f5; border: 1px solid #ddd; border-radius: 4px; display: flex; align-items: center; justify-content: center; font-size: 9px; color: #aaa; text-align: center; }
  .store-info { text-align: right; }
  .store-name { font-size: 18px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; }
  .store-meta { font-size: 10px; color: #555; margin-top: 3px; line-height: 1.7; }
  .title-block { text-align: center; margin: 20px 0 28px; }
  .title-block h1 { font-size: 20px; font-weight: 900; text-transform: uppercase; letter-spacing: 3px; border: 3px solid #1a1a1a; display: inline-block; padding: 8px 28px; }
  .section { margin-bottom: 22px; }
  .section-label { font-size: 9px; font-weight: 900; text-transform: uppercase; letter-spacing: 2px; color: #555; margin-bottom: 8px; border-left: 3px solid #1a1a1a; padding-left: 8px; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 20px; }
  .info-row { font-size: 11px; }
  .info-row span { font-weight: 700; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  thead tr { background: #1a1a1a; color: #fff; }
  thead th { padding: 8px 10px; text-align: left; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; }
  thead th:nth-child(2) { text-align: center; }
  .obs-box { border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 14px; margin-top: 8px; font-size: 11px; line-height: 1.6; background: #fafafa; }
  .signatures { display: flex; justify-content: space-between; gap: 40px; margin-top: 56px; }
  .sig-block { flex: 1; border-top: 1px solid #1a1a1a; padding-top: 8px; text-align: center; font-size: 10px; color: #555; }
  .footer { text-align: center; font-size: 9px; color: #aaa; margin-top: 36px; border-top: 1px dashed #ddd; padding-top: 14px; line-height: 1.8; }
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

<div class="title-block">
  <h1>Ordem de Serviço Nº ${orderNum}</h1>
</div>

<div class="section">
  <div class="section-label">Dados do Cliente</div>
  <div class="info-grid">
    <div class="info-row">Cliente: <span>${so.customer_name}</span></div>
    ${so.customer_phone ? `<div class="info-row">Contato: <span>${so.customer_phone}</span></div>` : ""}
    <div class="info-row">Data de Entrada: <span>${orderDate}</span></div>
    <div class="info-row">Responsável: <span>${responsavel}</span></div>
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

${so.observations ? `
<div class="section">
  <div class="section-label">Observações Gerais</div>
  <div class="obs-box">${so.observations}</div>
</div>` : ""}

<div class="section" style="font-size:10px;color:#666;font-style:italic;">
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

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ServiceOrders() {
  const [orders, setOrders] = useState<ServiceOrder[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | SOStatus>("all");

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);

  const [selected, setSelected] = useState<ServiceOrder | null>(null);

  const [partSearch, setPartSearch] = useState("");
  const [partQty, setPartQty] = useState(1);
  const [addingPart, setAddingPart] = useState(false);

  const [photoUploading, setPhotoUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [invoicePayments, setInvoicePayments] = useState<InvoicePayment[]>([newPayment()]);
  const [invoiceSellerId, setInvoiceSellerId] = useState<number | "">("");
  const [invoicing, setInvoicing] = useState(false);

  const [generatingPdf, setGeneratingPdf] = useState(false);

  const fetchAll = useCallback(async () => {
    const h = authHeaderNoJson();
    try {
      const [oRes, pRes, cRes, sRes, tRes] = await Promise.all([
        fetch("/api/service-orders", { headers: h }),
        fetch("/api/products", { headers: h }),
        fetch("/api/customers", { headers: h }),
        fetch("/api/sellers", { headers: h }),
        fetch("/api/tenant", { headers: h }),
      ]);
      const [oData, pData, cData, sData, tData] = await Promise.all([
        oRes.json(), pRes.json(), cRes.json(), sRes.json(), tRes.json(),
      ]);
      setOrders(Array.isArray(oData) ? oData : []);
      setProducts(Array.isArray(pData) ? pData.filter((p: Product) => p.is_active !== false) : []);
      setCustomers(Array.isArray(cData) ? cData : []);
      setSellers(Array.isArray(sData) ? sData.filter((s: Seller) => s.is_active !== false) : []);
      setTenant(tData ?? null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const refreshSelected = useCallback(async (id: number) => {
    const res = await fetch(`/api/service-orders/${id}`, { headers: authHeaderNoJson() });
    if (res.ok) setSelected(await res.json());
    fetchAll();
  }, [fetchAll]);

  const checklistTemplates = tenant?.policies?.service_order_checklists ?? {};
  const categoryOptions = Object.keys(checklistTemplates).map((cat) => ({ value: cat, label: cat }));

  // ── Create ──────────────────────────────────────────────────────────────
  const handleCreate = async () => {
    if (!form.customer_name || !form.equipment_category) return;
    setSaving(true);
    try {
      const res = await fetch("/api/service-orders", {
        method: "POST",
        headers: authHeader(),
        body: JSON.stringify({
          customer_id: form.customer_id,
          customer_name: form.customer_name,
          customer_phone: form.customer_phone || undefined,
          equipment_category: form.equipment_category,
          equipment_type: form.equipment_type || undefined,
          equipment_brand: form.equipment_brand || undefined,
          equipment_model: form.equipment_model || undefined,
          equipment_serial: form.equipment_serial || undefined,
          equipment_accessories: form.equipment_accessories || undefined,
          seller_id: form.responsibleMode === "seller" ? form.seller_id : undefined,
          technician_name: form.responsibleMode === "technician" ? form.technician_name : undefined,
          service_value: Number(form.service_value) || 0,
          observations: form.observations || undefined,
        }),
      });
      if (res.ok) {
        const created = await res.json();
        setShowForm(false);
        setForm(emptyForm());
        await fetchAll();
        setSelected(created);
      }
    } finally {
      setSaving(false);
    }
  };

  // ── Checklist ───────────────────────────────────────────────────────────
  const updateChecklistItem = (itemId: number, patch: Partial<ChecklistItem>) => {
    if (!selected) return;
    setSelected({
      ...selected,
      checklist_items: selected.checklist_items.map((i) => (i.id === itemId ? { ...i, ...patch } : i)),
    });
  };

  const saveChecklist = async () => {
    if (!selected) return;
    await fetch(`/api/service-orders/${selected.id}/checklist`, {
      method: "PUT",
      headers: authHeader(),
      body: JSON.stringify({
        items: selected.checklist_items.map((i) => ({ id: i.id, answer: i.answer, observation: i.observation })),
      }),
    });
    await refreshSelected(selected.id);
  };

  // ── Status ──────────────────────────────────────────────────────────────
  const changeStatus = async (status: SOStatus) => {
    if (!selected) return;
    let cancel_reason: string | undefined;
    if (status === "cancelada") {
      cancel_reason = window.prompt("Motivo do cancelamento (opcional):") || undefined;
    }
    await fetch(`/api/service-orders/${selected.id}/status`, {
      method: "PUT",
      headers: authHeader(),
      body: JSON.stringify({ status, cancel_reason }),
    });
    await refreshSelected(selected.id);
  };

  // ── Parts ───────────────────────────────────────────────────────────────
  const handleAddPart = async (product: Product) => {
    if (!selected) return;
    setAddingPart(true);
    try {
      const res = await fetch(`/api/service-orders/${selected.id}/parts`, {
        method: "POST",
        headers: authHeader(),
        body: JSON.stringify({ product_id: product.id, quantity: partQty }),
      });
      if (res.ok) {
        setPartSearch("");
        setPartQty(1);
        await refreshSelected(selected.id);
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error || "Falha ao adicionar peça");
      }
    } finally {
      setAddingPart(false);
    }
  };

  const handleRemovePart = async (partId: number) => {
    if (!selected) return;
    await fetch(`/api/service-orders/${selected.id}/parts/${partId}`, {
      method: "DELETE",
      headers: authHeaderNoJson(),
    });
    await refreshSelected(selected.id);
  };

  // ── Photos ──────────────────────────────────────────────────────────────
  const handlePhotoFile = async (file: File, kind: "intake" | "damage") => {
    if (!selected) return;
    setPhotoUploading(true);
    try {
      const fd = new FormData();
      fd.append("image", file);
      const upRes = await fetch("/api/upload/service-order-photo", {
        method: "POST",
        headers: authHeaderNoJson(),
        body: fd,
      });
      if (!upRes.ok) return;
      const { url } = await upRes.json();
      await fetch(`/api/service-orders/${selected.id}/photos`, {
        method: "POST",
        headers: authHeader(),
        body: JSON.stringify({ url, kind }),
      });
      await refreshSelected(selected.id);
    } finally {
      setPhotoUploading(false);
    }
  };

  const handleRemovePhoto = async (photoId: number) => {
    if (!selected) return;
    await fetch(`/api/service-orders/${selected.id}/photos/${photoId}`, {
      method: "DELETE",
      headers: authHeaderNoJson(),
    });
    await refreshSelected(selected.id);
  };

  // ── PDF ─────────────────────────────────────────────────────────────────
  const handleGeneratePdf = async () => {
    if (!selected) return;
    setGeneratingPdf(true);
    try {
      const html = buildServiceOrderIntakeHtml(selected, tenant);
      await downloadHtmlAsPdf(html, `ordem-servico-${String(selected.number).padStart(6, "0")}.pdf`);
    } finally {
      setGeneratingPdf(false);
    }
  };

  // ── Invoice ("Faturar") ────────────────────────────────────────────────
  const paidTotal = invoicePayments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const remaining = selected ? Math.max(0, Number(selected.total_amount) - paidTotal) : 0;

  const updateInvoicePayment = (id: string, patch: Partial<InvoicePayment>) => {
    setInvoicePayments((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  };
  const addInvoicePayment = () => setInvoicePayments((prev) => [...prev, newPayment()]);
  const removeInvoicePayment = (id: string) => setInvoicePayments((prev) => prev.filter((p) => p.id !== id));

  const handleInvoice = async () => {
    if (!selected) return;
    setInvoicing(true);
    try {
      const pmString = buildPmString(invoicePayments) || "money";
      const res = await fetch(`/api/service-orders/${selected.id}/faturar`, {
        method: "POST",
        headers: authHeader(),
        body: JSON.stringify({ payment_method: pmString, seller_id: invoiceSellerId || undefined }),
      });
      if (res.ok) {
        setShowInvoiceModal(false);
        setInvoicePayments([newPayment()]);
        setInvoiceSellerId("");
        await refreshSelected(selected.id);
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error || "Falha ao faturar");
      }
    } finally {
      setInvoicing(false);
    }
  };

  // ── Filters ─────────────────────────────────────────────────────────────
  const filtered = orders.filter((o) => {
    const matchStatus = statusFilter === "all" || o.status === statusFilter;
    const matchSearch =
      !searchTerm ||
      o.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      String(o.number).includes(searchTerm) ||
      (o.equipment_brand ?? "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (o.equipment_model ?? "").toLowerCase().includes(searchTerm.toLowerCase());
    return matchStatus && matchSearch;
  });

  const filteredParts = products.filter(
    (p) => partSearch && p.name.toLowerCase().includes(partSearch.toLowerCase()) && p.stock_quantity > 0
  );

  const statusCounts = STATUS_ORDER.reduce((acc, s) => {
    acc[s] = orders.filter((o) => o.status === s).length;
    return acc;
  }, {} as Record<SOStatus, number>);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Ordens de Serviço"
        subtitle="Receba equipamentos para conserto, controle o checklist e fature"
        action={
          <button
            onClick={() => setShowForm(true)}
            className="h-9 px-4 bg-blue-600 text-white rounded-lg flex items-center gap-2 text-[12px] font-bold hover:bg-blue-700 transition-all shadow-md shadow-blue-500/20"
          >
            <Plus size={15} /> Nova Ordem de Serviço
          </button>
        }
      />

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
        <input
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Buscar por número, cliente, marca ou modelo..."
          className="w-full pl-9 pr-4 h-10 bg-white rounded-xl text-[12px] font-medium border border-slate-200 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
        />
      </div>

      {/* Status tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        <button
          onClick={() => setStatusFilter("all")}
          className={cn(
            "shrink-0 h-8 px-3 rounded-lg text-[10px] font-black uppercase tracking-wider border transition-all",
            statusFilter === "all" ? "bg-slate-900 border-slate-900 text-white" : "bg-white border-slate-200 text-slate-500 hover:border-slate-300"
          )}
        >
          Todas ({orders.length})
        </button>
        {STATUS_ORDER.map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={cn(
              "shrink-0 h-8 px-3 rounded-lg text-[10px] font-black uppercase tracking-wider border transition-all flex items-center gap-1.5",
              statusFilter === s ? "bg-slate-900 border-slate-900 text-white" : "bg-white border-slate-200 text-slate-500 hover:border-slate-300"
            )}
          >
            {STATUS_META[s].icon} {STATUS_META[s].label} ({statusCounts[s]})
          </button>
        ))}
      </div>

      {/* List */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-slate-400 text-[12px] font-bold">Carregando...</div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-slate-400 text-[12px] font-bold">Nenhuma ordem de serviço encontrada</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-slate-100 text-left text-[9px] font-black uppercase tracking-widest text-slate-400">
                  <th className="px-4 py-3">Número</th>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3">Equipamento</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Responsável</th>
                  <th className="px-4 py-3 text-right">Valor</th>
                  <th className="px-4 py-3">Data</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((o) => (
                  <tr
                    key={o.id}
                    onClick={() => setSelected(o)}
                    className="border-b border-slate-50 last:border-0 hover:bg-slate-50 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 font-mono font-bold text-slate-700">#{String(o.number).padStart(4, "0")}</td>
                    <td className="px-4 py-3 font-semibold text-slate-700">{o.customer_name}</td>
                    <td className="px-4 py-3 text-slate-500">
                      {o.equipment_category}{o.equipment_brand ? ` — ${o.equipment_brand}` : ""}{o.equipment_model ? ` ${o.equipment_model}` : ""}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn("inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider", STATUS_META[o.status].color)}>
                        {STATUS_META[o.status].icon} {STATUS_META[o.status].label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{o.technician_name || (o.seller_id ? sellers.find((s) => s.id === o.seller_id)?.name : "—") || "—"}</td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-slate-700">{fmt(o.total_amount)}</td>
                    <td className="px-4 py-3 text-slate-400">{new Date(o.created_at).toLocaleDateString("pt-BR")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── CREATE MODAL ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showForm && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowForm(false)}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[300]"
            />
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12, scale: 0.98 }}
              transition={{ type: "spring", damping: 32, stiffness: 300 }}
              className="fixed inset-x-4 bottom-4 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 z-[301] bg-white flex flex-col overflow-hidden rounded-3xl"
              style={{ width: "min(640px, calc(100vw - 32px))", height: "min(720px, calc(100vh - 48px))" }}
            >
              <div className="shrink-0 flex items-center justify-between px-6 py-4 border-b border-slate-100">
                <h2 className="text-[15px] font-black text-slate-800">Nova Ordem de Serviço</h2>
                <button onClick={() => setShowForm(false)} className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center">
                  <X size={16} className="text-slate-500" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-5">
                {/* Cliente */}
                <div>
                  <label className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1.5 block">Cliente</label>
                  <div className="flex gap-2">
                    <div className="flex-1 min-w-0">
                      <Combobox
                        placeholder="Buscar por nome ou telefone..."
                        searchPlaceholder="Nome ou telefone..."
                        clearable
                        freeInput
                        value={form.customer_id !== null ? String(form.customer_id) : form.customer_name}
                        onChange={(v) => {
                          if (!v) {
                            setForm((f) => ({ ...f, customer_id: null, customer_name: "" }));
                            return;
                          }
                          const cust = customers.find((c) => String(c.id) === v);
                          if (cust) {
                            setForm((f) => ({ ...f, customer_id: cust.id, customer_name: cust.name, customer_phone: cust.phone ?? f.customer_phone }));
                          } else {
                            setForm((f) => ({ ...f, customer_id: null, customer_name: v }));
                          }
                        }}
                        options={customers.map((c) => ({ value: String(c.id), label: c.name, description: c.phone }))}
                        onAddNew={(q) => setForm((f) => ({ ...f, customer_id: null, customer_name: q }))}
                      />
                    </div>
                  </div>
                  <input
                    value={form.customer_phone}
                    onChange={(e) => setForm((f) => ({ ...f, customer_phone: e.target.value }))}
                    placeholder="Telefone"
                    className="w-full mt-2 h-10 px-3 rounded-xl border border-slate-200 text-[12px] font-medium focus:outline-none focus:border-blue-400"
                  />
                </div>

                {/* Equipamento */}
                <div>
                  <label className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1.5 block">Categoria do Equipamento</label>
                  <Combobox
                    placeholder="Selecionar categoria..."
                    searchPlaceholder="Buscar categoria..."
                    value={form.equipment_category}
                    onChange={(v) => setForm((f) => ({ ...f, equipment_category: v }))}
                    options={categoryOptions}
                    hint={categoryOptions.length === 0 ? "Configure categorias em Configurações → Checklists de OS" : undefined}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input value={form.equipment_type} onChange={(e) => setForm((f) => ({ ...f, equipment_type: e.target.value }))} placeholder="Tipo (ex: Notebook Gamer)" className="h-10 px-3 rounded-xl border border-slate-200 text-[12px] font-medium focus:outline-none focus:border-blue-400" />
                  <input value={form.equipment_brand} onChange={(e) => setForm((f) => ({ ...f, equipment_brand: e.target.value }))} placeholder="Marca" className="h-10 px-3 rounded-xl border border-slate-200 text-[12px] font-medium focus:outline-none focus:border-blue-400" />
                  <input value={form.equipment_model} onChange={(e) => setForm((f) => ({ ...f, equipment_model: e.target.value }))} placeholder="Modelo" className="h-10 px-3 rounded-xl border border-slate-200 text-[12px] font-medium focus:outline-none focus:border-blue-400" />
                  <input value={form.equipment_serial} onChange={(e) => setForm((f) => ({ ...f, equipment_serial: e.target.value }))} placeholder="Série / IMEI" className="h-10 px-3 rounded-xl border border-slate-200 text-[12px] font-medium focus:outline-none focus:border-blue-400" />
                </div>
                <textarea
                  value={form.equipment_accessories}
                  onChange={(e) => setForm((f) => ({ ...f, equipment_accessories: e.target.value }))}
                  placeholder="Acessórios entregues junto (carregador, capa, etc.)"
                  rows={2}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-[12px] font-medium focus:outline-none focus:border-blue-400 resize-none"
                />

                {/* Responsável */}
                <div>
                  <label className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1.5 block">Responsável</label>
                  <div className="flex bg-slate-100 border border-slate-200 rounded-xl p-0.5 gap-0.5 mb-2 w-fit">
                    {(["seller", "technician"] as const).map((m) => (
                      <button key={m} onClick={() => setForm((f) => ({ ...f, responsibleMode: m }))}
                        className={cn("h-8 px-3 rounded-lg text-[10px] font-black transition-all", form.responsibleMode === m ? "bg-blue-600 text-white" : "text-slate-500")}>
                        {m === "seller" ? "Vendedor" : "Técnico externo"}
                      </button>
                    ))}
                  </div>
                  {form.responsibleMode === "seller" ? (
                    <Combobox
                      placeholder="Selecionar vendedor..."
                      searchPlaceholder="Buscar vendedor..."
                      clearable
                      value={form.seller_id !== null ? String(form.seller_id) : ""}
                      onChange={(v) => setForm((f) => ({ ...f, seller_id: v ? Number(v) : null }))}
                      options={sellers.map((s) => ({ value: String(s.id), label: s.name }))}
                    />
                  ) : (
                    <input
                      value={form.technician_name}
                      onChange={(e) => setForm((f) => ({ ...f, technician_name: e.target.value }))}
                      placeholder="Nome do técnico externo"
                      className="w-full h-10 px-3 rounded-xl border border-slate-200 text-[12px] font-medium focus:outline-none focus:border-blue-400"
                    />
                  )}
                </div>

                {/* Valor */}
                <div>
                  <label className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1.5 block">Valor da Mão de Obra (opcional agora)</label>
                  <div className="relative">
                    <Banknote className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                    <input
                      type="number" min="0" step="0.01"
                      value={form.service_value}
                      onChange={(e) => setForm((f) => ({ ...f, service_value: e.target.value }))}
                      placeholder="0,00"
                      className="w-full pl-9 pr-3 h-10 rounded-xl border border-slate-200 text-[13px] font-mono font-bold focus:outline-none focus:border-blue-400 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </div>
                </div>

                <textarea
                  value={form.observations}
                  onChange={(e) => setForm((f) => ({ ...f, observations: e.target.value }))}
                  placeholder="Observações gerais"
                  rows={3}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-[12px] font-medium focus:outline-none focus:border-blue-400 resize-none"
                />

                <p className="text-[10px] text-slate-400 leading-relaxed">
                  O checklist, peças e fotos são adicionados depois de criar a ordem, na tela de detalhes.
                </p>
              </div>

              <div className="shrink-0 px-6 pb-6 pt-3 border-t border-slate-100">
                <button
                  onClick={handleCreate}
                  disabled={saving || !form.customer_name || !form.equipment_category}
                  className="w-full h-11 bg-blue-600 text-white rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                  Criar Ordem de Serviço
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── DETAIL DRAWER ────────────────────────────────────────────────── */}
      <AnimatePresence>
        {selected && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setSelected(null)}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[300]"
            />
            <motion.div
              initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              className="fixed right-0 top-0 h-full w-full max-w-2xl bg-white shadow-2xl z-[301] flex flex-col overflow-hidden"
            >
              {/* header */}
              <div className="shrink-0 flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-blue-500">Ordem de Serviço</p>
                  <h2 className="text-[18px] font-black text-slate-800">#{String(selected.number).padStart(4, "0")} — {selected.customer_name}</h2>
                </div>
                <button onClick={() => setSelected(null)} className="w-9 h-9 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 flex items-center justify-center">
                  <X size={16} className="text-slate-500" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Status */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className={cn("inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider", STATUS_META[selected.status].color)}>
                      {STATUS_META[selected.status].icon} {STATUS_META[selected.status].label}
                    </span>
                    {selected.invoiced_order_id && (
                      <span className="text-[10px] font-bold text-emerald-600">Faturada — Pedido #{selected.invoiced_order_id}</span>
                    )}
                  </div>
                  {!selected.invoiced_order_id && (
                    <div className="flex flex-wrap gap-1.5">
                      {STATUS_ORDER.filter((s) => s !== selected.status).map((s) => (
                        <button key={s} onClick={() => changeStatus(s)}
                          className="h-7 px-2.5 rounded-lg text-[9px] font-bold border border-slate-200 text-slate-500 hover:border-slate-400 hover:text-slate-700 transition-all">
                          → {STATUS_META[s].label}
                        </button>
                      ))}
                    </div>
                  )}
                  {selected.cancel_reason && (
                    <p className="text-[10px] text-red-500 mt-2">Motivo do cancelamento: {selected.cancel_reason}</p>
                  )}
                </div>

                {/* Equipamento */}
                <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4">
                  <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">Equipamento</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[12px]">
                    <p><span className="text-slate-400">Categoria:</span> <span className="font-semibold">{selected.equipment_category}</span></p>
                    {selected.equipment_type && <p><span className="text-slate-400">Tipo:</span> <span className="font-semibold">{selected.equipment_type}</span></p>}
                    {selected.equipment_brand && <p><span className="text-slate-400">Marca:</span> <span className="font-semibold">{selected.equipment_brand}</span></p>}
                    {selected.equipment_model && <p><span className="text-slate-400">Modelo:</span> <span className="font-semibold">{selected.equipment_model}</span></p>}
                    {selected.equipment_serial && <p><span className="text-slate-400">Série/IMEI:</span> <span className="font-semibold">{selected.equipment_serial}</span></p>}
                  </div>
                  {selected.equipment_accessories && (
                    <p className="text-[11px] text-slate-500 mt-2"><span className="text-slate-400">Acessórios:</span> {selected.equipment_accessories}</p>
                  )}
                </div>

                {/* Checklist */}
                {selected.checklist_items.length > 0 && (
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">Checklist de Entrada</p>
                    <div className="space-y-2">
                      {selected.checklist_items.sort((a, b) => a.position - b.position).map((item) => (
                        <div key={item.id} className="bg-white rounded-xl border border-slate-200 p-3">
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <p className="text-[12px] font-semibold text-slate-700 flex-1">{item.label}</p>
                            <div className="flex bg-slate-100 border border-slate-200 rounded-lg p-0.5 gap-0.5 shrink-0">
                              {(["sim", "nao", "na"] as const).map((a) => (
                                <button key={a} onClick={() => updateChecklistItem(item.id, { answer: a })}
                                  className={cn("h-6 px-2 rounded-md text-[9px] font-black transition-all",
                                    item.answer === a
                                      ? a === "sim" ? "bg-emerald-600 text-white" : a === "nao" ? "bg-red-500 text-white" : "bg-slate-500 text-white"
                                      : "text-slate-400")}>
                                  {a === "sim" ? "Sim" : a === "nao" ? "Não" : "N/A"}
                                </button>
                              ))}
                            </div>
                          </div>
                          <input
                            value={item.observation ?? ""}
                            onChange={(e) => updateChecklistItem(item.id, { observation: e.target.value })}
                            placeholder="Observação (opcional)"
                            className="w-full h-8 px-2 rounded-lg border border-slate-200 text-[11px] focus:outline-none focus:border-blue-400"
                          />
                        </div>
                      ))}
                    </div>
                    <button onClick={saveChecklist} className="mt-2 h-8 px-3 rounded-lg bg-blue-50 border border-blue-200 text-blue-600 text-[10px] font-black uppercase tracking-wider hover:bg-blue-100 transition-all">
                      Salvar Checklist
                    </button>
                  </div>
                )}

                {/* Fotos */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Fotos</p>
                    <div className="flex gap-1.5">
                      <button onClick={() => fileInputRef.current?.click()} disabled={photoUploading}
                        className="h-7 px-2.5 rounded-lg bg-slate-100 text-slate-600 text-[9px] font-black uppercase tracking-wider flex items-center gap-1 hover:bg-slate-200 transition-all disabled:opacity-50">
                        <ImagePlus size={11} /> Galeria
                      </button>
                      <button onClick={() => cameraInputRef.current?.click()} disabled={photoUploading}
                        className="h-7 px-2.5 rounded-lg bg-blue-50 text-blue-600 text-[9px] font-black uppercase tracking-wider flex items-center gap-1 hover:bg-blue-100 transition-all disabled:opacity-50">
                        <Camera size={11} /> Câmera
                      </button>
                    </div>
                    <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden"
                      onChange={(e) => { const files = e.target.files; if (files) Array.from(files).forEach((f) => handlePhotoFile(f, "intake")); e.target.value = ""; }} />
                    <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) handlePhotoFile(f, "intake"); e.target.value = ""; }} />
                  </div>
                  {photoUploading && <p className="text-[10px] text-slate-400 mb-2">Enviando foto...</p>}
                  {selected.photos.length === 0 ? (
                    <p className="text-[11px] text-slate-400">Nenhuma foto anexada</p>
                  ) : (
                    <div className="grid grid-cols-3 gap-2">
                      {selected.photos.map((photo) => (
                        <div key={photo.id} className="relative group rounded-xl overflow-hidden border border-slate-200 aspect-square">
                          <img src={photo.url} alt={photo.caption ?? ""} className="w-full h-full object-cover" />
                          <span className={cn("absolute top-1 left-1 px-1.5 py-0.5 rounded text-[8px] font-black uppercase",
                            photo.kind === "damage" ? "bg-red-500 text-white" : "bg-blue-500 text-white")}>
                            {photo.kind === "damage" ? "Avaria" : "Entrada"}
                          </span>
                          <button onClick={() => handleRemovePhoto(photo.id)}
                            className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <X size={10} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Peças */}
                <div>
                  <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">Peças Utilizadas</p>
                  {!selected.invoiced_order_id && (
                    <div className="flex gap-2 mb-2">
                      <div className="flex-1">
                        <Combobox
                          placeholder="Buscar peça no estoque..."
                          searchPlaceholder="Nome do produto..."
                          value=""
                          onChange={(v) => {
                            const product = products.find((p) => String(p.id) === v);
                            if (product) handleAddPart(product);
                          }}
                          options={filteredParts.length > 0 ? filteredParts.map((p) => ({ value: String(p.id), label: p.name, description: `${fmt(p.price)} · estoque ${p.stock_quantity}` }))
                            : products.filter((p) => p.stock_quantity > 0).slice(0, 20).map((p) => ({ value: String(p.id), label: p.name, description: `${fmt(p.price)} · estoque ${p.stock_quantity}` }))}
                        />
                      </div>
                      <input type="number" min="1" value={partQty} onChange={(e) => setPartQty(Math.max(1, Number(e.target.value) || 1))}
                        className="w-16 h-10 px-2 rounded-xl border border-slate-200 text-[12px] font-bold text-center focus:outline-none focus:border-blue-400" />
                    </div>
                  )}
                  {addingPart && <p className="text-[10px] text-slate-400 mb-2">Adicionando peça...</p>}
                  {selected.parts.length === 0 ? (
                    <p className="text-[11px] text-slate-400">Nenhuma peça adicionada</p>
                  ) : (
                    <div className="space-y-1.5">
                      {selected.parts.map((part) => (
                        <div key={part.id} className="flex items-center justify-between bg-slate-50 rounded-xl px-3 py-2 border border-slate-200">
                          <div className="min-w-0">
                            <p className="text-[12px] font-semibold text-slate-700 truncate">{part.name}</p>
                            <p className="text-[10px] text-slate-400">{part.quantity} × {fmt(part.unit_price)}</p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-[12px] font-mono font-bold text-slate-700">{fmt(part.total)}</span>
                            {!selected.invoiced_order_id && (
                              <button onClick={() => handleRemovePart(part.id)} className="text-slate-300 hover:text-red-500 transition-colors">
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Valor / total */}
                <div className="bg-slate-900 rounded-2xl p-4 space-y-1.5">
                  <div className="flex justify-between text-[10px] font-bold uppercase text-slate-400">
                    <span>Mão de obra</span>
                    <span className="font-mono text-slate-200">{fmt(selected.service_value)}</span>
                  </div>
                  <div className="flex justify-between text-[10px] font-bold uppercase text-slate-400">
                    <span>Peças</span>
                    <span className="font-mono text-slate-200">{fmt(selected.parts_total)}</span>
                  </div>
                  <div className="flex justify-between text-[13px] font-black uppercase text-white pt-1.5 border-t border-slate-700">
                    <span>Total</span>
                    <span className="font-mono">{fmt(selected.total_amount)}</span>
                  </div>
                </div>

                {selected.observations && (
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">Observações Gerais</p>
                    <p className="text-[12px] text-slate-600 bg-slate-50 rounded-xl p-3 border border-slate-200">{selected.observations}</p>
                  </div>
                )}

                {/* Timeline */}
                {selected.actions && selected.actions.length > 0 && (
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">Histórico</p>
                    <div className="space-y-2">
                      {selected.actions.map((a) => (
                        <div key={a.id} className="flex items-start gap-2 text-[11px]">
                          <div className="w-1.5 h-1.5 rounded-full bg-slate-300 mt-1.5 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-slate-600">
                              {a.action === "status_changed" && a.to_status ? `Status alterado para ${STATUS_META[a.to_status as SOStatus]?.label ?? a.to_status}` :
                               a.action === "created" ? "Ordem de serviço criada" :
                               a.action === "part_added" ? `Peça adicionada${a.note ? `: ${a.note}` : ""}` :
                               a.action === "part_removed" ? `Peça removida${a.note ? `: ${a.note}` : ""}` :
                               a.action === "invoiced" ? "Ordem de serviço faturada" : a.action}
                            </p>
                            <p className="text-slate-400 text-[10px]">{a.actor ?? "Sistema"} · {new Date(a.created_at).toLocaleString("pt-BR")}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* footer actions */}
              <div className="shrink-0 px-6 pb-6 pt-3 border-t border-slate-100 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={handleGeneratePdf} disabled={generatingPdf}
                    className="h-11 bg-slate-100 hover:bg-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 text-slate-700 transition-all disabled:opacity-60">
                    {generatingPdf ? <Loader2 size={14} className="animate-spin" /> : <FileDown size={14} />} Gerar PDF
                  </button>
                  {!selected.invoiced_order_id && selected.status !== "cancelada" && (
                    <button onClick={() => setShowInvoiceModal(true)}
                      className="h-11 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all">
                      <Receipt size={14} /> Faturar
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── INVOICE MODAL ────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showInvoiceModal && selected && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowInvoiceModal(false)}
              className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-[400]"
            />
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12, scale: 0.98 }}
              transition={{ type: "spring", damping: 32, stiffness: 300 }}
              className="fixed inset-x-4 bottom-4 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 z-[401] bg-white flex flex-col overflow-hidden rounded-3xl"
              style={{ width: "min(480px, calc(100vw - 32px))", maxHeight: "calc(100vh - 48px)" }}
            >
              <div className="shrink-0 flex items-center justify-between px-6 py-4 border-b border-slate-100">
                <h2 className="text-[14px] font-black text-slate-800">Faturar OS #{String(selected.number).padStart(4, "0")}</h2>
                <button onClick={() => setShowInvoiceModal(false)} className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center">
                  <X size={14} className="text-slate-500" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                {/* Vendedor */}
                <div>
                  <label className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1.5 block">Vendedor</label>
                  <div className="relative">
                    <select value={invoiceSellerId} onChange={(e) => setInvoiceSellerId(e.target.value === "" ? "" : Number(e.target.value))}
                      className="w-full pl-3 pr-8 h-10 rounded-xl border border-slate-200 text-[11px] font-bold appearance-none focus:outline-none focus:border-blue-400 bg-white">
                      <option value="">Sem vendedor</option>
                      {sellers.map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}
                    </select>
                    <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>
                </div>

                {/* Pagamentos */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Formas de Pagamento</p>
                    <button onClick={addInvoicePayment} className="flex items-center gap-1 h-6 px-2 bg-blue-50 border border-blue-200 rounded-lg text-[9px] font-black text-blue-600 uppercase tracking-widest hover:bg-blue-100 transition-all">
                      <PlusCircle size={10} /> Adicionar
                    </button>
                  </div>
                  <div className="space-y-2.5">
                    {invoicePayments.map((p, idx) => {
                      const cardFees = tenant?.card_fees ?? {};
                      const feeRate = p.method === "credit" ? (cardFees[p.cardBrand]?.[p.installments - 1] ?? 0) : 0;
                      const pAmt = Number(p.amount) || 0;
                      const pFee = feeRate > 0 && pAmt > 0 ? pAmt * (feeRate / 100) : 0;
                      return (
                        <div key={p.id} className="bg-slate-50 rounded-2xl border border-slate-200 p-3 space-y-2.5">
                          <div className="flex items-center gap-2">
                            {invoicePayments.length > 1 && (
                              <span className="w-5 h-5 bg-slate-200 rounded-full flex items-center justify-center text-[9px] font-black text-slate-600 shrink-0">{idx + 1}</span>
                            )}
                            <div className="grid grid-cols-4 gap-1.5 flex-1">
                              {(["money", "debit", "credit", "pix"] as PayMethod[]).map((key) => (
                                <button key={key} onClick={() => updateInvoicePayment(p.id, { method: key, installments: 1 })}
                                  className={cn("h-9 rounded-xl border text-[9px] font-black uppercase tracking-widest transition-all flex flex-col items-center justify-center gap-0.5",
                                    p.method === key ? key === "credit" ? "bg-emerald-600 border-emerald-500 text-white" : "bg-blue-600 border-blue-500 text-white" : "bg-white border-slate-200 text-slate-500 hover:border-slate-400")}>
                                  {key === "money" && <Banknote size={12} />}
                                  {key === "debit" && <CreditCard size={12} />}
                                  {key === "credit" && <CreditCard size={12} />}
                                  {key === "pix" && <QrCode size={12} />}
                                  {PM_LABEL[key]}
                                </button>
                              ))}
                            </div>
                            {invoicePayments.length > 1 && (
                              <button onClick={() => removeInvoicePayment(p.id)} className="text-slate-300 hover:text-red-500 transition-colors shrink-0">
                                <X size={14} />
                              </button>
                            )}
                          </div>

                          {(p.method === "debit" || p.method === "credit") && (
                            <div className="grid grid-cols-3 gap-1">
                              {CARD_BRANDS.map(({ key, label, color }) => (
                                <button key={key} onClick={() => updateInvoicePayment(p.id, { cardBrand: key })}
                                  className={cn("h-7 rounded-lg border text-[8px] font-black uppercase tracking-widest transition-all", p.cardBrand === key ? "text-white border-transparent" : "bg-white border-slate-200 text-slate-500 hover:border-slate-400")}
                                  style={p.cardBrand === key ? { backgroundColor: color } : {}}>
                                  {label}
                                </button>
                              ))}
                            </div>
                          )}

                          {p.method === "credit" && (
                            <div className="grid grid-cols-4 gap-1">
                              {[1, 2, 3, 4, 5, 6, 10, 12].map((n) => {
                                const rate = cardFees[p.cardBrand]?.[n - 1] ?? 0;
                                const isActive = p.installments === n;
                                return (
                                  <button key={n} onClick={() => updateInvoicePayment(p.id, { installments: n })}
                                    className={cn("rounded-lg border transition-all flex flex-col items-center justify-center py-1.5 px-1 gap-0.5", isActive ? "bg-emerald-600 border-emerald-500 text-white" : "bg-white border-slate-200 text-slate-500 hover:border-slate-400")}>
                                    <span className="text-[8px] font-black uppercase">{n === 1 ? "Vista" : `${n}×`}</span>
                                    {rate > 0 && <span className={cn("text-[7px] font-bold", isActive ? "text-emerald-200" : "text-amber-500")}>+{rate}%</span>}
                                  </button>
                                );
                              })}
                            </div>
                          )}

                          <div className="flex gap-2">
                            <div className="relative flex-1">
                              <Banknote className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
                              <input type="number" min="0" step="0.01"
                                placeholder={idx === 0 && remaining > 0 ? `R$ ${remaining.toFixed(2)}` : "Valor (R$)"}
                                className="w-full pl-9 pr-3 h-10 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 text-[11px] font-medium text-slate-800 placeholder:text-slate-400 transition-all [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                                value={p.amount} onChange={(e) => updateInvoicePayment(p.id, { amount: e.target.value })} />
                            </div>
                            {pFee > 0.005 && (
                              <div className="flex flex-col items-end gap-0.5 bg-amber-50 border border-amber-200 rounded-xl px-3 py-1.5 shrink-0">
                                <span className="text-[8px] font-black text-amber-600 uppercase">Taxa {feeRate}%</span>
                                <span className="text-[10px] font-mono font-black text-amber-700">− R$ {pFee.toFixed(2)}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Resumo */}
                <div className="bg-slate-900 rounded-2xl p-4 space-y-2">
                  <div className="flex justify-between text-[10px] font-bold uppercase text-slate-500">
                    <span>Total OS</span>
                    <span className="font-mono">{fmt(selected.total_amount)}</span>
                  </div>
                  <div className="flex justify-between text-[10px] font-bold uppercase text-slate-400">
                    <span>Pago</span>
                    <span className="font-mono text-emerald-400">{fmt(paidTotal)}</span>
                  </div>
                  {remaining > 0.005 ? (
                    <div className="flex justify-between text-[10px] font-black uppercase text-rose-400 pt-1 border-t border-slate-700">
                      <span>Restante</span>
                      <span className="font-mono">{fmt(remaining)}</span>
                    </div>
                  ) : (
                    <div className="flex justify-between text-[10px] font-black uppercase text-emerald-400 pt-1 border-t border-slate-700">
                      <span>Pagamento OK</span>
                      <span className="font-mono">✓</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="shrink-0 px-6 pb-6 pt-3 flex gap-2 border-t border-slate-100">
                <button onClick={() => setShowInvoiceModal(false)} className="flex-1 h-11 rounded-xl border border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50 transition-colors">
                  Cancelar
                </button>
                <button onClick={handleInvoice} disabled={invoicing || paidTotal <= 0}
                  className="flex-1 h-11 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                  {invoicing ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                  Confirmar Faturamento
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
