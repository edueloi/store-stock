import React, { useState, useEffect, createContext, useContext } from "react";
import { Routes, Route, Link, useParams, useNavigate, useLocation } from "react-router-dom";
import { ShoppingCart, Menu, X, Search, Home, Grid3X3, Info, Phone } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../../lib/utils";
import { Tenant, Product, Category } from "../../types";
import WhatsAppWidget from "../../components/store/WhatsAppWidget";
import { buildStorePath, resolveStoreSlug } from "./store-routing";

// ── Store pages
import StoreFront from "./pages/StoreFront";
import StoreCatalog from "./pages/StoreCatalog";
import StoreProduct from "./pages/StoreProduct";
import StoreAbout from "./pages/StoreAbout";

// ── Store Context ──────────────────────────────────────────────────────────

interface CartItem extends Product {
  quantity: number;
  cartItemId: string;
  selectedOptions?: Record<string, string>;
  variationLabel?: string;
}

interface StoreContextValue {
  tenant: Tenant;
  categories: Category[];
  products: Product[];
  cart: CartItem[];
  addToCart: (product: Product, options?: Record<string, string>) => void;
  updateQuantity: (cartItemId: string, delta: number) => void;
  removeFromCart: (cartItemId: string) => void;
  style: StoreStyle;
  openCart: () => void;
}

export interface StoreStyle {
  accent: string;
  bg: string;
  card: string;
  text: string;
  radius: string;
  font: string;
}

export const StoreContext = createContext<StoreContextValue | null>(null);
export const useStore = () => {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be inside StoreLayout");
  return ctx;
};

// ── Style presets ──────────────────────────────────────────────────────────

const templates: Record<string, StoreStyle> = {
  minimal:  { bg: "bg-[#f8fafc]",   card: "bg-white border-slate-100",        accent: "#2563eb", text: "text-slate-900",  font: "font-sans",  radius: "rounded-2xl" },
  cyber:    { bg: "bg-black",        card: "bg-slate-900 border-slate-800",    accent: "#00ff7f", text: "text-white",      font: "font-mono",  radius: "rounded-none" },
  organic:  { bg: "bg-[#fefaf6]",   card: "bg-white border-orange-100",       accent: "#d97706", text: "text-stone-800",  font: "font-sans",  radius: "rounded-[2rem]" },
  luxury:   { bg: "bg-[#0a0a0a]",   card: "bg-[#111] border-yellow-500/10",  accent: "#c5a059", text: "text-stone-200",  font: "font-serif", radius: "rounded-lg" },
  tech:     { bg: "bg-[#f4f6fb]",   card: "bg-white border-slate-200",       accent: "#0ea5e9", text: "text-slate-900",  font: "font-sans",  radius: "rounded-2xl" },
  nexus_tech: { bg: "tech-shell bg-[#f4f8ff]", card: "bg-white/90 border-[#d7e4ff]", accent: "#2563eb", text: "text-[#071426]", font: "font-tech", radius: "rounded-[2rem]" },
  atelier:  { bg: "fashion-shell bg-[#fffaf5]", card: "bg-white/90 border-[#eadbd0]", accent: "#a26157", text: "text-[#2d221f]", font: "font-editorial", radius: "rounded-[2rem]" },
};

// ── Main Layout ────────────────────────────────────────────────────────────

