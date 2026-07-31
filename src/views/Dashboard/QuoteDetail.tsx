import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ChevronLeft,
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
} from "lucide-react";
import PageHeader from "../../components/layout/PageHeader";
import Combobox from "../../components/ui/Combobox";
import { cn } from "../../lib/utils";
import { computeMeasuredPrice } from "../../utils/measurePricing";
import { downloadHtmlAsPdf } from "../../lib/pdf";
import { buildDocumentHeaderHtml, buildDocumentTableHtml, DOCUMENT_BASE_CSS, fmtMoney } from "../../lib/documentPdf";

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
  status: "rascunho" | "open" | "converted" | "cancelled" | "expired";
  converted_order_id?: number | null;
  deposit_amount?: number | null;
  deposit_payment_method?: string | null;
  deposit_paid_at?: string | null;
  created_at: string;
  items: QuoteItem[];
  services: QuoteServiceRow[];
  actions?: QuoteActionLog[];
}

interface Product {
  id: number;
  name: string;
  price: number;
  discount_price?: number;
  stock_quantity: number;
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
}

interface Customer {
  id: number;
  name: string;
  phone?: string;
  email?: string;
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
}

// ─── Payment types (same engine as PDV) ──────────────────────────────────────

type ConvertMethod = "money" | "debit" | "credit" | "pix";
type ConvertBrand  = "visa" | "master" | "elo" | "amex" | "hiper" | "other";

interface ConvertPayment {
  id: string;
  method: ConvertMethod;
  cardBrand: ConvertBrand;
  installments: number;
  amount: string;
}

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

function newConvertPayment(): ConvertPayment {
  return { id: Math.random().toString(36).slice(2), method: "money", cardBrand: "visa", installments: 1, amount: "" };
}

function buildConvertPmString(payments: ConvertPayment[]): string {
  return payments
    .filter((p) => Number(p.amount) > 0)
    .map((p) => {
      const brand = (p.method === "credit" || p.method === "debit") ? `-${p.cardBrand}` : "";
      const inst  = p.method === "credit" && p.installments > 1 ? `-${p.installments}x` : "";
      return `${p.method}${brand}${inst}:${Number(p.amount).toFixed(2)}`;
    })
    .join("|");
}

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

function statusLabel(s: string) {
  const map: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
    rascunho:  { label: "Rascunho",   color: "text-slate-500 bg-slate-100", icon: <Clock size={12} /> },
    open:      { label: "Aberto",     color: "text-blue-600 bg-blue-50",    icon: <Clock size={12} /> },
    converted: { label: "Convertido", color: "text-emerald-600 bg-emerald-50", icon: <CheckCircle2 size={12} /> },
    cancelled: { label: "Cancelado",  color: "text-red-600 bg-red-50",      icon: <XCircle size={12} /> },
    expired:   { label: "Expirado",   color: "text-orange-600 bg-orange-50",icon: <Clock size={12} /> },
  };
  return map[s] ?? map.open;
}

function quoteItemUnit(dimLabel?: string | null): string {
  if (!dimLabel) return "UN";
  return /m²|m2/i.test(dimLabel) ? "M²" : "UN";
}

