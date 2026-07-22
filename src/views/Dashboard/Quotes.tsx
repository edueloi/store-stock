import { useState, useEffect, useCallback } from "react";
import {
  FileText,
  Plus,
  Search,
  Trash2,
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
  Edit2,
  Wallet,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../../lib/utils";
import PageHeader from "../../components/layout/PageHeader";
import Combobox from "../../components/ui/Combobox";
import { computeMeasuredPrice } from "../../utils/measurePricing";

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
  status: "open" | "converted" | "cancelled" | "expired";
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

interface QuoteServiceItem {
  service_id: number;
  name: string;
  price: number;
  quantity: number;
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

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

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
    open:      { label: "Aberto",     color: "text-blue-600 bg-blue-50",    icon: <Clock size={12} /> },
    converted: { label: "Convertido", color: "text-emerald-600 bg-emerald-50", icon: <CheckCircle2 size={12} /> },
    cancelled: { label: "Cancelado",  color: "text-red-600 bg-red-50",      icon: <XCircle size={12} /> },
    expired:   { label: "Expirado",   color: "text-orange-600 bg-orange-50",icon: <Clock size={12} /> },
  };
  return map[s] ?? map.open;
}

// ─── PDF Generator ────────────────────────────────────────────────────────────

function docLabelForDocument(doc: string): string {
  const digits = doc.replace(/\D/g, "");
  if (digits.length > 11) return "CNPJ";
  if (digits.length > 0) return "CPF";
  return "Documento";
}

