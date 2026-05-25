import React, { useState, useEffect, useMemo } from "react";
import {
  Search,
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  User,
  CreditCard,
  Banknote,
  Percent,
  CheckCircle2,
  Package,
  X,
  QrCode,
  Tag,
  Loader2,
  Lock,
  Mail,
  LogOut,
  Store,
  Maximize2,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Product, Category } from "../types";
import { cn } from "../lib/utils";

type PaymentMethod = "money" | "card" | "pix";

interface CartItem extends Product {
  price: number;
  quantity: number;
  cartItemId: string;
  variationLabel: string;
  selectedOptions?: Record<string, string>;
}

// ─── LOGIN SCREEN ────────────────────────────────────────────────────────────
function PDVLogin({ onLogin }: { onLogin: (token: string, user: object) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem("token", data.token);
        localStorage.setItem("user", JSON.stringify(data.user));
        onLogin(data.token, data.user);
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
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm"
      >
        {/* Brand */}
        <div className="text-center mb-10">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-2xl shadow-blue-500/40">
            <Store size={28} className="text-white" />
          </div>
          <h1 className="text-xl font-black text-white uppercase tracking-[0.2em]">
            PDV Nexus
          </h1>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">
            Terminal de Vendas · Acesso Seguro
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={15} />
            <input
              type="email"
              placeholder="E-MAIL"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full pl-11 pr-4 h-12 bg-slate-900 border border-slate-700 rounded-xl text-[11px] font-bold uppercase tracking-widest text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500 transition-all"
            />
          </div>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={15} />
            <input
              type="password"
              placeholder="SENHA"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full pl-11 pr-4 h-12 bg-slate-900 border border-slate-700 rounded-xl text-[11px] font-bold uppercase tracking-widest text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500 transition-all"
            />
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 px-4 py-3 rounded-xl flex items-center gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
              <p className="text-[10px] font-bold text-red-400 uppercase tracking-widest">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-[11px] font-black uppercase tracking-[0.2em] shadow-xl shadow-blue-500/30 transition-all active:scale-[0.98] disabled:opacity-40 flex items-center justify-center gap-2"
          >
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

// ─── MAIN PDV STANDALONE ─────────────────────────────────────────────────────
export default function PDVStandalone() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("token"));
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("money");
  const [discount, setDiscount] = useState("");
  const [loading, setLoading] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [success, setSuccess] = useState(false);
  const [showCartMobile, setShowCartMobile] = useState(false);
  const [configProduct, setConfigProduct] = useState<Product | null>(null);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const [tenantName, setTenantName] = useState("PDV");

  const handleLogin = (newToken: string, user: object) => {
    setToken(newToken);
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setToken(null);
    setCart([]);
  };

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    const headers = { Authorization: `Bearer ${token}` };
    Promise.all([
      fetch("/api/products", { headers }).then((r) => {
        if (r.status === 401 || r.status === 403) { handleLogout(); throw new Error("unauth"); }
        return r.json();
      }),
      fetch("/api/categories", { headers }).then((r) => r.json()),
      fetch("/api/tenant", { headers }).then((r) => r.json()),
    ])
      .then(([prods, cats, tenant]) => {
        setProducts(Array.isArray(prods) ? prods : []);
        setCategories(Array.isArray(cats) ? cats : []);
        if (tenant?.name) setTenantName(tenant.name);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  const addToCart = (product: Product, options?: Record<string, string>) => {
    const hasAttributes = Array.isArray(product.attributes) && product.attributes.length > 0;
    const hasLegacyVariations = !hasAttributes && Array.isArray(product.variations) && product.variations.length > 0;
    if ((hasAttributes || hasLegacyVariations) && !options) {
      setConfigProduct(product);
      const init: Record<string, string> = {};
      if (hasAttributes) product.attributes!.forEach((a) => (init[a.name] = a.values[0] ?? ""));
      else product.variations!.forEach((v) => (init[v.name] = v.options[0]?.value ?? ""));
      setSelectedOptions(init);
      return;
    }
    const variationLabel = options ? Object.entries(options).map(([k, v]) => `${k}: ${v}`).join(", ") : "";
    const cartItemId = options ? `${product.id}-${variationLabel}` : `${product.id}`;
    const existing = cart.find((i) => i.cartItemId === cartItemId);
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
    setCart(
      cart.map((item) => {
        if (item.cartItemId !== cartItemId) return item;
        const nq = item.quantity + delta;
        if (nq <= 0) return null as unknown as CartItem;
        if (nq > item.stock_quantity) return item;
        return { ...item, quantity: nq };
      }).filter(Boolean)
    );
  };

  const removeFromCart = (cartItemId: string) => setCart(cart.filter((i) => i.cartItemId !== cartItemId));

  const subtotal = cart.reduce((a, b) => a + b.price * b.quantity, 0);
  const discountValue = Math.min(Number(discount) || 0, subtotal);
  const total = subtotal - discountValue;

  const handleFinishSale = async () => {
    if (cart.length === 0 || finishing) return;
    setFinishing(true);
    try {
      const res = await fetch("/api/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          items: cart.map((i) => ({ id: i.id, quantity: i.quantity, price: i.price })),
          customerName,
          totalAmount: total,
          paymentMethod,
          discount: discountValue,
        }),
      });
      if (res.ok) {
        setCart([]);
        setCustomerName("");
        setDiscount("");
        setPaymentMethod("money");
        setSuccess(true);
        setShowCartMobile(false);
        setTimeout(() => setSuccess(false), 3000);
        fetch("/api/products", { headers: { Authorization: `Bearer ${token}` } })
          .then((r) => r.json())
          .then((data) => setProducts(Array.isArray(data) ? data : []));
      }
    } catch {
      console.error("Sale failed");
    } finally {
      setFinishing(false);
    }
  };

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (!p.is_active) return false;
      if (p.stock_quantity <= 0) return false;
      if (selectedCategory && p.category_id !== selectedCategory) return false;
      if (searchTerm && !p.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      return true;
    });
  }, [products, searchTerm, selectedCategory]);

  const cartQty = cart.reduce((a, b) => a + b.quantity, 0);

  if (!token) return <PDVLogin onLogin={handleLogin} />;

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
          <button
            onClick={handleLogout}
            className="ml-2 flex items-center gap-1.5 px-3 h-7 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:text-red-400 hover:border-red-500/30 transition-all text-[10px] font-bold uppercase tracking-widest"
          >
            <LogOut size={11} /> Sair
          </button>
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Products */}
        <div className="flex-1 flex flex-col gap-3 overflow-hidden p-4">
          {/* Search + mobile cart */}
          <div className="flex gap-2 items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" size={13} />
              <input
                type="text"
                placeholder="PESQUISAR PRODUTO..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 h-10 bg-slate-900 border border-slate-800 rounded-xl text-[10px] font-bold uppercase tracking-widest text-white placeholder:text-slate-700 focus:outline-none focus:border-blue-500 transition-all"
              />
            </div>
            <button
              onClick={() => setShowCartMobile(true)}
              className="lg:hidden relative h-10 px-4 bg-blue-600 text-white rounded-xl flex items-center gap-2 text-[10px] font-black uppercase tracking-widest"
            >
              <ShoppingCart size={14} />
              {cartQty > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-white text-blue-600 rounded-full text-[9px] font-black flex items-center justify-center">
                  {cartQty}
                </span>
              )}
            </button>
          </div>

          {/* Categories */}
          {categories.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-1 shrink-0 scrollbar-none">
              <button
                onClick={() => setSelectedCategory(null)}
                className={cn(
                  "shrink-0 h-7 px-3 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all border",
                  selectedCategory === null
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-slate-900 text-slate-500 border-slate-800 hover:border-slate-600"
                )}
              >
                Todos
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id === selectedCategory ? null : cat.id)}
                  className={cn(
                    "shrink-0 h-7 px-3 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all border flex items-center gap-1",
                    selectedCategory === cat.id
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-slate-900 text-slate-500 border-slate-800 hover:border-slate-600"
                  )}
                >
                  <Tag size={9} />
                  {cat.name}
                </button>
              ))}
            </div>
          )}

          {/* Product grid */}
          <div className="flex-1 overflow-y-auto pr-1 pb-4">
            {loading ? (
              <div className="h-full flex items-center justify-center">
                <Loader2 size={24} className="animate-spin text-slate-700" />
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center gap-3">
                <Package size={36} className="text-slate-800" strokeWidth={1} />
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-700">
                  Nenhum produto encontrado
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
                {filteredProducts.map((product) => {
                  const cartQtyForProduct = cart.filter((i) => i.id === product.id).reduce((a, b) => a + b.quantity, 0);
                  const atLimit = cartQtyForProduct >= product.stock_quantity;
                  return (
                    <motion.button
                      layout
                      key={product.id}
                      onClick={() => !atLimit && addToCart(product)}
                      className={cn(
                        "bg-slate-900 p-3 rounded-2xl border transition-all flex flex-col items-start group relative text-left",
                        atLimit
                          ? "border-slate-800 opacity-40 cursor-not-allowed"
                          : "border-slate-800 hover:border-blue-500 hover:bg-slate-800/80 cursor-pointer"
                      )}
                    >
                      <div className="w-full aspect-square bg-slate-800 rounded-xl border border-slate-700 mb-3 overflow-hidden flex items-center justify-center relative">
                        {product.image_url ? (
                          <img src={product.image_url} alt={product.name} className="object-cover w-full h-full group-hover:scale-105 transition-transform" />
                        ) : (
                          <Package size={22} className="text-slate-700" />
                        )}
                        <div className="absolute top-1.5 right-1.5 bg-slate-950/80 border border-slate-700 text-slate-400 px-1.5 py-0.5 rounded text-[8px] font-mono font-bold">
                          {product.stock_quantity}
                        </div>
                        {cartQtyForProduct > 0 && (
                          <div className="absolute top-1.5 left-1.5 bg-blue-600 text-white w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black">
                            {cartQtyForProduct}
                          </div>
                        )}
                      </div>
                      <p className="text-[10px] font-bold text-slate-300 uppercase truncate w-full mb-1">{product.name}</p>
                      {((Array.isArray(product.attributes) && product.attributes.length > 0) ||
                        (Array.isArray(product.variations) && product.variations.length > 0)) && (
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
        <div className="hidden lg:flex w-[380px] bg-slate-900 border-l border-slate-800 flex-col overflow-hidden shrink-0">
          <StandaloneCart
            cart={cart}
            updateQuantity={updateQuantity}
            removeFromCart={removeFromCart}
            customerName={customerName}
            setCustomerName={setCustomerName}
            paymentMethod={paymentMethod}
            setPaymentMethod={setPaymentMethod}
            discount={discount}
            setDiscount={setDiscount}
            subtotal={subtotal}
            discountValue={discountValue}
            total={total}
            success={success}
            finishing={finishing}
            handleFinishSale={handleFinishSale}
          />
        </div>
      </div>

      {/* Variation Modal */}
      <AnimatePresence>
        {configProduct && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-900 w-full max-w-sm rounded-[28px] overflow-hidden shadow-2xl border border-slate-700"
            >
              <div className="p-5 border-b border-slate-800 flex items-center justify-between">
                <div>
                  <p className="text-[9px] font-black text-blue-500 uppercase tracking-[0.2em] mb-1">Configurar Produto</p>
                  <h3 className="text-xs font-black uppercase text-white">{configProduct.name}</h3>
                </div>
                <button onClick={() => setConfigProduct(null)} className="p-2 hover:bg-slate-800 rounded-full text-slate-500">
                  <X size={18} />
                </button>
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
                              <button
                                key={vIdx}
                                disabled={!hasStock}
                                onClick={() => setSelectedOptions({ ...selectedOptions, [attr.name]: val })}
                                className={cn(
                                  "px-4 h-9 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all border",
                                  !hasStock
                                    ? "opacity-30 cursor-not-allowed line-through bg-slate-800 border-slate-700 text-slate-600"
                                    : selectedOptions[attr.name] === val
                                    ? "bg-blue-600 text-white border-blue-600"
                                    : "bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-500"
                                )}
                              >
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
                            <button
                              key={oIdx}
                              disabled={opt.stock === 0}
                              onClick={() => setSelectedOptions({ ...selectedOptions, [variation.name]: opt.value })}
                              className={cn(
                                "px-4 h-9 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all border",
                                opt.stock === 0
                                  ? "opacity-30 cursor-not-allowed line-through bg-slate-800 border-slate-700 text-slate-600"
                                  : selectedOptions[variation.name] === opt.value
                                  ? "bg-blue-600 text-white border-blue-600"
                                  : "bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-500"
                              )}
                            >
                              {opt.value}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
              </div>
              <div className="p-5 border-t border-slate-800">
                <button
                  onClick={() => addToCart(configProduct, selectedOptions)}
                  className="w-full h-12 bg-blue-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-blue-500 transition-all flex items-center justify-center gap-2"
                >
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
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCartMobile(false)}
              className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[150] lg:hidden"
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed inset-x-0 bottom-0 h-[90vh] bg-slate-900 rounded-t-[28px] shadow-2xl z-[151] lg:hidden flex flex-col overflow-hidden border-t border-slate-800"
            >
              <div className="w-10 h-1 bg-slate-700 rounded-full mx-auto my-4 shrink-0" />
              <div className="flex-1 overflow-hidden flex flex-col">
                <StandaloneCart
                  cart={cart}
                  updateQuantity={updateQuantity}
                  removeFromCart={removeFromCart}
                  customerName={customerName}
                  setCustomerName={setCustomerName}
                  paymentMethod={paymentMethod}
                  setPaymentMethod={setPaymentMethod}
                  discount={discount}
                  setDiscount={setDiscount}
                  subtotal={subtotal}
                  discountValue={discountValue}
                  total={total}
                  success={success}
                  finishing={finishing}
                  handleFinishSale={handleFinishSale}
                  onClose={() => setShowCartMobile(false)}
                />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── CART PANEL ──────────────────────────────────────────────────────────────
function StandaloneCart({
  cart, updateQuantity, removeFromCart, customerName, setCustomerName,
  paymentMethod, setPaymentMethod, discount, setDiscount,
  subtotal, discountValue, total, success, finishing, handleFinishSale, onClose,
}: {
  cart: CartItem[];
  updateQuantity: (id: string, delta: number) => void;
  removeFromCart: (id: string) => void;
  customerName: string;
  setCustomerName: (v: string) => void;
  paymentMethod: PaymentMethod;
  setPaymentMethod: (v: PaymentMethod) => void;
  discount: string;
  setDiscount: (v: string) => void;
  subtotal: number;
  discountValue: number;
  total: number;
  success: boolean;
  finishing: boolean;
  handleFinishSale: () => void;
  onClose?: () => void;
}) {
  const totalQty = cart.reduce((a, b) => a + b.quantity, 0);

  return (
    <>
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between shrink-0">
        <div>
          <h3 className="text-[11px] font-black uppercase tracking-widest text-white">Carrinho</h3>
          <span className="text-[9px] text-slate-600 font-bold uppercase tracking-widest">
            {totalQty} {totalQty === 1 ? "item" : "itens"}
          </span>
        </div>
        {onClose && (
          <button onClick={onClose} className="p-1.5 hover:bg-slate-800 rounded-full text-slate-600">
            <X size={18} />
          </button>
        )}
      </div>

      {/* Items */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        <AnimatePresence initial={false}>
          {cart.map((item) => (
            <motion.div
              key={item.cartItemId}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.15 }}
            >
              <div className="flex items-center gap-2 p-3 rounded-xl border border-slate-800 bg-slate-800/30">
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-black text-slate-200 uppercase truncate">{item.name}</p>
                  {item.variationLabel && (
                    <p className="text-[8px] font-bold text-slate-600 uppercase tracking-widest">{item.variationLabel}</p>
                  )}
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-[9px] font-mono text-slate-600">
                      R$ {item.price.toFixed(2)} × {item.quantity}
                    </p>
                    <p className="text-[10px] font-mono font-black text-white">
                      R$ {(item.price * item.quantity).toFixed(2)}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col items-center gap-1 shrink-0">
                  <div className="flex items-center gap-0.5 bg-slate-900 border border-slate-700 rounded-lg p-0.5">
                    <button onClick={() => updateQuantity(item.cartItemId, -1)} className="p-1 hover:bg-slate-700 rounded text-slate-500 transition-all">
                      <Minus size={10} />
                    </button>
                    <span className="w-5 text-center font-mono font-black text-[11px] text-white">{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(item.cartItemId, 1)}
                      disabled={item.quantity >= item.stock_quantity}
                      className="p-1 hover:bg-slate-700 rounded text-slate-500 transition-all disabled:opacity-20"
                    >
                      <Plus size={10} />
                    </button>
                  </div>
                  <button
                    onClick={() => removeFromCart(item.cartItemId)}
                    className="p-1 text-slate-700 hover:text-red-500 transition-all"
                  >
                    <Trash2 size={11} />
                  </button>
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
      <div className="shrink-0 border-t border-slate-800 space-y-3 p-4">
        <div className="relative">
          <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-700" size={13} />
          <input
            type="text"
            placeholder="CLIENTE (OPCIONAL)"
            className="w-full pl-9 pr-3 h-9 bg-slate-800/50 border border-slate-700/50 rounded-lg focus:outline-none focus:border-blue-500 text-[9px] font-bold uppercase tracking-widest text-white placeholder:text-slate-700 transition-all"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-3 gap-1.5">
          {([
            { key: "money", label: "Dinheiro", Icon: Banknote },
            { key: "card", label: "Cartão", Icon: CreditCard },
            { key: "pix", label: "PIX", Icon: QrCode },
          ] as { key: PaymentMethod; label: string; Icon: React.ElementType }[]).map(({ key, label, Icon }) => (
            <button
              key={key}
              onClick={() => setPaymentMethod(key)}
              className={cn(
                "flex flex-col items-center justify-center gap-1 h-12 rounded-xl border text-[8px] font-black uppercase tracking-widest transition-all",
                paymentMethod === key
                  ? "bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-500/20"
                  : "bg-slate-800/50 border-slate-700/50 text-slate-600 hover:border-slate-500 hover:text-slate-400"
              )}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>

        <div className="relative">
          <Percent className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-700" size={13} />
          <input
            type="number"
            min="0"
            placeholder="DESCONTO (R$)"
            className="w-full pl-9 pr-3 h-9 bg-slate-800/50 border border-slate-700/50 rounded-lg focus:outline-none focus:border-blue-500 text-[9px] font-bold uppercase tracking-widest text-white placeholder:text-slate-700 transition-all [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
            value={discount}
            onChange={(e) => setDiscount(e.target.value)}
          />
        </div>

        <div className="space-y-1 pt-1">
          {discountValue > 0 && (
            <>
              <div className="flex justify-between text-[9px] font-bold uppercase tracking-widest text-slate-600">
                <span>Subtotal</span>
                <span className="font-mono">R$ {subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-[9px] font-bold uppercase tracking-widest text-emerald-500">
                <span>Desconto</span>
                <span className="font-mono">− R$ {discountValue.toFixed(2)}</span>
              </div>
            </>
          )}
          <div className="flex justify-between items-center">
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Total</span>
            <span className="text-2xl font-mono font-black text-white tracking-tight">
              R$ {total.toFixed(2)}
            </span>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {success ? (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 h-12 rounded-xl flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest"
            >
              <CheckCircle2 size={16} /> Venda Registrada!
            </motion.div>
          ) : (
            <motion.button
              key="btn"
              onClick={handleFinishSale}
              disabled={cart.length === 0 || finishing}
              className="w-full h-12 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-500 transition-all disabled:opacity-20 shadow-xl shadow-blue-500/20 active:scale-[0.98] flex items-center justify-center gap-2"
            >
              {finishing ? <Loader2 size={16} className="animate-spin" /> : <><CreditCard size={16} /> Finalizar Venda</>}
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}
