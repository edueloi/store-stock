import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  Search, ShoppingCart, Plus, Minus, Trash2, User, CreditCard,
  Banknote, Percent, CheckCircle2, Package, X, QrCode, Tag,
  Loader2, Lock, Mail, LogOut, Store, Eye, EyeOff,
  Printer, FileText, MessageCircle, Phone, ChevronRight, ChevronDown,
  PlusCircle, Barcode, Users, Scan, Star, Gift, UserPlus, Download,
  Maximize2, Minimize2, Wrench, WifiOff, RefreshCw,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Product, Category } from "../types";
import { cn } from "../lib/utils";
import Combobox from "../components/ui/Combobox";
import {
  cacheSet, cacheGet, queueSale, getPendingSales,
  removePendingSale, countPendingSales, PendingSale,
} from "../lib/offlineDb";

type PaymentMethod = "money" | "debit" | "credit" | "pix";
type CardBrand = "visa" | "master" | "elo" | "amex" | "hiper" | "other";

const CARD_BRANDS: { key: CardBrand; label: string; color: string }[] = [
  { key: "visa",   label: "Visa",       color: "#1A1F71" },
  { key: "master", label: "Mastercard", color: "#EB001B" },
  { key: "elo",    label: "Elo",        color: "#00A4E0" },
  { key: "amex",   label: "Amex",       color: "#2E77BC" },
  { key: "hiper",  label: "Hipercard",  color: "#B22222" },
  { key: "other",  label: "Outra",      color: "#64748b" },
];

const PM_LABEL: Record<PaymentMethod, string> = {
  money: "Dinheiro", debit: "Débito", credit: "Crédito", pix: "PIX",
};

const PM_ICON: Record<PaymentMethod, React.ReactNode> = {
  money:  <Banknote  size={16} />,
  debit:  <CreditCard size={16} />,
  credit: <CreditCard size={16} />,
  pix:    <QrCode    size={16} />,
};

interface CartItem extends Product {
  price: number;
  quantity: number;
  cartItemId: string;
  variationLabel: string;
  selectedOptions?: Record<string, string>;
}

interface PaymentEntry {
  id: string;
  method: PaymentMethod;
  cardBrand: CardBrand;
  installments: number;
  amount: string;
}

interface CompletedSale {
  orderId: number;
  customerName: string;
  sellerName: string;
  payments: PaymentEntry[];
  items: { name: string; quantity: number; price: number; image_url?: string }[];
  subtotal: number;
  discountValue: number;
  surchargeValue: number;
  feeAmount: number;
  total: number;
  change: number;
  tenantName: string;
  tenantAddress: string;
  tenantLogo: string;
  tenantColor: string;
  tenantWhatsapp: string;
  cardFees: Record<string, number[]>;
  pointsEarned?: number;
  rewardApplied?: string;
  offline?: boolean;
}

interface SellerEntry { id: number; name: string; commission_rate: number }
interface ServiceItem  { id: number; name: string; price: number; description?: string }

function newPayment(): PaymentEntry {
  return { id: Math.random().toString(36).slice(2), method: "money", cardBrand: "visa", installments: 1, amount: "" };
}

// ─── Masks ────────────────────────────────────────────────────────────────────
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