async function generateQuotePDF(quote: Quote, tenant: Tenant) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  const pageW = 210;
  const pageH = 297;
  const margin = 18;
  const contentW = pageW - margin * 2;

  const primary = tenant.primary_color ?? "#2563eb";
  const hexToRgb = (hex: string) => {
    const h = hex.replace("#", "");
    return {
      r: parseInt(h.substring(0, 2), 16),
      g: parseInt(h.substring(2, 4), 16),
      b: parseInt(h.substring(4, 6), 16),
    };
  };
  const pc = hexToRgb(primary);
  const gray = { text: [51, 65, 85], muted: [148, 163, 184], line: [230, 232, 236], soft: [250, 250, 251] };

  // ── Logo (if available) — converte para PNG via canvas para garantir compatibilidade
  let logoLoaded = false;
  if (tenant.logo_url) {
    try {
      const absoluteUrl = tenant.logo_url.startsWith("http")
        ? tenant.logo_url
        : `${window.location.origin}${tenant.logo_url}`;

      const dataUrl = await new Promise<string>((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
          const canvas = document.createElement("canvas");
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          const ctx = canvas.getContext("2d")!;
          ctx.drawImage(img, 0, 0);
          resolve(canvas.toDataURL("image/png"));
        };
        img.onerror = reject;
        img.src = absoluteUrl;
      });

      doc.addImage(dataUrl, "PNG", margin, 16, 18, 18);
      logoLoaded = true;
    } catch {
      // ignora se não conseguir carregar o logo
    }
  }

  // ── Header — clean, white background, brand color used only as accent
  const textX = logoLoaded ? margin + 24 : margin;
  doc.setTextColor(20, 24, 32);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(tenant.name, textX, 22);

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(gray.muted[0], gray.muted[1], gray.muted[2]);
  const addrParts: string[] = [];
  if (tenant.address_street) {
    addrParts.push(
      `${tenant.address_street}${tenant.address_number ? ", " + tenant.address_number : ""}` +
        (tenant.address_complement ? ` - ${tenant.address_complement}` : "")
    );
  }
  if (tenant.address_district) addrParts.push(tenant.address_district);
  if (tenant.address_city)
    addrParts.push(
      `${tenant.address_city}${tenant.address_state ? " - " + tenant.address_state : ""}`
    );
  if (tenant.address_zip) addrParts.push(`CEP: ${tenant.address_zip}`);
  if (tenant.document) addrParts.push(`${docLabelForDocument(tenant.document)}: ${tenant.document}`);
  if (tenant.whatsapp) addrParts.push(`WhatsApp: ${tenant.whatsapp}`);

  doc.text(addrParts.join("  •  "), textX, 28, { maxWidth: 105 });

  // ── "ORÇAMENTO" label on right, brand-colored text (no full banner)
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(pc.r, pc.g, pc.b);
  doc.text("ORÇAMENTO", pageW - margin, 20, { align: "right" });
  doc.setFontSize(9.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(gray.muted[0], gray.muted[1], gray.muted[2]);
  doc.text(`Nº ${String(quote.number).padStart(4, "0")}`, pageW - margin, 26, { align: "right" });

  const dateStr = new Date(quote.created_at).toLocaleDateString("pt-BR");
  const validUntil = new Date(
    new Date(quote.created_at).getTime() + quote.validity_days * 86400000
  ).toLocaleDateString("pt-BR");
  doc.text(`Emitido em ${dateStr}`, pageW - margin, 31, { align: "right" });
  doc.text(`Válido até ${validUntil}`, pageW - margin, 36, { align: "right" });

  // ── Thin accent rule under header
  let y = 44;
  doc.setDrawColor(pc.r, pc.g, pc.b);
  doc.setLineWidth(0.8);
  doc.line(margin, y, pageW - margin, y);

  // ── Client section — plain text, no boxed card
  y += 10;
  doc.setTextColor(gray.muted[0], gray.muted[1], gray.muted[2]);
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "bold");
  doc.text("CLIENTE", margin, y);

  y += 6;
  doc.setTextColor(20, 24, 32);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(quote.customer_name, margin, y);

  const contactParts = [quote.customer_phone, quote.customer_email].filter(Boolean).join("   •   ");
  if (contactParts) {
    y += 5.5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(gray.muted[0], gray.muted[1], gray.muted[2]);
    doc.text(contactParts, margin, y);
  }

  // ── Items table — light header row, no solid brand banner
  y += 10;
  doc.setDrawColor(gray.line[0], gray.line[1], gray.line[2]);
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageW - margin, y);

  y += 6;
  doc.setTextColor(gray.muted[0], gray.muted[1], gray.muted[2]);
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "bold");
  const cols = { name: margin, qty: margin + 105, price: margin + 133, total: pageW - margin };
  doc.text("PRODUTO / SERVIÇO", cols.name, y);
  doc.text("QTD", cols.qty, y, { align: "center" });
  doc.text("PREÇO UNIT.", cols.price, y, { align: "right" });
  doc.text("TOTAL", cols.total, y, { align: "right" });

  y += 3;
  doc.setDrawColor(gray.line[0], gray.line[1], gray.line[2]);
  doc.line(margin, y, pageW - margin, y);

  // ── Items rows
  y += 7;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);

  const allRows: { name: string; dimLabel?: string | null; qty: number; unit_price: number; total: number; isService?: boolean }[] = [
    ...quote.items.map((i) => ({ name: i.name, dimLabel: i.dimensions_label, qty: i.quantity, unit_price: Number(i.unit_price), total: Number(i.total) })),
    ...(quote.services ?? []).map((s) => ({ name: s.name, qty: s.quantity, unit_price: Number(s.unit_price), total: Number(s.unit_price) * s.quantity, isService: true })),
  ];

  const maxNameW = 100;
  for (let i = 0; i < allRows.length; i++) {
    const row = allRows[i];
    const rowLines = doc.splitTextToSize(row.name, maxNameW);
    const rowH = Math.max(8, rowLines.length * 4.5 + (row.dimLabel ? 4 : 0) + 3);

    doc.setTextColor(20, 24, 32);
    doc.text(rowLines, cols.name, y);
    if (row.isService) {
      doc.setFontSize(6.5);
      doc.setTextColor(pc.r, pc.g, pc.b);
      doc.text("SERVIÇO", cols.name, y - 4);
      doc.setFontSize(9);
    }
    if (row.dimLabel) {
      doc.setFontSize(7.5);
      doc.setTextColor(gray.muted[0], gray.muted[1], gray.muted[2]);
      doc.text(row.dimLabel, cols.name, y + rowLines.length * 4.5);
      doc.setFontSize(9);
    }

    doc.setTextColor(20, 24, 32);
    doc.text(String(row.qty), cols.qty, y, { align: "center" });
    doc.text(fmt(row.unit_price), cols.price, y, { align: "right" });
    doc.text(fmt(row.total), cols.total, y, { align: "right" });

    y += rowH;
    doc.setDrawColor(gray.soft[0] - 5, gray.soft[1] - 5, gray.soft[2] - 5);
    doc.setDrawColor(240, 241, 243);
    doc.line(margin, y - 2, pageW - margin, y - 2);
  }

  // ── Totals block — right-aligned, no boxed card
  y += 6;
  const totalsX = pageW - margin - 65;
  const totalsW = 65;

  doc.setTextColor(gray.muted[0], gray.muted[1], gray.muted[2]);
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "normal");
  doc.text("Subtotal", totalsX, y);
  doc.setTextColor(20, 24, 32);
  doc.text(fmt(Number(quote.subtotal)), pageW - margin, y, { align: "right" });

  if (quote.discount_value > 0) {
    const discLabel =
      quote.discount_type === "percent"
        ? `Desconto (${quote.discount_value}%)`
        : "Desconto";
    const discAmt =
      quote.discount_type === "percent"
        ? (Number(quote.subtotal) * Number(quote.discount_value)) / 100
        : Number(quote.discount_value);
    y += 6;
    doc.setTextColor(gray.muted[0], gray.muted[1], gray.muted[2]);
    doc.text(discLabel, totalsX, y);
    doc.setTextColor(220, 38, 38);
    doc.text(`- ${fmt(discAmt)}`, pageW - margin, y, { align: "right" });
  }

  y += 4;
  doc.setDrawColor(gray.line[0], gray.line[1], gray.line[2]);
  doc.line(totalsX, y, pageW - margin, y);
  y += 7;
  doc.setFontSize(11.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(pc.r, pc.g, pc.b);
  doc.text("TOTAL", totalsX, y);
  doc.text(fmt(Number(quote.total_amount)), pageW - margin, y, { align: "right" });

  y += 10;

  // ── Entrada / Resta
  const depositAmt = Number(quote.deposit_amount ?? 0);
  if (depositAmt > 0) {
    const remaining = Math.max(0, Number(quote.total_amount) - depositAmt);
    doc.setDrawColor(224, 231, 255);
    doc.setFillColor(246, 248, 255);
    doc.roundedRect(totalsX, y, totalsW, 16, 2, 2, "FD");
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(pc.r, pc.g, pc.b);
    doc.text("Entrada paga", totalsX + 4, y + 6);
    doc.text(fmt(depositAmt), pageW - margin - 4, y + 6, { align: "right" });
    doc.setTextColor(180, 83, 9);
    doc.text("Restante", totalsX + 4, y + 12.5);
    doc.text(fmt(remaining), pageW - margin - 4, y + 12.5, { align: "right" });
    y += 22;
  }

  // ── Notes
  if (quote.notes) {
    doc.setTextColor(gray.muted[0], gray.muted[1], gray.muted[2]);
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "bold");
    doc.text("OBSERVAÇÕES / CONDIÇÕES DE PAGAMENTO", margin, y);
    y += 5.5;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(60, 70, 85);
    doc.setFontSize(8.5);
    const noteLines = doc.splitTextToSize(quote.notes, contentW);
    doc.text(noteLines, margin, y);
    y += noteLines.length * 4.5 + 6;
  }

  // ── Validity reminder
  y += 3;
  doc.setTextColor(gray.muted[0], gray.muted[1], gray.muted[2]);
  doc.setFontSize(8);
  doc.setFont("helvetica", "italic");
  doc.text(
    `Este orçamento é válido por ${quote.validity_days} dia(s) a partir de ${dateStr} (até ${validUntil}).`,
    margin,
    y
  );

  // ── Footer
  doc.setDrawColor(gray.line[0], gray.line[1], gray.line[2]);
  doc.setLineWidth(0.3);
  doc.line(margin, pageH - 16, pageW - margin, pageH - 16);
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(60, 70, 85);
  doc.text(tenant.name, margin, pageH - 10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(gray.muted[0], gray.muted[1], gray.muted[2]);
  doc.text(
    `Gerado em ${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`,
    pageW - margin,
    pageH - 10,
    { align: "right" }
  );

  doc.save(`orcamento-${String(quote.number).padStart(4, "0")}-${quote.customer_name.replace(/\s+/g, "-")}.pdf`);
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Quotes() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [services, setServices] = useState<ServiceCatalog[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // New quote form state
  const [showForm, setShowForm] = useState(false);
  const [editingQuoteId, setEditingQuoteId] = useState<number | null>(null);
  const [productSearch, setProductSearch] = useState("");
  const [measureProduct, setMeasureProduct] = useState<Product | null>(null);
  const [measureHeight, setMeasureHeight] = useState("");
  const [measureWidth, setMeasureWidth] = useState("");
  const [serviceSearch, setServiceSearch] = useState("");
  const [formItems, setFormItems] = useState<QuoteItem[]>([]);
  const [formServices, setFormServices] = useState<QuoteServiceItem[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [manualCustomer, setManualCustomer] = useState({ name: "", phone: "", email: "" });
  const [discountType, setDiscountType] = useState<"percent" | "fixed">("percent");
  const [discountValue, setDiscountValue] = useState(0);
  const [validityDays, setValidityDays] = useState(7);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  // Novo cliente inline (mesmo padrão de ServiceOrders.tsx)
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [ncName, setNcName] = useState("");
  const [ncPhone, setNcPhone] = useState("");
  const [ncDoc, setNcDoc] = useState("");
  const [ncEmail, setNcEmail] = useState("");
  const [savingNC, setSavingNC] = useState(false);

  // Detail drawer
  const [selectedQuoteDetail, setSelectedQuoteDetail] = useState<Quote | null>(null);

  // Registrar entrada
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [depositAmount, setDepositAmount] = useState("");
  const [depositMethod, setDepositMethod] = useState<ConvertMethod>("money");
  const [depositBrand, setDepositBrand] = useState<ConvertBrand>("visa");
  const [depositInstallments, setDepositInstallments] = useState(1);
  const [savingDeposit, setSavingDeposit] = useState(false);

  // Detail/convert modal
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);
  const [showConvertModal, setShowConvertModal] = useState(false);
  // convert payment — same multi-payment engine as PDV
  const [convertPayments, setConvertPayments] = useState<ConvertPayment[]>([newConvertPayment()]);
  const [convertSellerId, setConvertSellerId] = useState<number | "">("");
  const [cardFees, setCardFees] = useState<Record<string, number[]>>({});
  const [sellers, setSellers] = useState<{ id: number; name: string }[]>([]);
  const [converting, setConverting] = useState(false);

  const fetchAll = useCallback(async () => {
    const h = { Authorization: `Bearer ${localStorage.getItem("token")}` };
    try {
      const [qRes, pRes, cRes, tRes, sRes, svRes] = await Promise.all([
        fetch("/api/quotes",    { headers: h }),
        fetch("/api/products",  { headers: h }),
        fetch("/api/customers", { headers: h }),
        fetch("/api/tenant",    { headers: h }),
        fetch("/api/sellers",   { headers: h }),
        fetch("/api/services",  { headers: h }),
      ]);
      const qData  = await qRes.json();
      const pData  = await pRes.json();
      const cData  = await cRes.json();
      const tData  = await tRes.json();
      const sData  = await sRes.json();
      const svData = await svRes.json();
      setQuotes(Array.isArray(qData) ? qData : []);
      setProducts(Array.isArray(pData) ? pData : []);
      setCustomers(Array.isArray(cData) ? cData : []);
      setTenant(tData);
      if (tData?.card_fees) setCardFees(tData.card_fees);
      setSellers(Array.isArray(sData) ? sData.filter((s: any) => s.is_active !== false) : []);
      setServices(Array.isArray(svData) ? svData.filter((s: any) => s.is_active !== false) : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Computed totals
  const itemsSubtotal    = formItems.reduce((s, i) => s + i.total, 0);
  const servicesSubtotal = formServices.reduce((s, sv) => s + sv.price * sv.quantity, 0);
  const subtotal         = itemsSubtotal + servicesSubtotal;
  const discountAmt =
    discountType === "percent"
      ? (subtotal * discountValue) / 100
      : Math.min(discountValue, subtotal);
  const total = Math.max(0, subtotal - discountAmt);

  // ── Add product to cart
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
      if (existing) {
        return prev.map((i) =>
          i.product_id === p.id
            ? { ...i, quantity: i.quantity + 1, total: (i.quantity + 1) * i.unit_price }
            : i
        );
      }
      const price = Number(p.discount_price ?? p.price);
      return [...prev, { product_id: p.id, name: p.name, quantity: 1, unit_price: price, total: price }];
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
    setFormItems((prev) => [...prev, {
      product_id: measureProduct.id,
      name: measureProduct.name,
      quantity: 1,
      unit_price: measurePreview.total,
      total: measurePreview.total,
      dimensions_label: measurePreview.label,
    }]);
    setMeasureProduct(null);
    setMeasureHeight("");
    setMeasureWidth("");
  };

  const updateItemQty = (idx: number, qty: number) => {
    if (qty <= 0) {
      setFormItems((prev) => prev.filter((_, i) => i !== idx));
      return;
    }
    setFormItems((prev) =>
      prev.map((item, i) =>
        i === idx ? { ...item, quantity: qty, total: qty * item.unit_price } : item
      )
    );
  };

  const updateItemPrice = (idx: number, price: number) => {
    setFormItems((prev) =>
      prev.map((item, i) =>
        i === idx ? { ...item, unit_price: price, total: item.quantity * price } : item
      )
    );
  };

  // ── Service helpers
  const addService = (s: ServiceCatalog) => {
    setFormServices((prev) => {
      const existing = prev.find((fs) => fs.service_id === s.id);
      if (existing) {
        return prev.map((fs) => fs.service_id === s.id ? { ...fs, quantity: fs.quantity + 1 } : fs);
      }
      return [...prev, { service_id: s.id, name: s.name, price: Number(s.price), quantity: 1 }];
    });
    setServiceSearch("");
  };

  const updateServiceQty = (service_id: number, qty: number) => {
    if (qty <= 0) {
      setFormServices((prev) => prev.filter((s) => s.service_id !== service_id));
      return;
    }
    setFormServices((prev) => prev.map((s) => s.service_id === service_id ? { ...s, quantity: qty } : s));
  };

  const updateServicePrice = (service_id: number, price: number) => {
    setFormServices((prev) => prev.map((s) => s.service_id === service_id ? { ...s, price } : s));
  };

  // ── Save quote (create or edit) ──────────────────────────────────────────
  const handleSave = async () => {
    if (!formItems.length && !formServices.length) return;
    const cName = selectedCustomer?.name ?? manualCustomer.name;
    if (!cName.trim()) return;

    setSaving(true);
    try {
      const body = {
        customer_id: selectedCustomer?.id,
        customer_name: cName,
        customer_phone: selectedCustomer?.phone ?? manualCustomer.phone,
        customer_email: selectedCustomer?.email ?? manualCustomer.email,
        subtotal,
        discount_type: discountType,
        discount_value: discountValue,
        total_amount: total,
        validity_days: validityDays,
        notes,
        items: formItems.map((i) => ({
          product_id: i.product_id,
          name: i.name,
          quantity: i.quantity,
          unit_price: i.unit_price,
          total: i.total,
          dimensions_label: i.dimensions_label ?? null,
        })),
        services: formServices.map((s) => ({
          id: s.service_id,
          name: s.name,
          price: s.price,
          quantity: s.quantity,
        })),
      };
      if (editingQuoteId) {
        const res = await fetch(`/api/quotes/${editingQuoteId}`, { method: "PUT", headers: authHeader(), body: JSON.stringify(body) });
        if (res.ok) {
          const updated = await res.json();
          setSelectedQuoteDetail(updated);
        }
      } else {
        await fetch("/api/quotes", { method: "POST", headers: authHeader(), body: JSON.stringify(body) });
      }
      await fetchAll();
      resetForm();
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setShowForm(false);
    setEditingQuoteId(null);
    setFormItems([]);
    setFormServices([]);
    setSelectedCustomer(null);
    setManualCustomer({ name: "", phone: "", email: "" });
    setDiscountType("percent");
    setDiscountValue(0);
    setValidityDays(7);
    setNotes("");
    setProductSearch("");
    setServiceSearch("");
  };

  const openEditForm = (q: Quote) => {
    setEditingQuoteId(q.id);
    setFormItems(q.items.map((i) => ({ ...i })));
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
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Excluir este orçamento?")) return;
    await fetch(`/api/quotes/${id}`, { method: "DELETE", headers: authHeader() });
    fetchAll();
  };

  const refreshQuoteDetail = async (id: number) => {
    const res = await fetch(`/api/quotes/${id}`, { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } });
    if (res.ok) setSelectedQuoteDetail(await res.json());
    fetchAll();
  };

  const handleRecordDeposit = async () => {
    if (!selectedQuoteDetail) return;
    setSavingDeposit(true);
    try {
      const brand = (depositMethod === "credit" || depositMethod === "debit") ? `-${depositBrand}` : "";
      const inst = depositMethod === "credit" && depositInstallments > 1 ? `-${depositInstallments}x` : "";
      const pmString = `${depositMethod}${brand}${inst}`;
      const res = await fetch(`/api/quotes/${selectedQuoteDetail.id}/deposit`, {
        method: "POST",
        headers: authHeader(),
        body: JSON.stringify({ amount: Number(depositAmount) || 0, payment_method: pmString }),
      });
      if (res.ok) {
        setShowDepositModal(false);
        setDepositAmount("");
        setDepositMethod("money");
        setDepositInstallments(1);
        await refreshQuoteDetail(selectedQuoteDetail.id);
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error || "Falha ao registrar entrada");
      }
    } finally {
      setSavingDeposit(false);
    }
  };

  const handleConvert = async () => {
    if (!selectedQuote) return;
    setConverting(true);
    try {
      const pmString = buildConvertPmString(convertPayments) || "money";
      await fetch(`/api/quotes/${selectedQuote.id}/convert`, {
        method: "POST",
        headers: authHeader(),
        body: JSON.stringify({
          payment_method: pmString,
          seller_id: convertSellerId || undefined,
        }),
      });
      setShowConvertModal(false);
      setSelectedQuote(null);
      setConvertPayments([newConvertPayment()]);
      setConvertSellerId("");
      fetchAll();
    } finally {
      setConverting(false);
    }
  };

  const updateConvertPayment = (id: string, patch: Partial<ConvertPayment>) => {
    setConvertPayments((prev) => prev.map((p) => p.id === id ? { ...p, ...patch } : p));
  };
  const addConvertPayment = () => setConvertPayments((prev) => [...prev, newConvertPayment()]);
  const removeConvertPayment = (id: string) => setConvertPayments((prev) => prev.filter((p) => p.id !== id));

  const handleDownloadPDF = async (q: Quote) => {
    if (!tenant) return;
    await generateQuotePDF(q, tenant);
  };

  // ── Filter
  const filtered = quotes.filter((q) => {
    const matchStatus = statusFilter === "all" || q.status === statusFilter;
    const matchSearch =
      !searchTerm ||
      q.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      String(q.number).includes(searchTerm);
    return matchStatus && matchSearch;
  });

  const filteredProducts = products.filter(
    (p) =>
      p.is_active !== false &&
      p.name.toLowerCase().includes(productSearch.toLowerCase())
  );

  // ── Stats
  const stats = {
    total: quotes.length,
    open: quotes.filter((q) => q.status === "open").length,
    converted: quotes.filter((q) => q.status === "converted").length,
    totalValue: quotes.filter((q) => q.status === "open").reduce((s, q) => s + Number(q.total_amount), 0),
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Orçamentos"
        subtitle="Crie orçamentos profissionais e converta em vendas"
        action={
          <button
            onClick={() => setShowForm(true)}
            className="h-9 px-4 bg-blue-600 text-white rounded-lg flex items-center gap-2 text-[12px] font-bold hover:bg-blue-700 transition-all shadow-md shadow-blue-500/20"
          >
            <Plus size={15} /> Novo Orçamento
          </button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Total", value: stats.total, color: "text-slate-700", bg: "bg-slate-50" },
          { label: "Em Aberto", value: stats.open, color: "text-blue-600", bg: "bg-blue-50" },
          { label: "Convertidos", value: stats.converted, color: "text-emerald-600", bg: "bg-emerald-50" },
          { label: "Valor em Aberto", value: fmt(stats.totalValue), color: "text-amber-600", bg: "bg-amber-50" },
        ].map((s) => (
          <div key={s.label} className={cn("rounded-xl p-4 border border-white/60 shadow-sm", s.bg)}>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{s.label}</p>
            <p className={cn("text-xl font-black mt-0.5", s.color)}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Search & filter */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por cliente ou número..."
            className="w-full pl-9 pr-3 h-9 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        {["all", "open", "converted", "cancelled"].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={cn(
              "h-9 px-3 rounded-lg text-[11px] font-bold border transition-all",
              statusFilter === s
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
            )}
          >
            {{ all: "Todos", open: "Abertos", converted: "Convertidos", cancelled: "Cancelados" }[s]}
          </button>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-16 text-slate-400 text-sm">Carregando…</div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-slate-400 gap-3">
          <FileText size={36} strokeWidth={1} />
          <p className="text-sm font-medium">Nenhum orçamento encontrado</p>
          <button
            onClick={() => setShowForm(true)}
            className="mt-1 h-8 px-4 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700"
          >
            Criar primeiro orçamento
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-wider text-slate-500">Nº</th>
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-wider text-slate-500">Cliente</th>
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-wider text-slate-500 hidden md:table-cell">Data</th>
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-wider text-slate-500 hidden lg:table-cell">Validade</th>
                <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-wider text-slate-500">Total</th>
                <th className="px-4 py-3 text-center text-[10px] font-black uppercase tracking-wider text-slate-500">Status</th>
                <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-wider text-slate-500">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((q) => {
                const st = statusLabel(q.status);
                return (
                  <tr key={q.id} onClick={() => setSelectedQuoteDetail(q)} className="hover:bg-slate-50 transition-colors cursor-pointer">
                    <td className="px-4 py-3 font-mono text-slate-500 text-xs">
                      #{String(q.number).padStart(4, "0")}
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-800">{q.customer_name}</td>
                    <td className="px-4 py-3 text-slate-500 hidden md:table-cell">
                      {new Date(q.created_at).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="px-4 py-3 text-slate-500 hidden lg:table-cell">
                      {q.validity_days}d
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-slate-800">
                      {fmt(Number(q.total_amount))}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold", st.color)}>
                        {st.icon} {st.label}
                      </span>
                    </td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleDownloadPDF(q)}
                          title="Baixar PDF"
                          className="p-1.5 hover:bg-blue-50 text-blue-500 rounded-lg transition-colors"
                        >
                          <Download size={14} />
                        </button>
                        {q.status === "open" && (
                          <button
                            onClick={() => {
                              setSelectedQuote(q);
                              setConvertPayments([newConvertPayment()]);
                              setConvertSellerId("");
                              setShowConvertModal(true);
                            }}
                            title="Converter em venda"
                            className="p-1.5 hover:bg-emerald-50 text-emerald-500 rounded-lg transition-colors"
                          >
                            <ArrowRight size={14} />
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(q.id)}
                          title="Excluir"
                          className="p-1.5 hover:bg-red-50 text-red-400 rounded-lg transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── New Quote Drawer ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showForm && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={resetForm}
              className="fixed inset-0 bg-slate-900/50 z-40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 26, stiffness: 200 }}
              className="fixed inset-y-0 right-0 w-full max-w-xl bg-white z-50 shadow-2xl flex flex-col"
            >
              {/* Drawer header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 shrink-0">
                <div>
                  <h2 className="font-black text-slate-900 text-[15px]">
                    {editingQuoteId ? `Editar Orçamento #${String(quotes.find((q) => q.id === editingQuoteId)?.number ?? "").padStart(4, "0")}` : "Novo Orçamento"}
                  </h2>
                  <p className="text-[11px] text-slate-500">Selecione produtos e preencha os dados do cliente</p>
                </div>
                <button onClick={resetForm} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500">
                  <X size={18} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-5 space-y-5">
                {/* Customer */}
                <section>
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
                        value={selectedCustomer ? String(selectedCustomer.id) : manualCustomer.name}
                        onChange={(v) => {
                          if (!v) {
                            setSelectedCustomer(null);
                            setManualCustomer((m) => ({ ...m, name: "" }));
                            return;
                          }
                          const cust = customers.find((c) => String(c.id) === v);
                          if (cust) {
                            setSelectedCustomer(cust);
                          } else {
                            setSelectedCustomer(null);
                            setManualCustomer((m) => ({ ...m, name: v }));
                          }
                        }}
                        options={customers.map((c) => ({ value: String(c.id), label: c.name, description: c.phone }))}
                        onAddNew={(q) => {
                          setNcName(q); setNcPhone(""); setNcDoc(""); setNcEmail("");
                          setShowNewCustomer(true);
                        }}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => { setNcName(""); setNcPhone(""); setNcDoc(""); setNcEmail(""); setShowNewCustomer(true); }}
                      className="h-9 w-9 rounded-lg bg-blue-50 border border-blue-200 text-blue-600 hover:bg-blue-100 flex items-center justify-center shrink-0 transition-colors"
                      title="Cadastrar novo cliente"
                    >
                      <UserPlus size={15} />
                    </button>
                  </div>
                  {!selectedCustomer && (
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <input
                        value={manualCustomer.phone}
                        onChange={(e) => setManualCustomer((m) => ({ ...m, phone: e.target.value }))}
                        placeholder="Telefone"
                        className="h-9 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <input
                        value={manualCustomer.email}
                        onChange={(e) => setManualCustomer((m) => ({ ...m, email: e.target.value }))}
                        placeholder="E-mail"
                        className="h-9 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  )}
                </section>

                {/* Product search */}
                <section>
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
                          <button
                            key={p.id}
                            onClick={() => addProduct(p)}
                            className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50 flex items-center justify-between"
                          >
                            <div>
                              <span className="font-semibold">{p.name}</span>
                              <span className="ml-2 text-xs text-slate-400">Estoque: {p.stock_quantity}</span>
                            </div>
                            <span className="text-blue-600 font-bold">
                              {fmt(Number(p.discount_price ?? p.price))}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </section>

                {/* Items list */}
                {formItems.length > 0 && (
                  <section>
                    <h3 className="text-[11px] font-black uppercase tracking-wider text-slate-500 mb-2">
                      Produtos
                    </h3>
                    <div className="space-y-2">
                      {formItems.map((item, idx) => (
                        <div key={idx} className="flex flex-wrap items-center gap-2 bg-slate-50 rounded-lg px-3 py-2">
                          <div className="flex-1 min-w-[120px]">
                            <p className="text-sm font-medium text-slate-700 truncate">{item.name}</p>
                            {item.dimensions_label && (
                              <p className="text-[10px] text-blue-500 font-mono truncate">{item.dimensions_label}</p>
                            )}
                          </div>
                          <div className="shrink-0">
                            <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">
                              Qtd.
                            </label>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => updateItemQty(idx, item.quantity - 1)}
                                className="w-6 h-6 rounded-md bg-white border border-slate-200 text-slate-600 font-bold flex items-center justify-center hover:bg-red-50 hover:text-red-500 shrink-0"
                              >−</button>
                              <input
                                type="number"
                                min={0}
                                step="any"
                                value={item.quantity}
                                onChange={(e) => updateItemQty(idx, Number(e.target.value))}
                                className="w-12 h-7 px-1 rounded-md border border-slate-200 text-sm text-center font-bold focus:outline-none focus:ring-1 focus:ring-blue-400"
                              />
                              <button
                                onClick={() => updateItemQty(idx, item.quantity + 1)}
                                className="w-6 h-6 rounded-md bg-white border border-slate-200 text-slate-600 font-bold flex items-center justify-center hover:bg-emerald-50 hover:text-emerald-500 shrink-0"
                              >+</button>
                            </div>
                          </div>
                          <div className="shrink-0">
                            <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">
                              Preço unitário
                            </label>
                            <div className="relative">
                              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-[10px] font-bold pointer-events-none select-none">R$</span>
                              <input
                                inputMode="numeric"
                                placeholder="0,00"
                                value={centsToMasked(item.unit_price)}
                                onChange={(e) => updateItemPrice(idx, parseMaskedPrice(applyMoneyMask(e.target.value)))}
                                className="w-28 h-7 pl-7 pr-2 rounded-md border border-slate-200 text-sm text-right font-mono focus:outline-none focus:ring-1 focus:ring-blue-400"
                              />
                            </div>
                          </div>
                          <span className="w-20 text-right text-sm font-bold text-slate-800 shrink-0">
                            {fmt(item.total)}
                          </span>
                          <button
                            onClick={() => setFormItems((prev) => prev.filter((_, i) => i !== idx))}
                            className="text-slate-400 hover:text-red-500"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* Service search */}
                {services.length > 0 && (
                  <section>
                    <h3 className="text-[11px] font-black uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5">
                      <Wrench size={12} /> Adicionar Serviços
                    </h3>
                    <div className="relative">
                      <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        value={serviceSearch}
                        onChange={(e) => setServiceSearch(e.target.value)}
                        placeholder="Buscar serviço..."
                        className="w-full pl-9 h-9 pr-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    {serviceSearch && (
                      <div className="mt-1 border border-slate-200 rounded-lg bg-white shadow-lg max-h-36 overflow-y-auto">
                        {services.filter((s) => s.name.toLowerCase().includes(serviceSearch.toLowerCase())).length === 0 ? (
                          <p className="px-3 py-2 text-sm text-slate-400">Nenhum serviço encontrado</p>
                        ) : (
                          services
                            .filter((s) => s.name.toLowerCase().includes(serviceSearch.toLowerCase()))
                            .slice(0, 8)
                            .map((s) => (
                              <button
                                key={s.id}
                                onClick={() => addService(s)}
                                className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50 flex items-center justify-between"
                              >
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
                  </section>
                )}

                {/* Services list */}
                {formServices.length > 0 && (
                  <section>
                    <h3 className="text-[11px] font-black uppercase tracking-wider text-slate-500 mb-2">
                      Serviços
                    </h3>
                    <div className="space-y-2">
                      {formServices.map((svc) => (
                        <div key={svc.service_id} className="flex flex-wrap items-center gap-2 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
                          <Wrench size={13} className="text-blue-400 shrink-0" />
                          <span className="flex-1 min-w-[100px] text-sm font-medium text-slate-700 truncate">{svc.name}</span>
                          <div className="shrink-0">
                            <label className="block text-[9px] font-bold uppercase tracking-wider text-blue-400 mb-0.5">
                              Qtd.
                            </label>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => updateServiceQty(svc.service_id, svc.quantity - 1)}
                                className="w-6 h-6 rounded-md bg-white border border-blue-200 text-slate-600 font-bold flex items-center justify-center hover:bg-red-50 hover:text-red-500 shrink-0"
                              >−</button>
                              <input
                                type="number"
                                min={0}
                                step="any"
                                value={svc.quantity}
                                onChange={(e) => updateServiceQty(svc.service_id, Number(e.target.value))}
                                className="w-12 h-7 px-1 rounded-md border border-blue-200 text-sm text-center font-bold focus:outline-none focus:ring-1 focus:ring-blue-400"
                              />
                              <button
                                onClick={() => updateServiceQty(svc.service_id, svc.quantity + 1)}
                                className="w-6 h-6 rounded-md bg-white border border-blue-200 text-slate-600 font-bold flex items-center justify-center hover:bg-emerald-50 hover:text-emerald-500 shrink-0"
                              >+</button>
                            </div>
                          </div>
                          <div className="shrink-0">
                            <label className="block text-[9px] font-bold uppercase tracking-wider text-blue-400 mb-0.5">
                              Preço unitário
                            </label>
                            <div className="relative">
                              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-[10px] font-bold pointer-events-none select-none">R$</span>
                              <input
                                inputMode="numeric"
                                placeholder="0,00"
                                value={centsToMasked(svc.price)}
                                onChange={(e) => updateServicePrice(svc.service_id, parseMaskedPrice(applyMoneyMask(e.target.value)))}
                                className="w-28 h-7 pl-7 pr-2 rounded-md border border-blue-200 text-sm text-right font-mono focus:outline-none focus:ring-1 focus:ring-blue-400"
                              />
                            </div>
                          </div>
                          <span className="w-20 text-right text-sm font-bold text-blue-700 shrink-0">
                            {fmt(svc.price * svc.quantity)}
                          </span>
                          <button
                            onClick={() => setFormServices((prev) => prev.filter((s) => s.service_id !== svc.service_id))}
                            className="text-slate-400 hover:text-red-500"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* Discount + Validity */}
                <section className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                      Desconto
                    </label>
                    <div className="flex gap-1">
                      <button
                        onClick={() => setDiscountType("percent")}
                        className={cn("h-9 w-9 rounded-lg border flex items-center justify-center transition-all",
                          discountType === "percent" ? "bg-blue-600 text-white border-blue-600" : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50")}
                      >
                        <Percent size={14} />
                      </button>
                      <button
                        onClick={() => setDiscountType("fixed")}
                        className={cn("h-9 w-9 rounded-lg border flex items-center justify-center transition-all",
                          discountType === "fixed" ? "bg-blue-600 text-white border-blue-600" : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50")}
                      >
                        <DollarSign size={14} />
                      </button>
                      <input
                        type="number"
                        min={0}
                        value={discountValue || ""}
                        onChange={(e) => setDiscountValue(Number(e.target.value))}
                        placeholder={discountType === "percent" ? "%" : "R$"}
                        className="flex-1 h-9 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                      Validade (dias)
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={validityDays}
                      onChange={(e) => setValidityDays(Number(e.target.value))}
                      className="w-full h-9 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </section>

                {/* Notes */}
                <section>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                    Observações / Condições de Pagamento
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    placeholder="Ex: Pagamento à vista com desconto. Entrega em 5 dias úteis."
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                </section>
              </div>

              {/* Drawer footer */}
              <div className="border-t border-slate-200 px-5 py-4 shrink-0 bg-slate-50">
                <div className="flex items-end justify-between mb-3">
                  <div className="space-y-0.5">
                    {itemsSubtotal > 0 && servicesSubtotal > 0 && (
                      <>
                        <div className="flex items-center justify-between gap-8 text-xs text-slate-400">
                          <span>Produtos</span>
                          <span>{fmt(itemsSubtotal)}</span>
                        </div>
                        <div className="flex items-center justify-between gap-8 text-xs text-blue-500">
                          <span>Serviços</span>
                          <span>{fmt(servicesSubtotal)}</span>
                        </div>
                      </>
                    )}
                    <div className="flex items-center justify-between gap-8 text-sm text-slate-500">
                      <span>Subtotal</span>
                      <span>{fmt(subtotal)}</span>
                    </div>
                    {discountAmt > 0 && (
                      <div className="flex items-center justify-between gap-8 text-sm text-red-500">
                        <span>Desconto</span>
                        <span>- {fmt(discountAmt)}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between gap-8 text-base font-black text-slate-900">
                      <span>Total</span>
                      <span>{fmt(total)}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={resetForm}
                      className="h-9 px-4 rounded-lg border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-100"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={saving || (!formItems.length && !formServices.length) || !(selectedCustomer?.name ?? manualCustomer.name)}
                      className="h-9 px-5 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                      {saving ? "Salvando…" : editingQuoteId ? "Salvar Alterações" : "Salvar Orçamento"}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Detail Drawer ─────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {selectedQuoteDetail && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setSelectedQuoteDetail(null)}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[300]"
            />
            <motion.div
              initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              className="fixed right-0 top-0 h-full w-full max-w-2xl bg-white shadow-2xl z-[301] flex flex-col overflow-hidden"
            >
              {(() => {
                const q = selectedQuoteDetail;
                const st = statusLabel(q.status);
                const depositAmt = Number(q.deposit_amount ?? 0);
                const remaining = Math.max(0, Number(q.total_amount) - depositAmt);
                return (
                  <>
                    <div className="shrink-0 flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
                      <div>
                        <p className="text-[9px] font-black uppercase tracking-widest text-blue-500">Orçamento</p>
                        <h2 className="text-[18px] font-black text-slate-800">#{String(q.number).padStart(4, "0")} — {q.customer_name}</h2>
                      </div>
                      <button onClick={() => setSelectedQuoteDetail(null)} className="w-9 h-9 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 flex items-center justify-center">
                        <X size={16} className="text-slate-500" />
                      </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 space-y-6">
                      {/* Status */}
                      <div className="flex items-center justify-between">
                        <span className={cn("inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider", st.color)}>
                          {st.icon} {st.label}
                        </span>
                        {q.converted_order_id && (
                          <span className="text-[10px] font-bold text-emerald-600">Convertido — Pedido #{q.converted_order_id}</span>
                        )}
                      </div>

                      {/* Cliente */}
                      <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4">
                        <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">Cliente</p>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[12px]">
                          <p><span className="text-slate-400">Nome:</span> <span className="font-semibold">{q.customer_name}</span></p>
                          {q.customer_phone && <p><span className="text-slate-400">Telefone:</span> <span className="font-semibold">{q.customer_phone}</span></p>}
                          {q.customer_email && <p><span className="text-slate-400">E-mail:</span> <span className="font-semibold">{q.customer_email}</span></p>}
                          <p><span className="text-slate-400">Validade:</span> <span className="font-semibold">{q.validity_days} dias</span></p>
                        </div>
                      </div>

                      {/* Itens/Serviços */}
                      {(q.items.length > 0 || q.services.length > 0) && (
                        <div>
                          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">Itens</p>
                          <div className="space-y-1.5">
                            {q.items.map((item, idx) => (
                              <div key={`i-${idx}`} className="flex items-center justify-between bg-slate-50 rounded-xl px-3 py-2 border border-slate-200">
                                <div className="min-w-0">
                                  <p className="text-[12px] font-semibold text-slate-700 truncate">{item.name}</p>
                                  {item.dimensions_label ? (
                                    <p className="text-[10px] text-blue-500 font-mono">{item.dimensions_label}</p>
                                  ) : (
                                    <p className="text-[10px] text-slate-400">{item.quantity} × {fmt(item.unit_price)}</p>
                                  )}
                                </div>
                                <span className="text-[12px] font-mono font-bold text-slate-700">{fmt(item.total)}</span>
                              </div>
                            ))}
                            {q.services.map((s) => (
                              <div key={`s-${s.id}`} className="flex items-center justify-between bg-blue-50 border border-blue-100 rounded-xl px-3 py-2">
                                <div className="min-w-0 flex items-center gap-1.5">
                                  <Wrench size={12} className="text-blue-400 shrink-0" />
                                  <div className="min-w-0">
                                    <p className="text-[12px] font-semibold text-slate-700 truncate">{s.name}</p>
                                    <p className="text-[10px] text-slate-400">{s.quantity} × {fmt(s.unit_price)}</p>
                                  </div>
                                </div>
                                <span className="text-[12px] font-mono font-bold text-blue-700">{fmt(s.total)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Totais / Entrada / Resta */}
                      <div className="bg-slate-900 rounded-2xl p-4 space-y-1.5">
                        <div className="flex justify-between text-[10px] font-bold uppercase text-slate-400">
                          <span>Subtotal</span>
                          <span className="font-mono text-slate-200">{fmt(Number(q.subtotal))}</span>
                        </div>
                        {Number(q.discount_value) > 0 && (
                          <div className="flex justify-between text-[10px] font-bold uppercase text-slate-400">
                            <span>Desconto</span>
                            <span className="font-mono text-rose-400">
                              − {fmt(q.discount_type === "percent" ? (Number(q.subtotal) * Number(q.discount_value)) / 100 : Number(q.discount_value))}
                            </span>
                          </div>
                        )}
                        <div className="flex justify-between text-[13px] font-black uppercase text-white pt-1.5 border-t border-slate-700">
                          <span>Total</span>
                          <span className="font-mono">{fmt(Number(q.total_amount))}</span>
                        </div>
                        {depositAmt > 0 && (
                          <>
                            <div className="flex justify-between text-[10px] font-bold uppercase text-cyan-400 pt-1.5 border-t border-slate-700">
                              <span>Entrada</span>
                              <span className="font-mono">{fmt(depositAmt)}</span>
                            </div>
                            <div className="flex justify-between text-[11px] font-black uppercase text-amber-400">
                              <span>Resta</span>
                              <span className="font-mono">{fmt(remaining)}</span>
                            </div>
                          </>
                        )}
                      </div>

                      {q.notes && (
                        <div>
                          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">Observações</p>
                          <p className="text-[12px] text-slate-600 bg-slate-50 rounded-xl p-3 border border-slate-200">{q.notes}</p>
                        </div>
                      )}

                      {/* Timeline */}
                      {q.actions && q.actions.length > 0 && (
                        <div>
                          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">Histórico</p>
                          <div className="space-y-2">
                            {q.actions.map((a) => (
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

                    {/* Footer actions */}
                    <div className="shrink-0 px-6 pb-6 pt-3 border-t border-slate-100 space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <button onClick={() => handleDownloadPDF(q)}
                          className="h-11 bg-slate-100 hover:bg-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 text-slate-700 transition-all">
                          <Download size={14} /> Baixar PDF
                        </button>
                        {q.status === "open" && (
                          <button onClick={() => { setSelectedQuoteDetail(null); openEditForm(q); }}
                            className="h-11 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 text-blue-600 transition-all">
                            <Edit2 size={14} /> Editar
                          </button>
                        )}
                      </div>
                      {q.status === "open" && (
                        <div className="grid grid-cols-2 gap-2">
                          <button onClick={() => { setDepositAmount(""); setShowDepositModal(true); }}
                            className="h-11 bg-cyan-50 hover:bg-cyan-100 border border-cyan-200 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 text-cyan-700 transition-all">
                            <Wallet size={14} /> Registrar Entrada
                          </button>
                          <button onClick={() => {
                            setSelectedQuote(q);
                            setConvertPayments([newConvertPayment()]);
                            setConvertSellerId("");
                            setShowConvertModal(true);
                          }}
                            className="h-11 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all">
                            <ArrowRight size={14} /> Converter em Venda
                          </button>
                        </div>
                      )}
                    </div>
                  </>
                );
              })()}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Medida (m²/linear) Modal ─────────────────────────────────────────── */}
      <AnimatePresence>
        {measureProduct && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setMeasureProduct(null)}
              className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-[400]"
            />
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12, scale: 0.98 }}
              transition={{ type: "spring", damping: 32, stiffness: 300 }}
              className="fixed inset-x-4 bottom-4 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 z-[401] bg-white flex flex-col overflow-hidden rounded-3xl"
              style={{ width: "min(420px, calc(100vw - 32px))" }}
            >
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
                      <input type="number" min="0" step="0.01" autoFocus value={measureHeight}
                        onChange={(e) => setMeasureHeight(e.target.value)}
                        placeholder="0,00"
                        className="w-full h-11 px-3 rounded-xl border border-slate-200 text-sm font-mono font-bold text-center focus:outline-none focus:border-blue-400" />
                    </div>
                    <div>
                      <label className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1.5 block">Largura (m)</label>
                      <input type="number" min="0" step="0.01" value={measureWidth}
                        onChange={(e) => setMeasureWidth(e.target.value)}
                        placeholder="0,00"
                        className="w-full h-11 px-3 rounded-xl border border-slate-200 text-sm font-mono font-bold text-center focus:outline-none focus:border-blue-400" />
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1.5 block">Comprimento (m)</label>
                    <input type="number" min="0" step="0.01" autoFocus value={measureHeight}
                      onChange={(e) => setMeasureHeight(e.target.value)}
                      placeholder="0,00"
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
                      <span>Total</span>
                      <span className="font-mono">R$ {measurePreview.total.toFixed(2)}</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="shrink-0 px-6 pb-6 pt-1 flex gap-2 border-t border-slate-100">
                <button onClick={() => setMeasureProduct(null)} className="flex-1 h-11 rounded-xl border border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50 transition-colors">
                  Cancelar
                </button>
                <button onClick={addMeasuredProduct}
                  disabled={!measurePreview || measurePreview.rawQuantity <= 0}
                  className="flex-1 h-11 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                  <Plus size={14} /> Adicionar
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Registrar Entrada Modal ───────────────────────────────────────────── */}
      <AnimatePresence>
        {showDepositModal && selectedQuoteDetail && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => !savingDeposit && setShowDepositModal(false)}
              className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-[400]"
            />
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12, scale: 0.98 }}
              transition={{ type: "spring", damping: 32, stiffness: 300 }}
              className="fixed inset-x-4 bottom-4 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 z-[401] bg-white flex flex-col overflow-hidden rounded-3xl"
              style={{ width: "min(420px, calc(100vw - 32px))" }}
            >
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
                    <input type="number" min="0" step="0.01" value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)}
                      placeholder="0,00"
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
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Novo Cliente Modal ────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showNewCustomer && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowNewCustomer(false)}
              className="fixed inset-0 bg-slate-900/60 z-[400] backdrop-blur-sm"
            />
            <motion.div
              initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 26, stiffness: 200 }}
              className="fixed inset-y-0 right-0 w-full max-w-sm bg-white z-[410] shadow-2xl flex flex-col"
            >
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
                    <input value={ncPhone} onChange={(e) => setNcPhone(maskPhone(e.target.value))} inputMode="numeric"
                      placeholder="(11) 99999-9999"
                      className="w-full h-9 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">CPF/CNPJ</label>
                    <input value={ncDoc} onChange={(e) => setNcDoc(maskDoc(e.target.value))} inputMode="numeric"
                      placeholder="000.000.000-00"
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
                <button onClick={() => setShowNewCustomer(false)}
                  className="flex-1 h-9 rounded-lg border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-100">
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
                        body: JSON.stringify({
                          name: ncName,
                          phone: ncPhone.replace(/\D/g, "") || null,
                          document: ncDoc.replace(/\D/g, "") || null,
                          email: ncEmail || null,
                        }),
                      });
                      const newCust = await res.json();
                      const cRes = await fetch("/api/customers", { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } });
                      const cData = await cRes.json();
                      setCustomers(Array.isArray(cData) ? cData : []);
                      setSelectedCustomer(newCust);
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
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Convert to Order Modal ────────────────────────────────────────────── */}
      <AnimatePresence>
        {showConvertModal && selectedQuote && (() => {
          const quoteTotal = Number(selectedQuote.total_amount);
          const depositAlready = Number(selectedQuote.deposit_amount ?? 0);
          const amountDue  = Math.max(0, quoteTotal - depositAlready);
          const paidTotal  = convertPayments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
          const remaining  = Math.max(0, amountDue - paidTotal);

          return (
            <>
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={() => !converting && setShowConvertModal(false)}
                className="fixed inset-0 bg-slate-900/60 z-40 backdrop-blur-sm"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto"
              >
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md my-auto">
                  {/* header */}
                  <div className="px-6 pt-6 pb-4 border-b border-slate-100">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-black text-slate-900 text-base">Converter em Venda</h3>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Orç. #{String(selectedQuote.number).padStart(4, "0")} · {selectedQuote.customer_name}
                        </p>
                      </div>
                      <button onClick={() => setShowConvertModal(false)} className="text-slate-300 hover:text-slate-600 transition-colors">
                        <X size={18} />
                      </button>
                    </div>
                    {/* total badge */}
                    <div className="mt-3 bg-slate-900 rounded-xl px-4 py-2.5 flex items-center justify-between">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total do Orçamento</span>
                      <span className="text-lg font-mono font-black text-white">{fmt(quoteTotal)}</span>
                    </div>
                  </div>

                  <div className="px-6 py-4 space-y-4 max-h-[65vh] overflow-y-auto">

                    {/* ── Vendedor ──────────────────────────── */}
                    {sellers.length > 0 && (
                      <div>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Vendedor</p>
                        <div className="relative">
                          <User size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                          <select
                            value={convertSellerId}
                            onChange={(e) => setConvertSellerId(e.target.value === "" ? "" : Number(e.target.value))}
                            className="w-full pl-8 pr-8 h-10 rounded-xl border border-slate-200 text-[11px] font-bold appearance-none focus:outline-none focus:border-blue-400 bg-white"
                          >
                            <option value="">Sem vendedor</option>
                            {sellers.map((s) => (
                              <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                          </select>
                          <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        </div>
                      </div>
                    )}

                    {/* ── Formas de Pagamento ───────────────── */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Formas de Pagamento</p>
                        <button
                          onClick={addConvertPayment}
                          className="flex items-center gap-1 h-6 px-2 bg-blue-50 border border-blue-200 rounded-lg text-[9px] font-black text-blue-600 uppercase tracking-widest hover:bg-blue-100 transition-all"
                        >
                          <PlusCircle size={10} /> Adicionar
                        </button>
                      </div>

                      <div className="space-y-2.5">
                        {convertPayments.map((p, idx) => {
                          const feeRate = p.method === "credit" ? (cardFees[p.cardBrand]?.[p.installments - 1] ?? 0) : 0;
                          const pAmt    = Number(p.amount) || 0;
                          const pFee    = feeRate > 0 && pAmt > 0 ? pAmt * (feeRate / 100) : 0;
                          return (
                            <div key={p.id} className="bg-slate-50 rounded-2xl border border-slate-200 p-3 space-y-2.5">
                              {/* method buttons */}
                              <div className="flex items-center gap-2">
                                {convertPayments.length > 1 && (
                                  <span className="w-5 h-5 bg-slate-200 rounded-full flex items-center justify-center text-[9px] font-black text-slate-600 shrink-0">{idx + 1}</span>
                                )}
                                <div className="grid grid-cols-4 gap-1.5 flex-1">
                                  {(["money", "debit", "credit", "pix"] as ConvertMethod[]).map((key) => (
                                    <button key={key}
                                      onClick={() => updateConvertPayment(p.id, { method: key, installments: 1 })}
                                      className={cn(
                                        "h-9 rounded-xl border text-[9px] font-black uppercase tracking-widest transition-all flex flex-col items-center justify-center gap-0.5",
                                        p.method === key
                                          ? key === "credit" ? "bg-emerald-600 border-emerald-500 text-white" : "bg-blue-600 border-blue-500 text-white"
                                          : "bg-white border-slate-200 text-slate-500 hover:border-slate-400"
                                      )}>
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

                              {/* bandeira */}
                              {(p.method === "debit" || p.method === "credit") && (
                                <div className="grid grid-cols-3 gap-1">
                                  {CONVERT_CARD_BRANDS.map(({ key, label, color }) => (
                                    <button key={key}
                                      onClick={() => updateConvertPayment(p.id, { cardBrand: key })}
                                      className={cn(
                                        "h-7 rounded-lg border text-[8px] font-black uppercase tracking-widest transition-all",
                                        p.cardBrand === key ? "text-white border-transparent" : "bg-white border-slate-200 text-slate-500 hover:border-slate-400"
                                      )}
                                      style={p.cardBrand === key ? { backgroundColor: color } : {}}>
                                      {label}
                                    </button>
                                  ))}
                                </div>
                              )}

                              {/* parcelamento */}
                              {p.method === "credit" && (
                                <div className="grid grid-cols-4 gap-1">
                                  {[1, 2, 3, 4, 5, 6, 10, 12].map((n) => {
                                    const rate      = cardFees[p.cardBrand]?.[n - 1] ?? 0;
                                    const totalWFee = pAmt > 0 && rate > 0 ? pAmt * (1 + rate / 100) : pAmt;
                                    const perInst   = n > 1 && pAmt > 0 ? totalWFee / n : 0;
                                    const isActive  = p.installments === n;
                                    return (
                                      <button key={n}
                                        onClick={() => updateConvertPayment(p.id, { installments: n })}
                                        className={cn(
                                          "rounded-lg border transition-all flex flex-col items-center justify-center py-1.5 px-1 gap-0.5",
                                          isActive ? "bg-emerald-600 border-emerald-500 text-white" : "bg-white border-slate-200 text-slate-500 hover:border-slate-400"
                                        )}>
                                        <span className="text-[8px] font-black uppercase">{n === 1 ? "Vista" : `${n}×`}</span>
                                        {rate > 0 && (
                                          <span className={cn("text-[7px] font-bold", isActive ? "text-emerald-200" : "text-amber-500")}>+{rate}%</span>
                                        )}
                                        {pAmt > 0 && rate > 0 && (
                                          <span className={cn("text-[7px] font-mono font-black", isActive ? "text-emerald-100" : "text-slate-600")}>R${totalWFee.toFixed(2)}</span>
                                        )}
                                        {perInst > 0 && (
                                          <span className={cn("text-[7px] font-mono", isActive ? "text-emerald-200" : "text-slate-400")}>{n}×R${perInst.toFixed(2)}</span>
                                        )}
                                      </button>
                                    );
                                  })}
                                </div>
                              )}

                              {/* valor + taxa */}
                              <div className="flex gap-2">
                                <div className="relative flex-1">
                                  <Banknote className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
                                  <input type="number" min="0" step="0.01"
                                    placeholder={idx === 0 && remaining > 0 ? `R$ ${remaining.toFixed(2)}` : "Valor (R$)"}
                                    className="w-full pl-9 pr-3 h-10 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 text-[11px] font-medium text-slate-800 placeholder:text-slate-400 transition-all [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                                    value={p.amount}
                                    onChange={(e) => updateConvertPayment(p.id, { amount: e.target.value })}
                                  />
                                </div>
                                {pFee > 0.005 && (
                                  <div className="flex flex-col items-end gap-0.5 bg-amber-50 border border-amber-200 rounded-xl px-3 py-1.5 shrink-0">
                                    <span className="text-[8px] font-black text-amber-600 uppercase">Taxa {feeRate}%</span>
                                    <span className="text-[10px] font-mono font-black text-amber-700">− R$ {pFee.toFixed(2)}</span>
                                    {p.installments > 1 && pAmt > 0 && (
                                      <span className="text-[7px] font-bold text-amber-500">
                                        {p.installments}× R$ {((pAmt * (1 + feeRate / 100)) / p.installments).toFixed(2)}/parc
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* ── Resumo ────────────────────────────── */}
                    <div className="bg-slate-900 rounded-2xl p-4 space-y-2">
                      <div className="flex justify-between text-[10px] font-bold uppercase text-slate-500">
                        <span>Total orçamento</span>
                        <span className="font-mono">R$ {quoteTotal.toFixed(2)}</span>
                      </div>
                      {depositAlready > 0 && (
                        <div className="flex justify-between text-[10px] font-bold uppercase text-cyan-400">
                          <span>Entrada já paga</span>
                          <span className="font-mono">− R$ {depositAlready.toFixed(2)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-[10px] font-bold uppercase text-slate-400">
                        <span>Pago agora</span>
                        <span className="font-mono text-emerald-400">R$ {paidTotal.toFixed(2)}</span>
                      </div>
                      {remaining > 0.005 && (
                        <div className="flex justify-between text-[10px] font-black uppercase text-rose-400 pt-1 border-t border-slate-700">
                          <span>Restante</span>
                          <span className="font-mono">R$ {remaining.toFixed(2)}</span>
                        </div>
                      )}
                      {remaining <= 0.005 && paidTotal > 0 && (
                        <div className="flex justify-between text-[10px] font-black uppercase text-emerald-400 pt-1 border-t border-slate-700">
                          <span>Pagamento OK</span>
                          <span className="font-mono">✓</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* footer */}
                  <div className="px-6 pb-6 pt-3 flex gap-2 border-t border-slate-100">
                    <button
                      onClick={() => setShowConvertModal(false)}
                      className="flex-1 h-11 rounded-xl border border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50 transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleConvert}
                      disabled={converting || paidTotal <= 0}
                      className="flex-1 h-11 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {converting ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                      Confirmar Venda
                    </button>
                  </div>
                </div>
              </motion.div>
            </>
          );
        })()}
      </AnimatePresence>
    </div>
  );
}
