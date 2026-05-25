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
  Percent,
  DollarSign,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../../lib/utils";
import PageHeader from "../../components/layout/PageHeader";

// ─── Types ────────────────────────────────────────────────────────────────────

interface QuoteItem {
  id?: number;
  product_id?: number;
  name: string;
  quantity: number;
  unit_price: number;
  total: number;
}

interface Quote {
  id: number;
  number: number;
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
  created_at: string;
  items: QuoteItem[];
}

interface Product {
  id: number;
  name: string;
  price: number;
  discount_price?: number;
  stock_quantity: number;
  image_url?: string;
  is_active?: boolean;
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const authHeader = () => ({
  Authorization: `Bearer ${localStorage.getItem("token")}`,
  "Content-Type": "application/json",
});

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

async function generateQuotePDF(quote: Quote, tenant: Tenant) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  const pageW = 210;
  const pageH = 297;
  const margin = 18;
  const contentW = pageW - margin * 2;

  const primary = tenant.primary_color ?? "#1e3a5f";
  // Parse hex to r,g,b
  const hexToRgb = (hex: string) => {
    const h = hex.replace("#", "");
    return {
      r: parseInt(h.substring(0, 2), 16),
      g: parseInt(h.substring(2, 4), 16),
      b: parseInt(h.substring(4, 6), 16),
    };
  };
  const pc = hexToRgb(primary);

  // ── Header background
  doc.setFillColor(pc.r, pc.g, pc.b);
  doc.rect(0, 0, pageW, 42, "F");

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

