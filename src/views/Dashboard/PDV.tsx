import React, { useState, useEffect, useMemo } from "react";
import {
  Search, ShoppingCart, Plus, Minus, Trash2, User, CreditCard,
  Banknote, Percent, CheckCircle2, Package, X, QrCode, Tag,
  Loader2, ExternalLink, RefreshCw, ChevronRight,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Product, Category } from "../../types";
import { cn } from "../../lib/utils";

type PaymentMethod = "money" | "debit" | "credit" | "pix";
type CardBrand    = "visa" | "master" | "elo" | "amex" | "hiper" | "other";

const CARD_BRANDS = [
  { key: "visa"  as CardBrand, label: "Visa",       color: "#1A1F71" },
  { key: "master"as CardBrand, label: "Mastercard", color: "#EB001B" },
  { key: "elo"   as CardBrand, label: "Elo",        color: "#00A4E0" },
  { key: "amex"  as CardBrand, label: "Amex",       color: "#2E77BC" },
  { key: "hiper" as CardBrand, label: "Hipercard",  color: "#B22222" },
  { key: "other" as CardBrand, label: "Outra",      color: "#64748b" },
];

interface CartItem extends Product {
  price: number;
  quantity: number;
  cartItemId: string;
  variationLabel: string;
  selectedOptions?: Record<string, string>;
}

