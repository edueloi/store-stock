import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  Search, ShoppingCart, Plus, Minus, Trash2, User, CreditCard,
  Banknote, Percent, CheckCircle2, Package, X, QrCode, Tag,
  Loader2, ExternalLink, RefreshCw, ChevronRight,
  Printer, FileText, MessageCircle, Phone, Clock, Receipt,
  ChevronDown, PlusCircle, Users, Barcode,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Product, Category } from "../../types";
import { cn } from "../../lib/utils";

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
  const [configProduct, setConfigProduct] = useState<Product | null>(null);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const [showCheckout, setShowCheckout] = useState(false);

  // checkout fields
  const [customerName, setCustomerName] = useState("");
  const [cardFees, setCardFees]         = useState<Record<string, number[]>>({});
  const [discount, setDiscount]         = useState("");
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
        setTenant({
          name:          d?.name          || "BoxSys Store",
          address:       d?.address       || "",
          whatsapp:      d?.whatsapp      || "",
          logo_url:      d?.logo_url      || "",
          primary_color: d?.primary_color || "#2563eb",
        });
      })
      .catch(() => {});
    fetch("/api/sellers", { headers })
      .then((r) => r.json())
      .then((d) => setSellers(Array.isArray(d) ? d.filter((s: any) => s.is_active) : []))
      .catch(() => {});
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
        if (existing.quantity >= product.stock_quantity) return prev;
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
      if (existing.quantity >= product.stock_quantity) return;
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
      if (nq > item.stock_quantity) return item;
      return { ...item, quantity: nq };
    }).filter(Boolean));
  };

  const removeFromCart = (cartItemId: string) => setCart(cart.filter((i) => i.cartItemId !== cartItemId));

  // ── totals ────────────────────────────────────────────────────────────────────
  const subtotal      = cart.reduce((a, b) => a + b.price * b.quantity, 0);
  const discountValue = Math.min(Number(discount) || 0, subtotal);
  const baseTotal     = subtotal - discountValue;

  // taxa interna da maquininha — custo da loja, não cobrado do cliente
  const creditPayments = payments.filter((p) => p.method === "credit");
  const feeAmount      = creditPayments.reduce((sum, p) => {
    const rate = cardFees[p.cardBrand]?.[p.installments - 1] ?? 0;
    if (!rate) return sum;
    const pAmt = Number(p.amount) || 0;
    return sum + pAmt * (rate / 100);
  }, 0);

  // cliente paga o valor sem acréscimo de taxa
  const total = baseTotal;

  // quanto já foi preenchido nos pagamentos
  const paidAmount   = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const remaining    = Math.max(0, total - paidAmount);
  const moneyPayment = payments.find((p) => p.method === "money");
  const moneyAmt     = Number(moneyPayment?.amount) || 0;
  const change       = moneyAmt > 0 && paidAmount >= total ? moneyAmt - (total - (paidAmount - moneyAmt)) : 0;

  const cartQty = cart.reduce((a, b) => a + b.quantity, 0);

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
      if (ps.length === 1 && !ps[0].amount && total > 0) {
        return [{ ...ps[0], amount: total.toFixed(2) }];
      }
      return ps;
    });
  };

  // permite confirmar mesmo com valor menor (saldo devedor aceito)
  const canFinish = cart.length > 0 && total > 0;

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
    const payLines = buildPaymentLines(sale);

    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Cupom #${orderId}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Courier New', Courier, monospace; font-size: 12px; width: 302px; margin: 0 auto; padding: 12px 10px; background: #fff; color: #000; }
  .center { text-align: center; }
  .bold { font-weight: bold; }
  .divider { border: none; border-top: 1px dashed #000; margin: 6px 0; }
  .divider-solid { border: none; border-top: 2px solid #000; margin: 6px 0; }
  .row { display: flex; justify-content: space-between; margin: 2px 0; font-size: 11px; }
  .row-total { display: flex; justify-content: space-between; font-size: 14px; font-weight: bold; margin: 4px 0; }
  .item-line { margin: 4px 0; }
  .item-qty { font-size: 11px; color: #333; margin-top: 1px; }
  .small { font-size: 10px; color: #555; margin-top: 12px; line-height: 1.6; text-align: center; }
  @media print { @page { margin: 0; size: 80mm auto; } body { padding: 8px 6px; } }
</style></head><body>
<div class="center bold" style="font-size:13px;letter-spacing:1px;text-transform:uppercase">${sale.tenantName}</div>
${sale.tenantAddress ? `<div class="center" style="font-size:10px;color:#555;margin-top:2px">${sale.tenantAddress}</div>` : ""}
<hr class="divider" style="margin-top:8px"/>
<div class="center bold" style="font-size:11px;letter-spacing:2px">CUPOM NÃO FISCAL</div>
<div class="center" style="font-size:11px">NF-${orderId}</div>
<hr class="divider"/>
<div class="center" style="font-size:11px">${now}</div>
<hr class="divider"/>
<div class="row"><span class="bold">CLIENTE</span></div>
<div style="font-size:11px;margin:2px 0">${sale.customerName || "CONSUMIDOR FINAL"}</div>
<hr class="divider"/>
<div class="center bold" style="font-size:11px;letter-spacing:2px;margin-bottom:4px">ITENS</div>
${sale.items.map((item) => `
<div class="item-line">
  <div class="bold" style="font-size:11px;text-transform:uppercase">${item.name}</div>
  <div class="row item-qty">
    <span>${item.quantity},00 x R$ ${item.price.toFixed(2)}</span>
    <span class="bold">R$ ${(item.price * item.quantity).toFixed(2)}</span>
  </div>
</div>`).join("")}
<hr class="divider"/>
<div class="row"><span class="bold">QTD DE ITENS:</span><span>${sale.items.reduce((a, b) => a + b.quantity, 0)}</span></div>
${sale.discountValue > 0 ? `<div class="row"><span>SUBTOTAL</span><span>R$ ${sale.subtotal.toFixed(2)}</span></div><div class="row"><span>DESCONTO</span><span>- R$ ${sale.discountValue.toFixed(2)}</span></div>` : ""}
<hr class="divider-solid"/>
<div class="row-total"><span>TOTAL R$:</span><span>R$ ${sale.total.toFixed(2)}</span></div>
<hr class="divider-solid"/>
${sale.payments.map((p) => {
  const brand = (p.method === "debit" || p.method === "credit") && p.cardBrand !== "other" ? `/${p.cardBrand.toUpperCase()}` : "";
  const inst  = p.method === "credit" && p.installments > 1 ? ` ${p.installments}X` : "";
  const label = `${PM_LABEL[p.method]}${brand}${inst}`.toUpperCase();
  return `<div class="row"><span class="bold">PAGAMENTO:</span><span>${label}</span></div><div class="row"><span></span><span class="bold">R$ ${Number(p.amount).toFixed(2)}</span></div>`;
}).join('<hr class="divider"/>')}
${change > 0 ? `<hr class="divider"/><div class="row bold"><span>TROCO:</span><span>R$ ${change.toFixed(2)}</span></div>` : ""}
<hr class="divider"/>
<div class="center bold" style="font-size:11px;letter-spacing:1px;margin:6px 0">OBRIGADO PELA PREFERÊNCIA!</div>
<div class="center" style="font-size:11px">VOLTE SEMPRE</div>
<p class="small">Este não é um documento fiscal<br/>Emitido em ${now}</p>
</body></html>`;
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
          items: cart.map((i) => ({ id: i.id, quantity: i.quantity, price: i.price })),
          customerName,
          totalAmount: total,
          paymentMethod: pmString,
          discount: discountValue,
          sellerId: selectedSellerId ?? undefined,
        }),
      });
      if (res.ok) {
        const data = await res.json();
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
          cardFees,
        };
        setCompletedSale(sale);
        setCart([]); setCustomerName(""); setDiscount("");
        setPayments([newPayment()]); setSelectedSellerId(null);
        setShowCheckout(false);
        setShowReceipt(true);
        setWhatsappPhone(""); setShowPhoneInput(false);
        fetch("/api/products", { headers: { Authorization: `Bearer ${token}` } })
          .then((r) => r.json()).then((d) => setProducts(Array.isArray(d) ? d : []));
        fetchRecentOrders();
      }
    } catch (e) { console.error("Sale failed", e); }
    finally { setFinishing(false); }
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
    if (!p.is_active || p.stock_quantity <= 0) return false;
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
    <div className="h-full flex overflow-hidden bg-[#f8fafc]">

      {/* ── LEFT: products area ─────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* TOOLBAR */}
        <div className="shrink-0 flex gap-2 items-center px-4 pt-3 pb-2">
          {/* ── Scanner de código de barras ── */}
          <div className="relative shrink-0">
            <Barcode
              className={cn(
                "absolute left-3 top-1/2 -translate-y-1/2 transition-colors",
                scanFeedback === "ok"  ? "text-emerald-500" :
                scanFeedback === "err" ? "text-red-500" :
                "text-slate-400"
              )}
              size={13}
            />
            <input
              ref={scanInputRef}
              type="text"
              placeholder="ESCANEAR..."
              className={cn(
                "w-36 pl-9 pr-2 h-10 border rounded-xl outline-none text-[10px] font-mono font-bold uppercase tracking-widest placeholder:text-slate-300 transition-all",
                scanFeedback === "ok"  ? "bg-emerald-50 border-emerald-400 text-emerald-700" :
                scanFeedback === "err" ? "bg-red-50 border-red-400 text-red-600" :
                "bg-white border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              )}
              value={scanCode}
              onChange={(e) => setScanCode(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleScan(scanCode);
                }
              }}
              title="Leitor de código de barras — pressione Enter ou use o leitor USB"
            />
          </div>

          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
            <input type="text" placeholder="PESQUISAR PRODUTO..."
              className="w-full pl-9 pr-4 h-10 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-[10px] font-bold uppercase tracking-widest placeholder:text-slate-300 transition-all"
              value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
          <button onClick={refreshProducts} title="Atualizar"
            className="h-10 w-10 flex items-center justify-center bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-blue-600 hover:border-blue-300 transition-all shrink-0">
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
          <button onClick={() => { setShowRightPanel(!showRightPanel); if (!showRightPanel) fetchRecentOrders(); }}
            className={cn("h-10 w-10 flex items-center justify-center border rounded-xl transition-all shrink-0",
              showRightPanel ? "bg-slate-900 border-slate-900 text-white" : "bg-white border-slate-200 text-slate-400 hover:text-blue-600 hover:border-blue-300")}
            title="Pedidos Recentes">
            <Receipt size={14} />
          </button>
          <button onClick={() => window.open("/pdv", "_blank", "noopener,noreferrer")}
            className="h-10 px-3 flex items-center gap-2 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 transition-all shrink-0 shadow-lg">
            <ExternalLink size={13} /><span className="hidden sm:block">PDV Externo</span>
          </button>
        </div>

        {/* CATEGORIES */}
        {categories.length > 0 && (
          <div className="shrink-0 flex gap-2 overflow-x-auto px-4 pb-2 scrollbar-none">
            <button onClick={() => setSelectedCategory(null)}
              className={cn("shrink-0 h-8 px-4 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all border",
                selectedCategory === null ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-400 border-slate-200 hover:border-slate-400")}>
              Todos
            </button>
            {categories.map((cat) => (
              <button key={cat.id} onClick={() => setSelectedCategory(cat.id === selectedCategory ? null : cat.id)}
                className={cn("shrink-0 h-8 px-4 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all border flex items-center gap-1.5",
                  selectedCategory === cat.id ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-400 border-slate-200 hover:border-slate-400")}>
                <Tag size={10} />{cat.name}
              </button>
            ))}
          </div>
        )}

        {/* PRODUCT GRID */}
        <div className="flex-1 overflow-y-auto px-4 pb-2 admin-scroll">
          {loading ? (
            <div className="h-full flex items-center justify-center"><Loader2 size={28} className="animate-spin text-slate-300" /></div>
          ) : filteredProducts.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center gap-3">
              <Package size={40} strokeWidth={1} className="text-slate-200" />
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Nenhum produto encontrado</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
              {filteredProducts.map((product) => {
                const qtyInCart = cart.filter((i) => i.id === product.id).reduce((a, b) => a + b.quantity, 0);
                const atLimit   = qtyInCart >= product.stock_quantity;
                return (
                  <motion.button layout key={product.id} onClick={() => !atLimit && addToCart(product)}
                    className={cn("bg-white p-3 rounded-2xl border shadow-sm transition-all flex flex-col items-start group relative text-left",
                      atLimit ? "border-slate-100 opacity-40 cursor-not-allowed"
                        : qtyInCart > 0 ? "border-blue-400 shadow-blue-100 shadow-md ring-1 ring-blue-300/50 cursor-pointer"
                        : "border-slate-200 hover:border-blue-400 hover:shadow-md cursor-pointer")}>
                    <div className="w-full aspect-square bg-slate-50 rounded-xl border border-slate-100 mb-2 overflow-hidden flex items-center justify-center relative">
                      {product.image_url
                        ? <img src={product.image_url} alt={product.name} className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-300" />
                        : <Package size={24} className="text-slate-200" />}
                      <div className="absolute top-1.5 right-1.5 bg-slate-900/80 border border-slate-700/50 text-white px-1.5 py-0.5 rounded-md text-[8px] font-mono font-bold">{product.stock_quantity}</div>
                      {qtyInCart > 0 && (
                        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
                          className="absolute top-1.5 left-1.5 bg-blue-600 text-white w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black shadow-lg shadow-blue-500/30">
                          {qtyInCart}
                        </motion.div>
                      )}
                      {!atLimit && (
                        <div className="absolute inset-0 bg-blue-600/0 group-hover:bg-blue-600/8 transition-colors flex items-center justify-center">
                          <div className="opacity-0 group-hover:opacity-100 transition-all bg-blue-600 text-white rounded-full w-8 h-8 flex items-center justify-center shadow-xl scale-75 group-hover:scale-100">
                            <Plus size={14} strokeWidth={3} />
                          </div>
                        </div>
                      )}
                    </div>
                    <p className="text-[10px] font-bold text-slate-900 uppercase truncate w-full leading-tight mb-0.5">{product.name}</p>
                    {((Array.isArray(product.attributes) && product.attributes.length > 0) || (Array.isArray(product.variations) && product.variations.length > 0)) && (
                      <p className="text-[8px] font-black text-blue-500 uppercase tracking-widest mb-0.5">Variações</p>
                    )}
                    <p className="text-[11px] font-mono font-black text-blue-600">R$ {Number(product.price).toFixed(2)}</p>
                  </motion.button>
                );
              })}
            </div>
          )}
        </div>

        {/* CART BAR */}
        <div className="shrink-0 bg-white border-t border-slate-200 px-4 py-3 flex items-center gap-3 shadow-[0_-4px_16px_rgba(0,0,0,0.06)]">
          <div className="flex-1 flex items-center gap-2 overflow-x-auto scrollbar-none">
            {cartQty === 0 ? (
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Carrinho vazio — clique nos produtos para adicionar</p>
            ) : (
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center bg-blue-600 rounded-lg shrink-0"><ShoppingCart size={15} className="text-white" /></div>
                <div>
                  <p className="text-[11px] font-black text-slate-900 leading-none">{cartQty} {cartQty === 1 ? "item" : "itens"}</p>
                  <p className="text-[10px] font-mono font-black text-blue-600 leading-none mt-0.5">R$ {subtotal.toFixed(2)}</p>
                </div>
                <div className="flex gap-1.5 ml-2 overflow-x-auto scrollbar-none">
                  {cart.map((item) => (
                    <div key={item.cartItemId} className="shrink-0 flex items-center gap-1 bg-slate-100 border border-slate-200 rounded-lg px-2 h-7">
                      <span className="text-[9px] font-bold text-slate-600 uppercase truncate max-w-[80px]">{item.name}</span>
                      <span className="text-[9px] font-black text-blue-600">×{item.quantity}</span>
                      <button onClick={() => removeFromCart(item.cartItemId)} className="text-slate-400 hover:text-red-500 transition-colors ml-0.5"><X size={10} /></button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <button disabled={cartQty === 0}
            onClick={() => { setShowCheckout(true); autoFillFirst(); }}
            className="shrink-0 h-10 px-5 bg-blue-600 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-xl text-[11px] font-black uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-blue-500/25 hover:bg-blue-700 transition-all active:scale-95 disabled:shadow-none disabled:cursor-not-allowed">
            <CreditCard size={15} />Finalizar Venda{cartQty > 0 && <ChevronRight size={14} />}
          </button>
        </div>
      </div>

      {/* ── RIGHT PANEL: pedidos recentes ──────────────────────────────────── */}
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

      {/* ── VARIATION MODAL ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {configProduct && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-sm rounded-[32px] overflow-hidden shadow-2xl border border-slate-200">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <p className="text-[9px] font-black text-blue-600 uppercase tracking-[0.2em] mb-1">Configurar Produto</p>
                  <h3 className="text-xs font-black uppercase text-slate-900">{configProduct.name}</h3>
                </div>
                <button onClick={() => setConfigProduct(null)} className="p-2 hover:bg-slate-50 rounded-full text-slate-400"><X size={20} /></button>
              </div>
              <div className="p-6 space-y-6">
                {Array.isArray(configProduct.attributes) && configProduct.attributes.length > 0
                  ? configProduct.attributes.map((attr, aIdx) => (
                      <div key={aIdx} className="space-y-3">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">{attr.name}</label>
                        <div className="flex flex-wrap gap-2">
                          {attr.values.map((val, vIdx) => {
                            const cur = { ...selectedOptions, [attr.name]: val };
                            const sku = configProduct.skus?.find((s) => Object.entries(s.combo).every(([k, v]) => cur[k] === v));
                            const ok  = !sku || sku.stock > 0;
                            return (
                              <button key={vIdx} disabled={!ok} onClick={() => setSelectedOptions({ ...selectedOptions, [attr.name]: val })}
                                className={cn("px-4 h-10 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all border",
                                  !ok ? "opacity-40 cursor-not-allowed line-through bg-slate-50 border-slate-100 text-slate-400"
                                    : selectedOptions[attr.name] === val ? "bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-500/20"
                                    : "bg-slate-50 text-slate-500 border-slate-200 hover:border-slate-400")}>
                                {val}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))
                  : configProduct.variations?.map((variation, vIdx) => (
                      <div key={vIdx} className="space-y-3">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">{variation.name}</label>
                        <div className="flex flex-wrap gap-2">
                          {variation.options.map((opt, oIdx) => (
                            <button key={oIdx} disabled={opt.stock === 0} onClick={() => setSelectedOptions({ ...selectedOptions, [variation.name]: opt.value })}
                              className={cn("px-4 h-10 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all border",
                                opt.stock === 0 ? "opacity-40 cursor-not-allowed line-through bg-slate-50 border-slate-100 text-slate-400"
                                  : selectedOptions[variation.name] === opt.value ? "bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-500/20"
                                  : "bg-slate-50 text-slate-500 border-slate-200 hover:border-slate-400")}>
                              {opt.value}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
              </div>
              <div className="p-6 bg-slate-50 border-t border-slate-100">
                <button onClick={() => addToCart(configProduct, selectedOptions)}
                  className="w-full h-14 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl hover:bg-black transition-all flex items-center justify-center gap-3">
                  Confirmar Escolha <Plus size={16} strokeWidth={3} />
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── CHECKOUT MODAL ──────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showCheckout && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowCheckout(false)}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[300]" />
            <motion.div
              initial={{ opacity: 0, y: 40, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 40, scale: 0.97 }}
              transition={{ type: "spring", damping: 28, stiffness: 240 }}
              className="fixed inset-x-0 bottom-0 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 z-[301] w-full sm:w-[500px] bg-white sm:rounded-3xl rounded-t-3xl shadow-2xl flex flex-col overflow-hidden max-h-[92vh]">

              {/* header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
                <div>
                  <h2 className="text-[12px] font-black uppercase tracking-widest text-slate-900">Finalizar Venda</h2>
                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                    {cartQty} {cartQty === 1 ? "item" : "itens"} · R$ {subtotal.toFixed(2)}
                  </p>
                </div>
                <button onClick={() => setShowCheckout(false)} className="p-2 hover:bg-slate-100 rounded-xl text-slate-400"><X size={18} /></button>
              </div>

              <div className="flex-1 overflow-y-auto admin-scroll p-5 space-y-4">
                {/* itens */}
                <div className="bg-slate-50 rounded-2xl p-3 space-y-1.5">
                  {cart.map((item) => (
                    <div key={item.cartItemId} className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="flex h-6 w-6 items-center justify-center bg-slate-200 rounded-md text-[9px] font-black text-slate-600 shrink-0">{item.quantity}</div>
                        <div className="min-w-0">
                          <p className="text-[10px] font-bold text-slate-800 uppercase truncate">{item.name}</p>
                          {item.variationLabel && <p className="text-[8px] text-blue-500 font-bold uppercase">{item.variationLabel}</p>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="flex items-center gap-0.5 bg-white border border-slate-200 rounded-lg p-0.5">
                          <button onClick={() => updateQuantity(item.cartItemId, -1)} className="p-1 hover:bg-slate-50 rounded text-slate-500"><Minus size={9} /></button>
                          <span className="w-5 text-center font-mono font-black text-[10px] text-slate-800">{item.quantity}</span>
                          <button onClick={() => updateQuantity(item.cartItemId, 1)} disabled={item.quantity >= item.stock_quantity} className="p-1 hover:bg-slate-50 rounded text-slate-500 disabled:opacity-30"><Plus size={9} /></button>
                        </div>
                        <p className="text-[11px] font-mono font-black text-slate-900 w-16 text-right">R$ {(item.price * item.quantity).toFixed(2)}</p>
                        <button onClick={() => removeFromCart(item.cartItemId)} className="text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={13} /></button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* cliente */}
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                  <input type="text" placeholder="Nome do cliente (opcional)"
                    className="w-full pl-9 pr-4 h-10 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 text-[11px] font-medium text-slate-800 placeholder:text-slate-400 transition-all"
                    value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
                </div>

                {/* desconto */}
                <div className="relative">
                  <Percent className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                  <input type="number" min="0" placeholder="Desconto (R$)"
                    className="w-full pl-9 pr-4 h-10 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 text-[11px] font-medium text-slate-800 placeholder:text-slate-400 transition-all [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                    value={discount} onChange={(e) => setDiscount(e.target.value)} />
                </div>

                {/* ── VENDEDOR ────────────────────────────────────────────── */}
                {sellers.length > 0 && (
                  <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Vendedor Responsável</p>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        onClick={() => setSelectedSellerId(null)}
                        className={cn(
                          "h-9 rounded-xl border text-[9px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1.5",
                          selectedSellerId === null
                            ? "bg-slate-900 border-slate-900 text-white shadow-sm"
                            : "bg-white border-slate-200 text-slate-500 hover:border-slate-400"
                        )}
                      >
                        <Users size={11} /> Sem vendedor
                      </button>
                      {sellers.map((s) => (
                        <button
                          key={s.id}
                          onClick={() => setSelectedSellerId(s.id)}
                          className={cn(
                            "h-9 rounded-xl border text-[9px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 px-2 truncate",
                            selectedSellerId === s.id
                              ? "bg-blue-600 border-blue-500 text-white shadow-sm shadow-blue-500/30"
                              : "bg-white border-slate-200 text-slate-500 hover:border-blue-300"
                          )}
                          title={`${s.name} — ${Number(s.commission_rate).toFixed(1)}% comissão`}
                        >
                          <span className="w-5 h-5 rounded-full bg-current/20 flex items-center justify-center font-black text-[8px] shrink-0">
                            {s.name.charAt(0).toUpperCase()}
                          </span>
                          <span className="truncate">{s.name.split(" ")[0]}</span>
                        </button>
                      ))}
                    </div>
                    {selectedSellerId && (
                      <p className="text-[9px] text-blue-500 font-bold mt-1.5">
                        Comissão: {Number(sellers.find((s) => s.id === selectedSellerId)?.commission_rate ?? 0).toFixed(1)}% sobre R$ {total.toFixed(2)} = R$ {(total * Number(sellers.find((s) => s.id === selectedSellerId)?.commission_rate ?? 0) / 100).toFixed(2)}
                      </p>
                    )}
                  </div>
                )}

                {/* ── PAYMENTS ────────────────────────────────────────────── */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Formas de Pagamento</p>
                    <button onClick={addPayment}
                      className="flex items-center gap-1.5 h-7 px-3 bg-blue-50 border border-blue-200 rounded-lg text-[9px] font-black text-blue-600 uppercase tracking-widest hover:bg-blue-100 transition-all">
                      <PlusCircle size={11} /> Adicionar
                    </button>
                  </div>

                  {payments.map((p, idx) => {
                    const feeRate = p.method === "credit" ? (cardFees[p.cardBrand]?.[p.installments - 1] ?? 0) : 0;
                    const pAmt    = Number(p.amount) || 0;
                    // taxa interna da maquininha (não é cobrada do cliente)
                    const pFee    = p.method === "credit" && feeRate > 0 && pAmt > 0 ? pAmt * (feeRate / 100) : 0;
                    // troco desse pagamento específico: quanto dinheiro sobra apenas desse item
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
                              <button key={key} onClick={() => updatePayment(p.id, { method: key, installments: 1 })}
                                className={cn("h-9 rounded-xl border text-[9px] font-black uppercase tracking-widest transition-all flex flex-col items-center justify-center gap-0.5",
                                  p.method === key
                                    ? key === "credit" ? "bg-emerald-600 border-emerald-500 text-white shadow-sm" : "bg-blue-600 border-blue-500 text-white shadow-sm"
                                    : "bg-white border-slate-200 text-slate-500 hover:border-slate-400")}>
                                {key === "money" && <Banknote size={12} />}
                                {key === "debit" && <CreditCard size={12} />}
                                {key === "credit" && <CreditCard size={12} />}
                                {key === "pix" && <QrCode size={12} />}
                                {PM_LABEL[key]}
                              </button>
                            ))}
                          </div>
                          {payments.length > 1 && (
                            <button onClick={() => removePayment(p.id)} className="text-slate-300 hover:text-red-500 transition-colors shrink-0"><X size={14} /></button>
                          )}
                        </div>

                        {/* bandeira */}
                        {(p.method === "debit" || p.method === "credit") && (
                          <div className="grid grid-cols-3 gap-1">
                            {CARD_BRANDS.map(({ key, label, color }) => (
                              <button key={key} onClick={() => updatePayment(p.id, { cardBrand: key })}
                                className={cn("h-7 rounded-lg border text-[8px] font-black uppercase tracking-widest transition-all",
                                  p.cardBrand === key ? "text-white border-transparent shadow-sm" : "bg-white border-slate-200 text-slate-500 hover:border-slate-400")}
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
                              const pAmt      = Number(p.amount) || 0;
                              const totalWFee = pAmt > 0 && rate > 0 ? pAmt * (1 + rate / 100) : pAmt;
                              const perInst   = n > 1 && pAmt > 0 ? totalWFee / n : 0;
                              const isActive  = p.installments === n;
                              return (
                                <button key={n} onClick={() => updatePayment(p.id, { installments: n })}
                                  className={cn(
                                    "rounded-lg border transition-all flex flex-col items-center justify-center py-1.5 px-1 gap-0.5",
                                    isActive
                                      ? "bg-emerald-600 border-emerald-500 text-white shadow-sm"
                                      : "bg-white border-slate-200 text-slate-500 hover:border-slate-400"
                                  )}>
                                  <span className="text-[8px] font-black uppercase tracking-widest">{n === 1 ? "À vista" : `${n}×`}</span>
                                  {rate > 0 && (
                                    <span className={cn("text-[7px] font-bold", isActive ? "text-emerald-200" : "text-amber-500")}>
                                      +{rate}%
                                    </span>
                                  )}
                                  {pAmt > 0 && rate > 0 && (
                                    <span className={cn("text-[7px] font-mono font-black", isActive ? "text-emerald-100" : "text-slate-600")}>
                                      R${totalWFee.toFixed(2)}
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
                        )}

                        {/* valor + troco/restante */}
                        <div className="flex gap-2">
                          <div className="relative flex-1">
                            <Banknote className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
                            <input type="number" min="0" step="0.01"
                              placeholder={idx === 0 ? `R$ ${total > 0 ? total.toFixed(2) : "0,00"}` : "Valor (R$)"}
                              className={cn("w-full pl-9 pr-3 h-10 bg-white border rounded-xl focus:outline-none text-[11px] font-medium text-slate-800 placeholder:text-slate-400 transition-all [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none",
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
                            <div className="flex flex-col items-end gap-0.5 bg-amber-50 border border-amber-200 rounded-xl px-3 py-1.5 shrink-0" title="Taxa da maquininha — custo interno da loja">
                              <span className="text-[8px] font-black text-amber-600 uppercase tracking-widest">Taxa {feeRate}%</span>
                              <span className="text-[10px] font-mono font-black text-amber-700">− R$ {pFee.toFixed(2)}</span>
                              {p.installments > 1 && Number(p.amount) > 0 && (
                                <span className="text-[7px] font-bold text-amber-500">
                                  {p.installments}× R$ {((Number(p.amount) * (1 + feeRate/100)) / p.installments).toFixed(2)}/parc
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* totais */}
                <div className="bg-slate-900 rounded-2xl p-4 space-y-2">
                  {discountValue > 0 && (
                    <>
                      <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-slate-500">
                        <span>Subtotal</span><span className="font-mono">R$ {subtotal.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-emerald-400">
                        <span>Desconto</span><span className="font-mono">− R$ {discountValue.toFixed(2)}</span>
                      </div>
                    </>
                  )}
                  {feeAmount > 0 && (
                    <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-slate-500">
                      <span>Taxa maquininha*</span><span className="font-mono">R$ {feeAmount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center pt-1 border-t border-slate-700">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total</span>
                    <span className="text-2xl font-mono font-black text-white">R$ {total.toFixed(2)}</span>
                  </div>
                  {change > 0 && (
                    <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-emerald-400 pt-1 border-t border-slate-700">
                      <span>Troco</span><span className="font-mono">R$ {change.toFixed(2)}</span>
                    </div>
                  )}
                  {/* saldo devedor — avisa mas não bloqueia */}
                  {remaining > 0.009 && (
                    <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-red-400 pt-1 border-t border-slate-700">
                      <span>Saldo devedor</span><span className="font-mono">R$ {remaining.toFixed(2)}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="shrink-0 px-5 pb-5 pt-3 border-t border-slate-100 space-y-2">
                {remaining > 0.009 && (
                  <p className="text-[9px] text-center text-amber-600 font-bold uppercase tracking-widest">
                    ⚠ Venda com saldo devedor de R$ {remaining.toFixed(2)}
                  </p>
                )}
                <button onClick={handleFinishSale} disabled={!canFinish || finishing}
                  className={cn(
                    "w-full h-14 text-white rounded-2xl text-[12px] font-black uppercase tracking-widest transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-2xl active:scale-[0.98] flex items-center justify-center gap-3",
                    remaining > 0.009
                      ? "bg-amber-500 hover:bg-amber-600 shadow-amber-500/30"
                      : "bg-blue-600 hover:bg-blue-700 shadow-blue-500/30"
                  )}>
                  {finishing ? <Loader2 size={20} className="animate-spin" /> : <><CreditCard size={20} /> Confirmar Venda</>}
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
              className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-[400]" />
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 32 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.92, y: 32 }}
              transition={{ type: "spring", damping: 28, stiffness: 260 }}
              className="fixed inset-x-0 bottom-0 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 z-[401] w-full sm:w-[440px] bg-white sm:rounded-3xl rounded-t-3xl shadow-2xl flex flex-col overflow-hidden max-h-[90vh]">

              {/* success header */}
              <div className="shrink-0 bg-gradient-to-br from-emerald-500 to-emerald-700 px-6 pt-6 pb-5 text-white relative overflow-hidden">
                <div className="absolute inset-0 opacity-10">
                  <div className="absolute -top-4 -right-4 w-32 h-32 bg-white rounded-full" />
                  <div className="absolute -bottom-8 -left-4 w-48 h-48 bg-white rounded-full" />
                </div>
                <div className="relative flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle2 size={20} className="text-emerald-200" />
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-200">Venda Confirmada</span>
                    </div>
                    <p className="text-2xl font-mono font-black">R$ {completedSale.total.toFixed(2)}</p>
                    <p className="text-[11px] text-emerald-200 font-bold mt-1">
                      #{String(completedSale.orderId).padStart(5,"0")} · {completedSale.customerName || "Consumidor Final"}
                    </p>
                    {completedSale.change > 0 && (
                      <div className="mt-2 inline-flex items-center gap-1.5 bg-white/20 rounded-lg px-3 py-1.5">
                        <Banknote size={13} className="text-emerald-200" />
                        <span className="text-[11px] font-black text-white">Troco: R$ {completedSale.change.toFixed(2)}</span>
                      </div>
                    )}
                    {/* pagamentos */}
                    <div className="mt-3 flex flex-wrap gap-1.5">
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
                  <button onClick={() => setShowReceipt(false)} className="p-1.5 hover:bg-white/20 rounded-xl transition-all text-emerald-200 hover:text-white"><X size={18} /></button>
                </div>
                <div className="relative mt-3 flex gap-2 overflow-x-auto scrollbar-none pb-0.5">
                  {completedSale.items.map((item, idx) => (
                    <div key={idx} className="shrink-0 flex items-center gap-1.5 bg-white/15 rounded-xl px-2.5 py-1.5">
                      {item.image_url ? <img src={item.image_url} className="w-5 h-5 rounded object-cover shrink-0" alt={item.name} /> : <Package size={14} className="text-emerald-200 shrink-0" />}
                      <span className="text-[10px] font-bold text-white truncate max-w-[80px]">{item.name}</span>
                      <span className="text-[10px] font-black text-emerald-200">×{item.quantity}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* actions */}
              <div className="shrink-0 p-5 space-y-2.5">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3">Emitir Comprovante</p>

                <button onClick={() => printViaIframe(buildThermalHtml(completedSale))}
                  className="w-full flex items-center gap-4 h-14 bg-slate-50 hover:bg-slate-100 border border-slate-200 hover:border-slate-300 rounded-2xl px-5 transition-all group">
                  <div className="w-9 h-9 bg-slate-900 rounded-xl flex items-center justify-center shrink-0 group-hover:bg-blue-600 transition-colors"><Printer size={16} className="text-white" /></div>
                  <div className="text-left">
                    <p className="text-[11px] font-black text-slate-900 uppercase tracking-widest">Nota Térmica</p>
                    <p className="text-[9px] text-slate-400 font-medium">Impressão 80mm para bobina</p>
                  </div>
                  <ChevronRight size={14} className="ml-auto text-slate-300 group-hover:text-slate-500" />
                </button>

                <button onClick={() => printViaIframe(buildPDFHtml(completedSale), 600)}
                  className="w-full flex items-center gap-4 h-14 bg-slate-50 hover:bg-slate-100 border border-slate-200 hover:border-slate-300 rounded-2xl px-5 transition-all group">
                  <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center shrink-0 group-hover:bg-blue-700 transition-colors"><FileText size={16} className="text-white" /></div>
                  <div className="text-left">
                    <p className="text-[11px] font-black text-slate-900 uppercase tracking-widest">PDF Completo</p>
                    <p className="text-[9px] text-slate-400 font-medium">Nota detalhada em A4 — imprimir ou salvar</p>
                  </div>
                  <ChevronRight size={14} className="ml-auto text-slate-300 group-hover:text-slate-500" />
                </button>

                <button onClick={() => setShowPhoneInput(!showPhoneInput)}
                  className={cn("w-full flex items-center gap-4 h-14 border rounded-2xl px-5 transition-all group",
                    showPhoneInput ? "bg-emerald-50 border-emerald-300" : "bg-slate-50 hover:bg-slate-100 border-slate-200 hover:border-slate-300")}>
                  <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors", showPhoneInput ? "bg-emerald-600" : "bg-emerald-500 group-hover:bg-emerald-600")}><MessageCircle size={16} className="text-white" /></div>
                  <div className="text-left">
                    <p className="text-[11px] font-black text-slate-900 uppercase tracking-widest">Enviar WhatsApp</p>
                    <p className="text-[9px] text-slate-400 font-medium">Abre WhatsApp Web com o comprovante</p>
                  </div>
                  <ChevronDown size={14} className={cn("ml-auto transition-transform text-slate-300", showPhoneInput ? "rotate-180 text-emerald-500" : "group-hover:text-slate-500")} />
                </button>

                <AnimatePresence>
                  {showPhoneInput && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                      <div className="flex gap-2 pt-1">
                        <div className="relative flex-1">
                          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                          <input type="tel" placeholder="(11) 99999-9999"
                            className="w-full pl-9 pr-4 h-11 bg-white border border-emerald-300 rounded-xl focus:outline-none focus:border-emerald-500 text-[12px] font-medium text-slate-800 placeholder:text-slate-400 transition-all"
                            value={whatsappPhone} onChange={(e) => setWhatsappPhone(e.target.value)} />
                        </div>
                        <button onClick={() => {
                          const cleaned = whatsappPhone.replace(/\D/g, "");
                          const full = cleaned.startsWith("55") ? cleaned : `55${cleaned}`;
                          window.open(`https://wa.me/${full}?text=${encodeURIComponent(buildWhatsAppText(completedSale))}`, "_blank", "noopener,noreferrer");
                        }}
                          disabled={whatsappPhone.replace(/\D/g, "").length < 10}
                          className="h-11 px-4 bg-emerald-600 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-xl font-black text-[11px] uppercase tracking-widest flex items-center gap-2 transition-all hover:bg-emerald-700 disabled:cursor-not-allowed shrink-0 shadow-lg shadow-emerald-500/25">
                          <MessageCircle size={14} /> Enviar
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="shrink-0 px-5 pb-5">
                <button onClick={() => setShowReceipt(false)}
                  className="w-full h-11 border border-slate-200 rounded-2xl text-[11px] font-black text-slate-500 uppercase tracking-widest hover:bg-slate-50 transition-all">
                  Fechar
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
