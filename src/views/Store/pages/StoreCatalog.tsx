import React, { useState, useRef, useEffect } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import StoreSEO from "../../../components/store/StoreSEO";
import { motion, AnimatePresence } from "motion/react";
import {
  Search, X, LayoutGrid, List, ArrowUpDown, Check,
  ChevronDown, Tag, Package, Heart, Eye, Plus, Flame, SlidersHorizontal,
} from "lucide-react";
import { cn } from "../../../lib/utils";
import { useStore } from "../StoreLayout";
import { Product } from "../../../types";

type SortKey = "default" | "price_asc" | "price_desc" | "name";
type ViewMode = "grid" | "list";

export default function StoreCatalog() {
  const { slug } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { categories, products, addToCart, style, tenant } = useStore();
  const isFashion = tenant.template_id === "atelier";
  const isTechNova = tenant.template_id === "nexus_tech";

  const [searchTerm, setSearchTerm] = useState(searchParams.get("q") || "");
  const [selectedCategory, setSelectedCategory] = useState<number | null>(
    searchParams.get("cat") ? Number(searchParams.get("cat")) : null
  );
  const [sortBy, setSortBy] = useState<SortKey>("default");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [wishlist, setWishlist] = useState<number[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const sortRef = useRef<HTMLDivElement>(null);

  // Sync URL params → state
  useEffect(() => {
    const q = searchParams.get("q") || "";
    const cat = searchParams.get("cat") ? Number(searchParams.get("cat")) : null;
    setSearchTerm(q);
    setSelectedCategory(cat);
  }, [searchParams]);

  // Close sort menu on outside click
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) setShowSortMenu(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const updateParams = (key: string, val: string | null) => {
    const p = new URLSearchParams(searchParams);
    if (val) p.set(key, val); else p.delete(key);
    setSearchParams(p, { replace: true });
  };

  const filtered = products
    .filter(p => p.is_active)
    .filter(p =>
      (searchTerm === "" || p.name.toLowerCase().includes(searchTerm.toLowerCase())) &&
      (selectedCategory === null || p.category_id === selectedCategory)
    )
    .sort((a, b) => {
      if (sortBy === "price_asc") return Number(a.price) - Number(b.price);
      if (sortBy === "price_desc") return Number(b.price) - Number(a.price);
      if (sortBy === "name") return a.name.localeCompare(b.name);
      return (b.is_featured ? 1 : 0) - (a.is_featured ? 1 : 0);
    });

  const toggleWishlist = (id: number) =>
    setWishlist(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const sortLabels: Record<SortKey, string> = {
    default: "Relevância",
    price_asc: "Menor preço",
    price_desc: "Maior preço",
    name: "A → Z",
  };

  const catName = selectedCategory
    ? categories.find(c => c.id === selectedCategory)?.name
    : null;

  const pageTitle = catName ? `${catName} — ${tenant.name}` : `Catálogo — ${tenant.name}`;
  const saleCount = products.filter(p => p.is_active && p.discount_price).length;

  return (
    <div className={cn("max-w-7xl mx-auto px-4 md:px-6 py-8", (isFashion || isTechNova) && "space-y-6")}>
      <StoreSEO
        title={pageTitle}
        description={`Confira ${catName ? `produtos de ${catName}` : "todo o catálogo"} da loja ${tenant.name}.`}
        url={typeof window !== "undefined" ? window.location.href : ""}
        siteName={tenant.name}
      />

      {isTechNova ? (
        <div className="tech-panel overflow-hidden rounded-[2rem] border border-[#dbe6ff] bg-[linear-gradient(135deg,#fbfdff_0%,#f2f7ff_55%,#eef4ff_100%)] p-5 sm:p-6 md:p-8">
          <div className="tech-grid rounded-[1.6rem] border border-white/70 bg-white/42 p-4 sm:p-5 md:p-6">
            <p className="store-kicker text-[10px] font-semibold text-[#6f89ad]">Catálogo inteligente</p>
            <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <h1 className="store-display text-[2.8rem] sm:text-5xl md:text-6xl leading-[0.9] text-[#071426]">
                  {catName || "Linha completa"}
                </h1>
                <p className="mt-3 max-w-2xl text-[14px] sm:text-sm md:text-base leading-relaxed text-[#5d789a]">
                  Explore eletrônicos, informática e acessórios em uma grade clara, rápida de ler e pronta para destacar preço, oferta e variações.
                </p>
              </div>
              <div className="grid grid-cols-2 min-[430px]:grid-cols-3 gap-3 text-center">
                {[
                  { value: filtered.length, label: "Itens" },
                  { value: categories.length, label: "Linhas" },
                  { value: saleCount, label: "Ofertas" },
                ].map((item) => (
                  <div key={item.label} className="rounded-[1.4rem] border border-[#dbe6ff] bg-white/80 px-3 sm:px-4 py-3 tech-soft-shadow">
                    <p className="store-display text-[2rem] sm:text-3xl leading-none" style={{ color: style.accent }}>{item.value}</p>
                    <p className="mt-2 text-[9px] font-semibold uppercase tracking-[0.22em] text-[#6f89ad]">{item.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : isFashion ? (
        <div className="fashion-panel overflow-hidden rounded-[2rem] border border-[#ead9ce] bg-[linear-gradient(135deg,#fff8f3_0%,#f7ece4_55%,#fffdfb_100%)] p-5 sm:p-6 md:p-8">
          <p className="store-kicker text-[10px] font-semibold text-[#9d6d63]">Catálogo editorial</p>
          <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="store-display text-[2.8rem] sm:text-5xl md:text-6xl leading-[0.9] text-[#2d221f]">
                {catName || "Coleção completa"}
              </h1>
              <p className="mt-3 max-w-2xl text-[14px] sm:text-sm md:text-base leading-relaxed text-[#6b5149]">
                Explore peças com uma vitrine pensada para roupas e acessórios, com foco em imagem, leitura clara e navegação leve.
              </p>
            </div>
            <div className="grid grid-cols-2 min-[430px]:grid-cols-3 gap-3 text-center">
              {[
                { value: filtered.length, label: "Peças" },
                { value: categories.length, label: "Linhas" },
                { value: saleCount, label: "Ofertas" },
              ].map((item) => (
                <div key={item.label} className="rounded-[1.4rem] border border-[#ead9ce] bg-white/78 px-3 sm:px-4 py-3">
                  <p className="store-display text-[2rem] sm:text-3xl leading-none" style={{ color: style.accent }}>{item.value}</p>
                  <p className="mt-2 text-[9px] font-semibold uppercase tracking-[0.22em] text-[#8c6c63]">{item.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {/* Breadcrumb */}
      <nav className={cn("flex items-center gap-2 text-[10px] font-bold uppercase mb-6", isFashion ? "text-[#9c7b72] tracking-[0.24em]" : isTechNova ? "text-[#7c96b8] tracking-[0.22em]" : "text-slate-400 tracking-wider")}>
        <Link to={`/s/${slug}`} className="hover:text-slate-700 transition-colors">Início</Link>
        <span>/</span>
        <span className={cn(isTechNova ? "text-[#071426]" : "text-slate-700")}>Catálogo</span>
        {catName && <><span>/</span><span style={{ color: style.accent }}>{catName}</span></>}
      </nav>

      <div className="flex gap-6">

        {/* ── SIDEBAR ──────────────────────────────────────────── */}
        {/* Desktop */}
        <aside className="hidden lg:flex flex-col gap-2 w-56 shrink-0">
          <p className={cn("text-[10px] font-black uppercase tracking-widest px-3 mb-1", isTechNova ? "text-[#7c96b8]" : "text-slate-400")}>Filtrar por</p>

          <button
            onClick={() => { setSelectedCategory(null); updateParams("cat", null); }}
            className={cn("flex items-center justify-between px-3 py-2.5 text-xs font-bold transition-all",
              isTechNova ? "rounded-[1rem] border border-[#dbe6ff]" : "rounded-xl",
              selectedCategory === null ? "text-white shadow-sm border-transparent" : isTechNova ? "text-[#476585] bg-white/72 hover:bg-white" : "text-slate-600 hover:bg-slate-100")}
            style={selectedCategory === null ? { backgroundColor: style.accent } : {}}
          >
            <span className="flex items-center gap-2"><LayoutGrid size={13} /> Todos</span>
            <span className={cn("text-[10px] font-black px-1.5 py-0.5 rounded-full",
              selectedCategory === null ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500")}>
              {products.filter(p => p.is_active).length}
            </span>
          </button>

          {categories.map(cat => {
            const count = products.filter(p => p.is_active && p.category_id === cat.id).length;
            const active = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => { setSelectedCategory(cat.id); updateParams("cat", String(cat.id)); }}
                className={cn("flex items-center justify-between px-3 py-2.5 text-xs font-bold transition-all",
                  isTechNova ? "rounded-[1rem] border border-[#dbe6ff]" : "rounded-xl",
                  active ? "text-white shadow-sm border-transparent" : isTechNova ? "text-[#476585] bg-white/72 hover:bg-white" : "text-slate-600 hover:bg-slate-100")}
                style={active ? { backgroundColor: style.accent } : {}}
              >
                <span className="flex items-center gap-2 truncate"><Tag size={13} className="shrink-0" /> <span className="truncate">{cat.name}</span></span>
                <span className={cn("text-[10px] font-black px-1.5 py-0.5 rounded-full shrink-0",
                  active ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500")}>{count}</span>
              </button>
            );
          })}

          {/* Price range hint */}
          {products.length > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-200">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-3 mb-2">Faixa de preço</p>
              <div className="px-3 space-y-1.5">
                {[
                  ["Até R$ 50", 0, 50],
                  ["R$ 50–200", 50, 200],
                  ["R$ 200–500", 200, 500],
                  ["Acima de R$ 500", 500, Infinity],
                ].map(([label, min, max]) => {
                  const count = products.filter(p => p.is_active && Number(p.price) >= (min as number) && Number(p.price) < (max as number)).length;
                  if (count === 0) return null;
                  return (
                    <button
                      key={label as string}
                      onClick={() => {
                        // Simple: filter by search but we note the range for UX only
                      }}
                      className="flex items-center justify-between w-full text-[10px] text-slate-500 hover:text-slate-800 transition-colors py-0.5"
                    >
                      <span className="font-medium">{label as string}</span>
                      <span className="text-[9px] bg-slate-100 px-1.5 py-0.5 rounded-full font-bold">{count}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </aside>

        {/* ── MAIN ─────────────────────────────────────────────── */}
        <div className="flex-1 min-w-0 space-y-5">

          {/* Toolbar */}
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">

            {/* Search */}
            <div className="flex-1 relative group w-full">
              <Search size={15} className={cn("absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors", isTechNova ? "text-[#7d97ba] group-focus-within:text-[#2563eb]" : "text-slate-400 group-focus-within:text-blue-500")} />
              <input
                type="text"
                placeholder="Buscar produtos..."
                value={searchTerm}
                onChange={e => { setSearchTerm(e.target.value); updateParams("q", e.target.value || null); }}
                className={cn(
                  "w-full pl-10 pr-9 h-10 text-sm font-medium outline-none transition-all",
                  isTechNova
                    ? "bg-white/84 border border-[#dbe6ff] rounded-full placeholder:text-[#9eb1cc] focus:border-[#7aa2ff] focus:ring-2 focus:ring-[#dce8ff]"
                    : "bg-white border border-slate-200 rounded-xl placeholder:text-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                )}
              />
              {searchTerm && (
                <button onClick={() => { setSearchTerm(""); updateParams("q", null); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700">
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Mobile filter button */}
            <button
              onClick={() => setSidebarOpen(v => !v)}
              className={cn("lg:hidden flex items-center gap-2 h-10 px-3 text-xs font-bold", isTechNova ? "border border-[#dbe6ff] bg-white/82 rounded-full text-[#4f6d92]" : "border border-slate-200 bg-white rounded-xl text-slate-600")}
            >
              <SlidersHorizontal size={14} /> Filtros
              {selectedCategory !== null && (
                <span style={{ backgroundColor: style.accent }} className="w-4 h-4 rounded-full text-white text-[8px] font-black flex items-center justify-center">1</span>
              )}
            </button>

            <div className="flex items-center gap-2 shrink-0">
              {/* Sort */}
              <div ref={sortRef} className="relative">
                <button
                  onClick={() => setShowSortMenu(v => !v)}
                  className={cn("flex items-center gap-2 h-10 px-3 text-xs font-bold transition-all", isTechNova ? "border border-[#dbe6ff] bg-white/82 rounded-full text-[#4f6d92] hover:border-[#bfd2ff]" : "border border-slate-200 bg-white rounded-xl text-slate-600 hover:border-slate-300")}
                >
                  <ArrowUpDown size={13} />
                  <span className="hidden sm:inline">{sortLabels[sortBy]}</span>
                  <ChevronDown size={12} className={cn("transition-transform", showSortMenu && "rotate-180")} />
                </button>
                <AnimatePresence>
                  {showSortMenu && (
                    <motion.div
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      className="absolute right-0 top-full mt-2 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 min-w-[180px] py-1"
                    >
                      {(Object.entries(sortLabels) as [SortKey, string][]).map(([val, label]) => (
                        <button
                          key={val}
                          onClick={() => { setSortBy(val); setShowSortMenu(false); }}
                          className="w-full flex items-center justify-between gap-3 px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                        >
                          {label}
                          {sortBy === val && <Check size={12} className="text-blue-600" />}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* View toggle */}
              <div className={cn("flex h-10 overflow-hidden", isTechNova ? "bg-white/82 border border-[#dbe6ff] rounded-full" : "bg-white border border-slate-200 rounded-xl")}>
                {(["grid", "list"] as ViewMode[]).map(mode => (
                  <button
                    key={mode}
                    onClick={() => setViewMode(mode)}
                    className={cn("w-10 flex items-center justify-center transition-all",
                      viewMode === mode ? "text-white" : "text-slate-400 hover:text-slate-700")}
                    style={viewMode === mode ? { backgroundColor: style.accent } : {}}
                  >
                    {mode === "grid" ? <LayoutGrid size={14} /> : <List size={14} />}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Mobile categories */}
          <div className="flex lg:hidden gap-2 overflow-x-auto pb-1 no-scrollbar">
            {[{ id: null as number | null, name: "Todos" }, ...categories].map((cat, i) => (
              <button
                key={i}
                onClick={() => { setSelectedCategory(cat.id); updateParams("cat", cat.id ? String(cat.id) : null); }}
                style={selectedCategory === cat.id ? { backgroundColor: style.accent } : {}}
                className={cn("px-3 h-8 whitespace-nowrap font-bold text-[10px] uppercase tracking-wider rounded-full border shrink-0 transition-all",
                  selectedCategory === cat.id ? "text-white border-transparent" : isTechNova ? "bg-white/82 text-[#5b789e] border-[#dbe6ff]" : "bg-white text-slate-500 border-slate-200")}
              >
                {cat.name}
              </button>
            ))}
          </div>

          {/* Active filters */}
          {(selectedCategory !== null || searchTerm) && (
            <div className="flex flex-wrap items-center gap-2">
              <span className={cn("text-[10px] font-black uppercase tracking-wider", isTechNova ? "text-[#7c96b8]" : "text-slate-400")}>Filtros:</span>
              {catName && (
                <span className={cn("flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold", isTechNova ? "bg-white/80 border border-[#dbe6ff] text-[#2563eb]" : "bg-blue-50 border border-blue-200 text-blue-700")}>
                  {catName}
                  <button onClick={() => { setSelectedCategory(null); updateParams("cat", null); }}><X size={10} /></button>
                </span>
              )}
              {searchTerm && (
                <span className={cn("flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold", isTechNova ? "bg-white/80 border border-[#dbe6ff] text-[#5b789e]" : "bg-slate-100 border border-slate-200 text-slate-600")}>
                  "{searchTerm}"
                  <button onClick={() => { setSearchTerm(""); updateParams("q", null); }}><X size={10} /></button>
                </span>
              )}
              <button
                onClick={() => { setSelectedCategory(null); setSearchTerm(""); setSearchParams({}); }}
                className="text-[10px] font-bold text-red-500 hover:text-red-700 uppercase tracking-wider"
              >
                Limpar tudo
              </button>
            </div>
          )}

          {/* Result count */}
          <p className={cn("text-[10px] font-bold uppercase tracking-widest", isTechNova ? "text-[#7c96b8]" : "text-slate-400")}>
            {filtered.length} produto{filtered.length !== 1 ? "s" : ""} encontrado{filtered.length !== 1 ? "s" : ""}
          </p>

          {/* Empty */}
          {filtered.length === 0 && (
            <div className="py-24 flex flex-col items-center gap-4 text-slate-400">
              <Package size={48} strokeWidth={1} className="opacity-30" />
              <div className="text-center">
                <p className="text-sm font-black uppercase tracking-tight text-slate-700">Nenhum produto encontrado</p>
                <p className="text-xs text-slate-400 mt-1">Tente outros filtros ou termos</p>
              </div>
              <button
                onClick={() => { setSearchTerm(""); setSelectedCategory(null); setSearchParams({}); }}
                style={{ backgroundColor: style.accent }}
                className="text-white px-6 h-9 rounded-xl text-[11px] font-black uppercase tracking-wider"
              >
                Limpar filtros
              </button>
            </div>
          )}

          {/* GRID */}
          {viewMode === "grid" && filtered.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
              {filtered.map((product, i) => (
                <ProductCard key={product.id} product={product} index={i} slug={slug!} style={style} wishlist={wishlist} onWishlist={toggleWishlist} onAddToCart={addToCart} />
              ))}
            </div>
          )}

          {/* LIST */}
          {viewMode === "list" && filtered.length > 0 && (
            <div className="flex flex-col gap-3">
              {filtered.map((product, i) => (
                <ProductRow key={product.id} product={product} index={i} slug={slug!} style={style} wishlist={wishlist} onWishlist={toggleWishlist} onAddToCart={addToCart} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Product Card (Grid) ────────────────────────────────────────────────────

interface CardProps {
  key?: React.Key;
  product: Product;
  index: number;
  slug: string;
  style: { accent: string; card: string; radius: string; font?: string };
  wishlist: number[];
  onWishlist: (id: number) => void;
  onAddToCart: (p: Product) => void;
}

function ProductCard({ product, index, slug, style, wishlist, onWishlist, onAddToCart }: CardProps) {
  const discountPct = product.discount_price
    ? Math.round((1 - Number(product.discount_price) / Number(product.price)) * 100)
    : 0;
  const inWishlist = wishlist.includes(product.id);
  const allImages = Array.isArray(product.images) && product.images.length > 0
    ? product.images as string[]
    : product.image_url ? [product.image_url] : [];
  const primaryImage = allImages[0] ?? null;
  const isFashion = style.font === "font-editorial";
  const isTechNova = style.font === "font-tech";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.04, 0.4) }}
      className={cn(
        "group relative flex flex-col overflow-hidden border transition-all duration-300",
        isFashion ? "fashion-soft-shadow hover:-translate-y-1 hover:shadow-[0_26px_70px_rgba(108,64,55,0.12)]" : isTechNova ? "tech-soft-shadow tech-card-sheen hover:-translate-y-1 hover:shadow-[0_28px_70px_rgba(42,94,188,0.18)]" : "hover:shadow-xl",
        style.card,
        style.radius
      )}
    >
      <Link to={`/s/${slug}/produto/${product.id}`} className={cn("relative overflow-hidden block", isFashion ? "aspect-[4/5] bg-[#f8efe8]" : isTechNova ? "aspect-square tech-grid bg-[linear-gradient(180deg,#f8fbff_0%,#edf4ff_100%)]" : "aspect-square bg-slate-50")}>
        {primaryImage
          ? <img src={primaryImage} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
          : <div className="w-full h-full flex items-center justify-center text-slate-200"><Package size={48} strokeWidth={1} /></div>}
        {allImages.length > 1 && (
          <div className="absolute bottom-2 left-2 bg-black/60 text-white text-[8px] font-black px-2 py-0.5 rounded-full backdrop-blur-sm flex items-center gap-1">
            <span>+{allImages.length - 1}</span> fotos
          </div>
        )}

        {/* Badges */}
        <div className="absolute top-2 left-2 flex flex-col gap-1">
          {discountPct > 0 && <span className="bg-red-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full">-{discountPct}%</span>}
          {product.is_featured && (
            <span className="bg-amber-400 text-white text-[9px] font-black px-2 py-0.5 rounded-full flex items-center gap-0.5">
              <Flame size={8} /> Top
            </span>
          )}
        </div>

        {/* Hover actions */}
        <div className="absolute top-2 right-2 flex flex-col gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={e => { e.preventDefault(); onWishlist(product.id); }}
            className={cn("w-8 h-8 rounded-full flex items-center justify-center shadow border transition-all",
              inWishlist ? "bg-red-500 border-red-500 text-white" : "bg-white border-slate-200 text-slate-400 hover:text-red-500")}
          >
            <Heart size={12} fill={inWishlist ? "currentColor" : "none"} />
          </button>
          <Link
            to={`/s/${slug}/produto/${product.id}`}
            onClick={e => e.stopPropagation()}
            className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center shadow text-slate-400 hover:text-blue-600 transition-all"
          >
            <Eye size={12} />
          </Link>
        </div>

        {/* Quick add overlay */}
        <div className="absolute inset-x-0 bottom-0 translate-y-full group-hover:translate-y-0 transition-transform duration-200">
          <button
            onClick={e => { e.preventDefault(); onAddToCart(product); }}
            style={{ backgroundColor: style.accent }}
            className="w-full py-2.5 text-white text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2"
          >
            <Plus size={12} strokeWidth={3} /> Adicionar
          </button>
        </div>
      </Link>

      <div className={cn("flex flex-col flex-1", isFashion ? "p-4 sm:p-5 gap-2" : isTechNova ? "p-4 sm:p-5 gap-2" : "p-3 gap-1")}>
        <p className={cn(isFashion ? "store-kicker text-[9px] font-semibold text-[#9c7b72]" : isTechNova ? "store-kicker text-[9px] font-semibold text-[#6f89ad]" : "text-[9px] font-black text-slate-400 uppercase tracking-widest")}>{product.category_name || "Geral"}</p>
        <Link to={`/s/${slug}/produto/${product.id}`} className={cn(isFashion ? "store-display text-[1.28rem] sm:text-[1.5rem] font-semibold text-[#2d221f] line-clamp-2 leading-[0.95] hover:text-[#7b4e46] transition-colors" : isTechNova ? "store-display text-[1.16rem] sm:text-[1.35rem] font-semibold text-[#071426] line-clamp-2 leading-[1.02] hover:text-[#2563eb] transition-colors" : "text-xs font-bold text-slate-800 line-clamp-2 leading-snug hover:text-blue-600 transition-colors")}>
          {product.name}
        </Link>
        {(isFashion || isTechNova) && product.description && (
          <p className={cn("text-[11px] sm:text-[12px] leading-relaxed line-clamp-2", isFashion ? "text-[#8c6c63]" : "text-[#607b9d]")}>{product.description}</p>
        )}
        {Array.isArray(product.variations) && product.variations.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {product.variations[0]?.options.slice(0, 4).map((opt, i) => (
              <span key={i} className={cn(isFashion ? "text-[9px] border border-[#ead9ce] rounded-full px-2.5 py-1 text-[#8c6c63]" : isTechNova ? "text-[9px] border border-[#dbe6ff] rounded-full px-2.5 py-1 text-[#607b9d] bg-white/82" : "text-[9px] border border-slate-200 rounded px-1.5 py-0.5 text-slate-500")}>{opt.value}</span>
            ))}
          </div>
        )}
        <div className={cn("flex items-center justify-between mt-auto", isFashion ? "pt-4 border-t border-[#eee2d6]" : isTechNova ? "pt-4 border-t border-[#dbe6ff]" : "pt-2")}>
          <div>
            {product.discount_price ? (
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-400 line-through font-mono">R$ {Number(product.price).toFixed(2)}</span>
                <span className={cn(isFashion ? "store-display text-[1.45rem] sm:text-[1.8rem] font-semibold text-[#2d221f]" : isTechNova ? "store-display text-[1.32rem] sm:text-[1.55rem] font-semibold text-[#071426]" : "text-sm font-black text-emerald-600 font-mono")}>R$ {Number(product.discount_price).toFixed(2)}</span>
              </div>
            ) : (
              <span className={cn(isFashion ? "store-display text-[1.45rem] sm:text-[1.8rem] font-semibold" : isTechNova ? "store-display text-[1.32rem] sm:text-[1.55rem] font-semibold" : "text-sm font-black font-mono")} style={{ color: style.accent }}>R$ {Number(product.price).toFixed(2)}</span>
            )}
          </div>
          <button
            onClick={() => onAddToCart(product)}
            style={{ backgroundColor: style.accent }}
            className={cn(
              "text-white transition-all active:scale-90",
              isFashion
                ? "w-10 h-10 sm:w-auto sm:px-4 rounded-full text-[10px] font-semibold uppercase tracking-[0.18em] sm:tracking-[0.22em] flex items-center justify-center gap-2"
                : isTechNova
                  ? "h-10 px-4 rounded-full text-[10px] font-semibold uppercase tracking-[0.16em] flex items-center justify-center gap-2 shadow-[0_16px_30px_rgba(37,99,235,0.2)]"
                : "w-8 h-8 flex items-center justify-center",
              style.radius
            )}
          >
            {isFashion || isTechNova ? <><Plus size={12} strokeWidth={3} /><span className={cn(isTechNova && "hidden sm:inline")}>Adicionar</span></> : <Plus size={14} strokeWidth={3} />}
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ── Product Row (List) ─────────────────────────────────────────────────────

function ProductRow({ product, index, slug, style, wishlist, onWishlist, onAddToCart }: CardProps) {
  const discountPct = product.discount_price
    ? Math.round((1 - Number(product.discount_price) / Number(product.price)) * 100)
    : 0;
  const inWishlist = wishlist.includes(product.id);
  const allImages = Array.isArray(product.images) && product.images.length > 0
    ? product.images as string[]
    : product.image_url ? [product.image_url] : [];
  const primaryImage = allImages[0] ?? null;
  const isFashion = style.font === "font-editorial";
  const isTechNova = style.font === "font-tech";

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: Math.min(index * 0.03, 0.3) }}
      className={cn(
        "flex gap-4 border transition-all group",
        isFashion ? "fashion-soft-shadow p-4 hover:-translate-y-1 hover:shadow-[0_26px_70px_rgba(108,64,55,0.12)]" : isTechNova ? "tech-soft-shadow p-4 rounded-[1.75rem] hover:-translate-y-1 hover:shadow-[0_24px_60px_rgba(42,94,188,0.14)]" : "p-3 hover:shadow-md",
        style.card,
        style.radius
      )}
    >
      <Link to={`/s/${slug}/produto/${product.id}`} className={cn(isFashion ? "w-24 h-32 sm:w-28 sm:h-36 shrink-0 rounded-[1.4rem] overflow-hidden bg-[#f8efe8] relative" : isTechNova ? "w-24 h-24 sm:w-28 sm:h-28 shrink-0 rounded-[1.3rem] overflow-hidden tech-grid bg-[linear-gradient(180deg,#f8fbff_0%,#edf4ff_100%)] relative" : "w-24 h-24 shrink-0 rounded-xl overflow-hidden bg-slate-50 relative")}>
        {primaryImage
          ? <img src={primaryImage} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
          : <div className="w-full h-full flex items-center justify-center text-slate-200"><Package size={28} strokeWidth={1} /></div>}
        {discountPct > 0 && <span className="absolute top-1 left-1 bg-red-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded-full">-{discountPct}%</span>}
        {allImages.length > 1 && (
          <span className="absolute bottom-1 right-1 bg-black/60 text-white text-[7px] font-black px-1.5 py-0.5 rounded-full">+{allImages.length - 1}</span>
        )}
      </Link>

      <div className="flex-1 min-w-0 flex flex-col justify-between">
        <div>
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className={cn(isTechNova ? "store-kicker text-[9px] font-semibold text-[#6f89ad]" : "text-[9px] font-black text-slate-400 uppercase tracking-widest")}>{product.category_name || "Geral"}</p>
              <Link to={`/s/${slug}/produto/${product.id}`} className={cn(isFashion ? "store-display text-[1.45rem] sm:text-[1.8rem] font-semibold text-[#2d221f] hover:text-[#7b4e46] transition-colors leading-[0.95] line-clamp-2 mt-0.5 block" : isTechNova ? "store-display text-[1.3rem] sm:text-[1.55rem] font-semibold text-[#071426] hover:text-[#2563eb] transition-colors leading-[0.98] line-clamp-2 mt-0.5 block" : "text-sm font-bold text-slate-800 hover:text-blue-600 transition-colors leading-snug line-clamp-2 mt-0.5 block")}>
                {product.name}
              </Link>
            </div>
            <button
              onClick={() => onWishlist(product.id)}
              className={cn("shrink-0 p-1.5 rounded-lg transition-all", inWishlist ? "text-red-500" : "text-slate-300 hover:text-red-400")}
            >
              <Heart size={14} fill={inWishlist ? "currentColor" : "none"} />
            </button>
          </div>
          {product.description && <p className={cn("text-[11px] mt-1 line-clamp-2 leading-relaxed", isTechNova ? "text-[#607b9d]" : "text-slate-500")}>{product.description}</p>}
          {Array.isArray(product.variations) && product.variations.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {product.variations.map((v, vi) => (
                <span key={vi} className={cn("text-[9px] font-bold px-2 py-0.5 rounded-full", isTechNova ? "bg-white border border-[#dbe6ff] text-[#607b9d]" : "bg-slate-100 text-slate-500")}>
                  {v.name}: {v.options.map(o => o.value).join(", ")}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center justify-between mt-2">
          <div>
            {product.discount_price ? (
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-400 line-through font-mono">R$ {Number(product.price).toFixed(2)}</span>
                <span className={cn(isFashion ? "store-display text-[1.55rem] sm:text-[1.9rem] font-semibold text-[#2d221f]" : isTechNova ? "store-display text-[1.45rem] sm:text-[1.7rem] font-semibold text-[#071426]" : "text-base font-black text-emerald-600 font-mono")}>R$ {Number(product.discount_price).toFixed(2)}</span>
              </div>
            ) : (
              <span className={cn(isFashion ? "store-display text-[1.55rem] sm:text-[1.9rem] font-semibold" : isTechNova ? "store-display text-[1.45rem] sm:text-[1.7rem] font-semibold" : "text-base font-black font-mono")} style={{ color: style.accent }}>R$ {Number(product.price).toFixed(2)}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Link to={`/s/${slug}/produto/${product.id}`}
              className={cn(isFashion ? "h-10 px-3 sm:px-4 rounded-full border border-[#ead9ce] text-[10px] font-semibold uppercase tracking-[0.16em] sm:tracking-[0.22em] text-[#6b5149] hover:bg-[#fff7f1] flex items-center gap-1.5 transition-all" : isTechNova ? "h-10 px-4 rounded-full border border-[#dbe6ff] bg-white text-[10px] font-semibold uppercase tracking-[0.16em] text-[#5b789e] hover:border-[#bfd2ff] hover:text-[#071426] flex items-center gap-1.5 transition-all" : "h-8 px-3 rounded-xl border border-slate-200 text-[10px] font-bold text-slate-500 hover:border-slate-400 flex items-center gap-1.5 transition-all")}>
              <Eye size={12} /> Ver
            </Link>
            <button
              onClick={() => onAddToCart(product)}
              style={{ backgroundColor: style.accent }}
              className={cn(isFashion ? "h-10 px-4 sm:px-5 rounded-full text-white text-[10px] font-semibold uppercase tracking-[0.16em] sm:tracking-[0.22em] flex items-center gap-1.5 active:scale-95 transition-all" : isTechNova ? "h-10 px-5 rounded-full text-white text-[10px] font-semibold uppercase tracking-[0.16em] flex items-center gap-1.5 active:scale-95 transition-all shadow-[0_16px_30px_rgba(37,99,235,0.2)]" : "h-8 px-4 rounded-xl text-white text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 active:scale-95 transition-all")}
            >
              <Plus size={12} strokeWidth={3} /> Adicionar
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
