import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Product } from "../types";
import { cn } from "../lib/utils";
import { productHasStock } from "../utils/productStock";
import {
  cacheGet, cacheSet, countPendingCashOps, countPendingSales, getPendingSales, queueCashOp, queueSale, type PendingSale,
} from "../lib/offlineDb";
import { syncPendingOps } from "../lib/pdvSync";
import { renewLogin } from "../lib/offlineLogin";
import {
  fetchCurrentCashSession, openCashSession as apiOpenCashSession, closeCashSession as apiCloseCashSession,
  type CashSessionInfo,
} from "../lib/cashSession";
import { buildCashCloseReceiptText, buildOrderReceiptText, printThermalText } from "../lib/thermalReceipt";
import { cancelHeldSale, createHeldSale, getOpenHeldSalesCount, listHeldSales, resumeHeldSale, type HeldSale } from "../lib/heldSales";
import { ClassicCloseCash, ClassicLogin, ClassicOpenCash } from "../components/pdv/ClassicCash";
import { ToastProvider } from "../components/ui/Toast";

// ─── Caixa Clássico ──────────────────────────────────────────────────────────
// Segundo modelo de PDV: tela de balcão tradicional, toda por teclado (F2…F10), com
// código/nome do produto, lista de itens e pagamento em tela própria. Usa a mesma API,
// o mesmo banco local (SQLite do Electron) e a mesma fila de sincronização do PDV padrão,
// então também vende e abre/fecha caixa 100% offline.

type PaymentMethod = "money" | "debit" | "credit" | "pix" | "crediario";
type CardBrand = "visa" | "master" | "elo" | "amex" | "hiper" | "other";

const PM_LABEL: Record<PaymentMethod, string> = {
  money: "Dinheiro", pix: "PIX", debit: "Cartão de Débito", credit: "Cartão de Crédito", crediario: "Crediário",
};
const PM_SHORT: Record<PaymentMethod, string> = {
  money: "Dinheiro", pix: "PIX", debit: "Débito", credit: "Crédito", crediario: "Crediário",
};
const PAY_ORDER: PaymentMethod[] = ["money", "pix", "debit", "credit", "crediario"];
const BRANDS: { key: CardBrand; label: string }[] = [
  { key: "visa", label: "Visa" }, { key: "master", label: "Mastercard" }, { key: "elo", label: "Elo" },
  { key: "amex", label: "Amex" }, { key: "hiper", label: "Hipercard" }, { key: "other", label: "Outra" },
];

interface CartItem extends Product {
  price: number;
  quantity: number;
  cartItemId: string;
  variationLabel: string;
  selectedOptions?: Record<string, string>;
  heldSaleItemId?: number;
}

interface PaymentEntry {
  id: string;
  method: PaymentMethod;
  cardBrand: CardBrand;
  installments: number;
  amount: string;
  crediarioInstallments: number;
  crediarioFirstDueDate: string;
}

interface Seller { id: number; name: string; user_id?: number | null }
interface Customer { id: number; name: string; phone?: string; document?: string }
type Tenant = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

interface Completed {
  orderId: number;
  offline: boolean;
  total: number;
  change: number;
  receiptText: string;
  nfce?: string;
}