function StoreLayoutInner() {
  const { slug: routeSlug } = useParams();
  const location = useLocation();
  const [storeData, setStoreData] = useState<{ tenant: Tenant; categories: Category[]; products: Product[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const navigate = useNavigate();
  const storeSlug = resolveStoreSlug(routeSlug);
  const storePath = (suffix = "") => buildStorePath(storeSlug, suffix);

  useEffect(() => {
    const endpoint = storeSlug ? `/api/public/store/${storeSlug}` : "/api/public/store";

    fetch(endpoint)
      .then(r => r.json())
      .then(data => {
        if (data && !data.error) {
          setStoreData({
            tenant: data.tenant,
            categories: Array.isArray(data.categories) ? data.categories : [],
            products: Array.isArray(data.products) ? data.products : [],
          });
        }
        setLoading(false);
      });
  }, [storeSlug]);

  const addToCart = (product: Product, options?: Record<string, string>) => {
    const variationLabel = options ? Object.entries(options).map(([k, v]) => `${k}: ${v}`).join(", ") : "";
    const cartItemId = options ? `${product.id}-${variationLabel}` : `${product.id}`;
    setCart(prev => {
      const existing = prev.find(i => i.cartItemId === cartItemId);
      if (existing) return prev.map(i => i.cartItemId === cartItemId ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { ...product, quantity: 1, cartItemId, selectedOptions: options, variationLabel }];
    });
    setIsCartOpen(true);
  };

  const updateQuantity = (cartItemId: string, delta: number) => {
    setCart(prev => prev.map(i => i.cartItemId === cartItemId ? { ...i, quantity: Math.max(1, i.quantity + delta) } : i));
  };

  const removeFromCart = (cartItemId: string) => {
    setCart(prev => prev.filter(i => i.cartItemId !== cartItemId));
  };

  const total = cart.reduce((acc, i) => acc + Number(i.price) * i.quantity, 0);
  const cartCount = cart.reduce((acc, i) => acc + i.quantity, 0);

  const handleWhatsAppCheckout = () => {
    const lines = cart.map(i => {
      const skuPart = i.sku ? ` [Cód: ${i.sku}]` : "";
      const varPart = i.variationLabel ? ` (${i.variationLabel})` : "";
      const unitPrice = Number(i.price).toFixed(2);
      const lineTotal = (Number(i.price) * i.quantity).toFixed(2);
      return `*${i.quantity}x* ${i.name}${skuPart}${varPart}%0A   Unitário: R$ ${unitPrice} · Total: R$ ${lineTotal}`;
    });
    const msg = `Olá! Gostaria de fazer um pedido:%0A%0A${lines.join("%0A%0A")}%0A%0A*Total do pedido: R$ ${total.toFixed(2)}*%0A%0AFavor confirmar disponibilidade.`;
    window.open(`https://wa.me/${storeData?.tenant.whatsapp?.replace(/\D/g, "")}?text=${msg}`, "_blank");
  };

  if (loading) {
    return (
      <div className="h-screen flex flex-col items-center justify-center gap-4 bg-white">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Carregando loja...</p>
      </div>
    );
  }

  if (!storeData) {
    return (
      <div className="h-screen flex flex-col items-center justify-center gap-3 bg-white">
        <p className="text-2xl font-black text-slate-800">404</p>
        <p className="text-sm text-slate-500">Loja não encontrada</p>
      </div>
    );
  }

  const style: StoreStyle = {
    ...(templates[storeData.tenant.template_id || "minimal"] || templates.minimal),
    accent: storeData.tenant.primary_color || templates[storeData.tenant.template_id || "minimal"]?.accent || "#2563eb",
  };
  const isDark = ["cyber", "luxury"].includes(storeData.tenant.template_id || "");
  const isFashion = style.font === "font-editorial";
  const isTechNova = style.font === "font-tech";

  const navLinks = [
    { label: "Início", path: storePath(), icon: <Home size={15} /> },
    { label: "Catálogo", path: storePath("/catalogo"), icon: <Grid3X3 size={15} /> },
    { label: "Sobre", path: storePath("/sobre"), icon: <Info size={15} /> },
  ];

  const isActive = (path: string) => {
    if (path === storePath()) return location.pathname === path;
    return location.pathname.startsWith(path);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(storePath(`/catalogo?q=${encodeURIComponent(searchQuery.trim())}`));
      setSearchOpen(false);
      setSearchQuery("");
    }
  };

  const ctx: StoreContextValue = { tenant: storeData.tenant, categories: storeData.categories, products: storeData.products, cart, addToCart, updateQuantity, removeFromCart, style, openCart: () => setIsCartOpen(true) };

  return (
    <StoreContext.Provider value={ctx}>
      <div className={cn("min-h-screen", style.bg, style.text, style.font)}>

        {/* ── NAVBAR ─────────────────────────────────────────────── */}
        <header className={cn("sticky top-0 z-50 border-b shadow-sm",
          isDark
            ? "bg-black border-slate-800"
            : isFashion
              ? "bg-[#fffaf5]/92 backdrop-blur-xl border-[#ead7cc]"
              : isTechNova
                ? "bg-[#f7fbff]/88 backdrop-blur-xl border-[#d7e4ff]"
                : "bg-white/95 backdrop-blur-md border-slate-200")}>
          <div className={cn("max-w-7xl mx-auto px-4 flex items-center justify-between gap-4", isFashion || isTechNova ? "h-20" : "h-16")}>

            {/* Logo */}
            <Link to={storePath()} className="flex items-center gap-3 shrink-0">
              <div
                style={{ backgroundColor: style.accent }}
                className={cn(
                  "flex items-center justify-center text-white font-black text-base overflow-hidden shrink-0",
                  isFashion
                    ? "w-11 h-11 shadow-md shadow-[#b5877d]/20"
                    : isTechNova
                      ? "w-11 h-11 tech-pulse shadow-[0_16px_35px_rgba(37,99,235,0.24)]"
                      : "w-9 h-9",
                  style.radius
                )}
              >
                {storeData.tenant.logo_url
                  ? <img src={storeData.tenant.logo_url} className="w-full h-full object-cover" alt="logo" />
                  : storeData.tenant.name.charAt(0)}
              </div>
              <div className="hidden sm:block">
                <p
                  className={cn(
                    "leading-none",
                    isFashion || isTechNova
                      ? "store-display text-2xl font-semibold tracking-[-0.04em]"
                      : "text-sm font-black uppercase tracking-wider"
                  )}
                  style={{ color: isDark ? "#fff" : isFashion ? "#2d221f" : isTechNova ? "#071426" : "#0f172a" }}
                >
                  {storeData.tenant.name}
                </p>
                <div className="flex items-center gap-1 mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span className={cn("text-[9px] font-bold text-slate-400", isFashion || isTechNova ? "store-kicker tracking-[0.28em]" : "uppercase tracking-wider")}>
                    {isFashion ? "Curadoria ativa" : isTechNova ? "Lançamentos ativos" : "Online"}
                  </span>
                </div>
              </div>
            </Link>

            {/* Desktop nav */}
            <nav className="hidden md:flex items-center gap-1">
              {navLinks.map(l => (
                <Link
                  key={l.path}
                  to={l.path}
                  className={cn(
                    "flex items-center gap-2 transition-all",
                    isFashion
                      ? "px-4 py-2 rounded-full text-[12px] font-semibold tracking-[0.02em]"
                      : isTechNova
                        ? "px-4 py-2 rounded-full border text-[11px] font-semibold tracking-[0.14em] uppercase"
                      : "px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider",
                    isActive(l.path)
                      ? "text-white shadow-sm"
                      : isFashion
                        ? "text-[#6f4b43] hover:text-[#2d221f] hover:bg-white"
                        : isTechNova
                          ? "border-[#dbe6ff] bg-white/72 text-[#456186] hover:text-[#071426] hover:border-[#b9cdfd] hover:bg-white"
                        : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
                  )}
                  style={isActive(l.path) ? { backgroundColor: style.accent } : {}}
                >
                  {l.icon} {l.label}
                </Link>
              ))}
              {/* Category quick links */}
              {storeData.categories.slice(0, 3).map(cat => (
                <Link
                  key={cat.id}
                  to={storePath(`/catalogo?cat=${cat.id}`)}
                  className={cn(
                    "transition-all",
                    isFashion
                      ? "px-3 py-2 rounded-full text-[11px] font-medium tracking-[0.02em] text-[#8c6c63] hover:text-[#2d221f] hover:bg-white"
                      : isTechNova
                        ? "px-3 py-2 rounded-full border border-transparent text-[10px] font-semibold uppercase tracking-[0.16em] text-[#557197] hover:border-[#d8e4ff] hover:bg-white/82 hover:text-[#071426]"
                      : "px-3 py-2 rounded-xl text-[11px] font-bold uppercase tracking-wider text-slate-400 hover:text-slate-700 hover:bg-slate-50"
                  )}
                >
                  {cat.name}
                </Link>
              ))}
            </nav>

            {/* Right actions */}
            <div className="flex items-center gap-2">
              {/* Search toggle */}
              <button
                onClick={() => setSearchOpen(v => !v)}
                className={cn(
                  "flex items-center justify-center border transition-all",
                  isFashion
                    ? "w-10 h-10 rounded-full border-[#e7d8ce] bg-white/80 text-[#7c5c54] hover:text-[#2d221f]"
                    : isTechNova
                      ? "w-10 h-10 rounded-full border-[#d7e4ff] bg-white/80 text-[#567298] hover:text-[#071426] hover:border-[#bfd0fb]"
                    : "w-9 h-9 rounded-xl border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-slate-50"
                )}
              >
                <Search size={15} />
              </button>

              {/* Cart */}
              <button
                onClick={() => setIsCartOpen(true)}
                style={{ backgroundColor: style.accent }}
                className={cn(
                  "flex items-center gap-2 text-white transition-all active:scale-95 relative",
                  isFashion
                    ? "h-10 px-4 md:px-5 rounded-full shadow-md shadow-[#b5877d]/25"
                    : isTechNova
                      ? "h-10 px-4 md:px-5 rounded-full shadow-[0_18px_40px_rgba(37,99,235,0.26)]"
                      : "h-9 px-3 md:px-4",
                  style.radius
                )}
              >
                <ShoppingCart size={15} />
                <span className={cn("hidden sm:inline", isFashion || isTechNova ? "text-[11px] font-semibold tracking-[0.08em]" : "text-[10px] font-black uppercase tracking-wider")}>Carrinho</span>
                {cartCount > 0 && (
                  <span className="bg-white text-slate-900 text-[9px] font-black px-1.5 py-0.5 rounded-full">
                    {cartCount}
                  </span>
                )}
              </button>

              {/* Mobile menu */}
              <button
                onClick={() => setMobileMenuOpen(v => !v)}
                className={cn(
                  "md:hidden flex items-center justify-center border",
                  isFashion
                    ? "w-10 h-10 rounded-full border-[#e7d8ce] bg-white/80 text-[#7c5c54]"
                    : isTechNova
                      ? "w-10 h-10 rounded-full border-[#d7e4ff] bg-white/80 text-[#567298]"
                      : "w-9 h-9 rounded-xl border-slate-200 text-slate-500"
                )}
              >
                {mobileMenuOpen ? <X size={16} /> : <Menu size={16} />}
              </button>
            </div>
          </div>

          {/* Search bar expand */}
          <AnimatePresence>
            {searchOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className={cn("overflow-hidden border-t", isFashion ? "border-[#eeded4]" : isTechNova ? "border-[#dbe6ff]" : "border-slate-100")}
              >
                <form onSubmit={handleSearch} className="max-w-7xl mx-auto px-4 py-3 flex gap-2">
                  <div className="flex-1 relative">
                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      autoFocus
                      type="text"
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      placeholder="Buscar produtos, categorias..."
                      className={cn(
                        "w-full pl-9 pr-4 h-10 text-sm outline-none transition-all",
                        isFashion
                          ? "bg-white border border-[#ead7cc] rounded-full focus:border-[#c48a80] focus:ring-2 focus:ring-[#efd7d1]"
                          : isTechNova
                            ? "bg-white/90 border border-[#d7e4ff] rounded-full focus:border-[#7aa2ff] focus:ring-2 focus:ring-[#dce8ff]"
                          : "bg-slate-50 border border-slate-200 rounded-xl focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                      )}
                    />
                  </div>
                  <button
                    type="submit"
                    style={{ backgroundColor: style.accent }}
                    className={cn("h-10 px-5 text-white text-xs font-black uppercase tracking-wider", isFashion || isTechNova ? "rounded-full" : "rounded-xl")}
                  >
                    Buscar
                  </button>
                  <button
                    type="button"
                    onClick={() => setSearchOpen(false)}
                    className={cn("h-10 w-10 flex items-center justify-center border text-slate-400", isFashion ? "border-[#ead7cc] rounded-full" : isTechNova ? "border-[#d7e4ff] rounded-full" : "border-slate-200 rounded-xl")}
                  >
                    <X size={15} />
                  </button>
                </form>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Mobile menu */}
          <AnimatePresence>
            {mobileMenuOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className={cn("md:hidden overflow-hidden border-t", isFashion ? "border-[#eeded4] bg-[#fffaf5]" : isTechNova ? "border-[#dbe6ff] bg-[#f7fbff]" : "border-slate-100 bg-white")}
              >
                <nav className="px-4 py-3 space-y-1">
                  {navLinks.map(l => (
                    <Link
                      key={l.path}
                      to={l.path}
                      onClick={() => setMobileMenuOpen(false)}
                      className={cn(
                        "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all",
                        isActive(l.path)
                          ? "text-white"
                          : isTechNova
                            ? "text-[#28466b] hover:bg-white"
                            : "text-slate-700 hover:bg-slate-50"
                      )}
                      style={isActive(l.path) ? { backgroundColor: style.accent } : {}}
                    >
                      {l.icon} {l.label}
                    </Link>
                  ))}
                  <div className="pt-2 border-t border-slate-100">
                    <p className={cn("text-[10px] font-black uppercase tracking-widest px-4 mb-1", isTechNova ? "text-[#7690b3]" : "text-slate-400")}>Categorias</p>
                    {storeData.categories.map(cat => (
                      <Link
                        key={cat.id}
                        to={storePath(`/catalogo?cat=${cat.id}`)}
                        onClick={() => setMobileMenuOpen(false)}
                        className={cn("flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm transition-all", isTechNova ? "text-[#466485] hover:bg-white" : "text-slate-600 hover:bg-slate-50")}
                      >
                        {cat.name}
                      </Link>
                    ))}
                  </div>
                </nav>
              </motion.div>
            )}
          </AnimatePresence>
        </header>

        {/* ── PAGES ──────────────────────────────────────────────── */}
        <main>
          <Routes>
            <Route index element={<StoreFront />} />
            <Route path="catalogo" element={<StoreCatalog />} />
            <Route path="produto/:productId" element={<StoreProduct />} />
            <Route path="sobre" element={<StoreAbout />} />
          </Routes>
        </main>

        {/* ── FOOTER ─────────────────────────────────────────────── */}
        <footer className={cn(
          "mt-20 border-t",
          isFashion
            ? "bg-[#f7ede5] text-[#5e453d] border-[#e6d5ca]"
            : isTechNova
              ? "bg-[linear-gradient(180deg,#eef4ff_0%,#f8fbff_100%)] text-[#314b70] border-[#dbe6ff]"
              : "bg-slate-900 text-slate-300 border-transparent"
        )}>
          <div className="max-w-7xl mx-auto px-6 py-12 grid grid-cols-1 sm:grid-cols-3 gap-10">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div style={{ backgroundColor: style.accent }} className={cn("w-9 h-9 flex items-center justify-center text-white font-black", style.radius)}>
                  {storeData.tenant.name.charAt(0)}
                </div>
                <h4 className={cn(isFashion || isTechNova ? "store-display text-3xl font-semibold" : "font-black uppercase tracking-wider text-white", isFashion ? "text-[#2d221f]" : isTechNova ? "text-[#071426]" : "text-white")}>{storeData.tenant.name}</h4>
              </div>
              <p className={cn("text-xs leading-relaxed", isFashion ? "text-[#7d6259]" : isTechNova ? "text-[#5d7698]" : "text-slate-500")}>
                {storeData.tenant.footer_text || (isFashion ? "Moda e acessórios apresentados com uma experiência elegante, leve e atual." : isTechNova ? "Tecnologia, desempenho e produtos conectados em uma vitrine clara, moderna e pronta para vender mais." : "Excelência em catálogo digital.")}
              </p>
            </div>
            <div>
              <p className={cn("mb-4", isFashion ? "store-kicker text-[10px] font-semibold text-[#9a7d73]" : isTechNova ? "store-kicker text-[10px] font-semibold text-[#6d89b0]" : "text-[10px] font-black uppercase tracking-widest text-slate-400")}>Navegação</p>
              <ul className="space-y-2">
                {navLinks.map(l => (
                  <li key={l.path}>
                    <Link to={l.path} className={cn("text-xs transition-colors font-medium", isFashion ? "text-[#6b5149] hover:text-[#2d221f]" : isTechNova ? "text-[#5d7698] hover:text-[#071426]" : "text-slate-500 hover:text-white")}>
                      {l.label}
                    </Link>
                  </li>
                ))}
                {storeData.categories.map(cat => (
                  <li key={cat.id}>
                    <Link to={storePath(`/catalogo?cat=${cat.id}`)} className={cn("text-xs transition-colors font-medium", isFashion ? "text-[#6b5149] hover:text-[#2d221f]" : isTechNova ? "text-[#5d7698] hover:text-[#071426]" : "text-slate-500 hover:text-white")}>
                      {cat.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className={cn("mb-4", isFashion ? "store-kicker text-[10px] font-semibold text-[#9a7d73]" : isTechNova ? "store-kicker text-[10px] font-semibold text-[#6d89b0]" : "text-[10px] font-black uppercase tracking-widest text-slate-400")}>Contato</p>
              {storeData.tenant.whatsapp && (
                <a
                  href={`https://wa.me/${storeData.tenant.whatsapp.replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn("flex items-center gap-3 transition-colors", isFashion ? "text-[#6b5149] hover:text-[#2d221f]" : isTechNova ? "text-[#4f6c91] hover:text-[#071426]" : "text-slate-400 hover:text-white")}
                >
                  <div style={{ backgroundColor: "#25D366" }} className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0">
                    <Phone size={14} className="text-white" />
                  </div>
                  <div>
                    <p className={cn("text-[9px] font-bold uppercase tracking-wider", isFashion ? "text-[#8d7068]" : isTechNova ? "text-[#7b95ba]" : "text-slate-500")}>WhatsApp</p>
                    <p className={cn("text-sm font-mono font-bold", isFashion ? "text-[#2d221f]" : isTechNova ? "text-[#071426]" : "text-white")}>+{storeData.tenant.whatsapp}</p>
                  </div>
                </a>
              )}
              {storeData.tenant.address && (
                <p className={cn("text-xs mt-4", isFashion ? "text-[#7d6259]" : isTechNova ? "text-[#5d7698]" : "text-slate-500")}>{storeData.tenant.address}</p>
              )}
            </div>
          </div>
          <div className={cn("py-5", isFashion ? "border-t border-[#e4cfc4]" : isTechNova ? "border-t border-[#dbe6ff]" : "border-t border-slate-800")}>
            <p className={cn("text-center text-[10px] font-bold uppercase tracking-widest", isFashion ? "text-[#9a7d73]" : isTechNova ? "text-[#7b95ba]" : "text-slate-600")}>
              © {new Date().getFullYear()} {storeData.tenant.name} · Powered by Nexus ERP
            </p>
          </div>
        </footer>

        {/* WhatsApp Widget */}
        <WhatsAppWidget
          whatsapp={storeData.tenant.whatsapp || ""}
          storeName={storeData.tenant.name}
          primaryColor={storeData.tenant.primary_color || "#25D366"}
        />

        {/* ── CART DRAWER ─────────────────────────────────────────── */}
        <AnimatePresence>
          {isCartOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={() => setIsCartOpen(false)}
                className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100]"
              />
              <motion.div
                initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
                transition={{ type: "spring", damping: 30, stiffness: 300 }}
                className={cn(
                  "fixed top-0 right-0 h-full w-full max-w-sm z-[101] shadow-2xl flex flex-col border-l",
                  isFashion
                    ? "bg-[#fffaf7] border-[#ead7cc]"
                    : isTechNova
                      ? "bg-[#f7fbff] border-[#d7e4ff]"
                      : "bg-white border-slate-200"
                )}
              >
                <div className="px-6 h-16 border-b border-slate-100 flex items-center justify-between shrink-0">
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-900">Carrinho</h3>
                    <p className="text-[10px] text-slate-400 font-medium">{cartCount} {cartCount === 1 ? "item" : "itens"}</p>
                  </div>
                  <button onClick={() => setIsCartOpen(false)} className="p-2 hover:bg-slate-50 rounded-xl text-slate-400">
                    <X size={18} />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                  {cart.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-4 py-20">
                      <ShoppingCart size={48} strokeWidth={1} className="opacity-20" />
                      <p className="text-xs font-black uppercase tracking-wider">Carrinho vazio</p>
                      <button
                        onClick={() => { setIsCartOpen(false); navigate(storePath("/catalogo")); }}
                        style={{ backgroundColor: style.accent }}
                        className="text-white px-6 h-10 rounded-xl text-[10px] font-black uppercase tracking-wider"
                      >
                        Ver produtos
                      </button>
                    </div>
                  ) : cart.map(item => (
                    <div key={item.cartItemId} className="flex gap-3 p-3 bg-slate-50 border border-slate-100 rounded-2xl">
                      <div className="w-16 h-16 bg-white rounded-xl overflow-hidden border border-slate-100 shrink-0 flex items-center justify-center">
                        {item.image_url
                          ? <img src={item.image_url} className="w-full h-full object-cover" alt={item.name} />
                          : <ShoppingCart size={18} className="text-slate-200" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-[11px] font-black uppercase text-slate-800 leading-tight line-clamp-2">{item.name}</h4>
                        {item.sku && (
                          <p className="text-[9px] text-slate-400 mt-0.5 font-mono uppercase tracking-widest">Cód: {item.sku}</p>
                        )}
                        {item.variationLabel && (
                          <p className="text-[9px] text-slate-500 mt-0.5 font-bold uppercase">{item.variationLabel}</p>
                        )}
                        <div className="flex items-center gap-2 mt-1">
                          <p className="text-[10px] text-slate-400 font-mono">R$ {Number(item.price).toFixed(2)} un.</p>
                          <span className="text-slate-200">·</span>
                          <p className="text-xs font-black text-emerald-600 font-mono">
                            R$ {(Number(item.price) * item.quantity).toFixed(2)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-2 py-1">
                            <button onClick={() => updateQuantity(item.cartItemId, -1)} className="text-slate-400 hover:text-slate-700">
                              <span className="text-sm font-black">−</span>
                            </button>
                            <span className="text-xs font-black w-4 text-center">{item.quantity}</span>
                            <button onClick={() => updateQuantity(item.cartItemId, 1)} className="text-slate-400 hover:text-slate-700">
                              <span className="text-sm font-black">+</span>
                            </button>
                          </div>
                          <button onClick={() => removeFromCart(item.cartItemId)} className="text-slate-300 hover:text-red-500 transition-colors">
                            <X size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {cart.length > 0 && (
                  <div className={cn(
                    "p-4 space-y-3",
                    isFashion
                      ? "bg-[#2d221f] border-t border-[#4f3831]"
                      : isTechNova
                        ? "bg-white border-t border-[#d7e4ff]"
                        : "bg-slate-950 border-t border-white/5"
                  )}>
                    <div className="flex items-center justify-between">
                      <p className={cn("text-xs font-bold uppercase tracking-wider", isTechNova ? "text-[#7b95ba]" : "text-slate-400")}>Total</p>
                      <p className={cn("text-2xl font-black font-mono", isTechNova ? "text-[#071426]" : "text-white")}>R$ {total.toFixed(2)}</p>
                    </div>
                    <button
                      onClick={handleWhatsAppCheckout}
                      className="w-full bg-[#25D366] text-white h-12 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-[#1db954] transition-all"
                    >
                      <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                      </svg>
                      Fechar Pedido via WhatsApp
                    </button>
                  </div>
                )}
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Mobile floating cart */}
        {cart.length > 0 && !isCartOpen && (
          <motion.div initial={{ y: 100 }} animate={{ y: 0 }} className="fixed bottom-24 right-4 z-40 sm:hidden">
            <button
              onClick={() => setIsCartOpen(true)}
              style={{ backgroundColor: style.accent }}
              className={cn("h-12 px-5 text-white shadow-2xl flex items-center gap-3 font-black text-xs uppercase tracking-wider", isFashion || isTechNova ? "rounded-full" : "rounded-2xl")}
            >
              <ShoppingCart size={16} />
              {cartCount} itens · R$ {total.toFixed(2)}
            </button>
          </motion.div>
        )}

      </div>
    </StoreContext.Provider>
  );
}

export default function StoreLayout() {
  return <StoreLayoutInner />;
}
