import React, { useState, useEffect, useMemo } from "react";
import {
  Search, ShoppingCart, Plus, Minus, Trash2, User, CreditCard,
  Banknote, Percent, CheckCircle2, Package, X, QrCode, Tag,
  Loader2, Lock, Mail, LogOut, Store,
  Printer, FileText, MessageCircle, Phone, ChevronRight, ChevronDown,
  PlusCircle,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Product, Category } from "../types";
import { cn } from "../lib/utils";

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
  payments: PaymentEntry[];
  items: { name: string; quantity: number; price: number; image_url?: string }[];
  subtotal: number;
  discountValue: number;
  feeAmount: number;
  total: number;
  change: number;
  tenantName: string;
  tenantAddress: string;
  cardFees: Record<string, number[]>;
}

function newPayment(): PaymentEntry {
  return { id: Math.random().toString(36).slice(2), method: "money", cardBrand: "visa", installments: 1, amount: "" };
}

// ─── LOGIN ────────────────────────────────────────────────────────────────────
function PDVLogin({ onLogin }: { onLogin: (token: string) => void }) {
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
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
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm">
        <div className="text-center mb-10">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-2xl shadow-blue-500/40">
            <Store size={28} className="text-white" />
          </div>
          <h1 className="text-xl font-black text-white uppercase tracking-[0.2em]">PDV Nexus</h1>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Terminal de Vendas · Acesso Seguro</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={15} />
            <input type="email" placeholder="E-MAIL" value={email} onChange={(e) => setEmail(e.target.value)} required
              className="w-full pl-11 pr-4 h-12 bg-slate-900 border border-slate-700 rounded-xl text-[11px] font-bold uppercase tracking-widest text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500 transition-all" />
          </div>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={15} />
            <input type="password" placeholder="SENHA" value={password} onChange={(e) => setPassword(e.target.value)} required
              className="w-full pl-11 pr-4 h-12 bg-slate-900 border border-slate-700 rounded-xl text-[11px] font-bold uppercase tracking-widest text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500 transition-all" />
          </div>
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 px-4 py-3 rounded-xl flex items-center gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
              <p className="text-[10px] font-bold text-red-400 uppercase tracking-widest">{error}</p>
            </div>
          )}
          <button type="submit" disabled={loading}
            className="w-full h-12 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-[11px] font-black uppercase tracking-[0.2em] shadow-xl shadow-blue-500/30 transition-all active:scale-[0.98] disabled:opacity-40 flex items-center justify-center gap-2">
            {loading ? <Loader2 size={16} className="animate-spin" /> : "Acessar PDV"}
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
  const [customerName, setCustomerName] = useState("");
  const [cardFees, setCardFees]     = useState<Record<string, number[]>>({});
  const [discount, setDiscount]     = useState("");
  const [payments, setPayments]     = useState<PaymentEntry[]>([newPayment()]);
  const [loading, setLoading]       = useState(false);
  const [finishing, setFinishing]   = useState(false);
  const [showCartMobile, setShowCartMobile] = useState(false);
  const [configProduct, setConfigProduct] = useState<Product | null>(null);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const [tenantName, setTenantName]   = useState("PDV");
  const [tenantAddress, setTenantAddress] = useState("");

  // receipt modal
  const [completedSale, setCompletedSale]   = useState<CompletedSale | null>(null);
  const [showReceipt, setShowReceipt]       = useState(false);
  const [whatsappPhone, setWhatsappPhone]   = useState("");
  const [showPhoneInput, setShowPhoneInput] = useState(false);

  const handleLogin  = (t: string) => setToken(t);
  const handleLogout = () => { localStorage.removeItem("token"); localStorage.removeItem("user"); setToken(null); setCart([]); };

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    const headers = { Authorization: `Bearer ${token}` };
    Promise.all([
      fetch("/api/products",   { headers }).then((r) => { if (r.status === 401) { handleLogout(); throw new Error("unauth"); } return r.json(); }),
      fetch("/api/categories", { headers }).then((r) => r.json()),
      fetch("/api/tenant",     { headers }).then((r) => r.json()),
    ])
      .then(([prods, cats, tenant]) => {
        setProducts(Array.isArray(prods) ? prods : []);
        setCategories(Array.isArray(cats) ? cats : []);
        if (tenant?.name)      setTenantName(tenant.name);
        if (tenant?.address)   setTenantAddress(tenant.address);
        if (tenant?.card_fees) setCardFees(tenant.card_fees);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  // cart
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
    setConfigProduct(null); setSelectedOptions({});
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
  const removeFromCart = (id: string) => setCart(cart.filter((i) => i.cartItemId !== id));

  // totals
  const subtotal      = cart.reduce((a, b) => a + b.price * b.quantity, 0);
  const discountValue = Math.min(Number(discount) || 0, subtotal);
  const baseTotal     = subtotal - discountValue;
  const feeAmount     = payments.reduce((sum, p) => {
    if (p.method !== "credit") return sum;
    const rate = cardFees[p.cardBrand]?.[p.installments - 1] ?? 0;
    const pAmt = Number(p.amount) || 0;
    return sum + (pAmt > 0 ? pAmt * (rate / 100) : 0);
  }, 0);
  const total       = baseTotal + feeAmount;
  const paidAmount  = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const remaining   = Math.max(0, total - paidAmount);
  const moneyPmt    = payments.find((p) => p.method === "money");
  const moneyAmt    = Number(moneyPmt?.amount) || 0;
  const change      = moneyAmt > 0 && paidAmount >= total ? moneyAmt - (total - (paidAmount - moneyAmt)) : 0;
  const cartQty     = cart.reduce((a, b) => a + b.quantity, 0);
  const canFinish   = cart.length > 0 && paidAmount >= total && total > 0;

  // payment helpers
  const updatePayment = (id: string, patch: Partial<PaymentEntry>) =>
    setPayments((ps) => ps.map((p) => p.id === id ? { ...p, ...patch } : p));
  const removePayment = (id: string) =>
    setPayments((ps) => ps.length > 1 ? ps.filter((p) => p.id !== id) : ps);
  const addPayment = () => setPayments((ps) => [...ps, newPayment()]);

  // receipt helpers
  const buildThermalHtml = (sale: CompletedSale) => {
    const now = new Date().toLocaleString("pt-BR");
    const orderId = String(sale.orderId).padStart(6, "0");
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
<hr class="divider"/>
<div class="center bold" style="font-size:11px;letter-spacing:2px;margin-bottom:4px">ITENS</div>
${sale.items.map((item) => `
<div style="margin:4px 0">
  <div class="bold" style="font-size:11px;text-transform:uppercase">${item.name}</div>
  <div class="row item-sub"><span>${item.quantity},00 x R$ ${item.price.toFixed(2)}</span><span class="bold">R$ ${(item.price * item.quantity).toFixed(2)}</span></div>
</div>`).join("")}
<hr class="divider"/>
<div class="row"><span class="bold">QTD DE ITENS:</span><span>${sale.items.reduce((a, b) => a + b.quantity, 0)}</span></div>
${sale.discountValue > 0 ? `<div class="row"><span>SUBTOTAL</span><span>R$ ${sale.subtotal.toFixed(2)}</span></div><div class="row"><span>DESCONTO</span><span>- R$ ${sale.discountValue.toFixed(2)}</span></div>` : ""}
${sale.feeAmount > 0 ? `<div class="row"><span>JUROS</span><span>+ R$ ${sale.feeAmount.toFixed(2)}</span></div>` : ""}
<hr class="divider-solid"/>
<div class="row-total"><span>TOTAL R$:</span><span>R$ ${sale.total.toFixed(2)}</span></div>
<hr class="divider-solid"/>
${sale.payments.map((p) => {
  const rate  = p.method === "credit" ? (sale.cardFees[p.cardBrand]?.[p.installments - 1] ?? 0) : 0;
  const brand = (p.method === "debit" || p.method === "credit") && p.cardBrand !== "other" ? `/${p.cardBrand.toUpperCase()}` : "";
  const inst  = p.method === "credit" && p.installments > 1 ? ` ${p.installments}X` : "";
  const fee   = rate > 0 ? ` (+${rate}%)` : "";
  const label = `${PM_LABEL[p.method]}${brand}${inst}${fee}`.toUpperCase();
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
    const orderId = String(sale.orderId).padStart(5, "0");
    const payLines = sale.payments.map((p) => {
      const rate  = p.method === "credit" ? (sale.cardFees[p.cardBrand]?.[p.installments - 1] ?? 0) : 0;
      const brand = (p.method === "debit" || p.method === "credit") && p.cardBrand !== "other" ? ` · ${p.cardBrand.toUpperCase()}` : "";
      const inst  = p.method === "credit" && p.installments > 1 ? ` ${p.installments}×` : "";
      const fee   = rate > 0 ? ` (+${rate}%)` : "";
      return `<div style="display:flex;justify-content:space-between;font-size:13px;color:#93c5fd;padding:3px 0"><span>${PM_LABEL[p.method]}${brand}${inst}${fee}</span><span>R$ ${Number(p.amount).toFixed(2)}</span></div>`;
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
  <div class="customer-box"><div style="font-size:16px;font-weight:700">${sale.customerName || "Consumidor Final"}</div></div>
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
  ${sale.discountValue > 0 ? `<div class="totals-row"><span>Subtotal</span><span>R$ ${sale.subtotal.toFixed(2)}</span></div><div class="totals-row" style="color:#34d399"><span>Desconto</span><span>− R$ ${sale.discountValue.toFixed(2)}</span></div>` : ""}
  ${sale.feeAmount > 0 ? `<div class="totals-row" style="color:#fbbf24"><span>Juros</span><span>+ R$ ${sale.feeAmount.toFixed(2)}</span></div>` : ""}
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
      `Comprovante #${String(sale.orderId).padStart(5,"0")} — ${now}`,
      ``,
      `*Cliente:* ${sale.customerName || "Consumidor Final"}`,
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
          tenantName, tenantAddress,
          cardFees,
        };
        setCompletedSale(sale);
        setCart([]); setCustomerName(""); setDiscount("");
        setPayments([newPayment()]);
        setShowCartMobile(false);
        setShowReceipt(true);
        setWhatsappPhone(""); setShowPhoneInput(false);
        fetch("/api/products", { headers: { Authorization: `Bearer ${token}` } })
          .then((r) => r.json()).then((d) => setProducts(Array.isArray(d) ? d : []));
      }
    } catch { console.error("Sale failed"); }
    finally { setFinishing(false); }
  };

  const filteredProducts = useMemo(() => products.filter((p) => {
    if (!p.is_active || p.stock_quantity <= 0) return false;
    if (selectedCategory && p.category_id !== selectedCategory) return false;
    if (searchTerm && !p.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  }), [products, searchTerm, selectedCategory]);

  if (!token) return <PDVLogin onLogin={handleLogin} />;

  // shared cart panel props
  const cartPanelProps = {
    cart, updateQuantity, removeFromCart,
    customerName, setCustomerName,
    cardFees, payments, setPayments, updatePayment, removePayment, addPayment,
    discount, setDiscount,
    subtotal, discountValue, feeAmount, total, paidAmount, remaining, change,
    finishing, canFinish, handleFinishSale,
  };

  return (
    <div className="h-screen bg-slate-950 flex flex-col overflow-hidden font-sans">
      {/* Top Bar */}
      <header className="h-12 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 bg-blue-600 rounded flex items-center justify-center text-white font-black text-[10px]">N</div>
          <span className="text-[11px] font-black text-white uppercase tracking-[0.15em]">{tenantName}</span>
          <div className="h-3 w-px bg-slate-700" />
          <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Terminal PDV</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest hidden sm:block">Online</span>
          <button onClick={handleLogout}
            className="ml-2 flex items-center gap-1.5 px-3 h-7 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:text-red-400 hover:border-red-500/30 transition-all text-[10px] font-bold uppercase tracking-widest">
            <LogOut size={11} /> Sair
          </button>
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Products */}
        <div className="flex-1 flex flex-col gap-3 overflow-hidden p-4">
          <div className="flex gap-2 items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" size={13} />
              <input type="text" placeholder="PESQUISAR PRODUTO..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 h-10 bg-slate-900 border border-slate-800 rounded-xl text-[10px] font-bold uppercase tracking-widest text-white placeholder:text-slate-700 focus:outline-none focus:border-blue-500 transition-all" />
            </div>
            <button onClick={() => setShowCartMobile(true)}
              className="lg:hidden relative h-10 px-4 bg-blue-600 text-white rounded-xl flex items-center gap-2 text-[10px] font-black uppercase tracking-widest">
              <ShoppingCart size={14} />
              {cartQty > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 bg-white text-blue-600 rounded-full text-[9px] font-black flex items-center justify-center">{cartQty}</span>}
            </button>
          </div>

          {categories.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-1 shrink-0 scrollbar-none">
              <button onClick={() => setSelectedCategory(null)}
                className={cn("shrink-0 h-7 px-3 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all border",
                  selectedCategory === null ? "bg-blue-600 text-white border-blue-600" : "bg-slate-900 text-slate-500 border-slate-800 hover:border-slate-600")}>
                Todos
              </button>
              {categories.map((cat) => (
                <button key={cat.id} onClick={() => setSelectedCategory(cat.id === selectedCategory ? null : cat.id)}
                  className={cn("shrink-0 h-7 px-3 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all border flex items-center gap-1",
                    selectedCategory === cat.id ? "bg-blue-600 text-white border-blue-600" : "bg-slate-900 text-slate-500 border-slate-800 hover:border-slate-600")}>
                  <Tag size={9} /> {cat.name}
                </button>
              ))}
            </div>
          )}

          <div className="flex-1 overflow-y-auto pr-1 pb-4">
            {loading ? (
              <div className="h-full flex items-center justify-center"><Loader2 size={24} className="animate-spin text-slate-700" /></div>
            ) : filteredProducts.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center gap-3">
                <Package size={36} className="text-slate-800" strokeWidth={1} />
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-700">Nenhum produto encontrado</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
                {filteredProducts.map((product) => {
                  const qtyInCart = cart.filter((i) => i.id === product.id).reduce((a, b) => a + b.quantity, 0);
                  const atLimit   = qtyInCart >= product.stock_quantity;
                  return (
                    <motion.button layout key={product.id} onClick={() => !atLimit && addToCart(product)}
                      className={cn("bg-slate-900 p-3 rounded-2xl border transition-all flex flex-col items-start group relative text-left",
                        atLimit ? "border-slate-800 opacity-40 cursor-not-allowed" : "border-slate-800 hover:border-blue-500 hover:bg-slate-800/80 cursor-pointer")}>
                      <div className="w-full aspect-square bg-slate-800 rounded-xl border border-slate-700 mb-3 overflow-hidden flex items-center justify-center relative">
                        {product.image_url
                          ? <img src={product.image_url} alt={product.name} className="object-cover w-full h-full group-hover:scale-105 transition-transform" />
                          : <Package size={22} className="text-slate-700" />}
                        <div className="absolute top-1.5 right-1.5 bg-slate-950/80 border border-slate-700 text-slate-400 px-1.5 py-0.5 rounded text-[8px] font-mono font-bold">{product.stock_quantity}</div>
                        {qtyInCart > 0 && <div className="absolute top-1.5 left-1.5 bg-blue-600 text-white w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black">{qtyInCart}</div>}
                      </div>
                      <p className="text-[10px] font-bold text-slate-300 uppercase truncate w-full mb-1">{product.name}</p>
                      {((Array.isArray(product.attributes) && product.attributes.length > 0) || (Array.isArray(product.variations) && product.variations.length > 0)) && (
                        <p className="text-[8px] font-black text-blue-500 uppercase tracking-widest mb-1">C/ Variações</p>
                      )}
                      <p className="text-xs font-mono font-black text-blue-400">R$ {Number(product.price).toFixed(2)}</p>
                    </motion.button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Cart — Desktop */}
        <div className="hidden lg:flex w-[400px] bg-slate-900 border-l border-slate-800 flex-col overflow-hidden shrink-0">
          <StandaloneCart {...cartPanelProps} />
        </div>
      </div>

      {/* Variation Modal */}
      <AnimatePresence>
        {configProduct && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-900 w-full max-w-sm rounded-[28px] overflow-hidden shadow-2xl border border-slate-700">
              <div className="p-5 border-b border-slate-800 flex items-center justify-between">
                <div>
                  <p className="text-[9px] font-black text-blue-500 uppercase tracking-[0.2em] mb-1">Configurar Produto</p>
                  <h3 className="text-xs font-black uppercase text-white">{configProduct.name}</h3>
                </div>
                <button onClick={() => setConfigProduct(null)} className="p-2 hover:bg-slate-800 rounded-full text-slate-500"><X size={18} /></button>
              </div>
              <div className="p-5 space-y-5">
                {Array.isArray(configProduct.attributes) && configProduct.attributes.length > 0
                  ? configProduct.attributes.map((attr, aIdx) => (
                      <div key={aIdx} className="space-y-3">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{attr.name}</label>
                        <div className="flex flex-wrap gap-2">
                          {attr.values.map((val, vIdx) => {
                            const currentOptions = { ...selectedOptions, [attr.name]: val };
                            const sku = configProduct.skus?.find((s) => Object.entries(s.combo).every(([k, v]) => currentOptions[k] === v));
                            const hasStock = !sku || sku.stock > 0;
                            return (
                              <button key={vIdx} disabled={!hasStock} onClick={() => setSelectedOptions({ ...selectedOptions, [attr.name]: val })}
                                className={cn("px-4 h-9 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all border",
                                  !hasStock ? "opacity-30 cursor-not-allowed line-through bg-slate-800 border-slate-700 text-slate-600"
                                    : selectedOptions[attr.name] === val ? "bg-blue-600 text-white border-blue-600"
                                    : "bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-500")}>
                                {val}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))
                  : configProduct.variations?.map((variation, vIdx) => (
                      <div key={vIdx} className="space-y-3">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{variation.name}</label>
                        <div className="flex flex-wrap gap-2">
                          {variation.options.map((opt, oIdx) => (
                            <button key={oIdx} disabled={opt.stock === 0} onClick={() => setSelectedOptions({ ...selectedOptions, [variation.name]: opt.value })}
                              className={cn("px-4 h-9 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all border",
                                opt.stock === 0 ? "opacity-30 cursor-not-allowed line-through bg-slate-800 border-slate-700 text-slate-600"
                                  : selectedOptions[variation.name] === opt.value ? "bg-blue-600 text-white border-blue-600"
                                  : "bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-500")}>
                              {opt.value}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
              </div>
              <div className="p-5 border-t border-slate-800">
                <button onClick={() => addToCart(configProduct, selectedOptions)}
                  className="w-full h-12 bg-blue-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-blue-500 transition-all flex items-center justify-center gap-2">
                  Confirmar <Plus size={14} strokeWidth={3} />
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Mobile Cart Drawer */}
      <AnimatePresence>
        {showCartMobile && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowCartMobile(false)}
              className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[150] lg:hidden" />
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed inset-x-0 bottom-0 h-[90vh] bg-slate-900 rounded-t-[28px] shadow-2xl z-[151] lg:hidden flex flex-col overflow-hidden border-t border-slate-800">
              <div className="w-10 h-1 bg-slate-700 rounded-full mx-auto my-4 shrink-0" />
              <div className="flex-1 overflow-hidden flex flex-col">
                <StandaloneCart {...cartPanelProps} onClose={() => setShowCartMobile(false)} />
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
              className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[300]" />
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 32 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.92, y: 32 }}
              transition={{ type: "spring", damping: 28, stiffness: 260 }}
              className="fixed inset-x-0 bottom-0 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 z-[301] w-full sm:w-[440px] bg-slate-900 border border-slate-700 sm:rounded-3xl rounded-t-3xl shadow-2xl flex flex-col overflow-hidden max-h-[90vh]">

              <div className="shrink-0 bg-gradient-to-br from-emerald-600 to-emerald-800 px-6 pt-6 pb-5 text-white relative overflow-hidden">
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
                  <button onClick={() => setShowReceipt(false)} className="p-1.5 hover:bg-white/20 rounded-xl transition-all text-emerald-200"><X size={18} /></button>
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

              <div className="shrink-0 p-5 space-y-2.5">
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3">Emitir Comprovante</p>
                <button onClick={() => printViaIframe(buildThermalHtml(completedSale))}
                  className="w-full flex items-center gap-4 h-14 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-2xl px-5 transition-all group">
                  <div className="w-9 h-9 bg-white rounded-xl flex items-center justify-center shrink-0"><Printer size={16} className="text-slate-900" /></div>
                  <div className="text-left">
                    <p className="text-[11px] font-black text-white uppercase tracking-widest">Nota Térmica</p>
                    <p className="text-[9px] text-slate-500 font-medium">Impressão 80mm para bobina</p>
                  </div>
                  <ChevronRight size={14} className="ml-auto text-slate-600 group-hover:text-slate-400" />
                </button>
                <button onClick={() => printViaIframe(buildPDFHtml(completedSale), 600)}
                  className="w-full flex items-center gap-4 h-14 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-2xl px-5 transition-all group">
                  <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center shrink-0"><FileText size={16} className="text-white" /></div>
                  <div className="text-left">
                    <p className="text-[11px] font-black text-white uppercase tracking-widest">PDF Completo</p>
                    <p className="text-[9px] text-slate-500 font-medium">Nota detalhada em A4</p>
                  </div>
                  <ChevronRight size={14} className="ml-auto text-slate-600 group-hover:text-slate-400" />
                </button>
                <button onClick={() => setShowPhoneInput(!showPhoneInput)}
                  className={cn("w-full flex items-center gap-4 h-14 border rounded-2xl px-5 transition-all group",
                    showPhoneInput ? "bg-emerald-900/30 border-emerald-600" : "bg-slate-800 hover:bg-slate-700 border-slate-700")}>
                  <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center shrink-0", showPhoneInput ? "bg-emerald-600" : "bg-emerald-700")}><MessageCircle size={16} className="text-white" /></div>
                  <div className="text-left">
                    <p className="text-[11px] font-black text-white uppercase tracking-widest">Enviar WhatsApp</p>
                    <p className="text-[9px] text-slate-500 font-medium">Abre WhatsApp Web com comprovante</p>
                  </div>
                  <ChevronDown size={14} className={cn("ml-auto transition-transform text-slate-600", showPhoneInput ? "rotate-180 text-emerald-400" : "")} />
                </button>
                <AnimatePresence>
                  {showPhoneInput && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                      <div className="flex gap-2 pt-1">
                        <div className="relative flex-1">
                          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" size={14} />
                          <input type="tel" placeholder="(11) 99999-9999"
                            className="w-full pl-9 pr-4 h-11 bg-slate-800 border border-emerald-600 rounded-xl focus:outline-none text-[12px] font-medium text-white placeholder:text-slate-600 transition-all"
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
                  className="w-full h-11 border border-slate-700 rounded-2xl text-[11px] font-black text-slate-500 uppercase tracking-widest hover:bg-slate-800 transition-all">
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

// ─── CART PANEL ───────────────────────────────────────────────────────────────
function StandaloneCart({
  cart, updateQuantity, removeFromCart,
  customerName, setCustomerName,
  cardFees, payments, updatePayment, removePayment, addPayment,
  discount, setDiscount,
  subtotal, discountValue, feeAmount, total, paidAmount, remaining, change,
  finishing, canFinish, handleFinishSale,
  onClose,
}: {
  cart: CartItem[];
  updateQuantity: (id: string, delta: number) => void;
  removeFromCart: (id: string) => void;
  customerName: string;
  setCustomerName: (v: string) => void;
  cardFees: Record<string, number[]>;
  payments: PaymentEntry[];
  setPayments: (ps: PaymentEntry[]) => void;
  updatePayment: (id: string, patch: Partial<PaymentEntry>) => void;
  removePayment: (id: string) => void;
  addPayment: () => void;
  discount: string;
  setDiscount: (v: string) => void;
  subtotal: number;
  discountValue: number;
  feeAmount: number;
  total: number;
  paidAmount: number;
  remaining: number;
  change: number;
  finishing: boolean;
  canFinish: boolean;
  handleFinishSale: () => void;
  onClose?: () => void;
}) {
  const totalQty = cart.reduce((a, b) => a + b.quantity, 0);

  return (
    <>
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between shrink-0">
        <div>
          <h3 className="text-[11px] font-black uppercase tracking-widest text-white flex items-center gap-2">
            <ShoppingCart size={13} className="text-blue-500" /> Carrinho
          </h3>
          <span className="text-[9px] text-slate-600 font-bold uppercase tracking-widest">{totalQty} {totalQty === 1 ? "item" : "itens"}</span>
        </div>
        {onClose && <button onClick={onClose} className="p-1.5 hover:bg-slate-800 rounded-full text-slate-600"><X size={18} /></button>}
      </div>

      {/* Items */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        <AnimatePresence initial={false}>
          {cart.map((item) => (
            <motion.div key={item.cartItemId} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.15 }}>
              <div className="flex items-center gap-2 p-3 rounded-xl border border-slate-800 bg-slate-800/30">
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-black text-slate-200 uppercase truncate">{item.name}</p>
                  {item.variationLabel && <p className="text-[8px] font-bold text-blue-500 uppercase tracking-widest">{item.variationLabel}</p>}
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-[9px] font-mono text-slate-600">R$ {item.price.toFixed(2)} × {item.quantity}</p>
                    <p className="text-[10px] font-mono font-black text-white">R$ {(item.price * item.quantity).toFixed(2)}</p>
                  </div>
                </div>
                <div className="flex flex-col items-center gap-1 shrink-0">
                  <div className="flex items-center gap-0.5 bg-slate-900 border border-slate-700 rounded-lg p-0.5">
                    <button onClick={() => updateQuantity(item.cartItemId, -1)} className="p-1 hover:bg-slate-700 rounded text-slate-500 transition-all"><Minus size={10} /></button>
                    <span className="w-5 text-center font-mono font-black text-[11px] text-white">{item.quantity}</span>
                    <button onClick={() => updateQuantity(item.cartItemId, 1)} disabled={item.quantity >= item.stock_quantity} className="p-1 hover:bg-slate-700 rounded text-slate-500 transition-all disabled:opacity-20"><Plus size={10} /></button>
                  </div>
                  <button onClick={() => removeFromCart(item.cartItemId)} className="p-1 text-slate-700 hover:text-red-500 transition-all"><Trash2 size={11} /></button>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        {cart.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-slate-700 gap-3 py-12">
            <ShoppingCart size={32} strokeWidth={1} />
            <p className="text-[9px] font-black uppercase tracking-[0.2em]">Carrinho Vazio</p>
          </div>
        )}
      </div>

      {/* Checkout */}
      <div className="shrink-0 border-t border-slate-800 space-y-3 p-4 overflow-y-auto max-h-[55vh]">
        {/* Cliente */}
        <div className="relative">
          <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-700" size={13} />
          <input type="text" placeholder="CLIENTE (OPCIONAL)" value={customerName} onChange={(e) => setCustomerName(e.target.value)}
            className="w-full pl-9 pr-3 h-9 bg-slate-800/50 border border-slate-700/50 rounded-lg focus:outline-none focus:border-blue-500 text-[9px] font-bold uppercase tracking-widest text-white placeholder:text-slate-700 transition-all" />
        </div>

        {/* Desconto */}
        <div className="relative">
          <Percent className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-700" size={13} />
          <input type="number" min="0" placeholder="DESCONTO (R$)" value={discount} onChange={(e) => setDiscount(e.target.value)}
            className="w-full pl-9 pr-3 h-9 bg-slate-800/50 border border-slate-700/50 rounded-lg focus:outline-none focus:border-blue-500 text-[9px] font-bold uppercase tracking-widest text-white placeholder:text-slate-700 transition-all [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none" />
        </div>

        {/* Payments */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[8px] font-black text-slate-600 uppercase tracking-[0.2em]">Pagamentos</p>
            <button onClick={addPayment}
              className="flex items-center gap-1 h-6 px-2 bg-blue-600/20 border border-blue-500/30 rounded-lg text-[8px] font-black text-blue-400 uppercase tracking-widest hover:bg-blue-600/30 transition-all">
              <PlusCircle size={10} /> Adicionar
            </button>
          </div>

          {payments.map((p, idx) => {
            const feeRate = p.method === "credit" ? (cardFees[p.cardBrand]?.[p.installments - 1] ?? 0) : 0;
            const pAmt = Number(p.amount) || 0;
            const pFee = pAmt > 0 && feeRate > 0 ? pAmt * (feeRate / 100) : 0;
            return (
              <div key={p.id} className="bg-slate-800/40 rounded-xl border border-slate-700/50 p-2.5 space-y-2">
                {/* method */}
                <div className="flex items-center gap-1.5">
                  {payments.length > 1 && <span className="w-4 h-4 bg-slate-700 rounded-full flex items-center justify-center text-[8px] font-black text-slate-400 shrink-0">{idx+1}</span>}
                  <div className="grid grid-cols-4 gap-1 flex-1">
                    {(["money","debit","credit","pix"] as PaymentMethod[]).map((key) => (
                      <button key={key} onClick={() => updatePayment(p.id, { method: key, installments: 1 })}
                        className={cn("h-8 rounded-lg border text-[8px] font-black uppercase tracking-widest transition-all flex flex-col items-center justify-center gap-0.5",
                          p.method === key
                            ? key === "credit" ? "bg-emerald-600 border-emerald-500 text-white" : "bg-blue-600 border-blue-600 text-white"
                            : "bg-slate-800/50 border-slate-700/50 text-slate-600 hover:border-slate-500 hover:text-slate-400")}>
                        {key === "money" && <Banknote size={10} />}
                        {key === "debit" && <CreditCard size={10} />}
                        {key === "credit" && <CreditCard size={10} />}
                        {key === "pix" && <QrCode size={10} />}
                        {PM_LABEL[key]}
                      </button>
                    ))}
                  </div>
                  {payments.length > 1 && <button onClick={() => removePayment(p.id)} className="text-slate-700 hover:text-red-500 transition-colors shrink-0"><X size={12} /></button>}
                </div>

                {/* bandeira */}
                {(p.method === "debit" || p.method === "credit") && (
                  <div className="grid grid-cols-3 gap-1">
                    {CARD_BRANDS.map(({ key, label, color }) => (
                      <button key={key} onClick={() => updatePayment(p.id, { cardBrand: key })}
                        className={cn("h-6 rounded-md border text-[7px] font-black uppercase tracking-widest transition-all",
                          p.cardBrand === key ? "text-white border-transparent" : "bg-slate-800/40 border-slate-700/50 text-slate-500 hover:border-slate-500")}
                        style={p.cardBrand === key ? { backgroundColor: color } : {}}>
                        {label}
                      </button>
                    ))}
                  </div>
                )}

                {/* parcelamento */}
                {p.method === "credit" && (
                  <div className="grid grid-cols-4 gap-1">
                    {[1,2,3,4,5,6,10,12].map((n) => {
                      const rate = cardFees[p.cardBrand]?.[n-1] ?? 0;
                      return (
                        <button key={n} onClick={() => updatePayment(p.id, { installments: n })}
                          className={cn("h-8 rounded-lg border text-[7px] font-black uppercase tracking-widest transition-all flex flex-col items-center justify-center",
                            p.installments === n ? "bg-emerald-600 border-emerald-500 text-white" : "bg-slate-800/40 border-slate-700/50 text-slate-500 hover:border-slate-500")}>
                          <span>{n === 1 ? "À vista" : `${n}×`}</span>
                          {rate > 0 && <span className={cn("text-[6px] font-bold", p.installments === n ? "text-emerald-200" : "text-slate-600")}>+{rate}%</span>}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* valor */}
                <div className="flex gap-1.5">
                  <div className="relative flex-1">
                    <Banknote className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-700" size={11} />
                    <input type="number" min="0" step="0.01"
                      placeholder={idx === 0 ? `R$ ${total > 0 ? total.toFixed(2) : "0,00"}` : "Valor (R$)"}
                      className={cn("w-full pl-7 pr-2 h-8 bg-slate-800 border rounded-lg focus:outline-none text-[10px] font-medium text-white placeholder:text-slate-700 transition-all [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none",
                        p.method === "money" && pAmt > 0 && pAmt < (total - (paidAmount - pAmt)) ? "border-red-500" : "border-slate-700 focus:border-blue-500")}
                      value={p.amount} onChange={(e) => updatePayment(p.id, { amount: e.target.value })} />
                  </div>
                  {p.method === "money" && pAmt > 0 && pAmt >= (total - (paidAmount - pAmt)) && (
                    <div className="flex items-center gap-1 bg-emerald-900/30 border border-emerald-700/40 rounded-lg px-2 shrink-0">
                      <span className="text-[8px] font-black text-emerald-400">Troco</span>
                      <span className="text-[9px] font-mono font-black text-emerald-400">R$ {Math.max(0, pAmt - (total - (paidAmount - pAmt))).toFixed(2)}</span>
                    </div>
                  )}
                  {pFee > 0 && (
                    <div className="flex items-center gap-1 bg-amber-900/20 border border-amber-700/30 rounded-lg px-2 shrink-0">
                      <span className="text-[8px] font-black text-amber-400">+{feeRate}%</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Totais */}
        <div className="space-y-1 pt-1">
          {discountValue > 0 && (
            <>
              <div className="flex justify-between text-[9px] font-bold uppercase tracking-widest text-slate-600"><span>Subtotal</span><span className="font-mono">R$ {subtotal.toFixed(2)}</span></div>
              <div className="flex justify-between text-[9px] font-bold uppercase tracking-widest text-emerald-500"><span>Desconto</span><span className="font-mono">− R$ {discountValue.toFixed(2)}</span></div>
            </>
          )}
          {feeAmount > 0 && (
            <div className="flex justify-between text-[9px] font-bold uppercase tracking-widest text-amber-400"><span>Juros</span><span className="font-mono">+ R$ {feeAmount.toFixed(2)}</span></div>
          )}
          <div className="flex justify-between items-center">
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Total</span>
            <span className="text-2xl font-mono font-black text-white tracking-tight">R$ {total.toFixed(2)}</span>
          </div>
          {remaining > 0 && paidAmount > 0 && (
            <div className="flex justify-between text-[9px] font-bold uppercase tracking-widest text-red-400"><span>Faltam</span><span className="font-mono">R$ {remaining.toFixed(2)}</span></div>
          )}
          {change > 0 && (
            <div className="flex justify-between text-[9px] font-black uppercase tracking-widest text-emerald-400 pt-1.5 border-t border-slate-800"><span>Troco</span><span className="font-mono">R$ {change.toFixed(2)}</span></div>
          )}
        </div>

        {/* Botão */}
        <button onClick={handleFinishSale} disabled={!canFinish || finishing}
          className="w-full h-12 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-500 transition-all disabled:opacity-20 shadow-xl shadow-blue-500/20 active:scale-[0.98] flex items-center justify-center gap-2">
          {finishing ? <Loader2 size={16} className="animate-spin" /> : <><CreditCard size={16} /> Finalizar Venda</>}
        </button>
      </div>
    </>
  );
}
