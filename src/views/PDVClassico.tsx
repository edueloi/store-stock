import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Product } from "../types";
import { cn } from "../lib/utils";
import { productHasStock } from "../utils/productStock";
import {
  cacheGet, cacheSet, countPendingCashOps, countPendingSales, getPendingCashOps, getPendingSales, queueCashOp, queueSale, removePendingCashOp, removePendingSale, type PendingSale,
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
  let t = String(v).trim();
  // vírgula = formato BR (ponto é milhar); só ponto com 1–2 casas no fim = decimal do teclado numérico ("394.70"); demais pontos = milhar
  if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
  else if (!/^\d+\.\d{1,2}$/.test(t)) t = t.replace(/\./g, "");
  const n = Number(t);
  return Number.isFinite(n) ? n : 0;
};
// Loja (tenantId) do usuário logado, lida do próprio token — sem rede.
function tokenTenantId(token: string | null): number | null {
  try {
    const part = (token ?? "").split(".")[1];
    if (!part) return null;
    const json = JSON.parse(decodeURIComponent(escape(atob(part.replace(/-/g, "+").replace(/_/g, "/")))));
    const id = Number(json?.tenantId ?? json?.tenant_id);
    return Number.isFinite(id) && id > 0 ? id : null;
  } catch { return null; }
}
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
function Overlay({ title, onClose, children, width = 480, hint }: { title: string; onClose: () => void; children: React.ReactNode; width?: number; hint?: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 p-3" onMouseDown={onClose}>
      <div className="flex max-h-[92vh] w-full flex-col overflow-hidden rounded-sm border border-[#0a3d5c] bg-white shadow-2xl" style={{ maxWidth: width }} onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex h-9 shrink-0 items-center justify-between bg-[#0a3d5c] px-3 text-white">
          <h2 className="truncate text-[13px] font-semibold uppercase tracking-wide">{title}</h2>
          <button onClick={onClose} className="rounded-[3px] bg-white/15 px-1.5 py-0.5 font-mono text-[10px] font-bold hover:bg-white/25">ESC</button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto p-3">{children}</div>
        {hint && <div className="shrink-0 border-t border-[#d5deec] bg-[#eef2f9] px-3 py-1 text-[10px] text-slate-500">{hint}</div>}
      </div>
    </div>
  );
}

const inputCls = "h-9 w-full rounded-sm border border-[#c5cfdf] bg-white px-2.5 text-[14px] text-slate-800 outline-none focus:border-[#0078d4] focus:ring-2 focus:ring-[#0078d4]/20 disabled:bg-slate-100 disabled:text-slate-400 read-only:bg-slate-100";
const labelCls = "mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500";
const btn = (tone: "blue" | "green" | "red" | "navy" | "gray") =>
  cn(
    "h-9 whitespace-nowrap rounded-sm px-4 text-[12px] font-semibold uppercase tracking-wide text-white shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50",
    tone === "blue" && "bg-[#0078d4] hover:bg-[#006abd]",
    tone === "green" && "bg-[#1b7e0e] hover:bg-[#166a0b]",
    tone === "red" && "bg-[#c00000] hover:bg-[#a00000]",
    tone === "navy" && "bg-[#44519c] hover:bg-[#394585]",
    tone === "gray" && "bg-slate-500 hover:bg-slate-600",
  );

// Botão da barra de comandos: tecla de função + nome da ação, como nos PDVs de terminal.
function FKey({ k, label, onClick, tone = "gray", strong, active, disabled, badge }: {
  k: string; label: string; onClick: () => void; tone?: "gray" | "red" | "green"; strong?: boolean; active?: boolean; disabled?: boolean; badge?: number | null;
}) {
  return (
    <button
      type="button" onClick={onClick} disabled={disabled}
      className={cn(
        "flex h-9 items-center gap-2 whitespace-nowrap rounded-sm border px-2.5 text-[12px] font-semibold shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-45",
        strong && "px-4",
        tone === "gray" && (active ? "border-[#0078d4] bg-[#e1effb] text-[#005a9e]" : "border-[#b4c1d6] bg-white text-slate-700 hover:border-[#0078d4] hover:text-[#0078d4]"),
        tone === "red" && "border-[#a40000] bg-[#c00000] text-white hover:bg-[#a00000]",
        tone === "green" && "border-[#14630a] bg-[#1b7e0e] text-white hover:bg-[#166a0b]",
      )}
    >
      <kbd className={cn("rounded-[3px] px-1.5 py-0.5 font-mono text-[10px] font-bold", tone === "gray" ? "bg-slate-200 text-slate-600" : "bg-black/20 text-white")}>{k}</kbd>
      {label}
      {badge ? <span className="rounded-full bg-amber-400 px-1.5 text-[10px] font-bold text-slate-900">{badge}</span> : null}
    </button>
  );
}

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
  const [priceQuery, setPriceQuery] = useState("");
  const [pickActive, setPickActive] = useState(0); // linha destacada nas listas dos modais (preço, cliente, vendedor)
  const [lastReceipt, setLastReceipt] = useState<string | null>(null);   // último cupom, para reimprimir
  const [selectedId, setSelectedId] = useState<string | null>(null);   // linha selecionada na lista (↑ ↓ / Del)

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
  type Modal = null | "pending" | "split" | "variation" | "price" | "operator" | "held" | "discount" | "customer" | "seller" | "qty" | "confirmCancel";
  const [modal, setModal] = useState<Modal>(null);
  // Dividir a conta entre pessoas: cada parte é cobrada em sequência (cada uma pode usar uma forma de pagamento)
  const [split, setSplit] = useState<{ shares: number[]; idx: number } | null>(null);
  const [splitPeople, setSplitPeople] = useState("2");
  // Fila offline: o que ainda não subiu para o servidor e por que (último erro recebido)
  const [pendingList, setPendingList] = useState<{ kind: "sale" | "cash"; id: string; label: string; createdAt: string; attempts: number; lastError?: string }[]>([]);
  const [syncingNow, setSyncingNow] = useState(false);
  useEffect(() => { setPickActive(0); }, [modal]);
  // Depois de finalizar a venda, volta direto ao caixa livre (sem a tela de confirmação). Preferência guardada neste computador.
  const [autoReturn, setAutoReturn] = useState(() => { try { return localStorage.getItem("classic_auto_return") === "1"; } catch { return false; } });
  const toggleAutoReturn = () => setAutoReturn((v) => { try { localStorage.setItem("classic_auto_return", v ? "0" : "1"); } catch { /* sem storage: vale só nesta sessão */ } return !v; });
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

  const flash = useCallback((text: string, tone: "ok" | "err" = "err", ms = 3500) => {
    setNotice({ text, tone });
    window.setTimeout(() => setNotice((n) => (n?.text === text ? null : n)), ms);
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
    // O pacote local é da loja a que o terminal está vinculado. Se quem logou é de OUTRA loja, os produtos
    // do pacote não existem para ele e a venda seria recusada ("Produto não encontrado"): ignora o pacote
    // e usa os dados da loja do usuário direto da API.
    const userTenant = tokenTenantId(localStorage.getItem("token"));
    const packTenant = Number((t as { id?: number } | null)?.id);
    if (userTenant && Number.isFinite(packTenant) && packTenant > 0 && packTenant !== userTenant) return false;
    // Pacote antigo sem o id da loja: com internet, confere pelo nome da loja do usuário (/api/tenant).
    if (userTenant && !(packTenant > 0) && navigator.onLine && t?.name) {
      try {
        const res = await fetch("/api/tenant", { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }, signal: AbortSignal.timeout(4000) });
        if (res.ok) {
          const mine = await res.json();
          if (mine?.name && String(mine.name).trim().toLowerCase() !== String(t.name).trim().toLowerCase()) return false;
        }
      } catch { /* sem rede: segue com o pacote local */ }
    }
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
  const loadPendingList = useCallback(async () => {
    const [sales, cashOps] = await Promise.all([getPendingSales(), getPendingCashOps()]);
    setPendingList([
      ...sales.map((x) => ({ kind: "sale" as const, id: x.localId, label: `Venda · R$ ${money(Number(x.total) || 0)}${x.customerName ? ` · ${x.customerName}` : ""}`, createdAt: x.createdAt, attempts: x.attempts ?? 0, lastError: x.lastError })),
      ...cashOps.map((x) => ({ kind: "cash" as const, id: x.localId, label: x.type === "cash_open" ? `Abertura de caixa · R$ ${money(x.openingAmount ?? 0)}` : `Fechamento de caixa · R$ ${money(x.countedAmount ?? 0)}`, createdAt: x.createdAt, attempts: x.attempts ?? 0, lastError: x.lastError })),
    ].sort((a, b) => a.createdAt.localeCompare(b.createdAt)));
  }, []);
  const syncNow = useCallback(async () => {
    if (!token || !navigator.onLine) return;
    const result = await syncPendingOps(token);
    refreshPending();
    void loadPendingList();
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
  }, [token, refreshPending, flash, refreshData, loadPendingList]);

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

  // consulta de preço (F5): mostra preço e estoque sem incluir na venda
  const priceResults = useMemo(() => {
    const q = norm(priceQuery.trim());
    if (!q) return [];
    return products
      .filter((x) => norm(x.name).includes(q) || (x.sku ?? "").toLowerCase().includes(q) || (x.barcode ?? "").toLowerCase().includes(q))
      .slice(0, 8);
  }, [priceQuery, products]);

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
  // Divide em centavos inteiros: as primeiras pessoas pagam 1 centavo a mais quando a divisão não é exata.
  const splitShares = (value: number, people: number) => {
    const cents = Math.round(value * 100);
    const base = Math.floor(cents / people);
    const extra = cents - base * people;
    return Array.from({ length: people }, (_, i) => (base + (i < extra ? 1 : 0)) / 100);
  };
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

  useEffect(() => { if (screen !== "payment" || remaining <= 0.004) setSplit(null); }, [screen, remaining]);

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
    const left = Math.max(0, Math.round((remaining - amount) * 100) / 100);
    if (split && left > 0.004 && split.idx + 1 < split.shares.length) {
      // próxima pessoa: a parte dela (a última leva o que sobrar)
      const nextIdx = split.idx + 1;
      const share = nextIdx === split.shares.length - 1 ? left : Math.min(split.shares[nextIdx], left);
      setSplit({ ...split, idx: nextIdx });
      setPayAmount(share.toFixed(2).replace(".", ","));
    } else {
      if (split) setSplit(null);
      setPayAmount(left > 0 ? left.toFixed(2).replace(".", ",") : "");
    }
  };

  const startSplit = () => {
    const n = Math.floor(num(splitPeople));
    if (!(n >= 2 && n <= 20)) { flash("Informe de 2 a 20 pessoas."); return; }
    if (remaining <= 0.004) { flash("Não há valor restante para dividir."); return; }
    const shares = splitShares(remaining, n);
    setSplit({ shares, idx: 0 });
    setPayAmount(shares[0].toFixed(2).replace(".", ","));
    setModal(null);
    window.setTimeout(() => payRef.current?.focus(), 50);
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
      setLastReceipt(receiptText);
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
      if (autoReturn) {
        // volta ao caixa livre: o troco (e o aviso da NFC-e) ficam num aviso fixo por alguns segundos
        const parts = [offline ? "Venda salva (offline)" : `Venda #${String(orderId).padStart(5, "0")} finalizada`, `Total R$ ${money(total)}`];
        if (change > 0) parts.push(`TROCO R$ ${money(change)}`);
        if (nfce) parts.push(nfce);
        newSale();
        setFinishing(false);
        flash(parts.join(" · "), "ok", change > 0 ? 9000 : 4500);
        return;
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
    F4: () => { if (screen === "sale") void openHeld(); else if (remaining > 0.004) { setSplitPeople(split ? String(split.shares.length) : "2"); setModal("split"); } },
    F5: () => { if (screen === "sale") { setPriceQuery(""); setModal("price"); } },
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
      if (/^F(2|3|4|5|6|7|8|9|10)$/.test(e.key)) {
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

  const stamp = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const heldBadge = heldCount > 0 ? heldCount : null;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#e6ebf3] font-sans text-[13px] text-slate-800 [&_button]:cursor-pointer [&_button:disabled]:cursor-not-allowed">
      {/* topo */}
      <header className="flex h-11 shrink-0 items-center justify-between gap-3 bg-[#0a3d5c] px-3 text-white">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-sm bg-white/15 text-[14px] font-bold">B</div>
          <div className="min-w-0 leading-tight">
            <p className="truncate text-[13px] font-semibold">{tenantName}</p>
            <p className={cn("flex items-center gap-1.5 truncate text-[10px] font-medium", isOnline ? "text-emerald-300" : "text-amber-300")}>
              <i className={cn("h-1.5 w-1.5 shrink-0 rounded-full", isOnline ? "bg-emerald-400" : "bg-amber-400")} />
              {isOnline ? "Online" : "Modo offline"}
              {pendingCount > 0 && (
                <button type="button" title="Ver o que falta sincronizar e por quê" className="underline decoration-dotted underline-offset-2 hover:text-white" onClick={() => { void loadPendingList(); setModal("pending"); }}>
                  · {pendingCount} p/ sincronizar
                </button>
              )}
              {dataAt && <span className="hidden text-white/55 sm:inline"> · dados de {stamp(dataAt)}</span>}
            </p>
          </div>
        </div>
        <div className="hidden text-center leading-tight md:block">
          {(() => {
            if (!cashSession) return <p className="text-[12px] font-semibold">CAIXA PADRÃO</p>;
            const opened = new Date(cashSession.opened_at);
            // caixa aberto em dia anterior: vendas de vários dias caem na mesma sessão e o fechamento perde o sentido
            const old = opened.toDateString() !== new Date().toDateString();
            return old
              ? <p className="text-[12px] font-semibold text-amber-300" title="Feche este caixa e abra um novo para o dia de hoje">⚠ CAIXA ABERTO DESDE {opened.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} {stamp(cashSession.opened_at)} — FECHE O CAIXA</p>
              : <p className="text-[12px] font-semibold tracking-wide">CAIXA ABERTO · {stamp(cashSession.opened_at)}</p>;
          })()}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button onClick={() => void refreshData()} disabled={refreshingData} title="Baixar produtos e dados da loja agora" className="h-7 rounded-sm border border-white/25 px-2.5 text-[11px] font-semibold hover:bg-white/10 disabled:opacity-50">{refreshingData ? "ATUALIZANDO…" : <>↻<span className="hidden lg:inline"> ATUALIZAR DADOS</span></>}</button>
          <button onClick={() => setModal("operator")} className="h-7 rounded-sm border border-white/25 px-2.5 text-[11px] font-semibold hover:bg-white/10"><span className="hidden lg:inline">OPERADOR </span>(F3)</button>
          <button onClick={logout} className="h-7 rounded-sm border border-white/25 px-2.5 text-[11px] font-semibold hover:bg-white/10">✕<span className="hidden lg:inline"> SAIR</span></button>
        </div>
      </header>

      {/* faixa do pedido */}
      <div className="flex shrink-0 items-center gap-x-4 gap-y-0.5 overflow-hidden border-b border-[#c9d3e3] bg-white px-3 py-1.5 text-[12px]">
        <span className={cn("shrink-0 rounded-sm px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white", screen === "sale" ? "bg-[#0078d4]" : "bg-[#1b7e0e]")}>{screen === "sale" ? "Venda" : "Pagamento"}</span>
        {cart.length === 0 && screen === "sale"
          ? <span className="truncate text-slate-500">Caixa livre — inclua um produto ou retome uma venda em aberto (F4).</span>
          : (
            <span className="flex min-w-0 flex-wrap items-center gap-x-4 text-slate-600">
              <b className="font-mono text-[#0a3d5c]">Pedido Nº {saleNumber}</b>
              <span className="hidden sm:inline">{new Date().toLocaleDateString("pt-BR")}</span>
              <span className="truncate">Operador: <b>{operatorName}</b></span>
              <span className="truncate">Cliente: <b>{selectedCustomer?.name ?? "Balcão"}</b></span>
              {selectedSeller && <span className="truncate">Vendedor: <b>{selectedSeller.name}</b></span>}
            </span>
          )}
      </div>

      {notice && (
        <div className={cn("absolute left-1/2 top-14 z-[60] -translate-x-1/2 rounded-sm px-4 py-2 text-[13px] font-semibold text-white shadow-lg", notice.tone === "ok" ? "bg-emerald-600" : "bg-rose-600")}>
          {notice.text}
        </div>
      )}

      {/* corpo */}
      {screen === "sale" ? (
        <main className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-y-auto p-3 lg:grid-cols-[minmax(320px,35%)_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)] lg:overflow-hidden">
          <section className="relative flex min-h-0 flex-col gap-3 lg:overflow-y-auto">
            <div className="relative rounded-sm border border-[#c5cfdf] bg-white p-3">
              <div className="mb-1 flex items-center justify-between gap-2">
                <label className={labelCls}>Cód. / Produto <span className="text-slate-400">(Ctrl+P)</span></label>
                <label className="flex items-center gap-1.5 text-[11px] text-slate-500">
                  <input type="checkbox" checked={scannerMode} onChange={(e) => setScannerMode(e.target.checked)} /> Leitor (F2)
                </label>
              </div>
              <input
                ref={codeRef} className={cn(inputCls, "font-mono")} value={code} autoComplete="off"
                placeholder={scannerMode ? "Bipe o código de barras…" : "Código, código de barras ou nome"}
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
                <ul className="absolute left-3 right-3 z-20 mt-1 max-h-72 overflow-y-auto rounded-sm border border-[#c5cfdf] bg-white shadow-lg">
                  {suggestions.map((p, i) => (
                    <li
                      key={p.id}
                      onMouseEnter={() => setActiveSuggestion(i)}
                      onMouseDown={(e) => { e.preventDefault(); setPicked(p); setCode(p.name); window.setTimeout(() => document.getElementById("classic-qty")?.focus(), 0); }}
                      className={cn("flex cursor-pointer items-center justify-between px-3 py-1.5 text-[12px]", i === activeSuggestion ? "bg-[#0078d4] text-white" : "hover:bg-slate-50")}
                    >
                      <span className="truncate">{p.sku ? `${p.sku} · ` : ""}{p.name}</span>
                      <span className="ml-3 shrink-0 font-mono font-semibold">R$ {money(Number(p.discount_price || p.price))}</span>
                    </li>
                  ))}
                </ul>
              )}

              <div className="mt-3 grid grid-cols-[0.7fr_1fr_1.2fr] gap-2">
                <div>
                  <label className={labelCls}>Qtde.</label>
                  <input
                    id="classic-qty" className={cn(inputCls, "font-mono")} value={qty} inputMode="decimal"
                    onChange={(e) => setQty(e.target.value)}
                    onFocus={(e) => e.target.select()}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleCodeEnter(); } }}
                  />
                </div>
                <div>
                  <label className={labelCls}>Unitário</label>
                  <input className={cn(inputCls, "text-right font-mono")} value={money(unitPrice)} readOnly tabIndex={-1} />
                </div>
                <div>
                  <label className={labelCls}>Total</label>
                  <input className={cn(inputCls, "text-right font-mono font-semibold")} value={money(lineTotal)} readOnly tabIndex={-1} />
                </div>
              </div>
              <button onClick={handleCodeEnter} className={cn(btn("blue"), "mt-3 w-full")}>Incluir (Enter)</button>
            </div>

            <p className="hidden text-[11px] leading-relaxed text-slate-500 xl:block [@media(max-height:760px)]:!hidden">
              Tecle o código de barras ou o código e Enter. Para várias unidades, digite <b>3*código</b>. Com o campo vazio, <b>↑ ↓</b> escolhem um item do pedido, <b>Enter</b> altera a quantidade e <b>Delete</b> remove.
            </p>
          </section>

          <section className="flex min-h-[260px] flex-col gap-3 lg:min-h-0">
            <div className="min-h-0 flex-1 overflow-auto rounded-sm border border-[#c5cfdf] bg-white">
              {cart.length === 0 ? (
                <div className="flex h-full min-h-[160px] items-center justify-center px-4 text-center text-[clamp(16px,2vw,22px)] text-slate-400">
                  {loading ? "Carregando produtos…" : <>Caixa <b className="mx-1.5 text-[#0078d4]">livre</b></>}
                </div>
              ) : (
                <table className="w-full border-collapse text-[12px]">
                  <thead className="sticky top-0 z-10 bg-[#dfe7f2] text-[10px] uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="w-9 px-2 py-1.5 text-left">#</th><th className="hidden px-2 text-left sm:table-cell">Cód.</th><th className="px-2 text-left">Produto ({cart.length})</th>
                      <th className="px-2 text-right">Qtde.</th><th className="hidden px-2 text-right sm:table-cell">Unitário</th><th className="px-2 text-right">Total</th><th className="w-16" />
                    </tr>
                  </thead>
                  <tbody>
                    {cart.map((i, idx) => (
                      <tr
                        key={i.cartItemId} onClick={() => setSelectedId(i.cartItemId)}
                        className={cn("cursor-pointer border-b border-slate-200", i.cartItemId === selectedId ? "bg-[#cfe4f8] shadow-[inset_3px_0_0_#0078d4]" : idx % 2 ? "bg-[#f6f8fc] hover:bg-[#eaf1fa]" : "hover:bg-[#eaf1fa]")}
                      >
                        <td className="px-2 py-1.5 font-mono text-[11px] text-slate-400">{String(idx + 1).padStart(2, "0")}</td>
                        <td className="hidden px-2 font-mono text-[11px] text-slate-500 sm:table-cell">{i.sku ?? ""}</td>
                        <td className="px-2 py-1.5 font-medium">{i.name}{i.variationLabel && <span className="block text-[10px] font-normal text-slate-500">{i.variationLabel}</span>}</td>
                        <td className="px-2 text-right font-mono">{i.quantity}</td>
                        <td className="hidden px-2 text-right font-mono sm:table-cell">{money(i.price)}</td>
                        <td className="px-2 text-right font-mono font-semibold">{money(i.price * i.quantity)}</td>
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
            <div className="flex shrink-0 items-center justify-between gap-3 rounded-sm bg-[#0b2234] px-4 py-2 text-white">
              <div className="leading-tight">
                <p className="text-[10px] font-bold uppercase tracking-[.2em] text-sky-300/80">Subtotal</p>
                <p className="font-mono text-[11px] text-white/60">{cart.length} {cart.length === 1 ? "item" : "itens"} · {cart.reduce((a, i) => a + i.quantity, 0)} un.</p>
              </div>
              <span className="font-mono text-[clamp(28px,4.2vw,46px)] font-semibold leading-none tabular-nums text-[#7dff9b]">R$ {money(subtotal)}</span>
            </div>
          </section>
        </main>
      ) : (
        <main className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-y-auto p-3 lg:grid-cols-[minmax(340px,44%)_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)] lg:overflow-hidden">
          <section className="flex min-h-0 flex-col gap-3 lg:overflow-y-auto">
            <div className="rounded-sm border border-[#c5cfdf] bg-white p-3">
              <label className={labelCls}>Forma de pagamento <span className="text-slate-400">(Alt + número)</span></label>
              <div className="mb-3 grid grid-cols-5 gap-1.5">
                {PAY_ORDER.map((m, idx) => (
                  <button
                    key={m} type="button" onClick={() => pickPayMethod(m)}
                    className={cn("flex h-11 flex-col items-center justify-center rounded-sm border text-[11px] font-semibold leading-tight transition-colors",
                      payMethod === m ? "border-[#0078d4] bg-[#0078d4] text-white" : "border-[#c5cfdf] bg-white text-slate-600 hover:border-[#0078d4] hover:text-[#0078d4]")}
                  >
                    <span className="font-mono text-[9px] font-medium opacity-70">Alt+{idx + 1}</span>
                    {PM_SHORT[m]}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-[0.7fr_1fr] gap-2">
                <div>
                  <label className={labelCls}>Parcelas</label>
                  <input
                    className={cn(inputCls, "font-mono")} type="number" min={1} max={maxInstallments} value={payInstallments}
                    disabled={payMethod !== "credit" && payMethod !== "crediario"}
                    onChange={(e) => setPayInstallments(Math.max(1, Math.min(maxInstallments, Number(e.target.value) || 1)))}
                  />
                </div>
                <div>
                  <label className={labelCls}>Valor recebido</label>
                  <input
                    ref={payRef} className={cn(inputCls, "text-right font-mono text-[15px] font-semibold")} value={payAmount} inputMode="decimal" placeholder="0,00"
                    onChange={(e) => setPayAmount(e.target.value)} onFocus={(e) => e.target.select()}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (remaining <= 0.004 && payments.length > 0) void finishSale(); else addPayment(); } }}
                  />
                </div>
              </div>
              {payMethod === "money" && remaining > 0 && (
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] font-medium text-slate-500">Rápido:</span>
                  <button type="button" onClick={() => { setPayAmount(remaining.toFixed(2).replace(".", ",")); payRef.current?.focus(); }}
                    className="h-7 rounded-sm border border-[#c5cfdf] bg-white px-2.5 text-[11px] font-semibold text-slate-600 hover:border-[#0078d4] hover:text-[#0078d4]">Exato</button>
                  {[10, 20, 50, 100, 200].map((v) => (
                    <button key={v} type="button" onClick={() => { setPayAmount(v.toFixed(2).replace(".", ",")); payRef.current?.focus(); }}
                      className="h-7 rounded-sm border border-[#c5cfdf] bg-white px-2.5 font-mono text-[11px] font-semibold text-slate-600 hover:border-[#0078d4] hover:text-[#0078d4]">{v}</button>
                  ))}
                </div>
              )}
              {(payMethod === "debit" || payMethod === "credit") && (
                <div className="mt-2 w-1/2 min-w-[150px]">
                  <label className={labelCls}>Bandeira</label>
                  <select className={inputCls} value={payBrand} onChange={(e) => setPayBrand(e.target.value as CardBrand)}>
                    {BRANDS.map((b) => <option key={b.key} value={b.key}>{b.label}</option>)}
                  </select>
                </div>
              )}
              {split && (
                <div className="mt-3 flex items-center justify-between gap-2 rounded-sm border border-[#0078d4] bg-[#e1effb] px-3 py-1.5 text-[12px] text-[#005a9e]">
                  <span>Dividindo em <b>{split.shares.length}</b> · pessoa <b>{split.idx + 1}</b> de {split.shares.length} · parte <b className="font-mono">R$ {money(split.shares[split.idx])}</b></span>
                  <button type="button" className="font-semibold underline" onClick={() => { setSplit(null); setPayAmount(remaining > 0 ? remaining.toFixed(2).replace(".", ",") : ""); }}>cancelar divisão</button>
                </div>
              )}
              <div className="mt-3 flex items-center justify-between gap-3">
                <p className="text-[13px]"><b>A pagar:</b> <span className="ml-1.5 font-mono text-[24px] font-semibold text-[#0a3d5c]">R$ {money(remaining)}</span></p>
                <button onClick={addPayment} className={btn("blue")}>Adicionar (Enter)</button>
              </div>
              <label className="mt-2 flex items-center gap-2 text-[12px] text-slate-600">
                <input type="checkbox" checked={autoReturn} onChange={toggleAutoReturn} /> Ao finalizar, voltar direto ao caixa livre
              </label>
              <p className="mt-1 text-[11px] text-slate-500">Pagamento dividido: digite um valor menor, tecle Enter e escolha outra forma (Alt+1…5) para o restante.</p>
            </div>

            {shownChange > 0 && (
              <div className="flex items-center justify-between rounded-sm border border-emerald-300 bg-emerald-50 px-4 py-2">
                <span className="text-[13px] font-bold tracking-wide text-emerald-800">TROCO</span>
                <span className="font-mono text-[30px] font-semibold leading-none text-emerald-700">R$ {money(shownChange)}</span>
              </div>
            )}

            {payments.length > 0 && (
              <ul className="divide-y divide-slate-200 rounded-sm border border-[#c5cfdf] bg-white">
                {payments.map((p) => (
                  <li key={p.id} className="flex items-center justify-between px-3 py-2 text-[12px]">
                    <span className="font-medium">
                      {PM_SHORT[p.method]}
                      {(p.method === "debit" || p.method === "credit") && ` · ${BRANDS.find((b) => b.key === p.cardBrand)?.label}`}
                      {p.method === "credit" && p.installments > 1 && ` · ${p.installments}x`}
                      {p.method === "crediario" && p.crediarioInstallments > 1 && ` · ${p.crediarioInstallments}x`}
                    </span>
                    <span className="flex items-center gap-3">
                      <b className="font-mono">R$ {money(num(p.amount))}</b>
                      <button className="text-rose-600" title="Remover pagamento" onClick={() => setPayments((prev) => prev.filter((x) => x.id !== p.id))}>✕</button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="flex min-h-[240px] flex-col gap-3 lg:min-h-0">
            <div className="min-h-0 flex-1 overflow-auto rounded-sm border border-[#c5cfdf] bg-white">
              <table className="w-full border-collapse text-[12px]">
                <thead className="sticky top-0 bg-[#dfe7f2] text-[10px] uppercase tracking-wide text-slate-500">
                  <tr><th className="px-3 py-1.5 text-left">Qtde.</th><th className="px-2 text-left">Produto ({cart.length})</th><th className="hidden px-2 text-right sm:table-cell">Unitário</th><th className="px-3 text-right">Total</th></tr>
                </thead>
                <tbody>
                  {cart.map((i, idx) => (
                    <tr key={i.cartItemId} className={cn("border-b border-slate-200", idx % 2 && "bg-[#f6f8fc]")}>
                      <td className="px-3 py-1.5 font-mono">{i.quantity}</td>
                      <td className="px-2 font-medium">{i.name}{i.variationLabel && <span className="block text-[10px] font-normal text-slate-500">{i.variationLabel}</span>}</td>
                      <td className="hidden px-2 text-right font-mono sm:table-cell">{money(i.price)}</td>
                      <td className="px-3 text-right font-mono font-semibold">{money(i.price * i.quantity)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="shrink-0 rounded-sm bg-[#0b2234] px-4 py-2 text-white">
              <div className="space-y-0.5 font-mono text-[11px] text-white/65">
                <div className="flex justify-between"><span>Subtotal</span><span>R$ {money(subtotal)}</span></div>
                {discountValue > 0 && <div className="flex justify-between text-rose-300"><span>Desconto{discountExceeds && " (limitado ao máximo)"}</span><span>- R$ {money(discountValue)}</span></div>}
                {surchargeValue > 0 && <div className="flex justify-between"><span>Acréscimo</span><span>+ R$ {money(surchargeValue)}</span></div>}
                {passedFee > 0 && <div className="flex justify-between"><span>Taxa da maquininha</span><span>+ R$ {money(passedFee)}</span></div>}
              </div>
              <div className="mt-1 flex items-end justify-between gap-3 border-t border-white/15 pt-1.5">
                <p className="text-[10px] font-bold uppercase tracking-[.2em] text-sky-300/80">Total a pagar</p>
                <span className="font-mono text-[clamp(26px,3.6vw,40px)] font-semibold leading-none tabular-nums text-[#7dff9b]">R$ {money(total)}</span>
              </div>
              <div className="mt-1.5 grid grid-cols-3 gap-2 border-t border-white/15 pt-1.5 font-mono text-[11px]">
                <div><p className="text-[9px] uppercase tracking-wider text-white/50">Pago</p><p className="text-[13px] font-semibold">R$ {money(paid)}</p></div>
                <div><p className="text-[9px] uppercase tracking-wider text-white/50">Falta</p><p className="text-[13px] font-semibold">R$ {money(remaining)}</p></div>
                <div><p className="text-[9px] uppercase tracking-wider text-white/50">Troco</p><p className="text-[13px] font-semibold">R$ {money(change)}</p></div>
              </div>
            </div>
          </section>
        </main>
      )}

      {/* barra de comandos (teclas de função) */}
      <footer className="shrink-0 border-t border-[#b9c6da] bg-[#d9e2ef] px-3 py-1.5">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
          <div className="flex flex-wrap items-center gap-1.5">
            {screen === "sale" ? (
              <>
                <FKey k="F4" label="Em aberto" badge={heldBadge} onClick={() => void openHeld()} />
                <FKey k="F5" label="Preço" onClick={() => { setPriceQuery(""); setModal("price"); }} />
                <FKey k="F2" label="Leitor" active={scannerMode} onClick={() => handlers.current.F2?.()} />
                <FKey k="F3" label="Operador" onClick={() => setModal("operator")} />
              </>
            ) : (
              <>
                <FKey k="F2" label="Cliente" onClick={() => { setLookup(""); setModal("customer"); }} />
                <FKey k="F4" label="Dividir" active={!!split} disabled={remaining <= 0.004} onClick={() => handlers.current.F4?.()} />
                <FKey k="F10" label="Vendedor" onClick={() => { setLookup(""); setModal("seller"); }} />
                <FKey k="F3" label="Desconto" onClick={() => setModal("discount")} />
                <FKey k="F7" label="Recibo" active={printReceipt} onClick={() => setPrintReceipt((v) => !v)} />
                <FKey k="F8" label={isOnline ? "NFC-e" : "NFC-e (online)"} active={emitNfce} disabled={!isOnline} onClick={() => setEmitNfce((v) => !v)} />
              </>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {screen === "sale" ? (
              <>
                <FKey k="F9" label="Cancelar" tone="red" disabled={cart.length === 0} onClick={() => cart.length > 0 && setModal("confirmCancel")} />
                <FKey k="F7" label="Aguardar" disabled={cart.length === 0} onClick={() => void holdSale()} />
                <FKey k="F6" label="Pagamento" tone="green" strong disabled={cart.length === 0} onClick={goToPayment} />
              </>
            ) : (
              <>
                <FKey k="Esc" label="Voltar" onClick={() => setScreen("sale")} />
                <FKey k="F9" label="Cancelar" tone="red" onClick={() => setModal("confirmCancel")} />
                <FKey k="F6" label={finishing ? "Finalizando…" : "Finalizar"} tone="green" strong disabled={!canFinish || finishing} onClick={() => void finishSale()} />
              </>
            )}
          </div>
        </div>
        <p className="mt-1 hidden text-[10px] text-slate-500 lg:block">
          {screen === "sale"
            ? <>Ctrl+P produto · <b>3*código</b> quantidade · ↑ ↓ Del itens · Operador: <b>{operatorName}</b></>
            : <>Alt+1…5 forma de pagamento · Enter adiciona · Esc volta · Operador: <b>{operatorName}</b></>}
        </p>
      </footer>

      {/* ── modais ── */}
      {modal === "variation" && variationProduct && (
        <Overlay title={variationProduct.name} onClose={() => setModal(null)} width={440} hint="Escolha as opções · Enter inclui · Esc cancela">
          <div className="space-y-3">
            {(variationProduct.attributes?.length
              ? variationProduct.attributes.map((a) => ({ name: a.name, values: a.values }))
              : (variationProduct.variations ?? []).map((v) => ({ name: v.name, values: v.options.map((o) => o.value) }))
            ).map((group) => (
              <div key={group.name}>
                <p className={labelCls}>{group.name}</p>
                <div className="flex flex-wrap gap-1.5">
                  {group.values.map((val) => (
                    <button
                      key={val}
                      onClick={() => setVariationOptions((o) => ({ ...o, [group.name]: val }))}
                      className={cn("h-8 rounded-sm border px-3 text-[12px] font-medium", variationOptions[group.name] === val ? "border-[#0078d4] bg-[#0078d4] text-white" : "border-[#c5cfdf] bg-white hover:bg-slate-50")}
                    >{val}</button>
                  ))}
                </div>
              </div>
            ))}
            {(() => {
              const sku = variationProduct.skus?.find((s) => Object.entries(s.combo).every(([k, v]) => variationOptions[k] === v));
              return sku ? <p className="text-[11px] text-slate-500">Estoque desta combinação: <b className="font-mono">{sku.stock}</b></p> : null;
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

      {modal === "price" && (
        <Overlay title="Consultar preço" onClose={() => setModal(null)} width={600} hint="↑ ↓ escolhem · Enter inclui na venda · Esc fecha">
          <input
            className={cn(inputCls, "font-mono")} autoFocus value={priceQuery} autoComplete="off" placeholder="Código, código de barras ou nome"
            onChange={(e) => { setPriceQuery(e.target.value); setPickActive(0); }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); setPickActive((i) => Math.min(i + 1, priceResults.length - 1)); }
              else if (e.key === "ArrowUp") { e.preventDefault(); setPickActive((i) => Math.max(i - 1, 0)); }
              else if (e.key === "Enter" && priceResults[pickActive]) { e.preventDefault(); if (addItem(priceResults[pickActive], 1)) { setModal(null); resetEntry(); } }
            }}
          />
          <div className="mt-2 max-h-[52vh] overflow-auto rounded-sm border border-[#c5cfdf]">
            {priceResults.length > 0 && (
              <div className="sticky top-0 grid grid-cols-[1fr_72px_96px] gap-2 bg-[#dfe7f2] px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                <span>Produto</span><span className="text-right">Estoque</span><span className="text-right">Preço</span>
              </div>
            )}
            {priceResults.map((x, i) => (
              <div
                key={x.id} onMouseEnter={() => setPickActive(i)}
                onClick={() => { if (addItem(x, 1)) { setModal(null); resetEntry(); } }}
                className={cn("grid cursor-pointer grid-cols-[1fr_72px_96px] items-center gap-2 border-b border-slate-100 px-3 py-1.5", i === pickActive ? "bg-[#cfe4f8] shadow-[inset_3px_0_0_#0078d4]" : "hover:bg-slate-50")}
              >
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-medium text-slate-800">{x.name}</p>
                  <p className="truncate font-mono text-[10px] text-slate-500">{x.sku ?? "sem código"}{x.barcode ? ` · ${x.barcode}` : ""}</p>
                </div>
                <span className="text-right font-mono text-[12px] text-slate-600">{x.track_stock === false ? "enc." : x.stock_quantity}</span>
                <b className="text-right font-mono text-[15px] font-semibold text-[#0a3d5c]">{money(Number(x.discount_price || x.price))}</b>
              </div>
            ))}
            {priceQuery.trim() && priceResults.length === 0 && <p className="py-5 text-center text-[12px] text-slate-400">Nenhum produto encontrado.</p>}
            {!priceQuery.trim() && <p className="py-5 text-center text-[12px] text-slate-400">Digite para consultar preço e estoque.</p>}
          </div>
        </Overlay>
      )}

      {modal === "operator" && (
        <Overlay title="Operador" onClose={() => setModal(null)} width={360} hint="Esc volta">
          <p className="mb-2 text-[12px] text-slate-600">Logado como <b>{operatorName}</b></p>
          <div className="divide-y divide-slate-200 rounded-sm border border-[#c5cfdf]">
            {lastReceipt && window.boxsysDesktop?.printReceipt && (
              <button className="flex h-10 w-full items-center px-3 text-left text-[13px] font-medium hover:bg-slate-50" onClick={() => { void printThermalText(lastReceipt, "Cupom").then((r) => { if (!r.ok) flash(r.error || "Falha ao imprimir."); }); setModal(null); }}>Reimprimir último cupom</button>
            )}
            {cashSession && <button className="flex h-10 w-full items-center px-3 text-left text-[13px] font-medium hover:bg-slate-50" onClick={() => { setModal(null); setShowCloseCash(true); }}>Fechar caixa</button>}
            <button className="flex h-10 w-full items-center px-3 text-left text-[13px] font-semibold text-rose-700 hover:bg-rose-50" onClick={logout}>Sair do PDV</button>
          </div>
        </Overlay>
      )}

      {modal === "held" && (
        <Overlay title="Vendas em aberto" onClose={() => setModal(null)} width={620} hint="Retome uma venda guardada com F7 (Aguardar)">
          {heldList.length === 0 ? <p className="py-4 text-center text-[12px] text-slate-500">Nenhuma venda em aberto.</p> : (
            <div className="overflow-hidden rounded-sm border border-[#c5cfdf]">
              <div className="grid grid-cols-[56px_1fr_64px_120px_84px] gap-2 bg-[#dfe7f2] px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                <span>Nº</span><span>Cliente</span><span className="text-right">Itens</span><span>Data</span><span />
              </div>
              {heldList.map((h) => (
                <div key={h.id} className="grid grid-cols-[56px_1fr_64px_120px_84px] items-center gap-2 border-b border-slate-100 px-3 py-1.5 text-[12px] last:border-b-0">
                  <b className="font-mono">#{h.number}</b>
                  <span className="truncate">{h.customer_name || "Consumidor"}</span>
                  <span className="text-right font-mono">{h.items.length}</span>
                  <span className="font-mono text-[11px] text-slate-500">{new Date(h.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
                  <button className={cn(btn("blue"), "h-7 px-2 text-[11px]")} onClick={() => void resumeHeld(h)}>Retomar</button>
                </div>
              ))}
            </div>
          )}
        </Overlay>
      )}

      {modal === "discount" && (
        <Overlay title="Acréscimos e descontos" onClose={() => setModal(null)} width={400} hint="Ao aplicar, os pagamentos já lançados são limpos para recalcular o valor a pagar">
          <div className="space-y-3">
            <div>
              <label className={labelCls}>Desconto</label>
              <div className="flex gap-2">
                <input className={cn(inputCls, "text-right font-mono")} value={discount} inputMode="decimal" autoFocus onFocus={(e) => e.target.select()} onChange={(e) => setDiscount(e.target.value)} />
                <select className={cn(inputCls, "w-20")} value={discountMode} onChange={(e) => setDiscountMode(e.target.value as "R$" | "%")}><option>R$</option><option>%</option></select>
              </div>
              {cartMaxDiscountPct != null && <p className="mt-1 text-[11px] text-slate-500">Desconto máximo neste pedido: {cartMaxDiscountPct}%</p>}
            </div>
            <div>
              <label className={labelCls}>Acréscimo</label>
              <div className="flex gap-2">
                <input className={cn(inputCls, "text-right font-mono")} value={surcharge} inputMode="decimal" onFocus={(e) => e.target.select()} onChange={(e) => setSurcharge(e.target.value)} />
                <select className={cn(inputCls, "w-20")} value={surchargeMode} onChange={(e) => setSurchargeMode(e.target.value as "R$" | "%")}><option>R$</option><option>%</option></select>
              </div>
            </div>
            <button className={cn(btn("blue"), "w-full")} onClick={() => { setModal(null); setPayAmount(""); setPayments([]); window.setTimeout(() => payRef.current?.focus(), 50); }}>Aplicar</button>
          </div>
        </Overlay>
      )}

      {(modal === "customer" || modal === "seller") && (() => {
        const isCustomer = modal === "customer";
        const rows: { id: number | null; name: string; extra?: string }[] = [
          { id: null, name: isCustomer ? "Consumidor final (sem cliente)" : "Sem vendedor" },
          ...(isCustomer
            ? customers.filter((c) => !lookupLower || norm(c.name).includes(lookupLower) || (c.document ?? "").includes(lookup) || (c.phone ?? "").includes(lookup)).slice(0, 40).map((c) => ({ id: c.id, name: c.name, extra: c.document || c.phone }))
            : sellers.filter((s) => !lookupLower || norm(s.name).includes(lookupLower)).map((s) => ({ id: s.id, name: s.name }))),
        ];
        const choose = (id: number | null) => { if (isCustomer) setCustomerId(id); else setSellerId(id); setModal(null); };
        return (
          <Overlay title={isCustomer ? "Referenciar cliente" : "Vendedor"} onClose={() => setModal(null)} width={460} hint="Digite para buscar · ↑ ↓ escolhem · Enter seleciona · Esc fecha">
            <input
              className={inputCls} autoFocus placeholder="Buscar…" value={lookup}
              onChange={(e) => { setLookup(e.target.value); setPickActive(0); }}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") { e.preventDefault(); setPickActive((i) => Math.min(i + 1, rows.length - 1)); }
                else if (e.key === "ArrowUp") { e.preventDefault(); setPickActive((i) => Math.max(i - 1, 0)); }
                else if (e.key === "Enter" && rows[pickActive]) { e.preventDefault(); choose(rows[pickActive].id); }
              }}
            />
            <div className="mt-2 max-h-[50vh] overflow-auto rounded-sm border border-[#c5cfdf]">
              {rows.map((row, i) => (
                <button
                  key={row.id ?? "none"} onMouseEnter={() => setPickActive(i)} onClick={() => choose(row.id)}
                  className={cn("flex w-full items-center justify-between gap-3 border-b border-slate-100 px-3 py-1.5 text-left text-[13px] last:border-b-0", i === pickActive ? "bg-[#cfe4f8] shadow-[inset_3px_0_0_#0078d4]" : "hover:bg-slate-50", row.id === null && "text-slate-500")}
                >
                  <span className="truncate">{row.name}</span>
                  {row.extra && <span className="shrink-0 font-mono text-[11px] text-slate-500">{row.extra}</span>}
                </button>
              ))}
            </div>
          </Overlay>
        );
      })()}

      {modal === "pending" && (
        <Overlay title="Pendências de sincronização" onClose={() => setModal(null)} width={640} hint="Vendas e caixas feitos offline sobem sozinhos quando há internet · se o servidor recusar, o motivo aparece aqui">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-[12px] text-slate-600">{pendingList.length === 0 ? "Tudo sincronizado." : `${pendingList.length} registro(s) aguardando.`} {isOnline ? "" : "Sem internet no momento."}</p>
            <button className={cn(btn("blue"), "h-7 px-3 text-[11px]")} disabled={syncingNow || !isOnline || pendingList.length === 0}
              onClick={async () => { setSyncingNow(true); try { await syncNow(); await loadPendingList(); } finally { setSyncingNow(false); } }}>
              {syncingNow ? "Enviando…" : "Tentar agora"}
            </button>
          </div>
          {pendingList.length > 0 && (
            <div className="max-h-[52vh] overflow-auto rounded-sm border border-[#c5cfdf]">
              {pendingList.map((it) => {
                const err = it.lastError ?? "";
                // erros que não se resolvem sozinhos: o servidor recusa sempre, tentar de novo não adianta
                const hopeless = /não encontrado|nao encontrado|inválid|invalid/i.test(err);
                return (
                  <div key={it.id} className="border-b border-slate-100 px-3 py-2 last:border-b-0">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-medium">{it.label}</p>
                        <p className="font-mono text-[10px] text-slate-500">{new Date(it.createdAt).toLocaleString("pt-BR")} · {it.attempts} tentativa(s)</p>
                      </div>
                      <button className="shrink-0 rounded-sm border border-rose-300 px-2 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-50"
                        onClick={async () => {
                          if (!window.confirm("Descartar este registro? Ele NÃO será enviado ao servidor e não poderá ser recuperado.")) return;
                          if (it.kind === "sale") await removePendingSale(it.id); else await removePendingCashOp(it.id);
                          refreshPending(); void loadPendingList();
                        }}>Descartar</button>
                    </div>
                    {err && (
                      <p className="mt-1 rounded-sm bg-rose-50 px-2 py-1 text-[11px] text-rose-700">
                        <b>Servidor recusou:</b> {err}
                        {hopeless && " — o item desta venda não existe nesta loja (venda feita com produtos de outra loja). Não vai sincronizar sozinha: descarte."}
                      </p>
                    )}
                    {!err && it.attempts === 0 && <p className="mt-1 text-[11px] text-slate-500">Aguardando o próximo envio.</p>}
                  </div>
                );
              })}
            </div>
          )}
        </Overlay>
      )}

      {modal === "split" && (
        <Overlay title="Dividir pagamento" onClose={() => setModal(null)} width={380} hint="Quando não dá exato, as primeiras pessoas pagam 1 centavo a mais · cada uma escolhe a própria forma de pagamento">
          <div className="grid grid-cols-[1fr_96px] items-end gap-3">
            <div>
              <label className={labelCls}>Valor a dividir</label>
              <p className="flex h-9 items-center rounded-sm bg-[#0b2234] px-3 font-mono text-[16px] font-semibold text-[#7dff9b]">R$ {money(remaining)}</p>
            </div>
            <div>
              <label className={labelCls}>Pessoas</label>
              <input
                className={cn(inputCls, "text-center font-mono text-[15px] font-semibold")} autoFocus value={splitPeople} inputMode="numeric" onFocus={(e) => e.target.select()}
                onChange={(e) => setSplitPeople(e.target.value.replace(/\D/g, "").slice(0, 2))}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); startSplit(); } }}
              />
            </div>
          </div>
          {(() => {
            const n = Math.floor(num(splitPeople));
            if (!(n >= 2 && n <= 20)) return <p className="mt-3 text-[11px] text-slate-500">Informe de 2 a 20 pessoas.</p>;
            const shares = splitShares(remaining, n);
            return (
              <div className="mt-3 max-h-44 overflow-y-auto rounded-sm border border-[#c5cfdf] text-[12px]">
                {shares.map((v, i) => (
                  <div key={i} className={cn("flex items-center justify-between border-b border-slate-100 px-3 py-1 last:border-b-0", i % 2 && "bg-[#f6f8fc]")}>
                    <span>Pessoa {i + 1}</span>
                    <b className="font-mono">R$ {money(v)}</b>
                  </div>
                ))}
              </div>
            );
          })()}
          <button className={cn(btn("blue"), "mt-3 w-full")} onClick={startSplit}>Começar (Enter)</button>
        </Overlay>
      )}

      {modal === "qty" && editingItem && (
        <Overlay title="Alterar quantidade" onClose={() => setModal(null)} width={340} hint="Enter confirma · Esc cancela">
          <p className="mb-2 truncate text-[12px] font-medium text-slate-700">{editingItem.name}</p>
          <input
            className={cn(inputCls, "text-center font-mono text-[16px] font-semibold")} autoFocus value={editQty} inputMode="decimal" onFocus={(e) => e.target.select()}
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
        </Overlay>
      )}

      {modal === "confirmCancel" && (
        <Overlay title="Cancelar venda?" onClose={() => setModal(null)} width={360} hint="Enter cancela a venda · Esc volta">
          <p className="mb-3 text-[12px] text-slate-600">Todos os itens e pagamentos desta venda serão descartados.</p>
          <div className="flex gap-2">
            <button className={cn(btn("gray"), "flex-1")} onClick={() => setModal(null)}>Voltar</button>
            <button className={cn(btn("red"), "flex-1")} autoFocus onClick={() => void cancelSale()}>Cancelar venda</button>
          </div>
        </Overlay>
      )}

      {completed && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/55 p-3">
          <div className="w-full max-w-sm overflow-hidden rounded-sm border border-[#0a3d5c] bg-white shadow-2xl">
            <div className="flex h-9 items-center justify-between bg-[#1b7e0e] px-3 text-white">
              <h2 className="text-[13px] font-semibold uppercase tracking-wide">{completed.offline ? "Venda salva (offline)" : "Venda confirmada"}</h2>
              <span className="font-mono text-[11px]">{completed.offline ? "sincroniza depois" : `#${String(completed.orderId).padStart(5, "0")}`}</span>
            </div>
            <div className="p-3">
              <div className="rounded-sm bg-[#0b2234] px-4 py-2 text-white">
                <p className="text-[10px] font-bold uppercase tracking-[.2em] text-sky-300/80">Total</p>
                <p className="font-mono text-[34px] font-semibold leading-tight tabular-nums text-[#7dff9b]">R$ {money(completed.total)}</p>
              </div>
              {completed.change > 0 && (
                <div className="mt-2 flex items-center justify-between rounded-sm border border-emerald-300 bg-emerald-50 px-3 py-1.5">
                  <span className="text-[12px] font-bold tracking-wide text-emerald-800">TROCO</span>
                  <span className="font-mono text-[22px] font-semibold text-emerald-700">R$ {money(completed.change)}</span>
                </div>
              )}
              {completed.nfce && <p className="mt-2 text-[11px] text-slate-600">{completed.nfce}</p>}
              <div className="mt-3 flex gap-2">
                {window.boxsysDesktop?.printReceipt && (
                  <button className={cn(btn("navy"), "flex-1")} onClick={() => printThermalText(completed.receiptText, "Cupom")}>Imprimir (P)</button>
                )}
                <button className={cn(btn("green"), "flex-1")} autoFocus onClick={closeCompleted}>Nova venda (Enter)</button>
              </div>
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