const money = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const num = (v: string) => {
  const n = Number(String(v).replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};
const norm = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

function defaultFirstDue() {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Separa produtos vendidos por medida (m²/metro), que precisam de largura/altura — esse
// fluxo só existe no PDV padrão.
const isMeasured = (p: Product) => !!p.sale_unit && !["unidade", "peso", "volume"].includes(p.sale_unit);

// ─── UI helpers ──────────────────────────────────────────────────────────────
function Overlay({ title, onClose, children, width = 520 }: { title: string; onClose: () => void; children: React.ReactNode; width?: number }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onMouseDown={onClose}>
      <div className="max-h-[90vh] w-full overflow-auto rounded-sm bg-white p-6 shadow-2xl" style={{ maxWidth: width }} onMouseDown={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-[#0b4f75]">{title}</h2>
          <button onClick={onClose} className="text-sm font-semibold text-slate-400 hover:text-slate-700">ESC</button>
        </div>
        {children}
      </div>
    </div>
  );
}

const inputCls = "h-11 w-full rounded-sm border border-[#c5cfdf] bg-white px-3 text-[15px] text-slate-800 outline-none focus:border-[#0078d4] focus:ring-2 focus:ring-[#0078d4]/20 disabled:bg-slate-100 read-only:bg-slate-100";
const labelCls = "mb-1 block text-[12px] font-medium text-slate-500";
const btn = (tone: "blue" | "green" | "red" | "navy" | "gray") =>
  cn(
    "h-12 rounded-sm px-5 text-[13px] font-semibold uppercase tracking-wide text-white shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50",
    tone === "blue" && "bg-[#0078d4] hover:bg-[#006abd]",
    tone === "green" && "bg-[#1b7e0e] hover:bg-[#166a0b]",
    tone === "red" && "bg-[#c00000] hover:bg-[#a00000]",
    tone === "navy" && "bg-[#44519c] hover:bg-[#394585]",
    tone === "gray" && "bg-slate-500 hover:bg-slate-600",
  );

// ─── Tela ────────────────────────────────────────────────────────────────────
function ClassicPDV() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("token"));
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  const [products, setProducts] = useState<Product[]>([]);
  const [tenant, setTenant] = useState<Tenant>({});
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);

  const [cashSession, setCashSession] = useState<CashSessionInfo | null>(null);
  const [cashLoading, setCashLoading] = useState(true);
  const [requireCash, setRequireCash] = useState(false);
  const [showCloseCash, setShowCloseCash] = useState(false);

  const [pendingCount, setPendingCount] = useState(0);
  const [dataAt, setDataAt] = useState<string | null>(null);
  const [refreshingData, setRefreshingData] = useState(false);
  const [heldCount, setHeldCount] = useState(0);
  const [notice, setNotice] = useState<{ text: string; tone: "ok" | "err" } | null>(null);

  // venda
  const [screen, setScreen] = useState<"sale" | "payment">("sale");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [code, setCode] = useState("");
  const [qty, setQty] = useState("1");
  const [picked, setPicked] = useState<Product | null>(null);
  const [activeSuggestion, setActiveSuggestion] = useState(0);
  const [scannerMode, setScannerMode] = useState(false);
  const [activeHeldId, setActiveHeldId] = useState<number | null>(null);
  const [saleNumber, setSaleNumber] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);   // linha selecionada na lista (↑ ↓ / Del)
  const [lastAdded, setLastAdded] = useState<{ name: string; variation: string; qty: number; price: number } | null>(null);

  // pagamento
  const [payments, setPayments] = useState<PaymentEntry[]>([]);
  const [payMethod, setPayMethod] = useState<PaymentMethod>("money");
  const [payBrand, setPayBrand] = useState<CardBrand>("visa");
  const [payInstallments, setPayInstallments] = useState(1);
  const [payAmount, setPayAmount] = useState("");
  const [discount, setDiscount] = useState("");
  const [discountMode, setDiscountMode] = useState<"R$" | "%">("R$");
  const [surcharge, setSurcharge] = useState("");
  const [surchargeMode, setSurchargeMode] = useState<"R$" | "%">("R$");
  const [customerId, setCustomerId] = useState<number | null>(null);
  const [sellerId, setSellerId] = useState<number | null>(null);
  const [printReceipt, setPrintReceipt] = useState(true);
  const [emitNfce, setEmitNfce] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [completed, setCompleted] = useState<Completed | null>(null);

  // modais
  type Modal = null | "variation" | "operator" | "held" | "discount" | "customer" | "seller" | "qty" | "confirmCancel";
  const [modal, setModal] = useState<Modal>(null);
  const [variationProduct, setVariationProduct] = useState<Product | null>(null);
  const [variationOptions, setVariationOptions] = useState<Record<string, string>>({});
  const [heldList, setHeldList] = useState<HeldSale[]>([]);
  const [lookup, setLookup] = useState("");
  const [editingItem, setEditingItem] = useState<CartItem | null>(null);
  const [editQty, setEditQty] = useState("1");

  const codeRef = useRef<HTMLInputElement>(null);
  const payRef = useRef<HTMLInputElement>(null);

  const user = useMemo(() => {
    try { return JSON.parse(localStorage.getItem("user") || "null") as { name?: string; email?: string; id?: number } | null; } catch { return null; }
  }, [token]);
  const operatorName = user?.name || user?.email || "Operador";

  const flash = useCallback((text: string, tone: "ok" | "err" = "err") => {
    setNotice({ text, tone });
    window.setTimeout(() => setNotice((n) => (n?.text === text ? null : n)), 3500);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setToken(null);
  }, []);

  const sellWithoutStock = !!tenant.sell_without_stock_control;
  const cardFees = (tenant.card_fees ?? {}) as Record<string, number[]>;
  const passFeeToCustomer = !!tenant.pass_fee_to_customer;
  const passFeeByMethod = (tenant.pass_fee_by_method ?? {}) as Record<string, boolean>;
  const maxInstallments = Number(tenant.max_installments) || 12;

  // ── dados (com cópia local para uso offline) ───────────────────────────────
  const refreshPending = useCallback(() => {
    Promise.all([countPendingSales(), countPendingCashOps()]).then(([a, b]) => setPendingCount(a + b));
  }, []);

  // Fonte principal dos dados = banco local do terminal (abastecido em segundo plano pelo app
  // com o pacote leve da loja). Abre instantâneo e funciona sem internet; a API só é usada
  // na primeira vez, quando o pacote ainda não foi baixado.
  const applyLocalData = useCallback(async () => {
    const [p, t, sl, c, meta, pending] = await Promise.all([
      cacheGet<Product[]>("products"), cacheGet<Tenant>("tenant"), cacheGet<Seller[]>("sellers"),
      cacheGet<Customer[]>("customers"), cacheGet<{ at: string }>("snapshot_meta"), getPendingSales(),
    ]);
    if (!Array.isArray(p) || p.length === 0) return false;
    // vendas feitas offline que ainda não subiram não estão no estoque do servidor: abate aqui
    const used = new Map<number, number>();
    for (const sale of pending) {
      for (const it of ((sale.body.items as { id?: number; quantity: number }[]) ?? [])) {
        if (it.id != null) used.set(it.id, (used.get(it.id) ?? 0) + it.quantity);
      }
    }
    setProducts(used.size ? p.map((x) => (used.has(x.id) ? { ...x, stock_quantity: x.stock_quantity - used.get(x.id)! } : x)) : p);
    if (t) { setTenant(t); if (t.require_cash_session !== undefined) setRequireCash(Boolean(t.require_cash_session)); }
    if (Array.isArray(sl)) setSellers(sl);
    if (Array.isArray(c)) setCustomers(c);
    if (meta?.at) setDataAt(meta.at);
    return true;
  }, []);

  // Primeira carga sem pacote local (ex.: acabou de instalar): busca direto da API.
  const loadFromApi = useCallback(async (t: string) => {
    const headers = { Authorization: `Bearer ${t}` };
    try {
      const [prods, tn] = await Promise.all([
        fetch("/api/products", { headers }).then((r) => { if (r.status === 401) { logout(); throw new Error("unauth"); } return r.json(); }),
        fetch("/api/tenant", { headers }).then((r) => r.json()),
      ]);
      if (Array.isArray(prods)) { setProducts(prods); cacheSet("products", prods); }
      if (tn) { setTenant(tn); cacheSet("tenant", tn); if (tn.require_cash_session !== undefined) setRequireCash(Boolean(tn.require_cash_session)); }
    } catch { /* sem internet e sem pacote local: nada a mostrar ainda */ }
    fetch("/api/sellers", { headers }).then((r) => r.json()).then((d) => {
      const list = Array.isArray(d) ? d.filter((x: Seller & { is_active?: boolean }) => x.is_active !== false) : [];
      setSellers(list); cacheSet("sellers", list);
    }).catch(() => {});
    fetch("/api/customers", { headers }).then((r) => r.json()).then((d) => {
      const list = Array.isArray(d) ? d : [];
      setCustomers(list); cacheSet("customers", list);
    }).catch(() => {});
  }, [logout]);

  // Pede ao app para baixar o pacote agora e recarrega a tela com o resultado.
  const refreshData = useCallback(async () => {
    setRefreshingData(true);
    try {
      const res = await window.boxsysDesktop?.syncOfflineData?.();
      if (res && !res.ok) flash(res.error || "Não foi possível atualizar os dados agora.");
      else if (!res && token && navigator.onLine) await loadFromApi(token);
      await applyLocalData();
    } finally {
      setRefreshingData(false);
    }
  }, [applyLocalData, flash, loadFromApi, token]);

  useEffect(() => {
    if (!token) { setCashLoading(false); return; }

    fetchCurrentCashSession(token)
      .then(({ requireCashSession, session }) => {
        void renewLogin(user?.id);
        setRequireCash(requireCashSession);
        setCashSession(session);
        cacheSet("cashSession", session);
      })
      .catch(async () => {
        const [session, cachedTenant] = await Promise.all([cacheGet<CashSessionInfo>("cashSession"), cacheGet<Tenant>("tenant")]);
        if (session) setCashSession(session);
        if (cachedTenant?.require_cash_session !== undefined) setRequireCash(Boolean(cachedTenant.require_cash_session));
      })
      .finally(() => setCashLoading(false));

    setLoading(true);
    applyLocalData()
      .then((ok) => (ok ? undefined : loadFromApi(token)))
      .finally(() => setLoading(false));

    // acompanha o pacote que o app baixa em segundo plano (a cada ~5 min)
    const watch = window.setInterval(() => { void applyLocalData(); }, 60_000);

    getOpenHeldSalesCount(token).then(setHeldCount).catch(() => {});
    refreshPending();
    return () => window.clearInterval(watch);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // ── sincronização offline ──────────────────────────────────────────────────
  const syncNow = useCallback(async () => {
    if (!token || !navigator.onLine) return;
    const result = await syncPendingOps(token);
    refreshPending();
    if (result.sessionIdByLocalId.size > 0) {
      setCashSession((s) => {
        if (!s?.localId || !result.sessionIdByLocalId.has(s.localId)) return s;
        const refreshed = { ...s, id: result.sessionIdByLocalId.get(s.localId)!, localId: undefined };
        cacheSet("cashSession", refreshed);
        return refreshed;
      });
    }
    if (result.synced > 0) {
      flash(`${result.synced} registro${result.synced > 1 ? "s" : ""} sincronizado${result.synced > 1 ? "s" : ""}!`, "ok");
      void refreshData(); // traz o estoque já atualizado pelo servidor
    }
  }, [token, refreshPending, flash, refreshData]);

  useEffect(() => {
    const goOnline = () => { setIsOnline(true); syncNow(); };
    const goOffline = () => setIsOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    syncNow();
    const interval = setInterval(() => { if (navigator.onLine) syncNow(); }, 60_000);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
      clearInterval(interval);
    };
  }, [syncNow]);

  // ── busca de produto ───────────────────────────────────────────────────────
  const suggestions = useMemo(() => {
    const q = norm(code.trim().replace(/^\d+(?:[.,]\d+)?\s*\*\s*/, ""));
    if (!q || picked) return [];
    return products
      .filter((p) => (sellWithoutStock || productHasStock(p)) && (
        norm(p.name).includes(q) || (p.sku ?? "").toLowerCase().includes(q) || (p.barcode ?? "").toLowerCase().includes(q)
      ))
      .slice(0, 8);
  }, [code, products, picked, sellWithoutStock]);

  const unitPrice = picked ? Number(picked.discount_price || picked.price) : 0;
  const lineTotal = unitPrice * (num(qty) || 0);

  const addItem = useCallback((product: Product, quantity: number, options?: Record<string, string>) => {
    if (isMeasured(product)) { flash("Produto vendido por medida (m²/metro): use o PDV padrão para este item."); return false; }
    if (!(quantity > 0)) { flash("Informe uma quantidade válida."); return false; }
    const hasAttr = Array.isArray(product.attributes) && product.attributes.length > 0;
    const hasLegacy = !hasAttr && Array.isArray(product.variations) && product.variations.length > 0;
    if ((hasAttr || hasLegacy) && !options) {
      const init: Record<string, string> = {};
      if (hasAttr) product.attributes!.forEach((a) => { init[a.name] = a.values[0] ?? ""; });
      else product.variations!.forEach((v) => { init[v.name] = v.options[0]?.value ?? ""; });
      setVariationProduct(product);
      setVariationOptions(init);
      setModal("variation");
      return false;
    }
    const variationLabel = options ? Object.entries(options).map(([k, v]) => `${k}: ${v}`).join(", ") : "";
    const cartItemId = options ? `${product.id}-${variationLabel}` : `${product.id}`;
    const existing = cart.find((i) => i.cartItemId === cartItemId);
    const wanted = (existing?.quantity ?? 0) + quantity;
    const tracked = product.track_stock !== false && !sellWithoutStock;
    const hasSkus = Array.isArray(product.skus) && product.skus.length > 0;
    if (tracked && !hasSkus && !hasLegacy && wanted > product.stock_quantity) {
      flash(`Estoque insuficiente para "${product.name}" (disponível: ${product.stock_quantity}).`);
      return false;
    }
    setCart((prev) => existing
      ? prev.map((i) => i.cartItemId === cartItemId ? { ...i, quantity: wanted } : i)
      : [...prev, { ...product, price: Number(product.discount_price || product.price), quantity, cartItemId, selectedOptions: options, variationLabel }]);
    setLastAdded({ name: product.name, variation: variationLabel, qty: quantity, price: Number(product.discount_price || product.price) });
    setSelectedId(cartItemId);
    return true;
  }, [cart, flash, sellWithoutStock]);

  const resetEntry = () => { setCode(""); setQty("1"); setPicked(null); setActiveSuggestion(0); codeRef.current?.focus(); };

  const handleCodeEnter = () => {
    // INCLUIR: produto já escolhido pela lista
    if (picked) {
      if (addItem(picked, num(qty))) resetEntry();
      return;
    }
    // "3*789…": digita a quantidade antes do código (convenção de balcão)
    const mult = code.trim().match(/^(\d+(?:[.,]\d+)?)\s*\*\s*(.+)$/);
    const raw = (mult ? mult[2] : code).trim();
    const qtyFromCode = mult ? num(mult[1]) : null;
    if (!raw) {
      // campo vazio: Enter abre a quantidade do item selecionado na lista
      const item = selectedId ? cart.find((i) => i.cartItemId === selectedId) : undefined;
      if (item) { setEditingItem(item); setEditQty(String(item.quantity)); setModal("qty"); }
      return;
    }
    const lower = raw.toLowerCase();
    const exact = products.find((p) => (p.barcode ?? "").toLowerCase() === lower || (p.sku ?? "").toLowerCase() === lower);
    if (exact) {
      if (!sellWithoutStock && !productHasStock(exact)) { flash(`"${exact.name}" sem estoque.`); return; }
      if (addItem(exact, qtyFromCode ?? (num(qty) || 1))) resetEntry();
      return;
    }
    if (scannerMode) { flash(`Código "${raw}" não encontrado.`); setCode(""); return; }
    const choice = suggestions[activeSuggestion] ?? suggestions[0];
    if (!choice) { flash(`Nenhum produto encontrado para "${raw}".`); return; }
    setPicked(choice);
    setCode(choice.name);
    if (qtyFromCode) setQty(String(qtyFromCode));
    setSuggestions0();
    // vai para a quantidade para confirmar com Enter
    window.setTimeout(() => document.getElementById("classic-qty")?.focus(), 0);
  };
  const setSuggestions0 = () => setActiveSuggestion(0);

  // ── totais ─────────────────────────────────────────────────────────────────
  const subtotal = cart.reduce((a, i) => a + i.price * i.quantity, 0);
  const cartMaxDiscountPct = cart.reduce<number | undefined>((min, i) => {
    const limit = i.max_discount_pct;
    if (limit == null) return min;
    return min == null ? limit : Math.min(min, limit);
  }, undefined);
  const discountRaw = num(discount);
  const discountValueRaw = discountMode === "%" ? Math.min(subtotal * discountRaw / 100, subtotal) : Math.min(discountRaw, subtotal);
  const discountPct = subtotal > 0 ? (discountValueRaw / subtotal) * 100 : 0;
  const discountExceeds = cartMaxDiscountPct != null && discountPct > cartMaxDiscountPct + 0.001;
  const discountValue = discountExceeds && cartMaxDiscountPct != null ? Math.min(subtotal * cartMaxDiscountPct / 100, subtotal) : discountValueRaw;
  const surchargeValue = surchargeMode === "%" ? subtotal * num(surcharge) / 100 : num(surcharge);
  const baseTotal = subtotal - discountValue + surchargeValue;

  const feeRate = (p: PaymentEntry) => {
    if (p.method === "credit") return cardFees[p.cardBrand]?.[p.installments - 1] ?? 0;
    if (p.method === "debit") return cardFees[`debit_${p.cardBrand}`]?.[0] ?? 0;
    if (p.method === "pix") return cardFees["pix"]?.[0] ?? 0;
    return 0;
  };
  const isPassFee = (p: PaymentEntry) => !!(passFeeByMethod[p.method] ?? passFeeToCustomer);
  const feeAmount = payments.reduce((sum, p) => {
    const rate = feeRate(p);
    if (!rate) return sum;
    const amt = num(p.amount);
    return sum + (amt > 0 ? amt : baseTotal) * (rate / 100);
  }, 0);
  const passedFee = payments.reduce((sum, p) => {
    if (!isPassFee(p)) return sum;
    const rate = feeRate(p);
    if (!rate) return sum;
    const amt = num(p.amount);
    return sum + (amt > 0 ? amt : baseTotal) * (rate / 100);
  }, 0);
  void feeAmount;
  const total = Math.round((baseTotal + passedFee) * 100) / 100;
  const paid = payments.reduce((s, p) => s + num(p.amount), 0);
  const remaining = Math.max(0, Math.round((total - paid) * 100) / 100);
  const moneyPaid = payments.filter((p) => p.method === "money").reduce((s, p) => s + num(p.amount), 0);
  const change = moneyPaid > 0 && paid >= total ? Math.round((moneyPaid - (total - (paid - moneyPaid))) * 100) / 100 : 0;
  const canFinish = cart.length > 0 && total > 0 && remaining <= 0.004;
  // troco em tempo real: dinheiro digitado acima do que falta pagar (antes mesmo de lançar o pagamento)
  const previewChange = payMethod === "money" && remaining > 0 ? Math.max(0, Math.round((num(payAmount) - remaining) * 100) / 100) : 0;
  const shownChange = previewChange > 0 ? previewChange : change;
  const pickPayMethod = (m: PaymentMethod) => { setPayMethod(m); setPayInstallments(1); window.setTimeout(() => payRef.current?.focus(), 0); };

  // ── ações ──────────────────────────────────────────────────────────────────
  const newSale = useCallback(() => {
    setCart([]); setPayments([]); setScreen("sale"); setActiveHeldId(null);
    setDiscount(""); setSurcharge(""); setCustomerId(null); setEmitNfce(false);
    setPayAmount(""); setPayMethod("money"); setPayInstallments(1);
    setSaleNumber((n) => n + 1);
    resetEntry();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cancelSale = async () => {
    if (activeHeldId && token) {
      try { await cancelHeldSale(token, activeHeldId); } catch { /* segue: o carrinho local é descartado de qualquer forma */ }
      getOpenHeldSalesCount(token).then(setHeldCount).catch(() => {});
    }
    setModal(null);
    newSale();
    setSaleNumber((n) => Math.max(1, n - 1));
  };

  const goToPayment = () => {
    if (cart.length === 0) { flash("Inclua ao menos um produto."); return; }
    setScreen("payment");
    setPayAmount(remaining > 0 ? remaining.toFixed(2).replace(".", ",") : "");
    window.setTimeout(() => payRef.current?.focus(), 50);
  };

  const holdSale = async () => {
    if (!token || cart.length === 0) return;
    if (!isOnline) { flash("Aguardar venda precisa de internet (reserva o estoque no servidor)."); return; }
    try {
      await createHeldSale(token, {
        customer_id: customerId ?? undefined,
        seller_id: sellerId ?? undefined,
        snapshot: { discount, discountMode, surcharge, surchargeMode },
        items: cart.map((i) => ({ product_id: i.id, quantity: i.quantity, selectedOptions: i.selectedOptions ?? null })),
      });
      getOpenHeldSalesCount(token).then(setHeldCount).catch(() => {});
      flash("Venda colocada em espera.", "ok");
      newSale();
      setSaleNumber((n) => Math.max(1, n - 1));
    } catch (err) {
      flash(err instanceof Error ? err.message : "Erro ao colocar a venda em espera.");
    }
  };

  const openHeld = async () => {
    if (!token) return;
    if (!isOnline) { flash("Vendas em aberto precisam de internet."); return; }
    try {
      setHeldList(await listHeldSales(token, "held"));
      setModal("held");
    } catch (err) {
      flash(err instanceof Error ? err.message : "Erro ao listar vendas em aberto.");
    }
  };

  const resumeHeld = async (held: HeldSale) => {
    if (!token) return;
    try {
      const full = await resumeHeldSale(token, held.id);
      const restored: CartItem[] = [];
      for (const it of full.items) {
        if (it.resolution !== "pending") continue;
        const product = products.find((p) => p.id === it.product_id);
        if (!product) continue;
        const variationLabel = it.selected_options ? Object.entries(it.selected_options).map(([k, v]) => `${k}: ${v}`).join(", ") : "";
        restored.push({
          ...product, price: Number(it.unit_price), quantity: it.quantity, cartItemId: `held-${it.id}`,
          selectedOptions: it.selected_options ?? undefined, variationLabel, heldSaleItemId: it.id,
        });
      }
      setCart(restored);
      setCustomerId(full.customer_id);
      setSellerId(full.seller_id);
      setDiscount(full.snapshot?.discount ?? "");
      setDiscountMode(full.snapshot?.discountMode ?? "R$");
      setSurcharge(full.snapshot?.surcharge ?? "");
      setSurchargeMode(full.snapshot?.surchargeMode ?? "R$");
      setActiveHeldId(full.id);
      setPayments([]);
      setScreen("sale");
      setModal(null);
      getOpenHeldSalesCount(token).then(setHeldCount).catch(() => {});
    } catch (err) {
      flash(err instanceof Error ? err.message : "Erro ao retomar a venda.");
    }
  };

  const addPayment = () => {
    const customerNeeded = payMethod === "crediario" && !customerId;
    if (customerNeeded) { flash("Selecione o cliente (F2) para vender no crediário."); return; }
    let amount = num(payAmount);
    if (!(amount > 0)) amount = remaining;
    if (!(amount > 0)) { flash("Informe o valor."); return; }
    if (payMethod !== "money" && amount > remaining + 0.004) amount = remaining;
    if (remaining <= 0.004) { flash("O pedido já está totalmente pago."); return; }
    setPayments((prev) => [...prev, {
      id: Math.random().toString(36).slice(2), method: payMethod, cardBrand: payBrand,
      installments: payMethod === "credit" ? payInstallments : 1, amount: amount.toFixed(2),
      crediarioInstallments: payMethod === "crediario" ? payInstallments : 1, crediarioFirstDueDate: defaultFirstDue(),
    }]);
    const left = Math.max(0, remaining - amount);
    setPayAmount(left > 0 ? left.toFixed(2).replace(".", ",") : "");
  };

  const finishSale = async () => {
    if (!canFinish || finishing) return;
    if (payments.some((p) => p.method === "crediario") && !customerId) { flash("Selecione o cliente (F2) para vender no crediário."); return; }
    setFinishing(true);

    const pmString = payments.map((p) => {
      const brand = p.method === "debit" || p.method === "credit" ? `-${p.cardBrand}` : "";
      const inst = p.method === "credit" && p.installments > 1 ? `-${p.installments}x` : "";
      return `${p.method}${brand}${inst}:${Number(p.amount).toFixed(2)}`;
    }).join("|");
    const customer = customers.find((c) => c.id === customerId);
    const seller = sellers.find((s) => s.id === sellerId);
    const clientSaleId = crypto.randomUUID();
    const crediario = payments.find((p) => p.method === "crediario");
    const d = new Date();
    const saleBody = {
      items: cart.map((i) => ({
        id: i.id, quantity: i.quantity, price: i.price, selectedOptions: i.selectedOptions ?? null,
        heldSaleItemId: i.heldSaleItemId ?? undefined,
      })),
      services: [],
      customerName: customer?.name ?? "",
      customerId: customerId ?? undefined,
      sellerId,
      totalAmount: total,
      paymentMethod: pmString,
      discount: discountValue,
      surcharge: surchargeValue > 0 ? surchargeValue : undefined,
      changeAmount: change > 0 ? change : undefined,
      passFeeToCustomer,
      passFeeByMethod,
      crediarioInstallments: crediario?.crediarioInstallments ?? undefined,
      crediarioFirstDueDate: crediario?.crediarioFirstDueDate ?? undefined,
      cashSessionId: cashSession?.localId ? null : cashSession?.id ?? null,
      cashSessionLocalId: cashSession?.localId ?? undefined,
      heldSaleId: activeHeldId ?? undefined,
      clientSaleId,
      soldAtDate: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
    };

    const buildReceipt = (orderId: number) => buildOrderReceiptText(tenant, {
      id: orderId,
      created_at: new Date().toISOString(),
      customer_name: customer?.name ?? null,
      seller_name: seller?.name ?? null,
      items: cart.map((i) => ({ product_name: i.variationLabel ? `${i.name} (${i.variationLabel})` : i.name, quantity: i.quantity, unit_price: i.price })),
      payment_method: pmString,
      gross_amount: subtotal,
      discount_amount: discountValue,
      surcharge_amount: surchargeValue,
      passed_fee_amount: passedFee,
      total_amount: total,
    });

    const wasNfce = emitNfce;
    const conclude = async (orderId: number, offline: boolean) => {
      const receiptText = buildReceipt(orderId);
      let nfce: string | undefined;
      if (wasNfce && !offline) {
        try {
          const r = await fetch(`/api/nfce/${orderId}/emit`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
          const data = await r.json().catch(() => ({}));
          nfce = r.ok ? "NFC-e enviada para autorização." : (data?.error || "Não foi possível gerar a NFC-e.");
        } catch { nfce = "Não foi possível gerar a NFC-e."; }
      }
      if (printReceipt && window.boxsysDesktop?.printReceipt) {
        printThermalText(receiptText, "Cupom").then((res) => { if (!res.ok) flash(res.error || "Falha ao imprimir o recibo."); });
      }
      setCompleted({ orderId, offline, total, change: change > 0 ? change : 0, receiptText, nfce });
      setFinishing(false);
    };

    const finishOffline = async () => {
      const pending: PendingSale = { localId: clientSaleId, body: saleBody, createdAt: new Date().toISOString(), total, customerName: customer?.name };
      await queueSale(pending);
      refreshPending();
      setProducts((prev) => {
        const updated = prev.map((p) => {
          const inCart = cart.filter((i) => i.id === p.id).reduce((s, i) => s + i.quantity, 0);
          return inCart > 0 ? { ...p, stock_quantity: p.stock_quantity - inCart } : p;
        });
        cacheSet("products", updated);
        return updated;
      });
      await conclude(0, true);
    };

    try {
      if (!navigator.onLine || cashSession?.localId) { await finishOffline(); return; }
      const res = await fetch("/api/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(saleBody),
      });
      if (res.ok) {
        const data = await res.json();
        await conclude(data.orderId, false);
        // baixa o estoque local na hora; o pacote do servidor confirma em seguida
        setProducts((prev) => {
          const updated = prev.map((p) => {
            const inCart = cart.filter((i) => i.id === p.id).reduce((sum, i) => sum + i.quantity, 0);
            return inCart > 0 ? { ...p, stock_quantity: p.stock_quantity - inCart } : p;
          });
          cacheSet("products", updated);
          return updated;
        });
      } else {
        const err = await res.json().catch(() => ({}));
        flash(err?.error || "O servidor recusou a venda.");
        setFinishing(false);
      }
    } catch {
      // a rede caiu no meio do envio: entra na fila (clientSaleId evita duplicar)
      await finishOffline();
    }
  };

  const closeCompleted = () => { setCompleted(null); newSale(); };

  // ── atalhos de teclado ─────────────────────────────────────────────────────
  // Login, abertura e fechamento de caixa são telas próprias: as teclas F do balcão ficam desligadas enquanto elas estão abertas.
  const blocked = !token || (!cashLoading && requireCash && !cashSession) || showCloseCash;
  const actions = useRef({ screen, modal, completed, hasCart: cart.length > 0, blocked });
  actions.current = { screen, modal, completed, hasCart: cart.length > 0, blocked };
  const handlers = useRef<Record<string, () => void>>({});
  handlers.current = {
    F2: () => (screen === "sale" ? (setScannerMode((v) => !v), codeRef.current?.focus()) : (setLookup(""), setModal("customer"))),
    F3: () => (screen === "sale" ? setModal("operator") : setModal("discount")),
    F4: () => { if (screen === "sale") void openHeld(); },
    F6: () => (screen === "sale" ? goToPayment() : void finishSale()),
    F7: () => (screen === "sale" ? void holdSale() : setPrintReceipt((v) => !v)),
    F8: () => { if (screen === "payment") setEmitNfce((v) => !v); },
    F9: () => { if (actions.current.hasCart) setModal("confirmCancel"); else if (screen === "payment") setScreen("sale"); },
    F10: () => { if (screen === "payment") { setLookup(""); setModal("seller"); } },
    Alt1: () => pickPayMethod(PAY_ORDER[0]), Alt2: () => pickPayMethod(PAY_ORDER[1]), Alt3: () => pickPayMethod(PAY_ORDER[2]),
    Alt4: () => pickPayMethod(PAY_ORDER[3]), Alt5: () => pickPayMethod(PAY_ORDER[4]),
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const { modal: m, completed: c, screen: s, blocked: b } = actions.current;
      if (b) return;
      if (c) {
        if (e.key === "Enter") { e.preventDefault(); closeCompleted(); }
        else if (e.key.toLowerCase() === "p" && window.boxsysDesktop?.printReceipt) {
          e.preventDefault();
          printThermalText(c.receiptText, "Cupom");
        }
        return;
      }
      if (e.key === "Escape") {
        if (m) { e.preventDefault(); setModal(null); }
        else if (s === "payment") { e.preventDefault(); setScreen("sale"); }
        return;
      }
      if (e.ctrlKey && e.key.toLowerCase() === "p") { e.preventDefault(); setScreen("sale"); window.setTimeout(() => codeRef.current?.focus(), 0); return; }
      if (e.altKey && /^[1-5]$/.test(e.key) && s === "payment" && !m) { e.preventDefault(); handlers.current[`Alt${e.key}`]?.(); return; }
      if (/^F(2|3|4|6|7|8|9|10)$/.test(e.key)) {
        e.preventDefault();
        if (m && m !== "confirmCancel") return;
        handlers.current[e.key]?.();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { if (screen === "sale" && !modal && !completed) codeRef.current?.focus(); }, [screen, modal, completed]);

  // ── renderização ───────────────────────────────────────────────────────────
  if (!token) return <ClassicLogin onLogin={setToken} />;

  if (!cashLoading && requireCash && !cashSession) {
    return (
      <ClassicOpenCash
        operatorName={operatorName}
        onLogout={logout}
        onOpen={async (amount, note) => {
          if (!isOnline) {
            const localId = crypto.randomUUID();
            const openedAt = new Date().toISOString();
            const session: CashSessionInfo = { id: 0, localId, opened_at: openedAt, opening_amount: amount, opened_by_name: operatorName };
            await queueCashOp({ localId, type: "cash_open", createdAt: openedAt, openingAmount: amount, openingNote: note });
            setCashSession(session);
            cacheSet("cashSession", session);
            refreshPending();
            return;
          }
          const session = await apiOpenCashSession(token, amount, note);
          setCashSession(session);
          cacheSet("cashSession", session);
        }}
      />
    );
  }

  const tenantName: string = tenant.name || "Store BoxSys";
  const selectedCustomer = customers.find((c) => c.id === customerId);
  const selectedSeller = sellers.find((s) => s.id === sellerId);
  const lookupLower = norm(lookup);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#eef2f9] font-sans text-slate-800 [&_button]:cursor-pointer [&_button:disabled]:cursor-not-allowed">
      {/* topo */}
      <header className="flex h-[68px] shrink-0 items-center justify-between bg-[#0b527a] px-5 text-white">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-sm bg-white/15 text-lg font-bold">B</div>
          <div className="leading-tight">
            <p className="text-[15px] font-semibold">{tenantName}</p>
            <p className={cn("flex items-center gap-1.5 text-[11px] font-medium", isOnline ? "text-emerald-300" : "text-amber-300")}>
              <i className={cn("h-1.5 w-1.5 rounded-full", isOnline ? "bg-emerald-400" : "bg-amber-400")} />
              {isOnline ? "Online" : "Modo offline"}{pendingCount > 0 && ` · ${pendingCount} para sincronizar`}
              {dataAt && <span className="text-white/60"> · dados de {new Date(dataAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>}
            </p>
          </div>
        </div>
        <div className="text-center leading-tight">
          <p className="text-[11px] uppercase tracking-widest text-white/60">Caixa</p>
          <p className="text-[15px] font-semibold">{cashSession ? `Aberto às ${new Date(cashSession.opened_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}` : "Caixa Padrão"}</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => void refreshData()} disabled={refreshingData} title="Baixar produtos e dados da loja agora" className="rounded-sm border border-white/30 px-3 py-2 text-[12px] font-semibold hover:bg-white/10 disabled:opacity-50">{refreshingData ? "ATUALIZANDO…" : "↻ ATUALIZAR DADOS"}</button>
          <button onClick={() => setModal("operator")} className="rounded-sm border border-white/30 px-3 py-2 text-[12px] font-semibold hover:bg-white/10">OPERADOR (F3)</button>
          <button onClick={logout} className="rounded-sm border border-white/30 px-3 py-2 text-[12px] font-semibold hover:bg-white/10">✕ SAIR DO PDV</button>
        </div>
      </header>

      {notice && (
        <div className={cn("absolute left-1/2 top-[78px] z-[60] -translate-x-1/2 rounded-sm px-5 py-3 text-[13px] font-semibold text-white shadow-lg", notice.tone === "ok" ? "bg-emerald-600" : "bg-rose-600")}>
          {notice.text}
        </div>
      )}

      {/* corpo */}
      {screen === "sale" ? (
        <main className="grid min-h-0 flex-1 grid-cols-[minmax(380px,40%)_1fr] gap-6 p-5">
          <section className="relative">
            <div className="mb-1 flex items-center justify-between">
              <label className={labelCls}>Cód. / Produto (Ctrl+P)</label>
              <label className="flex items-center gap-1.5 text-[12px] text-slate-500">
                <input type="checkbox" checked={scannerMode} onChange={(e) => setScannerMode(e.target.checked)} /> Leitor de código de barras (F2)
              </label>
            </div>
            <input
              ref={codeRef} className={inputCls} value={code} autoComplete="off"
              placeholder={scannerMode ? "Bipe o código de barras…" : "Digite o código, código de barras ou nome"}
              onChange={(e) => { setCode(e.target.value); setPicked(null); setActiveSuggestion(0); }}
              onKeyDown={(e) => {
                // campo vazio e sem sugestões: as setas percorrem os itens do pedido e Delete remove o selecionado
                if (!code && !picked && cart.length > 0 && (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Delete")) {
                  e.preventDefault();
                  const at = cart.findIndex((i) => i.cartItemId === selectedId);
                  if (e.key === "Delete") {
                    if (at >= 0) {
                      const removed = cart[at];
                      const rest = cart.filter((_, idx) => idx !== at);
                      setCart(rest);
                      setSelectedId(rest.length ? rest[Math.min(at, rest.length - 1)].cartItemId : null);
                      flash(`Item removido: ${removed.name}`, "ok");
                    }
                    return;
                  }
                  const next = e.key === "ArrowDown" ? (at < 0 ? 0 : Math.min(at + 1, cart.length - 1)) : (at < 0 ? cart.length - 1 : Math.max(at - 1, 0));
                  setSelectedId(cart[next].cartItemId);
                  return;
                }
                if (e.key === "Enter") { e.preventDefault(); handleCodeEnter(); }
                else if (e.key === "ArrowDown") { e.preventDefault(); setActiveSuggestion((i) => Math.min(i + 1, suggestions.length - 1)); }
                else if (e.key === "ArrowUp") { e.preventDefault(); setActiveSuggestion((i) => Math.max(i - 1, 0)); }
              }}
            />
            {suggestions.length > 0 && (
              <ul className="absolute z-20 mt-1 w-full overflow-hidden rounded-sm border border-[#c5cfdf] bg-white shadow-lg">
                {suggestions.map((p, i) => (
                  <li
                    key={p.id}
                    onMouseEnter={() => setActiveSuggestion(i)}
                    onMouseDown={(e) => { e.preventDefault(); setPicked(p); setCode(p.name); window.setTimeout(() => document.getElementById("classic-qty")?.focus(), 0); }}
                    className={cn("flex cursor-pointer items-center justify-between px-3 py-2 text-[13px]", i === activeSuggestion ? "bg-[#0078d4] text-white" : "hover:bg-slate-50")}
                  >
                    <span className="truncate">{p.sku ? `${p.sku} · ` : ""}{p.name}</span>
                    <span className="ml-3 shrink-0 font-semibold">R$ {money(Number(p.discount_price || p.price))}</span>
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-5 grid grid-cols-3 gap-3">
              <div>
                <label className={labelCls}>Quantidade</label>
                <input
                  id="classic-qty" className={inputCls} value={qty} inputMode="decimal"
                  onChange={(e) => setQty(e.target.value)}
                  onFocus={(e) => e.target.select()}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleCodeEnter(); } }}
                />
              </div>
              <div>
                <label className={labelCls}>Valor Unitário</label>
                <input className={inputCls} value={money(unitPrice)} readOnly tabIndex={-1} />
              </div>
              <div>
                <label className={labelCls}>Valor Total</label>
                <input className={inputCls} value={money(lineTotal)} readOnly tabIndex={-1} />
              </div>
            </div>
            <button onClick={handleCodeEnter} className={cn(btn("blue"), "mt-5 w-full")}>Incluir (Enter)</button>
            <div className="mt-6 rounded-sm border border-[#c5cfdf] bg-white p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Último item</p>
              {lastAdded ? (
                <>
                  <p className="mt-1 text-[20px] font-semibold leading-snug text-slate-800">{lastAdded.name}</p>
                  {lastAdded.variation && <p className="text-[12px] text-slate-500">{lastAdded.variation}</p>}
                  <p className="mt-2 flex items-baseline justify-between text-[14px] text-slate-500">
                    <span>{lastAdded.qty} × R$ {money(lastAdded.price)}</span>
                    <b className="text-[24px] font-semibold text-[#0b527a]">R$ {money(lastAdded.qty * lastAdded.price)}</b>
                  </p>
                </>
              ) : (
                <p className="mt-1 text-[14px] text-slate-400">Nenhum item incluído ainda.</p>
              )}
            </div>
            <p className="mt-3 text-[12px] leading-relaxed text-slate-500">
              Tecle o código de barras ou o código e Enter. Para várias unidades, digite <b>3*código</b>. Com o campo vazio, <b>↑ ↓</b> escolhem um item do pedido, <b>Enter</b> altera a quantidade e <b>Delete</b> remove.
            </p>
          </section>

          <section className="flex min-h-0 flex-col">
            <div className="mb-3 rounded-sm border border-[#c5cfdf] bg-white px-4 py-3 text-[13px]">
              {cart.length === 0
                ? <span className="font-medium text-slate-500">Aguardando abertura de pedido. Inclua um produto ou retome uma venda em aberto (F4).</span>
                : <span><b className="text-[#0b527a]">Pedido Nº {saleNumber}</b> · {new Date().toLocaleDateString("pt-BR")} · {operatorName}</span>}
            </div>
            <div className="min-h-0 flex-1 overflow-auto rounded-sm border border-[#c5cfdf] bg-white">
              {cart.length === 0 ? (
                <div className="flex h-full items-center justify-center text-[20px] text-slate-400">
                  {loading ? "Carregando produtos…" : <>Seu caixa está <b className="mx-1 text-[#0078d4]">livre</b> no momento!</>}
                </div>
              ) : (
                <table className="w-full text-[13px]">
                  <thead className="sticky top-0 bg-white text-[11px] uppercase text-slate-400">
                    <tr className="border-b border-dashed border-slate-300">
                      <th className="w-10 px-3 py-3 text-left">#</th><th className="px-2 text-left">Qtde.</th><th className="px-2 text-left">Cód.</th><th className="px-2 text-left">Produto ({cart.length})</th>
                      <th className="px-2 text-right">Valor unitário</th><th className="px-2 text-right">Valor total</th><th className="w-20" />
                    </tr>
                  </thead>
                  <tbody>
                    {cart.map((i, idx) => (
                      <tr
                        key={i.cartItemId} onClick={() => setSelectedId(i.cartItemId)}
                        className={cn("cursor-pointer border-b border-dashed border-slate-200", i.cartItemId === selectedId ? "bg-[#e6f1fb] shadow-[inset_3px_0_0_#0078d4]" : "hover:bg-slate-50")}
                      >
                        <td className="px-3 py-3 text-[12px] text-slate-400">{idx + 1}</td>
                        <td className="px-2 py-3 font-medium">{i.quantity}</td>
                        <td className="px-2 text-slate-500">{i.sku ?? ""}</td>
                        <td className="px-2">{i.name}{i.variationLabel && <span className="block text-[11px] text-slate-500">{i.variationLabel}</span>}</td>
                        <td className="px-2 text-right">R$ {money(i.price)}</td>
                        <td className="px-2 text-right font-semibold">R$ {money(i.price * i.quantity)}</td>
                        <td className="px-2 text-right">
                          <button title="Alterar quantidade" className="mr-2 text-[#0078d4]" onClick={(e) => { e.stopPropagation(); setEditingItem(i); setEditQty(String(i.quantity)); setModal("qty"); }}>✎</button>
                          <button title="Remover" className="text-rose-600" onClick={(e) => { e.stopPropagation(); setCart((prev) => prev.filter((x) => x.cartItemId !== i.cartItemId)); }}>✕</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            {cart.length > 0 && (
              <div className="mt-3 flex items-center justify-between rounded-sm bg-[#0b527a] px-5 py-3 text-white">
                <div className="leading-tight">
                  <p className="text-[16px] font-medium">SUBTOTAL</p>
                  <p className="text-[12px] text-white/70">{cart.length} {cart.length === 1 ? "item" : "itens"} · {cart.reduce((a, i) => a + i.quantity, 0)} un.</p>
                </div>
                <span className="text-[36px] font-semibold leading-none">R$ {money(subtotal)}</span>
              </div>
            )}
          </section>
        </main>
      ) : (
        <main className="grid min-h-0 flex-1 grid-cols-[minmax(420px,48%)_1fr] gap-6 p-5">
          <section>
            <h2 className="mb-3 text-[20px] font-semibold text-[#0b527a]">Confirmação de pagamento</h2>
            <div className="rounded-sm border border-dashed border-[#b6c3d8] p-4">
              <label className={labelCls}>Forma de pagamento <span className="text-slate-400">(Alt + número)</span></label>
              <div className="mb-4 grid grid-cols-5 gap-2">
                {PAY_ORDER.map((m, idx) => (
                  <button
                    key={m} type="button" onClick={() => pickPayMethod(m)}
                    className={cn("flex h-[52px] flex-col items-center justify-center rounded-sm border text-[12px] font-semibold transition-colors",
                      payMethod === m ? "border-[#0078d4] bg-[#0078d4] text-white" : "border-[#c5cfdf] bg-white text-slate-600 hover:border-[#0078d4] hover:text-[#0078d4]")}
                  >
                    <span className="text-[10px] font-medium opacity-70">Alt+{idx + 1}</span>
                    {PM_SHORT[m]}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-[0.7fr_1fr] gap-3">
                <div>
                  <label className={labelCls}>Parcelas:</label>
                  <input
                    className={inputCls} type="number" min={1} max={maxInstallments} value={payInstallments}
                    disabled={payMethod !== "credit" && payMethod !== "crediario"}
                    onChange={(e) => setPayInstallments(Math.max(1, Math.min(maxInstallments, Number(e.target.value) || 1)))}
                  />
                </div>
                <div>
                  <label className={labelCls}>Valor recebido:</label>
                  <input
                    ref={payRef} className={inputCls} value={payAmount} inputMode="decimal" placeholder="R$"
                    onChange={(e) => setPayAmount(e.target.value)} onFocus={(e) => e.target.select()}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (remaining <= 0.004 && payments.length > 0) void finishSale(); else addPayment(); } }}
                  />
                </div>
              </div>
              {payMethod === "money" && remaining > 0 && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="text-[12px] font-medium text-slate-500">Valor rápido:</span>
                  <button type="button" onClick={() => { setPayAmount(remaining.toFixed(2).replace(".", ",")); payRef.current?.focus(); }}
                    className="h-8 rounded-sm border border-[#c5cfdf] bg-white px-3 text-[12px] font-semibold text-slate-600 hover:border-[#0078d4] hover:text-[#0078d4]">Exato</button>
                  {[10, 20, 50, 100, 200].map((v) => (
                    <button key={v} type="button" onClick={() => { setPayAmount(v.toFixed(2).replace(".", ",")); payRef.current?.focus(); }}
                      className="h-8 rounded-sm border border-[#c5cfdf] bg-white px-3 text-[12px] font-semibold text-slate-600 hover:border-[#0078d4] hover:text-[#0078d4]">R$ {v}</button>
                  ))}
                </div>
              )}
              {(payMethod === "debit" || payMethod === "credit") && (
                <div className="mt-3 w-1/2">
                  <label className={labelCls}>Bandeira:</label>
                  <select className={inputCls} value={payBrand} onChange={(e) => setPayBrand(e.target.value as CardBrand)}>
                    {BRANDS.map((b) => <option key={b.key} value={b.key}>{b.label}</option>)}
                  </select>
                </div>
              )}
              <div className="mt-4 flex items-center justify-between">
                <p className="text-[15px]"><b>A pagar:</b> <span className="ml-2 text-[26px] font-semibold text-[#0b527a]">R$ {money(remaining)}</span></p>
                <button onClick={addPayment} className={btn("blue")}>Adicionar (Enter)</button>
              </div>
            </div>

            {shownChange > 0 && (
              <div className="mt-4 flex items-center justify-between rounded-sm border border-emerald-300 bg-emerald-50 px-5 py-3">
                <span className="text-[15px] font-semibold text-emerald-800">TROCO</span>
                <span className="text-[34px] font-semibold leading-none text-emerald-700">R$ {money(shownChange)}</span>
              </div>
            )}

            {payments.length > 0 && (
              <ul className="mt-4 divide-y divide-slate-200 rounded-sm border border-[#c5cfdf] bg-white">
                {payments.map((p) => (
                  <li key={p.id} className="flex items-center justify-between px-4 py-3 text-[14px]">
                    <span>
                      {PM_SHORT[p.method]}
                      {(p.method === "debit" || p.method === "credit") && ` · ${BRANDS.find((b) => b.key === p.cardBrand)?.label}`}
                      {p.method === "credit" && p.installments > 1 && ` · ${p.installments}x`}
                      {p.method === "crediario" && p.crediarioInstallments > 1 && ` · ${p.crediarioInstallments}x`}
                    </span>
                    <span className="flex items-center gap-4">
                      <b>R$ {money(num(p.amount))}</b>
                      <button className="text-rose-600" onClick={() => setPayments((prev) => prev.filter((x) => x.id !== p.id))}>✕</button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-5 flex flex-wrap gap-5 text-[13px] text-slate-600">
              <label className="flex items-center gap-2"><input type="checkbox" checked={printReceipt} onChange={(e) => setPrintReceipt(e.target.checked)} /> Imprimir recibo (F7)</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={emitNfce} disabled={!isOnline} onChange={(e) => setEmitNfce(e.target.checked)} /> Emitir NFC-e (F8){!isOnline && " — só online"}</label>
            </div>
          </section>

          <section className="flex min-h-0 flex-col">
            <h2 className="mb-3 text-[20px] font-semibold text-[#0b527a]">Itens do pedido <span className="text-[13px] font-medium text-slate-500">- Nº {saleNumber}</span></h2>
            <div className="min-h-0 flex-1 overflow-auto rounded-sm border border-[#c5cfdf] bg-white">
              <table className="w-full text-[13px]">
                <thead className="text-[11px] uppercase text-slate-400">
                  <tr className="border-b border-dashed border-slate-300"><th className="px-4 py-3 text-left">Qtde.</th><th className="px-2 text-left">Produto ({cart.length})</th><th className="px-2 text-right">Unitário</th><th className="px-4 text-right">Total</th></tr>
                </thead>
                <tbody>
                  {cart.map((i) => (
                    <tr key={i.cartItemId} className="border-b border-dashed border-slate-200">
                      <td className="px-4 py-2.5">{i.quantity}</td>
                      <td className="px-2">{i.name}{i.variationLabel && <span className="block text-[11px] text-slate-500">{i.variationLabel}</span>}</td>
                      <td className="px-2 text-right">R$ {money(i.price)}</td>
                      <td className="px-4 text-right font-semibold">R$ {money(i.price * i.quantity)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 space-y-1.5 text-[13px]">
              <div className="flex justify-between text-slate-500"><span>Subtotal</span><span>R$ {money(subtotal)}</span></div>
              {discountValue > 0 && <div className="flex justify-between text-rose-600"><span>Desconto{discountExceeds && " (limitado ao máximo permitido)"}</span><span>- R$ {money(discountValue)}</span></div>}
              {surchargeValue > 0 && <div className="flex justify-between text-slate-500"><span>Acréscimo</span><span>+ R$ {money(surchargeValue)}</span></div>}
              {passedFee > 0 && <div className="flex justify-between text-slate-500"><span>Taxa da maquininha</span><span>+ R$ {money(passedFee)}</span></div>}
              <div className="flex justify-between pt-2">
                <button className="font-medium text-[#0078d4] underline" onClick={() => setModal("discount")}>+ Acréscimos e descontos (F3)</button>
                <button className="font-medium text-[#0078d4] underline" onClick={() => { setLookup(""); setModal("customer"); }}>+ Referenciar cliente (F2)</button>
              </div>
              {(selectedCustomer || selectedSeller) && (
                <p className="pt-1 text-slate-600">
                  {selectedCustomer && <>Cliente: <b>{selectedCustomer.name}</b></>}
                  {selectedCustomer && selectedSeller && " · "}
                  {selectedSeller && <>Vendedor: <b>{selectedSeller.name}</b></>}
                </p>
              )}
            </div>
          </section>
        </main>
      )}

      {/* legenda de atalhos */}
      <div className="shrink-0 border-t border-[#d5deec] bg-[#e9eef7] px-5 py-1.5 text-[11px] text-slate-500">
        {screen === "sale"
          ? <>Ctrl+P produto · <b>3*código</b> quantidade · ↑ ↓ Del itens · F2 leitor · F3 operador · F4 vendas em aberto · F6 pagamento · F7 aguardar · F9 cancelar</>
          : <>Alt+1…5 forma de pagamento · Enter adiciona · F2 cliente · F3 desconto · F7 recibo · F8 NFC-e · F10 vendedor · F6 finalizar · Esc volta</>}
      </div>

      {/* rodapé */}
      <footer className="flex h-[88px] shrink-0 items-center justify-between gap-4 bg-white px-5">
        <div className="flex h-[72px] items-center gap-6 rounded-r-[40px] bg-[#0b527a] pl-6 pr-10 text-white">
          <div className="leading-tight">
            <p className="text-[11px] uppercase text-white/60">Operador</p>
            <p className="max-w-[170px] truncate text-[14px] font-semibold">{operatorName}</p>
          </div>
          {screen === "sale" ? (
            <button onClick={() => void openHeld()} className="border-l border-white/30 pl-6 text-left text-[13px] font-semibold uppercase leading-tight hover:text-white/80">
              Vendas em aberto (F4){heldCount > 0 && <span className="ml-2 rounded-full bg-amber-400 px-2 py-0.5 text-[11px] text-slate-900">{heldCount}</span>}
            </button>
          ) : (
            <>
              <div className="border-l border-white/30 pl-6 leading-tight"><p className="text-[11px] uppercase text-white/60">Pagamentos</p><p className="text-[16px] font-semibold">R$ {money(paid)}</p></div>
              <div className="leading-tight"><p className="text-[11px] uppercase text-white/60">Troco</p><p className="text-[16px] font-semibold">R$ {money(change)}</p></div>
              <div className="leading-tight"><p className="text-[11px] uppercase text-white/60">Total</p><p className="text-[16px] font-semibold">R$ {money(total)}</p></div>
            </>
          )}
        </div>
        <div className="flex items-center gap-3">
          {screen === "sale" ? (
            <>
              <button className={btn("red")} onClick={() => cart.length > 0 && setModal("confirmCancel")} disabled={cart.length === 0}>Cancelar (F9)</button>
              <button className={btn("blue")} onClick={() => void holdSale()} disabled={cart.length === 0}>Aguardar (F7)</button>
              <button className={btn("green")} onClick={goToPayment} disabled={cart.length === 0}>Pagamento (F6)</button>
            </>
          ) : (
            <>
              <button className={btn("blue")} onClick={() => { setLookup(""); setModal("seller"); }}>Vendedor (F10)</button>
              <button className={btn("blue")} onClick={() => { setLookup(""); setModal("customer"); }}>Cliente (F2)</button>
              <button className={btn("red")} onClick={() => setModal("confirmCancel")}>Cancelar (F9)</button>
              <button className={btn("green")} onClick={() => void finishSale()} disabled={!canFinish || finishing}>{finishing ? "Finalizando…" : "Finalizar (F6)"}</button>
            </>
          )}
        </div>
      </footer>

      {/* ── modais ── */}
      {modal === "variation" && variationProduct && (
        <Overlay title={variationProduct.name} onClose={() => setModal(null)}>
          <div className="space-y-4">
            {(variationProduct.attributes?.length
              ? variationProduct.attributes.map((a) => ({ name: a.name, values: a.values }))
              : (variationProduct.variations ?? []).map((v) => ({ name: v.name, values: v.options.map((o) => o.value) }))
            ).map((group) => (
              <div key={group.name}>
                <p className={labelCls}>{group.name}</p>
                <div className="flex flex-wrap gap-2">
                  {group.values.map((val) => (
                    <button
                      key={val}
                      onClick={() => setVariationOptions((o) => ({ ...o, [group.name]: val }))}
                      className={cn("h-10 rounded-sm border px-4 text-[13px] font-medium", variationOptions[group.name] === val ? "border-[#0078d4] bg-[#0078d4] text-white" : "border-[#c5cfdf] bg-white hover:bg-slate-50")}
                    >{val}</button>
                  ))}
                </div>
              </div>
            ))}
            {(() => {
              const sku = variationProduct.skus?.find((s) => Object.entries(s.combo).every(([k, v]) => variationOptions[k] === v));
              return sku ? <p className="text-[12px] text-slate-500">Estoque desta combinação: <b>{sku.stock}</b></p> : null;
            })()}
            <button
              className={cn(btn("blue"), "w-full")} autoFocus
              onClick={() => {
                const sku = variationProduct.skus?.find((s) => Object.entries(s.combo).every(([k, v]) => variationOptions[k] === v));
                if (sku && sku.stock <= 0 && !sellWithoutStock && variationProduct.track_stock !== false) { flash("Combinação sem estoque."); return; }
                const product = variationProduct;
                setModal(null);
                if (addItem(product, num(qty) || 1, variationOptions)) resetEntry();
              }}
            >Incluir (Enter)</button>
          </div>
        </Overlay>
      )}

      {modal === "operator" && (
        <Overlay title="Operador" onClose={() => setModal(null)} width={420}>
          <p className="mb-5 text-[14px] text-slate-600">Logado como <b>{operatorName}</b>.</p>
          <div className="space-y-3">
            {cashSession && <button className={cn(btn("navy"), "w-full")} onClick={() => { setModal(null); setShowCloseCash(true); }}>Fechar caixa</button>}
            <button className={cn(btn("red"), "w-full")} onClick={logout}>Sair do PDV</button>
            <button className={cn(btn("gray"), "w-full")} onClick={() => setModal(null)}>Voltar (Esc)</button>
          </div>
        </Overlay>
      )}

      {modal === "held" && (
        <Overlay title="Vendas em aberto" onClose={() => setModal(null)} width={620}>
          {heldList.length === 0 ? <p className="text-[14px] text-slate-500">Nenhuma venda em aberto.</p> : (
            <ul className="divide-y divide-slate-200">
              {heldList.map((h) => (
                <li key={h.id} className="flex items-center justify-between py-3 text-[14px]">
                  <span><b>#{h.number}</b> · {h.customer_name || "Consumidor"} · {h.items.length} item(ns)<span className="block text-[11px] text-slate-500">{new Date(h.created_at).toLocaleString("pt-BR")}</span></span>
                  <button className={cn(btn("blue"), "h-10")} onClick={() => void resumeHeld(h)}>Retomar</button>
                </li>
              ))}
            </ul>
          )}
        </Overlay>
      )}

      {modal === "discount" && (
        <Overlay title="Acréscimos e descontos" onClose={() => setModal(null)} width={460}>
          <div className="space-y-4">
            <div>
              <label className={labelCls}>Desconto</label>
              <div className="flex gap-2">
                <input className={inputCls} value={discount} inputMode="decimal" autoFocus onChange={(e) => setDiscount(e.target.value)} />
                <select className={cn(inputCls, "w-24")} value={discountMode} onChange={(e) => setDiscountMode(e.target.value as "R$" | "%")}><option>R$</option><option>%</option></select>
              </div>
              {cartMaxDiscountPct != null && <p className="mt-1 text-[11px] text-slate-500">Desconto máximo neste pedido: {cartMaxDiscountPct}%</p>}
            </div>
            <div>
              <label className={labelCls}>Acréscimo</label>
              <div className="flex gap-2">
                <input className={inputCls} value={surcharge} inputMode="decimal" onChange={(e) => setSurcharge(e.target.value)} />
                <select className={cn(inputCls, "w-24")} value={surchargeMode} onChange={(e) => setSurchargeMode(e.target.value as "R$" | "%")}><option>R$</option><option>%</option></select>
              </div>
            </div>
            <button className={cn(btn("blue"), "w-full")} onClick={() => { setModal(null); setPayAmount(""); setPayments([]); window.setTimeout(() => payRef.current?.focus(), 50); }}>Aplicar</button>
            <p className="text-[11px] text-slate-500">Ao aplicar, os pagamentos já lançados são limpos para recalcular o valor a pagar.</p>
          </div>
        </Overlay>
      )}

      {(modal === "customer" || modal === "seller") && (
        <Overlay title={modal === "customer" ? "Referenciar cliente" : "Vendedor"} onClose={() => setModal(null)}>
          <input className={inputCls} autoFocus placeholder="Buscar…" value={lookup} onChange={(e) => setLookup(e.target.value)} />
          <ul className="mt-3 max-h-[50vh] divide-y divide-slate-200 overflow-auto">
            <li>
              <button className="w-full px-2 py-3 text-left text-[14px] text-slate-500 hover:bg-slate-50"
                onClick={() => { if (modal === "customer") setCustomerId(null); else setSellerId(null); setModal(null); }}>
                {modal === "customer" ? "Consumidor final (sem cliente)" : "Sem vendedor"}
              </button>
            </li>
            {(modal === "customer"
              ? customers.filter((c) => !lookupLower || norm(c.name).includes(lookupLower) || (c.document ?? "").includes(lookup) || (c.phone ?? "").includes(lookup)).slice(0, 40)
              : sellers.filter((s) => !lookupLower || norm(s.name).includes(lookupLower))
            ).map((row) => (
              <li key={row.id}>
                <button className="w-full px-2 py-3 text-left text-[14px] hover:bg-slate-50"
                  onClick={() => { if (modal === "customer") setCustomerId(row.id); else setSellerId(row.id); setModal(null); }}>
                  {row.name}
                  {"document" in row && row.document && <span className="ml-2 text-[12px] text-slate-500">{row.document}</span>}
                </button>
              </li>
            ))}
          </ul>
        </Overlay>
      )}

      {modal === "qty" && editingItem && (
        <Overlay title="Alterar quantidade" onClose={() => setModal(null)} width={380}>
          <p className="mb-3 text-[14px] text-slate-600">{editingItem.name}</p>
          <input
            className={inputCls} autoFocus value={editQty} inputMode="decimal" onFocus={(e) => e.target.select()}
            onChange={(e) => setEditQty(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              const q = num(editQty);
              if (!(q > 0)) { flash("Quantidade inválida."); return; }
              const tracked = editingItem.track_stock !== false && !sellWithoutStock && !(editingItem.skus?.length) && !(editingItem.variations?.length);
              if (tracked && q > editingItem.stock_quantity) { flash(`Estoque insuficiente (disponível: ${editingItem.stock_quantity}).`); return; }
              setCart((prev) => prev.map((x) => x.cartItemId === editingItem.cartItemId ? { ...x, quantity: q } : x));
              setModal(null);
            }}
          />
          <p className="mt-2 text-[11px] text-slate-500">Tecle Enter para confirmar.</p>
        </Overlay>
      )}

      {modal === "confirmCancel" && (
        <Overlay title="Cancelar venda?" onClose={() => setModal(null)} width={420}>
          <p className="mb-5 text-[14px] text-slate-600">Todos os itens e pagamentos desta venda serão descartados.</p>
          <div className="flex gap-3">
            <button className={cn(btn("gray"), "flex-1")} onClick={() => setModal(null)}>Voltar</button>
            <button className={cn(btn("red"), "flex-1")} autoFocus onClick={() => void cancelSale()}>Cancelar venda</button>
          </div>
        </Overlay>
      )}

      {completed && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/60 p-4">
          <div className="w-full max-w-md rounded-sm bg-white p-8 text-center shadow-2xl">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-3xl text-emerald-600">✓</div>
            <h2 className="text-2xl font-semibold text-[#0b527a]">{completed.offline ? "Venda salva (offline)" : "Venda confirmada"}</h2>
            <p className="mt-1 text-[13px] text-slate-500">{completed.offline ? "Será sincronizada quando a internet voltar." : `Pedido #${String(completed.orderId).padStart(5, "0")}`}</p>
            <p className="mt-5 text-[13px] text-slate-500">Total</p>
            <p className="text-[34px] font-semibold text-slate-800">R$ {money(completed.total)}</p>
            {completed.change > 0 && <p className="mt-1 text-[18px] font-semibold text-emerald-600">Troco: R$ {money(completed.change)}</p>}
            {completed.nfce && <p className="mt-3 text-[12px] text-slate-600">{completed.nfce}</p>}
            <div className="mt-6 flex gap-3">
              {window.boxsysDesktop?.printReceipt && (
                <button className={cn(btn("navy"), "flex-1")} onClick={() => printThermalText(completed.receiptText, "Cupom")}>Imprimir (P)</button>
              )}
              <button className={cn(btn("green"), "flex-1")} autoFocus onClick={closeCompleted}>Nova venda (Enter)</button>
            </div>
          </div>
        </div>
      )}

      {showCloseCash && cashSession && (
        <ClassicCloseCash
          onCancel={() => setShowCloseCash(false)}
          onFinish={() => {
            setShowCloseCash(false);
            setCashSession(null);
            cacheSet("cashSession", null);
            if (tenant.logout_on_cash_close) logout();
          }}
          onConfirm={async (counted, breakdown, note) => {
            if (!navigator.onLine || cashSession.localId) {
              const localId = crypto.randomUUID();
              await queueCashOp({
                localId, type: "cash_close", createdAt: new Date().toISOString(),
                sessionId: cashSession.localId ? undefined : cashSession.id, sessionLocalId: cashSession.localId,
                countedAmount: counted, countedBreakdown: breakdown, closingNote: note,
              });
              refreshPending();
              return {
                id: cashSession.id, opening_amount: cashSession.opening_amount, counted_amount: counted, expected_amount: 0,
                difference_amount: 0, payment_breakdown: null, opened_at: cashSession.opened_at,
                closed_at: new Date().toISOString(), pendingSync: true,
              };
            }
            const closed = await apiCloseCashSession(token, cashSession.id, counted, breakdown, note);
            if (tenant.print_cash_close_receipt && !closed.pendingSync) {
              printThermalText(buildCashCloseReceiptText(tenantName, operatorName, closed, PM_SHORT), "Fechamento de Caixa").catch(() => {});
            }
            return closed;
          }}
        />
      )}
    </div>
  );
}

export default function PDVClassico() {
  return (
    <ToastProvider>
      <ClassicPDV />
    </ToastProvider>
  );
}
