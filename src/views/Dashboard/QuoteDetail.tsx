import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ChevronLeft,
  FileText,
  Search,
  Download,
  CheckCircle2,
  Clock,
  XCircle,
  ArrowRight,
  X,
  ChevronDown,
  Package,
  User,
  UserPlus,
  Percent,
  DollarSign,
  CreditCard,
  Banknote,
  QrCode,
  PlusCircle,
  Loader2,
  Wrench,
  Wallet,
  AlertTriangle,
  Trash2,
  Link2,
  Palette,
  PenTool,
  Mail,
  Send,
  History,
} from "lucide-react";
import {
  Button, IconButton, Badge, Input, Textarea, Select, Modal, ModalFooter, Tabs,
  ContentCard, PanelCard, DetailField, EmptyState,
} from "../../components/ui";
import SalePaymentForm, { SalePaymentFormState, newSalePaymentFormState, parseSalePaymentSettings, computeSalePayment, buildSalePayload } from "../../components/SalePaymentForm";
import Combobox from "../../components/ui/Combobox";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import { useToast } from "../../components/ui/Toast";
import { cn } from "../../lib/utils";
import { computeMeasuredPrice } from "../../utils/measurePricing";
import { generateQuotePDF } from "../../lib/quotePdf";
import { getStoredUser } from "../../lib/session";

// ─── Types ────────────────────────────────────────────────────────────────────

interface QuoteItem {
  id?: number;
  product_id?: number;
  name: string;
  quantity: number;
  unit_price: number;
  total: number;
  dimensions_label?: string | null;
}

interface QuoteServiceRow {
  id: number;
  service_id: number;
  name: string;
  unit_price: number;
  quantity: number;
  total: number;
}

interface QuoteActionLog {
  id: number;
  action: string;
  from_status: string | null;
  to_status: string | null;
  actor: string | null;
  note: string | null;
  meta?: { changes?: { field: string; label: string; before: string; after: string }[] } | null;
  created_at: string;
}

interface QuoteFileRow {
  id: number;
  url: string;
  caption: string | null;
  kind: "referencia" | "arte" | "prova";
  created_at: string;
}

interface Quote {
  id: number;
  number: number;
  customer_id?: number | null;
  customer_name: string;
  customer_phone?: string;
  customer_email?: string;
  subtotal: number;
  discount_type: "percent" | "fixed";
  discount_value: number;
  total_amount: number;
  validity_days: number;
  notes?: string;
  status: "rascunho" | "orcamento_enviado" | "aguardando_aprovacao" | "aprovado" | "aguardando_arte" | "arte_finalizada" | "converted" | "cancelled" | "expired";
  converted_order_id?: number | null;
  deposit_amount?: number | null;
  deposit_payment_method?: string | null;
  deposit_paid_at?: string | null;
  created_at: string;
  items: QuoteItem[];
  services: QuoteServiceRow[];
  actions?: QuoteActionLog[];
  files?: QuoteFileRow[];
}

interface EmailDeliveryStatus { sent: boolean; recipient: string | null; sent_at: string | null; attempts: number; }

interface Product {
  id: number;
  name: string;
  price: number;
  discount_price?: number;
  stock_quantity: number;
  sku?: string | null;
  barcode?: string | null;
  image_url?: string;
  is_active?: boolean;
  sale_unit?: "unidade" | "m2" | "linear";
  price_per_measure?: number;
  min_billable_quantity?: number;
}

interface ServiceCatalog {
  id: number;
  name: string;
  description?: string;
  price: number;
  is_active: boolean;
  sale_unit?: "unidade" | "m2" | "linear";
  price_per_measure?: number | null;
  min_billable_quantity?: number | null;
}

interface Customer {
  id: number;
  name: string;
  phone?: string;
  email?: string;
  document?: string;
  address?: string;
  address_street?: string;
  address_number?: string;
  address_complement?: string;
  address_district?: string;
  address_city?: string;
  address_state?: string;
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
  primary_color?: string;
  razao_social?: string;
  inscricao_estadual?: string;
  inscricao_municipal?: string;
  card_fees?: Record<string, number[]>;
  grafica_enabled?: boolean;
}

// ─── Payment types (same engine as PDV) ──────────────────────────────────────

type ConvertMethod = "money" | "debit" | "credit" | "pix";
type ConvertBrand  = "visa" | "master" | "elo" | "amex" | "hiper" | "other";

const CONVERT_PM_LABEL: Record<ConvertMethod, string> = {
  money: "Dinheiro", debit: "Débito", credit: "Crédito", pix: "PIX",
};

