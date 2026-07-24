import { useState, useEffect, useCallback } from "react";
import {
  ShoppingBag,
  Plus,
  Search,
  X,
  ChevronDown,
  UserPlus,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Banknote,
  CreditCard,
  QrCode,
  PlusCircle,
  Trash2,
  Ban,
  Package,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../../lib/utils";
import PageHeader from "../../components/layout/PageHeader";
import Combobox from "../../components/ui/Combobox";

// ─── Types ────────────────────────────────────────────────────────────────────

type ConsignmentStatus = "aberta" | "fechada" | "cancelada";
type ItemResolution = "pending" | "kept" | "returned";

interface ConsignmentItem {
  id: number;
  product_id: number;
  name: string;
  quantity: number;
  unit_price: number;
  selected_options: Record<string, string> | null;
  resolution: ItemResolution;
}

interface ConsignmentActionLog {
  id: number;
  action: string;
  from_status: string | null;
  to_status: string | null;
  actor: string | null;
  note: string | null;
  created_at: string;
}

interface Consignment {
  id: number;
  number: number;
  customer_id: number | null;
  customer_name: string;
  customer_phone: string | null;
  seller_id: number | null;
  seller_name: string | null;
  due_days: number;
  due_date: string;
  status: ConsignmentStatus;
  notes: string | null;
  invoiced_order_id: number | null;
  invoiced_at: string | null;
  cancel_reason: string | null;
  created_at: string;
  items: ConsignmentItem[];
  actions?: ConsignmentActionLog[];
  overdue?: boolean;
}

interface Product {
  id: number;
  name: string;
  price: number;
  discount_price?: number | null;
  stock_quantity: number;
  is_active?: boolean;
  sale_unit?: "unidade" | "m2" | "linear";
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
  card_fees?: Record<string, number[]>;
}

// ─── Payment engine (same as ServiceOrders.tsx / PDV) ────────────────────────

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

const STATUS_META: Record<ConsignmentStatus, { label: string; color: string; icon: React.ReactNode }> = {
  aberta: { label: "Aberta", color: "text-blue-600 bg-blue-50", icon: <Clock size={12} /> },
  fechada: { label: "Fechada", color: "text-emerald-600 bg-emerald-50", icon: <CheckCircle2 size={12} /> },
  cancelada: { label: "Cancelada", color: "text-red-600 bg-red-50", icon: <XCircle size={12} /> },
};

const STATUS_ORDER: ConsignmentStatus[] = ["aberta", "fechada", "cancelada"];

function emptyForm() {
  return {
    customer_id: null as number | null,
    customer_name: "",
    customer_phone: "",
    seller_id: null as number | null,
    due_days: "7",
    notes: "",
  };
}

function isOverdue(c: Consignment): boolean {
  return c.status === "aberta" && new Date(c.due_date).getTime() < Date.now();
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Consignments() {
  const [consignments, setConsignments] = useState<Consignment[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "overdue" | ConsignmentStatus>("all");

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);

  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [ncName, setNcName] = useState("");
  const [ncPhone, setNcPhone] = useState("");
  const [savingNC, setSavingNC] = useState(false);

  const [draftItems, setDraftItems] = useState<{ product: Product; quantity: number }[]>([]);
  const [productSearch, setProductSearch] = useState("");

  const [selected, setSelected] = useState<Consignment | null>(null);
  const [resolutions, setResolutions] = useState<Record<number, ItemResolution>>({});

  const [showResolveModal, setShowResolveModal] = useState(false);
  const [invoicePayments, setInvoicePayments] = useState<InvoicePayment[]>([newPayment()]);
  const [invoiceSellerId, setInvoiceSellerId] = useState<number | "">("");
  const [resolving, setResolving] = useState(false);

  const fetchAll = useCallback(async () => {
    const h = authHeaderNoJson();
    try {
      const [cgRes, pRes, cRes, sRes, tRes] = await Promise.all([
        fetch("/api/consignments", { headers: h }),
        fetch("/api/products", { headers: h }),
        fetch("/api/customers", { headers: h }),
        fetch("/api/sellers", { headers: h }),
        fetch("/api/tenant", { headers: h }),
      ]);
      const [cgData, pData, cData, sData, tData] = await Promise.all([
        cgRes.json(), pRes.json(), cRes.json(), sRes.json(), tRes.json(),
      ]);
      setConsignments(Array.isArray(cgData) ? cgData : []);
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
    const res = await fetch(`/api/consignments/${id}`, { headers: authHeaderNoJson() });
    if (res.ok) setSelected(await res.json());
    fetchAll();
  }, [fetchAll]);

  // ── New customer quick-create ───────────────────────────────────────────
  const handleCreateCustomer = async () => {
    if (!ncName.trim()) return;
    setSavingNC(true);
    try {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: authHeader(),
        body: JSON.stringify({ name: ncName.trim(), phone: ncPhone || undefined }),
      });
      if (res.ok) {
        const created = await res.json();
        setCustomers((prev) => [...prev, created]);
        setForm((f) => ({ ...f, customer_id: created.id, customer_name: created.name, customer_phone: created.phone ?? f.customer_phone }));
        setShowNewCustomer(false);
      }
    } finally {
      setSavingNC(false);
    }
  };

  // ── Draft items (nova sacola) ───────────────────────────────────────────
  const addDraftItem = (product: Product) => {
    setDraftItems((prev) => {
      const existing = prev.find((d) => d.product.id === product.id);
      if (existing) {
        return prev.map((d) => (d.product.id === product.id ? { ...d, quantity: d.quantity + 1 } : d));
      }
      return [...prev, { product, quantity: 1 }];
    });
    setProductSearch("");
  };

  const updateDraftQty = (productId: number, quantity: number) => {
    setDraftItems((prev) => prev.map((d) => (d.product.id === productId ? { ...d, quantity: Math.max(1, quantity) } : d)));
  };

  const removeDraftItem = (productId: number) => {
    setDraftItems((prev) => prev.filter((d) => d.product.id !== productId));
  };

  const filteredProducts = products.filter(
    (p) => productSearch && p.name.toLowerCase().includes(productSearch.toLowerCase()) &&
      (!p.sale_unit || p.sale_unit === "unidade") && p.stock_quantity > 0
  );

  // ── Create ──────────────────────────────────────────────────────────────
  const handleCreate = async () => {
    if (!form.customer_name || draftItems.length === 0) return;
    setSaving(true);
    try {
      const res = await fetch("/api/consignments", {
        method: "POST",
        headers: authHeader(),
        body: JSON.stringify({
          customer_id: form.customer_id,
          customer_name: form.customer_name,
          customer_phone: form.customer_phone || undefined,
          seller_id: form.seller_id || undefined,
          due_days: Number(form.due_days) || 7,
          notes: form.notes || undefined,
          items: draftItems.map((d) => ({ product_id: d.product.id, quantity: d.quantity })),
        }),
      });
      if (res.ok) {
        const created = await res.json();
        setShowForm(false);
        setForm(emptyForm());
        setDraftItems([]);
        await fetchAll();
        setSelected(created);
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error || "Falha ao criar consignação");
      }
    } finally {
      setSaving(false);
    }
  };

  // ── Cancel ──────────────────────────────────────────────────────────────
  const handleCancel = async () => {
    if (!selected) return;
    const cancel_reason = window.prompt("Motivo do cancelamento (opcional):") || undefined;
    if (!window.confirm("Cancelar esta consignação? Todos os itens ainda pendentes voltarão ao estoque.")) return;
    await fetch(`/api/consignments/${selected.id}/cancel`, {
      method: "POST",
      headers: authHeader(),
      body: JSON.stringify({ cancel_reason }),
    });
    await refreshSelected(selected.id);
  };

  // ── Resolve (ficou/voltou + faturar) ────────────────────────────────────
  const openResolveModal = () => {
    if (!selected) return;
    const initial: Record<number, ItemResolution> = {};
    selected.items.forEach((it) => { initial[it.id] = it.resolution === "pending" ? "kept" : it.resolution; });
    setResolutions(initial);
    setInvoicePayments([newPayment()]);
    setInvoiceSellerId(selected.seller_id ?? "");
    setShowResolveModal(true);
  };

  const toggleResolution = (itemId: number, resolution: ItemResolution) => {
    setResolutions((prev) => ({ ...prev, [itemId]: resolution }));
  };

  const keptTotal = selected
    ? selected.items
        .filter((it) => it.resolution === "pending")
        .filter((it) => resolutions[it.id] === "kept")
        .reduce((sum, it) => sum + Number(it.unit_price) * it.quantity, 0)
    : 0;

  const paidTotal = invoicePayments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const remaining = Math.max(0, keptTotal - paidTotal);
  const hasKeptItems = selected ? selected.items.filter((it) => it.resolution === "pending").some((it) => resolutions[it.id] === "kept") : false;

  const updateInvoicePayment = (id: string, patch: Partial<InvoicePayment>) => {
    setInvoicePayments((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  };
  const addInvoicePayment = () => setInvoicePayments((prev) => [...prev, newPayment()]);
  const removeInvoicePayment = (id: string) => setInvoicePayments((prev) => prev.filter((p) => p.id !== id));

  const handleResolve = async () => {
    if (!selected) return;
    setResolving(true);
    try {
      const pendingItems = selected.items.filter((it) => it.resolution === "pending");
      const payload = {
        resolutions: pendingItems.map((it) => ({ item_id: it.id, resolution: resolutions[it.id] ?? "returned" })),
        payment_method: hasKeptItems ? (buildPmString(invoicePayments) || "money") : undefined,
        seller_id: invoiceSellerId || undefined,
      };
      const res = await fetch(`/api/consignments/${selected.id}/resolve`, {
        method: "POST",
        headers: authHeader(),
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setShowResolveModal(false);
        setInvoicePayments([newPayment()]);
        setInvoiceSellerId("");
        await refreshSelected(selected.id);
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error || "Falha ao resolver consignação");
      }
    } finally {
      setResolving(false);
    }
  };

  // ── Filters ─────────────────────────────────────────────────────────────
  const filtered = consignments.filter((c) => {
    const matchStatus =
      statusFilter === "all" ? true :
      statusFilter === "overdue" ? isOverdue(c) :
      c.status === statusFilter;
    const matchSearch =
      !searchTerm ||
      c.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      String(c.number).includes(searchTerm);
    return matchStatus && matchSearch;
  });

  const statusCounts = STATUS_ORDER.reduce((acc, s) => {
    acc[s] = consignments.filter((c) => c.status === s).length;
    return acc;
  }, {} as Record<ConsignmentStatus, number>);
  const overdueCount = consignments.filter(isOverdue).length;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Consignação"
        subtitle="Envie produtos para o cliente avaliar e fature o que ficou"
        action={
          <button
            onClick={() => setShowForm(true)}
            className="h-9 px-4 bg-blue-600 text-white rounded-lg flex items-center gap-2 text-[12px] font-bold hover:bg-blue-700 transition-all shadow-md shadow-blue-500/20"
          >
            <Plus size={15} /> Nova Sacola
          </button>
        }
      />

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
        <input
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Buscar por número ou cliente..."
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
          Todas ({consignments.length})
        </button>
        <button
          onClick={() => setStatusFilter("overdue")}
          className={cn(
            "shrink-0 h-8 px-3 rounded-lg text-[10px] font-black uppercase tracking-wider border transition-all flex items-center gap-1.5",
            statusFilter === "overdue" ? "bg-red-600 border-red-600 text-white" : "bg-white border-red-200 text-red-500 hover:border-red-300"
          )}
        >
          <AlertTriangle size={12} /> Em Atraso ({overdueCount})
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
          <div className="p-10 text-center text-slate-400 text-[12px] font-bold">Nenhuma consignação encontrada</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-slate-100 text-left text-[9px] font-black uppercase tracking-widest text-slate-400">
                  <th className="px-4 py-3">Número</th>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3">Itens</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Prazo</th>
                  <th className="px-4 py-3 text-right">Valor</th>
                  <th className="px-4 py-3">Data</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => {
                  const overdue = isOverdue(c);
                  const total = c.items.reduce((s, it) => s + Number(it.unit_price) * it.quantity, 0);
                  return (
                    <tr
                      key={c.id}
                      onClick={() => setSelected(c)}
                      className={cn(
                        "border-b border-slate-50 last:border-0 hover:bg-slate-50 cursor-pointer transition-colors",
                        overdue && "bg-red-50/40"
                      )}
                    >
                      <td className="px-4 py-3 font-mono font-bold text-slate-700">#{String(c.number).padStart(4, "0")}</td>
                      <td className="px-4 py-3 font-semibold text-slate-700">{c.customer_name}</td>
                      <td className="px-4 py-3 text-slate-500">{c.items.length} item(ns)</td>
                      <td className="px-4 py-3">
                        <span className={cn("inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider", STATUS_META[c.status].color)}>
                          {STATUS_META[c.status].icon} {STATUS_META[c.status].label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {overdue ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider text-red-600 bg-red-50">
                            <AlertTriangle size={11} /> Em Atraso
                          </span>
                        ) : (
                          <span className="text-slate-400">{new Date(c.due_date).toLocaleDateString("pt-BR")}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-slate-700">{fmt(total)}</td>
                      <td className="px-4 py-3 text-slate-400">{new Date(c.created_at).toLocaleDateString("pt-BR")}</td>
                    </tr>
                  );
                })}
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
                <h2 className="text-[15px] font-black text-slate-800">Nova Sacola de Consignação</h2>
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
                        onAddNew={(q) => {
                          setNcName(q); setNcPhone("");
                          setShowNewCustomer(true);
                        }}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => { setNcName(""); setNcPhone(""); setShowNewCustomer(true); }}
                      className="h-10 w-10 rounded-xl bg-blue-50 border border-blue-200 text-blue-600 hover:bg-blue-100 flex items-center justify-center shrink-0 transition-colors"
                      title="Cadastrar novo cliente"
                    >
                      <UserPlus size={15} />
                    </button>
                  </div>
                  <input
                    value={form.customer_phone}
                    onChange={(e) => setForm((f) => ({ ...f, customer_phone: e.target.value }))}
                    placeholder="Telefone"
                    className="w-full mt-2 h-10 px-3 rounded-xl border border-slate-200 text-[12px] font-medium focus:outline-none focus:border-blue-400"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1.5 block">Prazo (dias)</label>
                    <input
                      type="number" min="1"
                      value={form.due_days}
                      onChange={(e) => setForm((f) => ({ ...f, due_days: e.target.value }))}
                      className="w-full h-10 px-3 rounded-xl border border-slate-200 text-[12px] font-medium focus:outline-none focus:border-blue-400"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1.5 block">Vendedor</label>
                    <div className="relative">
                      <select
                        value={form.seller_id ?? ""}
                        onChange={(e) => setForm((f) => ({ ...f, seller_id: e.target.value === "" ? null : Number(e.target.value) }))}
                        className="w-full pl-3 pr-8 h-10 rounded-xl border border-slate-200 text-[11px] font-bold appearance-none focus:outline-none focus:border-blue-400 bg-white"
                      >
                        <option value="">Sem vendedor</option>
                        {sellers.map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}
                      </select>
                      <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    </div>
                  </div>
                </div>

                {/* Itens */}
                <div>
                  <label className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1.5 block">Produtos da Sacola</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
                    <input
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                      placeholder="Buscar produto por nome..."
                      className="w-full pl-9 pr-3 h-10 rounded-xl border border-slate-200 text-[12px] font-medium focus:outline-none focus:border-blue-400"
                    />
                    {filteredProducts.length > 0 && (
                      <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                        {filteredProducts.slice(0, 8).map((p) => (
                          <button
                            key={p.id}
                            onClick={() => addDraftItem(p)}
                            className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center justify-between text-[12px] transition-colors"
                          >
                            <span className="font-semibold text-slate-700">{p.name}</span>
                            <span className="text-slate-400 font-mono text-[11px]">{fmt(Number(p.discount_price ?? p.price))} · estoque {p.stock_quantity}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {draftItems.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {draftItems.map((d) => (
                        <div key={d.product.id} className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
                          <Package size={14} className="text-slate-400 shrink-0" />
                          <span className="flex-1 text-[12px] font-semibold text-slate-700 truncate">{d.product.name}</span>
                          <input
                            type="number" min="1" max={d.product.stock_quantity}
                            value={d.quantity}
                            onChange={(e) => updateDraftQty(d.product.id, Number(e.target.value) || 1)}
                            className="w-14 h-8 px-2 rounded-lg border border-slate-200 text-[11px] font-bold text-center"
                          />
                          <span className="text-[11px] font-mono text-slate-500 w-20 text-right">
                            {fmt(Number(d.product.discount_price ?? d.product.price) * d.quantity)}
                          </span>
                          <button onClick={() => removeDraftItem(d.product.id)} className="text-slate-300 hover:text-red-500 transition-colors">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <textarea
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  placeholder="Observações (opcional)"
                  rows={2}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-[12px] font-medium focus:outline-none focus:border-blue-400 resize-none"
                />
              </div>

              <div className="shrink-0 px-6 pb-6 pt-3 flex gap-2 border-t border-slate-100">
                <button onClick={() => setShowForm(false)} className="flex-1 h-11 rounded-xl border border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50 transition-colors">
                  Cancelar
                </button>
                <button
                  onClick={handleCreate}
                  disabled={saving || !form.customer_name || draftItems.length === 0}
                  className="flex-1 h-11 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <ShoppingBag size={14} />}
                  Criar Sacola
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── NEW CUSTOMER MODAL ───────────────────────────────────────────── */}
      <AnimatePresence>
        {showNewCustomer && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowNewCustomer(false)}
              className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-[400]"
            />
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12, scale: 0.98 }}
              transition={{ type: "spring", damping: 32, stiffness: 300 }}
              className="fixed inset-x-4 bottom-4 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 z-[401] bg-white flex flex-col overflow-hidden rounded-3xl"
              style={{ width: "min(400px, calc(100vw - 32px))" }}
            >
              <div className="shrink-0 flex items-center justify-between px-6 py-4 border-b border-slate-100">
                <h2 className="text-[14px] font-black text-slate-800">Novo Cliente</h2>
                <button onClick={() => setShowNewCustomer(false)} className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center">
                  <X size={14} className="text-slate-500" />
                </button>
              </div>
              <div className="p-5 space-y-3">
                <input value={ncName} onChange={(e) => setNcName(e.target.value)} placeholder="Nome" className="w-full h-10 px-3 rounded-xl border border-slate-200 text-[12px] font-medium focus:outline-none focus:border-blue-400" />
                <input value={ncPhone} onChange={(e) => setNcPhone(e.target.value)} placeholder="Telefone" className="w-full h-10 px-3 rounded-xl border border-slate-200 text-[12px] font-medium focus:outline-none focus:border-blue-400" />
              </div>
              <div className="shrink-0 px-5 pb-5 pt-2 flex gap-2">
                <button onClick={() => setShowNewCustomer(false)} className="flex-1 h-10 rounded-xl border border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50 transition-colors">
                  Cancelar
                </button>
                <button onClick={handleCreateCustomer} disabled={savingNC || !ncName.trim()} className="flex-1 h-10 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all disabled:opacity-50">
                  {savingNC ? <Loader2 size={13} className="animate-spin mx-auto" /> : "Salvar"}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── DETAIL / RESOLVE MODAL ──────────────────────────────────────── */}
      <AnimatePresence>
        {selected && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setSelected(null)}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[300]"
            />
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12, scale: 0.98 }}
              transition={{ type: "spring", damping: 32, stiffness: 300 }}
              className="fixed inset-x-4 bottom-4 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 z-[301] bg-white flex flex-col overflow-hidden rounded-3xl"
              style={{ width: "min(600px, calc(100vw - 32px))", height: "min(760px, calc(100vh - 48px))" }}
            >
              <div className="shrink-0 flex items-center justify-between px-6 py-4 border-b border-slate-100">
                <div>
                  <h2 className="text-[15px] font-black text-slate-800">Sacola #{String(selected.number).padStart(4, "0")}</h2>
                  <p className="text-[11px] text-slate-500 font-medium">{selected.customer_name}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn("inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider", STATUS_META[selected.status].color)}>
                    {STATUS_META[selected.status].icon} {STATUS_META[selected.status].label}
                  </span>
                  <button onClick={() => setSelected(null)} className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center">
                    <X size={16} className="text-slate-500" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {isOverdue(selected) && (
                  <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-[11px] font-bold text-red-600">
                    <AlertTriangle size={14} /> Prazo vencido em {new Date(selected.due_date).toLocaleDateString("pt-BR")}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="bg-slate-50 rounded-xl px-3 py-2">
                    <span className="text-slate-400 font-bold uppercase text-[9px] block">Prazo</span>
                    <span className="font-semibold text-slate-700">{new Date(selected.due_date).toLocaleDateString("pt-BR")} ({selected.due_days}d)</span>
                  </div>
                  <div className="bg-slate-50 rounded-xl px-3 py-2">
                    <span className="text-slate-400 font-bold uppercase text-[9px] block">Vendedor</span>
                    <span className="font-semibold text-slate-700">{selected.seller_name || "—"}</span>
                  </div>
                </div>

                {selected.notes && (
                  <div className="bg-amber-50/50 border border-amber-200 rounded-xl px-3 py-2 text-[11px] text-slate-600">{selected.notes}</div>
                )}

                <div>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Itens</p>
                  <div className="space-y-1.5">
                    {selected.items.map((it) => (
                      <div key={it.id} className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] font-semibold text-slate-700 truncate">{it.name} × {it.quantity}</p>
                          <p className="text-[10px] text-slate-400 font-mono">{fmt(Number(it.unit_price) * it.quantity)}</p>
                        </div>
                        {it.resolution !== "pending" ? (
                          <span className={cn(
                            "px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider shrink-0",
                            it.resolution === "kept" ? "text-emerald-600 bg-emerald-50" : "text-slate-500 bg-slate-100"
                          )}>
                            {it.resolution === "kept" ? "Ficou" : "Voltou"}
                          </span>
                        ) : (
                          <span className="px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider text-blue-600 bg-blue-50 shrink-0">Pendente</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {selected.cancel_reason && (
                  <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-[11px] text-red-600">
                    <strong>Motivo do cancelamento:</strong> {selected.cancel_reason}
                  </div>
                )}
              </div>

              {selected.status === "aberta" && (
                <div className="shrink-0 px-6 pb-6 pt-3 flex gap-2 border-t border-slate-100">
                  <button onClick={handleCancel} className="h-11 px-4 rounded-xl border border-red-200 text-red-600 text-[10px] font-black uppercase tracking-widest hover:bg-red-50 transition-colors flex items-center gap-2">
                    <Ban size={14} /> Cancelar
                  </button>
                  <button
                    onClick={openResolveModal}
                    className="flex-1 h-11 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 size={14} /> Resolver Sacola
                  </button>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── RESOLVE MODAL (ficou/voltou + pagamento) ────────────────────── */}
      <AnimatePresence>
        {showResolveModal && selected && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowResolveModal(false)}
              className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-[400]"
            />
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12, scale: 0.98 }}
              transition={{ type: "spring", damping: 32, stiffness: 300 }}
              className="fixed inset-x-4 bottom-4 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 z-[401] bg-white flex flex-col overflow-hidden rounded-3xl"
              style={{ width: "min(500px, calc(100vw - 32px))", height: "min(760px, calc(100vh - 48px))" }}
            >
              <div className="shrink-0 flex items-center justify-between px-6 py-4 border-b border-slate-100">
                <h2 className="text-[14px] font-black text-slate-800">Resolver Sacola #{String(selected.number).padStart(4, "0")}</h2>
                <button onClick={() => setShowResolveModal(false)} className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center">
                  <X size={14} className="text-slate-500" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                {/* Ficou / Voltou por item */}
                <div>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Marque o que ficou e o que voltou</p>
                  <div className="space-y-2">
                    {selected.items.filter((it) => it.resolution === "pending").map((it) => (
                      <div key={it.id} className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[12px] font-semibold text-slate-700">{it.name} × {it.quantity}</span>
                          <span className="text-[11px] font-mono text-slate-500">{fmt(Number(it.unit_price) * it.quantity)}</span>
                        </div>
                        <div className="flex bg-white border border-slate-200 rounded-lg p-0.5 gap-0.5">
                          <button
                            onClick={() => toggleResolution(it.id, "kept")}
                            className={cn("flex-1 h-8 rounded-md text-[10px] font-black uppercase tracking-wider transition-all", resolutions[it.id] === "kept" ? "bg-emerald-600 text-white" : "text-slate-500 hover:bg-slate-50")}
                          >
                            Ficou
                          </button>
                          <button
                            onClick={() => toggleResolution(it.id, "returned")}
                            className={cn("flex-1 h-8 rounded-md text-[10px] font-black uppercase tracking-wider transition-all", resolutions[it.id] === "returned" ? "bg-slate-600 text-white" : "text-slate-500 hover:bg-slate-50")}
                          >
                            Voltou
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {hasKeptItems && (
                  <>
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
                        <span>Total dos itens que ficaram</span>
                        <span className="font-mono">{fmt(keptTotal)}</span>
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
                  </>
                )}

                {!hasKeptItems && (
                  <div className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-3 text-[11px] text-slate-500 text-center">
                    Nenhum item ficou — a sacola será fechada como devolução total, sem gerar venda.
                  </div>
                )}
              </div>

              <div className="shrink-0 px-6 pb-6 pt-3 flex gap-2 border-t border-slate-100">
                <button onClick={() => setShowResolveModal(false)} className="flex-1 h-11 rounded-xl border border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50 transition-colors">
                  Cancelar
                </button>
                <button onClick={handleResolve} disabled={resolving || (hasKeptItems && paidTotal <= 0)}
                  className="flex-1 h-11 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                  {resolving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                  Confirmar
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
