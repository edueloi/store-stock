import { useState, useEffect, useCallback, useRef } from "react";
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
  Pencil,
  History,
  RotateCcw,
  ShieldAlert,
  HelpCircle,
} from "lucide-react";
import React from "react";
import { cn } from "../../lib/utils";
import { Button, IconButton, Input, Textarea, Select, Modal, ModalFooter, Badge, Alert, EmptyState, ContentCard, PanelCard, DetailField, SectionTitle, StatGrid, StatCard, Tabs, GridTable, usePagination, FilterLine, FilterLineSection, FilterLineSearch } from "../../components/ui";
import type { Column } from "../../components/ui";
import Combobox from "../../components/ui/Combobox";
import { useToast } from "../../components/ui/Toast";
import { onRealtime } from "../../lib/realtime";
import { getStoredUser } from "../../lib/session";
import ConsignmentsPageTour, { CONSIGNMENTS_PAGE_TOUR_EVENTS, type ConsignmentsPageTourHandle } from "../../components/onboarding/ConsignmentsPageTour";

// ─── Types ────────────────────────────────────────────────────────────────────

type ConsignmentStatus = "aberta" | "fechada" | "cancelada";
type DerivedStatus = ConsignmentStatus | "parcial" | "vencendo_hoje" | "atrasada";
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
  derived_status?: DerivedStatus;
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
  consignment_limit?: number | null;
  risk_flag?: boolean;
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

const DERIVED_STATUS_META: Record<DerivedStatus, { label: string; color: string; icon: React.ReactNode }> = {
  ...STATUS_META,
  parcial: { label: "Parcial", color: "text-violet-600 bg-violet-50", icon: <ShoppingBag size={12} /> },
  vencendo_hoje: { label: "Vencendo Hoje", color: "text-amber-600 bg-amber-50", icon: <AlertTriangle size={12} /> },
  atrasada: { label: "Em Atraso", color: "text-red-600 bg-red-50", icon: <AlertTriangle size={12} /> },
};

function displayStatus(c: Consignment): DerivedStatus {
  return c.derived_status ?? c.status;
}