const CONVERT_CARD_BRANDS: { key: ConvertBrand; label: string; color: string }[] = [
  { key: "visa",   label: "Visa",       color: "#1A1F71" },
  { key: "master", label: "Mastercard", color: "#EB001B" },
  { key: "elo",    label: "Elo",        color: "#00A4E0" },
  { key: "amex",   label: "Amex",       color: "#2E77BC" },
  { key: "hiper",  label: "Hipercard",  color: "#B22222" },
  { key: "other",  label: "Outra",      color: "#64748b" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function applyMoneyMask(raw: string) {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  const num = parseInt(digits, 10) / 100;
  return num.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function parseMaskedPrice(masked: string) {
  return parseFloat(masked.replace(/\./g, "").replace(",", ".")) || 0;
}
function centsToMasked(value: number) {
  return value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const authHeader = () => ({
  Authorization: `Bearer ${localStorage.getItem("token")}`,
  "Content-Type": "application/json",
});
const authHeaderNoJson = () => ({ Authorization: `Bearer ${localStorage.getItem("token")}` });

function maskPhone(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 10) return d.replace(/(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3").replace(/-$/, "");
  return d.replace(/(\d{2})(\d{5})(\d{0,4})/, "($1) $2-$3").replace(/-$/, "");
}
function maskDoc(v: string) {
  const d = v.replace(/\D/g, "");
  if (d.length <= 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{0,2})/, "$1.$2.$3-$4").replace(/-$/, "").replace(/\.{1,}$/, "");
  return d.slice(0, 14).replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{0,2})/, "$1.$2.$3/$4-$5").replace(/-$/, "").replace(/\/$/, "");
}

type BadgeColor = "default" | "primary" | "success" | "warning" | "danger" | "info" | "purple" | "orange" | "teal";

function statusLabel(s: string): { label: string; color: BadgeColor; icon: React.ReactNode } {
  const map: Record<string, { label: string; color: BadgeColor; icon: React.ReactNode }> = {
    rascunho:  { label: "Rascunho",   color: "default", icon: <Clock size={12} /> },
    orcamento_enviado: { label: "Aberto", color: "info",    icon: <Clock size={12} /> },
    aguardando_aprovacao: { label: "Aguardando Aprovação", color: "warning", icon: <Clock size={12} /> },
    aprovado: { label: "Aprovado", color: "teal", icon: <CheckCircle2 size={12} /> },
    aguardando_arte: { label: "Aguardando Arte", color: "purple", icon: <Palette size={12} /> },
    arte_finalizada: { label: "Arte Finalizada", color: "purple", icon: <PenTool size={12} /> },
    converted: { label: "Convertido", color: "success", icon: <CheckCircle2 size={12} /> },
    cancelled: { label: "Cancelado",  color: "danger",      icon: <XCircle size={12} /> },
    expired:   { label: "Expirado",   color: "orange",icon: <Clock size={12} /> },
  };
  return map[s] ?? map.orcamento_enviado;
}

const QUOTE_TABS = [
  { id: "dados", label: "Dados", icon: User },
  { id: "itens", label: "Itens", icon: Package },
  { id: "arquivos", label: "Arquivos", icon: Palette },
  { id: "historico", label: "Histórico", icon: History },
] as const;
type QuoteTabId = typeof QUOTE_TABS[number]["id"];

function quoteActionLabel(action: QuoteActionLog) {
  if (action.action === "status_changed" && action.to_status) return `Status alterado para ${statusLabel(action.to_status).label}`;
  if (action.action === "status_synced" && action.to_status) return `Status sincronizado com a OS vinculada: ${statusLabel(action.to_status).label}`;
  if (action.action === "sent_by_email") return "Orçamento enviado por e-mail";
  if (action.action === "created") return "Orçamento criado";
  if (action.action === "edited") return "Alterações salvas";
  if (action.action === "converted") return "Convertido em venda";
  if (action.action === "deposit_recorded") return `Entrada registrada${action.note ? `: ${action.note}` : ""}`;
  if (action.action === "expired") return "Orçamento expirado";
  return action.action;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function QuoteDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const quoteId = Number(id);

  const [quote, setQuote] = useState<Quote | null>(null);
  const referenciaInputRef = useRef<HTMLInputElement>(null);
  const arteInputRef = useRef<HTMLInputElement>(null);
  const provaInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [products, setProducts] = useState<Product[]>([]);
  const [services, setServices] = useState<ServiceCatalog[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [tenant, setTenant] = useState<Tenant | null>(null);

  const [savingField, setSavingField] = useState<string | null>(null);
  const [savedPulse, setSavedPulse] = useState(false);

  // Form state (mirrors quote, editable inline)
  const [productSearch, setProductSearch] = useState("");
  const [measureProduct, setMeasureProduct] = useState<Product | null>(null);
  const [measureHeight, setMeasureHeight] = useState("");
  const [measureWidth, setMeasureWidth] = useState("");
  const [measureService, setMeasureService] = useState<ServiceCatalog | null>(null);
  const [measureServiceHeight, setMeasureServiceHeight] = useState("");
  const [measureServiceWidth, setMeasureServiceWidth] = useState("");
  const [serviceSearch, setServiceSearch] = useState("");
  const [formItems, setFormItems] = useState<QuoteItem[]>([]);
  const [formServices, setFormServices] = useState<{ service_id: number; name: string; price: number; quantity: number; dimensions_label?: string }[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [manualCustomer, setManualCustomer] = useState({ name: "", phone: "", email: "" });
  const [discountType, setDiscountType] = useState<"percent" | "fixed">("percent");
  const [discountValue, setDiscountValue] = useState(0);
  const [validityDays, setValidityDays] = useState(7);
  const [notes, setNotes] = useState("");
  const [starting, setStarting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [ncName, setNcName] = useState("");
  const [ncPhone, setNcPhone] = useState("");
  const [ncDoc, setNcDoc] = useState("");
  const [ncEmail, setNcEmail] = useState("");
  const [savingNC, setSavingNC] = useState(false);

  const [showDepositModal, setShowDepositModal] = useState(false);
  const [depositAmount, setDepositAmount] = useState("");
  const [depositMethod, setDepositMethod] = useState<ConvertMethod>("money");
  const [depositBrand, setDepositBrand] = useState<ConvertBrand>("visa");
  const [depositInstallments, setDepositInstallments] = useState(1);
  const [savingDeposit, setSavingDeposit] = useState(false);

  const [showConvertModal, setShowConvertModal] = useState(false);
  const [convertForm, setConvertForm] = useState<SalePaymentFormState>(() => newSalePaymentFormState());
  const [sellers, setSellers] = useState<{ id: number; name: string }[]>([]);
  const [converting, setConverting] = useState(false);
  const [emailDelivery, setEmailDelivery] = useState<EmailDeliveryStatus | null>(null);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [activeTab, setActiveTab] = useState<QuoteTabId>("dados");

  const [generatingLink, setGeneratingLink] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  const handleCopyApprovalLink = async () => {
    if (!quote) return;
    setGeneratingLink(true);
    setLinkCopied(false);
    try {
      const res = await fetch(`/api/quotes/${quote.id}/approval-link`, { method: "POST", headers: authHeader() });
      const data = await res.json();
      if (!res.ok) return;
      const url = `${window.location.origin}/orcamento/${data.token}`;
      await navigator.clipboard.writeText(url);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 3000);
    } finally {
      setGeneratingLink(false);
    }
  };

  // ── Load ────────────────────────────────────────────────────────────────
  const applyFormFields = useCallback((q: Quote) => {
    setFormItems(q.items.map((i) => ({ ...i, unit_price: Number(i.unit_price), total: Number(i.total) })));
    setFormServices(q.services.map((s) => ({ service_id: s.service_id, name: s.name, price: Number(s.unit_price), quantity: s.quantity })));
    if (q.customer_id) {
      setSelectedCustomer({ id: q.customer_id, name: q.customer_name, phone: q.customer_phone, email: q.customer_email });
    } else {
      setSelectedCustomer(null);
      setManualCustomer({ name: q.customer_name, phone: q.customer_phone ?? "", email: q.customer_email ?? "" });
    }
    setDiscountType(q.discount_type);
    setDiscountValue(Number(q.discount_value));
    setValidityDays(q.validity_days);
    setNotes(q.notes ?? "");
  }, []);

  // Ao carregar (ou recarregar customers), troca o cliente reidratado (só nome/telefone/email,
  // vindos do próprio orçamento) pelo registro completo do cadastro — com documento e endereço,
  // usados no PDF.
  useEffect(() => {
    if (!quote?.customer_id || !customers.length) return;
    const full = customers.find((c) => c.id === quote.customer_id);
    if (full) setSelectedCustomer(full);
  }, [quote?.customer_id, customers]);

  const fetchQuote = useCallback(async (silent?: boolean) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch(`/api/quotes/${quoteId}`, { headers: authHeaderNoJson() });
      if (!res.ok) {
        setNotFound(true);
        return;
      }
      const q: Quote = await res.json();
      setQuote(q);
      if (!silent) applyFormFields(q);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [quoteId, applyFormFields]);

  // ── Arquivos (referência do cliente, arte final, prova de aprovação) ────────
  const [fileUploading, setFileUploading] = useState(false);
  const handleQuoteFile = async (file: File, kind: "referencia" | "arte" | "prova") => {
    if (!quote) return;
    setFileUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const upRes = await fetch("/api/upload/quote-file", { method: "POST", headers: authHeaderNoJson(), body: fd });
      if (!upRes.ok) return;
      const { url } = await upRes.json();
      await fetch(`/api/quotes/${quote.id}/files`, {
        method: "POST",
        headers: authHeader(),
        body: JSON.stringify({ url, kind }),
      });
      await fetchQuote(true);
    } finally {
      setFileUploading(false);
    }
  };

  const handleRemoveQuoteFile = async (fileId: number) => {
    if (!quote) return;
    await fetch(`/api/quotes/${quote.id}/files/${fileId}`, { method: "DELETE", headers: authHeaderNoJson() });
    await fetchQuote(true);
  };

  useEffect(() => {
    (async () => {
      const h = authHeaderNoJson();
      const [pRes, cRes, tRes, sRes, svRes] = await Promise.all([
        fetch("/api/products", { headers: h }),
        fetch("/api/customers", { headers: h }),
        fetch("/api/tenant", { headers: h }),
        fetch("/api/sellers", { headers: h }),
        fetch("/api/services", { headers: h }),
      ]);
      const [pData, cData, tData, sData, svData] = await Promise.all([pRes.json(), cRes.json(), tRes.json(), sRes.json(), svRes.json()]);
      setProducts(Array.isArray(pData) ? pData : []);
      setCustomers(Array.isArray(cData) ? cData : []);
      setTenant(tData ?? null);
      setSellers(Array.isArray(sData) ? sData.filter((s: any) => s.is_active !== false) : []);
      setServices(Array.isArray(svData) ? svData.filter((s: any) => s.is_active !== false) : []);
    })();
    fetchQuote();
  }, [fetchQuote]);

  const isDraft = quote?.status === "rascunho";
  const isEditable = quote?.status === "rascunho" || quote?.status === "orcamento_enviado";

  // ── Computed totals (live, from form state) ──────────────────────────────
  const itemsSubtotal    = formItems.reduce((s, i) => s + i.total, 0);
  const servicesSubtotal = formServices.reduce((s, sv) => s + sv.price * sv.quantity, 0);
  const subtotal         = itemsSubtotal + servicesSubtotal;
  const discountAmt =
    discountType === "percent"
      ? (subtotal * discountValue) / 100
      : Math.min(discountValue, subtotal);
  const total = Math.max(0, subtotal - discountAmt);

  // ── Autosave ──────────────────────────────────────────────────────────────
  const autosaveField = useCallback(async (patch: Record<string, unknown>, fieldKey: string) => {
    if (!quote) return;
    setSavingField(fieldKey);
    try {
      const res = await fetch(`/api/quotes/${quote.id}`, {
        method: "PUT",
        headers: authHeader(),
        body: JSON.stringify(patch),
      });
      if (res.ok) {
        await fetchQuote(true);
        setSavedPulse(true);
        setTimeout(() => setSavedPulse(false), 1500);
      }
    } finally {
      setSavingField(null);
    }
  }, [quote, fetchQuote]);

  // Autosave da lista de itens/serviços — dispara sempre que o usuário adiciona,
  // remove ou altera qtd/preço, mandando o array completo (mesmo contrato do PUT).
  const autosaveItems = useCallback((items: QuoteItem[], svcs: typeof formServices) => {
    autosaveField({
      items: items.map((i) => ({
        product_id: i.product_id, name: i.name, quantity: i.quantity, unit_price: i.unit_price, dimensions_label: i.dimensions_label ?? null,
      })),
      services: svcs.map((s) => ({ id: s.service_id, name: s.name, price: s.price, quantity: s.quantity, dimensions_label: s.dimensions_label ?? null })),
    }, "items");
  }, [autosaveField]);

  // ── Add product to cart ──────────────────────────────────────────────────
  const addProduct = (p: Product) => {
    if (p.sale_unit && p.sale_unit !== "unidade") {
      setMeasureProduct(p);
      setMeasureHeight("");
      setMeasureWidth("");
      setProductSearch("");
      return;
    }
    setFormItems((prev) => {
      const existing = prev.find((i) => i.product_id === p.id);
      const next = existing
        ? prev.map((i) => i.product_id === p.id ? { ...i, quantity: i.quantity + 1, total: (i.quantity + 1) * i.unit_price } : i)
        : [...prev, { product_id: p.id, name: p.name, quantity: 1, unit_price: Number(p.discount_price ?? p.price), total: Number(p.discount_price ?? p.price) }];
      autosaveItems(next, formServices);
      return next;
    });
    setProductSearch("");
  };

  const measurePreview = measureProduct
    ? computeMeasuredPrice(
        (measureProduct.sale_unit as "m2" | "linear") ?? "m2",
        Number(measureProduct.price_per_measure) || 0,
        measureProduct.min_billable_quantity,
        Number(measureHeight) || 0,
        Number(measureWidth) || 0,
      )
    : null;

  const addMeasuredProduct = () => {
    if (!measureProduct || !measurePreview) return;
    const next = [...formItems, {
      product_id: measureProduct.id,
      name: measureProduct.name,
      quantity: 1,
      unit_price: measurePreview.total,
      total: measurePreview.total,
      dimensions_label: measurePreview.label,
    }];
    setFormItems(next);
    autosaveItems(next, formServices);
    setMeasureProduct(null);
    setMeasureHeight("");
    setMeasureWidth("");
  };

  const updateItemQty = (idx: number, qty: number) => {
    const next = qty <= 0
      ? formItems.filter((_, i) => i !== idx)
      : formItems.map((item, i) => i === idx ? { ...item, quantity: qty, total: qty * item.unit_price } : item);
    setFormItems(next);
    autosaveItems(next, formServices);
  };

  const updateItemPrice = (idx: number, price: number) => {
    const next = formItems.map((item, i) => i === idx ? { ...item, unit_price: price, total: item.quantity * price } : item);
    setFormItems(next);
    autosaveItems(next, formServices);
  };

  const removeItem = (idx: number) => {
    const next = formItems.filter((_, i) => i !== idx);
    setFormItems(next);
    autosaveItems(next, formServices);
  };

  // ── Service helpers ───────────────────────────────────────────────────────
  const addService = (s: ServiceCatalog) => {
    if (s.sale_unit && s.sale_unit !== "unidade") {
      setMeasureService(s);
      setMeasureServiceHeight("");
      setMeasureServiceWidth("");
      setServiceSearch("");
      return;
    }
    setFormServices((prev) => {
      const existing = prev.find((fs) => fs.service_id === s.id);
      const next = existing
        ? prev.map((fs) => fs.service_id === s.id ? { ...fs, quantity: fs.quantity + 1 } : fs)
        : [...prev, { service_id: s.id, name: s.name, price: Number(s.price), quantity: 1 }];
      autosaveItems(formItems, next);
      return next;
    });
    setServiceSearch("");
  };

  // Mesmo mecanismo de venda por medida do Produto, aplicado a Serviço.
  const measureServicePreview = measureService
    ? computeMeasuredPrice(
        (measureService.sale_unit as "m2" | "linear") ?? "m2",
        Number(measureService.price_per_measure) || 0,
        measureService.min_billable_quantity ?? null,
        Number(measureServiceHeight) || 0,
        Number(measureServiceWidth) || 0,
      )
    : null;

  const addMeasuredService = () => {
    if (!measureService || !measureServicePreview) return;
    const next = [...formServices, {
      service_id: measureService.id,
      name: measureService.name,
      price: measureServicePreview.total,
      quantity: 1,
      dimensions_label: measureServicePreview.label,
    }];
    setFormServices(next);
    autosaveItems(formItems, next);
    setMeasureService(null);
    setMeasureServiceHeight("");
    setMeasureServiceWidth("");
  };

  const updateServiceQty = (service_id: number, qty: number) => {
    const next = qty <= 0
      ? formServices.filter((s) => s.service_id !== service_id)
      : formServices.map((s) => s.service_id === service_id ? { ...s, quantity: qty } : s);
    setFormServices(next);
    autosaveItems(formItems, next);
  };

  const updateServicePrice = (service_id: number, price: number) => {
    const next = formServices.map((s) => s.service_id === service_id ? { ...s, price } : s);
    setFormServices(next);
    autosaveItems(formItems, next);
  };

  const removeService = (service_id: number) => {
    const next = formServices.filter((s) => s.service_id !== service_id);
    setFormServices(next);
    autosaveItems(formItems, next);
  };

  // ── Customer ──────────────────────────────────────────────────────────────
  const handleCustomerChange = (cust: Customer | null, manualName?: string) => {
    if (cust) {
      setSelectedCustomer(cust);
      autosaveField({ customer_id: cust.id, customer_name: cust.name, customer_phone: cust.phone, customer_email: cust.email }, "customer");
    } else {
      setSelectedCustomer(null);
      const name = manualName ?? "";
      setManualCustomer((m) => ({ ...m, name }));
      autosaveField({ customer_id: null, customer_name: name }, "customer");
    }
  };

  const handleStart = async () => {
    if (!quote) return;
    setStarting(true);
    try {
      await fetch(`/api/quotes/${quote.id}/status`, { method: "PUT", headers: authHeader(), body: JSON.stringify({ status: "orcamento_enviado" }) });
      await fetchQuote(true);
    } finally {
      setStarting(false);
    }
  };

  const handleDiscard = async () => {
    if (!quote) return;
    setDeleting(true);
    try {
      await fetch(`/api/quotes/${quote.id}`, { method: "DELETE", headers: authHeader() });
      navigate("/admin/orcamentos", { replace: true });
    } finally {
      setDeleting(false);
      setShowDiscardConfirm(false);
    }
  };

  const handleRecordDeposit = async () => {
    if (!quote) return;
    setSavingDeposit(true);
    try {
      const brand = (depositMethod === "credit" || depositMethod === "debit") ? `-${depositBrand}` : "";
      const inst = depositMethod === "credit" && depositInstallments > 1 ? `-${depositInstallments}x` : "";
      const pmString = `${depositMethod}${brand}${inst}`;
      const res = await fetch(`/api/quotes/${quote.id}/deposit`, {
        method: "POST",
        headers: authHeader(),
        body: JSON.stringify({ amount: parseMaskedPrice(depositAmount), payment_method: pmString }),
      });
      if (res.ok) {
        setShowDepositModal(false);
        setDepositAmount("");
        setDepositMethod("money");
        setDepositInstallments(1);
        await fetchQuote(true);
        toast.success("Entrada registrada com sucesso.");
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || "Falha ao registrar entrada");
      }
    } finally {
      setSavingDeposit(false);
    }
  };

  const handleConvert = async () => {
    if (!quote) return;
    setConverting(true);
    try {
      const res = await fetch(`/api/quotes/${quote.id}/convert`, {
        method: "POST",
        headers: authHeader(),
        body: JSON.stringify(buildSalePayload(amountDue, convertForm, convertSettings)),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(data?.error || "Não foi possível converter o orçamento em venda."); return; }
      setShowConvertModal(false);
      setConvertForm(newSalePaymentFormState());
      await fetchQuote(true);
      toast.success("Orçamento convertido em venda.");
    } finally {
      setConverting(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!quote || !tenant) return;
    const c = selectedCustomer;
    const address = c
      ? (c.address_street
          ? [`${c.address_street}${c.address_number ? ", " + c.address_number : ""}`, c.address_complement, c.address_district,
              c.address_city && c.address_state ? `${c.address_city} - ${c.address_state}` : (c.address_city ?? c.address_state ?? "")]
              .filter(Boolean).join(" - ")
          : (c.address ?? ""))
      : "";
    await generateQuotePDF(quote, tenant, {
      customer: c ? { name: c.name, phone: c.phone, email: c.email, document: c.document, address } : null,
      sellerName: getStoredUser()?.name,
    });
  };

  // Orçamentos devem poder usar qualquer item cadastrado no estoque, inclusive
  // produtos ocultos na vitrine/loja pública. O PDV já segue essa mesma regra.
  const filteredProducts = products.filter((p) => {
    const query = productSearch.trim().toLowerCase();
    if (!query) return true;
    return p.name.toLowerCase().includes(query)
      || (p.sku ?? "").toLowerCase().includes(query)
      || (p.barcode ?? "").toLowerCase().includes(query);
  });

  useEffect(() => {
    if (!quote?.id) return;
    fetch(`/api/quotes/${quote.id}/email-status`, { headers: authHeaderNoJson() })
      .then((res) => res.ok ? res.json() : null)
      .then((data) => setEmailDelivery(data))
      .catch(() => setEmailDelivery(null));
  }, [quote?.id]);

  const handleSendQuoteEmail = async () => {
    if (!quote) return;
    setSendingEmail(true);
    try {
      const res = await fetch(`/api/quotes/${quote.id}/send-email`, { method: "POST", headers: authHeader() });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(data?.error || "Não foi possível enviar o orçamento por e-mail."); return; }
      setEmailDelivery((current) => ({ sent: true, recipient: data.recipient, sent_at: data.sent_at, attempts: (current?.attempts || 0) + 1 }));
      await fetchQuote(true);
      toast.success(`Orçamento enviado para ${data.recipient}.`);
    } finally { setSendingEmail(false); }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div role="status" className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500">
        <Loader2 size={18} className="animate-spin" />Carregando orçamento…
      </div>
    );
  }
  if (notFound || !quote) {
    return (
      <ContentCard>
        <EmptyState
          icon={AlertTriangle}
          title="Orçamento não encontrado"
          description="O orçamento pode ter sido removido."
          action={<Button variant="outline" onClick={() => navigate("/admin/orcamentos")}>Voltar para orçamentos</Button>}
        />
      </ContentCard>
    );
  }

  const st = statusLabel(quote.status);
  const depositAmt = Number(quote.deposit_amount ?? 0);
  const remaining = Math.max(0, total - depositAmt);
  const quoteTotal = Number(quote.total_amount);
  const depositAlready = Number(quote.deposit_amount ?? 0);
  const amountDue  = Math.max(0, quoteTotal - depositAlready);
  const convertSettings = parseSalePaymentSettings(tenant);
  const convertCalc = computeSalePayment(amountDue, convertForm, convertSettings);
  const convertHasCrediarioWithoutCustomer = convertForm.payments.some((p) => p.method === "crediario") && !quote.customer_id;

  return (
    <div className="space-y-4">
      {/* Barra superior */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="ghost" size="sm" iconLeft={<ChevronLeft size={14} />} onClick={() => navigate("/admin/orcamentos")}>
          Voltar para orçamentos
        </Button>
        <div className="text-[11px] text-slate-500" role="status">
          {savingField && <span>Salvando…</span>}
          {!savingField && savedPulse && (
            <span className="flex items-center gap-1 text-emerald-600"><CheckCircle2 size={12} /> Salvo</span>
          )}
        </div>
      </div>

      {/* Cabeçalho da entidade */}
      <ContentCard padding="md">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-blue-100 bg-blue-50 text-blue-700">
            <FileText size={22} />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-semibold text-slate-900 sm:text-lg">
              {isDraft ? "Novo orçamento (rascunho)" : `Orçamento #${String(quote.number).padStart(4, "0")}`}
            </h1>
            <p className="mt-0.5 text-xs text-slate-500">
              {[
                quote.customer_name || (selectedCustomer?.name ?? manualCustomer.name),
                new Date(quote.created_at).toLocaleDateString("pt-BR"),
                `Validade ${validityDays} dias`,
              ].filter(Boolean).join(" · ")}
            </p>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <Badge color={st.color} size="sm" dot>{st.label}</Badge>
              {quote.converted_order_id && (
                <span className="text-xs text-emerald-700">Convertido — Pedido #{quote.converted_order_id}</span>
              )}
              {isDraft && <span className="text-xs text-slate-500">Preencha os dados abaixo — tudo é salvo automaticamente</span>}
            </div>
          </div>
          <div className="text-right">
            <p className="text-[11px] text-slate-500">Total</p>
            <p className="text-base font-semibold tabular-nums text-slate-900">{fmt(total)}</p>
          </div>
        </div>
        {isDraft && (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
            <Button
              size="sm"
              loading={starting}
              onClick={handleStart}
              disabled={!(selectedCustomer?.name ?? manualCustomer.name).trim() || (formItems.length === 0 && formServices.length === 0)}
              iconRight={<ArrowRight size={14} />}
            >
              Marcar como Enviado
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowDiscardConfirm(true)} disabled={deleting}>
              Descartar rascunho
            </Button>
            {!(selectedCustomer?.name ?? manualCustomer.name).trim() && (
              <span className="text-[11px] text-slate-500">Preencha cliente e adicione itens/serviços</span>
            )}
          </div>
        )}
      </ContentCard>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:items-start">
        <div className="min-w-0 lg:col-span-2">
          <Tabs<QuoteTabId> items={QUOTE_TABS} value={activeTab} onChange={setActiveTab} label="Detalhes do orçamento">
            {activeTab === "dados" && (
              <div className="space-y-3">
                <PanelCard title="Cliente" icon={User}>
                  <div className="space-y-2 p-3">
                    <div className="flex gap-2">
                      <div className="min-w-0 flex-1">
                        <Combobox
                          placeholder="Buscar por nome ou telefone..."
                          searchPlaceholder="Nome ou telefone..."
                          clearable
                          freeInput
                          disabled={!isEditable}
                          value={selectedCustomer ? String(selectedCustomer.id) : manualCustomer.name}
                          onChange={(v) => {
                            if (!v) { handleCustomerChange(null, ""); return; }
                            const cust = customers.find((c) => String(c.id) === v);
                            handleCustomerChange(cust ?? null, cust ? undefined : v);
                          }}
                          options={customers.map((c) => ({ value: String(c.id), label: c.name, description: c.phone }))}
                          onAddNew={(q) => { setNcName(q); setNcPhone(""); setNcDoc(""); setNcEmail(""); setShowNewCustomer(true); }}
                        />
                      </div>
                      <IconButton
                        variant="outline"
                        disabled={!isEditable}
                        onClick={() => { setNcName(""); setNcPhone(""); setNcDoc(""); setNcEmail(""); setShowNewCustomer(true); }}
                        title="Cadastrar novo cliente"
                        aria-label="Cadastrar novo cliente"
                      >
                        <UserPlus size={15} />
                      </IconButton>
                    </div>
                    {selectedCustomer ? (
                      <dl className="grid grid-cols-1 gap-x-6 sm:grid-cols-2">
                        <DetailField label="Telefone" value={selectedCustomer.phone ? maskPhone(selectedCustomer.phone) : ""} />
                        <DetailField label="E-mail" value={selectedCustomer.email} />
                      </dl>
                    ) : (
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <Input
                          label="Telefone"
                          value={manualCustomer.phone}
                          disabled={!isEditable}
                          onChange={(e) => setManualCustomer((m) => ({ ...m, phone: e.target.value }))}
                          onBlur={() => autosaveField({ customer_phone: manualCustomer.phone }, "customer_phone")}
                          placeholder="Telefone"
                        />
                        <Input
                          label="E-mail"
                          value={manualCustomer.email}
                          disabled={!isEditable}
                          onChange={(e) => setManualCustomer((m) => ({ ...m, email: e.target.value }))}
                          onBlur={() => autosaveField({ customer_email: manualCustomer.email }, "customer_email")}
                          placeholder="E-mail"
                        />
                      </div>
                    )}
                  </div>
                </PanelCard>

                <PanelCard title="Desconto, validade e observações">
                  <div className="space-y-3 p-3">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <span className="ds-label mb-1 block">Desconto</span>
                        <div className="flex gap-1">
                          <IconButton
                            size="md"
                            variant={discountType === "percent" ? "primary" : "outline"}
                            disabled={!isEditable}
                            aria-label="Desconto em porcentagem"
                            title="Desconto em porcentagem"
                            onClick={() => { setDiscountType("percent"); autosaveField({ discount_type: "percent" }, "discount"); }}
                          >
                            <Percent size={14} />
                          </IconButton>
                          <IconButton
                            size="md"
                            variant={discountType === "fixed" ? "primary" : "outline"}
                            disabled={!isEditable}
                            aria-label="Desconto em valor fixo"
                            title="Desconto em valor fixo"
                            onClick={() => { setDiscountType("fixed"); autosaveField({ discount_type: "fixed" }, "discount"); }}
                          >
                            <DollarSign size={14} />
                          </IconButton>
                          <Input
                            wrapperClassName="flex-1"
                            type="number" min={0} disabled={!isEditable} value={discountValue || ""}
                            onChange={(e) => setDiscountValue(Number(e.target.value))}
                            onBlur={() => autosaveField({ discount_value: discountValue }, "discount")}
                            placeholder={discountType === "percent" ? "%" : "R$"}
                            aria-label="Valor do desconto"
                          />
                        </div>
                      </div>
                      <Input
                        label="Validade (dias)"
                        type="number" min={1} disabled={!isEditable} value={validityDays}
                        onChange={(e) => setValidityDays(Number(e.target.value))}
                        onBlur={() => autosaveField({ validity_days: validityDays }, "validity_days")}
                      />
                    </div>
                    <Textarea
                      label="Observações / Condições de pagamento"
                      value={notes} disabled={!isEditable} onChange={(e) => setNotes(e.target.value)}
                      onBlur={() => autosaveField({ notes }, "notes")}
                      rows={3} placeholder="Ex: Pagamento à vista com desconto. Entrega em 5 dias úteis."
                    />
                  </div>
                </PanelCard>
              </div>
            )}

            {activeTab === "itens" && (
              <div className="space-y-3">
                {isEditable && (
                  <PanelCard title="Adicionar produtos" icon={Package}>
                    <div className="space-y-2 p-3">
                      <Input
                        iconLeft={<Search size={13} />}
                        value={productSearch}
                        onChange={(e) => setProductSearch(e.target.value)}
                        placeholder="Buscar produto..."
                        aria-label="Buscar produto"
                      />
                      {productSearch && (
                        <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-200 bg-white">
                          {filteredProducts.length === 0 ? (
                            <p className="px-3 py-2 text-xs text-slate-500">Nenhum produto encontrado</p>
                          ) : (
                            filteredProducts.slice(0, 10).map((p) => (
                              <button key={p.id} type="button" onClick={() => addProduct(p)} className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs hover:bg-slate-50">
                                <div className="min-w-0">
                                  <span className="font-medium text-slate-800">{p.name}</span>
                                  <span className="ml-2 text-[11px] text-slate-500">Estoque: {p.stock_quantity}</span>
                                </div>
                                <span className="shrink-0 font-semibold text-blue-700">{fmt(Number(p.discount_price ?? p.price))}</span>
                              </button>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  </PanelCard>
                )}

                {formItems.length > 0 && (
                  <PanelCard title="Produtos" icon={Package}>
                    <div className="space-y-2 p-3">
                      {formItems.map((item, idx) => (
                        <div key={idx} className="flex flex-wrap items-end gap-2 rounded-lg bg-slate-50 px-3 py-2">
                          <div className="min-w-[120px] flex-1 self-center">
                            <p className="truncate text-xs font-medium text-slate-800">{item.name}</p>
                            {item.dimensions_label && <p className="truncate font-mono text-[11px] text-blue-600">{item.dimensions_label}</p>}
                          </div>
                          <div className="shrink-0">
                            <span className="ds-label mb-1 block">Qtd.</span>
                            <div className="flex items-center gap-1">
                              <IconButton size="xs" variant="outline" disabled={!isEditable} aria-label="Diminuir quantidade" onClick={() => updateItemQty(idx, item.quantity - 1)}>−</IconButton>
                              <Input
                                wrapperClassName="w-16" className="text-center"
                                type="number" min={0} step="any" disabled={!isEditable} value={item.quantity}
                                aria-label="Quantidade"
                                onChange={(e) => updateItemQty(idx, Number(e.target.value))}
                              />
                              <IconButton size="xs" variant="outline" disabled={!isEditable} aria-label="Aumentar quantidade" onClick={() => updateItemQty(idx, item.quantity + 1)}>+</IconButton>
                            </div>
                          </div>
                          <Input
                            label="Preço unitário"
                            wrapperClassName="w-32 shrink-0" className="text-right font-mono"
                            addonLeft="R$"
                            inputMode="numeric" disabled={!isEditable} placeholder="0,00" value={centsToMasked(item.unit_price)}
                            onChange={(e) => updateItemPrice(idx, parseMaskedPrice(applyMoneyMask(e.target.value)))}
                          />
                          <span className="w-20 shrink-0 self-center text-right text-xs font-semibold tabular-nums text-slate-800">{fmt(item.total)}</span>
                          {isEditable && (
                            <IconButton size="xs" variant="ghost" aria-label="Remover produto" onClick={() => removeItem(idx)}><X size={14} /></IconButton>
                          )}
                        </div>
                      ))}
                    </div>
                  </PanelCard>
                )}

                {isEditable && services.length > 0 && (
                  <PanelCard title="Adicionar serviços" icon={Wrench}>
                    <div className="space-y-2 p-3">
                      <Input
                        iconLeft={<Search size={13} />}
                        value={serviceSearch}
                        onChange={(e) => setServiceSearch(e.target.value)}
                        placeholder="Buscar serviço..."
                        aria-label="Buscar serviço"
                      />
                      {serviceSearch && (
                        <div className="max-h-36 overflow-y-auto rounded-lg border border-slate-200 bg-white">
                          {services.filter((s) => s.name.toLowerCase().includes(serviceSearch.toLowerCase())).length === 0 ? (
                            <p className="px-3 py-2 text-xs text-slate-500">Nenhum serviço encontrado</p>
                          ) : (
                            services.filter((s) => s.name.toLowerCase().includes(serviceSearch.toLowerCase())).slice(0, 8).map((s) => (
                              <button key={s.id} type="button" onClick={() => addService(s)} className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs hover:bg-slate-50">
                                <div className="min-w-0">
                                  <span className="font-medium text-slate-800">{s.name}</span>
                                  {s.description && <span className="ml-2 text-[11px] text-slate-500">{s.description}</span>}
                                </div>
                                <span className="shrink-0 font-semibold text-blue-700">
                                  {s.sale_unit && s.sale_unit !== "unidade"
                                    ? `${fmt(Number(s.price_per_measure ?? 0))}/${s.sale_unit === "m2" ? "m²" : "m"}`
                                    : fmt(Number(s.price))}
                                </span>
                              </button>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  </PanelCard>
                )}

                {formServices.length > 0 && (
                  <PanelCard title="Serviços" icon={Wrench}>
                    <div className="space-y-2 p-3">
                      {formServices.map((svc) => (
                        <div key={svc.service_id} className="flex flex-wrap items-end gap-2 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2">
                          <div className="min-w-[100px] flex-1 self-center truncate">
                            <span className="text-xs font-medium text-slate-800">{svc.name}</span>
                            {svc.dimensions_label && <span className="ml-1.5 font-mono text-[11px] text-blue-600">{svc.dimensions_label}</span>}
                          </div>
                          <div className="shrink-0">
                            <span className="ds-label mb-1 block">Qtd.</span>
                            <div className="flex items-center gap-1">
                              <IconButton size="xs" variant="outline" disabled={!isEditable} aria-label="Diminuir quantidade" onClick={() => updateServiceQty(svc.service_id, svc.quantity - 1)}>−</IconButton>
                              <Input
                                wrapperClassName="w-16" className="text-center"
                                type="number" min={0} step="any" disabled={!isEditable} value={svc.quantity}
                                aria-label="Quantidade"
                                onChange={(e) => updateServiceQty(svc.service_id, Number(e.target.value))}
                              />
                              <IconButton size="xs" variant="outline" disabled={!isEditable} aria-label="Aumentar quantidade" onClick={() => updateServiceQty(svc.service_id, svc.quantity + 1)}>+</IconButton>
                            </div>
                          </div>
                          <Input
                            label="Preço unitário"
                            wrapperClassName="w-32 shrink-0" className="text-right font-mono"
                            addonLeft="R$"
                            inputMode="numeric" disabled={!isEditable} placeholder="0,00" value={centsToMasked(svc.price)}
                            onChange={(e) => updateServicePrice(svc.service_id, parseMaskedPrice(applyMoneyMask(e.target.value)))}
                          />
                          <span className="w-20 shrink-0 self-center text-right text-xs font-semibold tabular-nums text-blue-700">{fmt(svc.price * svc.quantity)}</span>
                          {isEditable && (
                            <IconButton size="xs" variant="ghost" aria-label="Remover serviço" onClick={() => removeService(svc.service_id)}><X size={14} /></IconButton>
                          )}
                        </div>
                      ))}
                    </div>
                  </PanelCard>
                )}

                {!isEditable && formItems.length === 0 && formServices.length === 0 && (
                  <ContentCard><EmptyState icon={Package} title="Nenhum item neste orçamento" /></ContentCard>
                )}
              </div>
            )}

            {activeTab === "arquivos" && (
              <PanelCard
                title="Arquivos"
                description="Referência, arte final e prova de aprovação"
                action={
                  <div className="flex flex-wrap gap-1.5">
                    <Button size="xs" variant="outline" iconLeft={<Package size={12} />} onClick={() => referenciaInputRef.current?.click()} disabled={fileUploading}>Referência</Button>
                    {tenant?.grafica_enabled && (
                      <>
                        <Button size="xs" variant="outline" iconLeft={<Palette size={12} />} onClick={() => arteInputRef.current?.click()} disabled={fileUploading}>Arte final</Button>
                        <Button size="xs" variant="outline" iconLeft={<CheckCircle2 size={12} />} onClick={() => provaInputRef.current?.click()} disabled={fileUploading}>Prova</Button>
                      </>
                    )}
                  </div>
                }
              >
                <div className="p-3">
                  <input ref={referenciaInputRef} type="file" accept="image/*,application/pdf" multiple className="hidden" aria-label="Anexar arquivo de referência"
                    onChange={(e) => { const files = e.target.files; if (files) Array.from(files).forEach((f) => handleQuoteFile(f, "referencia")); e.target.value = ""; }} />
                  <input ref={arteInputRef} type="file" accept="image/*,application/pdf" multiple className="hidden" aria-label="Anexar arte final"
                    onChange={(e) => { const files = e.target.files; if (files) Array.from(files).forEach((f) => handleQuoteFile(f, "arte")); e.target.value = ""; }} />
                  <input ref={provaInputRef} type="file" accept="image/*,application/pdf" multiple className="hidden" aria-label="Anexar prova de aprovação"
                    onChange={(e) => { const files = e.target.files; if (files) Array.from(files).forEach((f) => handleQuoteFile(f, "prova")); e.target.value = ""; }} />
                  {fileUploading && <p className="mb-2 text-[11px] text-slate-500">Enviando arquivo...</p>}
                  {(!quote.files || quote.files.length === 0) ? (
                    <p className="py-2 text-xs text-slate-500">Nenhum arquivo anexado.</p>
                  ) : (
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                      {quote.files.map((file) => {
                        const isPdf = file.url.toLowerCase().endsWith(".pdf");
                        const kindMeta: Record<string, { label: string; color: "default" | "purple" | "success" }> = {
                          referencia: { label: "Referência", color: "default" },
                          arte: { label: "Arte", color: "purple" },
                          prova: { label: "Prova", color: "success" },
                        };
                        const meta = kindMeta[file.kind] ?? kindMeta.referencia;
                        return (
                          <a key={file.id} href={file.url} target="_blank" rel="noreferrer"
                            className="group relative block aspect-square overflow-hidden rounded-lg border border-slate-200">
                            {isPdf ? (
                              <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-slate-50 text-slate-400">
                                <Download size={22} />
                                <span className="text-[11px] font-medium">PDF</span>
                              </div>
                            ) : (
                              <img src={file.url} alt={file.caption ?? ""} className="h-full w-full object-cover" />
                            )}
                            <span className="absolute left-1 top-1"><Badge color={meta.color} size="sm">{meta.label}</Badge></span>
                            <button type="button" aria-label="Remover arquivo" onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleRemoveQuoteFile(file.id); }}
                              className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100">
                              <X size={10} />
                            </button>
                          </a>
                        );
                      })}
                    </div>
                  )}
                </div>
              </PanelCard>
            )}

            {activeTab === "historico" && (
              <PanelCard title="Histórico de alterações" description="Auditoria do orçamento" icon={History}>
                <div className="space-y-2 p-3">
                  {!quote.actions?.length ? (
                    <p className="py-4 text-center text-xs text-slate-500">Nenhuma alteração registrada.</p>
                  ) : quote.actions.map((action) => (
                    <div key={action.id} className="rounded-lg border border-slate-200 p-3">
                      <p className="text-xs font-medium text-slate-800">{quoteActionLabel(action)}</p>
                      <p className="mt-0.5 text-[11px] text-slate-500">{action.actor ?? "Sistema"} · {new Date(action.created_at).toLocaleString("pt-BR")}</p>
                      {action.meta?.changes?.length ? (
                        <div className="mt-2 space-y-2 border-t border-slate-100 pt-2">
                          {action.meta.changes.map((change, index) => (
                            <div key={`${action.id}-${change.field}-${index}`} className="rounded-lg bg-slate-50 px-3 py-2 text-[11px]">
                              <p className="font-medium text-slate-600">{change.label}</p>
                              <p className="mt-1 break-words text-red-600"><span className="font-medium">Antes:</span> {change.before}</p>
                              <p className="mt-0.5 break-words text-emerald-700"><span className="font-medium">Depois:</span> {change.after}</p>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </PanelCard>
            )}
          </Tabs>
        </div>

        {/* Lateral: totais + ações */}
        <div className="space-y-3">
          <PanelCard title="Resumo" className="lg:sticky lg:top-5">
            <div className="space-y-1.5 p-3 text-xs">
              {itemsSubtotal > 0 && servicesSubtotal > 0 && (
                <>
                  <div className="flex justify-between text-slate-500"><span>Produtos</span><span className="tabular-nums">{fmt(itemsSubtotal)}</span></div>
                  <div className="flex justify-between text-blue-700"><span>Serviços</span><span className="tabular-nums">{fmt(servicesSubtotal)}</span></div>
                </>
              )}
              <div className="flex justify-between text-slate-500"><span>Subtotal</span><span className="tabular-nums text-slate-800">{fmt(subtotal)}</span></div>
              {discountAmt > 0 && (
                <div className="flex justify-between text-red-600"><span>Desconto</span><span className="tabular-nums">− {fmt(discountAmt)}</span></div>
              )}
              <div className="flex justify-between border-t border-slate-100 pt-1.5 text-[13px] font-semibold text-slate-900">
                <span>Total</span><span className="tabular-nums">{fmt(total)}</span>
              </div>
              {depositAmt > 0 && (
                <>
                  <div className="flex justify-between border-t border-slate-100 pt-1.5 text-cyan-700"><span>Entrada</span><span className="tabular-nums">{fmt(depositAmt)}</span></div>
                  <div className="flex justify-between text-amber-700"><span>Resta</span><span className="tabular-nums">{fmt(remaining)}</span></div>
                </>
              )}
            </div>
            <div className="space-y-2 border-t border-slate-100 p-3">
              <p className="text-center text-[11px] text-emerald-700">Alterações salvas automaticamente</p>
              <Button fullWidth variant="outline" size="sm" iconLeft={<Download size={14} />} onClick={handleDownloadPDF} disabled={!formItems.length && !formServices.length}>
                Baixar PDF
              </Button>
              <Button fullWidth variant="outline" size="sm" iconLeft={<History size={14} />} onClick={() => setActiveTab("historico")}>
                Histórico
              </Button>
              {(quote.customer_email || selectedCustomer?.email) ? (
                <>
                  <Button fullWidth size="sm" loading={sendingEmail} onClick={handleSendQuoteEmail} iconLeft={emailDelivery?.sent ? <Send size={14} /> : <Mail size={14} />}>
                    {emailDelivery?.sent ? "Reenviar por E-mail" : "Enviar por E-mail"}
                  </Button>
                  {emailDelivery?.sent && emailDelivery.sent_at && (
                    <p className="text-center text-[11px] text-emerald-700">Enviado para {emailDelivery.recipient} em {new Date(emailDelivery.sent_at).toLocaleString("pt-BR")}</p>
                  )}
                </>
              ) : (
                <p className="text-center text-[11px] text-amber-700">Cadastre o e-mail do cliente para enviar este orçamento.</p>
              )}
              {quote.status === "orcamento_enviado" && (
                <>
                  <Button fullWidth variant="outline" size="sm" iconLeft={<Wallet size={14} />}
                    onClick={() => { setDepositAmount(centsToMasked(remaining)); setShowDepositModal(true); }}>
                    Registrar Entrada
                  </Button>
                  <Button fullWidth variant="success" size="sm" iconLeft={<ArrowRight size={14} />}
                    onClick={() => { setConvertForm(newSalePaymentFormState(amountDue > 0 ? amountDue.toFixed(2) : "")); setShowConvertModal(true); }}>
                    Converter em Venda
                  </Button>
                </>
              )}
              {quote.status === "aguardando_aprovacao" && (
                <Button fullWidth variant="outline" size="sm" loading={generatingLink} onClick={handleCopyApprovalLink} iconLeft={<Link2 size={14} />}>
                  {linkCopied ? "Link copiado!" : "Copiar Link de Aprovação"}
                </Button>
              )}
              {!isDraft && (
                <Button fullWidth variant="danger" size="sm" iconLeft={<Trash2 size={14} />} onClick={handleDiscard} disabled={deleting}>
                  Excluir Orçamento
                </Button>
              )}
            </div>
          </PanelCard>
        </div>
      </div>

      {/* ── Medida (m²/linear) — Produto ─────────────────────────────────────── */}
      <Modal
        open={!!measureProduct}
        onClose={() => setMeasureProduct(null)}
        size="sm"
        title={measureProduct?.name}
        subtitle={measureProduct ? `Venda por ${measureProduct.sale_unit === "m2" ? "m²" : "metro linear"}` : undefined}
        footer={
          <ModalFooter>
            <Button variant="outline" onClick={() => setMeasureProduct(null)}>Cancelar</Button>
            <Button onClick={addMeasuredProduct} disabled={!measurePreview || measurePreview.rawQuantity <= 0} iconLeft={<PlusCircle size={14} />}>Adicionar</Button>
          </ModalFooter>
        }
      >
        {measureProduct && (
          <div className="space-y-3">
            {measureProduct.sale_unit === "m2" ? (
              <div className="grid grid-cols-2 gap-3">
                <Input label="Altura (m)" type="number" min="0" step="0.01" autoFocus value={measureHeight} onChange={(e) => setMeasureHeight(e.target.value)} placeholder="0,00" className="text-center font-mono" />
                <Input label="Largura (m)" type="number" min="0" step="0.01" value={measureWidth} onChange={(e) => setMeasureWidth(e.target.value)} placeholder="0,00" className="text-center font-mono" />
              </div>
            ) : (
              <Input label="Comprimento (m)" type="number" min="0" step="0.01" autoFocus value={measureHeight} onChange={(e) => setMeasureHeight(e.target.value)} placeholder="0,00" className="text-center font-mono" />
            )}
            {measurePreview && measurePreview.rawQuantity > 0 && (
              <div className="space-y-1.5 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs">
                <div className="flex justify-between text-slate-500">
                  <span>{measureProduct.sale_unit === "m2" ? "Área" : "Comprimento"}</span>
                  <span className="font-mono text-slate-800">{measurePreview.label}</span>
                </div>
                {measurePreview.minimumApplied && (
                  <p className="text-[11px] text-amber-700">
                    Cobrando o mínimo de {Number(measureProduct.min_billable_quantity).toFixed(2)}{measureProduct.sale_unit === "m2" ? "m²" : "m"}
                  </p>
                )}
                <div className="flex justify-between border-t border-slate-200 pt-1.5 text-[13px] font-semibold text-slate-900">
                  <span>Total</span><span className="font-mono">R$ {measurePreview.total.toFixed(2)}</span>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* ── Medida (m²/linear) — Serviço ─────────────────────────────────────── */}
      <Modal
        open={!!measureService}
        onClose={() => setMeasureService(null)}
        size="sm"
        title={measureService?.name}
        subtitle={measureService ? `Serviço por ${measureService.sale_unit === "m2" ? "m²" : "metro linear"}` : undefined}
        footer={
          <ModalFooter>
            <Button variant="outline" onClick={() => setMeasureService(null)}>Cancelar</Button>
            <Button onClick={addMeasuredService} disabled={!measureServicePreview || measureServicePreview.rawQuantity <= 0} iconLeft={<PlusCircle size={14} />}>Adicionar</Button>
          </ModalFooter>
        }
      >
        {measureService && (
          <div className="space-y-3">
            {measureService.sale_unit === "m2" ? (
              <div className="grid grid-cols-2 gap-3">
                <Input label="Altura (m)" type="number" min="0" step="0.01" autoFocus value={measureServiceHeight} onChange={(e) => setMeasureServiceHeight(e.target.value)} placeholder="0,00" className="text-center font-mono" />
                <Input label="Largura (m)" type="number" min="0" step="0.01" value={measureServiceWidth} onChange={(e) => setMeasureServiceWidth(e.target.value)} placeholder="0,00" className="text-center font-mono" />
              </div>
            ) : (
              <Input label="Comprimento (m)" type="number" min="0" step="0.01" autoFocus value={measureServiceHeight} onChange={(e) => setMeasureServiceHeight(e.target.value)} placeholder="0,00" className="text-center font-mono" />
            )}
            {measureServicePreview && measureServicePreview.rawQuantity > 0 && (
              <div className="space-y-1.5 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs">
                <div className="flex justify-between text-slate-500">
                  <span>{measureService.sale_unit === "m2" ? "Área" : "Comprimento"}</span>
                  <span className="font-mono text-slate-800">{measureServicePreview.label}</span>
                </div>
                {measureServicePreview.minimumApplied && (
                  <p className="text-[11px] text-amber-700">
                    Cobrando o mínimo de {Number(measureService.min_billable_quantity).toFixed(2)}{measureService.sale_unit === "m2" ? "m²" : "m"}
                  </p>
                )}
                <div className="flex justify-between border-t border-slate-200 pt-1.5 text-[13px] font-semibold text-slate-900">
                  <span>Total</span><span className="font-mono">R$ {measureServicePreview.total.toFixed(2)}</span>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* ── Registrar Entrada ─────────────────────────────────────────────────── */}
      <Modal
        open={showDepositModal}
        onClose={() => { if (!savingDeposit) setShowDepositModal(false); }}
        size="sm"
        title="Registrar Entrada"
        footer={
          <ModalFooter>
            <Button variant="outline" onClick={() => setShowDepositModal(false)}>Cancelar</Button>
            <Button onClick={handleRecordDeposit} loading={savingDeposit} disabled={!(parseMaskedPrice(depositAmount) > 0)} iconLeft={<Wallet size={14} />}>
              Confirmar Entrada
            </Button>
          </ModalFooter>
        }
      >
        <div className="space-y-4">
          <Input
            label="Valor da entrada"
            iconLeft={<Banknote size={14} />}
            inputMode="numeric" value={depositAmount} onChange={(e) => setDepositAmount(applyMoneyMask(e.target.value))} placeholder="0,00"
            className="font-mono"
          />
          <div>
            <span className="ds-label mb-1 block">Forma de pagamento</span>
            <div className="grid grid-cols-4 gap-1.5">
              {(["money", "debit", "credit", "pix"] as ConvertMethod[]).map((key) => (
                <button key={key} type="button" onClick={() => setDepositMethod(key)}
                  className={cn("flex h-9 flex-col items-center justify-center gap-0.5 rounded-lg border text-[11px] font-medium transition-all",
                    depositMethod === key ? (key === "credit" ? "border-emerald-500 bg-emerald-600 text-white" : "border-blue-500 bg-blue-600 text-white") : "border-slate-200 bg-white text-slate-500 hover:border-slate-400")}>
                  {key === "money" && <Banknote size={12} />}
                  {key === "debit" && <CreditCard size={12} />}
                  {key === "credit" && <CreditCard size={12} />}
                  {key === "pix" && <QrCode size={12} />}
                  {CONVERT_PM_LABEL[key]}
                </button>
              ))}
            </div>
          </div>
          {(depositMethod === "debit" || depositMethod === "credit") && (
            <div className="grid grid-cols-3 gap-1">
              {CONVERT_CARD_BRANDS.map(({ key, label, color }) => (
                <button key={key} type="button" onClick={() => setDepositBrand(key)}
                  className={cn("h-7 rounded-lg border text-[11px] font-medium transition-all", depositBrand === key ? "border-transparent text-white" : "border-slate-200 bg-white text-slate-500 hover:border-slate-400")}
                  style={depositBrand === key ? { backgroundColor: color } : {}}>
                  {label}
                </button>
              ))}
            </div>
          )}
          {depositMethod === "credit" && (
            <div className="grid grid-cols-4 gap-1">
              {[1, 2, 3, 4, 5, 6, 10, 12].map((n) => (
                <button key={n} type="button" onClick={() => setDepositInstallments(n)}
                  className={cn("h-8 rounded-lg border text-[11px] font-medium transition-all", depositInstallments === n ? "border-emerald-500 bg-emerald-600 text-white" : "border-slate-200 bg-white text-slate-500 hover:border-slate-400")}>
                  {n === 1 ? "Vista" : `${n}×`}
                </button>
              ))}
            </div>
          )}
        </div>
      </Modal>

      {/* ── Novo Cliente ──────────────────────────────────────────────────────── */}
      <Modal
        open={showNewCustomer}
        onClose={() => setShowNewCustomer(false)}
        position="right"
        size="sm"
        title="Novo Cliente"
        subtitle="Cadastro CRM"
        footer={
          <ModalFooter>
            <Button variant="outline" onClick={() => setShowNewCustomer(false)}>Cancelar</Button>
            <Button
              loading={savingNC}
              disabled={!ncName.trim()}
              onClick={async () => {
                if (!ncName.trim()) return;
                setSavingNC(true);
                try {
                  const res = await fetch("/api/customers", {
                    method: "POST",
                    headers: authHeader(),
                    body: JSON.stringify({ name: ncName, phone: ncPhone.replace(/\D/g, "") || null, document: ncDoc.replace(/\D/g, "") || null, email: ncEmail || null }),
                  });
                  const newCust = await res.json();
                  const cRes = await fetch("/api/customers", { headers: authHeaderNoJson() });
                  const cData = await cRes.json();
                  setCustomers(Array.isArray(cData) ? cData : []);
                  handleCustomerChange(newCust);
                  setShowNewCustomer(false);
                } finally {
                  setSavingNC(false);
                }
              }}
            >
              Criar Cliente
            </Button>
          </ModalFooter>
        }
      >
        <div className="space-y-3">
          <Input label="Nome *" value={ncName} onChange={(e) => setNcName(e.target.value)} placeholder="Nome completo" />
          <div className="grid grid-cols-2 gap-2">
            <Input label="Telefone" value={ncPhone} onChange={(e) => setNcPhone(maskPhone(e.target.value))} inputMode="numeric" placeholder="(11) 99999-9999" />
            <Input label="CPF/CNPJ" value={ncDoc} onChange={(e) => setNcDoc(maskDoc(e.target.value))} inputMode="numeric" placeholder="000.000.000-00" />
          </div>
          <Input label="E-mail" type="email" value={ncEmail} onChange={(e) => setNcEmail(e.target.value)} placeholder="email@exemplo.com" />
        </div>
      </Modal>

      {/* ── Converter em Venda ────────────────────────────────────────────────── */}
      <Modal
        open={showConvertModal}
        onClose={() => { if (!converting) setShowConvertModal(false); }}
        size="md"
        title="Converter em Venda"
        subtitle={`Orç. #${String(quote.number).padStart(4, "0")} · ${quote.customer_name}`}
        footer={
          <ModalFooter>
            <Button variant="outline" onClick={() => setShowConvertModal(false)}>Cancelar</Button>
            <Button variant="success" onClick={handleConvert} loading={converting} disabled={convertCalc.paidAmount <= 0 || convertHasCrediarioWithoutCustomer} iconLeft={<CheckCircle2 size={14} />}>
              Confirmar Venda
            </Button>
          </ModalFooter>
        }
      >
        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
            <span className="text-[11px] text-slate-500">Total do orçamento</span>
            <span className="font-mono text-base font-semibold text-slate-900">{fmt(quoteTotal)}</span>
          </div>

          <SalePaymentForm
            state={convertForm}
            onChange={setConvertForm}
            settings={convertSettings}
            baseAmount={amountDue}
            baseLabel={depositAlready > 0 ? "Saldo do orçamento" : "Total do orçamento"}
            sellers={sellers}
            hasCustomer={!!quote.customer_id}
            summaryExtra={depositAlready > 0 ? (
              <div className="flex justify-between text-cyan-700">
                <span>Entrada já paga (total {fmt(quoteTotal)})</span><span className="font-mono">{fmt(depositAlready)}</span>
              </div>
            ) : undefined}
          />
        </div>
      </Modal>

      <ConfirmDialog
        open={showDiscardConfirm}
        onClose={() => setShowDiscardConfirm(false)}
        onConfirm={handleDiscard}
        title="Descartar este rascunho?"
        description="O orçamento e a eventual OS vinculada serão excluídos. Esta ação não pode ser desfeita."
        confirmLabel="Descartar"
        variant="danger"
        loading={deleting}
      />
    </div>
  );
}