async function generateQuotePDF(quote: Quote, tenant: Tenant) {
  const brandColor = tenant.primary_color ?? "#2563eb";
  const dateStr = new Date(quote.created_at).toLocaleDateString("pt-BR");
  const validUntil = new Date(
    new Date(quote.created_at).getTime() + quote.validity_days * 86400000
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

<div class="doc-section">
  <div class="doc-section-label">Cliente</div>
  <div class="doc-info-grid">
    <div class="doc-info-row"><b>${quote.customer_name}</b></div>
    ${[quote.customer_phone, quote.customer_email].filter(Boolean).length
      ? `<div class="doc-info-row">${[quote.customer_phone, quote.customer_email].filter(Boolean).join("  |  ")}</div>`
      : ""}
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

<div class="doc-section" style="font-size:10px;color:#94a3b8;font-style:italic;">
  Este orçamento é válido por ${quote.validity_days} dia(s) a partir de ${dateStr} (até ${validUntil}).
</div>

<div class="doc-footer">
  Documento emitido em ${new Date().toLocaleString("pt-BR")} — Este documento não tem valor fiscal.
</div>

</body>
</html>`;

  await downloadHtmlAsPdf(html, `orcamento-${String(quote.number).padStart(4, "0")}-${quote.customer_name.replace(/\s+/g, "-")}.pdf`);
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function QuoteDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const quoteId = Number(id);

  const [quote, setQuote] = useState<Quote | null>(null);
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
  const [serviceSearch, setServiceSearch] = useState("");
  const [formItems, setFormItems] = useState<QuoteItem[]>([]);
  const [formServices, setFormServices] = useState<{ service_id: number; name: string; price: number; quantity: number }[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [manualCustomer, setManualCustomer] = useState({ name: "", phone: "", email: "" });
  const [discountType, setDiscountType] = useState<"percent" | "fixed">("percent");
  const [discountValue, setDiscountValue] = useState(0);
  const [validityDays, setValidityDays] = useState(7);
  const [notes, setNotes] = useState("");
  const [starting, setStarting] = useState(false);
  const [deleting, setDeleting] = useState(false);

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
  const [convertPayments, setConvertPayments] = useState<ConvertPayment[]>([newConvertPayment()]);
  const [convertSellerId, setConvertSellerId] = useState<number | "">("");
  const [sellers, setSellers] = useState<{ id: number; name: string }[]>([]);
  const [converting, setConverting] = useState(false);

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
  const isEditable = quote?.status === "rascunho" || quote?.status === "open";

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
      services: svcs.map((s) => ({ id: s.service_id, name: s.name, price: s.price, quantity: s.quantity })),
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
      await fetch(`/api/quotes/${quote.id}/status`, { method: "PUT", headers: authHeader(), body: JSON.stringify({ status: "open" }) });
      await fetchQuote(true);
    } finally {
      setStarting(false);
    }
  };

  const handleDiscard = async () => {
    if (!quote) return;
    if (!confirm("Descartar este rascunho de orçamento?")) return;
    setDeleting(true);
    try {
      await fetch(`/api/quotes/${quote.id}`, { method: "DELETE", headers: authHeader() });
      navigate("/admin/orcamentos", { replace: true });
    } finally {
      setDeleting(false);
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
        body: JSON.stringify({ amount: Number(depositAmount) || 0, payment_method: pmString }),
      });
      if (res.ok) {
        setShowDepositModal(false);
        setDepositAmount("");
        setDepositMethod("money");
        setDepositInstallments(1);
        await fetchQuote(true);
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error || "Falha ao registrar entrada");
      }
    } finally {
      setSavingDeposit(false);
    }
  };

  const handleConvert = async () => {
    if (!quote) return;
    setConverting(true);
    try {
      const pmString = buildConvertPmString(convertPayments) || "money";
      await fetch(`/api/quotes/${quote.id}/convert`, {
        method: "POST",
        headers: authHeader(),
        body: JSON.stringify({ payment_method: pmString, seller_id: convertSellerId || undefined }),
      });
      setShowConvertModal(false);
      setConvertPayments([newConvertPayment()]);
      setConvertSellerId("");
      await fetchQuote(true);
    } finally {
      setConverting(false);
    }
  };

  const updateConvertPayment = (id: string, patch: Partial<ConvertPayment>) => {
    setConvertPayments((prev) => prev.map((p) => p.id === id ? { ...p, ...patch } : p));
  };
  const addConvertPayment = () => setConvertPayments((prev) => [...prev, newConvertPayment()]);
  const removeConvertPayment = (id: string) => setConvertPayments((prev) => prev.filter((p) => p.id !== id));

  const handleDownloadPDF = async () => {
    if (!quote || !tenant) return;
    await generateQuotePDF(quote, tenant);
  };

  const filteredProducts = products.filter((p) => p.is_active !== false && p.name.toLowerCase().includes(productSearch.toLowerCase()));

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) {
    return <div className="flex justify-center py-24 text-slate-400 text-sm">Carregando…</div>;
  }
  if (notFound || !quote) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24">
        <AlertTriangle className="text-red-500" size={28} />
        <p className="text-[12px] font-bold text-slate-600">Orçamento não encontrado</p>
        <button onClick={() => navigate("/admin/orcamentos")} className="h-9 px-4 bg-slate-900 text-white rounded-lg text-[11px] font-black uppercase tracking-wider hover:bg-slate-800 transition-all">
          Voltar
        </button>
      </div>
    );
  }

  const st = statusLabel(quote.status);
  const depositAmt = Number(quote.deposit_amount ?? 0);
  const remaining = Math.max(0, total - depositAmt);
  const quoteTotal = Number(quote.total_amount);
  const depositAlready = Number(quote.deposit_amount ?? 0);
  const amountDue  = Math.max(0, quoteTotal - depositAlready);
  const paidTotal  = convertPayments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const convertRemaining = Math.max(0, amountDue - paidTotal);

  return (
    <div className="space-y-5 pb-10">
      <PageHeader
        title={isDraft ? "Novo Orçamento (Rascunho)" : `Orçamento #${String(quote.number).padStart(4, "0")} — ${quote.customer_name}`}
        subtitle={isDraft ? "Preencha os dados abaixo — tudo é salvo automaticamente" : "Crie orçamentos profissionais e converta em vendas"}
        action={
          <button onClick={() => navigate("/admin/orcamentos")} className="h-9 px-4 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center gap-2 text-[12px] font-bold text-slate-600 transition-all">
            <ChevronLeft size={15} /> Voltar
          </button>
        }
      />

      {savingField && <p className="text-[10px] font-bold text-slate-400">Salvando…</p>}
      {!savingField && savedPulse && (
        <p className="text-[10px] font-bold text-emerald-500 flex items-center gap-1"><CheckCircle2 size={12} /> Salvo</p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          {/* Status */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <div className="flex items-center justify-between mb-1">
              <span className={cn("inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider", st.color)}>
                {st.icon} {st.label}
              </span>
              {quote.converted_order_id && (
                <span className="text-[10px] font-bold text-emerald-600">Convertido — Pedido #{quote.converted_order_id}</span>
              )}
            </div>
            {isDraft && (
              <div className="flex items-center gap-3 mt-3">
                <button
                  onClick={handleStart}
                  disabled={starting || !(selectedCustomer?.name ?? manualCustomer.name).trim() || (formItems.length === 0 && formServices.length === 0)}
                  className="h-9 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all"
                >
                  {starting ? <Loader2 size={13} className="animate-spin" /> : null} Ativar Orçamento <ArrowRight size={13} />
                </button>
                <button onClick={handleDiscard} disabled={deleting} className="text-[10px] font-bold text-slate-400 hover:text-red-500 transition-colors">
                  Descartar rascunho
                </button>
                {!(selectedCustomer?.name ?? manualCustomer.name).trim() && (
                  <span className="text-[10px] text-slate-400">Preencha cliente e adicione itens/serviços</span>
                )}
              </div>
            )}
          </div>

          {/* Customer */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <h3 className="text-[11px] font-black uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5">
              <User size={12} /> Cliente
            </h3>
            <div className="flex gap-2">
              <div className="flex-1 min-w-0">
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
              <button
                type="button"
                disabled={!isEditable}
                onClick={() => { setNcName(""); setNcPhone(""); setNcDoc(""); setNcEmail(""); setShowNewCustomer(true); }}
                className="h-9 w-9 rounded-lg bg-blue-50 border border-blue-200 text-blue-600 hover:bg-blue-100 disabled:opacity-40 flex items-center justify-center shrink-0 transition-colors"
                title="Cadastrar novo cliente"
              >
                <UserPlus size={15} />
              </button>
            </div>
            {!selectedCustomer && (
              <div className="grid grid-cols-2 gap-2 mt-2">
                <input
                  value={manualCustomer.phone}
                  disabled={!isEditable}
                  onChange={(e) => setManualCustomer((m) => ({ ...m, phone: e.target.value }))}
                  onBlur={() => autosaveField({ customer_phone: manualCustomer.phone }, "customer_phone")}
                  placeholder="Telefone"
                  className="h-9 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
                />
                <input
                  value={manualCustomer.email}
                  disabled={!isEditable}
                  onChange={(e) => setManualCustomer((m) => ({ ...m, email: e.target.value }))}
                  onBlur={() => autosaveField({ customer_email: manualCustomer.email }, "customer_email")}
                  placeholder="E-mail"
                  className="h-9 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
                />
              </div>
            )}
          </div>

          {/* Products */}
          {isEditable && (
            <div className="bg-white rounded-2xl border border-slate-200 p-5">
              <h3 className="text-[11px] font-black uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5">
                <Package size={12} /> Adicionar Produtos
              </h3>
              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder="Buscar produto..."
                  className="w-full pl-9 h-9 pr-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              {productSearch && (
                <div className="mt-1 border border-slate-200 rounded-lg bg-white shadow-lg max-h-48 overflow-y-auto">
                  {filteredProducts.length === 0 ? (
                    <p className="px-3 py-2 text-sm text-slate-400">Nenhum produto encontrado</p>
                  ) : (
                    filteredProducts.slice(0, 10).map((p) => (
                      <button key={p.id} onClick={() => addProduct(p)} className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50 flex items-center justify-between">
                        <div>
                          <span className="font-semibold">{p.name}</span>
                          <span className="ml-2 text-xs text-slate-400">Estoque: {p.stock_quantity}</span>
                        </div>
                        <span className="text-blue-600 font-bold">{fmt(Number(p.discount_price ?? p.price))}</span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          )}

          {/* Items list */}
          {formItems.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 p-5">
              <h3 className="text-[11px] font-black uppercase tracking-wider text-slate-500 mb-2">Produtos</h3>
              <div className="space-y-2">
                {formItems.map((item, idx) => (
                  <div key={idx} className="flex flex-wrap items-center gap-2 bg-slate-50 rounded-lg px-3 py-2">
                    <div className="flex-1 min-w-[120px]">
                      <p className="text-sm font-medium text-slate-700 truncate">{item.name}</p>
                      {item.dimensions_label && <p className="text-[10px] text-blue-500 font-mono truncate">{item.dimensions_label}</p>}
                    </div>
                    <div className="shrink-0">
                      <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">Qtd.</label>
                      <div className="flex items-center gap-1">
                        <button disabled={!isEditable} onClick={() => updateItemQty(idx, item.quantity - 1)}
                          className="w-6 h-6 rounded-md bg-white border border-slate-200 text-slate-600 font-bold flex items-center justify-center hover:bg-red-50 hover:text-red-500 shrink-0 disabled:opacity-40">−</button>
                        <input type="number" min={0} step="any" disabled={!isEditable} value={item.quantity}
                          onChange={(e) => updateItemQty(idx, Number(e.target.value))}
                          className="w-12 h-7 px-1 rounded-md border border-slate-200 text-sm text-center font-bold focus:outline-none focus:ring-1 focus:ring-blue-400 disabled:opacity-60" />
                        <button disabled={!isEditable} onClick={() => updateItemQty(idx, item.quantity + 1)}
                          className="w-6 h-6 rounded-md bg-white border border-slate-200 text-slate-600 font-bold flex items-center justify-center hover:bg-emerald-50 hover:text-emerald-500 shrink-0 disabled:opacity-40">+</button>
                      </div>
                    </div>
                    <div className="shrink-0">
                      <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">Preço unitário</label>
                      <div className="relative">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-[10px] font-bold pointer-events-none select-none">R$</span>
                        <input inputMode="numeric" disabled={!isEditable} placeholder="0,00" value={centsToMasked(item.unit_price)}
                          onChange={(e) => updateItemPrice(idx, parseMaskedPrice(applyMoneyMask(e.target.value)))}
                          className="w-28 h-7 pl-7 pr-2 rounded-md border border-slate-200 text-sm text-right font-mono focus:outline-none focus:ring-1 focus:ring-blue-400 disabled:opacity-60" />
                      </div>
                    </div>
                    <span className="w-20 text-right text-sm font-bold text-slate-800 shrink-0">{fmt(item.total)}</span>
                    {isEditable && (
                      <button onClick={() => removeItem(idx)} className="text-slate-400 hover:text-red-500"><X size={14} /></button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Services */}
          {isEditable && services.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 p-5">
              <h3 className="text-[11px] font-black uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5">
                <Wrench size={12} /> Adicionar Serviços
              </h3>
              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input value={serviceSearch} onChange={(e) => setServiceSearch(e.target.value)} placeholder="Buscar serviço..."
                  className="w-full pl-9 h-9 pr-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              {serviceSearch && (
                <div className="mt-1 border border-slate-200 rounded-lg bg-white shadow-lg max-h-36 overflow-y-auto">
                  {services.filter((s) => s.name.toLowerCase().includes(serviceSearch.toLowerCase())).length === 0 ? (
                    <p className="px-3 py-2 text-sm text-slate-400">Nenhum serviço encontrado</p>
                  ) : (
                    services.filter((s) => s.name.toLowerCase().includes(serviceSearch.toLowerCase())).slice(0, 8).map((s) => (
                      <button key={s.id} onClick={() => addService(s)} className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50 flex items-center justify-between">
                        <div>
                          <span className="font-semibold">{s.name}</span>
                          {s.description && <span className="ml-2 text-xs text-slate-400">{s.description}</span>}
                        </div>
                        <span className="text-blue-600 font-bold shrink-0">{fmt(Number(s.price))}</span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          )}

          {formServices.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 p-5">
              <h3 className="text-[11px] font-black uppercase tracking-wider text-slate-500 mb-2">Serviços</h3>
              <div className="space-y-2">
                {formServices.map((svc) => (
                  <div key={svc.service_id} className="flex flex-wrap items-center gap-2 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
                    <Wrench size={13} className="text-blue-400 shrink-0" />
                    <span className="flex-1 min-w-[100px] text-sm font-medium text-slate-700 truncate">{svc.name}</span>
                    <div className="shrink-0">
                      <label className="block text-[9px] font-bold uppercase tracking-wider text-blue-400 mb-0.5">Qtd.</label>
                      <div className="flex items-center gap-1">
                        <button disabled={!isEditable} onClick={() => updateServiceQty(svc.service_id, svc.quantity - 1)}
                          className="w-6 h-6 rounded-md bg-white border border-blue-200 text-slate-600 font-bold flex items-center justify-center hover:bg-red-50 hover:text-red-500 shrink-0 disabled:opacity-40">−</button>
                        <input type="number" min={0} step="any" disabled={!isEditable} value={svc.quantity}
                          onChange={(e) => updateServiceQty(svc.service_id, Number(e.target.value))}
                          className="w-12 h-7 px-1 rounded-md border border-blue-200 text-sm text-center font-bold focus:outline-none focus:ring-1 focus:ring-blue-400 disabled:opacity-60" />
                        <button disabled={!isEditable} onClick={() => updateServiceQty(svc.service_id, svc.quantity + 1)}
                          className="w-6 h-6 rounded-md bg-white border border-blue-200 text-slate-600 font-bold flex items-center justify-center hover:bg-emerald-50 hover:text-emerald-500 shrink-0 disabled:opacity-40">+</button>
                      </div>
                    </div>
                    <div className="shrink-0">
                      <label className="block text-[9px] font-bold uppercase tracking-wider text-blue-400 mb-0.5">Preço unitário</label>
                      <div className="relative">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-[10px] font-bold pointer-events-none select-none">R$</span>
                        <input inputMode="numeric" disabled={!isEditable} placeholder="0,00" value={centsToMasked(svc.price)}
                          onChange={(e) => updateServicePrice(svc.service_id, parseMaskedPrice(applyMoneyMask(e.target.value)))}
                          className="w-28 h-7 pl-7 pr-2 rounded-md border border-blue-200 text-sm text-right font-mono focus:outline-none focus:ring-1 focus:ring-blue-400 disabled:opacity-60" />
                      </div>
                    </div>
                    <span className="w-20 text-right text-sm font-bold text-blue-700 shrink-0">{fmt(svc.price * svc.quantity)}</span>
                    {isEditable && (
                      <button onClick={() => removeService(svc.service_id)} className="text-slate-400 hover:text-red-500"><X size={14} /></button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Discount + Validity + Notes */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">Desconto</label>
                <div className="flex gap-1">
                  <button disabled={!isEditable} onClick={() => { setDiscountType("percent"); autosaveField({ discount_type: "percent" }, "discount"); }}
                    className={cn("h-9 w-9 rounded-lg border flex items-center justify-center transition-all disabled:opacity-40",
                      discountType === "percent" ? "bg-blue-600 text-white border-blue-600" : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50")}>
                    <Percent size={14} />
                  </button>
                  <button disabled={!isEditable} onClick={() => { setDiscountType("fixed"); autosaveField({ discount_type: "fixed" }, "discount"); }}
                    className={cn("h-9 w-9 rounded-lg border flex items-center justify-center transition-all disabled:opacity-40",
                      discountType === "fixed" ? "bg-blue-600 text-white border-blue-600" : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50")}>
                    <DollarSign size={14} />
                  </button>
                  <input type="number" min={0} disabled={!isEditable} value={discountValue || ""}
                    onChange={(e) => setDiscountValue(Number(e.target.value))}
                    onBlur={() => autosaveField({ discount_value: discountValue }, "discount")}
                    placeholder={discountType === "percent" ? "%" : "R$"}
                    className="flex-1 h-9 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60" />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">Validade (dias)</label>
                <input type="number" min={1} disabled={!isEditable} value={validityDays}
                  onChange={(e) => setValidityDays(Number(e.target.value))}
                  onBlur={() => autosaveField({ validity_days: validityDays }, "validity_days")}
                  className="w-full h-9 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60" />
              </div>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">Observações / Condições de Pagamento</label>
              <textarea value={notes} disabled={!isEditable} onChange={(e) => setNotes(e.target.value)}
                onBlur={() => autosaveField({ notes }, "notes")}
                rows={3} placeholder="Ex: Pagamento à vista com desconto. Entrega em 5 dias úteis."
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none disabled:opacity-60" />
            </div>
          </div>

          {/* History */}
          {quote.actions && quote.actions.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 p-5">
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">Histórico</p>
              <div className="space-y-2">
                {quote.actions.map((a) => (
                  <div key={a.id} className="flex items-start gap-2 text-[11px]">
                    <div className="w-1.5 h-1.5 rounded-full bg-slate-300 mt-1.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-slate-600">
                        {a.action === "status_changed" && a.to_status ? `Status alterado para ${statusLabel(a.to_status).label}` :
                         a.action === "created" ? "Orçamento criado" :
                         a.action === "edited" ? "Orçamento editado" :
                         a.action === "converted" ? "Convertido em venda" :
                         a.action === "deposit_recorded" ? `Entrada registrada${a.note ? `: ${a.note}` : ""}` :
                         a.action === "expired" ? "Orçamento expirado" : a.action}
                      </p>
                      <p className="text-slate-400 text-[10px]">{a.actor ?? "Sistema"} · {new Date(a.created_at).toLocaleString("pt-BR")}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar: totals + actions */}
        <div className="space-y-5">
          <div className="bg-slate-900 rounded-2xl p-5 space-y-1.5 sticky top-5">
            {itemsSubtotal > 0 && servicesSubtotal > 0 && (
              <>
                <div className="flex justify-between text-[10px] font-bold uppercase text-slate-400">
                  <span>Produtos</span><span className="font-mono">{fmt(itemsSubtotal)}</span>
                </div>
                <div className="flex justify-between text-[10px] font-bold uppercase text-blue-400">
                  <span>Serviços</span><span className="font-mono">{fmt(servicesSubtotal)}</span>
                </div>
              </>
            )}
            <div className="flex justify-between text-[10px] font-bold uppercase text-slate-400">
              <span>Subtotal</span><span className="font-mono text-slate-200">{fmt(subtotal)}</span>
            </div>
            {discountAmt > 0 && (
              <div className="flex justify-between text-[10px] font-bold uppercase text-rose-400">
                <span>Desconto</span><span className="font-mono">− {fmt(discountAmt)}</span>
              </div>
            )}
            <div className="flex justify-between text-[13px] font-black uppercase text-white pt-1.5 border-t border-slate-700">
              <span>Total</span><span className="font-mono">{fmt(total)}</span>
            </div>
            {depositAmt > 0 && (
              <>
                <div className="flex justify-between text-[10px] font-bold uppercase text-cyan-400 pt-1.5 border-t border-slate-700">
                  <span>Entrada</span><span className="font-mono">{fmt(depositAmt)}</span>
                </div>
                <div className="flex justify-between text-[11px] font-black uppercase text-amber-400">
                  <span>Resta</span><span className="font-mono">{fmt(remaining)}</span>
                </div>
              </>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-2">
            <button onClick={handleDownloadPDF} disabled={!formItems.length && !formServices.length}
              className="w-full h-10 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 text-slate-700 transition-all">
              <Download size={14} /> Baixar PDF
            </button>
            {quote.status === "open" && (
              <>
                <button onClick={() => { setDepositAmount(""); setShowDepositModal(true); }}
                  className="w-full h-10 bg-cyan-50 hover:bg-cyan-100 border border-cyan-200 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 text-cyan-700 transition-all">
                  <Wallet size={14} /> Registrar Entrada
                </button>
                <button onClick={() => { setConvertPayments([newConvertPayment()]); setConvertSellerId(""); setShowConvertModal(true); }}
                  className="w-full h-10 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all">
                  <ArrowRight size={14} /> Converter em Venda
                </button>
              </>
            )}
            {!isDraft && (
              <button onClick={handleDiscard} disabled={deleting}
                className="w-full h-10 bg-white hover:bg-red-50 border border-red-200 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 text-red-600 transition-all disabled:opacity-40">
                <Trash2 size={14} /> Excluir Orçamento
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Medida (m²/linear) Modal ─────────────────────────────────────────── */}
      {measureProduct && (
        <>
          <div onClick={() => setMeasureProduct(null)} className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-[400]" />
          <div className="fixed inset-x-4 bottom-4 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 z-[401] bg-white flex flex-col overflow-hidden rounded-3xl" style={{ width: "min(420px, calc(100vw - 32px))" }}>
            <div className="shrink-0 flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-blue-500">
                  Venda por {measureProduct.sale_unit === "m2" ? "m²" : "metro linear"}
                </p>
                <h2 className="text-[14px] font-black text-slate-800">{measureProduct.name}</h2>
              </div>
              <button onClick={() => setMeasureProduct(null)} className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center">
                <X size={14} className="text-slate-500" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              {measureProduct.sale_unit === "m2" ? (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1.5 block">Altura (m)</label>
                    <input type="number" min="0" step="0.01" autoFocus value={measureHeight} onChange={(e) => setMeasureHeight(e.target.value)} placeholder="0,00"
                      className="w-full h-11 px-3 rounded-xl border border-slate-200 text-sm font-mono font-bold text-center focus:outline-none focus:border-blue-400" />
                  </div>
                  <div>
                    <label className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1.5 block">Largura (m)</label>
                    <input type="number" min="0" step="0.01" value={measureWidth} onChange={(e) => setMeasureWidth(e.target.value)} placeholder="0,00"
                      className="w-full h-11 px-3 rounded-xl border border-slate-200 text-sm font-mono font-bold text-center focus:outline-none focus:border-blue-400" />
                  </div>
                </div>
              ) : (
                <div>
                  <label className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1.5 block">Comprimento (m)</label>
                  <input type="number" min="0" step="0.01" autoFocus value={measureHeight} onChange={(e) => setMeasureHeight(e.target.value)} placeholder="0,00"
                    className="w-full h-11 px-3 rounded-xl border border-slate-200 text-sm font-mono font-bold text-center focus:outline-none focus:border-blue-400" />
                </div>
              )}
              {measurePreview && measurePreview.rawQuantity > 0 && (
                <div className="bg-slate-900 rounded-2xl p-4 space-y-1.5">
                  <div className="flex justify-between text-[10px] font-bold uppercase text-slate-400">
                    <span>{measureProduct.sale_unit === "m2" ? "Área" : "Comprimento"}</span>
                    <span className="font-mono text-slate-200">{measurePreview.label}</span>
                  </div>
                  {measurePreview.minimumApplied && (
                    <p className="text-[10px] font-bold text-amber-400">
                      Cobrando o mínimo de {Number(measureProduct.min_billable_quantity).toFixed(2)}{measureProduct.sale_unit === "m2" ? "m²" : "m"}
                    </p>
                  )}
                  <div className="flex justify-between text-[13px] font-black uppercase text-white pt-1.5 border-t border-slate-700">
                    <span>Total</span><span className="font-mono">R$ {measurePreview.total.toFixed(2)}</span>
                  </div>
                </div>
              )}
            </div>
            <div className="shrink-0 px-6 pb-6 pt-1 flex gap-2 border-t border-slate-100">
              <button onClick={() => setMeasureProduct(null)} className="flex-1 h-11 rounded-xl border border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50 transition-colors">
                Cancelar
              </button>
              <button onClick={addMeasuredProduct} disabled={!measurePreview || measurePreview.rawQuantity <= 0}
                className="flex-1 h-11 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                <PlusCircle size={14} /> Adicionar
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── Registrar Entrada Modal ───────────────────────────────────────────── */}
      {showDepositModal && (
        <>
          <div onClick={() => !savingDeposit && setShowDepositModal(false)} className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-[400]" />
          <div className="fixed inset-x-4 bottom-4 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 z-[401] bg-white flex flex-col overflow-hidden rounded-3xl" style={{ width: "min(420px, calc(100vw - 32px))" }}>
            <div className="shrink-0 flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-[14px] font-black text-slate-800">Registrar Entrada</h2>
              <button onClick={() => setShowDepositModal(false)} className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center">
                <X size={14} className="text-slate-500" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1.5 block">Valor da Entrada</label>
                <div className="relative">
                  <Banknote className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                  <input type="number" min="0" step="0.01" value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)} placeholder="0,00"
                    className="w-full pl-9 pr-3 h-10 rounded-xl border border-slate-200 text-[13px] font-mono font-bold focus:outline-none focus:border-blue-400 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none" />
                </div>
              </div>
              <div>
                <label className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1.5 block">Forma de Pagamento</label>
                <div className="grid grid-cols-4 gap-1.5">
                  {(["money", "debit", "credit", "pix"] as ConvertMethod[]).map((key) => (
                    <button key={key} onClick={() => setDepositMethod(key)}
                      className={cn("h-9 rounded-xl border text-[9px] font-black uppercase tracking-widest transition-all flex flex-col items-center justify-center gap-0.5",
                        depositMethod === key ? (key === "credit" ? "bg-emerald-600 border-emerald-500 text-white" : "bg-blue-600 border-blue-500 text-white") : "bg-white border-slate-200 text-slate-500 hover:border-slate-400")}>
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
                    <button key={key} onClick={() => setDepositBrand(key)}
                      className={cn("h-7 rounded-lg border text-[8px] font-black uppercase tracking-widest transition-all", depositBrand === key ? "text-white border-transparent" : "bg-white border-slate-200 text-slate-500 hover:border-slate-400")}
                      style={depositBrand === key ? { backgroundColor: color } : {}}>
                      {label}
                    </button>
                  ))}
                </div>
              )}
              {depositMethod === "credit" && (
                <div className="grid grid-cols-4 gap-1">
                  {[1, 2, 3, 4, 5, 6, 10, 12].map((n) => (
                    <button key={n} onClick={() => setDepositInstallments(n)}
                      className={cn("h-8 rounded-lg border text-[9px] font-black transition-all", depositInstallments === n ? "bg-emerald-600 border-emerald-500 text-white" : "bg-white border-slate-200 text-slate-500 hover:border-slate-400")}>
                      {n === 1 ? "Vista" : `${n}×`}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="shrink-0 px-6 pb-6 pt-3 flex gap-2 border-t border-slate-100">
              <button onClick={() => setShowDepositModal(false)} className="flex-1 h-11 rounded-xl border border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50 transition-colors">
                Cancelar
              </button>
              <button onClick={handleRecordDeposit} disabled={savingDeposit || !(Number(depositAmount) > 0)}
                className="flex-1 h-11 bg-cyan-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-cyan-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                {savingDeposit ? <Loader2 size={14} className="animate-spin" /> : <Wallet size={14} />}
                Confirmar Entrada
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── Novo Cliente Modal ────────────────────────────────────────────────── */}
      {showNewCustomer && (
        <>
          <div onClick={() => setShowNewCustomer(false)} className="fixed inset-0 bg-slate-900/60 z-[400] backdrop-blur-sm" />
          <div className="fixed inset-y-0 right-0 w-full max-w-sm bg-white z-[410] shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 shrink-0">
              <div>
                <h2 className="font-black text-slate-900 text-[15px]">Novo Cliente</h2>
                <p className="text-[11px] text-slate-500">Cadastro CRM</p>
              </div>
              <button onClick={() => setShowNewCustomer(false)} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500">
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">Nome *</label>
                <input value={ncName} onChange={(e) => setNcName(e.target.value)} placeholder="Nome completo"
                  className="w-full h-9 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">Telefone</label>
                  <input value={ncPhone} onChange={(e) => setNcPhone(maskPhone(e.target.value))} inputMode="numeric" placeholder="(11) 99999-9999"
                    className="w-full h-9 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">CPF/CNPJ</label>
                  <input value={ncDoc} onChange={(e) => setNcDoc(maskDoc(e.target.value))} inputMode="numeric" placeholder="000.000.000-00"
                    className="w-full h-9 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">E-mail</label>
                <input type="email" value={ncEmail} onChange={(e) => setNcEmail(e.target.value)} placeholder="email@exemplo.com"
                  className="w-full h-9 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            <div className="border-t border-slate-200 px-5 py-4 shrink-0 bg-slate-50 flex gap-2">
              <button onClick={() => setShowNewCustomer(false)} className="flex-1 h-9 rounded-lg border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-100">
                Cancelar
              </button>
              <button
                disabled={savingNC || !ncName.trim()}
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
                className="flex-1 h-9 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 disabled:opacity-50 transition-all"
              >
                {savingNC ? "Cadastrando…" : "Criar Cliente"}
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── Convert to Order Modal ────────────────────────────────────────────── */}
      {showConvertModal && (
        <>
          <div onClick={() => !converting && setShowConvertModal(false)} className="fixed inset-0 bg-slate-900/60 z-40 backdrop-blur-sm" />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md my-auto">
              <div className="px-6 pt-6 pb-4 border-b border-slate-100">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-black text-slate-900 text-base">Converter em Venda</h3>
                    <p className="text-[11px] text-slate-500 mt-0.5">Orç. #{String(quote.number).padStart(4, "0")} · {quote.customer_name}</p>
                  </div>
                  <button onClick={() => setShowConvertModal(false)} className="text-slate-300 hover:text-slate-600 transition-colors">
                    <X size={18} />
                  </button>
                </div>
                <div className="mt-3 bg-slate-900 rounded-xl px-4 py-2.5 flex items-center justify-between">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total do Orçamento</span>
                  <span className="text-lg font-mono font-black text-white">{fmt(quoteTotal)}</span>
                </div>
              </div>

              <div className="px-6 py-4 space-y-4 max-h-[65vh] overflow-y-auto">
                {sellers.length > 0 && (
                  <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Vendedor</p>
                    <div className="relative">
                      <User size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      <select value={convertSellerId} onChange={(e) => setConvertSellerId(e.target.value === "" ? "" : Number(e.target.value))}
                        className="w-full pl-8 pr-8 h-10 rounded-xl border border-slate-200 text-[11px] font-bold appearance-none focus:outline-none focus:border-blue-400 bg-white">
                        <option value="">Sem vendedor</option>
                        {sellers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                      <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    </div>
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Formas de Pagamento</p>
                    <button onClick={addConvertPayment} className="flex items-center gap-1 h-6 px-2 bg-blue-50 border border-blue-200 rounded-lg text-[9px] font-black text-blue-600 uppercase tracking-widest hover:bg-blue-100 transition-all">
                      <PlusCircle size={10} /> Adicionar
                    </button>
                  </div>
                  <div className="space-y-2.5">
                    {convertPayments.map((p, idx) => {
                      const feeRate = p.method === "credit" ? (tenant?.card_fees?.[p.cardBrand]?.[p.installments - 1] ?? 0) : 0;
                      const pAmt    = Number(p.amount) || 0;
                      const pFee    = feeRate > 0 && pAmt > 0 ? pAmt * (feeRate / 100) : 0;
                      return (
                        <div key={p.id} className="bg-slate-50 rounded-2xl border border-slate-200 p-3 space-y-2.5">
                          <div className="flex items-center gap-2">
                            {convertPayments.length > 1 && (
                              <span className="w-5 h-5 bg-slate-200 rounded-full flex items-center justify-center text-[9px] font-black text-slate-600 shrink-0">{idx + 1}</span>
                            )}
                            <div className="grid grid-cols-4 gap-1.5 flex-1">
                              {(["money", "debit", "credit", "pix"] as ConvertMethod[]).map((key) => (
                                <button key={key} onClick={() => updateConvertPayment(p.id, { method: key, installments: 1 })}
                                  className={cn("h-9 rounded-xl border text-[9px] font-black uppercase tracking-widest transition-all flex flex-col items-center justify-center gap-0.5",
                                    p.method === key ? (key === "credit" ? "bg-emerald-600 border-emerald-500 text-white" : "bg-blue-600 border-blue-500 text-white") : "bg-white border-slate-200 text-slate-500 hover:border-slate-400")}>
                                  {key === "money"  && <Banknote size={12} />}
                                  {key === "debit"  && <CreditCard size={12} />}
                                  {key === "credit" && <CreditCard size={12} />}
                                  {key === "pix"    && <QrCode size={12} />}
                                  {CONVERT_PM_LABEL[key]}
                                </button>
                              ))}
                            </div>
                            {convertPayments.length > 1 && (
                              <button onClick={() => removeConvertPayment(p.id)} className="text-slate-300 hover:text-red-500 transition-colors shrink-0">
                                <X size={14} />
                              </button>
                            )}
                          </div>
                          {(p.method === "debit" || p.method === "credit") && (
                            <div className="grid grid-cols-3 gap-1">
                              {CONVERT_CARD_BRANDS.map(({ key, label, color }) => (
                                <button key={key} onClick={() => updateConvertPayment(p.id, { cardBrand: key })}
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
                                const rate      = tenant?.card_fees?.[p.cardBrand]?.[n - 1] ?? 0;
                                const totalWFee = pAmt > 0 && rate > 0 ? pAmt * (1 + rate / 100) : pAmt;
                                const perInst   = n > 1 && pAmt > 0 ? totalWFee / n : 0;
                                const isActive  = p.installments === n;
                                return (
                                  <button key={n} onClick={() => updateConvertPayment(p.id, { installments: n })}
                                    className={cn("rounded-lg border transition-all flex flex-col items-center justify-center py-1.5 px-1 gap-0.5", isActive ? "bg-emerald-600 border-emerald-500 text-white" : "bg-white border-slate-200 text-slate-500 hover:border-slate-400")}>
                                    <span className="text-[8px] font-black uppercase">{n === 1 ? "Vista" : `${n}×`}</span>
                                    {rate > 0 && <span className={cn("text-[7px] font-bold", isActive ? "text-emerald-200" : "text-amber-500")}>+{rate}%</span>}
                                    {pAmt > 0 && rate > 0 && <span className={cn("text-[7px] font-mono font-black", isActive ? "text-emerald-100" : "text-slate-600")}>R${totalWFee.toFixed(2)}</span>}
                                    {perInst > 0 && <span className={cn("text-[7px] font-mono", isActive ? "text-emerald-200" : "text-slate-400")}>{n}×R${perInst.toFixed(2)}</span>}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                          <div className="flex gap-2">
                            <div className="relative flex-1">
                              <Banknote className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
                              <input type="number" min="0" step="0.01"
                                placeholder={idx === 0 && convertRemaining > 0 ? `R$ ${convertRemaining.toFixed(2)}` : "Valor (R$)"}
                                className="w-full pl-9 pr-3 h-10 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 text-[11px] font-medium text-slate-800 placeholder:text-slate-400 transition-all [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                                value={p.amount} onChange={(e) => updateConvertPayment(p.id, { amount: e.target.value })} />
                            </div>
                            {pFee > 0.005 && (
                              <div className="flex flex-col items-end gap-0.5 bg-amber-50 border border-amber-200 rounded-xl px-3 py-1.5 shrink-0">
                                <span className="text-[8px] font-black text-amber-600 uppercase">Taxa {feeRate}%</span>
                                <span className="text-[10px] font-mono font-black text-amber-700">− R$ {pFee.toFixed(2)}</span>
                                {p.installments > 1 && pAmt > 0 && (
                                  <span className="text-[7px] font-bold text-amber-500">{p.installments}× R$ {((pAmt * (1 + feeRate / 100)) / p.installments).toFixed(2)}/parc</span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="bg-slate-900 rounded-2xl p-4 space-y-2">
                  <div className="flex justify-between text-[10px] font-bold uppercase text-slate-500">
                    <span>Total orçamento</span><span className="font-mono">R$ {quoteTotal.toFixed(2)}</span>
                  </div>
                  {depositAlready > 0 && (
                    <div className="flex justify-between text-[10px] font-bold uppercase text-cyan-400">
                      <span>Entrada já paga</span><span className="font-mono">− R$ {depositAlready.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-[10px] font-bold uppercase text-slate-400">
                    <span>Pago agora</span><span className="font-mono text-emerald-400">R$ {paidTotal.toFixed(2)}</span>
                  </div>
                  {convertRemaining > 0.005 && (
                    <div className="flex justify-between text-[10px] font-black uppercase text-rose-400 pt-1 border-t border-slate-700">
                      <span>Restante</span><span className="font-mono">R$ {convertRemaining.toFixed(2)}</span>
                    </div>
                  )}
                  {convertRemaining <= 0.005 && paidTotal > 0 && (
                    <div className="flex justify-between text-[10px] font-black uppercase text-emerald-400 pt-1 border-t border-slate-700">
                      <span>Pagamento OK</span><span className="font-mono">✓</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="px-6 pb-6 pt-3 flex gap-2 border-t border-slate-100">
                <button onClick={() => setShowConvertModal(false)} className="flex-1 h-11 rounded-xl border border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50 transition-colors">
                  Cancelar
                </button>
                <button onClick={handleConvert} disabled={converting || paidTotal <= 0}
                  className="flex-1 h-11 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                  {converting ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                  Confirmar Venda
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