// ─── LOGIN ────────────────────────────────────────────────────────────────────
function PDVLogin({ onLogin }: { onLogin: (token: string) => void }) {
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res  = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem("token", data.token);
        localStorage.setItem("user", JSON.stringify(data.user));
        if (data.user?.role && data.user.role !== "pdv") {
          window.location.href = data.user.role === "super_admin" ? "/super-admin" : "/admin";
          return;
        }
        onLogin(data.token);
      } else {
        setError(data.error || "Credenciais inválidas.");
      }
    } catch {
      setError("Erro ao conectar com o servidor.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 font-sans">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm">
        <div className="text-center mb-10">
          <div className="w-20 h-20 bg-gradient-to-br from-blue-600 to-blue-800 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-blue-500/40 ring-1 ring-blue-500/30">
            <Store size={32} className="text-white" />
          </div>
          <h1 className="text-2xl font-black text-white uppercase tracking-[0.2em]">PDV Nexus</h1>
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mt-2">Terminal de Vendas · Acesso Seguro</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={15} />
            <input type="email" placeholder="E-MAIL" value={email} onChange={(e) => setEmail(e.target.value)} required
              className="w-full pl-11 pr-4 h-13 bg-slate-900 border border-slate-700 rounded-2xl text-[12px] font-bold uppercase tracking-widest text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all" />
          </div>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={15} />
            <input type={showPassword ? "text" : "password"} placeholder="SENHA" value={password} onChange={(e) => setPassword(e.target.value)} required
              className="w-full pl-11 pr-12 h-13 bg-slate-900 border border-slate-700 rounded-2xl text-[12px] font-bold uppercase tracking-widest text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all" />
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
              title={showPassword ? "Ocultar senha" : "Mostrar senha"}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {error && (
            <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
              className="bg-red-500/10 border border-red-500/20 px-4 py-3 rounded-xl flex items-center gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
              <p className="text-[11px] font-bold text-red-400 uppercase tracking-widest">{error}</p>
            </motion.div>
          )}
          <button type="submit" disabled={loading}
            className="w-full h-13 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white rounded-2xl text-[12px] font-black uppercase tracking-[0.2em] shadow-xl shadow-blue-500/30 transition-all active:scale-[0.98] disabled:opacity-40 flex items-center justify-center gap-2 mt-2">
            {loading ? <Loader2 size={17} className="animate-spin" /> : "Acessar PDV"}
          </button>
        </form>
        <p className="mt-8 text-center text-[10px] text-slate-600 font-bold uppercase tracking-widest">
          Acesso exclusivo para operadores autorizados
        </p>
      </motion.div>
    </div>
  );
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
export default function PDVStandalone() {
  const [token, setToken]           = useState<string | null>(() => localStorage.getItem("token"));
  const [products, setProducts]     = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [cart, setCart]             = useState<CartItem[]>([]);
  const [cardFees, setCardFees]     = useState<Record<string, number[]>>({});
  const [passFeeToCustomer, setPassFeeToCustomer] = useState(false);
  const [passFeeByMethod, setPassFeeByMethod]     = useState<Record<string, boolean>>({});
  const [maxInstallments, setMaxInstallments]     = useState(12);
  const [enabledBrands, setEnabledBrands]         = useState<Record<string, boolean>>({ visa: true, master: true, elo: true, amex: true, hiper: true, other: true });
  const [loading, setLoading]       = useState(false);
  const [finishing, setFinishing]   = useState(false);
  const [isOnline, setIsOnline]     = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing]       = useState(false);
  const [syncToast, setSyncToast]   = useState<string | null>(null);
  const [showPendingModal, setShowPendingModal] = useState(false);
  const [pendingSalesList, setPendingSalesList] = useState<PendingSale[]>([]);
  const [discardTarget, setDiscardTarget] = useState<PendingSale | null>(null);
  const [showCartMobile, setShowCartMobile] = useState(false);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [configProduct, setConfigProduct] = useState<Product | null>(null);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const [tenantName, setTenantName]   = useState("PDV");
  const [tenantAddress, setTenantAddress] = useState("");

  // checkout fields — customer
  interface CustomerOption { id: number; name: string; phone?: string; document?: string; }
  const [customers, setCustomers]           = useState<CustomerOption[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [customerName, setCustomerName]     = useState("");
  const [customerPoints, setCustomerPoints] = useState<number>(0);
  const [loyaltyRewards, setLoyaltyRewards] = useState<{ id: number; name: string; points_cost: number; type: string; discount_value?: number; discount_type?: string }[]>([]);
  const [loyaltyProgram, setLoyaltyProgram] = useState<{ spend_per_point: number; is_active: boolean } | null>(null);
  const [appliedReward, setAppliedReward]   = useState<{ id: number; name: string; points_cost: number; type: string; discount_value?: number; discount_type?: string } | null>(null);
  // new customer full-form
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [ncName, setNcName]       = useState("");
  const [ncPhone, setNcPhone]     = useState("");
  const [ncDoc, setNcDoc]         = useState("");
  const [ncEmail, setNcEmail]     = useState("");
  const [ncAddr, setNcAddr]       = useState("");
  const [ncBirth, setNcBirth]     = useState("");
  const [ncCredit, setNcCredit]   = useState("");
  const [ncNotes, setNcNotes]     = useState("");
  const [ncRisk, setNcRisk]       = useState(false);
  const [ncRiskReason, setNcRiskReason] = useState("");
  const [savingNC, setSavingNC]   = useState(false);
  const [sellers, setSellers]             = useState<SellerEntry[]>([]);
  const [selectedSellerId, setSelectedSellerId] = useState<number | null>(null);
  const [discount, setDiscount]           = useState("");
  const [discountMode, setDiscountMode]   = useState<"R$" | "%">("R$");
  const [surcharge, setSurcharge]         = useState("");
  const [surchargeMode, setSurchargeMode] = useState<"R$" | "%">("R$");
  const [payments, setPayments]           = useState<PaymentEntry[]>([newPayment()]);
  const [tenantLogo, setTenantLogo]       = useState("");
  const [tenantColor, setTenantColor]     = useState("#2563eb");
  const [tenantWhatsapp, setTenantWhatsapp] = useState("");

  // services
  const [services, setServices]               = useState<ServiceItem[]>([]);
  const [cartServices, setCartServices]       = useState<ServiceItem[]>([]);
  const [showServicesModal, setShowServicesModal] = useState(false);

  // receipt modal
  const [completedSale, setCompletedSale]   = useState<CompletedSale | null>(null);
  const [showReceipt, setShowReceipt]       = useState(false);
  const [whatsappPhone, setWhatsappPhone]   = useState("");
  const [showPhoneInput, setShowPhoneInput] = useState(false);

  // barcode scanner
  const [scanCode, setScanCode]         = useState("");
  const [scanFeedback, setScanFeedback] = useState<"ok" | "err" | null>(null);
  const scanInputRef = useRef<HTMLInputElement>(null);

  // ── PWA install prompt ───────────────────────────────────────────────────────
  const [installPrompt, setInstallPrompt]   = useState<Event | null>(null);
  const [pwaInstalled, setPwaInstalled]     = useState(false);
  const [showInstallModal, setShowInstallModal] = useState(false);

  const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  const isIos    = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isStandalone = window.matchMedia("(display-mode: standalone)").matches
    || ("standalone" in window.navigator && (window.navigator as { standalone?: boolean }).standalone === true);

  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (isStandalone) {
      setPwaInstalled(true);
      // auto fullscreen when running as installed PWA
      document.documentElement.requestFullscreen?.().catch(() => {});
      setIsFullscreen(true);
    }
    const handler = (e: Event) => { e.preventDefault(); setInstallPrompt(e); };
    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", () => { setInstallPrompt(null); setPwaInstalled(true); });
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFsChange);
    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      document.removeEventListener("fullscreenchange", onFsChange);
    };
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.();
    }
  };

  // Opens our custom modal — NOT the browser prompt directly
  const handleInstallPwa = () => setShowInstallModal(true);

  // Called when user confirms inside our modal
  const confirmInstall = async () => {
    setShowInstallModal(false);
    if (isSafari || isIos) return; // Safari: modal already shows instructions
    if (!installPrompt) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (installPrompt as any).prompt();
    setInstallPrompt(null); setPwaInstalled(true);
  };

  const handleLogin  = (t: string) => setToken(t);
  const handleLogout = () => {
    localStorage.removeItem("token"); localStorage.removeItem("user");
    setToken(null); setCart([]);
  };

  // ── offline sync ─────────────────────────────────────────────────────────────
  const refreshPendingCount = useCallback(() => {
    countPendingSales().then(setPendingCount);
  }, []);

  const syncPendingSales = useCallback(async () => {
    if (!token || !navigator.onLine) return;
    const pending = await getPendingSales();
    if (pending.length === 0) return;
    setSyncing(true);
    let syncedCount = 0;
    try {
      // oldest first, so server-side order ids follow the real sale order
      pending.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      for (const sale of pending) {
        try {
          const res = await fetch("/api/sales", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify(sale.body),
          });
          if (res.ok) {
            await removePendingSale(sale.localId);
            syncedCount++;
          } else if (res.status === 401) {
            break; // session expired — stop, retry after next login
          } else {
            // server rejected this sale — record the error and move on to the next
            let msg = `Erro ${res.status}`;
            try { const j = await res.json(); if (j?.error) msg = j.error; } catch { /* keep status */ }
            await queueSale({ ...sale, attempts: (sale.attempts ?? 0) + 1, lastError: msg });
          }
        } catch {
          break; // network dropped mid-sync — remaining sales stay queued
        }
      }
    } finally {
      setSyncing(false);
      refreshPendingCount();
      setPendingSalesList(await getPendingSales());
      if (syncedCount > 0) {
        setSyncToast(`${syncedCount} venda${syncedCount > 1 ? "s" : ""} sincronizada${syncedCount > 1 ? "s" : ""}!`);
        setTimeout(() => setSyncToast(null), 4000);
        // refresh stock after syncing
        fetch("/api/products", { headers: { Authorization: `Bearer ${token}` } })
          .then((r) => r.json())
          .then((d) => {
            if (Array.isArray(d)) { setProducts(d); cacheSet("products", d); }
          })
          .catch(() => {});
      }
    }
  }, [token, refreshPendingCount]);

  // connection listeners + periodic sync
  useEffect(() => {
    const goOnline  = () => { setIsOnline(true); syncPendingSales(); };
    const goOffline = () => setIsOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    refreshPendingCount();
    syncPendingSales();
    const interval = setInterval(() => { if (navigator.onLine) syncPendingSales(); }, 60_000);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
      clearInterval(interval);
    };
  }, [syncPendingSales, refreshPendingCount]);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    const headers = { Authorization: `Bearer ${token}` };
    const applyTenant = (tenant: Record<string, unknown> | null | undefined) => {
      if (!tenant) return;
      const t = tenant as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
      if (t.name) setTenantName(t.name);
      if (t.address_street) {
        const parts = [
          `${t.address_street}${t.address_number ? ", " + t.address_number : ""}`,
          t.address_complement,
          t.address_district,
          t.address_city && t.address_state
            ? `${t.address_city} - ${t.address_state}`
            : (t.address_city ?? t.address_state ?? ""),
          t.address_zip,
        ].filter(Boolean);
        setTenantAddress(parts.join(" | "));
      } else if (t.address) {
        setTenantAddress(t.address);
      }
      if (t.card_fees) setCardFees(t.card_fees);
      if (t.pass_fee_to_customer !== undefined) setPassFeeToCustomer(Boolean(t.pass_fee_to_customer));
      if (t.pass_fee_by_method) setPassFeeByMethod(t.pass_fee_by_method as Record<string, boolean>);
      if (t.max_installments) setMaxInstallments(Number(t.max_installments));
      if (t.enabled_brands) setEnabledBrands(t.enabled_brands as Record<string, boolean>);
      if (t.logo_url) setTenantLogo(t.logo_url);
      if (t.primary_color) setTenantColor(t.primary_color);
      if (t.whatsapp) setTenantWhatsapp(t.whatsapp);
    };

    Promise.all([
      fetch("/api/products",   { headers }).then((r) => { if (r.status === 401) { handleLogout(); throw new Error("unauth"); } return r.json(); }),
      fetch("/api/categories", { headers }).then((r) => r.json()),
      fetch("/api/tenant",     { headers }).then((r) => r.json()),
    ])
      .then(([prods, cats, tenant]) => {
        setProducts(Array.isArray(prods) ? prods : []);
        setCategories(Array.isArray(cats) ? cats : []);
        applyTenant(tenant);
        // snapshot for offline use
        cacheSet("products", Array.isArray(prods) ? prods : []);
        cacheSet("categories", Array.isArray(cats) ? cats : []);
        cacheSet("tenant", tenant ?? null);
      })
      .catch((err) => {
        if (err?.message === "unauth") return;
        // offline — restore last snapshot
        Promise.all([
          cacheGet<Product[]>("products"),
          cacheGet<Category[]>("categories"),
          cacheGet<Record<string, unknown>>("tenant"),
        ]).then(([prods, cats, tenant]) => {
          if (prods) setProducts(prods);
          if (cats) setCategories(cats);
          applyTenant(tenant);
        });
      })
      .finally(() => setLoading(false));

    fetch("/api/sellers", { headers })
      .then((r) => r.json())
      .then((d) => {
        const list = Array.isArray(d) ? d.filter((s: SellerEntry & { is_active?: boolean }) => s.is_active !== false) : [];
        setSellers(list);
        cacheSet("sellers", list);
      })
      .catch(() => { cacheGet<SellerEntry[]>("sellers").then((d) => { if (d) setSellers(d); }); });

    fetch("/api/customers", { headers })
      .then((r) => r.json())
      .then((d) => {
        const list = Array.isArray(d) ? d : [];
        setCustomers(list);
        cacheSet("customers", list);
      })
      .catch(() => { cacheGet<CustomerOption[]>("customers").then((d) => { if (d) setCustomers(d); }); });

    fetch("/api/services", { headers })
      .then((r) => r.json())
      .then((d) => {
        const list = Array.isArray(d) ? d.filter((s: ServiceItem & { is_active?: boolean }) => s.is_active !== false) : [];
        setServices(list);
        cacheSet("services", list);
      })
      .catch(() => { cacheGet<ServiceItem[]>("services").then((d) => { if (d) setServices(d); }); });

    Promise.all([
      fetch("/api/loyalty/program", { headers }).then((r) => r.json()),
      fetch("/api/loyalty/rewards", { headers }).then((r) => r.json()),
    ]).then(([pg, rw]) => {
      setLoyaltyProgram({ spend_per_point: Number(pg.spend_per_point ?? 10), is_active: pg.is_active ?? false });
      setLoyaltyRewards(Array.isArray(rw) ? rw.filter((r: { is_active: boolean }) => r.is_active) : []);
    }).catch(() => {});
  }, [token]);

  // ── barcode scanner ──────────────────────────────────────────────────────────
  const addToCartDirect = useCallback((product: Product) => {
    const cartItemId = `${product.id}`;
    setCart((prev) => {
      const existing = prev.find((i) => i.cartItemId === cartItemId);
      if (existing) {
        return prev.map((i) => i.cartItemId === cartItemId ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { ...product, price: Number(product.price), quantity: 1, cartItemId, variationLabel: "", selectedOptions: undefined }];
    });
  }, []);

  const handleScan = useCallback(async (code: string) => {
    const trimmed = code.trim();
    if (!trimmed) return;
    setScanCode("");

    const local = products.find((p) => p.barcode === trimmed);
    if (local) {
      addToCartDirect(local);
      setScanFeedback("ok");
      setTimeout(() => setScanFeedback(null), 1200);
      return;
    }

    try {
      const res = await fetch(`/api/products/by-barcode/${encodeURIComponent(trimmed)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const p = await res.json();
        setProducts((prev) => prev.some((x) => x.id === p.id) ? prev : [...prev, p]);
        addToCartDirect(p);
        setScanFeedback("ok");
      } else {
        setScanFeedback("err");
      }
    } catch {
      setScanFeedback("err");
    }
    setTimeout(() => setScanFeedback(null), 1200);
  }, [products, token, addToCartDirect]);

  useEffect(() => {
    let lastKeyTime = 0;
    let buffer = "";
    let timer: ReturnType<typeof setTimeout> | null = null;

    const flush = (code: string) => {
      buffer = "";
      if (timer) { clearTimeout(timer); timer = null; }
      if (code.trim().length >= 3) handleScan(code.trim());
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (document.activeElement?.tagName ?? "").toLowerCase();
      const isEditable = tag === "input" || tag === "textarea" || tag === "select";
      const now = Date.now();
      const gap = now - lastKeyTime;
      lastKeyTime = now;

      if (e.key === "Enter") {
        if (buffer.length >= 3) { e.preventDefault(); flush(buffer); }
        return;
      }
      if (e.key.length !== 1) return;
      if (document.activeElement === scanInputRef.current) return;
      if (gap > 80 && isEditable) return;

      e.preventDefault();
      buffer += e.key;
      scanInputRef.current?.focus();
      setScanCode(buffer);

      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        const b = buffer; buffer = "";
        if (b.trim().length >= 3) handleScan(b.trim());
      }, 300);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleScan]);

  // ── cart helpers ─────────────────────────────────────────────────────────────
  const addToCart = (product: Product, options?: Record<string, string>) => {
    const hasAttr = Array.isArray(product.attributes) && product.attributes.length > 0;
    const hasLeg  = !hasAttr && Array.isArray(product.variations) && product.variations.length > 0;
    if ((hasAttr || hasLeg) && !options) {
      setConfigProduct(product);
      const init: Record<string, string> = {};
      if (hasAttr) product.attributes!.forEach((a) => (init[a.name] = a.values[0] ?? ""));
      else product.variations!.forEach((v) => (init[v.name] = v.options[0]?.value ?? ""));
      setSelectedOptions(init);
      return;
    }
    const variationLabel = options ? Object.entries(options).map(([k, v]) => `${k}: ${v}`).join(", ") : "";
    const cartItemId     = options ? `${product.id}-${variationLabel}` : `${product.id}`;
    const existing       = cart.find((i) => i.cartItemId === cartItemId);
    if (existing) {
      setCart(cart.map((i) => i.cartItemId === cartItemId ? { ...i, quantity: i.quantity + 1 } : i));
    } else {
      setCart([...cart, { ...product, price: Number(product.price), quantity: 1, cartItemId, selectedOptions: options, variationLabel }]);
    }
    setConfigProduct(null); setSelectedOptions({});
  };

  const updateQuantity = (cartItemId: string, delta: number) => {
    setCart(cart.map((item) => {
      if (item.cartItemId !== cartItemId) return item;
      const nq = item.quantity + delta;
      if (nq <= 0) return null as unknown as CartItem;
      return { ...item, quantity: nq };
    }).filter(Boolean));
  };
  const removeFromCart = (id: string) => setCart(cart.filter((i) => i.cartItemId !== id));

  // ── totals ───────────────────────────────────────────────────────────────────
  const servicesTotal  = cartServices.reduce((a, s) => a + Number(s.price), 0);
  const subtotal       = cart.reduce((a, b) => a + b.price * b.quantity, 0) + servicesTotal;
  const discountRaw    = Number(discount) || 0;
  const discountValue  = discountMode === "%"
    ? Math.min(subtotal * discountRaw / 100, subtotal)
    : Math.min(discountRaw, subtotal);
  const surchargeRaw   = Number(surcharge) || 0;
  const surchargeValue = surchargeMode === "%"
    ? subtotal * surchargeRaw / 100
    : surchargeRaw;
  const baseTotal      = subtotal - discountValue + surchargeValue;
  const getFeeRate = (p: PaymentEntry) => {
    if (p.method === "credit") return cardFees[p.cardBrand]?.[p.installments - 1] ?? 0;
    if (p.method === "debit")  return cardFees[`debit_${p.cardBrand}`]?.[0] ?? 0;
    if (p.method === "pix")    return cardFees["pix"]?.[0] ?? 0;
    return 0;
  };
  // isPassFee: true se qualquer método ativo tem repasse configurado
  const isPassFee = (p: PaymentEntry) => !!(passFeeByMethod[p.method] ?? passFeeToCustomer);

  // feeAmount total (considerando repasse por método)
  const feeAmount = payments.reduce((sum, p) => {
    const rate = getFeeRate(p);
    if (!rate) return sum;
    const pAmt = Number(p.amount) || 0;
    const ref  = pAmt > 0 ? pAmt : baseTotal;
    return sum + ref * (rate / 100);
  }, 0);

  // Taxa que é repassada ao cliente (soma só dos métodos com repasse ativo)
  const passedFeeAmount = payments.reduce((sum, p) => {
    if (!isPassFee(p)) return sum;
    const rate = getFeeRate(p);
    if (!rate) return sum;
    const pAmt = Number(p.amount) || 0;
    const ref  = pAmt > 0 ? pAmt : baseTotal;
    return sum + ref * (rate / 100);
  }, 0);

  const total = Math.round((baseTotal + passedFeeAmount) * 100) / 100;
  const paidAmount  = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const remaining   = Math.max(0, total - paidAmount);
  const moneyPmt    = payments.find((p) => p.method === "money");
  const moneyAmt    = Number(moneyPmt?.amount) || 0;
  const change      = moneyAmt > 0 && paidAmount >= total ? moneyAmt - (total - (paidAmount - moneyAmt)) : 0;
  const cartQty     = cart.reduce((a, b) => a + b.quantity, 0);
  const canFinish   = cart.length > 0 && total > 0;

  // ── payment helpers ──────────────────────────────────────────────────────────
  const updatePayment = useCallback((id: string, patch: Partial<PaymentEntry>) =>
    setPayments((ps) => ps.map((p) => p.id === id ? { ...p, ...patch } : p)), []);
  const removePayment = useCallback((id: string) =>
    setPayments((ps) => ps.length > 1 ? ps.filter((p) => p.id !== id) : ps), []);
  const addPayment = useCallback(() => {
    setPayments((ps) => {
      const rem = ps.reduce((s, p) => s - (Number(p.amount) || 0), Math.max(0, total - paidAmount + (ps.reduce((s,p)=>s+(Number(p.amount)||0),0))));
      return [...ps, { ...newPayment(), amount: rem > 0 ? rem.toFixed(2) : "" }];
    });
  }, [total, paidAmount]);

  const handleMethodChange = useCallback((id: string, method: PaymentMethod) => {
    setPayments((ps) => {
      const updated = ps.map((p) => p.id === id ? { ...p, method, installments: 1 } : p);
      if (updated.length === 1 && method !== "money" && total > 0) {
        return updated.map((p) => p.id === id ? { ...p, amount: total.toFixed(2) } : p);
      }
      if (updated.length > 1 && method !== "money") {
        const others = updated.filter((p) => p.id !== id).reduce((s, p) => s + (Number(p.amount) || 0), 0);
        const rem = Math.max(0, total - others);
        if (rem > 0) return updated.map((p) => p.id === id ? { ...p, amount: rem.toFixed(2) } : p);
      }
      return updated;
    });
  }, [total]);

  const openCheckout = () => {
    setPayments((ps) => {
      if (ps.length === 1 && total > 0) return [{ ...ps[0], amount: total.toFixed(2) }];
      return ps;
    });
    setShowCheckoutModal(true);
  };

  // ── receipt helpers ──────────────────────────────────────────────────────────
  const buildThermalHtml = (sale: CompletedSale) => {
    const now = new Date().toLocaleString("pt-BR");
    const orderId = sale.offline ? "OFFLINE" : String(sale.orderId).padStart(6, "0");
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Cupom #${orderId}</title>
<style>
  * { box-sizing:border-box; margin:0; padding:0; }
  body { font-family:'Courier New',Courier,monospace; font-size:12px; width:302px; margin:0 auto; padding:12px 10px; background:#fff; color:#000; }
  .center { text-align:center; }
  .bold { font-weight:bold; }
  .divider { border:none; border-top:1px dashed #000; margin:6px 0; }
  .divider-solid { border:none; border-top:2px solid #000; margin:6px 0; }
  .row { display:flex; justify-content:space-between; margin:2px 0; font-size:11px; }
  .row-total { display:flex; justify-content:space-between; font-size:14px; font-weight:bold; margin:4px 0; }
  .item-sub { font-size:11px; color:#333; margin-top:1px; }
  .small { font-size:10px; color:#555; margin-top:12px; line-height:1.6; text-align:center; }
  @media print { @page { margin:0; size:80mm auto; } body { padding:8px 6px; } }
</style></head><body>
<div class="center bold" style="font-size:13px;letter-spacing:1px;text-transform:uppercase">${sale.tenantName}</div>
${sale.tenantAddress ? `<div class="center" style="font-size:10px;color:#555;margin-top:2px">${sale.tenantAddress}</div>` : ""}
<hr class="divider" style="margin-top:8px"/>
<div class="center bold" style="font-size:11px;letter-spacing:2px">CUPOM NÃO FISCAL</div>
<div class="center" style="font-size:11px">NF-${orderId}</div>
<hr class="divider"/>
<div class="center" style="font-size:11px">${now}</div>
<hr class="divider"/>
<div class="bold" style="font-size:11px">CLIENTE</div>
<div style="font-size:11px;margin:2px 0">${sale.customerName || "CONSUMIDOR FINAL"}</div>
${sale.sellerName ? `<div style="font-size:11px;margin:2px 0">VENDEDOR: ${sale.sellerName}</div>` : ""}
<hr class="divider"/>
<div class="center bold" style="font-size:11px;letter-spacing:2px;margin-bottom:4px">ITENS</div>
${sale.items.map((item) => `
<div style="margin:4px 0">
  <div class="bold" style="font-size:11px;text-transform:uppercase">${item.name}</div>
  <div class="row item-sub"><span>${item.quantity},00 x R$ ${item.price.toFixed(2)}</span><span class="bold">R$ ${(item.price * item.quantity).toFixed(2)}</span></div>
</div>`).join("")}
<hr class="divider"/>
<div class="row"><span class="bold">QTD DE ITENS:</span><span>${sale.items.reduce((a, b) => a + b.quantity, 0)}</span></div>
${(sale.discountValue > 0 || sale.surchargeValue > 0) ? `<div class="row"><span>SUBTOTAL</span><span>R$ ${sale.subtotal.toFixed(2)}</span></div>` : ""}
${sale.discountValue > 0 ? `<div class="row"><span>DESCONTO</span><span>- R$ ${sale.discountValue.toFixed(2)}</span></div>` : ""}
${sale.surchargeValue > 0 ? `<div class="row"><span>ACRÉSCIMO</span><span>+ R$ ${sale.surchargeValue.toFixed(2)}</span></div>` : ""}
${sale.feeAmount > 0 ? `<div class="row"><span>JUROS MÁQUINA</span><span>+ R$ ${sale.feeAmount.toFixed(2)}</span></div>` : ""}
<hr class="divider-solid"/>
<div class="row-total"><span>TOTAL R$:</span><span>R$ ${sale.total.toFixed(2)}</span></div>
<hr class="divider-solid"/>
${sale.payments.map((p) => {
  const brand = (p.method === "debit" || p.method === "credit") && p.cardBrand !== "other" ? `/${p.cardBrand.toUpperCase()}` : "";
  const inst  = p.method === "credit" && p.installments > 1 ? ` ${p.installments}X` : "";
  const label = `${PM_LABEL[p.method]}${brand}${inst}`.toUpperCase();
  return `<div class="row"><span class="bold">PAGAMENTO:</span><span>${label}</span></div><div class="row"><span></span><span class="bold">R$ ${Number(p.amount).toFixed(2)}</span></div>`;
}).join('<hr class="divider"/>')}
${sale.change > 0 ? `<hr class="divider"/><div class="row bold"><span>TROCO:</span><span>R$ ${sale.change.toFixed(2)}</span></div>` : ""}
<hr class="divider"/>
<div class="center bold" style="font-size:11px;letter-spacing:1px;margin:6px 0">OBRIGADO PELA PREFERÊNCIA!</div>
<div class="center" style="font-size:11px">VOLTE SEMPRE</div>
<p class="small">Este não é um documento fiscal<br/>Emitido em ${now}</p>
</body></html>`;
  };

  const buildPDFHtml = (sale: CompletedSale) => {
    const now = new Date().toLocaleString("pt-BR");
    const orderId = sale.offline ? "OFFLINE" : String(sale.orderId).padStart(5, "0");
    const payLines = sale.payments.map((p) => {
      const brand = (p.method === "debit" || p.method === "credit") && p.cardBrand !== "other" ? ` · ${p.cardBrand.toUpperCase()}` : "";
      const inst  = p.method === "credit" && p.installments > 1 ? ` ${p.installments}×` : "";
      return `<div style="display:flex;justify-content:space-between;font-size:13px;color:#93c5fd;padding:3px 0"><span>${PM_LABEL[p.method]}${brand}${inst}</span><span>R$ ${Number(p.amount).toFixed(2)}</span></div>`;
    }).join("");
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Nota PDV #${orderId}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
  * { box-sizing:border-box; margin:0; padding:0; }
  body { font-family:'Inter',sans-serif; background:#fff; color:#0f172a; padding:40px; max-width:700px; margin:0 auto; }
  .header { display:flex; align-items:flex-start; justify-content:space-between; margin-bottom:32px; padding-bottom:24px; border-bottom:3px solid #0f172a; }
  .store-name { font-size:22px; font-weight:900; text-transform:uppercase; letter-spacing:1px; }
  .store-addr { font-size:12px; color:#64748b; margin-top:4px; }
  .header-right { text-align:right; }
  .receipt-num { font-size:28px; font-weight:900; }
  .section { margin-bottom:24px; }
  .section-title { font-size:10px; font-weight:800; color:#94a3b8; text-transform:uppercase; letter-spacing:3px; margin-bottom:10px; }
  .customer-box { background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:14px 18px; }
  table { width:100%; border-collapse:collapse; }
  thead tr th { font-size:10px; font-weight:800; text-transform:uppercase; letter-spacing:2px; color:#94a3b8; padding:8px 0; border-bottom:1px solid #e2e8f0; text-align:left; }
  thead tr th:last-child { text-align:right; }
  tbody tr td { padding:10px 0; border-bottom:1px solid #f1f5f9; vertical-align:middle; }
  .totals-box { background:#0f172a; border-radius:16px; padding:20px 24px; color:#fff; margin-top:24px; }
  .totals-row { display:flex; justify-content:space-between; font-size:13px; padding:4px 0; color:#94a3b8; }
  .totals-row.main { font-size:24px; font-weight:900; color:#fff; padding-top:12px; border-top:1px solid #334155; margin-top:8px; }
  .footer { margin-top:40px; padding-top:20px; border-top:1px solid #e2e8f0; text-align:center; font-size:11px; color:#94a3b8; }
  @media print { @page { size:A4; margin:20mm 15mm; } body { padding:0; } }
</style></head><body>
<div class="header">
  <div>
    ${sale.tenantLogo ? `<img src="${sale.tenantLogo}" style="max-height:56px;max-width:140px;object-fit:contain;margin-bottom:8px;display:block" alt="logo"/>` : ""}
    <div class="store-name">${sale.tenantName}</div>
    ${sale.tenantAddress ? `<div class="store-addr">${sale.tenantAddress}</div>` : ""}
  </div>
  <div class="header-right">
    <div style="font-size:10px;font-weight:800;color:#94a3b8;text-transform:uppercase;letter-spacing:3px">Comprovante PDV</div>
    <div class="receipt-num">#${orderId}</div>
    <div style="font-size:12px;color:#64748b;margin-top:4px">${now}</div>
  </div>
</div>
<div class="section">
  <div class="section-title">Cliente</div>
  <div class="customer-box">
    <div style="font-size:16px;font-weight:700">${sale.customerName || "Consumidor Final"}</div>
    ${sale.sellerName ? `<div style="font-size:13px;color:#64748b;margin-top:4px">Vendedor: ${sale.sellerName}</div>` : ""}
  </div>
</div>
<div class="section">
  <div class="section-title">Itens da Venda</div>
  <table>
    <thead><tr><th>Produto</th><th>Qtd</th><th>Unit.</th><th>Total</th></tr></thead>
    <tbody>${sale.items.map((item) => `
      <tr>
        <td style="font-weight:700;font-size:13px">${item.name}</td>
        <td><span style="font-size:12px;color:#64748b;background:#f1f5f9;border-radius:6px;padding:2px 8px">${item.quantity}</span></td>
        <td style="font-size:13px;color:#64748b">R$ ${item.price.toFixed(2)}</td>
        <td style="text-align:right;font-weight:700;font-size:13px">R$ ${(item.price * item.quantity).toFixed(2)}</td>
      </tr>`).join("")}
    </tbody>
  </table>
</div>
<div class="totals-box">
  ${(sale.discountValue > 0 || sale.surchargeValue > 0) ? `<div class="totals-row"><span>Subtotal</span><span>R$ ${sale.subtotal.toFixed(2)}</span></div>` : ""}
  ${sale.discountValue > 0 ? `<div class="totals-row" style="color:#34d399"><span>Desconto</span><span>− R$ ${sale.discountValue.toFixed(2)}</span></div>` : ""}
  ${sale.surchargeValue > 0 ? `<div class="totals-row" style="color:#fbbf24"><span>Acréscimo</span><span>+ R$ ${sale.surchargeValue.toFixed(2)}</span></div>` : ""}
  ${sale.feeAmount > 0 ? `<div class="totals-row" style="color:#fb923c"><span>Juros máquina</span><span>+ R$ ${sale.feeAmount.toFixed(2)}</span></div>` : ""}
  <div class="totals-row main"><span>TOTAL</span><span>R$ ${sale.total.toFixed(2)}</span></div>
  ${sale.change > 0 ? `<div class="totals-row" style="color:#34d399;font-weight:700"><span>Troco devolvido</span><span>R$ ${sale.change.toFixed(2)}</span></div>` : ""}
  <div style="margin-top:16px;padding-top:12px;border-top:1px solid #1e293b">${payLines}</div>
</div>
<div class="footer">Documento gerado pelo BoxSys PDV · ${now}</div>
</body></html>`;
  };

  const buildWhatsAppText = (sale: CompletedSale) => {
    const now = new Date().toLocaleString("pt-BR");
    const payLines = sale.payments.map((p) => {
      const brand = (p.method==="debit"||p.method==="credit") && p.cardBrand!=="other" ? `/${p.cardBrand.toUpperCase()}` : "";
      const inst  = p.method==="credit" && p.installments>1 ? ` ${p.installments}x` : "";
      return `${PM_LABEL[p.method]}${brand}${inst}: R$ ${Number(p.amount).toFixed(2)}`;
    }).join(" | ");
    return [
      `*${sale.tenantName}*`,
      `Comprovante ${sale.offline ? "(offline)" : "#" + String(sale.orderId).padStart(5,"0")} — ${now}`,
      ``,
      `*Cliente:* ${sale.customerName || "Consumidor Final"}`,
      sale.sellerName ? `*Vendedor:* ${sale.sellerName}` : null,
      ``,
      `*Itens:*`,
      ...sale.items.map((i) => `• ${i.name} × ${i.quantity}  →  R$ ${(i.price * i.quantity).toFixed(2)}`),
      ``,
      sale.discountValue > 0 ? `Desconto: − R$ ${sale.discountValue.toFixed(2)}` : null,
      sale.feeAmount > 0 ? `Juros: + R$ ${sale.feeAmount.toFixed(2)}` : null,
      `*TOTAL: R$ ${sale.total.toFixed(2)}*`,
      `Pagamento: ${payLines}`,
      sale.change > 0 ? `Troco: R$ ${sale.change.toFixed(2)}` : null,
      ``,
      `Obrigado pela preferência! 🙏`,
    ].filter((l) => l !== null).join("\n");
  };

  const printViaIframe = (html: string, delay = 400) => {
    const iframe = document.createElement("iframe");
    Object.assign(iframe.style, { position:"fixed", right:"0", bottom:"0", width:"0", height:"0", border:"none" });
    document.body.appendChild(iframe);
    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) return;
    doc.open(); doc.write(html); doc.close();
    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => document.body.removeChild(iframe), 1500);
    }, delay);
  };

  const handleFinishSale = async () => {
    if (!canFinish || finishing) return;
    setFinishing(true);

    const pmString = payments.map((p) => {
      const brand = (p.method === "debit" || p.method === "credit") ? `-${p.cardBrand}` : "";
      const inst  = p.method === "credit" && p.installments > 1 ? `-${p.installments}x` : "";
      return `${p.method}${brand}${inst}:${Number(p.amount).toFixed(2)}`;
    }).join("|");

    const selectedSeller = sellers.find((s) => s.id === selectedSellerId);
    const clientSaleId = crypto.randomUUID();
    const saleBody = {
      items: cart.map((i) => ({ id: i.id, quantity: i.quantity, price: i.price, selectedOptions: i.selectedOptions ?? null })),
      services: cartServices.map((s) => ({ id: s.id, name: s.name, price: s.price })),
      customerName,
      customerId: selectedCustomerId ?? undefined,
      sellerId: selectedSellerId,
      totalAmount: total,
      paymentMethod: pmString,
      discount: discountValue,
      surcharge: surchargeValue > 0 ? surchargeValue : undefined,
      passFeeToCustomer,
      passFeeByMethod,
      clientSaleId,
      // calendar day of the sale in the device's local timezone — keeps the
      // cash-flow date correct even if an offline sale syncs the next day
      soldAtDate: (() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      })(),
    };

    // builds receipt + resets the cart — shared by online and offline paths
    const completeSale = (orderId: number, offline: boolean, rewardApplied?: string) => {
      let pointsEarned: number | undefined;
      if (selectedCustomerId && loyaltyProgram?.is_active && loyaltyProgram.spend_per_point > 0) {
        pointsEarned = Math.floor(total / loyaltyProgram.spend_per_point);
        if (pointsEarned <= 0) pointsEarned = undefined;
      }
      const sale: CompletedSale = {
        orderId,
        customerName,
        sellerName: selectedSeller?.name || "",
        payments: payments.map((p) => ({ ...p })),
        items: cart.map((i) => ({ name: i.name, quantity: i.quantity, price: i.price, image_url: i.image_url })),
        subtotal, discountValue, surchargeValue, feeAmount, total,
        change: change > 0 ? change : 0,
        tenantName, tenantAddress, tenantLogo, tenantColor, tenantWhatsapp,
        cardFees, pointsEarned, rewardApplied,
        offline,
      };
      setCompletedSale(sale);
      setCart([]); setCartServices([]); setCustomerName(""); setSelectedCustomerId(null); setCustomerPoints(0); setAppliedReward(null);
      setDiscount(""); setSurcharge(""); setSelectedSellerId(null);
      setPayments([newPayment()]);
      setShowCartMobile(false);
      setShowCheckoutModal(false);
      setShowReceipt(true);
      setWhatsappPhone(""); setShowPhoneInput(false);
    };

    // saves the sale locally and decrements cached stock — used when offline
    const finishOffline = async () => {
      const pending: PendingSale = {
        localId: clientSaleId,
        body: saleBody,
        createdAt: new Date().toISOString(),
        total,
        customerName,
      };
      await queueSale(pending);
      refreshPendingCount();
      // local stock decrement so the next sale sees the updated quantity
      setProducts((prev) => {
        const updated = prev.map((p) => {
          const inCart = cart.filter((i) => i.id === p.id).reduce((sum, i) => sum + i.quantity, 0);
          return inCart > 0 ? { ...p, stock_quantity: p.stock_quantity - inCart } : p;
        });
        cacheSet("products", updated);
        return updated;
      });
      completeSale(0, true);
    };

    try {
      if (!navigator.onLine) {
        await finishOffline();
        return;
      }

      const res = await fetch("/api/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(saleBody),
      });
      if (res.ok) {
        const data = await res.json();

        // register redemption if reward was applied (await so stock/points are updated before receipt)
        let rewardApplied: string | undefined;
        if (selectedCustomerId && appliedReward) {
          try {
            await fetch(`/api/loyalty/customers/${selectedCustomerId}/redeem`, {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
              body: JSON.stringify({ reward_id: appliedReward.id, order_id: data.orderId }),
            });
            rewardApplied = appliedReward.name;
          } catch (e) { console.error(e); }
        }

        completeSale(data.orderId, false, rewardApplied);
        fetch("/api/products", { headers: { Authorization: `Bearer ${token}` } })
          .then((r) => r.json())
          .then((d) => {
            if (Array.isArray(d)) { setProducts(d); cacheSet("products", d); }
          })
          .catch(() => {});
      }
    } catch {
      // network failed mid-request — queue offline (idempotent clientSaleId prevents duplicates)
      await finishOffline();
    }
    finally { setFinishing(false); }
  };

  const filteredProducts = useMemo(() => products.filter((p) => {
    if (searchTerm) {
      return p.name.toLowerCase().includes(searchTerm.toLowerCase());
    }
    if (selectedCategory && p.category_id !== selectedCategory) return false;
    return true;
  }), [products, searchTerm, selectedCategory]);

  if (!token) return <PDVLogin onLogin={handleLogin} />;

  return (
    <div className="h-screen flex flex-col overflow-hidden font-sans bg-slate-100">

      {/* ── Top Bar ──────────────────────────────────────────────────────────── */}
      <header className="h-14 flex items-center justify-between px-5 shrink-0 bg-white border-b border-slate-200 shadow-sm">

        {/* Logo + nome */}
        <div className="flex items-center gap-3">
          {tenantLogo ? (
            <img src={tenantLogo} alt={tenantName} className="h-8 w-auto max-w-[72px] object-contain rounded-xl" />
          ) : (
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-black text-[13px] shadow"
              style={{ background: "linear-gradient(135deg, #3b82f6, #1d4ed8)" }}>
              {tenantName.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <p className="text-[13px] font-black text-slate-800 tracking-wide leading-none">{tenantName}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <div className={cn("w-1.5 h-1.5 rounded-full animate-pulse", isOnline ? "bg-emerald-500" : "bg-amber-500")} />
              <span className={cn("text-[9px] font-semibold uppercase tracking-widest", isOnline ? "text-slate-400" : "text-amber-600")}>
                {isOnline ? "Terminal PDV" : "Modo Offline"}
              </span>
            </div>
          </div>
        </div>

        {/* Scanner status — centro */}
        <div className="flex-1 flex justify-center px-6">
          <div className={cn(
            "flex items-center gap-2 px-3 h-7 rounded-xl border text-[10px] font-bold uppercase tracking-widest transition-all duration-300",
            scanFeedback === "ok"
              ? "bg-emerald-50 border-emerald-300 text-emerald-600"
              : scanFeedback === "err"
              ? "bg-red-50 border-red-300 text-red-500"
              : "bg-slate-100 border-slate-200 text-slate-400"
          )}>
            <Scan size={11} />
            {scanFeedback === "ok" ? "Adicionado!" : scanFeedback === "err" ? "Não encontrado" : "Scanner pronto"}
            <input ref={scanInputRef} value={scanCode}
              onChange={(e) => setScanCode(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { handleScan(scanCode); e.preventDefault(); } }}
              className="absolute opacity-0 w-0 h-0 pointer-events-none" readOnly={false} />
          </div>
        </div>

        {/* Ações direita */}
        <div className="flex items-center gap-2">
          {/* Offline status / pending sales */}
          {!isOnline && (
            <span className="flex items-center gap-1.5 px-3 h-8 rounded-xl text-[10px] font-bold uppercase tracking-widest text-amber-700 border border-amber-300 bg-amber-50">
              <WifiOff size={11} /> Offline
            </span>
          )}
          {pendingCount > 0 && (
            <button
              onClick={async () => { setPendingSalesList(await getPendingSales()); setShowPendingModal(true); }}
              title="Ver vendas aguardando sincronização"
              className={cn(
                "flex items-center gap-1.5 px-3 h-8 rounded-xl text-[10px] font-bold uppercase tracking-widest border transition-all",
                isOnline
                  ? "text-blue-600 border-blue-200 bg-blue-50 hover:bg-blue-100"
                  : "text-amber-700 border-amber-300 bg-amber-50 hover:bg-amber-100"
              )}
            >
              <RefreshCw size={11} className={syncing ? "animate-spin" : ""} />
              {syncing ? "Sincronizando..." : `${pendingCount} pendente${pendingCount > 1 ? "s" : ""}`}
            </button>
          )}
          {/* Fullscreen toggle */}
          <button onClick={toggleFullscreen} title={isFullscreen ? "Sair de tela cheia" : "Tela cheia"}
            className="flex items-center gap-1.5 px-3 h-8 rounded-xl text-[10px] font-bold uppercase tracking-widest text-slate-500 border border-slate-200 hover:bg-slate-50 hover:text-slate-700 transition-all">
            {isFullscreen ? <Minimize2 size={11} /> : <Maximize2 size={11} />}
            {isFullscreen ? "Sair" : "Tela Cheia"}
          </button>

          {/* Instalar PWA */}
          {!pwaInstalled && (installPrompt || isSafari || isIos) && (
            <button onClick={handleInstallPwa}
              className="flex items-center gap-1.5 px-3 h-8 rounded-xl text-[10px] font-bold uppercase tracking-widest text-blue-600 border border-blue-200 bg-blue-50 hover:bg-blue-100 transition-all">
              <Download size={11} /> Instalar App
            </button>
          )}
          {pwaInstalled && (
            <span className="flex items-center gap-1.5 px-3 h-8 rounded-xl text-[10px] font-bold uppercase tracking-widest text-emerald-600 border border-emerald-200 bg-emerald-50">
              <CheckCircle2 size={11} /> Instalado
            </span>
          )}
          {/* Sair */}
          <button onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 h-8 rounded-xl text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-red-500 transition-all border border-slate-200 hover:border-red-200 hover:bg-red-50">
            <LogOut size={11} /> Sair
          </button>
        </div>
      </header>

      {/* ── PWA Install Modal ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showInstallModal && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowInstallModal(false)}
              className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[600]" />
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 24 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 24 }}
              transition={{ type: "spring", damping: 26, stiffness: 300 }}
              className="fixed z-[601] left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden">

              {/* Header */}
              <div className="relative bg-gradient-to-br from-slate-900 to-slate-800 px-7 pt-7 pb-8 overflow-hidden">
                <div className="absolute -top-6 -right-6 w-32 h-32 bg-blue-500/10 rounded-full" />
                <div className="absolute -bottom-8 -left-4 w-40 h-40 bg-blue-500/5 rounded-full" />
                <button onClick={() => setShowInstallModal(false)}
                  className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all">
                  <X size={14} className="text-white/60" />
                </button>
                <div className="relative flex items-center gap-4">
                  <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-700 rounded-2xl flex items-center justify-center shadow-xl shadow-blue-500/30">
                    <Store size={28} className="text-white" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.25em] text-blue-400 mb-0.5">Terminal de Vendas</p>
                    <h2 className="text-[22px] font-black text-white leading-none">BoxSys PDV</h2>
                    <p className="text-[11px] text-slate-400 font-medium mt-1">Instale na área de trabalho para acesso rápido</p>
                  </div>
                </div>
                {/* Vantagens */}
                <div className="relative mt-5 grid grid-cols-3 gap-2">
                  {[
                    { icon: "⚡", label: "Acesso rápido", sub: "1 clique na Dock" },
                    { icon: "📶", label: "Cache inteligente", sub: "Abre mesmo com net lenta" },
                    { icon: "🖥️", label: "Tela cheia", sub: "Sem barra do browser" },
                  ].map((v) => (
                    <div key={v.label} className="bg-white/5 border border-white/10 rounded-xl p-2.5 text-center">
                      <p className="text-lg mb-0.5">{v.icon}</p>
                      <p className="text-[10px] font-black text-white leading-tight">{v.label}</p>
                      <p className="text-[9px] text-slate-500 font-medium mt-0.5">{v.sub}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Body */}
              <div className="p-6">
                {(isSafari || isIos) ? (
                  /* Safari / iOS — instrução manual */
                  <div className="space-y-3">
                    <p className="text-[12px] font-black text-slate-500 uppercase tracking-widest mb-4">
                      {isIos ? "Como instalar no iPhone / iPad" : "Como instalar no Mac (Safari)"}
                    </p>
                    {(isIos
                      ? [
                          { n: 1, icon: "↑", text: "Toque no botão Compartilhar", sub: "Ícone □↑ na barra inferior do Safari" },
                          { n: 2, icon: "+", text: "\"Adicionar à Tela de Início\"", sub: "Role para baixo na lista de opções" },
                          { n: 3, icon: "✓", text: "Toque em \"Adicionar\"", sub: "O PDV aparece na tela de início" },
                        ]
                      : [
                          { n: 1, icon: "☰", text: "Menu \"Arquivo\" no Safari", sub: "Ou ícone de compartilhar na barra de endereço" },
                          { n: 2, icon: "+", text: "\"Adicionar à Dock…\"", sub: "Requer Safari 17+ / macOS Sonoma ou superior" },
                          { n: 3, icon: "✓", text: "Confirme clicando em \"Adicionar\"", sub: "O PDV abrirá como app independente na Dock" },
                        ]
                    ).map((s) => (
                      <div key={s.n} className="flex items-start gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-100">
                        <span className="w-7 h-7 rounded-xl bg-blue-600 text-white text-[11px] font-black flex items-center justify-center shrink-0">{s.n}</span>
                        <div>
                          <p className="text-[13px] font-bold text-slate-800">{s.text}</p>
                          <p className="text-[11px] text-slate-400 font-medium mt-0.5">{s.sub}</p>
                        </div>
                      </div>
                    ))}
                    <button onClick={() => setShowInstallModal(false)}
                      className="w-full mt-2 h-12 bg-slate-900 text-white rounded-2xl text-[12px] font-black hover:bg-slate-800 transition-all">
                      Entendido
                    </button>
                  </div>
                ) : (
                  /* Chrome / Edge — 1 clique */
                  <div className="space-y-3">
                    <p className="text-[12px] text-slate-500 font-medium text-center">
                      Clique em <strong className="text-slate-800">Instalar Agora</strong> para adicionar o PDV à área de trabalho.
                      Ele abrirá como um aplicativo independente, sem barra do navegador.
                    </p>
                    <div className="flex gap-3 mt-4">
                      <button onClick={() => setShowInstallModal(false)}
                        className="flex-1 h-12 border border-slate-200 rounded-2xl text-[12px] font-bold text-slate-500 hover:bg-slate-50 transition-all">
                        Agora não
                      </button>
                      <button onClick={confirmInstall}
                        className="flex-1 h-12 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-2xl text-[12px] font-black hover:from-blue-500 hover:to-blue-600 transition-all shadow-lg shadow-blue-500/30 flex items-center justify-center gap-2">
                        <Download size={15} /> Instalar Agora
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Body ─────────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden">

        {/* ── Produtos ─────────────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col gap-2.5 overflow-hidden p-4">

          {/* Barra de busca */}
          <div className="flex gap-2 items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <input type="text" placeholder="Buscar produto..." value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 h-10 bg-white rounded-xl text-[13px] font-medium text-slate-700 placeholder:text-slate-400 focus:outline-none transition-all border border-slate-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 shadow-sm" />
            </div>
            <button onClick={() => setShowCartMobile(true)}
              className="lg:hidden relative h-10 px-4 rounded-xl flex items-center gap-2 text-[11px] font-black text-white shadow"
              style={{ background: "linear-gradient(135deg, #3b82f6, #1d4ed8)" }}>
              <ShoppingCart size={14} />
              {cartQty > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-white text-blue-600 rounded-full text-[9px] font-black flex items-center justify-center shadow">{cartQty}</span>
              )}
            </button>
          </div>

          {/* Categorias */}
          {categories.length > 0 && (
            <div className="flex gap-1.5 overflow-x-auto pb-0.5 shrink-0 scrollbar-none">
              {[{ id: null, name: "Todos" }, ...categories.map(c => ({ id: c.id as number | null, name: c.name }))].map((cat) => (
                <button key={cat.id ?? "all"} onClick={() => setSelectedCategory(cat.id)}
                  className={cn(
                    "shrink-0 h-7 px-3 rounded-lg text-[10px] font-bold tracking-wide transition-all border flex items-center gap-1",
                    selectedCategory === cat.id
                      ? "text-white border-blue-500 shadow"
                      : "bg-white text-slate-500 border-slate-200 hover:border-blue-300 hover:text-blue-600"
                  )}
                  style={selectedCategory === cat.id ? { background: "linear-gradient(135deg,#3b82f6,#1d4ed8)" } : {}}>
                  {cat.id !== null && <Tag size={9} />} {cat.name}
                </button>
              ))}
            </div>
          )}

          {/* Grid de produtos */}
          <div className="flex-1 overflow-y-auto pr-1 pb-2 pdv-scroll-light">
            {loading ? (
              <div className="h-full flex items-center justify-center">
                <Loader2 size={28} className="animate-spin text-slate-300" />
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center gap-3">
                <Package size={44} className="text-slate-300" strokeWidth={1} />
                <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">Nenhum produto encontrado</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-2.5">
                {filteredProducts.map((product) => {
                  const qtyInCart = cart.filter((i) => i.id === product.id).reduce((a, b) => a + b.quantity, 0);
                  const hasVariations = (Array.isArray(product.attributes) && product.attributes.length > 0) ||
                    (Array.isArray(product.variations) && product.variations.length > 0);
                  return (
                    <motion.button layout key={product.id}
                      onClick={() => addToCart(product)}
                      whileTap={{ scale: 0.97 }}
                      className={cn(
                        "bg-white rounded-2xl border flex flex-col items-start group relative text-left overflow-hidden transition-all duration-200",
                        qtyInCart > 0
                          ? "cursor-pointer border-blue-400 shadow-md shadow-blue-100"
                          : "cursor-pointer border-slate-200 hover:border-blue-300 hover:shadow-md hover:shadow-blue-50"
                      )}>

                      {/* Imagem */}
                      <div className="w-full aspect-[4/3] overflow-hidden relative flex items-center justify-center bg-slate-50">
                        {product.image_url
                          ? <img src={product.image_url} alt={product.name} className="object-contain w-full h-full group-hover:scale-105 transition-transform duration-500 p-1" />
                          : <div className="w-full h-full flex items-center justify-center"><Package size={24} className="text-slate-300" /></div>}

                        {/* Badge estoque */}
                        <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded-md text-[8px] font-mono font-bold bg-white/90 border border-slate-200 text-slate-500 shadow-sm">
                          {product.stock_quantity}
                        </div>

                        {/* Badge carrinho */}
                        {qtyInCart > 0 && (
                          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
                            className="absolute top-2 left-2 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black text-white shadow"
                            style={{ background: "linear-gradient(135deg,#3b82f6,#1d4ed8)" }}>
                            {qtyInCart}
                          </motion.div>
                        )}

                        {/* Overlay hover */}
                        {(
                          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 bg-blue-500/10">
                            <div className="w-9 h-9 rounded-full flex items-center justify-center text-white scale-75 group-hover:scale-100 transition-transform shadow-lg"
                              style={{ background: "linear-gradient(135deg,#3b82f6,#1d4ed8)" }}>
                              <Plus size={16} strokeWidth={2.5} />
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="p-2.5 w-full">
                        <p className="text-[11px] font-semibold text-slate-700 leading-tight line-clamp-2 mb-1.5 min-h-[2.2em]">{product.name}</p>
                        {hasVariations && (
                          <p className="text-[8px] font-black text-blue-500 uppercase tracking-widest mb-1">variações</p>
                        )}
                        <p className="text-[14px] font-mono font-black text-blue-600">
                          R$ {Number(product.price).toFixed(2)}
                        </p>
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── Carrinho Desktop ──────────────────────────────────────────────── */}
        <div className="hidden lg:flex w-[360px] flex-col overflow-hidden shrink-0 border-l border-slate-200 bg-white">
          <CartPanel
            cart={cart}
            updateQuantity={updateQuantity}
            removeFromCart={removeFromCart}
            subtotal={subtotal}
            discountValue={discountValue}
            surchargeValue={surchargeValue}
            feeAmount={feeAmount}
            total={total}
            cartQty={cartQty}
            onCheckout={openCheckout}
            canFinish={canFinish}
          />
        </div>
      </div>

      {/* ── Variation Modal ────────────────────────────────────────────────── */}
      <AnimatePresence>
        {configProduct && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center sm:p-4"
            style={{ background: "rgba(5,8,20,0.88)", backdropFilter: "blur(16px)" }}>
            <motion.div
              initial={{ opacity: 0, y: 40, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 30, scale: 0.97 }}
              transition={{ type: "spring", damping: 28, stiffness: 260 }}
              className="w-full sm:max-w-md rounded-t-[28px] sm:rounded-3xl overflow-hidden shadow-2xl"
              style={{ background: "#0f1623", border: "1px solid rgba(255,255,255,0.07)" }}>

              {/* Imagem + header */}
              <div className="relative">
                {/* Imagem de fundo */}
                <div className="h-36 overflow-hidden relative" style={{ background: "rgba(255,255,255,0.05)" }}>
                  {configProduct.image_url ? (
                    <img src={configProduct.image_url} alt={configProduct.name}
                      className="w-full h-full object-cover opacity-40" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package size={40} className="text-white/10" strokeWidth={1} />
                    </div>
                  )}
                  {/* Gradient overlay */}
                  <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, transparent 20%, #0f1623 100%)" }} />
                </div>

                {/* Thumbnail + nome flutuando sobre a imagem */}
                <div className="absolute bottom-0 left-0 right-0 flex items-end gap-3 px-5 pb-4">
                  {/* Thumbnail */}
                  <div className="w-16 h-16 rounded-2xl overflow-hidden shrink-0 shadow-xl"
                    style={{ border: "2px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.08)" }}>
                    {configProduct.image_url
                      ? <img src={configProduct.image_url} alt={configProduct.name} className="w-full h-full object-contain p-1" />
                      : <div className="w-full h-full flex items-center justify-center"><Package size={22} className="text-white/30" /></div>}
                  </div>
                  <div className="flex-1 pb-0.5">
                    <p className="text-[9px] font-black uppercase tracking-[0.25em] mb-0.5" style={{ color: "#60a5fa" }}>Selecionar variação</p>
                    <h3 className="text-[15px] font-black text-white leading-tight line-clamp-2">{configProduct.name}</h3>
                    <p className="text-[13px] font-mono font-black mt-0.5" style={{ color: "#34d399" }}>
                      R$ {Number(configProduct.price).toFixed(2)}
                    </p>
                  </div>
                </div>

                {/* Fechar */}
                <button onClick={() => setConfigProduct(null)}
                  className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center transition-all"
                  style={{ background: "rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.1)" }}>
                  <X size={15} className="text-white/60" />
                </button>
              </div>

              {/* Opções */}
              <div className="px-5 pt-2 pb-4 space-y-5 max-h-[50vh] overflow-y-auto pdv-scroll-dark">
                {Array.isArray(configProduct.attributes) && configProduct.attributes.length > 0
                  ? configProduct.attributes.map((attr, aIdx) => (
                      <div key={aIdx}>
                        <div className="flex items-center gap-2 mb-3">
                          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/35">{attr.name}</p>
                          <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.06)" }} />
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {attr.values.map((val, vIdx) => {
                            const currentOptions = { ...selectedOptions, [attr.name]: val };
                            const sku = configProduct.skus?.find((s) =>
                              Object.entries(s.combo).every(([k, v]) => currentOptions[k] === v));
                            const stockQty = sku ? sku.stock : null;
                            const hasStock = stockQty === null || stockQty > 0;
                            const isSelected = selectedOptions[attr.name] === val;
                            return (
                              <button key={vIdx} disabled={!hasStock}
                                onClick={() => setSelectedOptions({ ...selectedOptions, [attr.name]: val })}
                                className={cn("flex flex-col items-center px-3 py-2 rounded-xl transition-all border min-w-[64px]",
                                  !hasStock
                                    ? "opacity-30 cursor-not-allowed"
                                    : isSelected
                                    ? "shadow-lg shadow-blue-500/25"
                                    : "hover:border-white/20"
                                )}
                                style={isSelected
                                  ? { background: "rgba(59,130,246,0.2)", border: "1px solid rgba(59,130,246,0.6)" }
                                  : { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
                                <span className={cn("text-[12px] font-bold tracking-wide", !hasStock && "line-through",
                                  isSelected ? "text-blue-300" : "text-white/70")}>
                                  {val}
                                </span>
                                {stockQty !== null && (
                                  <span className={cn("text-[9px] font-semibold mt-0.5",
                                    stockQty === 0 ? "text-red-400/60"
                                    : stockQty <= 3 ? "text-amber-400/80"
                                    : "text-white/30")}>
                                    {stockQty === 0 ? "esgotado" : `${stockQty} un`}
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))
                  : configProduct.variations?.map((variation, vIdx) => (
                      <div key={vIdx}>
                        <div className="flex items-center gap-2 mb-3">
                          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/35">{variation.name}</p>
                          <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.06)" }} />
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {variation.options.map((opt, oIdx) => {
                            const isSelected = selectedOptions[variation.name] === opt.value;
                            return (
                              <button key={oIdx} disabled={opt.stock === 0}
                                onClick={() => setSelectedOptions({ ...selectedOptions, [variation.name]: opt.value })}
                                className={cn("flex flex-col items-center px-3 py-2 rounded-xl transition-all border min-w-[64px]",
                                  opt.stock === 0
                                    ? "opacity-30 cursor-not-allowed"
                                    : isSelected
                                    ? "shadow-lg shadow-blue-500/25"
                                    : "hover:border-white/20"
                                )}
                                style={isSelected
                                  ? { background: "rgba(59,130,246,0.2)", border: "1px solid rgba(59,130,246,0.6)" }
                                  : { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
                                <span className={cn("text-[12px] font-bold tracking-wide", opt.stock === 0 && "line-through",
                                  isSelected ? "text-blue-300" : "text-white/70")}>
                                  {opt.value}
                                </span>
                                <span className={cn("text-[9px] font-semibold mt-0.5",
                                  opt.stock === 0 ? "text-red-400/60"
                                  : opt.stock <= 3 ? "text-amber-400/80"
                                  : "text-white/30")}>
                                  {opt.stock === 0 ? "esgotado" : `${opt.stock} un`}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}

                {/* Tabela resumo de estoque por combinação */}
                {configProduct.skus && configProduct.skus.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/35">Estoque disponível</p>
                      <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.06)" }} />
                    </div>
                    <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
                      {configProduct.skus.map((sku, sIdx) => {
                        const label = Object.values(sku.combo).join(" · ");
                        const isCurrentSelection = Object.entries(sku.combo).every(([k, v]) => selectedOptions[k] === v);
                        return (
                          <div key={sIdx}
                            className={cn("flex items-center justify-between px-3 py-2 transition-all", sIdx > 0 && "border-t")}
                            style={{
                              borderColor: "rgba(255,255,255,0.05)",
                              background: isCurrentSelection ? "rgba(59,130,246,0.12)" : "rgba(255,255,255,0.02)"
                            }}>
                            <div className="flex items-center gap-2">
                              {isCurrentSelection && <div className="w-1 h-4 rounded-full bg-blue-500" />}
                              <span className="text-[11px] font-medium text-white/60">{label}</span>
                            </div>
                            <span className={cn("text-[11px] font-black",
                              sku.stock === 0 ? "text-red-400/70"
                              : sku.stock <= 3 ? "text-amber-400"
                              : "text-emerald-400")}>
                              {sku.stock === 0 ? "Esgotado" : `${sku.stock} un`}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Botão confirmar */}
              <div className="px-5 pb-6 pt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                <button onClick={() => addToCart(configProduct, selectedOptions)}
                  className="w-full h-13 rounded-2xl text-[12px] font-black uppercase tracking-[0.15em] text-white flex items-center justify-center gap-2 transition-all active:scale-98 shadow-xl shadow-blue-500/25"
                  style={{ background: "linear-gradient(135deg, #3b82f6, #1d4ed8)", height: "52px" }}>
                  <Plus size={16} strokeWidth={3} /> Adicionar ao Carrinho
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile Cart Drawer */}
      <AnimatePresence>
        {showCartMobile && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowCartMobile(false)}
              className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[150] lg:hidden" />
            <motion.div
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed inset-x-0 bottom-0 h-[92vh] bg-white rounded-t-[28px] shadow-2xl z-[151] lg:hidden flex flex-col overflow-hidden border-t border-slate-200">
              <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto my-4 shrink-0" />
              <div className="flex-1 overflow-hidden flex flex-col">
                <CartPanel
                  cart={cart}
                  updateQuantity={updateQuantity}
                  removeFromCart={removeFromCart}
                  subtotal={subtotal}
                  discountValue={discountValue}
                  surchargeValue={surchargeValue}
                  feeAmount={feeAmount}
                  total={total}
                  cartQty={cartQty}
                  onCheckout={() => { setShowCartMobile(false); openCheckout(); }}
                  canFinish={canFinish}
                  onClose={() => setShowCartMobile(false)}
                />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Checkout Modal ────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showCheckoutModal && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[250]"
              onClick={() => !finishing && setShowCheckoutModal(false)} />
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
              transition={{ type: "spring", damping: 32, stiffness: 300 }}
              className="fixed inset-0 z-[251] flex flex-col m-auto bg-white"
              style={{
                width: "min(980px, 96vw)", height: "min(700px, 92vh)",
                borderRadius: "24px",
                boxShadow: "0 24px 80px rgba(0,0,0,0.18), 0 4px 16px rgba(0,0,0,0.08)",
                overflow: "hidden",
                border: "1px solid #e2e8f0",
              }}>

              {/* ── Header ─────────────────────────────────────────────────── */}
              <div className="shrink-0 flex items-center justify-between px-6 py-4 bg-white border-b border-slate-100">
                <div className="flex items-center gap-3">
                  {tenantLogo ? (
                    <img src={tenantLogo} alt={tenantName} className="h-10 w-auto max-w-[100px] object-contain rounded-xl shrink-0" />
                  ) : (
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm"
                      style={{ background: "linear-gradient(135deg,#3b82f6,#1d4ed8)" }}>
                      <Store size={18} className="text-white" />
                    </div>
                  )}
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-[0.25em] text-blue-500">Finalizar Venda</p>
                    <h2 className="text-[16px] font-black text-slate-800 leading-tight">{tenantName}</h2>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">{cartQty} {cartQty === 1 ? "item" : "itens"}</p>
                    <p className="text-[24px] font-mono font-black text-slate-800 leading-none">R$ {total.toFixed(2)}</p>
                  </div>
                  <button onClick={() => setShowCheckoutModal(false)} disabled={finishing}
                    className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-all disabled:opacity-30 border border-slate-200">
                    <X size={16} className="text-slate-500" />
                  </button>
                </div>
              </div>

              {/* ── Corpo em duas colunas ──────────────────────────────────── */}
              <div className="flex-1 flex overflow-hidden">

                {/* COLUNA ESQUERDA */}
                <div className="w-[340px] shrink-0 flex flex-col overflow-y-auto pdv-scroll-light border-r border-slate-100 bg-slate-50">

                  {/* Itens do pedido */}
                  <div className="p-4 border-b border-slate-100">
                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 mb-3">Itens do pedido</p>
                    <div className="space-y-2">
                      {cart.map((item) => (
                        <div key={item.cartItemId} className="flex items-center gap-2.5 bg-white rounded-xl px-3 py-2 border border-slate-100 shadow-sm">
                          <span className="w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black text-white shrink-0"
                            style={{ background: "linear-gradient(135deg,#3b82f6,#1d4ed8)" }}>{item.quantity}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-[12px] font-semibold text-slate-700 truncate leading-tight">{item.name}</p>
                            {item.variationLabel && <p className="text-[9px] font-bold text-blue-500">{item.variationLabel}</p>}
                          </div>
                          <span className="text-[12px] font-mono font-black text-slate-700 shrink-0">R$ {(item.price * item.quantity).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                    {/* Mini totais */}
                    <div className="mt-3 pt-3 border-t border-slate-200 space-y-1">
                      {servicesTotal > 0 && (
                        <div className="flex justify-between text-[10px]">
                          <span className="flex items-center gap-1 text-slate-400"><Wrench size={9} /> Serviços</span>
                          <span className="font-mono font-bold text-blue-600">+ R$ {servicesTotal.toFixed(2)}</span>
                        </div>
                      )}
                      {discountValue > 0 && (
                        <div className="flex justify-between text-[10px]">
                          <span className="text-slate-400">Desconto</span>
                          <span className="font-mono font-bold text-emerald-600">− R$ {discountValue.toFixed(2)}</span>
                        </div>
                      )}
                      {surchargeValue > 0 && (
                        <div className="flex justify-between text-[10px]">
                          <span className="text-slate-400">Acréscimo</span>
                          <span className="font-mono font-bold text-amber-500">+ R$ {surchargeValue.toFixed(2)}</span>
                        </div>
                      )}
                      {feeAmount > 0 && (
                        <div className="flex justify-between text-[10px]">
                          <span className="text-slate-400">Juros máquina</span>
                          <span className="font-mono font-bold text-orange-500">+ R$ {feeAmount.toFixed(2)}</span>
                        </div>
                      )}
                      <div className="flex justify-between items-baseline pt-1 border-t border-slate-200">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total</span>
                        <span className="text-[17px] font-mono font-black text-slate-800">R$ {total.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Cliente + Vendedor + Descontos */}
                  <div className="p-4 space-y-4 flex-1">
                    {/* Cliente */}
                    <div>
                      <label className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1.5 block">Cliente</label>
                      <div className="flex gap-2">
                        <div className="flex-1 min-w-0">
                          <Combobox
                            placeholder="Buscar por nome, CPF ou telefone…"
                            searchPlaceholder="Nome, CPF/CNPJ ou telefone…"
                            clearable
                            freeInput
                            value={selectedCustomerId !== null ? String(selectedCustomerId) : customerName}
                            onChange={(v) => {
                              if (!v) {
                                setSelectedCustomerId(null);
                                setCustomerName("");
                                setCustomerPoints(0);
                                setAppliedReward(null);
                                setDiscount(""); setDiscountMode("R$");
                              } else {
                                const cust = customers.find((c) => String(c.id) === v);
                                if (cust) {
                                  setSelectedCustomerId(cust.id);
                                  setCustomerName(cust.name);
                                  fetch(`/api/loyalty/customers/${cust.id}/points`, { headers: { Authorization: `Bearer ${token}` } })
                                    .then((r) => r.json()).then((d) => setCustomerPoints(d.balance ?? 0)).catch(() => {});
                                } else {
                                  setSelectedCustomerId(null);
                                  setCustomerName(v);
                                  setCustomerPoints(0);
                                  setAppliedReward(null);
                                  setDiscount(""); setDiscountMode("R$");
                                }
                              }
                            }}
                            options={customers.map((c) => ({
                              value: String(c.id),
                              label: c.name,
                              description: [c.phone, c.document].filter(Boolean).join(" · "),
                            }))}
                            onAddNew={(q) => {
                              setNcName(q); setNcPhone(""); setNcDoc(""); setNcEmail(""); setNcAddr(""); setNcBirth(""); setNcCredit(""); setNcNotes(""); setNcRisk(false); setNcRiskReason("");
                              setShowNewCustomer(true);
                            }}
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => { setNcName(""); setNcPhone(""); setNcDoc(""); setNcEmail(""); setNcAddr(""); setNcBirth(""); setNcCredit(""); setNcNotes(""); setNcRisk(false); setNcRiskReason(""); setShowNewCustomer(true); }}
                          className="h-10 w-10 rounded-xl bg-blue-50 border border-blue-200 text-blue-600 hover:bg-blue-100 flex items-center justify-center shrink-0 transition-colors"
                          title="Cadastrar novo cliente"
                        >
                          <UserPlus size={15} />
                        </button>
                      </div>

                      {/* Points badge */}
                      {selectedCustomerId && loyaltyProgram?.is_active && (
                        <div className="mt-2 bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-2">
                          {/* Saldo + pontos que irá ganhar */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <Star size={12} className="text-amber-500" fill="currentColor" />
                              <span className="text-[11px] font-bold text-amber-700">{customerPoints.toLocaleString("pt-BR")} pontos</span>
                            </div>
                            {appliedReward ? (
                              <button
                                onClick={() => {
                                  if (appliedReward.type === "discount") { setDiscount(""); setDiscountMode("R$"); }
                                  setAppliedReward(null);
                                }}
                                className="text-[10px] text-rose-500 font-bold hover:underline"
                              >
                                Remover resgate
                              </button>
                            ) : loyaltyRewards.filter((r) => customerPoints >= r.points_cost).length > 0 ? (
                              <span className="text-[10px] text-amber-600 font-bold">Pode resgatar!</span>
                            ) : null}
                          </div>

                          {/* Pontos que vai ganhar nesta compra */}
                          {loyaltyProgram.spend_per_point > 0 && (
                            (() => {
                              const willEarn = Math.floor(total / loyaltyProgram.spend_per_point);
                              return willEarn > 0 ? (
                                <p className="text-[10px] text-amber-600 font-medium">
                                  +{willEarn} ponto{willEarn !== 1 ? "s" : ""} ao finalizar esta compra
                                </p>
                              ) : null;
                            })()
                          )}

                          {/* Lista de recompensas disponíveis */}
                          {!appliedReward && loyaltyRewards.filter((r) => customerPoints >= r.points_cost).length > 0 && (
                            <div className="space-y-1 pt-1 border-t border-amber-200">
                              <p className="text-[9px] font-black uppercase tracking-widest text-amber-600 mb-1">Recompensas disponíveis</p>
                              {loyaltyRewards.filter((r) => customerPoints >= r.points_cost).map((r) => (
                                <button
                                  key={r.id}
                                  onClick={() => {
                                    setAppliedReward(r);
                                    if (r.type === "discount") {
                                      if (r.discount_type === "percent") {
                                        setDiscountMode("%");
                                        setDiscount(String(r.discount_value ?? 0));
                                      } else {
                                        setDiscountMode("R$");
                                        setDiscount(String(r.discount_value ?? 0));
                                      }
                                    }
                                    // product reward: no discount applied — handled on backend
                                  }}
                                  className="w-full flex items-center justify-between p-2 bg-white rounded-lg border border-amber-200 text-[11px] hover:bg-amber-50 transition-colors"
                                >
                                  <span className="flex items-center gap-1.5 font-bold text-slate-700">
                                    {r.type === "product"
                                      ? <Gift size={11} className="text-violet-500" />
                                      : <Gift size={11} className="text-amber-500" />}
                                    <span>{r.name}</span>
                                    {r.type === "product" && (
                                      <span className="text-[9px] font-black text-violet-500 uppercase tracking-wide bg-violet-50 px-1.5 py-0.5 rounded-md border border-violet-200 ml-1">brinde</span>
                                    )}
                                    {r.type === "discount" && r.discount_value && (
                                      <span className="text-[9px] font-black text-emerald-600 uppercase tracking-wide bg-emerald-50 px-1.5 py-0.5 rounded-md border border-emerald-200 ml-1">
                                        {r.discount_type === "percent" ? `${r.discount_value}% off` : `R$ ${r.discount_value} off`}
                                      </span>
                                    )}
                                  </span>
                                  <span className="text-amber-600 font-bold shrink-0 ml-2">{r.points_cost} pts</span>
                                </button>
                              ))}
                            </div>
                          )}

                          {/* Recompensa aplicada */}
                          {appliedReward && (
                            <div className={cn(
                              "flex items-center gap-2 p-2 rounded-lg border",
                              appliedReward.type === "product"
                                ? "bg-violet-50 border-violet-200"
                                : "bg-emerald-50 border-emerald-200"
                            )}>
                              <Gift size={12} className={appliedReward.type === "product" ? "text-violet-500" : "text-emerald-500"} />
                              <div className="flex-1 min-w-0">
                                <p className={cn("text-[11px] font-bold", appliedReward.type === "product" ? "text-violet-700" : "text-emerald-700")}>
                                  {appliedReward.name} aplicado!
                                </p>
                                {appliedReward.type === "product" && (
                                  <p className="text-[10px] text-violet-500 font-medium">Brinde sairá do estoque ao confirmar</p>
                                )}
                              </div>
                              <span className="text-[10px] font-bold text-rose-500 shrink-0">−{appliedReward.points_cost} pts</span>
                            </div>
                          )}

                          {/* Recompensas insuficientes */}
                          {!appliedReward && loyaltyRewards.filter((r) => customerPoints < r.points_cost).length > 0 &&
                            loyaltyRewards.filter((r) => customerPoints >= r.points_cost).length === 0 && (
                            <p className="text-[10px] text-slate-500 font-medium">
                              Acumule mais pontos para resgatar recompensas.
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Vendedor */}
                    <div className="relative">
                      <label className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1.5 block">Vendedor</label>
                      <Combobox
                        placeholder="Sem vendedor"
                        searchPlaceholder="Buscar vendedor..."
                        clearable
                        value={selectedSellerId !== null ? String(selectedSellerId) : ""}
                        onChange={(v) => setSelectedSellerId(v ? Number(v) : null)}
                        options={sellers.map((s) => ({ value: String(s.id), label: s.name }))}
                      />
                    </div>

                    {/* Serviços */}
                    {services.length > 0 && (
                      <div>
                        <label className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1.5 block">Serviços</label>
                        <button
                          type="button"
                          onClick={() => setShowServicesModal(true)}
                          className="w-full flex items-center justify-between h-10 bg-slate-50 border border-slate-200 rounded-xl px-3 hover:border-blue-400 hover:bg-blue-50 transition-all"
                        >
                          <span className="flex items-center gap-2 text-[11px] font-bold text-slate-500">
                            <Wrench size={13} className="text-blue-500" />
                            {cartServices.length === 0
                              ? "Adicionar serviços"
                              : `${cartServices.length} serviço${cartServices.length > 1 ? "s" : ""} — R$ ${servicesTotal.toFixed(2)}`}
                          </span>
                          <ChevronRight size={12} className="text-slate-300" />
                        </button>
                        {cartServices.length > 0 && (
                          <div className="mt-1.5 space-y-1">
                            {cartServices.map((s) => (
                              <div key={s.id} className="flex items-center justify-between bg-blue-50 border border-blue-100 rounded-lg px-2.5 py-1.5">
                                <span className="flex items-center gap-1.5 text-[10px] font-bold text-slate-700">
                                  <Wrench size={10} className="text-blue-400" /> {s.name}
                                </span>
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-mono font-black text-blue-600">R$ {Number(s.price).toFixed(2)}</span>
                                  <button onClick={() => setCartServices((prev) => prev.filter((x) => x.id !== s.id))}
                                    className="text-slate-300 hover:text-red-400 transition-colors">
                                    <X size={11} />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Desconto + Acréscimo */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1.5 block">Desconto</label>
                        <div className="flex gap-1.5">
                          <div className="flex bg-slate-100 border border-slate-200 rounded-xl p-0.5 gap-0.5 shrink-0">
                            {(["R$", "%"] as const).map((m) => (
                              <button key={m} onClick={() => setDiscountMode(m)}
                                className="h-7 px-2 rounded-lg text-[9px] font-black transition-all"
                                style={discountMode === m ? { background: "#2563eb", color: "white" } : { color: "#94a3b8" }}>
                                {m}
                              </button>
                            ))}
                          </div>
                          <input type="number" min="0" step="0.01" placeholder="0"
                            value={discount} onChange={(e) => setDiscount(e.target.value)}
                            className="flex-1 min-w-0 h-9 px-2 rounded-xl text-[13px] font-mono font-bold text-slate-700 placeholder:text-slate-300 bg-white border border-slate-200 focus:outline-none focus:border-emerald-400 text-center [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none transition-all" />
                        </div>
                        {discountValue > 0 && <p className="text-[10px] font-mono font-black mt-1 text-center text-emerald-600">− R$ {discountValue.toFixed(2)}</p>}
                      </div>
                      <div>
                        <label className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1.5 block">Acréscimo</label>
                        <div className="flex gap-1.5">
                          <div className="flex bg-slate-100 border border-slate-200 rounded-xl p-0.5 gap-0.5 shrink-0">
                            {(["R$", "%"] as const).map((m) => (
                              <button key={m} onClick={() => setSurchargeMode(m)}
                                className="h-7 px-2 rounded-lg text-[9px] font-black transition-all"
                                style={surchargeMode === m ? { background: "#d97706", color: "white" } : { color: "#94a3b8" }}>
                                {m}
                              </button>
                            ))}
                          </div>
                          <input type="number" min="0" step="0.01" placeholder="0"
                            value={surcharge} onChange={(e) => setSurcharge(e.target.value)}
                            className="flex-1 min-w-0 h-9 px-2 rounded-xl text-[13px] font-mono font-bold text-slate-700 placeholder:text-slate-300 bg-white border border-slate-200 focus:outline-none focus:border-amber-400 text-center [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none transition-all" />
                        </div>
                        {surchargeValue > 0 && <p className="text-[10px] font-mono font-black mt-1 text-center text-amber-500">+ R$ {surchargeValue.toFixed(2)}</p>}
                      </div>
                    </div>
                  </div>
                </div>

                {/* COLUNA DIREITA — pagamentos */}
                <div className="flex-1 flex flex-col overflow-hidden bg-white">
                  <div className="flex-1 overflow-y-auto p-5 space-y-3 pdv-scroll-light">

                    {/* Label + adicionar */}
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-[9px] font-black uppercase tracking-[0.25em] text-slate-400">Formas de pagamento</p>
                      <button onClick={addPayment}
                        className="flex items-center gap-1.5 h-7 px-3 rounded-lg text-[9px] font-black uppercase tracking-wider bg-blue-50 border border-blue-200 text-blue-600 hover:bg-blue-100 transition-all">
                        <PlusCircle size={11} /> Adicionar forma
                      </button>
                    </div>

                    {payments.map((p, idx) => (
                      <PaymentRow
                        key={p.id}
                        payment={p}
                        idx={idx}
                        total={total}
                        paidAmount={paidAmount}
                        showRemove={payments.length > 1}
                        cardFees={cardFees}
                        maxInstallments={maxInstallments}
                        passFeeByMethod={passFeeByMethod}
                        enabledBrands={enabledBrands}
                        onMethodChange={handleMethodChange}
                        onUpdate={updatePayment}
                        onRemove={removePayment}
                      />
                    ))}

                    {/* Resumo total */}
                    <div className="rounded-2xl px-4 py-3 flex items-center justify-between bg-slate-50 border border-slate-200 shadow-sm">
                      <div>
                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-0.5">Total a pagar</p>
                        {remaining > 0.009 && (
                          <p className="text-[10px] font-bold text-amber-500">⚠ Faltam R$ {remaining.toFixed(2)}</p>
                        )}
                        {change > 0 && (
                          <p className="text-[10px] font-bold text-emerald-600">Troco R$ {change.toFixed(2)}</p>
                        )}
                      </div>
                      <span className="text-[28px] font-mono font-black text-slate-800">R$ {total.toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Botão confirmar */}
                  <div className="shrink-0 px-5 pb-5 pt-4 border-t border-slate-100 bg-white">
                    <button onClick={handleFinishSale} disabled={!canFinish || finishing}
                      className="w-full h-13 rounded-2xl text-[13px] font-black uppercase tracking-widest text-white transition-all disabled:opacity-30 active:scale-[0.98] flex items-center justify-center gap-2.5 shadow-lg"
                      style={{
                        height: "52px",
                        background: remaining > 0.009
                          ? "linear-gradient(135deg,#f59e0b,#d97706)"
                          : "linear-gradient(135deg,#3b82f6,#1d4ed8)",
                        boxShadow: remaining > 0.009
                          ? "0 8px 24px rgba(245,158,11,0.35)"
                          : "0 8px 24px rgba(59,130,246,0.35)",
                      }}>
                      {finishing ? <Loader2 size={17} className="animate-spin" /> : <><CheckCircle2 size={17} /> Confirmar Venda</>}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── SERVICES MODAL ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showServicesModal && (
          <>
            <motion.div
              key="svc-backdrop-sa"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[310]"
              onClick={() => setShowServicesModal(false)}
            />
            <motion.div
              key="svc-panel-sa"
              initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              className="fixed right-0 top-0 h-full w-full max-w-sm bg-white shadow-2xl z-[320] flex flex-col"
            >
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50 shrink-0">
                <div className="flex items-center gap-2">
                  <Wrench size={15} className="text-blue-600" />
                  <span className="text-[11px] font-black text-slate-900 uppercase tracking-widest">Serviços</span>
                </div>
                <button onClick={() => setShowServicesModal(false)}
                  className="w-8 h-8 rounded-lg border border-slate-200 bg-white flex items-center justify-center text-slate-400 hover:text-slate-700 transition-all">
                  <X size={14} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto divide-y divide-slate-50">
                {services.map((svc) => {
                  const inCart = cartServices.some((s) => s.id === svc.id);
                  return (
                    <div key={svc.id} className="px-5 py-3.5 flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                        <Wrench size={14} className="text-blue-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-bold text-slate-900 uppercase truncate">{svc.name}</p>
                        {svc.description && <p className="text-[9px] text-slate-400 truncate">{svc.description}</p>}
                        <p className="text-[11px] font-mono font-black text-blue-600 mt-0.5">R$ {Number(svc.price).toFixed(2)}</p>
                      </div>
                      <button
                        onClick={() => {
                          if (inCart) setCartServices((prev) => prev.filter((s) => s.id !== svc.id));
                          else setCartServices((prev) => [...prev, { ...svc, price: Number(svc.price) }]);
                        }}
                        className={cn(
                          "w-8 h-8 rounded-xl border flex items-center justify-center transition-all shrink-0",
                          inCart
                            ? "bg-rose-500 border-rose-500 text-white hover:bg-rose-600"
                            : "bg-blue-600 border-blue-600 text-white hover:bg-blue-700"
                        )}
                      >
                        {inCart ? <X size={13} /> : <Plus size={13} />}
                      </button>
                    </div>
                  );
                })}
              </div>

              <div className="px-5 py-4 border-t border-slate-100 space-y-2 shrink-0">
                {cartServices.length > 0 && (
                  <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                    <span>{cartServices.length} serviço{cartServices.length > 1 ? "s" : ""} selecionado{cartServices.length > 1 ? "s" : ""}</span>
                    <span className="font-mono text-blue-600 font-black">R$ {servicesTotal.toFixed(2)}</span>
                  </div>
                )}
                <button
                  onClick={() => setShowServicesModal(false)}
                  className="w-full h-11 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-700 transition-colors"
                >
                  Confirmar
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* New Customer Full-Form Drawer */}
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
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 shrink-0">
                <div>
                  <h2 className="font-black text-slate-900 text-[15px]">Novo Cliente</h2>
                  <p className="text-[11px] text-slate-500">Cadastro CRM</p>
                </div>
                <button onClick={() => setShowNewCustomer(false)} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500">
                  <X size={18} />
                </button>
              </div>

              {/* Body — scrollable */}
              <div className="flex-1 overflow-y-auto p-5 space-y-3">
                {/* Nome */}
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">Nome *</label>
                  <input value={ncName} onChange={(e) => setNcName(e.target.value)} placeholder="Nome completo"
                    className="w-full h-9 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>

                {/* Telefone + CPF/CNPJ */}
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

                {/* E-mail */}
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">E-mail</label>
                  <input type="email" value={ncEmail} onChange={(e) => setNcEmail(e.target.value)} placeholder="email@exemplo.com"
                    className="w-full h-9 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>

                {/* Endereço */}
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">Endereço</label>
                  <input value={ncAddr} onChange={(e) => setNcAddr(e.target.value)} placeholder="Rua, Cidade - UF"
                    className="w-full h-9 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>

                {/* Data de Aniversário */}
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">Data de Aniversário</label>
                  <input type="date" value={ncBirth} onChange={(e) => setNcBirth(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>

                {/* Limite de Crédito */}
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">Limite de Crédito (R$)</label>
                  <input type="number" min={0} value={ncCredit} onChange={(e) => setNcCredit(e.target.value)} placeholder="0,00"
                    className="w-full h-9 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>

                {/* Observações */}
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">Observações</label>
                  <textarea value={ncNotes} onChange={(e) => setNcNotes(e.target.value)} rows={2}
                    placeholder="Preferências, anotações gerais…"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
                </div>

                {/* Cliente de Risco */}
                <div className={cn("rounded-xl border p-3 space-y-2 transition-colors", ncRisk ? "bg-rose-50 border-rose-200" : "bg-slate-50 border-slate-200")}>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={ncRisk} onChange={(e) => setNcRisk(e.target.checked)} className="w-4 h-4 accent-rose-500" />
                    <span className={cn("text-[12px] font-black", ncRisk ? "text-rose-600" : "text-slate-600")}>
                      ⚠ Marcar como Cliente de Risco
                    </span>
                  </label>
                  {ncRisk && (
                    <textarea value={ncRiskReason} onChange={(e) => setNcRiskReason(e.target.value)} rows={2}
                      placeholder="Motivo do risco…"
                      className="w-full px-3 py-2 rounded-lg border border-rose-200 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400 resize-none bg-white" />
                  )}
                </div>
              </div>

              {/* Footer */}
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
                        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                        body: JSON.stringify({
                          name: ncName,
                          phone: ncPhone.replace(/\D/g, "") || null,
                          document: ncDoc.replace(/\D/g, "") || null,
                          email: ncEmail || null,
                          address: ncAddr || null,
                          birth_date: ncBirth || null,
                          credit_limit: ncCredit ? Number(ncCredit) : null,
                          notes: ncNotes || null,
                          risk_flag: ncRisk,
                          risk_reason: ncRiskReason || null,
                        }),
                      });
                      const newCust = await res.json();
                      fetch("/api/customers", { headers: { Authorization: `Bearer ${token}` } })
                        .then((r) => r.json()).then((d) => setCustomers(Array.isArray(d) ? d : [])).catch(() => {});
                      setSelectedCustomerId(newCust.id);
                      setCustomerName(newCust.name);
                      setCustomerPoints(0);
                      setShowNewCustomer(false);
                    } finally { setSavingNC(false); }
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

      {/* Sync toast */}
      <AnimatePresence>
        {syncToast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[70] flex items-center gap-2 px-4 h-11 bg-emerald-600 text-white rounded-2xl shadow-2xl shadow-emerald-600/30 text-[11px] font-black uppercase tracking-widest"
          >
            <CheckCircle2 size={15} /> {syncToast}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pending sales modal */}
      <AnimatePresence>
        {showPendingModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60]"
              onClick={() => { setShowPendingModal(false); setDiscardTarget(null); }}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: "spring", damping: 25, stiffness: 350 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[61] w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
            >
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center">
                    <RefreshCw size={16} className={cn("text-blue-600", syncing && "animate-spin")} />
                  </div>
                  <div>
                    <p className="text-[12px] font-black text-slate-900 uppercase tracking-wide">Vendas Pendentes</p>
                    <p className="text-[10px] text-slate-400 font-bold">
                      {isOnline ? "Aguardando sincronização" : "Serão enviadas quando a internet voltar"}
                    </p>
                  </div>
                </div>
                <button onClick={() => { setShowPendingModal(false); setDiscardTarget(null); }}
                  className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-700 transition-all">
                  <X size={14} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto divide-y divide-slate-50">
                {pendingSalesList.length === 0 ? (
                  <div className="px-6 py-10 text-center text-[10px] font-black uppercase tracking-widest text-slate-300">
                    Nenhuma venda pendente
                  </div>
                ) : (
                  pendingSalesList.map((sale) => (
                    <div key={sale.localId} className="px-6 py-3.5 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-bold text-slate-800 uppercase truncate">
                          {sale.customerName || "Consumidor Final"}
                        </p>
                        <p className="text-[9px] text-slate-400 font-bold mt-0.5">
                          {new Date(sale.createdAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                        </p>
                        {sale.lastError && (
                          <p className="text-[9px] text-rose-500 font-bold mt-0.5">
                            ⚠ {sale.lastError} ({sale.attempts}x)
                          </p>
                        )}
                      </div>
                      <span className="text-sm font-mono font-black text-slate-800 shrink-0">
                        R$ {sale.total.toFixed(2)}
                      </span>
                      <button
                        onClick={() => setDiscardTarget(sale)}
                        title="Descartar venda"
                        className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all shrink-0"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  ))
                )}
              </div>

              {/* Discard confirmation */}
              {discardTarget && (
                <div className="px-6 py-4 bg-rose-50 border-t border-rose-200 shrink-0">
                  <p className="text-[10px] font-black text-rose-700 uppercase tracking-wide mb-2">
                    Descartar venda de R$ {discardTarget.total.toFixed(2)}? Ela NÃO será enviada ao servidor.
                  </p>
                  <div className="flex gap-2">
                    <button onClick={() => setDiscardTarget(null)}
                      className="flex-1 h-9 border border-rose-200 bg-white rounded-xl text-[9px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50 transition-colors">
                      Cancelar
                    </button>
                    <button
                      onClick={async () => {
                        await removePendingSale(discardTarget.localId);
                        setDiscardTarget(null);
                        refreshPendingCount();
                        setPendingSalesList(await getPendingSales());
                      }}
                      className="flex-1 h-9 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-[9px] font-black uppercase tracking-widest transition-colors">
                      Descartar
                    </button>
                  </div>
                </div>
              )}

              <div className="px-6 py-4 border-t border-slate-100 shrink-0">
                <button
                  onClick={() => syncPendingSales()}
                  disabled={syncing || !isOnline || pendingSalesList.length === 0}
                  className="w-full h-11 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors flex items-center justify-center gap-2 disabled:opacity-40"
                >
                  <RefreshCw size={13} className={syncing ? "animate-spin" : ""} />
                  {syncing ? "Sincronizando..." : isOnline ? "Sincronizar Agora" : "Sem Conexão"}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Receipt Modal */}
      <AnimatePresence>
        {showReceipt && completedSale && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-[300]" />
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 32 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 32 }}
              transition={{ type: "spring", damping: 28, stiffness: 260 }}
              className="fixed inset-x-4 bottom-4 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 z-[301] sm:w-[460px] bg-slate-900 border border-slate-700 sm:rounded-3xl rounded-3xl shadow-2xl flex flex-col overflow-hidden max-h-[90vh]">

              {/* Success header */}
              <div className="shrink-0 bg-gradient-to-br from-emerald-600 to-emerald-800 px-6 pt-6 pb-5 text-white relative overflow-hidden">
                <div className="absolute inset-0 opacity-10">
                  <div className="absolute -top-4 -right-4 w-32 h-32 bg-white rounded-full" />
                  <div className="absolute -bottom-8 -left-4 w-48 h-48 bg-white rounded-full" />
                </div>
                <div className="relative flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle2 size={20} className="text-emerald-200" />
                      <span className="text-[11px] font-black uppercase tracking-[0.2em] text-emerald-200">
                        {completedSale.offline ? "Venda Salva — Offline" : "Venda Confirmada"}
                      </span>
                    </div>
                    <p className="text-3xl font-mono font-black">R$ {completedSale.total.toFixed(2)}</p>
                    <p className="text-[12px] text-emerald-200 font-bold mt-1">
                      {completedSale.offline ? "Sincroniza ao reconectar" : `#${String(completedSale.orderId).padStart(5, "0")}`} · {completedSale.customerName || "Consumidor Final"}
                    </p>
                    {completedSale.sellerName && (
                      <p className="text-[11px] text-emerald-300 font-medium mt-0.5">Vendedor: {completedSale.sellerName}</p>
                    )}
                    {completedSale.change > 0 && (
                      <div className="mt-2 inline-flex items-center gap-1.5 bg-white/20 rounded-xl px-3 py-1.5">
                        <Banknote size={13} className="text-emerald-200" />
                        <span className="text-[12px] font-black text-white">Troco: R$ {completedSale.change.toFixed(2)}</span>
                      </div>
                    )}
                    {/* Pontos ganhos na venda */}
                    {completedSale.pointsEarned != null && completedSale.pointsEarned > 0 && (
                      <div className="mt-2 inline-flex items-center gap-1.5 bg-amber-400/20 rounded-xl px-3 py-1.5">
                        <Star size={13} className="text-amber-300" fill="currentColor" />
                        <span className="text-[12px] font-black text-amber-200">+{completedSale.pointsEarned} pontos ganhos!</span>
                      </div>
                    )}
                    {/* Recompensa resgatada */}
                    {completedSale.rewardApplied && (
                      <div className="mt-2 inline-flex items-center gap-1.5 bg-violet-400/20 rounded-xl px-3 py-1.5">
                        <Gift size={13} className="text-violet-300" />
                        <span className="text-[12px] font-black text-violet-200">{completedSale.rewardApplied} resgatado!</span>
                      </div>
                    )}
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {completedSale.payments.map((p, i) => {
                        const brand = (p.method === "debit" || p.method === "credit") && p.cardBrand !== "other" ? ` ${p.cardBrand.toUpperCase()}` : "";
                        const inst  = p.method === "credit" && p.installments > 1 ? ` ${p.installments}×` : "";
                        return (
                          <div key={i} className="inline-flex items-center gap-1.5 bg-white/15 rounded-xl px-2.5 py-1.5">
                            <span className="text-[10px] font-black text-emerald-100">{PM_LABEL[p.method]}{brand}{inst}</span>
                            <span className="text-[10px] font-mono font-black text-white">R$ {Number(p.amount).toFixed(2)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <button onClick={() => setShowReceipt(false)} className="p-2 hover:bg-white/20 rounded-xl transition-all text-emerald-200">
                    <X size={18} />
                  </button>
                </div>
                <div className="relative mt-3 flex gap-2 overflow-x-auto scrollbar-none pb-0.5">
                  {completedSale.items.map((item, idx) => (
                    <div key={idx} className="shrink-0 flex items-center gap-1.5 bg-white/15 rounded-xl px-2.5 py-1.5">
                      {item.image_url
                        ? <img src={item.image_url} className="w-5 h-5 rounded object-cover shrink-0" alt={item.name} />
                        : <Package size={14} className="text-emerald-200 shrink-0" />}
                      <span className="text-[10px] font-bold text-white truncate max-w-[80px]">{item.name}</span>
                      <span className="text-[10px] font-black text-emerald-200">×{item.quantity}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Receipt actions */}
              <div className="shrink-0 p-5 space-y-2.5">
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3">Emitir Comprovante</p>
                <button onClick={() => printViaIframe(buildThermalHtml(completedSale))}
                  className="w-full flex items-center gap-4 h-14 bg-slate-800 hover:bg-slate-750 border border-slate-700 hover:border-slate-600 rounded-2xl px-5 transition-all group">
                  <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <Printer size={17} className="text-slate-900" />
                  </div>
                  <div className="text-left">
                    <p className="text-[12px] font-black text-white uppercase tracking-widest">Nota Térmica</p>
                    <p className="text-[10px] text-slate-500 font-medium">Impressão 80mm para bobina</p>
                  </div>
                  <ChevronRight size={15} className="ml-auto text-slate-600 group-hover:text-slate-400 group-hover:translate-x-0.5 transition-all" />
                </button>
                <button onClick={() => printViaIframe(buildPDFHtml(completedSale), 600)}
                  className="w-full flex items-center gap-4 h-14 bg-slate-800 hover:bg-slate-750 border border-slate-700 hover:border-slate-600 rounded-2xl px-5 transition-all group">
                  <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform shadow-lg shadow-blue-500/20">
                    <FileText size={17} className="text-white" />
                  </div>
                  <div className="text-left">
                    <p className="text-[12px] font-black text-white uppercase tracking-widest">PDF Completo</p>
                    <p className="text-[10px] text-slate-500 font-medium">Nota detalhada em A4</p>
                  </div>
                  <ChevronRight size={15} className="ml-auto text-slate-600 group-hover:text-slate-400 group-hover:translate-x-0.5 transition-all" />
                </button>
                <button onClick={() => setShowPhoneInput(!showPhoneInput)}
                  className={cn(
                    "w-full flex items-center gap-4 h-14 border rounded-2xl px-5 transition-all group",
                    showPhoneInput ? "bg-emerald-900/30 border-emerald-600/50" : "bg-slate-800 hover:bg-slate-750 border-slate-700 hover:border-slate-600"
                  )}>
                  <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform", showPhoneInput ? "bg-emerald-600" : "bg-emerald-700")}>
                    <MessageCircle size={17} className="text-white" />
                  </div>
                  <div className="text-left">
                    <p className="text-[12px] font-black text-white uppercase tracking-widest">Enviar WhatsApp</p>
                    <p className="text-[10px] text-slate-500 font-medium">Abre WhatsApp Web com comprovante</p>
                  </div>
                  <ChevronDown size={15} className={cn("ml-auto transition-transform text-slate-600", showPhoneInput ? "rotate-180 text-emerald-400" : "")} />
                </button>
                <AnimatePresence>
                  {showPhoneInput && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                      <div className="flex gap-2 pt-1">
                        <div className="relative flex-1">
                          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" size={14} />
                          <input type="tel" placeholder="(11) 99999-9999"
                            className="w-full pl-9 pr-4 h-11 bg-slate-800 border border-emerald-600/60 rounded-xl focus:outline-none text-[13px] font-medium text-white placeholder:text-slate-600 transition-all"
                            value={whatsappPhone} onChange={(e) => setWhatsappPhone(e.target.value)} />
                        </div>
                        <button onClick={() => {
                          const cleaned = whatsappPhone.replace(/\D/g, "");
                          const full = cleaned.startsWith("55") ? cleaned : `55${cleaned}`;
                          window.open(`https://wa.me/${full}?text=${encodeURIComponent(buildWhatsAppText(completedSale))}`, "_blank", "noopener,noreferrer");
                        }}
                          disabled={whatsappPhone.replace(/\D/g, "").length < 10}
                          className="h-11 px-4 bg-emerald-600 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-xl font-black text-[11px] uppercase tracking-widest flex items-center gap-2 transition-all hover:bg-emerald-500 disabled:cursor-not-allowed shrink-0">
                          <MessageCircle size={14} /> Enviar
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="shrink-0 px-5 pb-5">
                <button onClick={() => setShowReceipt(false)}
                  className="w-full h-11 border border-slate-700 rounded-2xl text-[12px] font-black text-slate-500 uppercase tracking-widest hover:bg-slate-800 transition-all">
                  Fechar · Nova Venda
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── PAYMENT ROW (memoizado para não perder foco no input) ───────────────────
const PaymentRow = React.memo(function PaymentRow({
  payment: p, idx, total, paidAmount, showRemove, cardFees, maxInstallments, passFeeByMethod, enabledBrands, onMethodChange, onUpdate, onRemove,
}: {
  payment: PaymentEntry; idx: number; total: number; paidAmount: number;
  showRemove: boolean; cardFees: Record<string, number[]>;
  maxInstallments: number;
  passFeeByMethod: Record<string, boolean>;
  enabledBrands: Record<string, boolean>;
  onMethodChange: (id: string, m: PaymentMethod) => void;
  onUpdate: (id: string, patch: Partial<PaymentEntry>) => void;
  onRemove: (id: string) => void;
}) {
  const passFeeToCustomer = !!(passFeeByMethod[p.method]);
  const feeRate = p.method === "credit" ? (cardFees[p.cardBrand]?.[p.installments - 1] ?? 0)
               : p.method === "debit"  ? (cardFees[`debit_${p.cardBrand}`]?.[0] ?? 0)
               : p.method === "pix"    ? (cardFees["pix"]?.[0] ?? 0)
               : 0;
  const pAmt    = Number(p.amount) || 0;
  const othersPaid = paidAmount - pAmt;
  const installmentOptions = Array.from({ length: maxInstallments }, (_, i) => i + 1);
  // Filtra bandeiras habilitadas
  const activeBrands = CARD_BRANDS.filter((b) => enabledBrands[b.key] !== false);

  return (
    <div className="rounded-2xl p-4 space-y-3 bg-white border border-slate-200 shadow-sm">

      {/* Método */}
      <div className="flex items-center gap-2">
        {showRemove && (
          <span className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-black shrink-0 bg-slate-100 text-slate-400 border border-slate-200">{idx + 1}</span>
        )}
        <div className="grid grid-cols-4 gap-1.5 flex-1">
          {(["money", "debit", "credit", "pix"] as PaymentMethod[]).map((key) => (
            <button key={key} onClick={() => onMethodChange(p.id, key)}
              className="h-11 rounded-xl border text-[9px] font-black uppercase tracking-wider transition-all flex flex-col items-center justify-center gap-1"
              style={p.method === key
                ? key === "credit"
                  ? { background: "#059669", border: "1px solid rgba(16,185,129,0.5)", color: "white", boxShadow: "0 4px 10px rgba(16,185,129,0.25)" }
                  : key === "money"
                  ? { background: "#0284c7", border: "1px solid rgba(2,132,199,0.5)", color: "white", boxShadow: "0 4px 10px rgba(2,132,199,0.25)" }
                  : { background: "#2563eb", border: "1px solid rgba(59,130,246,0.5)", color: "white", boxShadow: "0 4px 10px rgba(59,130,246,0.25)" }
                : { background: "#f8fafc", border: "1px solid #e2e8f0", color: "#94a3b8" }}>
              <span className="[&>svg]:w-3.5 [&>svg]:h-3.5">{PM_ICON[key]}</span>
              <span className="text-[8px]">{PM_LABEL[key]}</span>
            </button>
          ))}
        </div>
        {showRemove && (
          <button onClick={() => onRemove(p.id)} className="p-1.5 rounded-lg transition-all shrink-0 text-slate-300 hover:text-red-500 hover:bg-red-50">
            <X size={14} />
          </button>
        )}
      </div>

      {/* Bandeira */}
      {(p.method === "debit" || p.method === "credit") && activeBrands.length > 0 && (
        <div className={`grid gap-1.5 ${activeBrands.length <= 3 ? "grid-cols-3" : activeBrands.length <= 4 ? "grid-cols-4" : "grid-cols-6"}`}>
          {activeBrands.map(({ key, label, color }) => (
            <button key={key} onClick={() => onUpdate(p.id, { cardBrand: key })}
              className="h-8 rounded-lg text-[8px] font-bold uppercase tracking-wide transition-all"
              style={p.cardBrand === key
                ? { backgroundColor: color, color: "white", border: "1px solid transparent", boxShadow: "0 2px 8px rgba(0,0,0,0.15)" }
                : { background: "#f8fafc", border: "1px solid #e2e8f0", color: "#94a3b8" }}>
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Parcelamento */}
      {p.method === "credit" && (
        <div className={`grid gap-1.5 ${installmentOptions.length <= 4 ? "grid-cols-4" : installmentOptions.length <= 6 ? "grid-cols-6" : "grid-cols-4"}`}>
          {installmentOptions.map((n) => {
            const rate    = cardFees[p.cardBrand]?.[n - 1] ?? 0;
            const refAmt  = Number(p.amount) || total;
            // Se repassa taxa ao cliente: total com taxa / parcelas
            const totalWithFee = passFeeToCustomer && rate > 0 ? refAmt * (1 + rate / 100) : refAmt;
            const perInst = refAmt > 0 ? totalWithFee / n : 0;
            const isSel   = p.installments === n;
            return (
              <button key={n} onClick={() => onUpdate(p.id, { installments: n })}
                className="rounded-xl border transition-all flex flex-col items-center justify-center py-2 gap-0.5"
                style={isSel
                  ? { background: "#059669", border: "1px solid rgba(16,185,129,0.5)", color: "white", boxShadow: "0 3px 8px rgba(16,185,129,0.2)" }
                  : { background: "#f8fafc", border: "1px solid #e2e8f0", color: "#64748b" }}>
                <span className="text-[11px] font-black leading-none">{n === 1 ? "1×" : `${n}×`}</span>
                {perInst > 0 && <span className="text-[8px] font-semibold leading-none mt-0.5" style={{ color: isSel ? "rgba(167,243,208,0.95)" : "#94a3b8" }}>{perInst.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>}
                {rate > 0 && <span className="text-[7px] font-bold leading-none" style={{ color: isSel ? "rgba(167,243,208,0.8)" : passFeeToCustomer ? "#3b82f6" : "#cbd5e1" }}>{passFeeToCustomer ? `c/ ${rate}%` : `+${rate}%`}</span>}
              </button>
            );
          })}
        </div>
      )}

      {/* Valor + indicadores */}
      <div className="flex gap-2 items-center">
        <div className="relative flex-1">
          <Banknote className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
          <input type="number" min="0" step="0.01"
            placeholder={idx === 0 ? (total > 0 ? total.toFixed(2) : "0,00") : "Valor"}
            className="w-full pl-10 pr-3 h-11 rounded-xl text-[15px] font-mono font-bold text-slate-800 placeholder:text-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
            style={{
              border: p.method === "money" && pAmt > 0 && pAmt < (total - othersPaid)
                ? "1px solid #fca5a5" : "1px solid #e2e8f0"
            }}
            value={p.amount}
            onChange={(e) => onUpdate(p.id, { amount: e.target.value })} />
        </div>
        {p.method === "money" && pAmt > 0 && pAmt >= (total - othersPaid) && (
          <div className="rounded-xl px-3 py-2 shrink-0 text-center bg-emerald-50 border border-emerald-200">
            <p className="text-[8px] font-black uppercase text-emerald-600">Troco</p>
            <p className="text-[12px] font-mono font-black text-emerald-700">R$ {Math.max(0, pAmt - (total - othersPaid)).toFixed(2)}</p>
          </div>
        )}
        {feeRate > 0 && pAmt > 0 && (
          <div className="rounded-xl px-3 py-2 shrink-0 text-center bg-amber-50 border border-amber-200">
            <p className="text-[8px] font-black uppercase text-amber-600">Taxa</p>
            <p className="text-[12px] font-mono font-black text-amber-700">+R$ {(pAmt * feeRate / 100).toFixed(2)}</p>
          </div>
        )}
        {p.method === "credit" && p.installments > 1 && pAmt > 0 && (
          <div className="rounded-xl px-3 py-2 shrink-0 text-center bg-blue-50 border border-blue-200">
            <p className="text-[8px] font-black uppercase text-blue-600">{p.installments}×</p>
            <p className="text-[12px] font-mono font-black text-blue-700">R$ {(pAmt / p.installments).toFixed(2)}</p>
          </div>
        )}
      </div>
    </div>
  );
});

// ─── CART PANEL (apenas lista + botão ir para pagamento) ──────────────────────
function CartPanel({
  cart, updateQuantity, removeFromCart,
  subtotal, discountValue, surchargeValue, feeAmount, total, cartQty,
  onCheckout, canFinish, onClose,
}: {
  cart: CartItem[];
  updateQuantity: (id: string, delta: number) => void;
  removeFromCart: (id: string) => void;
  subtotal: number;
  discountValue: number;
  surchargeValue: number;
  feeAmount: number;
  total: number;
  cartQty: number;
  onCheckout: () => void;
  canFinish: boolean;
  onClose?: () => void;
}) {
  return (
    <>
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-blue-50 border border-blue-100 rounded-xl flex items-center justify-center">
            <ShoppingCart size={14} className="text-blue-500" />
          </div>
          <div>
            <h3 className="text-[12px] font-black uppercase tracking-widest text-slate-800">Carrinho</h3>
            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">{cartQty} {cartQty === 1 ? "item" : "itens"}</span>
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-xl text-slate-400 transition-colors">
            <X size={18} />
          </button>
        )}
      </div>

      {/* Items */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-slate-50 pdv-scroll-light">
        <AnimatePresence initial={false}>
          {cart.map((item) => (
            <motion.div
              key={item.cartItemId}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20, height: 0 }}
              transition={{ duration: 0.18 }}>
              <div className="flex items-center gap-3 p-3 rounded-2xl border border-slate-200 bg-white hover:border-blue-200 transition-colors group shadow-sm">
                {/* Thumbnail */}
                {item.image_url ? (
                  <img src={item.image_url} alt={item.name} className="w-10 h-10 rounded-xl object-contain shrink-0 border border-slate-200 p-0.5 bg-slate-50" />
                ) : (
                  <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
                    <Package size={14} className="text-slate-400" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-bold text-slate-700 truncate leading-tight">{item.name}</p>
                  {item.variationLabel && (
                    <p className="text-[9px] font-bold text-blue-500 uppercase tracking-widest">{item.variationLabel}</p>
                  )}
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-[10px] font-mono text-slate-400">R$ {item.price.toFixed(2)}</p>
                    <p className="text-[12px] font-mono font-black text-slate-800">R$ {(item.price * item.quantity).toFixed(2)}</p>
                  </div>
                </div>
                <div className="flex flex-col items-center gap-1 shrink-0">
                  <div className="flex items-center gap-1 bg-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                    <button onClick={() => updateQuantity(item.cartItemId, -1)} className="p-1.5 hover:bg-slate-200 text-slate-400 hover:text-slate-700 transition-all">
                      <Minus size={11} />
                    </button>
                    <span className="w-6 text-center font-mono font-black text-[12px] text-slate-700">{item.quantity}</span>
                    <button onClick={() => updateQuantity(item.cartItemId, 1)} className="p-1.5 hover:bg-slate-200 text-slate-400 hover:text-slate-700 transition-all">
                      <Plus size={11} />
                    </button>
                  </div>
                  <button onClick={() => removeFromCart(item.cartItemId)} className="p-1 text-slate-300 hover:text-red-500 transition-colors rounded">
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        {cart.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-slate-300 gap-4 py-16">
            <ShoppingCart size={40} strokeWidth={1} />
            <div className="text-center">
              <p className="text-[11px] font-black uppercase tracking-[0.2em] mb-1 text-slate-400">Carrinho Vazio</p>
              <p className="text-[10px] text-slate-400">Selecione produtos ao lado</p>
            </div>
          </div>
        )}
      </div>

      {/* Footer summary + checkout button */}
      <div className="shrink-0 border-t border-slate-200 p-4 space-y-3 bg-white">
        {cart.length > 0 && (
          <div className="space-y-1.5">
            {(discountValue > 0 || surchargeValue > 0) && (
              <div className="flex justify-between text-[10px] font-medium text-slate-400">
                <span>Subtotal</span><span className="font-mono">R$ {subtotal.toFixed(2)}</span>
              </div>
            )}
            {discountValue > 0 && (
              <div className="flex justify-between text-[10px] font-bold text-emerald-600">
                <span>Desconto</span><span className="font-mono">− R$ {discountValue.toFixed(2)}</span>
              </div>
            )}
            {surchargeValue > 0 && (
              <div className="flex justify-between text-[10px] font-bold text-amber-500">
                <span>Acréscimo</span><span className="font-mono">+ R$ {surchargeValue.toFixed(2)}</span>
              </div>
            )}
            {feeAmount > 0 && (
              <div className="flex justify-between text-[10px] font-bold text-orange-500">
                <span>Juros máquina</span><span className="font-mono">+ R$ {feeAmount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between items-baseline pt-1.5 border-t border-slate-100">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total</span>
              <span className="text-2xl font-mono font-black text-slate-800">R$ {total.toFixed(2)}</span>
            </div>
          </div>
        )}

        <button
          onClick={onCheckout}
          disabled={!canFinish}
          className="w-full h-13 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 disabled:opacity-25 text-white rounded-2xl text-[12px] font-black uppercase tracking-widest transition-all active:scale-[0.98] flex items-center justify-center gap-2.5 shadow-lg shadow-blue-200">
          <CreditCard size={17} />
          Ir para Pagamento
          {cartQty > 0 && (
            <span className="ml-1 bg-white/20 rounded-lg px-2 py-0.5 text-[10px] font-black">{cartQty}</span>
          )}
        </button>
      </div>
    </>
  );
}
