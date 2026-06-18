import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  Search, ShoppingCart, Plus, Minus, Trash2, User, CreditCard,
  Banknote, Percent, CheckCircle2, Package, X, QrCode, Tag,
  Loader2, ExternalLink, RefreshCw, ChevronRight,
  Printer, FileText, MessageCircle, Phone, Clock, Receipt,
  ChevronDown, PlusCircle, Users, Barcode, Wrench, ChevronUp,
  Star, Gift, UserPlus, Store, Terminal, Ruler,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Product, Category } from "../../types";
import { cn } from "../../lib/utils";
import Combobox from "../../components/ui/Combobox";
import { SERVICE_CATEGORIES, SERVICE_UNITS } from "./Services";

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

type PaymentMethod = "money" | "debit" | "credit" | "pix";
type CardBrand    = "visa" | "master" | "elo" | "amex" | "hiper" | "other";

const CARD_BRANDS = [
  { key: "visa"   as CardBrand, label: "Visa",       color: "#1A1F71" },
  { key: "master" as CardBrand, label: "Mastercard", color: "#EB001B" },
  { key: "elo"    as CardBrand, label: "Elo",        color: "#00A4E0" },
  { key: "amex"   as CardBrand, label: "Amex",       color: "#2E77BC" },
  { key: "hiper"  as CardBrand, label: "Hipercard",  color: "#B22222" },
  { key: "other"  as CardBrand, label: "Outra",      color: "#64748b" },
];

interface CartItem extends Product {
  price: number;
  quantity: number;
  cartItemId: string;
  variationLabel: string;
  selectedOptions?: Record<string, string>;
}

// Cada entrada de pagamento (pode ter múltiplos)
interface PaymentEntry {
  id: string;
  method: PaymentMethod;
  cardBrand: CardBrand;
  installments: number;
  amount: string; // valor digitado
}

interface CompletedSale {
  orderId: number;
  customerName: string;
  payments: PaymentEntry[];
  items: { name: string; quantity: number; price: number; image_url?: string }[];
  subtotal: number;
  discountValue: number;
  feeAmount: number;
  total: number;
  change: number;
  tenantName: string;
  tenantAddress: string;
  tenantWhatsapp: string;
  tenantLogo: string;
  tenantColor: string;
  cardFees: Record<string, number[]>;
  pointsEarned?: number;
  rewardApplied?: string;
}

interface RecentOrder {
  id: number;
  customer_name: string;
  total_amount: number;
  payment_method: string;
  created_at: string;
  items?: { product_name: string; quantity: number; image_url?: string }[];
}

interface TenantInfo {
  name: string;
  address?: string;
  address_street?: string;
  address_number?: string;
  address_complement?: string;
  address_district?: string;
  address_city?: string;
  address_state?: string;
  address_zip?: string;
  whatsapp?: string;
  logo_url?: string;
  primary_color?: string;
}

const PM_LABEL: Record<PaymentMethod, string> = {
  money: "Dinheiro", debit: "Débito", credit: "Crédito", pix: "PIX",
};

function newPayment(): PaymentEntry {
  return { id: Math.random().toString(36).slice(2), method: "money", cardBrand: "visa", installments: 1, amount: "" };
}