export default function PDV() {
  const [products, setProducts]     = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [cart, setCart]             = useState<CartItem[]>([]);
  const [loading, setLoading]       = useState(true);
  const [finishing, setFinishing]   = useState(false);
  const [success, setSuccess]       = useState(false);
  const [configProduct, setConfigProduct] = useState<Product | null>(null);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const [showCheckout, setShowCheckout] = useState(false);

  // checkout fields
  const [customerName, setCustomerName]   = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("money");
  const [cardBrand, setCardBrand]         = useState<CardBrand>("visa");
  const [installments, setInstallments]   = useState(1);
  const [cardFees, setCardFees]           = useState<Record<string, number[]>>({});
  const [discount, setDiscount]           = useState("");
  const [amountReceived, setAmountReceived] = useState("");

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
      .then((d) => { if (d?.card_fees) setCardFees(d.card_fees); })
      .catch(() => {});
  }, []);

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

  // ── totals ───────────────────────────────────────────────────────────────────
  const subtotal      = cart.reduce((a, b) => a + b.price * b.quantity, 0);
  const discountValue = Math.min(Number(discount) || 0, subtotal);
  const baseTotal     = subtotal - discountValue;
  const creditFeeRate = paymentMethod === "credit" && cardFees[cardBrand]
    ? (cardFees[cardBrand][installments - 1] ?? 0) : 0;
  const feeAmount     = paymentMethod === "credit" ? baseTotal * (creditFeeRate / 100) : 0;
  const total         = baseTotal + feeAmount;
  const installmentValue = paymentMethod === "credit" && installments > 1 ? total / installments : 0;
  const amountReceivedNum = Number(amountReceived) || 0;
  const change        = paymentMethod === "money" && amountReceivedNum > 0 ? amountReceivedNum - total : 0;
  const cartQty       = cart.reduce((a, b) => a + b.quantity, 0);

  // ── finish sale ──────────────────────────────────────────────────────────────
  const handleFinishSale = async () => {
    if (cart.length === 0 || finishing) return;
    if (paymentMethod === "money" && (!amountReceived || amountReceivedNum < total)) return;
    setFinishing(true);
    try {
      const res = await fetch("/api/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          items: cart.map((i) => ({ id: i.id, quantity: i.quantity, price: i.price })),
          customerName,
          totalAmount: total,
          paymentMethod: paymentMethod === "credit"
            ? `crédito-${cardBrand}${installments > 1 ? `-${installments}x` : ""}`
            : paymentMethod === "debit" ? `débito-${cardBrand}` : paymentMethod,
          discount: discountValue,
        }),
      });
      if (res.ok) {
        setCart([]); setCustomerName(""); setDiscount(""); setAmountReceived("");
        setPaymentMethod("money"); setCardBrand("visa"); setInstallments(1);
        setSuccess(true); setShowCheckout(false);
        setTimeout(() => setSuccess(false), 3000);
        fetch("/api/products", { headers: { Authorization: `Bearer ${token}` } })
          .then((r) => r.json()).then((d) => setProducts(Array.isArray(d) ? d : []));
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

  const canFinish = cart.length > 0 &&
    !(paymentMethod === "money" && (!amountReceived || amountReceivedNum < total));

  // ── render ───────────────────────────────────────────────────────────────────
  return (
    <div className="h-full flex flex-col overflow-hidden bg-[#f8fafc]">

      {/* ── TOOLBAR ─────────────────────────────────────────────────────────── */}
      <div className="shrink-0 flex gap-2 items-center px-4 pt-3 pb-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
          <input
            type="text"
            placeholder="PESQUISAR PRODUTO..."
            className="w-full pl-9 pr-4 h-10 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-[10px] font-bold uppercase tracking-widest placeholder:text-slate-300 transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <button onClick={refreshProducts} title="Atualizar"
          className="h-10 w-10 flex items-center justify-center bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-blue-600 hover:border-blue-300 transition-all shrink-0">
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
        </button>
        <button onClick={() => window.open("/pdv", "_blank", "noopener,noreferrer")}
          className="h-10 px-3 flex items-center gap-2 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 transition-all shrink-0 shadow-lg">
          <ExternalLink size={13} />
          <span className="hidden sm:block">PDV Externo</span>
        </button>
      </div>

      {/* ── CATEGORIES ──────────────────────────────────────────────────────── */}
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

      {/* ── PRODUCT GRID ────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 pb-2 admin-scroll">
        {loading ? (
          <div className="h-full flex items-center justify-center">
            <Loader2 size={28} className="animate-spin text-slate-300" />
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center gap-3 text-slate-300">
            <Package size={40} strokeWidth={1} />
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Nenhum produto encontrado</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
            {filteredProducts.map((product) => {
              const qtyInCart = cart.filter((i) => i.id === product.id).reduce((a, b) => a + b.quantity, 0);
              const atLimit   = qtyInCart >= product.stock_quantity;
              return (
                <motion.button layout key={product.id}
                  onClick={() => !atLimit && addToCart(product)}
                  className={cn(
                    "bg-white p-3 rounded-2xl border shadow-sm transition-all flex flex-col items-start group relative text-left",
                    atLimit ? "border-slate-100 opacity-40 cursor-not-allowed"
                      : qtyInCart > 0 ? "border-blue-400 shadow-blue-100 shadow-md ring-1 ring-blue-300/50 cursor-pointer"
                      : "border-slate-200 hover:border-blue-400 hover:shadow-md cursor-pointer"
                  )}>
                  <div className="w-full aspect-square bg-slate-50 rounded-xl border border-slate-100 mb-2 overflow-hidden flex items-center justify-center relative">
                    {product.image_url
                      ? <img src={product.image_url} alt={product.name} className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-300" />
                      : <Package size={24} className="text-slate-200" />}
                    <div className="absolute top-1.5 right-1.5 bg-slate-900/80 border border-slate-700/50 text-white px-1.5 py-0.5 rounded-md text-[8px] font-mono font-bold">
                      {product.stock_quantity}
                    </div>
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
                  {((Array.isArray(product.attributes) && product.attributes.length > 0) ||
                    (Array.isArray(product.variations) && product.variations.length > 0)) && (
                    <p className="text-[8px] font-black text-blue-500 uppercase tracking-widest mb-0.5">Variações</p>
                  )}
                  <p className="text-[11px] font-mono font-black text-blue-600">R$ {Number(product.price).toFixed(2)}</p>
                </motion.button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── CART BAR (bottom) ───────────────────────────────────────────────── */}
      <div className="shrink-0 bg-white border-t border-slate-200 px-4 py-3 flex items-center gap-3 shadow-[0_-4px_16px_rgba(0,0,0,0.06)]">
        {/* itens do carrinho */}
        <div className="flex-1 flex items-center gap-2 overflow-x-auto scrollbar-none">
          {cartQty === 0 ? (
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Carrinho vazio — clique nos produtos para adicionar</p>
          ) : (
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center bg-blue-600 rounded-lg shrink-0">
                <ShoppingCart size={15} className="text-white" />
              </div>
              <div>
                <p className="text-[11px] font-black text-slate-900 leading-none">{cartQty} {cartQty === 1 ? "item" : "itens"}</p>
                <p className="text-[10px] font-mono font-black text-blue-600 leading-none mt-0.5">R$ {subtotal.toFixed(2)}</p>
              </div>
              {/* mini cart chips */}
              <div className="flex gap-1.5 ml-2 overflow-x-auto scrollbar-none">
                {cart.map((item) => (
                  <div key={item.cartItemId} className="shrink-0 flex items-center gap-1 bg-slate-100 border border-slate-200 rounded-lg px-2 h-7">
                    <span className="text-[9px] font-bold text-slate-600 uppercase truncate max-w-[80px]">{item.name}</span>
                    <span className="text-[9px] font-black text-blue-600">×{item.quantity}</span>
                    <button onClick={() => removeFromCart(item.cartItemId)} className="text-slate-400 hover:text-red-500 transition-colors ml-0.5">
                      <X size={10} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* success flash */}
        <AnimatePresence>
          {success && (
            <motion.div key="ok" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
              className="flex items-center gap-2 text-emerald-600 font-black text-[11px] uppercase tracking-widest shrink-0">
              <CheckCircle2 size={18} /> Venda Registrada!
            </motion.div>
          )}
        </AnimatePresence>

        {/* CTA */}
        <button
          disabled={cartQty === 0}
          onClick={() => setShowCheckout(true)}
          className="shrink-0 h-10 px-5 bg-blue-600 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-xl text-[11px] font-black uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-blue-500/25 hover:bg-blue-700 transition-all active:scale-95 disabled:shadow-none disabled:cursor-not-allowed">
          <CreditCard size={15} />
          Finalizar Venda
          {cartQty > 0 && <ChevronRight size={14} />}
        </button>
      </div>

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
                                {val}{!ok && <span className="block text-[8px] normal-case font-bold">Esgotado</span>}
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
                              {opt.value}{opt.stock === 0 && <span className="block text-[8px] normal-case font-bold">Esgotado</span>}
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
              initial={{ opacity: 0, y: 40, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 40, scale: 0.97 }}
              transition={{ type: "spring", damping: 28, stiffness: 240 }}
              className="fixed inset-x-0 bottom-0 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 z-[301] w-full sm:w-[480px] bg-white sm:rounded-3xl rounded-t-3xl shadow-2xl flex flex-col overflow-hidden max-h-[92vh]"
            >
              {/* header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
                <div>
                  <h2 className="text-[12px] font-black uppercase tracking-widest text-slate-900">Finalizar Venda</h2>
                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                    {cartQty} {cartQty === 1 ? "item" : "itens"} · R$ {subtotal.toFixed(2)}
                  </p>
                </div>
                <button onClick={() => setShowCheckout(false)} className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 transition-all">
                  <X size={18} />
                </button>
              </div>

              {/* scrollable body */}
              <div className="flex-1 overflow-y-auto admin-scroll p-5 space-y-4">

                {/* itens resumo */}
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

                {/* forma de pagamento */}
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { key: "money",  label: "Dinheiro", Icon: Banknote  },
                    { key: "debit",  label: "Débito",   Icon: CreditCard },
                    { key: "credit", label: "Crédito",  Icon: CreditCard },
                    { key: "pix",    label: "PIX",      Icon: QrCode    },
                  ] as { key: PaymentMethod; label: string; Icon: React.ElementType }[]).map(({ key, label, Icon }) => (
                    <button key={key} onClick={() => { setPaymentMethod(key); setInstallments(1); }}
                      className={cn("flex items-center gap-2.5 h-11 rounded-xl border px-4 text-[11px] font-black uppercase tracking-widest transition-all",
                        paymentMethod === key
                          ? key === "credit" ? "bg-emerald-600 border-emerald-500 text-white shadow-md shadow-emerald-500/25"
                            : "bg-blue-600 border-blue-500 text-white shadow-md shadow-blue-500/25"
                          : "bg-slate-50 border-slate-200 text-slate-500 hover:border-slate-400")}>
                      <Icon size={16} />{label}
                    </button>
                  ))}
                </div>

                {/* bandeira */}
                {(paymentMethod === "debit" || paymentMethod === "credit") && (
                  <div className="space-y-2">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Bandeira</p>
                    <div className="grid grid-cols-3 gap-1.5">
                      {CARD_BRANDS.map(({ key, label, color }) => (
                        <button key={key} onClick={() => setCardBrand(key)}
                          className={cn("h-9 rounded-lg border text-[9px] font-black uppercase tracking-widest transition-all",
                            cardBrand === key ? "text-white border-transparent shadow-md" : "bg-slate-50 border-slate-200 text-slate-500 hover:border-slate-400")}
                          style={cardBrand === key ? { backgroundColor: color } : {}}>
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* parcelamento */}
                {paymentMethod === "credit" && (
                  <div className="space-y-2">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Parcelamento</p>
                    <div className="grid grid-cols-4 gap-1.5">
                      {[1, 2, 3, 4, 5, 6, 10, 12].map((n) => {
                        const rate = cardFees[cardBrand]?.[n - 1] ?? 0;
                        return (
                          <button key={n} onClick={() => setInstallments(n)}
                            className={cn("h-10 rounded-lg border text-[9px] font-black uppercase tracking-widest transition-all flex flex-col items-center justify-center",
                              installments === n ? "bg-emerald-600 border-emerald-500 text-white shadow-md"
                                : "bg-slate-50 border-slate-200 text-slate-500 hover:border-slate-400")}>
                            <span>{n === 1 ? "À vista" : `${n}×`}</span>
                            {rate > 0 && <span className={cn("text-[7px] font-bold", installments === n ? "text-emerald-200" : "text-slate-400")}>+{rate}%</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* desconto */}
                <div className="relative">
                  <Percent className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                  <input type="number" min="0" placeholder="Desconto (R$)"
                    className="w-full pl-9 pr-4 h-10 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 text-[11px] font-medium text-slate-800 placeholder:text-slate-400 transition-all [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                    value={discount} onChange={(e) => setDiscount(e.target.value)} />
                </div>

                {/* valor recebido (dinheiro) */}
                {paymentMethod === "money" && (
                  <div className="relative">
                    <Banknote className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                    <input type="number" min="0" placeholder="Valor recebido (R$)"
                      className={cn("w-full pl-9 pr-4 h-10 bg-slate-50 border rounded-xl focus:outline-none text-[11px] font-medium text-slate-800 placeholder:text-slate-400 transition-all [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none",
                        amountReceived && amountReceivedNum < total ? "border-red-400 focus:border-red-500 bg-red-50" : "border-slate-200 focus:border-blue-500")}
                      value={amountReceived} onChange={(e) => setAmountReceived(e.target.value)} />
                  </div>
                )}

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
                    <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-amber-400">
                      <span>Juros ({creditFeeRate}%)</span><span className="font-mono">+ R$ {feeAmount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center pt-1 border-t border-slate-700">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total</span>
                    <span className="text-2xl font-mono font-black text-white">R$ {total.toFixed(2)}</span>
                  </div>
                  {installmentValue > 0 && (
                    <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-emerald-400">
                      <span>{installments}× de</span><span className="font-mono">R$ {installmentValue.toFixed(2)}</span>
                    </div>
                  )}
                  {paymentMethod === "money" && amountReceived && amountReceivedNum > 0 && (
                    <div className={cn("flex justify-between text-[10px] font-black uppercase tracking-widest pt-1 border-t border-slate-700",
                      change >= 0 ? "text-emerald-400" : "text-red-400")}>
                      <span>{change >= 0 ? "Troco" : "Faltam"}</span>
                      <span className="font-mono">{change >= 0 ? `R$ ${change.toFixed(2)}` : `R$ ${Math.abs(change).toFixed(2)}`}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* footer fixo com botão */}
              <div className="shrink-0 px-5 pb-5 pt-3 border-t border-slate-100">
                <button onClick={handleFinishSale}
                  disabled={!canFinish || finishing}
                  className="w-full h-14 bg-blue-600 text-white rounded-2xl text-[12px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-2xl shadow-blue-500/30 active:scale-[0.98] flex items-center justify-center gap-3">
                  {finishing ? <Loader2 size={20} className="animate-spin" /> : <><CreditCard size={20} /> Confirmar Venda</>}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