const ACTION_LABELS: Record<string, string> = {
  created: "Sacola criada",
  item_added: "Item adicionado",
  item_removed: "Item removido",
  updated: "Sacola atualizada",
  partial_resolved: "Resolução parcial",
  resolved: "Sacola resolvida",
  cancelled: "Sacola cancelada",
  reopened: "Sacola reaberta",
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

const STATUS_BADGE: Record<DerivedStatus, "primary" | "success" | "danger" | "purple" | "warning"> = {
  aberta: "primary",
  fechada: "success",
  cancelada: "danger",
  parcial: "purple",
  vencendo_hoje: "warning",
  atrasada: "danger",
};

type ConsignmentFilter = "all" | "overdue" | "vencendo_hoje" | "parcial" | ConsignmentStatus;
type CreateTab = "dados" | "produtos";
type DetailTab = "items" | "history";
type ResolveTab = "itens" | "pagamento";

const STATUS_FILTER_TABS = [
  { id: "all", label: "Todas", icon: ShoppingBag },
  { id: "overdue", label: "Em Atraso", icon: AlertTriangle },
  { id: "vencendo_hoje", label: "Vencendo Hoje", icon: Clock },
  { id: "parcial", label: "Parcial", icon: Package },
  { id: "aberta", label: "Aberta", icon: Clock },
  { id: "fechada", label: "Fechada", icon: CheckCircle2 },
  { id: "cancelada", label: "Cancelada", icon: XCircle },
] as const satisfies readonly { id: ConsignmentFilter; label: string; icon: React.ElementType }[];

const CREATE_TABS = [
  { id: "dados", label: "Dados", icon: UserPlus },
  { id: "produtos", label: "Produtos", icon: Package },
] as const satisfies readonly { id: CreateTab; label: string; icon: React.ElementType; badge?: number }[];

const DETAIL_TABS = [
  { id: "items", label: "Itens", icon: Package },
  { id: "history", label: "Histórico", icon: History },
] as const satisfies readonly { id: DetailTab; label: string; icon: React.ElementType }[];

const RESOLVE_TABS = [
  { id: "itens", label: "Itens", icon: Package },
  { id: "pagamento", label: "Pagamento", icon: Banknote },
] as const satisfies readonly { id: ResolveTab; label: string; icon: React.ElementType; disabled?: boolean }[];

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Consignments() {
  const { success, error: toastError } = useToast();
  const isAdmin = getStoredUser()?.role === "admin";
  const [consignments, setConsignments] = useState<Consignment[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<ConsignmentFilter>("all");

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
  const [detailTab, setDetailTab] = useState<DetailTab>("items");
  const [resolutions, setResolutions] = useState<Record<number, ItemResolution>>({});

  const [showResolveModal, setShowResolveModal] = useState(false);
  const [invoicePayments, setInvoicePayments] = useState<InvoicePayment[]>([newPayment()]);
  const [invoiceSellerId, setInvoiceSellerId] = useState<number | "">("");
  const [resolving, setResolving] = useState(false);

  const [showEditModal, setShowEditModal] = useState(false);
  const [editDueDays, setEditDueDays] = useState("7");
  const [editSellerId, setEditSellerId] = useState<number | null>(null);
  const [editNotes, setEditNotes] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const [reopening, setReopening] = useState(false);
  const [createTab, setCreateTab] = useState<CreateTab>("dados");
  const [resolveTab, setResolveTab] = useState<ResolveTab>("itens");

  useEffect(() => { if (showForm) setCreateTab("dados"); }, [showForm]);
  useEffect(() => { if (showResolveModal) setResolveTab("itens"); }, [showResolveModal]);

  const consignmentsPageTourRef = useRef<ConsignmentsPageTourHandle>(null);

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
  useEffect(() => onRealtime("consignment:changed", () => { fetchAll(); }), [fetchAll]);

  const refreshSelected = useCallback(async (id: number) => {
    const res = await fetch(`/api/consignments/${id}`, { headers: authHeaderNoJson() });
    if (res.ok) setSelected(await res.json());
    fetchAll();
  }, [fetchAll]);

  // A listagem não traz `actions` (histórico) — busca o detalhe completo ao abrir o modal.
  const openDetail = (c: Consignment) => {
    setSelected(c);
    setDetailTab("items");
    refreshSelected(c.id);
  };

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

  const customerOpenConsignments = form.customer_id
    ? consignments.filter((c) => c.status === "aberta" && c.customer_id === form.customer_id)
    : [];

  const selectedCustomer = form.customer_id ? customers.find((c) => c.id === form.customer_id) : undefined;
  const selectedCustomerOpenAmount = customerOpenConsignments.reduce(
    (sum, c) => sum + c.items.filter((it) => it.resolution === "pending").reduce((s, it) => s + Number(it.unit_price) * it.quantity, 0),
    0,
  );
  const draftTotal = draftItems.reduce((sum, d) => sum + Number(d.product.discount_price ?? d.product.price) * d.quantity, 0);
  const consignmentLimit = selectedCustomer?.consignment_limit ? Number(selectedCustomer.consignment_limit) : 0;
  const overLimit = consignmentLimit > 0 && selectedCustomerOpenAmount + draftTotal > consignmentLimit + 0.005;

  // ── Canal de comunicação do TOUR DE PÁGINA (ConsignmentsPageTour) ──────────
  // Abre o modal "Nova Sacola" de verdade via setShowForm(true) e preenche
  // campos de exemplo via setForm — nunca chama handleCreate (POST real, que
  // pode inclusive disparar um window.confirm nativo se o cliente já tiver
  // sacola aberta). Fechar sempre via setShowForm(false) (equivalente a
  // clicar no X ou fora do modal, que já fazem isso na tela real).
  useEffect(() => {
    const onOpenNewBag = () => setShowForm(true);
    const onFillBag = (e: Event) => {
      const detail = (e as CustomEvent<Partial<ReturnType<typeof emptyForm>>>).detail;
      if (detail) setForm((f) => ({ ...f, ...detail }));
    };
    const onCloseForm = () => setShowForm(false);

    window.addEventListener(CONSIGNMENTS_PAGE_TOUR_EVENTS.openNewBag, onOpenNewBag);
    window.addEventListener(CONSIGNMENTS_PAGE_TOUR_EVENTS.fillBag, onFillBag);
    window.addEventListener(CONSIGNMENTS_PAGE_TOUR_EVENTS.closeForm, onCloseForm);
    return () => {
      window.removeEventListener(CONSIGNMENTS_PAGE_TOUR_EVENTS.openNewBag, onOpenNewBag);
      window.removeEventListener(CONSIGNMENTS_PAGE_TOUR_EVENTS.fillBag, onFillBag);
      window.removeEventListener(CONSIGNMENTS_PAGE_TOUR_EVENTS.closeForm, onCloseForm);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Create ──────────────────────────────────────────────────────────────
  const handleCreate = async () => {
    if (!form.customer_name || draftItems.length === 0) return;
    if (customerOpenConsignments.length > 0) {
      const list = customerOpenConsignments.map((c) => `#${String(c.number).padStart(4, "0")}`).join(", ");
      if (!window.confirm(`${form.customer_name} já tem sacola aberta (${list}). Deseja criar outra mesmo assim?`)) return;
    }
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
        success(`Sacola #${String(created.number).padStart(4, "0")} criada com sucesso`);
      } else {
        const err = await res.json().catch(() => ({}));
        toastError(err.error || "Falha ao criar consignação");
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

  // ── Edit (prazo/vendedor/observações de sacola aberta) ──────────────────
  const openEditModal = () => {
    if (!selected) return;
    setEditDueDays(String(selected.due_days));
    setEditSellerId(selected.seller_id);
    setEditNotes(selected.notes ?? "");
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!selected) return;
    setSavingEdit(true);
    try {
      const res = await fetch(`/api/consignments/${selected.id}`, {
        method: "PUT",
        headers: authHeader(),
        body: JSON.stringify({
          due_days: Number(editDueDays) || selected.due_days,
          seller_id: editSellerId || null,
          notes: editNotes || null,
        }),
      });
      if (res.ok) {
        setShowEditModal(false);
        await refreshSelected(selected.id);
        success("Sacola atualizada");
      } else {
        const err = await res.json().catch(() => ({}));
        toastError(err.error || "Falha ao atualizar consignação");
      }
    } finally {
      setSavingEdit(false);
    }
  };

  // ── Reopen (só cancelada, só admin) ──────────────────────────────────────
  const handleReopen = async () => {
    if (!selected) return;
    const reason = window.prompt("Motivo da reabertura (obrigatório):");
    if (!reason || !reason.trim()) return;
    setReopening(true);
    try {
      const res = await fetch(`/api/consignments/${selected.id}/reopen`, {
        method: "POST",
        headers: authHeader(),
        body: JSON.stringify({ reason }),
      });
      if (res.ok) {
        await refreshSelected(selected.id);
        success("Sacola reaberta");
      } else {
        const err = await res.json().catch(() => ({}));
        toastError(err.error || "Falha ao reabrir consignação");
      }
    } finally {
      setReopening(false);
    }
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
  const decidedCount = selected
    ? selected.items.filter((it) => it.resolution === "pending" && resolutions[it.id] && resolutions[it.id] !== "pending").length
    : 0;
  const leftPendingCount = selected
    ? selected.items.filter((it) => it.resolution === "pending" && (!resolutions[it.id] || resolutions[it.id] === "pending")).length
    : 0;

  const updateInvoicePayment = (id: string, patch: Partial<InvoicePayment>) => {
    setInvoicePayments((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  };
  const addInvoicePayment = () => setInvoicePayments((prev) => [...prev, newPayment()]);
  const removeInvoicePayment = (id: string) => setInvoicePayments((prev) => prev.filter((p) => p.id !== id));

  const handleResolve = async () => {
    if (!selected) return;
    setResolving(true);
    try {
      // "Pendente" no toggle = deixar pra decidir depois — não entra no payload, e a sacola
      // continua aberta/parcial pro que sobrar (o backend fecha só quando não sobra pendência).
      const pendingItems = selected.items.filter((it) => it.resolution === "pending");
      const decidedItems = pendingItems.filter((it) => resolutions[it.id] && resolutions[it.id] !== "pending");
      const payload = {
        resolutions: decidedItems.map((it) => ({ item_id: it.id, resolution: resolutions[it.id] })),
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
        success("Sacola resolvida com sucesso");
      } else {
        const err = await res.json().catch(() => ({}));
        toastError(err.error || "Falha ao resolver consignação");
      }
    } finally {
      setResolving(false);
    }
  };

  // ── Filters ─────────────────────────────────────────────────────────────
  const filtered = consignments.filter((c) => {
    const matchStatus =
      statusFilter === "all" ? true :
      statusFilter === "overdue" ? displayStatus(c) === "atrasada" :
      statusFilter === "vencendo_hoje" ? displayStatus(c) === "vencendo_hoje" :
      statusFilter === "parcial" ? displayStatus(c) === "parcial" :
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
  const overdueCount = consignments.filter((c) => displayStatus(c) === "atrasada").length;
  const dueTodayCount = consignments.filter((c) => displayStatus(c) === "vencendo_hoje").length;
  const partialCount = consignments.filter((c) => displayStatus(c) === "parcial").length;

  const consignmentsPagination = usePagination(filtered, 15);
  const statusTabItems = STATUS_FILTER_TABS.map((t) => ({
    ...t,
    badge:
      t.id === "all" ? consignments.length :
      t.id === "overdue" ? overdueCount :
      t.id === "vencendo_hoje" ? dueTodayCount :
      t.id === "parcial" ? partialCount :
      statusCounts[t.id],
  }));
  const formatBagNumber = (n: number) => `#${String(n).padStart(4, "0")}`;

  const columns: Column<Consignment>[] = [
    { header: "Número", render: (c) => <span className="text-xs font-semibold tabular-nums text-slate-700">{formatBagNumber(c.number)}</span> },
    { header: "Cliente", render: (c) => <span className="break-words text-xs font-medium text-slate-800">{c.customer_name}</span> },
    { header: "Itens", render: (c) => <span className="text-xs text-slate-500">{c.items.length} item(ns)</span> },
    {
      header: "Status",
      render: (c) => {
        const d = displayStatus(c);
        return <Badge color={STATUS_BADGE[d]} icon={DERIVED_STATUS_META[d].icon}>{DERIVED_STATUS_META[d].label}</Badge>;
      },
    },
    {
      header: "Prazo",
      render: (c) => isOverdue(c)
        ? <Badge color="danger" icon={<AlertTriangle size={11} />}>Em Atraso</Badge>
        : <span className="text-xs text-slate-500">{new Date(c.due_date).toLocaleDateString("pt-BR")}</span>,
    },
    {
      header: "Valor",
      className: "text-right",
      headerClassName: "text-right",
      render: (c) => (
        <span className="whitespace-nowrap text-xs font-semibold tabular-nums text-slate-700">
          {fmt(c.items.reduce((s, it) => s + Number(it.unit_price) * it.quantity, 0))}
        </span>
      ),
    },
    { header: "Data", render: (c) => <span className="text-xs text-slate-500">{new Date(c.created_at).toLocaleDateString("pt-BR")}</span> },
  ];

  const sellerOptions = sellers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>);

  return (
    <div data-tour="consignments-page" className="space-y-4">
      <SectionTitle
        title="Consignação"
        icon={ShoppingBag}
        description="Envie produtos para o cliente avaliar e fature o que ficou"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Button data-tour="consignments-new-btn" size="sm" iconLeft={<Plus size={14} />} onClick={() => setShowForm(true)}>
              Nova Sacola
            </Button>
            <Button
              variant="outline"
              size="sm"
              iconLeft={<HelpCircle size={14} />}
              onClick={() => consignmentsPageTourRef.current?.start()}
              title="Tour guiado desta página"
            >
              <span className="sr-only sm:not-sr-only">Ajuda</span>
            </Button>
          </div>
        }
      />

      <ConsignmentsPageTour ref={consignmentsPageTourRef} />

      {/* Stat cards */}
      <div data-tour="consignments-stat-cards">
        <StatGrid cols={4}>
          <StatCard title="Abertas" value={statusCounts.aberta ?? 0} icon={Clock} color="info" />
          <StatCard title="Vencendo Hoje" value={dueTodayCount} icon={AlertTriangle} color="warning" />
          <StatCard title="Em Atraso" value={overdueCount} icon={AlertTriangle} color="danger" />
          <StatCard
            title="Valor em Sacolas"
            value={fmt(consignments.filter((c) => c.status === "aberta").reduce((sum, c) => sum + c.items.reduce((s, it) => s + Number(it.unit_price) * it.quantity, 0), 0))}
            icon={ShoppingBag}
            color="default"
          />
        </StatGrid>
      </div>

      {/* Search */}
      <FilterLine>
        <FilterLineSection grow>
          <FilterLineSearch
            aria-label="Buscar consignação"
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Buscar por número ou cliente..."
          />
        </FilterLineSection>
        <FilterLineSection>
          <span className="text-xs text-slate-500">{filtered.length} sacola(s)</span>
        </FilterLineSection>
      </FilterLine>

      {/* Abas por situação */}
      <div data-tour="consignments-status-tabs">
        <Tabs<ConsignmentFilter> items={statusTabItems} value={statusFilter} onChange={setStatusFilter} label="Situação das sacolas">
          {null}
        </Tabs>
      </div>

      {/* List */}
      <div data-tour="consignments-table">
        <ContentCard padding="none" className="overflow-hidden">
          <GridTable<Consignment>
            noDesktopCard
            data={consignmentsPagination.paginatedData}
            columns={columns}
            keyExtractor={(c) => c.id}
            isLoading={loading}
            onRowClick={openDetail}
            emptyMessage={<EmptyState icon={ShoppingBag} title="Nenhuma consignação encontrada" description={searchTerm ? "Ajuste a busca para ver outras sacolas." : undefined} />}
            pagination={{
              total: filtered.length,
              page: consignmentsPagination.page,
              pageSize: consignmentsPagination.pageSize,
              onPageChange: consignmentsPagination.setPage,
              onPageSizeChange: consignmentsPagination.setPageSize,
            }}
          />
        </ContentCard>
      </div>

      {/* ── CREATE MODAL ─────────────────────────────────────────────────── */}
      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        size="lg"
        title="Nova Sacola de Consignação"
        footer={
          <ModalFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button
              onClick={handleCreate}
              loading={saving}
              iconLeft={<ShoppingBag size={14} />}
              disabled={saving || !form.customer_name || draftItems.length === 0 || !!selectedCustomer?.risk_flag || overLimit}
            >
              Criar Sacola
            </Button>
          </ModalFooter>
        }
      >
        <Tabs<CreateTab>
          items={CREATE_TABS.map((t) => (t.id === "produtos" ? { ...t, badge: draftItems.length || undefined } : t))}
          value={createTab}
          onChange={setCreateTab}
          label="Dados da nova sacola"
        >
          {createTab === "dados" && (
            <div className="space-y-4">
              {/* Cliente */}
              <div data-tour="consignments-form-customer" className="space-y-2">
                <span className="ds-label block">Cliente</span>
                <div className="flex gap-2">
                  <div className="min-w-0 flex-1">
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
                  <IconButton
                    variant="outline"
                    onClick={() => { setNcName(""); setNcPhone(""); setShowNewCustomer(true); }}
                    title="Cadastrar novo cliente"
                    aria-label="Cadastrar novo cliente"
                  >
                    <UserPlus size={15} />
                  </IconButton>
                </div>
                <Input
                  aria-label="Telefone do cliente"
                  value={form.customer_phone}
                  onChange={(e) => setForm((f) => ({ ...f, customer_phone: e.target.value }))}
                  placeholder="Telefone"
                />
                {customerOpenConsignments.length > 0 && (
                  <Alert variant="warning">
                    Este cliente já tem {customerOpenConsignments.length === 1 ? "uma sacola aberta" : `${customerOpenConsignments.length} sacolas abertas`} (
                    {customerOpenConsignments.map((c) => formatBagNumber(c.number)).join(", ")}
                    ). Você pode criar outra mesmo assim.
                  </Alert>
                )}
                {selectedCustomer?.risk_flag && (
                  <Alert variant="error">Este cliente está marcado como risco — não será possível criar consignação para ele.</Alert>
                )}
                {consignmentLimit > 0 && (
                  <div className={cn(
                    "grid grid-cols-3 gap-2 rounded-lg border px-3 py-2.5 text-[11px]",
                    overLimit ? "border-red-200 bg-red-50" : "border-slate-200 bg-slate-50"
                  )}>
                    <div>
                      <p className="text-slate-500">Limite</p>
                      <p className="font-semibold tabular-nums text-slate-700">{fmt(consignmentLimit)}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Em Consignação</p>
                      <p className="font-semibold tabular-nums text-slate-700">{fmt(selectedCustomerOpenAmount + draftTotal)}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Disponível</p>
                      <p className={cn("font-semibold tabular-nums", overLimit ? "text-red-600" : "text-emerald-600")}>
                        {fmt(Math.max(0, consignmentLimit - selectedCustomerOpenAmount - draftTotal))}
                      </p>
                    </div>
                    {overLimit && (
                      <p className="col-span-3 font-medium text-red-600">Limite de consignação excedido — remova itens ou aumente o limite do cliente.</p>
                    )}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div data-tour="consignments-form-due-days">
                  <Input
                    label="Prazo (dias)"
                    type="number" min="1"
                    value={form.due_days}
                    onChange={(e) => setForm((f) => ({ ...f, due_days: e.target.value }))}
                  />
                </div>
                <Select
                  label="Vendedor"
                  value={form.seller_id ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, seller_id: e.target.value === "" ? null : Number(e.target.value) }))}
                >
                  <option value="">Sem vendedor</option>
                  {sellerOptions}
                </Select>
              </div>

              <Textarea
                label="Observações (opcional)"
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                rows={2}
              />
            </div>
          )}

          {createTab === "produtos" && (
            <div className="space-y-3">
              <div className="relative">
                <Input
                  label="Produtos da Sacola"
                  iconLeft={<Search size={13} />}
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder="Buscar produto por nome..."
                />
                {filteredProducts.length > 0 && (
                  <div className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white">
                    {filteredProducts.slice(0, 8).map((p) => (
                      <button
                        type="button"
                        key={p.id}
                        onClick={() => addDraftItem(p)}
                        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs transition-colors hover:bg-slate-50"
                      >
                        <span className="min-w-0 break-words font-medium text-slate-700">{p.name}</span>
                        <span className="shrink-0 text-[11px] tabular-nums text-slate-500">{fmt(Number(p.discount_price ?? p.price))} · estoque {p.stock_quantity}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {draftItems.length === 0 ? (
                <EmptyState icon={Package} title="Nenhum produto adicionado" description="Busque um produto acima para incluir na sacola." />
              ) : (
                <div className="space-y-2">
                  {draftItems.map((d) => (
                    <div key={d.product.id} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                      <Package size={14} className="shrink-0 text-slate-400" />
                      <span className="min-w-0 flex-1 truncate text-xs font-medium text-slate-700">{d.product.name}</span>
                      <Input
                        size="sm"
                        aria-label={`Quantidade de ${d.product.name}`}
                        wrapperClassName="w-16"
                        className="text-center"
                        type="number" min="1" max={d.product.stock_quantity}
                        value={d.quantity}
                        onChange={(e) => updateDraftQty(d.product.id, Number(e.target.value) || 1)}
                      />
                      <span className="w-20 text-right text-[11px] tabular-nums text-slate-500">
                        {fmt(Number(d.product.discount_price ?? d.product.price) * d.quantity)}
                      </span>
                      <IconButton size="xs" variant="danger" aria-label={`Remover ${d.product.name}`} onClick={() => removeDraftItem(d.product.id)}>
                        <Trash2 size={14} />
                      </IconButton>
                    </div>
                  ))}
                  <p className="text-right text-xs font-semibold text-slate-700">Total: {fmt(draftTotal)}</p>
                </div>
              )}
            </div>
          )}
        </Tabs>
      </Modal>

      {/* ── NEW CUSTOMER MODAL ───────────────────────────────────────────── */}
      <Modal
        open={showNewCustomer}
        onClose={() => setShowNewCustomer(false)}
        size="xs"
        title="Novo Cliente"
        footer={
          <ModalFooter>
            <Button variant="outline" onClick={() => setShowNewCustomer(false)}>Cancelar</Button>
            <Button onClick={handleCreateCustomer} loading={savingNC} disabled={savingNC || !ncName.trim()}>Salvar</Button>
          </ModalFooter>
        }
      >
        <div className="space-y-3">
          <Input label="Nome" value={ncName} onChange={(e) => setNcName(e.target.value)} placeholder="Nome" />
          <Input label="Telefone" value={ncPhone} onChange={(e) => setNcPhone(e.target.value)} placeholder="Telefone" />
        </div>
      </Modal>

      {/* ── DETAIL MODAL ────────────────────────────────────────────────── */}
      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        size="lg"
        title={selected ? `Sacola ${formatBagNumber(selected.number)}` : ""}
        subtitle={selected?.customer_name}
        footer={selected && selected.status === "aberta" ? (
          <ModalFooter>
            <Button variant="outline" iconLeft={<Pencil size={14} />} onClick={openEditModal}>Editar</Button>
            <Button variant="danger" iconLeft={<Ban size={14} />} onClick={handleCancel}>Cancelar</Button>
            <Button variant="success" iconLeft={<CheckCircle2 size={14} />} onClick={openResolveModal}>Resolver Sacola</Button>
          </ModalFooter>
        ) : selected && selected.status === "cancelada" && isAdmin ? (
          <ModalFooter>
            <Button iconLeft={<RotateCcw size={14} />} loading={reopening} disabled={reopening} onClick={handleReopen}>Reabrir Sacola</Button>
          </ModalFooter>
        ) : undefined}
      >
        {selected && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge size="md" color={STATUS_BADGE[displayStatus(selected)]} icon={DERIVED_STATUS_META[displayStatus(selected)].icon}>
                {DERIVED_STATUS_META[displayStatus(selected)].label}
              </Badge>
            </div>

            {isOverdue(selected) && (
              <Alert variant="error">Prazo vencido em {new Date(selected.due_date).toLocaleDateString("pt-BR")}</Alert>
            )}

            <Tabs<DetailTab>
              items={[
                { ...DETAIL_TABS[0], badge: selected.items.length },
                { ...DETAIL_TABS[1], badge: selected.actions?.length ?? 0 },
              ]}
              value={detailTab}
              onChange={setDetailTab}
              label="Detalhes da sacola"
            >
              {detailTab === "items" ? (
                <div className="space-y-3">
                  <PanelCard title="Dados da sacola">
                    <dl className="grid grid-cols-1 gap-x-6 sm:grid-cols-2">
                      <DetailField label="Prazo" value={`${new Date(selected.due_date).toLocaleDateString("pt-BR")} (${selected.due_days}d)`} />
                      <DetailField label="Vendedor" value={selected.seller_name} />
                    </dl>
                  </PanelCard>

                  {selected.notes && <Alert variant="warning" title="Observações">{selected.notes}</Alert>}

                  <PanelCard title="Itens" icon={Package} contentClassName="p-0">
                    <div className="divide-y divide-slate-100">
                      {selected.items.map((it) => (
                        <div key={it.id} className="flex items-center gap-3 px-3 py-2.5">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100">
                            <Package size={15} className="text-slate-400" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-medium text-slate-700">{it.name} × {it.quantity}</p>
                            <p className="text-[11px] tabular-nums text-slate-500">{fmt(Number(it.unit_price) * it.quantity)}</p>
                          </div>
                          {it.resolution !== "pending" ? (
                            <Badge color={it.resolution === "kept" ? "success" : "default"}>{it.resolution === "kept" ? "Ficou" : "Voltou"}</Badge>
                          ) : (
                            <Badge color="primary">Pendente</Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  </PanelCard>

                  {selected.cancel_reason && (
                    <Alert variant="error" title="Motivo do cancelamento">{selected.cancel_reason}</Alert>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  {(!selected.actions || selected.actions.length === 0) ? (
                    <EmptyState icon={History} title="Nenhum evento registrado ainda" />
                  ) : (
                    selected.actions.map((a) => (
                      <div key={a.id} className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5">
                        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100">
                          <History size={13} className="text-slate-400" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-slate-700">{ACTION_LABELS[a.action] ?? a.action}</p>
                          {a.note && <p className="mt-0.5 break-words text-[11px] text-slate-500">{a.note}</p>}
                          <p className="mt-1 text-[11px] text-slate-500">
                            {a.actor ?? "Sistema"} · {new Date(a.created_at).toLocaleString("pt-BR")}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </Tabs>
          </div>
        )}
      </Modal>

      {/* ── RESOLVE MODAL (ficou/voltou + pagamento) ────────────────────── */}
      <Modal
        open={showResolveModal && !!selected}
        onClose={() => setShowResolveModal(false)}
        size="md"
        title={selected ? `Resolver Sacola ${formatBagNumber(selected.number)}` : ""}
        footer={
          <ModalFooter>
            <Button variant="outline" onClick={() => setShowResolveModal(false)}>Cancelar</Button>
            <Button
              variant="success"
              iconLeft={<CheckCircle2 size={14} />}
              loading={resolving}
              onClick={handleResolve}
              disabled={resolving || decidedCount === 0 || (hasKeptItems && paidTotal <= 0)}
            >
              Confirmar
            </Button>
          </ModalFooter>
        }
      >
        {selected && (
          <Tabs<ResolveTab>
            items={RESOLVE_TABS.map((t) => (t.id === "pagamento" ? { ...t, disabled: !hasKeptItems } : t))}
            value={hasKeptItems ? resolveTab : "itens"}
            onChange={setResolveTab}
            label="Resolução da sacola"
          >
            {(!hasKeptItems || resolveTab === "itens") ? (
              <div className="space-y-3">
                {/* Ficou / Voltou por item */}
                <p className="text-[11px] text-slate-500">Marque o que ficou, o que voltou — ou deixe pendente pra decidir depois</p>
                <div className="space-y-2">
                  {selected.items.filter((it) => it.resolution === "pending").map((it) => (
                    <div key={it.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <span className="min-w-0 break-words text-xs font-medium text-slate-700">{it.name} × {it.quantity}</span>
                        <span className="shrink-0 text-[11px] tabular-nums text-slate-500">{fmt(Number(it.unit_price) * it.quantity)}</span>
                      </div>
                      <div className="flex gap-0.5 rounded-lg border border-slate-200 bg-white p-0.5">
                        <button
                          type="button"
                          onClick={() => toggleResolution(it.id, "kept")}
                          className={cn("h-8 flex-1 rounded-md text-[11px] font-medium transition-all", resolutions[it.id] === "kept" ? "bg-emerald-600 text-white" : "text-slate-500 hover:bg-slate-50")}
                        >
                          Ficou
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleResolution(it.id, "returned")}
                          className={cn("h-8 flex-1 rounded-md text-[11px] font-medium transition-all", resolutions[it.id] === "returned" ? "bg-slate-600 text-white" : "text-slate-500 hover:bg-slate-50")}
                        >
                          Voltou
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleResolution(it.id, "pending")}
                          className={cn("h-8 flex-1 rounded-md text-[11px] font-medium transition-all", resolutions[it.id] === "pending" ? "bg-blue-600 text-white" : "text-slate-500 hover:bg-slate-50")}
                        >
                          Pendente
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {leftPendingCount > 0 ? (
                  <Alert variant="info">
                    {leftPendingCount} item(ns) ficará(ão) pendente(s) — a sacola continua aberta como "parcial" até você decidir o restante.
                  </Alert>
                ) : !hasKeptItems && (
                  <Alert variant="info">
                    Nenhum item ficou — a sacola será fechada como devolução total, sem gerar venda.
                  </Alert>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {/* Vendedor */}
                <Select
                  label="Vendedor"
                  value={invoiceSellerId}
                  onChange={(e) => setInvoiceSellerId(e.target.value === "" ? "" : Number(e.target.value))}
                >
                  <option value="">Sem vendedor</option>
                  {sellerOptions}
                </Select>

                {/* Pagamentos */}
                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="ds-label">Formas de Pagamento</span>
                    <Button variant="outline" size="xs" iconLeft={<PlusCircle size={12} />} onClick={addInvoicePayment}>
                      Adicionar
                    </Button>
                  </div>
                  <div className="space-y-2.5">
                    {invoicePayments.map((p, idx) => {
                      const cardFees = tenant?.card_fees ?? {};
                      const feeRate = p.method === "credit" ? (cardFees[p.cardBrand]?.[p.installments - 1] ?? 0) : 0;
                      const pAmt = Number(p.amount) || 0;
                      const pFee = feeRate > 0 && pAmt > 0 ? pAmt * (feeRate / 100) : 0;
                      return (
                        <div key={p.id} className="space-y-2.5 rounded-lg border border-slate-200 bg-slate-50 p-3">
                          <div className="flex items-center gap-2">
                            {invoicePayments.length > 1 && (
                              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[11px] font-semibold text-slate-600">{idx + 1}</span>
                            )}
                            <div className="grid flex-1 grid-cols-2 gap-1.5 sm:grid-cols-4">
                              {(["money", "debit", "credit", "pix"] as PayMethod[]).map((key) => (
                                <button type="button" key={key} onClick={() => updateInvoicePayment(p.id, {
                                  method: key, installments: 1,
                                  amount: key !== "money" && keptTotal > 0 ? keptTotal.toFixed(2) : p.amount,
                                })}
                                  className={cn("flex h-9 flex-col items-center justify-center gap-0.5 rounded-lg border text-[11px] font-medium transition-all",
                                    p.method === key ? key === "credit" ? "border-emerald-500 bg-emerald-600 text-white" : "border-blue-500 bg-blue-600 text-white" : "border-slate-200 bg-white text-slate-500 hover:border-slate-400")}>
                                  {key === "money" && <Banknote size={12} />}
                                  {key === "debit" && <CreditCard size={12} />}
                                  {key === "credit" && <CreditCard size={12} />}
                                  {key === "pix" && <QrCode size={12} />}
                                  {PM_LABEL[key]}
                                </button>
                              ))}
                            </div>
                            {invoicePayments.length > 1 && (
                              <IconButton size="xs" variant="danger" aria-label="Remover forma de pagamento" onClick={() => removeInvoicePayment(p.id)}>
                                <X size={14} />
                              </IconButton>
                            )}
                          </div>

                          {(p.method === "debit" || p.method === "credit") && (
                            <div className="grid grid-cols-3 gap-1">
                              {CARD_BRANDS.map(({ key, label, color }) => (
                                <button type="button" key={key} onClick={() => updateInvoicePayment(p.id, { cardBrand: key })}
                                  className={cn("h-7 rounded-lg border text-[11px] font-medium transition-all", p.cardBrand === key ? "border-transparent text-white" : "border-slate-200 bg-white text-slate-500 hover:border-slate-400")}
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
                                  <button type="button" key={n} onClick={() => updateInvoicePayment(p.id, { installments: n })}
                                    className={cn("flex flex-col items-center justify-center gap-0.5 rounded-lg border px-1 py-1.5 transition-all", isActive ? "border-emerald-500 bg-emerald-600 text-white" : "border-slate-200 bg-white text-slate-500 hover:border-slate-400")}>
                                    <span className="text-[11px] font-medium">{n === 1 ? "Vista" : `${n}×`}</span>
                                    {rate > 0 && <span className={cn("text-[10px] font-medium", isActive ? "text-emerald-200" : "text-amber-500")}>+{rate}%</span>}
                                  </button>
                                );
                              })}
                            </div>
                          )}

                          <div className="flex gap-2">
                            <Input
                              wrapperClassName="flex-1"
                              aria-label="Valor do pagamento"
                              iconLeft={<Banknote size={13} />}
                              type="number" min="0" step="0.01"
                              placeholder={idx === 0 && remaining > 0 ? `R$ ${remaining.toFixed(2)}` : "Valor (R$)"}
                              value={p.amount} onChange={(e) => updateInvoicePayment(p.id, { amount: e.target.value })}
                            />
                            {pFee > 0.005 && (
                              <div className="flex shrink-0 flex-col items-end gap-0.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5">
                                <span className="text-[11px] font-medium text-amber-600">Taxa {feeRate}%</span>
                                <span className="text-[11px] font-semibold tabular-nums text-amber-700">− R$ {pFee.toFixed(2)}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Resumo */}
                <PanelCard title="Resumo">
                  <dl className="grid grid-cols-1 gap-x-6 sm:grid-cols-3">
                    <DetailField label="Total dos itens que ficaram" value={fmt(keptTotal)} />
                    <DetailField label="Pago" value={fmt(paidTotal)} />
                    <DetailField label={remaining > 0.005 ? "Restante" : "Pagamento"} value={remaining > 0.005 ? fmt(remaining) : "OK"} />
                  </dl>
                </PanelCard>
              </div>
            )}
          </Tabs>
        )}
      </Modal>

      {/* ── EDIT MODAL (prazo/vendedor/observações de sacola aberta) ─────── */}
      <Modal
        open={showEditModal && !!selected}
        onClose={() => setShowEditModal(false)}
        size="sm"
        title={selected ? `Editar Sacola ${formatBagNumber(selected.number)}` : ""}
        footer={
          <ModalFooter>
            <Button variant="outline" onClick={() => setShowEditModal(false)}>Cancelar</Button>
            <Button onClick={handleSaveEdit} loading={savingEdit} disabled={savingEdit}>Salvar</Button>
          </ModalFooter>
        }
      >
        <div className="space-y-3">
          <Input
            label="Prazo (dias, a partir da criação)"
            type="number" min="1"
            value={editDueDays}
            onChange={(e) => setEditDueDays(e.target.value)}
          />
          <Select
            label="Vendedor"
            value={editSellerId ?? ""}
            onChange={(e) => setEditSellerId(e.target.value === "" ? null : Number(e.target.value))}
          >
            <option value="">Sem vendedor</option>
            {sellerOptions}
          </Select>
          <Textarea label="Observações" value={editNotes} onChange={(e) => setEditNotes(e.target.value)} rows={3} />
        </div>
      </Modal>
    </div>
  );
}