export default function PDV() {
  const [products, setProducts]     = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [cart, setCart]             = useState<CartItem[]>([]);
  const [loading, setLoading]       = useState(true);
  const [finishing, setFinishing]   = useState(false);
  const [saleError, setSaleError]   = useState<string | null>(null);
  const [terminalConfigured, setTerminalConfigured] = useState(false);
  const [terminalCharging, setTerminalCharging] = useState(false);
  const [terminalResult, setTerminalResult] = useState<{ status: string; brand?: string; authCode?: string } | null>(null);
  const [configProduct, setConfigProduct] = useState<Product | null>(null);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const [showCheckout, setShowCheckout] = useState(false);

  // services
  interface ServiceItem { id: number; name: string; price: number; description?: string; unit?: string; category?: string; quantity?: number }
  const [services, setServices]         = useState<ServiceItem[]>([]);
  const [showServicesModal, setShowServicesModal] = useState(false);
  const [cartServices, setCartServices] = useState<ServiceItem[]>([]);
  const [showServicesTab, setShowServicesTab] = useState(false);

  // checkout fields — customer
  interface CustomerOption { id: number; name: string; phone?: string; document?: string }
  const [customers, setCustomers]                   = useState<CustomerOption[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [customerName, setCustomerName]             = useState("");
  const [customerPoints, setCustomerPoints]         = useState(0);
  const [loyaltyProgram, setLoyaltyProgram]         = useState<{ spend_per_point: number; is_active: boolean } | null>(null);
  const [loyaltyRewards, setLoyaltyRewards]         = useState<{ id: number; name: string; points_cost: number; type: string; discount_value?: number; discount_type?: string }[]>([]);
  const [appliedReward, setAppliedReward]           = useState<{ id: number; name: string; points_cost: number; type: string; discount_value?: number; discount_type?: string } | null>(null);
  // new customer quick-form
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
  const [cardFees, setCardFees]         = useState<Record<string, number[]>>({});
  const [passFeeToCustomer, setPassFeeToCustomer] = useState(false);
  const [passFeeByMethod, setPassFeeByMethod]     = useState<Record<string, boolean>>({});
  const [maxInstallments, setMaxInstallments]     = useState(12);
  const [enabledBrands, setEnabledBrands]         = useState<Record<string, boolean>>({ visa: true, master: true, elo: true, amex: true, hiper: true, other: true });
  // discount
  const [discountMode, setDiscountMode] = useState<"R$" | "%">("R$");
  const [discount, setDiscount]         = useState("");
  // surcharge (acréscimo)
  const [surchargeMode, setSurchargeMode] = useState<"R$" | "%">("R$");
  const [surcharge, setSurcharge]       = useState("");
  const [payments, setPayments]         = useState<PaymentEntry[]>([newPayment()]);

  // receipt modal
  const [completedSale, setCompletedSale] = useState<CompletedSale | null>(null);
  const [showReceipt, setShowReceipt]     = useState(false);
  const [whatsappPhone, setWhatsappPhone] = useState("");
  const [showPhoneInput, setShowPhoneInput] = useState(false);

  // right panel
  const [recentOrders, setRecentOrders]   = useState<RecentOrder[]>([]);
  const [showRightPanel, setShowRightPanel] = useState(false);
  const [loadingOrders, setLoadingOrders] = useState(false);

  // sellers
  const [sellers, setSellers]         = useState<{ id: number; name: string; commission_rate: number }[]>([]);
  const [selectedSellerId, setSelectedSellerId] = useState<number | null>(null);

  // barcode scanner
  const [scanCode, setScanCode]           = useState("");
  const [scanFeedback, setScanFeedback]   = useState<"ok" | "err" | null>(null);
  const scanInputRef = useRef<HTMLInputElement>(null);

  // tenant
  const [tenant, setTenant] = useState<TenantInfo>({ name: "BoxSys Store" });

  const token = localStorage.getItem("token");

  useEffect(() => {
    const headers = { Authorization: `Bearer ${token}` };
    Promise.all([
      fetch("/api/products",   { headers }).then((r) => r.json()),
      fetch("/api/categories", { headers }).then((r) => r.json()),
    ]).then(([prods, cats]) => {
      setProducts(Array.isArray(prods) ? prods : []);
      setCategories(Array.isArray(cats) ? cats : []);
      setLoading(false);
    });
    fetch("/api/tenant", { headers })
      .then((r) => r.json())
      .then((d) => {
        if (d?.card_fees) setCardFees(d.card_fees);
        if (d?.pass_fee_to_customer !== undefined) setPassFeeToCustomer(Boolean(d.pass_fee_to_customer));
        if (d?.pass_fee_by_method) setPassFeeByMethod(d.pass_fee_by_method as Record<string, boolean>);
        if (d?.max_installments) setMaxInstallments(Number(d.max_installments));
        if (d?.enabled_brands) setEnabledBrands(d.enabled_brands as Record<string, boolean>);
        setTenant({
          name:          d?.name          || "BoxSys Store",
          address:       d?.address       || "",
          whatsapp:      d?.whatsapp      || "",
          logo_url:      d?.logo_url      || "",
          primary_color: d?.primary_color || "#2563eb",
        });
      })
      .catch(() => {});
    fetch("/api/terminals/config", { headers })
      .then((r) => r.json())
      .then((cfg) => { if (cfg?.provider) setTerminalConfigured(true); })
      .catch(() => {});
    fetch("/api/sellers", { headers })
      .then((r) => r.json())
      .then((d) => setSellers(Array.isArray(d) ? d.filter((s: any) => s.is_active) : []))
      .catch(() => {});
    fetch("/api/services", { headers })
      .then((r) => r.json())
      .then((d) => setServices(Array.isArray(d) ? d.filter((s: any) => s.is_active !== false) : []))
      .catch(() => {});
    fetch("/api/customers", { headers })
      .then((r) => r.json())
      .then((d) => setCustomers(Array.isArray(d) ? d : []))
      .catch(() => {});
    Promise.all([
      fetch("/api/loyalty/program", { headers }).then((r) => r.json()),
      fetch("/api/loyalty/rewards", { headers }).then((r) => r.json()),
    ]).then(([pg, rw]) => {
      setLoyaltyProgram({ spend_per_point: Number(pg.spend_per_point ?? 10), is_active: pg.is_active ?? false });
      setLoyaltyRewards(Array.isArray(rw) ? rw.filter((r: { is_active: boolean }) => r.is_active) : []);
    }).catch(() => {});
  }, []);

  const fetchRecentOrders = useCallback(async () => {
    setLoadingOrders(true);
    try {
      const res = await fetch("/api/orders?limit=10", { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setRecentOrders(Array.isArray(data) ? data.slice(0, 10) : []);
    } catch { /* ignore */ }
    setLoadingOrders(false);
  }, [token]);

  // ── barcode scanner ───────────────────────────────────────────────────────────
  // helper simples: adiciona 1 unidade sem modal de variação
  const addToCartDirect = useCallback((product: Product) => {
    const cartItemId = `${product.id}`;
    setCart((prev) => {
      const existing = prev.find((i) => i.cartItemId === cartItemId);
      if (existing) {
        return prev.map((i) =>
          i.cartItemId === cartItemId ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [
        ...prev,
        { ...product, price: Number(product.price), quantity: 1, cartItemId, variationLabel: "", selectedOptions: undefined },
      ];
    });
  }, []);

  const handleScan = useCallback(async (code: string) => {
    const trimmed = code.trim();
    if (!trimmed) return;
    setScanCode("");

    // 1) tenta encontrar no cache local primeiro (instantâneo)
    const local = products.find((p) => p.barcode === trimmed);
    if (local) {
      addToCartDirect(local);
      setScanFeedback("ok");
      setTimeout(() => setScanFeedback(null), 1200);
      return;
    }

    // 2) busca na API (produto novo ou cache desatualizado)
    try {
      const res = await fetch(`/api/products/by-barcode/${encodeURIComponent(trimmed)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const p = await res.json();
        setProducts((prev) =>
          prev.some((x) => x.id === p.id) ? prev : [...prev, p]
        );
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

  // ── Captura global do leitor de código de barras ─────────────────────────────
  // Leitores USB HID simulam teclado: digitam os chars rápido + Enter.
  // Detectamos sequências rápidas (< 80ms entre chars) e as redirecionamos
  // para o campo de scan mesmo sem foco, de forma transparente ao operador.
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
        if (buffer.length >= 3) {
          e.preventDefault();
          flush(buffer);
        }
        return;
      }

      if (e.key.length !== 1) return;

      // Campo de scan já focado → deixa o onChange normal cuidar
      if (document.activeElement === scanInputRef.current) return;

      // Digitação humana lenta em outro campo → ignora
      if (gap > 80 && isEditable) return;

      // Leitor detectado → captura e redireciona
      e.preventDefault();
      buffer += e.key;
      scanInputRef.current?.focus();
      setScanCode(buffer);

      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        const b = buffer;
        buffer = "";
        if (b.trim().length >= 3) handleScan(b.trim());
      }, 300);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleScan]);

  // ── cart helpers ──────────────────────────────────────────────────────────────
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
    setConfigProduct(null);
    setSelectedOptions({});
  };

  const updateQuantity = (cartItemId: string, delta: number) => {
    setCart(cart.map((item) => {
      if (item.cartItemId !== cartItemId) return item;
      const nq = item.quantity + delta;
      if (nq <= 0) return null as unknown as CartItem;
      return { ...item, quantity: nq };
    }).filter(Boolean));
  };

  const removeFromCart = (cartItemId: string) => setCart(cart.filter((i) => i.cartItemId !== cartItemId));

  // ── totals ────────────────────────────────────────────────────────────────────
  const servicesTotal = cartServices.reduce((a, s) => a + s.price * (s.quantity ?? 1), 0);
  const subtotal      = cart.reduce((a, b) => a + b.price * b.quantity, 0) + servicesTotal;

  const discountRaw   = Number(discount) || 0;
  const discountValue = discountMode === "%"
    ? Math.min(subtotal * discountRaw / 100, subtotal)
    : Math.min(discountRaw, subtotal);

  const surchargeRaw   = Number(surcharge) || 0;
  const surchargeValue = surchargeMode === "%"
    ? subtotal * surchargeRaw / 100
    : surchargeRaw;

  const baseTotal = subtotal - discountValue + surchargeValue;

  const getFeeRate = (p: PaymentEntry) => {
    if (p.method === "credit") return cardFees[p.cardBrand]?.[p.installments - 1] ?? 0;
    if (p.method === "debit")  return cardFees[`debit_${p.cardBrand}`]?.[0] ?? 0;
    if (p.method === "pix")    return cardFees["pix"]?.[0] ?? 0;
    return 0;
  };
  const isPassFee = (p: PaymentEntry) => !!(passFeeByMethod[p.method] ?? passFeeToCustomer);

  const feeAmount = payments.reduce((sum, p) => {
    const rate = getFeeRate(p);
    if (!rate) return sum;
    const pAmt = Number(p.amount) || 0;
    const ref  = pAmt > 0 ? pAmt : baseTotal;
    return sum + ref * (rate / 100);
  }, 0);

  const passedFeeAmount = payments.reduce((sum, p) => {
    if (!isPassFee(p)) return sum;
    const rate = getFeeRate(p);
    if (!rate) return sum;
    const pAmt = Number(p.amount) || 0;
    const ref  = pAmt > 0 ? pAmt : baseTotal;
    return sum + ref * (rate / 100);
  }, 0);

  const total = Math.round((baseTotal + passedFeeAmount) * 100) / 100;

  // quanto já foi preenchido nos pagamentos
  const paidAmount   = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const remaining    = Math.max(0, total - paidAmount);
  const moneyPayment = payments.find((p) => p.method === "money");
  const moneyAmt     = Number(moneyPayment?.amount) || 0;
  const change       = moneyAmt > 0 && paidAmount >= total ? moneyAmt - (total - (paidAmount - moneyAmt)) : 0;

  const cartQty = cart.reduce((a, b) => a + b.quantity, 0) + cartServices.length;

  // payment helpers
  const updatePayment = (id: string, patch: Partial<PaymentEntry>) =>
    setPayments((ps) => ps.map((p) => p.id === id ? { ...p, ...patch } : p));

  const removePayment = (id: string) =>
    setPayments((ps) => ps.length > 1 ? ps.filter((p) => p.id !== id) : ps);

  // ao adicionar, preenche automaticamente o restante no novo campo
  const addPayment = () => {
    const rem = Math.max(0, total - paidAmount);
    setPayments((ps) => [...ps, { ...newPayment(), amount: rem > 0 ? rem.toFixed(2) : "" }]);
  };

  // ao abrir checkout, preenche automaticamente o valor se só tiver 1 pagamento
  const autoFillFirst = () => {
    setPayments((ps) => {
      if (ps.length === 1 && total > 0) {
        return [{ ...ps[0], amount: total.toFixed(2) }];
      }
      return ps;
    });
  };

  // ao selecionar método, se só tem 1 pagamento, preenche valor automaticamente (exceto dinheiro que o operador digita)
  const handleMethodChange = (id: string, method: PaymentMethod) => {
    setPayments((ps) => {
      const updated = ps.map((p) => p.id === id ? { ...p, method, installments: 1 } : p);
      if (updated.length === 1 && method !== "money" && total > 0) {
        return updated.map((p) => p.id === id ? { ...p, amount: total.toFixed(2) } : p);
      }
      // multi-payment: preenche com o restante ao mudar método
      if (updated.length > 1 && method !== "money") {
        const others = updated.filter((p) => p.id !== id).reduce((s, p) => s + (Number(p.amount) || 0), 0);
        const rem = Math.max(0, total - others);
        if (rem > 0) return updated.map((p) => p.id === id ? { ...p, amount: rem.toFixed(2) } : p);
      }
      return updated;
    });
  };

  // permite confirmar mesmo com valor menor (saldo devedor aceito)
  const canFinish = (cart.length > 0 || cartServices.length > 0) && total > 0;

  // ── receipt helpers ───────────────────────────────────────────────────────────
  const buildPaymentLines = (sale: CompletedSale) =>
    sale.payments.map((p) => {
      const brand = (p.method === "debit" || p.method === "credit") && p.cardBrand !== "other"
        ? `/${p.cardBrand.toUpperCase()}` : "";
      const inst  = p.method === "credit" && p.installments > 1 ? ` ${p.installments}X` : "";
      return `${PM_LABEL[p.method]}${brand}${inst}: R$ ${Number(p.amount).toFixed(2)}`;
    }).join(" | ");

  const buildThermalHtml = (sale: CompletedSale) => {
    const now = new Date().toLocaleString("pt-BR");
    const orderId = String(sale.orderId).padStart(6, "0");

    const removeAccents = (text: string) =>
      text.normalize("NFD").replace(/[̀-ͯ]/g, "");

    const truncate = (str: string, maxLen: number) => {
      const s = removeAccents(String(str || ""));
      return s.length > maxLen ? s.substring(0, maxLen) : s;
    };

    const centerText = (text: string, width = 32) => {
      const s = truncate(text, width);
      const diff = Math.max(0, width - s.length);
      return " ".repeat(Math.floor(diff / 2)) + s + " ".repeat(Math.ceil(diff / 2));
    };

    const line = (left: string, right: string = "", width = 32) => {
      const l = truncate(left, 16);
      const r = truncate(right, 14);
      if (!right) {
        const spaces = Math.max(0, width - l.length);
        return l + " ".repeat(spaces);
      }
      const space = Math.max(1, width - l.length - r.length);
      return l + " ".repeat(space) + r;
    };

    const dash = "--------------------------------";
    const dotLine = "................................";

    let receipt = "";
    receipt += "\n" + centerText("RECIBO", 32) + "\n";
    receipt += centerText(sale.tenantName, 32) + "\n";
    if (sale.tenantAddress) {
      receipt += centerText(sale.tenantAddress, 32) + "\n";
    }
    receipt += dash.substring(0, 32) + "\n\n";

    receipt += line("PEDIDO", "#" + orderId, 32) + "\n";
    receipt += line("DATA", now.split(",")[0], 32) + "\n";
    receipt += line("HORA", now.split(",")[1].trim().substring(0, 8), 32) + "\n";
    receipt += dash.substring(0, 32) + "\n\n";

    receipt += "CLIENTE:\n";
    receipt += centerText(truncate(sale.customerName || "CONSUMIDOR", 32), 32) + "\n";
    receipt += dash.substring(0, 32) + "\n\n";

    receipt += "ITENS:\n";
    sale.items.forEach((item) => {
      receipt += truncate(item.name, 32) + "\n";
      const qty = String(item.quantity);
      const price = "R$ " + item.price.toFixed(2);
      const total = "R$ " + (item.price * item.quantity).toFixed(2);
      receipt += line(qty + "x " + price, total, 32) + "\n\n";
    });

    if (sale.items.length > 0) {
      receipt += dash.substring(0, 32) + "\n\n";
    }

    if (sale.items.length > 0 && sale.discountValue > 0) {
      receipt += line("SUBTOTAL", "R$ " + sale.subtotal.toFixed(2), 32) + "\n";
      receipt += line("DESCONTO", "-R$ " + sale.discountValue.toFixed(2), 32) + "\n";
      receipt += dotLine.substring(0, 32) + "\n";
    }

    receipt += line("TOTAL", "R$ " + sale.total.toFixed(2), 32) + "\n";
    receipt += dash.substring(0, 32) + "\n\n";

    receipt += "PAGAMENTO:\n";
    sale.payments.forEach((p) => {
      const brand = (p.method === "debit" || p.method === "credit") && p.cardBrand !== "other" ? ` ${p.cardBrand.toUpperCase()}` : "";
      const inst = p.method === "credit" && p.installments > 1 ? ` ${p.installments}x` : "";
      const label = removeAccents(`${PM_LABEL[p.method]}${brand}${inst}`.toUpperCase());
      receipt += line(label, "R$ " + Number(p.amount).toFixed(2), 32) + "\n";
    });
    receipt += "\n";

    if (change > 0) {
      receipt += dash.substring(0, 32) + "\n";
      receipt += line("TROCO", "R$ " + change.toFixed(2), 32) + "\n";
    }

    receipt += dash.substring(0, 32) + "\n";
    receipt += centerText("Obrigado!", 32) + "\n";
    receipt += centerText("Volte Sempre!", 32);

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="windows-1252">
  <meta http-equiv="Content-Type" content="text/html; charset=windows-1252">
  <title>Cupom #${orderId}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { margin: 0; padding: 0; width: 58mm; }
    body {
      font-family: 'Courier New', Courier, monospace;
      font-size: 11px;
      line-height: 1.2;
      width: 58mm;
      padding: 0;
      margin: 0;
      white-space: pre;
      background: white;
      color: black;
    }
    @media print {
      @page { margin: 0; size: 58mm; }
      body { margin: 0; padding: 0; width: 58mm; }
    }
  </style>
</head>
<body>${receipt}</body>
</html>`;
  };

  const buildPDFHtml = (sale: CompletedSale) => {
    const now = new Date().toLocaleString("pt-BR");
    const orderId = String(sale.orderId).padStart(5, "0");
    const payLines = sale.payments.map((p) => {
      const brand = (p.method === "debit" || p.method === "credit") && p.cardBrand !== "other" ? ` · ${p.cardBrand.toUpperCase()}` : "";
      const inst  = p.method === "credit" && p.installments > 1 ? ` ${p.installments}×` : "";
      return `<div class="pay-row"><span>${PM_LABEL[p.method]}${brand}${inst}</span><span>R$ ${Number(p.amount).toFixed(2)}</span></div>`;
    }).join("");

    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Nota PDV #${orderId}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Inter', sans-serif; background: #fff; color: #0f172a; padding: 40px; max-width: 700px; margin: 0 auto; }
  .header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 32px; padding-bottom: 24px; border-bottom: 3px solid #0f172a; }
  .logo { max-height: 56px; max-width: 140px; object-fit: contain; margin-bottom: 8px; }
  .store-name { font-size: 22px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; }
  .store-addr { font-size: 12px; color: #64748b; margin-top: 4px; }
  .header-right { text-align: right; }
  .receipt-label { font-size: 10px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 3px; }
  .receipt-num { font-size: 28px; font-weight: 900; }
  .receipt-date { font-size: 12px; color: #64748b; margin-top: 4px; }
  .section { margin-bottom: 24px; }
  .section-title { font-size: 10px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 3px; margin-bottom: 10px; }
  .customer-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px 18px; }
  .customer-name { font-size: 16px; font-weight: 700; }
  table { width: 100%; border-collapse: collapse; }
  thead tr th { font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 2px; color: #94a3b8; padding: 8px 0; border-bottom: 1px solid #e2e8f0; text-align: left; }
  thead tr th:last-child { text-align: right; }
  tbody tr td { padding: 10px 0; border-bottom: 1px solid #f1f5f9; vertical-align: middle; }
  .product-name { font-weight: 700; font-size: 13px; }
  .product-qty { font-size: 12px; color: #64748b; background: #f1f5f9; border-radius: 6px; padding: 2px 8px; display: inline-block; }
  .price-cell { text-align: right; font-weight: 700; font-size: 13px; }
  .totals-box { background: #0f172a; border-radius: 16px; padding: 20px 24px; color: #fff; margin-top: 24px; }
  .totals-row { display: flex; justify-content: space-between; font-size: 13px; padding: 4px 0; color: #94a3b8; }
  .totals-row.discount { color: #34d399; }
  .totals-row.fee { color: #fbbf24; }
  .totals-row.main { font-size: 24px; font-weight: 900; color: #fff; padding-top: 12px; border-top: 1px solid #334155; margin-top: 8px; }
  .totals-row.change { color: #34d399; font-weight: 700; }
  .pay-section { margin-top: 16px; padding-top: 12px; border-top: 1px solid #1e293b; }
  .pay-row { display: flex; justify-content: space-between; font-size: 13px; color: #93c5fd; padding: 3px 0; }
  .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 11px; color: #94a3b8; }
  @media print { @page { size: A4; margin: 20mm 15mm; } body { padding: 0; } }
</style></head><body>
<div class="header">
  <div>
    ${sale.tenantLogo ? `<img src="${sale.tenantLogo}" class="logo" alt="logo"/>` : ""}
    <div class="store-name">${sale.tenantName}</div>
    ${sale.tenantAddress ? `<div class="store-addr">${sale.tenantAddress}</div>` : ""}
  </div>
  <div class="header-right">
    <div class="receipt-label">Comprovante PDV</div>
    <div class="receipt-num">#${orderId}</div>
    <div class="receipt-date">${now}</div>
  </div>
</div>
<div class="section">
  <div class="section-title">Cliente</div>
  <div class="customer-box"><div class="customer-name">${sale.customerName || "Consumidor Final"}</div></div>
</div>
<div class="section">
  <div class="section-title">Itens da Venda</div>
  <table>
    <thead><tr><th>Produto</th><th>Qtd</th><th>Unit.</th><th>Total</th></tr></thead>
    <tbody>${sale.items.map((item) => `
      <tr>
        <td><div class="product-name">${item.name}</div></td>
        <td><span class="product-qty">${item.quantity}</span></td>
        <td style="font-size:13px;color:#64748b">R$ ${item.price.toFixed(2)}</td>
        <td class="price-cell">R$ ${(item.price * item.quantity).toFixed(2)}</td>
      </tr>`).join("")}
    </tbody>
  </table>
</div>
<div class="totals-box">
  ${sale.discountValue > 0 ? `<div class="totals-row"><span>Subtotal</span><span>R$ ${sale.subtotal.toFixed(2)}</span></div><div class="totals-row discount"><span>Desconto</span><span>− R$ ${sale.discountValue.toFixed(2)}</span></div>` : ""}
  <div class="totals-row main"><span>TOTAL</span><span>R$ ${sale.total.toFixed(2)}</span></div>
  ${change > 0 ? `<div class="totals-row change"><span>Troco devolvido</span><span>R$ ${change.toFixed(2)}</span></div>` : ""}
  <div class="pay-section">${payLines}</div>
</div>
<div class="footer">Documento gerado pelo BoxSys PDV · ${now}</div>
</body></html>`;
  };

  const buildWhatsAppText = (sale: CompletedSale) => {
    const now = new Date().toLocaleString("pt-BR");
    const payLines = buildPaymentLines(sale);
    return [
      `*${sale.tenantName}*`,
      `Comprovante #${String(sale.orderId).padStart(5, "0")} — ${now}`,
      ``,
      `*Cliente:* ${sale.customerName || "Consumidor Final"}`,
      ``,
      `*Itens:*`,
      ...sale.items.map((i) => `• ${i.name} × ${i.quantity}  →  R$ ${(i.price * i.quantity).toFixed(2)}`),
      ``,
      sale.discountValue > 0 ? `Desconto: − R$ ${sale.discountValue.toFixed(2)}` : null,
      `*TOTAL: R$ ${sale.total.toFixed(2)}*`,
      `Pagamento: ${payLines}`,
      sale.change > 0 ? `Troco: R$ ${sale.change.toFixed(2)}` : null,
      ``,
      `Obrigado pela preferência! 🙏`,
    ].filter((l) => l !== null).join("\n");
  };

  const printViaIframe = (html: string, delay = 400) => {
    const iframe = document.createElement("iframe");
    Object.assign(iframe.style, { position: "fixed", right: "0", bottom: "0", width: "0", height: "0", border: "none" });
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

  // ── finish sale ───────────────────────────────────────────────────────────────
  const handleFinishSale = async () => {
    if (!canFinish || finishing) return;
    setFinishing(true);
    setSaleError(null);
    try {
      const pmString = payments.map((p) => {
        const brand = (p.method === "debit" || p.method === "credit") ? `-${p.cardBrand}` : "";
        const inst  = p.method === "credit" && p.installments > 1 ? `-${p.installments}x` : "";
        return `${p.method}${brand}${inst}:${Number(p.amount).toFixed(2)}`;
      }).join("|");

      const res = await fetch("/api/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          items: cart.map((i) => ({ id: i.id, quantity: i.quantity, price: i.price, selectedOptions: i.selectedOptions ?? null })),
          services: cartServices.map((s) => ({ id: s.id, name: s.name, price: s.price, quantity: s.quantity ?? 1 })),
          customerName,
          customerId: selectedCustomerId ?? undefined,
          totalAmount: total,
          paymentMethod: pmString,
          discount: discountValue,
          surcharge: surchargeValue > 0 ? surchargeValue : undefined,
          sellerId: selectedSellerId ?? undefined,
          passFeeToCustomer,
          passFeeByMethod,
        }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        const msg = errData.detail || errData.error || `Erro ${res.status} ao processar venda`;
        setSaleError(msg);
        return;
      }
      const data = await res.json();

        // redeem reward if applied
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

        let pointsEarned: number | undefined;
        if (selectedCustomerId && loyaltyProgram?.is_active && loyaltyProgram.spend_per_point > 0) {
          pointsEarned = Math.floor(total / loyaltyProgram.spend_per_point);
          if (pointsEarned <= 0) pointsEarned = undefined;
        }

        const sale: CompletedSale = {
          orderId: data.orderId,
          customerName,
          payments: payments.map((p) => ({ ...p })),
          items: cart.map((i) => ({ name: i.name, quantity: i.quantity, price: i.price, image_url: i.image_url })),
          subtotal, discountValue, feeAmount, total,
          change: change > 0 ? change : 0,
          tenantName:     tenant.name,
          tenantAddress:  tenant.address_street
            ? [
                `${tenant.address_street}${tenant.address_number ? ", " + tenant.address_number : ""}`,
                tenant.address_complement,
                tenant.address_district,
                tenant.address_city && tenant.address_state
                  ? `${tenant.address_city} - ${tenant.address_state}`
                  : (tenant.address_city ?? tenant.address_state ?? ""),
                tenant.address_zip,
              ].filter(Boolean).join(" | ")
            : (tenant.address ?? ""),
          tenantWhatsapp: tenant.whatsapp ?? "",
          tenantLogo:     tenant.logo_url ?? "",
          tenantColor:    tenant.primary_color ?? "#2563eb",
          cardFees, pointsEarned, rewardApplied,
        };
        setCompletedSale(sale);
        setCart([]); setCartServices([]); setCustomerName(""); setSelectedCustomerId(null);
        setCustomerPoints(0); setAppliedReward(null); setDiscount(""); setSurcharge("");
        setPayments([newPayment()]); setSelectedSellerId(null);
        setShowCheckout(false);
        setShowReceipt(true);
        setWhatsappPhone(""); setShowPhoneInput(false);
        fetch("/api/products", { headers: { Authorization: `Bearer ${token}` } })
          .then((r) => r.json()).then((d) => setProducts(Array.isArray(d) ? d : []));
        fetchRecentOrders();
    } catch (e) {
      console.error("Sale failed", e);
      setSaleError("Erro inesperado ao processar venda. Tente novamente.");
    }
    finally { setFinishing(false); }
  };

  const handleChargeTerminal = async () => {
    if (!canFinish || terminalCharging) return;
    setTerminalCharging(true);
    setTerminalResult(null);
    setSaleError(null);
    try {
      const cardPayment = payments.find((p) => p.method === "credit" || p.method === "debit");
      const amount = cardPayment ? Number(cardPayment.amount) || total : total;
      const res = await fetch("/api/terminals/charge", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          amount,
          installments: cardPayment?.installments ?? 1,
          mode: cardPayment?.method === "debit" ? "debit" : "credit",
          description: `Venda PDV`,
        }),
      });
      const tx = await res.json();
      if (!res.ok) {
        setSaleError(tx?.error ?? "Erro ao cobrar na maquininha.");
        return;
      }
      if (tx.status === "approved") {
        setTerminalResult({ status: "approved", brand: tx.brand, authCode: tx.authorizationCode });
        // Finaliza a venda automaticamente após aprovação
        await handleFinishSale();
      } else {
        setSaleError(`Pagamento ${tx.status === "denied" ? "negado" : tx.status} pela maquininha.`);
      }
    } catch {
      setSaleError("Erro de conexão com o terminal.");
    } finally {
      setTerminalCharging(false);
    }
  };

  const refreshProducts = () => {
    setLoading(true);
    const headers = { Authorization: `Bearer ${token}` };
    Promise.all([
      fetch("/api/products",   { headers }).then((r) => r.json()),
      fetch("/api/categories", { headers }).then((r) => r.json()),
    ]).then(([prods, cats]) => {
      setProducts(Array.isArray(prods) ? prods : []);
      setCategories(Array.isArray(cats) ? cats : []);
      setLoading(false);
    });
  };

  const filteredProducts = useMemo(() => products.filter((p) => {
    if (selectedCategory && p.category_id !== selectedCategory) return false;
    if (searchTerm && !p.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  }), [products, searchTerm, selectedCategory]);

  const pmLabel = (pm: string) => {
    const map: Record<string, string> = { money: "Dinheiro", pix: "PIX", debito: "Débito", credito: "Crédito" };
    return map[pm.split("-")[0].replace("é","e").replace("ó","o")] ?? pm;
  };

  // ── render ────────────────────────────────────────────────────────────────────
  return (
    <div className="h-full flex flex-col overflow-hidden bg-slate-100 font-sans">

      {/* ── TOP BAR ─────────────────────────────────────────────────────────── */}
      <header className="h-14 flex items-center justify-between px-5 shrink-0 bg-white border-b border-slate-200 shadow-sm">

        {/* Logo + nome */}
        <div className="flex items-center gap-3">
          {tenant.logo_url ? (
            <img src={tenant.logo_url} alt={tenant.name} className="h-8 w-auto max-w-[72px] object-contain rounded-xl" />
          ) : (
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-black text-[13px] shadow"
              style={{ background: "linear-gradient(135deg, #3b82f6, #1d4ed8)" }}>
              {tenant.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <p className="text-[13px] font-black text-slate-800 tracking-wide leading-none">{tenant.name}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-widest">PDV Interno</span>
            </div>
          </div>
        </div>

        {/* Scanner status — centro */}
        <div className="flex-1 flex justify-center px-6">
          <div className={cn(
            "flex items-center gap-2 px-3 h-7 rounded-xl border text-[10px] font-bold uppercase tracking-widest transition-all duration-300",
            scanFeedback === "ok"  ? "bg-emerald-50 border-emerald-300 text-emerald-600" :
            scanFeedback === "err" ? "bg-red-50 border-red-300 text-red-500" :
            "bg-slate-100 border-slate-200 text-slate-400"
          )}>
            <Barcode size={11} />
            {scanFeedback === "ok" ? "Adicionado!" : scanFeedback === "err" ? "Não encontrado" : "Scanner pronto"}
            <input
              ref={scanInputRef}
              value={scanCode}
              onChange={(e) => setScanCode(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { handleScan(scanCode); e.preventDefault(); } }}
              className="absolute opacity-0 w-0 h-0 pointer-events-none"
            />
          </div>
        </div>

        {/* Ações direita */}
        <div className="flex items-center gap-2">
          <button onClick={refreshProducts} title="Atualizar produtos"
            className="flex items-center gap-1.5 px-3 h-8 rounded-xl text-[10px] font-bold uppercase tracking-widest text-slate-500 border border-slate-200 hover:bg-slate-50 hover:text-slate-700 transition-all">
            <RefreshCw size={11} className={loading ? "animate-spin" : ""} />
            <span className="hidden sm:block">Atualizar</span>
          </button>
          <button onClick={() => { setShowRightPanel(!showRightPanel); if (!showRightPanel) fetchRecentOrders(); }}
            className={cn(
              "flex items-center gap-1.5 px-3 h-8 rounded-xl text-[10px] font-bold uppercase tracking-widest border transition-all",
              showRightPanel
                ? "bg-slate-900 border-slate-900 text-white"
                : "text-slate-500 border-slate-200 hover:bg-slate-50 hover:text-slate-700"
            )}>
            <Receipt size={11} />
            <span className="hidden sm:block">Recentes</span>
          </button>
          <button onClick={() => window.open("/pdv", "_blank", "noopener,noreferrer")}
            className="flex items-center gap-1.5 px-3 h-8 rounded-xl text-[10px] font-bold uppercase tracking-widest text-white border border-blue-600 transition-all shadow"
            style={{ background: "linear-gradient(135deg,#3b82f6,#1d4ed8)" }}>
            <ExternalLink size={11} />
            <span className="hidden sm:block">PDV Externo</span>
          </button>
        </div>
      </header>

      {/* ── BODY ────────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden">

        {/* ── PRODUTOS ────────────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col gap-2.5 overflow-hidden p-4">

          {/* Busca */}
          <div className="flex gap-2 items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <input type="text" placeholder={showServicesTab ? "Buscar serviço..." : "Buscar produto..."}
                value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 h-10 bg-white rounded-xl text-[13px] font-medium text-slate-700 placeholder:text-slate-400 focus:outline-none transition-all border border-slate-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 shadow-sm" />
            </div>
            {/* Botão carrinho mobile */}
            <button
              onClick={() => { setShowCheckout(true); setSaleError(null); autoFillFirst(); }}
              disabled={cartQty === 0}
              className="lg:hidden relative h-10 px-4 rounded-xl flex items-center gap-2 text-[11px] font-black text-white shadow disabled:opacity-40"
              style={{ background: "linear-gradient(135deg, #3b82f6, #1d4ed8)" }}>
              <ShoppingCart size={14} />
              {cartQty > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-white text-blue-600 rounded-full text-[9px] font-black flex items-center justify-center shadow">{cartQty}</span>
              )}
            </button>
          </div>

          {/* Categorias + aba Serviços */}
          <div className="flex gap-1.5 overflow-x-auto pb-0.5 shrink-0 scrollbar-none">
            {/* Aba Serviços — sempre visível se houver serviços */}
            {services.length > 0 && (
              <button
                onClick={() => { setShowServicesTab(true); setSelectedCategory(null); }}
                className={cn(
                  "shrink-0 h-7 px-3 rounded-lg text-[10px] font-bold tracking-wide transition-all border flex items-center gap-1.5",
                  showServicesTab
                    ? "text-white border-violet-500 shadow"
                    : "bg-white text-slate-500 border-slate-200 hover:border-violet-300 hover:text-violet-600"
                )}
                style={showServicesTab ? { background: "linear-gradient(135deg,#7c3aed,#4f46e5)" } : {}}
              >
                <Wrench size={9} />
                Serviços
                {cartServices.length > 0 && (
                  <span className={cn("w-4 h-4 rounded-full text-[9px] font-black flex items-center justify-center",
                    showServicesTab ? "bg-white text-violet-700" : "bg-violet-600 text-white"
                  )}>{cartServices.length}</span>
                )}
              </button>
            )}
            {/* Abas de produtos */}
            {categories.length > 0 && [{ id: null as number | null, name: "Todos" }, ...categories.map(c => ({ id: c.id as number | null, name: c.name }))].map((cat) => (
              <button key={cat.id ?? "all"}
                onClick={() => { setSelectedCategory(cat.id); setShowServicesTab(false); }}
                className={cn(
                  "shrink-0 h-7 px-3 rounded-lg text-[10px] font-bold tracking-wide transition-all border flex items-center gap-1",
                  !showServicesTab && selectedCategory === cat.id
                    ? "text-white border-blue-500 shadow"
                    : "bg-white text-slate-500 border-slate-200 hover:border-blue-300 hover:text-blue-600"
                )}
                style={!showServicesTab && selectedCategory === cat.id ? { background: "linear-gradient(135deg,#3b82f6,#1d4ed8)" } : {}}>
                {cat.id !== null && <Tag size={9} />} {cat.name}
              </button>
            ))}
          </div>

          {/* Grid de produtos OU grid de serviços */}
          <div className="flex-1 overflow-y-auto pr-1 pb-2 admin-scroll">
            {showServicesTab ? (
              /* ── ABA SERVIÇOS ── */
              services.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center gap-3">
                  <Wrench size={44} className="text-slate-300" strokeWidth={1} />
                  <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">Nenhum serviço cadastrado</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-2.5">
                  {services.filter((s) => !searchTerm || s.name.toLowerCase().includes(searchTerm.toLowerCase()) || (s.category ?? "").toLowerCase().includes(searchTerm.toLowerCase())).map((svc) => {
                    const cartEntry = cartServices.find((s) => s.id === svc.id);
                    const catMeta = SERVICE_CATEGORIES.find((c) => c.value === svc.category) ?? SERVICE_CATEGORIES[SERVICE_CATEGORIES.length - 1];
                    const CatIcon = catMeta.icon;
                    const unitAbbr = SERVICE_UNITS.find((u) => u.value === svc.unit)?.abbr ?? (svc.unit ?? "un");
                    return (
                      <motion.button
                        layout
                        key={svc.id}
                        onClick={() => {
                          if (cartEntry) setCartServices((prev) => prev.filter((s) => s.id !== svc.id));
                          else setCartServices((prev) => [...prev, { ...svc, price: Number(svc.price), quantity: 1 }]);
                        }}
                        whileTap={{ scale: 0.97 }}
                        className={cn(
                          "bg-white rounded-2xl border flex flex-col items-start group relative text-left overflow-hidden transition-all duration-200",
                          cartEntry
                            ? "border-violet-400 shadow-md shadow-violet-100"
                            : "border-slate-200 hover:border-violet-300 hover:shadow-md hover:shadow-violet-50"
                        )}
                      >
                        {/* Ícone categoria */}
                        <div className={cn("w-full aspect-[4/3] flex items-center justify-center relative", catMeta.color.replace("text-", "text-").replace("bg-", "bg-"))}>
                          <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center", catMeta.color)}>
                            <CatIcon size={26} strokeWidth={1.5} />
                          </div>
                          {/* badge categoria */}
                          <div className="absolute top-2 right-2">
                            <span className={cn("text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md", catMeta.badge)}>
                              {svc.category}
                            </span>
                          </div>
                          {/* badge qty no carrinho */}
                          {cartEntry && (
                            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
                              className="absolute top-2 left-2 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black text-white shadow"
                              style={{ background: "linear-gradient(135deg,#7c3aed,#4f46e5)" }}>
                              {cartEntry.quantity ?? 1}
                            </motion.div>
                          )}
                          {/* overlay */}
                          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 bg-violet-500/10">
                            <div className="w-9 h-9 rounded-full flex items-center justify-center text-white scale-75 group-hover:scale-100 transition-transform shadow-lg"
                              style={{ background: cartEntry ? "linear-gradient(135deg,#ef4444,#dc2626)" : "linear-gradient(135deg,#7c3aed,#4f46e5)" }}>
                              {cartEntry ? <X size={14} /> : <Plus size={16} strokeWidth={2.5} />}
                            </div>
                          </div>
                        </div>

                        {/* Info */}
                        <div className="p-2.5 w-full">
                          <p className="text-[11px] font-semibold text-slate-700 leading-tight line-clamp-2 mb-1 min-h-[2.2em]">{svc.name}</p>
                          {svc.description && <p className="text-[9px] text-slate-400 truncate mb-1">{svc.description}</p>}
                          <div className="flex items-end justify-between gap-1">
                            <p className="text-[14px] font-mono font-black text-violet-600">
                              {Number(svc.price).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                            </p>
                            <span className="text-[8px] font-bold text-slate-400 flex items-center gap-0.5 pb-0.5">
                              <Ruler size={7} />/{unitAbbr}
                            </span>
                          </div>
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              )
            ) : (
              /* ── ABA PRODUTOS ── */
              loading ? (
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
                    const qtyInCart   = cart.filter((i) => i.id === product.id).reduce((a, b) => a + b.quantity, 0);
                    const atLimit     = qtyInCart >= product.stock_quantity;
                    const hasVariations = (Array.isArray(product.attributes) && product.attributes.length > 0) ||
                      (Array.isArray(product.variations) && product.variations.length > 0);
                    return (
                      <motion.button layout key={product.id}
                        onClick={() => !atLimit && addToCart(product)}
                        whileTap={atLimit ? {} : { scale: 0.97 }}
                        className={cn(
                          "bg-white rounded-2xl border flex flex-col items-start group relative text-left overflow-hidden transition-all duration-200",
                          atLimit
                            ? "opacity-40 cursor-not-allowed border-slate-200"
                            : qtyInCart > 0
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
                          {!atLimit && (
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
                          {hasVariations && <p className="text-[8px] font-black text-blue-500 uppercase tracking-widest mb-1">variações</p>}
                          <p className="text-[14px] font-mono font-black text-blue-600">R$ {Number(product.price).toFixed(2)}</p>
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              )
            )}
          </div>
        </div>

        {/* ── CARRINHO DESKTOP ─────────────────────────────────────────────── */}
        <div className="hidden lg:flex w-[360px] flex-col overflow-hidden shrink-0 border-l border-slate-200 bg-white">
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
          </div>

          {/* Itens */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-slate-50 admin-scroll">
            <AnimatePresence initial={false}>
              {/* Itens de produto */}
              {cart.map((item) => (
                <motion.div key={item.cartItemId}
                  initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20, height: 0 }}
                  transition={{ duration: 0.18 }}>
                  <div className="flex items-center gap-3 p-3 rounded-2xl border border-slate-200 bg-white hover:border-blue-200 transition-colors shadow-sm">
                    {item.image_url ? (
                      <img src={item.image_url} alt={item.name} className="w-10 h-10 rounded-xl object-contain shrink-0 border border-slate-200 p-0.5 bg-slate-50" />
                    ) : (
                      <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
                        <Package size={14} className="text-slate-400" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-bold text-slate-700 truncate leading-tight">{item.name}</p>
                      {item.variationLabel && <p className="text-[9px] font-bold text-blue-500 uppercase tracking-widest">{item.variationLabel}</p>}
                      <div className="flex items-center justify-between mt-1">
                        <p className="text-[10px] font-mono text-slate-400">R$ {item.price.toFixed(2)}</p>
                        <p className="text-[12px] font-mono font-black text-slate-800">R$ {(item.price * item.quantity).toFixed(2)}</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-center gap-1 shrink-0">
                      <div className="flex items-center gap-1 bg-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                        <button onClick={() => updateQuantity(item.cartItemId, -1)} className="p-1.5 hover:bg-slate-200 text-slate-400 hover:text-slate-700 transition-all"><Minus size={11} /></button>
                        <span className="w-6 text-center font-mono font-black text-[12px] text-slate-700">{item.quantity}</span>
                        <button onClick={() => updateQuantity(item.cartItemId, 1)} disabled={item.quantity >= item.stock_quantity} className="p-1.5 hover:bg-slate-200 text-slate-400 hover:text-slate-700 transition-all disabled:opacity-20"><Plus size={11} /></button>
                      </div>
                      <button onClick={() => removeFromCart(item.cartItemId)} className="p-1 text-slate-300 hover:text-red-500 transition-colors rounded"><Trash2 size={12} /></button>
                    </div>
                  </div>
                </motion.div>
              ))}

              {/* Itens de serviço */}
              {cartServices.map((svc) => {
                const catMeta = SERVICE_CATEGORIES.find((c) => c.value === svc.category) ?? SERVICE_CATEGORIES[SERVICE_CATEGORIES.length - 1];
                const CatIcon = catMeta.icon;
                return (
                  <motion.div key={`svc-${svc.id}`}
                    initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20, height: 0 }}
                    transition={{ duration: 0.18 }}>
                    <div className="flex items-center gap-2 p-3 rounded-2xl border border-violet-200 bg-violet-50/60 hover:border-violet-300 transition-colors shadow-sm">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border border-violet-200 ${catMeta.color}`}>
                        <CatIcon size={13} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-[8px] font-black uppercase tracking-widest text-violet-500 bg-violet-100 px-1.5 py-0.5 rounded-md">Serviço</span>
                        <p className="text-[11px] font-bold text-slate-700 truncate leading-tight mt-0.5">{svc.name}</p>
                        <p className="text-[11px] font-mono font-black text-violet-600">R$ {(Number(svc.price) * (svc.quantity ?? 1)).toFixed(2)}</p>
                      </div>
                      {/* qty controls */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => setCartServices(prev => (svc.quantity ?? 1) <= 1 ? prev.filter(s => s.id !== svc.id) : prev.map(s => s.id === svc.id ? { ...s, quantity: (s.quantity ?? 1) - 1 } : s))}
                          className="w-6 h-6 rounded-lg border border-violet-200 bg-white flex items-center justify-center text-violet-500 hover:bg-violet-100 transition-colors text-[11px] font-black">
                          −
                        </button>
                        <span className="w-5 text-center text-[11px] font-mono font-black text-slate-700">{svc.quantity ?? 1}</span>
                        <button
                          onClick={() => setCartServices(prev => prev.map(s => s.id === svc.id ? { ...s, quantity: (s.quantity ?? 1) + 1 } : s))}
                          className="w-6 h-6 rounded-lg bg-violet-600 text-white flex items-center justify-center hover:bg-violet-700 transition-colors text-[11px] font-black">
                          +
                        </button>
                      </div>
                      <button
                        onClick={() => setCartServices((prev) => prev.filter((s) => s.id !== svc.id))}
                        className="p-1 text-slate-300 hover:text-red-500 transition-colors rounded shrink-0"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>

            {cart.length === 0 && cartServices.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-slate-300 gap-4 py-16">
                <ShoppingCart size={40} strokeWidth={1} />
                <div className="text-center">
                  <p className="text-[11px] font-black uppercase tracking-[0.2em] mb-1 text-slate-400">Carrinho Vazio</p>
                  <p className="text-[10px] text-slate-400">Selecione produtos ou serviços</p>
                </div>
              </div>
            )}
          </div>

          {/* Footer do carrinho */}
          <div className="shrink-0 border-t border-slate-200 p-4 space-y-3 bg-white">
            {(cart.length > 0 || cartServices.length > 0) && (
              <div className="space-y-1.5">
                {(discountValue > 0 || surchargeValue > 0 || servicesTotal > 0) && (
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
              onClick={() => { setShowCheckout(true); setSaleError(null); autoFillFirst(); }}
              disabled={!canFinish}
              className="w-full h-13 disabled:opacity-25 text-white rounded-2xl text-[12px] font-black uppercase tracking-widest transition-all active:scale-[0.98] flex items-center justify-center gap-2.5 shadow-lg shadow-blue-200"
              style={{ height: "52px", background: "linear-gradient(135deg,#3b82f6,#1d4ed8)" }}>
              <CreditCard size={17} />
              Ir para Pagamento
              {cartQty > 0 && <span className="ml-1 bg-white/20 rounded-lg px-2 py-0.5 text-[10px] font-black">{cartQty}</span>}
            </button>
          </div>
        </div>

        {/* ── PEDIDOS RECENTES (painel lateral) ───────────────────────────── */}
        <AnimatePresence>
          {showRightPanel && (
            <motion.div initial={{ width: 0, opacity: 0 }} animate={{ width: 280, opacity: 1 }} exit={{ width: 0, opacity: 0 }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="shrink-0 border-l border-slate-200 bg-white flex flex-col overflow-hidden">
              <div className="shrink-0 px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-900">Pedidos Recentes</p>
                  <p className="text-[9px] text-slate-400 font-medium mt-0.5">Últimas 10 vendas</p>
                </div>
                <button onClick={fetchRecentOrders} disabled={loadingOrders}
                  className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-blue-600 transition-colors rounded-lg hover:bg-slate-50">
                  <RefreshCw size={12} className={loadingOrders ? "animate-spin" : ""} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto admin-scroll">
                {loadingOrders ? (
                  <div className="flex items-center justify-center h-32"><Loader2 size={20} className="animate-spin text-slate-300" /></div>
                ) : recentOrders.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-32 gap-2">
                    <Clock size={28} strokeWidth={1} className="text-slate-200" />
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Sem pedidos</p>
                  </div>
                ) : (
                  <div className="p-3 space-y-2">
                    {recentOrders.map((order) => (
                      <div key={order.id} className="bg-slate-50 border border-slate-100 rounded-xl p-3 hover:border-slate-200 transition-all">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[9px] font-black text-blue-600 uppercase tracking-widest">#{String(order.id).padStart(5,"0")}</span>
                          <span className="text-[11px] font-mono font-black text-slate-900">R$ {Number(order.total_amount).toFixed(2)}</span>
                        </div>
                        <p className="text-[10px] font-bold text-slate-700 truncate mb-1">{order.customer_name || "Consumidor Final"}</p>
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] text-slate-400 font-medium">{pmLabel(order.payment_method || "")}</span>
                          <span className="text-[9px] text-slate-400 font-medium">{new Date(order.created_at).toLocaleTimeString("pt-BR", { hour:"2-digit", minute:"2-digit" })}</span>
                        </div>
                        {Array.isArray(order.items) && order.items.length > 0 && (
                          <div className="flex gap-1 mt-2 overflow-x-auto scrollbar-none">
                            {order.items.slice(0, 4).map((item, idx) => (
                              <div key={idx} className="shrink-0 w-8 h-8 rounded-lg bg-slate-200 border border-slate-100 overflow-hidden flex items-center justify-center relative">
                                {item.image_url ? <img src={item.image_url} alt={item.product_name} className="w-full h-full object-cover" /> : <Package size={12} className="text-slate-400" />}
                                {item.quantity > 1 && <div className="absolute bottom-0 right-0 bg-blue-600 text-white text-[7px] font-black rounded-tl px-0.5 leading-none py-0.5">{item.quantity}</div>}
                              </div>
                            ))}
                            {order.items.length > 4 && <div className="shrink-0 w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-[8px] font-black text-slate-400">+{order.items.length - 4}</div>}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── VARIATION MODAL ─────────────────────────────────────────────────── */}
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
                <div className="h-36 overflow-hidden relative" style={{ background: "rgba(255,255,255,0.05)" }}>
                  {configProduct.image_url ? (
                    <img src={configProduct.image_url} alt={configProduct.name} className="w-full h-full object-cover opacity-40" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package size={40} className="text-white/10" strokeWidth={1} />
                    </div>
                  )}
                  <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, transparent 20%, #0f1623 100%)" }} />
                </div>

                {/* Thumbnail + nome */}
                <div className="absolute bottom-0 left-0 right-0 flex items-end gap-3 px-5 pb-4">
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
              <div className="px-5 pt-2 pb-4 space-y-5 max-h-[50vh] overflow-y-auto admin-scroll">
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
                                  !hasStock ? "opacity-30 cursor-not-allowed"
                                    : isSelected ? "shadow-lg shadow-blue-500/25"
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
                                  opt.stock === 0 ? "opacity-30 cursor-not-allowed"
                                    : isSelected ? "shadow-lg shadow-blue-500/25"
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

                {/* Tabela resumo de estoque por SKU */}
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
                              background: isCurrentSelection ? "rgba(59,130,246,0.12)" : "rgba(255,255,255,0.02)",
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
                  className="w-full rounded-2xl text-[12px] font-black uppercase tracking-[0.15em] text-white flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-xl shadow-blue-500/25"
                  style={{ background: "linear-gradient(135deg, #3b82f6, #1d4ed8)", height: "52px" }}>
                  <Plus size={16} strokeWidth={3} /> Adicionar ao Carrinho
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── CHECKOUT MODAL ──────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showCheckout && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => !finishing && setShowCheckout(false)}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[300]" />
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
              transition={{ type: "spring", damping: 32, stiffness: 300 }}
              className="fixed inset-x-4 bottom-4 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 z-[301] bg-white flex flex-col overflow-hidden"
              style={{
                width: "min(960px, calc(100vw - 32px))",
                height: "min(680px, calc(100vh - 48px))",
                borderRadius: "24px",
                boxShadow: "0 24px 80px rgba(0,0,0,0.18), 0 4px 16px rgba(0,0,0,0.08)",
                border: "1px solid #e2e8f0",
              }}>

              {/* ── Header ──────────────────────────────────────────────── */}
              <div className="shrink-0 flex items-center justify-between px-6 py-4 bg-white border-b border-slate-100">
                <div className="flex items-center gap-3">
                  {tenant.logo_url ? (
                    <img src={tenant.logo_url} alt={tenant.name} className="h-10 w-auto max-w-[100px] object-contain rounded-xl shrink-0" />
                  ) : (
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm"
                      style={{ background: "linear-gradient(135deg,#3b82f6,#1d4ed8)" }}>
                      <Store size={18} className="text-white" />
                    </div>
                  )}
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-[0.25em] text-blue-500">Finalizar Venda</p>
                    <h2 className="text-[16px] font-black text-slate-800 leading-tight">{tenant.name}</h2>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">{cartQty} {cartQty === 1 ? "item" : "itens"}</p>
                    <p className="text-[24px] font-mono font-black text-slate-800 leading-none">R$ {total.toFixed(2)}</p>
                  </div>
                  <button onClick={() => setShowCheckout(false)} disabled={finishing}
                    className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-all disabled:opacity-30 border border-slate-200">
                    <X size={16} className="text-slate-500" />
                  </button>
                </div>
              </div>

              {/* ── Corpo em duas colunas ────────────────────────────────── */}
              <div className="flex-1 flex overflow-hidden">

                {/* COLUNA ESQUERDA — itens, cliente, serviços, descontos, vendedores */}
                <div className="w-full sm:w-[340px] shrink-0 flex flex-col overflow-y-auto admin-scroll border-r border-slate-100 bg-slate-50">

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
                          <div className="flex items-center gap-1.5 shrink-0">
                            <div className="flex items-center gap-0.5 bg-slate-100 border border-slate-200 rounded-lg p-0.5">
                              <button onClick={() => updateQuantity(item.cartItemId, -1)} className="p-0.5 hover:bg-white rounded text-slate-500"><Minus size={9} /></button>
                              <span className="w-4 text-center font-mono font-black text-[9px] text-slate-700">{item.quantity}</span>
                              <button onClick={() => updateQuantity(item.cartItemId, 1)} disabled={item.quantity >= item.stock_quantity} className="p-0.5 hover:bg-white rounded text-slate-500 disabled:opacity-30"><Plus size={9} /></button>
                            </div>
                            <span className="text-[11px] font-mono font-black text-slate-700 w-14 text-right">R$ {(item.price * item.quantity).toFixed(2)}</span>
                            <button onClick={() => removeFromCart(item.cartItemId)} className="text-slate-300 hover:text-red-500 transition-colors ml-0.5"><Trash2 size={11} /></button>
                          </div>
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

                  {/* Cliente, Serviços, Desconto, Vendedor */}
                  <div className="p-4 space-y-4 flex-1">

                    {/* Cliente */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Cliente</label>
                        <button type="button"
                          onClick={() => { setNcName(""); setNcPhone(""); setNcDoc(""); setNcEmail(""); setNcAddr(""); setNcBirth(""); setNcCredit(""); setNcNotes(""); setNcRisk(false); setNcRiskReason(""); setShowNewCustomer(true); }}
                          className="h-6 px-2 rounded-lg bg-blue-50 border border-blue-200 text-blue-600 hover:bg-blue-100 flex items-center gap-1 transition-colors"
                          title="Cadastrar novo cliente">
                          <UserPlus size={11} />
                          <span className="text-[9px] font-black uppercase tracking-wide">Novo</span>
                        </button>
                      </div>
                      <Combobox
                        placeholder="Buscar por nome, CPF ou telefone…"
                        searchPlaceholder="Nome, CPF/CNPJ ou telefone…"
                        clearable
                        freeInput
                        value={selectedCustomerId !== null ? String(selectedCustomerId) : customerName}
                        onChange={(v) => {
                          if (!v) {
                            setSelectedCustomerId(null); setCustomerName(""); setCustomerPoints(0); setAppliedReward(null);
                            setDiscount(""); setDiscountMode("R$");
                          } else {
                            const cust = customers.find((c) => String(c.id) === v);
                            if (cust) {
                              setSelectedCustomerId(cust.id); setCustomerName(cust.name);
                              fetch(`/api/loyalty/customers/${cust.id}/points`, { headers: { Authorization: `Bearer ${token}` } })
                                .then((r) => r.json()).then((d) => setCustomerPoints(d.balance ?? 0)).catch(() => {});
                            } else {
                              setSelectedCustomerId(null); setCustomerName(v); setCustomerPoints(0); setAppliedReward(null);
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

                      {/* Loyalty panel */}
                      {selectedCustomerId && loyaltyProgram?.is_active && (
                        <div className="mt-2 bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <Star size={12} className="text-amber-500" fill="currentColor" />
                              <span className="text-[11px] font-bold text-amber-700">{customerPoints.toLocaleString("pt-BR")} pontos</span>
                            </div>
                            {appliedReward ? (
                              <button onClick={() => { if (appliedReward.type === "discount") { setDiscount(""); setDiscountMode("R$"); } setAppliedReward(null); }}
                                className="text-[10px] text-rose-500 font-bold hover:underline">Remover resgate</button>
                            ) : loyaltyRewards.filter((r) => customerPoints >= r.points_cost).length > 0 ? (
                              <span className="text-[10px] text-amber-600 font-bold">Pode resgatar!</span>
                            ) : null}
                          </div>
                          {loyaltyProgram.spend_per_point > 0 && (() => {
                            const willEarn = Math.floor(total / loyaltyProgram.spend_per_point);
                            return willEarn > 0 ? (
                              <p className="text-[10px] text-amber-600 font-medium">+{willEarn} ponto{willEarn !== 1 ? "s" : ""} ao finalizar</p>
                            ) : null;
                          })()}
                          {!appliedReward && loyaltyRewards.filter((r) => customerPoints >= r.points_cost).length > 0 && (
                            <div className="space-y-1 pt-1 border-t border-amber-200">
                              <p className="text-[9px] font-black uppercase tracking-widest text-amber-600 mb-1">Recompensas disponíveis</p>
                              {loyaltyRewards.filter((r) => customerPoints >= r.points_cost).map((r) => (
                                <button key={r.id} onClick={() => {
                                  setAppliedReward(r);
                                  if (r.type === "discount") {
                                    if (r.discount_type === "percent") { setDiscountMode("%"); setDiscount(String(r.discount_value ?? 0)); }
                                    else { setDiscountMode("R$"); setDiscount(String(r.discount_value ?? 0)); }
                                  }
                                }}
                                  className="w-full flex items-center justify-between p-2 bg-white rounded-lg border border-amber-200 text-[11px] hover:bg-amber-50 transition-colors">
                                  <span className="flex items-center gap-1.5 font-bold text-slate-700">
                                    {r.type === "product"
                                      ? <><Gift size={11} className="text-violet-500" /><span>{r.name}</span><span className="text-[9px] font-black text-violet-500 bg-violet-50 px-1.5 py-0.5 rounded-md border border-violet-200 ml-1">brinde</span></>
                                      : <><Gift size={11} className="text-amber-500" /><span>{r.name}</span>{r.discount_value && <span className="text-[9px] font-black text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-md border border-emerald-200 ml-1">{r.discount_type === "percent" ? `${r.discount_value}% off` : `R$ ${r.discount_value} off`}</span>}</>
                                    }
                                  </span>
                                  <span className="text-amber-600 font-bold shrink-0 ml-2">{r.points_cost} pts</span>
                                </button>
                              ))}
                            </div>
                          )}
                          {appliedReward && (
                            <div className={cn("flex items-center gap-2 p-2 rounded-lg border", appliedReward.type === "product" ? "bg-violet-50 border-violet-200" : "bg-emerald-50 border-emerald-200")}>
                              <Gift size={12} className={appliedReward.type === "product" ? "text-violet-500" : "text-emerald-500"} />
                              <div className="flex-1 min-w-0">
                                <p className={cn("text-[11px] font-bold", appliedReward.type === "product" ? "text-violet-700" : "text-emerald-700")}>{appliedReward.name} aplicado!</p>
                                {appliedReward.type === "product" && <p className="text-[10px] text-violet-500 font-medium">Brinde sairá do estoque ao confirmar</p>}
                              </div>
                              <span className="text-[10px] font-bold text-rose-500 shrink-0">−{appliedReward.points_cost} pts</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Vendedor */}
                    {sellers.length > 0 && (
                      <div>
                        <label className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1.5 block">Vendedor</label>
                        <div className="grid grid-cols-2 gap-1.5">
                          <button
                            onClick={() => setSelectedSellerId(null)}
                            className={cn(
                              "h-9 rounded-xl border text-[9px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1.5",
                              selectedSellerId === null
                                ? "bg-slate-900 border-slate-900 text-white shadow-sm"
                                : "bg-white border-slate-200 text-slate-500 hover:border-slate-400"
                            )}>
                            <Users size={11} /> Sem vendedor
                          </button>
                          {sellers.map((s) => (
                            <button key={s.id} onClick={() => setSelectedSellerId(s.id)}
                              className={cn(
                                "h-9 rounded-xl border text-[9px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 px-2 truncate",
                                selectedSellerId === s.id
                                  ? "bg-blue-600 border-blue-500 text-white shadow-sm shadow-blue-500/30"
                                  : "bg-white border-slate-200 text-slate-500 hover:border-blue-300"
                              )}
                              title={`${s.name} — ${Number(s.commission_rate).toFixed(1)}% comissão`}>
                              <span className="w-5 h-5 rounded-full bg-current/20 flex items-center justify-center font-black text-[8px] shrink-0">{s.name.charAt(0).toUpperCase()}</span>
                              <span className="truncate">{s.name.split(" ")[0]}</span>
                            </button>
                          ))}
                        </div>
                        {selectedSellerId && (
                          <p className="text-[9px] text-blue-500 font-bold mt-1.5">
                            Comissão: {Number(sellers.find((s) => s.id === selectedSellerId)?.commission_rate ?? 0).toFixed(1)}% = R$ {(total * Number(sellers.find((s) => s.id === selectedSellerId)?.commission_rate ?? 0) / 100).toFixed(2)}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Serviços */}
                    {services.length > 0 && (
                      <div>
                        <label className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1.5 block">Serviços</label>
                        <button type="button" onClick={() => setShowServicesModal(true)}
                          className="w-full flex items-center justify-between h-10 bg-white border border-slate-200 rounded-xl px-3 hover:border-blue-400 hover:bg-blue-50 transition-all">
                          <span className="flex items-center gap-2 text-[11px] font-bold text-slate-500">
                            <Wrench size={13} className="text-blue-500" />
                            {cartServices.length === 0 ? "Adicionar serviços" : `${cartServices.length} serviço${cartServices.length > 1 ? "s" : ""} — R$ ${servicesTotal.toFixed(2)}`}
                          </span>
                          <ChevronRight size={12} className="text-slate-300" />
                        </button>
                        {cartServices.length > 0 && (
                          <div className="mt-1.5 space-y-1">
                            {cartServices.map((s) => (
                              <div key={s.id} className="flex items-center gap-1.5 bg-violet-50 border border-violet-100 rounded-lg px-2 py-1.5">
                                <span className="flex items-center gap-1 text-[10px] font-bold text-slate-700 flex-1 min-w-0"><Wrench size={10} className="text-violet-400 shrink-0" /><span className="truncate">{s.name}</span></span>
                                <div className="flex items-center gap-1 shrink-0">
                                  <button onClick={() => setCartServices(prev => (s.quantity ?? 1) <= 1 ? prev.filter(x => x.id !== s.id) : prev.map(x => x.id === s.id ? { ...x, quantity: (x.quantity ?? 1) - 1 } : x))} className="w-4 h-4 rounded border border-violet-200 bg-white flex items-center justify-center text-violet-500 hover:bg-violet-100 text-[9px] font-black">−</button>
                                  <span className="w-4 text-center text-[9px] font-mono font-black text-slate-700">{s.quantity ?? 1}</span>
                                  <button onClick={() => setCartServices(prev => prev.map(x => x.id === s.id ? { ...x, quantity: (x.quantity ?? 1) + 1 } : x))} className="w-4 h-4 rounded bg-violet-600 text-white flex items-center justify-center text-[9px] font-black">+</button>
                                  <span className="text-[10px] font-mono font-black text-violet-600 ml-0.5">R$ {(Number(s.price) * (s.quantity ?? 1)).toFixed(2)}</span>
                                  <button onClick={() => setCartServices((prev) => prev.filter((x) => x.id !== s.id))} className="text-slate-300 hover:text-red-400 transition-colors ml-0.5"><X size={11} /></button>
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
                              <button key={m} onClick={() => { setDiscountMode(m); setDiscount(""); }}
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
                              <button key={m} onClick={() => { setSurchargeMode(m); setSurcharge(""); }}
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

                {/* COLUNA DIREITA — formas de pagamento + confirmar */}
                <div className="hidden sm:flex flex-1 flex-col overflow-hidden bg-white">
                  <div className="flex-1 overflow-y-auto p-5 space-y-3 admin-scroll">

                    {/* Label + adicionar */}
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-[9px] font-black uppercase tracking-[0.25em] text-slate-400">Formas de pagamento</p>
                      <button onClick={addPayment}
                        className="flex items-center gap-1.5 h-7 px-3 rounded-lg text-[9px] font-black uppercase tracking-wider bg-blue-50 border border-blue-200 text-blue-600 hover:bg-blue-100 transition-all">
                        <PlusCircle size={11} /> Adicionar forma
                      </button>
                    </div>

                    {payments.map((p, idx) => {
                      const feeRate = getFeeRate(p);
                      const pAmt    = Number(p.amount) || 0;
                      const pFee    = feeRate > 0 && pAmt > 0 ? pAmt * (feeRate / 100) : 0;
                      const otherPayments = paidAmount - pAmt;
                      const thisMoneyChange = p.method === "money" && pAmt > 0 ? Math.max(0, pAmt - Math.max(0, total - otherPayments)) : 0;
                      return (
                        <div key={p.id} className="bg-slate-50 rounded-2xl border border-slate-200 p-3 space-y-2.5">
                          {/* method row */}
                          <div className="flex items-center gap-2">
                            {payments.length > 1 && (
                              <span className="w-5 h-5 bg-slate-200 rounded-full flex items-center justify-center text-[9px] font-black text-slate-600 shrink-0">{idx + 1}</span>
                            )}
                            <div className="grid grid-cols-4 gap-1.5 flex-1">
                              {(["money","debit","credit","pix"] as PaymentMethod[]).map((key) => (
                                <button key={key} onClick={() => handleMethodChange(p.id, key)}
                                  className={cn("h-10 rounded-xl border text-[9px] font-black uppercase tracking-widest transition-all flex flex-col items-center justify-center gap-0.5",
                                    p.method === key
                                      ? key === "credit" ? "bg-emerald-600 border-emerald-500 text-white shadow-sm" : "bg-blue-600 border-blue-500 text-white shadow-sm"
                                      : "bg-white border-slate-200 text-slate-500 hover:border-slate-400")}>
                                  {key === "money" && <Banknote size={13} />}
                                  {key === "debit" && <CreditCard size={13} />}
                                  {key === "credit" && <CreditCard size={13} />}
                                  {key === "pix" && <QrCode size={13} />}
                                  {PM_LABEL[key]}
                                </button>
                              ))}
                            </div>
                            {payments.length > 1 && (
                              <button onClick={() => removePayment(p.id)} className="text-slate-300 hover:text-red-500 transition-colors shrink-0"><X size={14} /></button>
                            )}
                          </div>

                          {/* bandeira */}
                          {(p.method === "debit" || p.method === "credit") && (() => {
                            const activeB = CARD_BRANDS.filter((b) => enabledBrands[b.key] !== false);
                            const cols = activeB.length <= 3 ? "grid-cols-3" : activeB.length <= 4 ? "grid-cols-4" : "grid-cols-3";
                            return (
                              <div className={`grid ${cols} gap-1`}>
                                {activeB.map(({ key, label, color }) => (
                                  <button key={key} onClick={() => updatePayment(p.id, { cardBrand: key })}
                                    className={cn("h-7 rounded-lg border text-[8px] font-black uppercase tracking-widest transition-all",
                                      p.cardBrand === key ? "text-white border-transparent shadow-sm" : "bg-white border-slate-200 text-slate-500 hover:border-slate-400")}
                                    style={p.cardBrand === key ? { backgroundColor: color } : {}}>
                                    {label}
                                  </button>
                                ))}
                              </div>
                            );
                          })()}

                          {/* parcelamento */}
                          {p.method === "credit" && (() => {
                            const installOpts = Array.from({ length: maxInstallments }, (_, i) => i + 1);
                            const cols = installOpts.length <= 4 ? "grid-cols-4" : installOpts.length <= 6 ? "grid-cols-6" : "grid-cols-4";
                            return (
                              <div className={`grid ${cols} gap-1`}>
                                {installOpts.map((n) => {
                                  const rate      = cardFees[p.cardBrand]?.[n - 1] ?? 0;
                                  const pAmt2     = Number(p.amount) || 0;
                                  const totalWFee = pAmt2 > 0 && rate > 0 ? (passFeeToCustomer ? pAmt2 * (1 + rate / 100) : pAmt2) : pAmt2;
                                  const perInst   = n > 1 && pAmt2 > 0 ? totalWFee / n : 0;
                                  const isActive  = p.installments === n;
                                  return (
                                    <button key={n} onClick={() => updatePayment(p.id, { installments: n })}
                                      className={cn(
                                        "rounded-lg border transition-all flex flex-col items-center justify-center py-1.5 px-1 gap-0.5",
                                        isActive ? "bg-emerald-600 border-emerald-500 text-white shadow-sm" : "bg-white border-slate-200 text-slate-500 hover:border-slate-400"
                                      )}>
                                      <span className="text-[8px] font-black uppercase tracking-widest">{n === 1 ? "À vista" : `${n}×`}</span>
                                      {rate > 0 && (
                                        <span className={cn("text-[7px] font-bold", isActive ? "text-emerald-200" : passFeeToCustomer ? "text-blue-500" : "text-amber-500")}>
                                          {passFeeToCustomer ? `c/ ${rate}%` : `+${rate}%`}
                                        </span>
                                      )}
                                      {perInst > 0 && (
                                        <span className={cn("text-[7px] font-mono", isActive ? "text-emerald-200" : "text-slate-400")}>
                                          {n}×R${perInst.toFixed(2)}
                                        </span>
                                      )}
                                    </button>
                                  );
                                })}
                              </div>
                            );
                          })()}

                          {/* valor + troco */}
                          <div className="flex gap-2">
                            <div className="relative flex-1">
                              <Banknote className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
                              <input type="number" min="0" step="0.01"
                                placeholder={idx === 0 ? `R$ ${total > 0 ? total.toFixed(2) : "0,00"}` : "Valor (R$)"}
                                className={cn("w-full pl-9 pr-3 h-11 bg-white border rounded-xl focus:outline-none text-[13px] font-mono font-bold text-slate-800 placeholder:text-slate-400 transition-all [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none",
                                  p.method === "money" && pAmt > 0 && pAmt < (total - (paidAmount - pAmt)) ? "border-red-400 bg-red-50" : "border-slate-200 focus:border-blue-500")}
                                value={p.amount}
                                onChange={(e) => updatePayment(p.id, { amount: e.target.value })} />
                            </div>
                            {thisMoneyChange > 0.005 && (
                              <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 rounded-xl px-3 shrink-0">
                                <span className="text-[9px] font-black text-emerald-700 uppercase tracking-widest">Troco</span>
                                <span className="text-[11px] font-mono font-black text-emerald-700">R$ {thisMoneyChange.toFixed(2)}</span>
                              </div>
                            )}
                            {pFee > 0.005 && (
                              <div className="flex flex-col items-end gap-0.5 bg-amber-50 border border-amber-200 rounded-xl px-3 py-1.5 shrink-0">
                                <span className="text-[8px] font-black text-amber-600 uppercase tracking-widest">Taxa {feeRate}%</span>
                                <span className="text-[10px] font-mono font-black text-amber-700">− R$ {pFee.toFixed(2)}</span>
                                {p.installments > 1 && pAmt > 0 && (
                                  <span className="text-[7px] font-bold text-amber-500">{p.installments}× R$ {((pAmt * (1 + feeRate/100)) / p.installments).toFixed(2)}/parc</span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {/* Resumo total */}
                    <div className="rounded-2xl px-4 py-3 flex items-center justify-between bg-slate-50 border border-slate-200 shadow-sm">
                      <div>
                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-0.5">Total a pagar</p>
                        {remaining > 0.009 && <p className="text-[10px] font-bold text-amber-500">⚠ Faltam R$ {remaining.toFixed(2)}</p>}
                        {change > 0 && <p className="text-[10px] font-bold text-emerald-600">Troco R$ {change.toFixed(2)}</p>}
                      </div>
                      <span className="text-[28px] font-mono font-black text-slate-800">R$ {total.toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Botão confirmar */}
                  <div className="shrink-0 px-5 pb-5 pt-4 border-t border-slate-100 bg-white space-y-2">
                    {saleError && (
                      <div className="mb-3 px-3 py-2.5 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2">
                        <span className="text-red-500 shrink-0 mt-0.5">⚠</span>
                        <p className="text-[11px] font-bold text-red-700 leading-snug">{saleError}</p>
                      </div>
                    )}
                    {terminalResult?.status === "approved" && (
                      <div className="mb-2 px-3 py-2.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2">
                        <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                        <p className="text-[11px] font-bold text-emerald-700">
                          Aprovado na maquininha{terminalResult.brand ? ` · ${terminalResult.brand.toUpperCase()}` : ""}{terminalResult.authCode ? ` · Cód ${terminalResult.authCode}` : ""}
                        </p>
                      </div>
                    )}
                    {terminalConfigured && remaining <= 0.009 && (
                      <button
                        onClick={handleChargeTerminal}
                        disabled={!canFinish || terminalCharging || finishing}
                        className="w-full rounded-2xl text-[13px] font-black uppercase tracking-widest text-white transition-all disabled:opacity-30 active:scale-[0.98] flex items-center justify-center gap-2.5 shadow-lg"
                        style={{ height: "52px", background: "linear-gradient(135deg,#16a34a,#15803d)", boxShadow: "0 8px 24px rgba(22,163,74,0.35)" }}
                      >
                        {terminalCharging ? <Loader2 size={17} className="animate-spin" /> : <><Terminal size={17} /> Cobrar na Maquininha</>}
                      </button>
                    )}
                    <button onClick={handleFinishSale} disabled={!canFinish || finishing || terminalCharging}
                      className="w-full rounded-2xl text-[13px] font-black uppercase tracking-widest text-white transition-all disabled:opacity-30 active:scale-[0.98] flex items-center justify-center gap-2.5 shadow-lg"
                      style={{
                        height: "52px",
                        background: remaining > 0.009 ? "linear-gradient(135deg,#f59e0b,#d97706)" : "linear-gradient(135deg,#3b82f6,#1d4ed8)",
                        boxShadow: remaining > 0.009 ? "0 8px 24px rgba(245,158,11,0.35)" : "0 8px 24px rgba(59,130,246,0.35)",
                      }}>
                      {finishing ? <Loader2 size={17} className="animate-spin" /> : <><CheckCircle2 size={17} /> Confirmar Venda</>}
                    </button>
                  </div>
                </div>
              </div>

              {/* Botão confirmar mobile (só aparece em telas pequenas) */}
              <div className="sm:hidden shrink-0 px-4 pb-4 pt-3 border-t border-slate-100 bg-white space-y-2">
                {saleError && (
                  <div className="mb-2.5 px-3 py-2 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2">
                    <span className="text-red-500 shrink-0">⚠</span>
                    <p className="text-[10px] font-bold text-red-700 leading-snug">{saleError}</p>
                  </div>
                )}
                {terminalConfigured && remaining <= 0.009 && (
                  <button
                    onClick={handleChargeTerminal}
                    disabled={!canFinish || terminalCharging || finishing}
                    className="w-full h-12 rounded-2xl text-[12px] font-black uppercase tracking-widest text-white transition-all disabled:opacity-30 active:scale-[0.98] flex items-center justify-center gap-2 shadow-lg"
                    style={{ background: "linear-gradient(135deg,#16a34a,#15803d)" }}
                  >
                    {terminalCharging ? <Loader2 size={16} className="animate-spin" /> : <><Terminal size={16} /> Cobrar na Maquininha</>}
                  </button>
                )}
                <button onClick={handleFinishSale} disabled={!canFinish || finishing || terminalCharging}
                  className="w-full h-12 rounded-2xl text-[12px] font-black uppercase tracking-widest text-white transition-all disabled:opacity-30 active:scale-[0.98] flex items-center justify-center gap-2 shadow-lg"
                  style={{
                    background: remaining > 0.009 ? "linear-gradient(135deg,#f59e0b,#d97706)" : "linear-gradient(135deg,#3b82f6,#1d4ed8)",
                  }}>
                  {finishing ? <Loader2 size={16} className="animate-spin" /> : <><CheckCircle2 size={16} /> Confirmar Venda</>}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── RECEIPT MODAL ──────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showReceipt && completedSale && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-[400]"
              onClick={() => setShowReceipt(false)} />
            <motion.div
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={{ type: "spring", damping: 32, stiffness: 300 }}
              className="fixed inset-x-0 bottom-0 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 z-[401] w-full sm:w-[440px] bg-white sm:rounded-3xl rounded-t-3xl shadow-2xl flex flex-col overflow-hidden max-h-[92dvh] sm:max-h-[90vh]">

              {/* drag handle */}
              <div className="shrink-0 flex justify-center pt-3 pb-0 sm:hidden">
                <div className="w-10 h-1 rounded-full bg-emerald-300/60" />
              </div>

              {/* success header */}
              <div className="shrink-0 bg-gradient-to-br from-emerald-500 to-emerald-700 px-5 pt-4 pb-5 text-white relative overflow-hidden">
                <div className="absolute inset-0 opacity-[0.07]">
                  <div className="absolute -top-6 -right-6 w-40 h-40 bg-white rounded-full" />
                  <div className="absolute -bottom-10 -left-6 w-56 h-56 bg-white rounded-full" />
                </div>
                <div className="relative flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center">
                        <CheckCircle2 size={14} className="text-white" />
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-100">Venda Confirmada</span>
                    </div>
                    <p className="text-3xl font-mono font-black leading-none">R$ {completedSale.total.toFixed(2)}</p>
                    <p className="text-[11px] text-emerald-200 font-bold mt-1.5">
                      #{String(completedSale.orderId).padStart(5,"0")} · {completedSale.customerName || "Consumidor Final"}
                    </p>
                    {/* badges */}
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {completedSale.change > 0 && (
                        <div className="inline-flex items-center gap-1 bg-white/20 rounded-lg px-2.5 py-1">
                          <Banknote size={11} className="text-emerald-200" />
                          <span className="text-[10px] font-black text-white">Troco R$ {completedSale.change.toFixed(2)}</span>
                        </div>
                      )}
                      {completedSale.pointsEarned != null && completedSale.pointsEarned > 0 && (
                        <div className="inline-flex items-center gap-1 bg-amber-400/20 rounded-lg px-2.5 py-1">
                          <Star size={11} className="text-amber-300" fill="currentColor" />
                          <span className="text-[10px] font-black text-amber-200">+{completedSale.pointsEarned} pts</span>
                        </div>
                      )}
                      {completedSale.rewardApplied && (
                        <div className="inline-flex items-center gap-1 bg-violet-400/20 rounded-lg px-2.5 py-1">
                          <Gift size={11} className="text-violet-300" />
                          <span className="text-[10px] font-black text-violet-200">{completedSale.rewardApplied}</span>
                        </div>
                      )}
                    </div>
                    {/* payments */}
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {completedSale.payments.map((p, i) => {
                        const brand = (p.method==="debit"||p.method==="credit") && p.cardBrand!=="other" ? ` ${p.cardBrand.toUpperCase()}` : "";
                        const inst  = p.method==="credit" && p.installments>1 ? ` ${p.installments}×` : "";
                        return (
                          <div key={i} className="inline-flex items-center gap-1 bg-white/15 rounded-lg px-2 py-1">
                            <span className="text-[9px] font-black text-emerald-100">{PM_LABEL[p.method]}{brand}{inst}</span>
                            <span className="text-[9px] font-mono font-black text-white">R$ {Number(p.amount).toFixed(2)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <button onClick={() => setShowReceipt(false)}
                    className="ml-3 shrink-0 w-8 h-8 flex items-center justify-center bg-white/15 hover:bg-white/25 rounded-xl transition-all text-white">
                    <X size={16} />
                  </button>
                </div>
                {/* items strip */}
                <div className="relative mt-3 flex gap-2 overflow-x-auto scrollbar-none pb-0.5 -mx-1 px-1">
                  {completedSale.items.map((item, idx) => (
                    <div key={idx} className="shrink-0 flex items-center gap-1.5 bg-white/15 rounded-xl px-2.5 py-1.5">
                      {item.image_url ? <img src={item.image_url} className="w-5 h-5 rounded object-cover shrink-0" alt={item.name} /> : <Package size={12} className="text-emerald-200 shrink-0" />}
                      <span className="text-[10px] font-bold text-white truncate max-w-[80px]">{item.name}</span>
                      <span className="text-[10px] font-black text-emerald-200">×{item.quantity}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* actions */}
              <div className="flex-1 overflow-y-auto overscroll-contain p-4 space-y-2">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] pb-1">Emitir Comprovante</p>

                <button onClick={() => printViaIframe(buildThermalHtml(completedSale))}
                  className="w-full flex items-center gap-3.5 h-16 bg-slate-50 hover:bg-slate-100 active:scale-[0.98] border border-slate-200 rounded-2xl px-4 transition-all group">
                  <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center shrink-0 group-hover:bg-blue-600 transition-colors">
                    <Printer size={17} className="text-white" />
                  </div>
                  <div className="text-left flex-1 min-w-0">
                    <p className="text-[12px] font-black text-slate-900 uppercase tracking-wide">Nota Térmica</p>
                    <p className="text-[10px] text-slate-400 font-medium">Impressora 58mm · Cupom fiscal</p>
                  </div>
                  <ChevronRight size={15} className="text-slate-300 group-hover:text-slate-500 shrink-0" />
                </button>

                <button onClick={() => printViaIframe(buildPDFHtml(completedSale), 600)}
                  className="w-full flex items-center gap-3.5 h-16 bg-slate-50 hover:bg-slate-100 active:scale-[0.98] border border-slate-200 rounded-2xl px-4 transition-all group">
                  <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shrink-0 group-hover:bg-blue-700 transition-colors">
                    <FileText size={17} className="text-white" />
                  </div>
                  <div className="text-left flex-1 min-w-0">
                    <p className="text-[12px] font-black text-slate-900 uppercase tracking-wide">PDF Completo</p>
                    <p className="text-[10px] text-slate-400 font-medium">Nota detalhada A4 · Imprimir ou salvar</p>
                  </div>
                  <ChevronRight size={15} className="text-slate-300 group-hover:text-slate-500 shrink-0" />
                </button>

                <button onClick={() => setShowPhoneInput(!showPhoneInput)}
                  className={cn("w-full flex items-center gap-3.5 h-16 border rounded-2xl px-4 transition-all group active:scale-[0.98]",
                    showPhoneInput ? "bg-emerald-50 border-emerald-300" : "bg-slate-50 hover:bg-slate-100 border-slate-200 hover:border-slate-300")}>
                  <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors", showPhoneInput ? "bg-emerald-600" : "bg-emerald-500 group-hover:bg-emerald-600")}>
                    <MessageCircle size={17} className="text-white" />
                  </div>
                  <div className="text-left flex-1 min-w-0">
                    <p className="text-[12px] font-black text-slate-900 uppercase tracking-wide">WhatsApp</p>
                    <p className="text-[10px] text-slate-400 font-medium">Enviar comprovante por mensagem</p>
                  </div>
                  <ChevronDown size={15} className={cn("transition-transform shrink-0", showPhoneInput ? "rotate-180 text-emerald-500" : "text-slate-300 group-hover:text-slate-500")} />
                </button>

                <AnimatePresence>
                  {showPhoneInput && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                      <div className="flex gap-2 pt-1">
                        <div className="relative flex-1">
                          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                          <input type="tel" placeholder="(11) 99999-9999"
                            className="w-full pl-9 pr-4 h-12 bg-white border border-emerald-300 rounded-xl focus:outline-none focus:border-emerald-500 text-[13px] font-medium text-slate-800 placeholder:text-slate-400 transition-all"
                            value={whatsappPhone} onChange={(e) => setWhatsappPhone(e.target.value)} />
                        </div>
                        <button onClick={() => {
                          const cleaned = whatsappPhone.replace(/\D/g, "");
                          const full = cleaned.startsWith("55") ? cleaned : `55${cleaned}`;
                          window.open(`https://wa.me/${full}?text=${encodeURIComponent(buildWhatsAppText(completedSale))}`, "_blank", "noopener,noreferrer");
                        }}
                          disabled={whatsappPhone.replace(/\D/g, "").length < 10}
                          className="h-12 px-5 bg-emerald-600 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-xl font-black text-[11px] uppercase tracking-widest flex items-center gap-2 transition-all hover:bg-emerald-700 disabled:cursor-not-allowed shrink-0 shadow-lg shadow-emerald-500/25 active:scale-95">
                          <MessageCircle size={14} /> Enviar
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="shrink-0 px-4 pb-5 pt-2">
                <button onClick={() => setShowReceipt(false)}
                  className="w-full h-12 border border-slate-200 rounded-2xl text-[11px] font-black text-slate-500 uppercase tracking-widest hover:bg-slate-50 active:scale-[0.98] transition-all">
                  Fechar
                </button>
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
              key="svc-backdrop"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[310]"
              onClick={() => setShowServicesModal(false)}
            />
            <motion.div
              key="svc-panel"
              initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              className="fixed right-0 top-0 h-full w-full max-w-sm bg-white shadow-2xl z-[320] flex flex-col"
            >
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <div className="flex items-center gap-2">
                  <Wrench size={15} className="text-blue-600" />
                  <span className="text-[11px] font-black text-slate-900 uppercase tracking-widest">Serviços</span>
                </div>
                <button onClick={() => setShowServicesModal(false)} className="w-8 h-8 rounded-lg border border-slate-200 bg-white flex items-center justify-center text-slate-400 hover:text-slate-700 transition-all">
                  <X size={14} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto admin-scroll">
                {(() => {
                  // group services by category
                  const catMap = new Map<string, typeof services>();
                  services.forEach((svc) => {
                    const key = svc.category || "Geral";
                    if (!catMap.has(key)) catMap.set(key, []);
                    catMap.get(key)!.push(svc);
                  });
                  const unitAbbr = (v?: string) => SERVICE_UNITS.find((u) => u.value === (v ?? "unidade"))?.abbr ?? (v ?? "un");
                  return [...catMap.entries()].map(([cat, items]) => {
                    const meta = SERVICE_CATEGORIES.find((c) => c.value === cat) ?? SERVICE_CATEGORIES[SERVICE_CATEGORIES.length - 1];
                    const Icon = meta.icon;
                    return (
                      <div key={cat}>
                        {/* category header */}
                        <div className={`px-4 py-2 flex items-center gap-2 border-b border-slate-100 ${meta.color} bg-opacity-40`}>
                          <Icon size={11} />
                          <span className="text-[9px] font-black uppercase tracking-widest">{cat}</span>
                          <span className="text-[9px] opacity-60">{items.length}</span>
                        </div>
                        {items.map((svc) => {
                          const inCart = cartServices.some((s) => s.id === svc.id);
                          return (
                            <div key={svc.id} className={cn("px-4 py-3 flex items-center gap-3 border-b border-slate-50 hover:bg-slate-50/70 transition-colors", inCart && "bg-blue-50/40")}>
                              <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${meta.color}`}>
                                <Icon size={13} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-[11px] font-bold text-slate-900 truncate">{svc.name}</p>
                                {svc.description && <p className="text-[9px] text-slate-400 truncate leading-tight">{svc.description}</p>}
                                <div className="flex items-center gap-2 mt-0.5">
                                  <p className="text-[11px] font-mono font-black text-blue-600">{Number(svc.price).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</p>
                                  <span className="text-[8px] text-slate-400 font-bold flex items-center gap-0.5">
                                    <Ruler size={7} />/{unitAbbr(svc.unit)}
                                  </span>
                                </div>
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
                                {inCart ? <X size={12} /> : <Plus size={12} />}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    );
                  });
                })()}
              </div>

              <div className="px-5 py-4 border-t border-slate-100 space-y-2">
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

      {/* New Customer Drawer */}
      <AnimatePresence>
        {showNewCustomer && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowNewCustomer(false)}
              className="fixed inset-0 bg-slate-900/60 z-[500] backdrop-blur-sm" />
            <motion.div
              initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 26, stiffness: 200 }}
              className="fixed inset-y-0 right-0 w-full max-w-sm bg-white z-[510] shadow-2xl flex flex-col">
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 shrink-0">
                <div>
                  <h2 className="font-black text-slate-900 text-[15px]">Novo Cliente</h2>
                  <p className="text-[11px] text-slate-500">Cadastro CRM</p>
                </div>
                <button onClick={() => setShowNewCustomer(false)} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500"><X size={18} /></button>
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
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">Endereço</label>
                  <input value={ncAddr} onChange={(e) => setNcAddr(e.target.value)} placeholder="Rua, Cidade - UF"
                    className="w-full h-9 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">Data de Aniversário</label>
                  <input type="date" value={ncBirth} onChange={(e) => setNcBirth(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">Limite de Crédito (R$)</label>
                  <input type="number" min={0} value={ncCredit} onChange={(e) => setNcCredit(e.target.value)} placeholder="0,00"
                    className="w-full h-9 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">Observações</label>
                  <textarea value={ncNotes} onChange={(e) => setNcNotes(e.target.value)} rows={2} placeholder="Preferências, anotações gerais…"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
                </div>
                <div className={cn("rounded-xl border p-3 space-y-2 transition-colors", ncRisk ? "bg-rose-50 border-rose-200" : "bg-slate-50 border-slate-200")}>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={ncRisk} onChange={(e) => setNcRisk(e.target.checked)} className="w-4 h-4 accent-rose-500" />
                    <span className={cn("text-[12px] font-black", ncRisk ? "text-rose-600" : "text-slate-600")}>⚠ Marcar como Cliente de Risco</span>
                  </label>
                  {ncRisk && (
                    <textarea value={ncRiskReason} onChange={(e) => setNcRiskReason(e.target.value)} rows={2} placeholder="Motivo do risco…"
                      className="w-full px-3 py-2 rounded-lg border border-rose-200 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400 resize-none bg-white" />
                  )}
                </div>
              </div>
              <div className="border-t border-slate-200 px-5 py-4 shrink-0 bg-slate-50 flex gap-2">
                <button onClick={() => setShowNewCustomer(false)}
                  className="flex-1 h-9 rounded-lg border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-100">Cancelar</button>
                <button disabled={savingNC || !ncName.trim()} onClick={async () => {
                  if (!ncName.trim()) return;
                  setSavingNC(true);
                  try {
                    const res = await fetch("/api/customers", {
                      method: "POST",
                      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                      body: JSON.stringify({
                        name: ncName, phone: ncPhone.replace(/\D/g, "") || null, document: ncDoc.replace(/\D/g, "") || null,
                        email: ncEmail || null, address: ncAddr || null, birth_date: ncBirth || null,
                        credit_limit: ncCredit ? Number(ncCredit) : null, notes: ncNotes || null,
                        risk_flag: ncRisk, risk_reason: ncRiskReason || null,
                      }),
                    });
                    const newCust = await res.json();
                    fetch("/api/customers", { headers: { Authorization: `Bearer ${token}` } })
                      .then((r) => r.json()).then((d) => setCustomers(Array.isArray(d) ? d : [])).catch(() => {});
                    setSelectedCustomerId(newCust.id); setCustomerName(newCust.name); setCustomerPoints(0);
                    setShowNewCustomer(false);
                  } finally { setSavingNC(false); }
                }}
                  className="flex-1 h-9 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 disabled:opacity-50 transition-all">
                  {savingNC ? "Cadastrando…" : "Criar Cliente"}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