      doc.addImage(dataUrl, "PNG", margin, 9, 22, 22);
      logoLoaded = true;
    } catch {
      // ignora se não conseguir carregar o logo
    }
  }

  // ── Company name + info (header)
  const textX = logoLoaded ? margin + 26 : margin;
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(15);
  doc.setFont("helvetica", "bold");
  doc.text(tenant.name, textX, 18);

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
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
  if (tenant.document) addrParts.push(`CNPJ/CPF: ${tenant.document}`);
  if (tenant.whatsapp) addrParts.push(`WhatsApp: ${tenant.whatsapp}`);

  let infoY = 25;
  for (const part of addrParts) {
    doc.text(part, textX, infoY);
    infoY += 4;
  }

  // ── "ORÇAMENTO" label on right
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text("ORÇAMENTO", pageW - margin, 16, { align: "right" });
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Nº ${String(quote.number).padStart(4, "0")}`, pageW - margin, 23, { align: "right" });

  const dateStr = new Date(quote.created_at).toLocaleDateString("pt-BR");
  const validUntil = new Date(
    new Date(quote.created_at).getTime() + quote.validity_days * 86400000
  ).toLocaleDateString("pt-BR");
  doc.text(`Data: ${dateStr}`, pageW - margin, 29, { align: "right" });
  doc.text(`Válido até: ${validUntil}`, pageW - margin, 34, { align: "right" });

  // ── Client section
  let y = 52;
  doc.setDrawColor(220, 220, 220);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(margin, y, contentW, 22, 2, 2, "FD");

  doc.setTextColor(100, 116, 139);
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "bold");
  doc.text("DADOS DO CLIENTE", margin + 4, y + 6);

  doc.setTextColor(30, 41, 59);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text(quote.customer_name, margin + 4, y + 13);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  const contactParts = [quote.customer_phone, quote.customer_email].filter(Boolean).join("   |   ");
  if (contactParts) doc.text(contactParts, margin + 4, y + 19);

  // ── Items table header
  y += 30;
  doc.setFillColor(pc.r, pc.g, pc.b);
  doc.rect(margin, y, contentW, 8, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  const cols = { name: margin + 3, qty: margin + 100, price: margin + 126, total: margin + 155 };
  doc.text("PRODUTO / DESCRIÇÃO", cols.name, y + 5.5);
  doc.text("QTD", cols.qty, y + 5.5, { align: "center" });
  doc.text("PREÇO UNIT.", cols.price, y + 5.5, { align: "right" });
  doc.text("TOTAL", pageW - margin - 3, y + 5.5, { align: "right" });

  // ── Items rows
  y += 8;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);

  for (let i = 0; i < quote.items.length; i++) {
    const item = quote.items[i];
    const rowH = 8;
    if (i % 2 === 0) {
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, y, contentW, rowH, "F");
    }
    doc.setTextColor(30, 41, 59);
    // Truncate long names
    const maxNameW = 90;
    let itemName = item.name;
    while (doc.getTextWidth(itemName) > maxNameW && itemName.length > 3) {
      itemName = itemName.slice(0, -1);
    }
    if (itemName !== item.name) itemName += "…";

    doc.text(itemName, cols.name, y + 5.5);
    doc.text(String(item.quantity), cols.qty, y + 5.5, { align: "center" });
    doc.text(fmt(Number(item.unit_price)), cols.price, y + 5.5, { align: "right" });
    doc.text(fmt(Number(item.total)), pageW - margin - 3, y + 5.5, { align: "right" });

    doc.setDrawColor(230, 230, 230);
    doc.line(margin, y + rowH, margin + contentW, y + rowH);
    y += rowH;
  }

  // ── Totals block
  y += 4;
  const totalsX = pageW - margin - 70;
  const totalsW = 70;

  doc.setDrawColor(220, 220, 220);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(totalsX, y, totalsW, quote.discount_value > 0 ? 28 : 18, 2, 2, "FD");

  doc.setTextColor(100, 116, 139);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text("Subtotal:", totalsX + 3, y + 7);
  doc.setTextColor(30, 41, 59);
  doc.text(fmt(Number(quote.subtotal)), totalsX + totalsW - 3, y + 7, { align: "right" });

  if (quote.discount_value > 0) {
    const discLabel =
      quote.discount_type === "percent"
        ? `Desconto (${quote.discount_value}%):`
        : "Desconto:";
    const discAmt =
      quote.discount_type === "percent"
        ? (Number(quote.subtotal) * Number(quote.discount_value)) / 100
        : Number(quote.discount_value);
    doc.setTextColor(100, 116, 139);
    doc.text(discLabel, totalsX + 3, y + 14);
    doc.setTextColor(220, 38, 38);
    doc.text(`- ${fmt(discAmt)}`, totalsX + totalsW - 3, y + 14, { align: "right" });

    doc.setFillColor(pc.r, pc.g, pc.b);
    doc.roundedRect(totalsX, y + 20, totalsW, 8, 2, 2, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("TOTAL:", totalsX + 3, y + 25.5);
    doc.text(fmt(Number(quote.total_amount)), totalsX + totalsW - 3, y + 25.5, { align: "right" });
  } else {
    doc.setFillColor(pc.r, pc.g, pc.b);
    doc.roundedRect(totalsX, y + 10, totalsW, 8, 2, 2, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("TOTAL:", totalsX + 3, y + 15.5);
    doc.text(fmt(Number(quote.total_amount)), totalsX + totalsW - 3, y + 15.5, { align: "right" });
  }

  y += quote.discount_value > 0 ? 36 : 26;

  // ── Notes
  if (quote.notes) {
    y += 4;
    doc.setDrawColor(220, 220, 220);
    doc.setFillColor(255, 251, 235);
    const noteLines = doc.splitTextToSize(quote.notes, contentW - 8);
    const noteH = noteLines.length * 5 + 10;
    doc.roundedRect(margin, y, contentW, noteH, 2, 2, "FD");
    doc.setTextColor(100, 116, 139);
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "bold");
    doc.text("OBSERVAÇÕES / CONDIÇÕES", margin + 4, y + 6);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(8.5);
    doc.text(noteLines, margin + 4, y + 12);
    y += noteH + 4;
  }

  // ── Validity reminder
  y += 4;
  doc.setTextColor(100, 116, 139);
  doc.setFontSize(8);
  doc.setFont("helvetica", "italic");
  doc.text(
    `Este orçamento é válido por ${quote.validity_days} dia(s) a partir de ${dateStr} (até ${validUntil}).`,
    margin,
    y
  );

  // ── Footer line
  doc.setDrawColor(pc.r, pc.g, pc.b);
  doc.setLineWidth(0.5);
  doc.line(margin, pageH - 14, pageW - margin, pageH - 14);
  doc.setTextColor(pc.r, pc.g, pc.b);
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "bold");
  doc.text(tenant.name, margin, pageH - 9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(150, 150, 150);
  doc.text(
    `Orçamento gerado em ${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`,
    pageW - margin,
    pageH - 9,
    { align: "right" }
  );

  doc.save(`orcamento-${String(quote.number).padStart(4, "0")}-${quote.customer_name.replace(/\s+/g, "-")}.pdf`);
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Quotes() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // New quote form state
  const [showForm, setShowForm] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [formItems, setFormItems] = useState<QuoteItem[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [manualCustomer, setManualCustomer] = useState({ name: "", phone: "", email: "" });
  const [discountType, setDiscountType] = useState<"percent" | "fixed">("percent");
  const [discountValue, setDiscountValue] = useState(0);
  const [validityDays, setValidityDays] = useState(7);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  // Detail/convert modal
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [convertPayment, setConvertPayment] = useState("money");

  const fetchAll = useCallback(async () => {
    const h = { Authorization: `Bearer ${localStorage.getItem("token")}` };
    try {
      const [qRes, pRes, cRes, tRes] = await Promise.all([
        fetch("/api/quotes", { headers: h }),
        fetch("/api/products", { headers: h }),
        fetch("/api/customers", { headers: h }),
        fetch("/api/tenant", { headers: h }),
      ]);
      const qData = await qRes.json();
      const pData = await pRes.json();
      const cData = await cRes.json();
      setQuotes(Array.isArray(qData) ? qData : []);
      setProducts(Array.isArray(pData) ? pData : []);
      setCustomers(Array.isArray(cData) ? cData : []);
      setTenant(await tRes.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Computed totals
  const subtotal = formItems.reduce((s, i) => s + i.total, 0);
  const discountAmt =
    discountType === "percent"
      ? (subtotal * discountValue) / 100
      : Math.min(discountValue, subtotal);
  const total = Math.max(0, subtotal - discountAmt);

  // ── Add product to cart
  const addProduct = (p: Product) => {
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

  // ── Save quote
  const handleSave = async () => {
    if (!formItems.length) return;
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
        })),
      };
      await fetch("/api/quotes", { method: "POST", headers: authHeader(), body: JSON.stringify(body) });
      await fetchAll();
      resetForm();
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setShowForm(false);
    setFormItems([]);
    setSelectedCustomer(null);
    setManualCustomer({ name: "", phone: "", email: "" });
    setDiscountType("percent");
    setDiscountValue(0);
    setValidityDays(7);
    setNotes("");
    setProductSearch("");
    setCustomerSearch("");
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Excluir este orçamento?")) return;
    await fetch(`/api/quotes/${id}`, { method: "DELETE", headers: authHeader() });
    fetchAll();
  };

  const handleConvert = async () => {
    if (!selectedQuote) return;
    await fetch(`/api/quotes/${selectedQuote.id}/convert`, {
      method: "POST",
      headers: authHeader(),
      body: JSON.stringify({ payment_method: convertPayment }),
    });
    setShowConvertModal(false);
    setSelectedQuote(null);
    fetchAll();
  };

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

  const filteredCustomers = customers.filter((c) =>
    c.name.toLowerCase().includes(customerSearch.toLowerCase())
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
                  <tr key={q.id} className="hover:bg-slate-50 transition-colors">
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
                    <td className="px-4 py-3">
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
                            onClick={() => { setSelectedQuote(q); setShowConvertModal(true); }}
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
                  <h2 className="font-black text-slate-900 text-[15px]">Novo Orçamento</h2>
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
                  <div className="relative">
                    <input
                      value={customerSearch || selectedCustomer?.name || ""}
                      onFocus={() => setShowCustomerDropdown(true)}
                      onChange={(e) => {
                        setCustomerSearch(e.target.value);
                        setSelectedCustomer(null);
                        setManualCustomer((m) => ({ ...m, name: e.target.value }));
                      }}
                      placeholder="Nome do cliente ou buscar cadastrado..."
                      className="w-full h-9 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    {showCustomerDropdown && filteredCustomers.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                        {filteredCustomers.slice(0, 8).map((c) => (
                          <button
                            key={c.id}
                            onMouseDown={() => {
                              setSelectedCustomer(c);
                              setCustomerSearch(c.name);
                              setShowCustomerDropdown(false);
                            }}
                            className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50 flex flex-col"
                          >
                            <span className="font-semibold">{c.name}</span>
                            {c.phone && <span className="text-xs text-slate-400">{c.phone}</span>}
                          </button>
                        ))}
                      </div>
                    )}
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
                      Itens do Orçamento
                    </h3>
                    <div className="space-y-2">
                      {formItems.map((item, idx) => (
                        <div key={idx} className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2">
                          <span className="flex-1 text-sm font-medium text-slate-700 truncate">{item.name}</span>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => updateItemQty(idx, item.quantity - 1)}
                              className="w-6 h-6 rounded-md bg-white border border-slate-200 text-slate-600 font-bold flex items-center justify-center hover:bg-red-50 hover:text-red-500"
                            >−</button>
                            <span className="w-6 text-center text-sm font-bold">{item.quantity}</span>
                            <button
                              onClick={() => updateItemQty(idx, item.quantity + 1)}
                              className="w-6 h-6 rounded-md bg-white border border-slate-200 text-slate-600 font-bold flex items-center justify-center hover:bg-emerald-50 hover:text-emerald-500"
                            >+</button>
                          </div>
                          <input
                            type="number"
                            value={item.unit_price}
                            onChange={(e) => updateItemPrice(idx, Number(e.target.value))}
                            className="w-24 h-7 px-2 rounded-md border border-slate-200 text-sm text-right focus:outline-none focus:ring-1 focus:ring-blue-400"
                          />
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
                      disabled={saving || !formItems.length || !(selectedCustomer?.name ?? manualCustomer.name)}
                      className="h-9 px-5 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                      {saving ? "Salvando…" : "Salvar Orçamento"}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Convert to Order Modal ────────────────────────────────────────────── */}
      <AnimatePresence>
        {showConvertModal && selectedQuote && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowConvertModal(false)}
              className="fixed inset-0 bg-slate-900/50 z-40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
            >
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
                <h3 className="font-black text-slate-900 text-base mb-1">Converter em Venda</h3>
                <p className="text-sm text-slate-500 mb-4">
                  Orçamento #{String(selectedQuote.number).padStart(4, "0")} — {selectedQuote.customer_name}
                  <br />
                  <span className="font-bold text-slate-700">{fmt(Number(selectedQuote.total_amount))}</span>
                </p>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                  Forma de Pagamento
                </label>
                <div className="relative mb-4">
                  <select
                    value={convertPayment}
                    onChange={(e) => setConvertPayment(e.target.value)}
                    className="w-full h-10 pl-3 pr-8 rounded-lg border border-slate-200 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="money">Dinheiro</option>
                    <option value="card">Cartão</option>
                    <option value="pix">PIX</option>
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowConvertModal(false)}
                    className="flex-1 h-10 rounded-lg border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleConvert}
                    className="flex-1 h-10 bg-emerald-600 text-white rounded-lg text-sm font-bold hover:bg-emerald-700 transition-all"
                  >
                    Confirmar Venda
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
