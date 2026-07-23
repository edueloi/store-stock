import React, { useState, useRef, useEffect } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import StoreSEO from "../../../../components/store/StoreSEO";
import { motion, AnimatePresence } from "motion/react";
import {
  Search, X, LayoutGrid, List, ArrowUpDown, Check,
  ChevronDown, Tag, Package, Heart, Plus, Flame, SlidersHorizontal,
  Cpu,
} from "lucide-react";
import { cn } from "../../../../lib/utils";
import { useStore } from "../../StoreLayout";
import { Product } from "../../../../types";
import { buildStorePath, resolveStoreSlug, productRouteSegment } from "../../store-routing";
import { productHasStock } from "../../../../utils/productStock";

type SortKey = "default" | "price_asc" | "price_desc" | "name";
type ViewMode = "grid" | "list";

const gridOverlay = {
  backgroundImage: "linear-gradient(rgba(14,165,233,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(14,165,233,0.06) 1px, transparent 1px)",
  backgroundSize: "40px 40px",
};

export default function StoreCatalog() {
  const { slug: routeSlug } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { categories, products, addToCart, style, tenant, wishlist, toggleWishlist } = useStore();
  const slug = resolveStoreSlug(routeSlug);

  const [searchTerm, setSearchTerm] = useState(searchParams.get("q") || "");
  const [selectedCategory, setSelectedCategory] = useState<number | null>(
    searchParams.get("cat") ? Number(searchParams.get("cat")) : null
  );
  const [priceRange, setPriceRange] = useState<[number, number] | null>(null);
  const [sortBy, setSortBy] = useState<SortKey>("default");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 20;
  const sortRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = searchParams.get("q") || "";
    const cat = searchParams.get("cat") ? Number(searchParams.get("cat")) : null;
    setSearchTerm(q);
    setSelectedCategory(cat);
    setCurrentPage(1);
  }, [searchParams]);

  useEffect(() => { setCurrentPage(1); }, [priceRange, sortBy]);

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
    .filter(p => productHasStock(p))
    .filter(p =>
      (searchTerm === "" || p.name.toLowerCase().includes(searchTerm.toLowerCase())) &&
      (selectedCategory === null || p.category_id === selectedCategory) &&
      (priceRange === null || (Number(p.price) >= priceRange[0] && Number(p.price) < priceRange[1]))
    )
    .sort((a, b) => {
      if (sortBy === "price_asc") return Number(a.price) - Number(b.price);
      if (sortBy === "price_desc") return Number(b.price) - Number(a.price);
      if (sortBy === "name") return a.name.localeCompare(b.name);
      return (b.is_featured ? 1 : 0) - (a.is_featured ? 1 : 0);
    });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const sortLabels: Record<SortKey, string> = {
    default: "Relevância",
    price_asc: "Menor preço",
    price_desc: "Maior preço",
    name: "A → Z",
  };

  const catName = selectedCategory ? categories.find(c => c.id === selectedCategory)?.name : null;
  const pageTitle = catName ? `${catName} — ${tenant.name}` : `Catálogo — ${tenant.name}`;
  const saleCount = products.filter(p => p.is_active && p.discount_price).length;

  return (
    <div className="min-h-screen bg-[#f4f6fb]">
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-8 space-y-6">
        <StoreSEO
          title={pageTitle}
          description={`Confira ${catName ? `os melhores produtos de ${catName}` : "todo o catálogo"} da ${tenant.name}. Preços e promoções atualizados.`}
          url={typeof window !== "undefined" ? window.location.href : ""}
          siteName={tenant.name}
          keywords={`${catName ? `${catName}, ` : ""}${tenant.name}, catálogo, produtos, comprar online`}
          jsonLd={{
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            "name": pageTitle,
            "description": `Catálogo de produtos da ${tenant.name}`,
            "url": typeof window !== "undefined" ? window.location.href : "",
            "numberOfItems": filtered.length,
          }}
        />

        {/* ── Header panel ── */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 md:p-8 shadow-sm">
          <div className="absolute inset-0 pointer-events-none" style={gridOverlay} />
          {/* Sky blue top border accent */}
          <div className="absolute top-0 inset-x-0 h-1 rounded-t-2xl" style={{ backgroundColor: style.accent }} />
          <div className="relative z-10">
            <div className="flex items-center gap-2.5 mb-4">
              <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: style.accent }} />
              <p className="text-[10px] font-black uppercase tracking-[0.28em]" style={{ color: style.accent }}>
                Catálogo de produtos
              </p>
            </div>
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-slate-900 leading-tight tracking-tight">
                  {catName || "Todos os produtos"}
                </h1>
                <p className="mt-2 max-w-2xl text-sm md:text-base leading-relaxed text-slate-500">
                  Tecnologia e inovação com os melhores preços. Filtre por categoria e encontre o ideal.
                </p>
              </div>
              <div className="flex gap-3 shrink-0">
                {[
                  { value: filtered.length, label: "Itens" },
                  { value: categories.length, label: "Linhas" },
                  { value: saleCount, label: "Ofertas" },
                ].map(item => (
                  <div key={item.label} className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-center min-w-[72px]">
                    <p className="text-2xl font-black font-mono" style={{ color: style.accent }}>{item.value}</p>
                    <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mt-0.5">{item.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── Breadcrumb ── */}
        <nav className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
          <Link to={buildStorePath(slug)} className="hover:text-sky-500 transition-colors">Início</Link>
          <span>/</span>
          <span className="text-slate-600">Catálogo</span>
          {catName && (
            <><span>/</span><span style={{ color: style.accent }}>{catName}</span></>
          )}
        </nav>

        <div className="flex gap-6">

          {/* ── SIDEBAR (desktop) ── */}
          <aside className="hidden lg:flex flex-col gap-2 w-56 shrink-0">
            <p className="text-[10px] font-black uppercase tracking-widest px-3 mb-1" style={{ color: style.accent }}>Filtrar por</p>

            <button
              onClick={() => { setSelectedCategory(null); updateParams("cat", null); }}
              className={cn(
                "flex items-center justify-between px-3 py-2.5 text-xs font-bold transition-all rounded-xl border",
                selectedCategory === null
                  ? "text-white border-transparent"
                  : "text-slate-600 bg-white border-slate-200 hover:border-sky-300 hover:text-sky-600"
              )}
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
                  className={cn(
                    "flex items-center justify-between px-3 py-2.5 text-xs font-bold transition-all rounded-xl border",
                    active
                      ? "text-white border-transparent"
                      : "text-slate-600 bg-white border-slate-200 hover:border-sky-300 hover:text-sky-600"
                  )}
                  style={active ? { backgroundColor: style.accent } : {}}
                >
                  <span className="flex items-center gap-2 truncate"><Tag size={13} className="shrink-0" /><span className="truncate">{cat.name}</span></span>
                  <span className={cn("text-[10px] font-black px-1.5 py-0.5 rounded-full shrink-0",
                    active ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500")}>{count}</span>
                </button>
              );
            })}

            {products.length > 0 && (
              <div className="mt-4 pt-4 border-t border-slate-200">
                <p className="text-[10px] font-black uppercase tracking-widest px-3 mb-2" style={{ color: style.accent }}>Faixa de preço</p>
                <div className="px-3 space-y-1.5">
                  {([
                    ["Até R$ 50", 0, 50],
                    ["R$ 50–200", 50, 200],
                    ["R$ 200–500", 200, 500],
                    ["Acima de R$ 500", 500, Infinity],
                  ] as [string, number, number][]).map(([label, min, max]) => {
                    const count = products.filter(p => p.is_active && Number(p.price) >= min && Number(p.price) < max).length;
                    if (count === 0) return null;
                    const active = priceRange !== null && priceRange[0] === min && priceRange[1] === max;
                    return (
                      <button
                        key={label}
                        onClick={() => { setPriceRange(active ? null : [min, max]); setCurrentPage(1); }}
                        className={cn("flex items-center justify-between w-full text-[10px] py-0.5 rounded px-1 transition-colors",
                          active ? "font-black" : "text-slate-500 hover:text-slate-800")}
                        style={active ? { color: style.accent } : {}}
                      >
                        <span className="font-medium">{label}</span>
                        <span className={cn("text-[9px] px-1.5 py-0.5 rounded-full font-bold border",
                          active ? "text-white border-transparent" : "bg-slate-100 text-slate-500 border-slate-200")}
                          style={active ? { backgroundColor: style.accent } : {}}>{count}</span>
                      </button>
                    );
                  })}
                  {priceRange !== null && (
                    <button onClick={() => setPriceRange(null)} className="text-[9px] font-bold px-1 mt-1" style={{ color: style.accent }}>
                      Limpar faixa ×
                    </button>
                  )}
                </div>
              </div>
            )}
          </aside>

          {/* ── MAIN ── */}
          <div className="flex-1 min-w-0 space-y-5">

            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
              {/* Search */}
              <div className="flex-1 relative group w-full">
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-sky-500 transition-colors" />
                <input
                  type="text"
                  placeholder="Buscar produtos..."
                  value={searchTerm}
                  onChange={e => { setSearchTerm(e.target.value); updateParams("q", e.target.value || null); }}
                  className="w-full pl-10 pr-9 h-10 text-sm font-medium outline-none transition-all bg-white border border-slate-200 rounded-xl text-slate-800 placeholder:text-slate-400 focus:border-sky-400 focus:ring-2 focus:ring-sky-100 shadow-sm"
                />
                {searchTerm && (
                  <button onClick={() => { setSearchTerm(""); updateParams("q", null); }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700">
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Mobile filter */}
              <button
                onClick={() => {}}
                className="lg:hidden flex items-center gap-2 h-10 px-3 text-xs font-bold border border-slate-200 bg-white rounded-xl text-slate-500 hover:border-sky-300 hover:text-sky-600 transition-all shadow-sm"
              >
                <SlidersHorizontal size={14} /> Filtros
              </button>

              <div className="flex items-center gap-2 shrink-0">
                {/* Sort */}
                <div ref={sortRef} className="relative">
                  <button
                    onClick={() => setShowSortMenu(v => !v)}
                    className="flex items-center gap-2 h-10 px-3 text-xs font-bold transition-all border border-slate-200 bg-white rounded-xl text-slate-500 hover:border-sky-300 hover:text-sky-600 shadow-sm"
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
                        className="absolute right-0 top-full mt-2 rounded-2xl shadow-lg z-50 min-w-[180px] py-1 border bg-white border-slate-200"
                      >
                        {(Object.entries(sortLabels) as [SortKey, string][]).map(([val, label]) => (
                          <button
                            key={val}
                            onClick={() => { setSortBy(val); setShowSortMenu(false); }}
                            className="w-full flex items-center justify-between gap-3 px-4 py-2.5 text-xs font-semibold transition-colors text-slate-600 hover:text-sky-600 hover:bg-sky-50"
                          >
                            {label}
                            {sortBy === val && <Check size={12} style={{ color: style.accent }} />}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* View toggle */}
                <div className="flex h-10 overflow-hidden bg-white border border-slate-200 rounded-xl shadow-sm">
                  {(["grid", "list"] as ViewMode[]).map(mode => (
                    <button
                      key={mode}
                      onClick={() => setViewMode(mode)}
                      className={cn("w-10 flex items-center justify-center transition-all",
                        viewMode === mode ? "text-white" : "text-slate-400 hover:text-slate-600")}
                      style={viewMode === mode ? { backgroundColor: style.accent } : {}}
                    >
                      {mode === "grid" ? <LayoutGrid size={14} /> : <List size={14} />}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Mobile category pills */}
            <div className="flex lg:hidden gap-2 overflow-x-auto pb-1 no-scrollbar">
              {[{ id: null as number | null, name: "Todos" }, ...categories].map((cat, i) => (
                <button
                  key={i}
                  onClick={() => { setSelectedCategory(cat.id); updateParams("cat", cat.id ? String(cat.id) : null); }}
                  style={selectedCategory === cat.id ? { backgroundColor: style.accent } : {}}
                  className={cn(
                    "px-3 h-8 whitespace-nowrap font-bold text-[10px] uppercase tracking-wider rounded-full border shrink-0 transition-all",
                    selectedCategory === cat.id
                      ? "text-white border-transparent"
                      : "bg-white text-slate-500 border-slate-200 hover:border-sky-300 hover:text-sky-600"
                  )}
                >
                  {cat.name}
                </button>
              ))}
            </div>

            {/* Active filters */}
            {(selectedCategory !== null || searchTerm || priceRange !== null) && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider" style={{ color: style.accent }}>Filtros:</span>
                {catName && (
                  <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold border" style={{ backgroundColor: style.accent + "12", borderColor: style.accent + "30", color: style.accent }}>
                    {catName}
                    <button onClick={() => { setSelectedCategory(null); updateParams("cat", null); }}><X size={10} /></button>
                  </span>
                )}
                {searchTerm && (
                  <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold bg-white border border-slate-200 text-slate-500 shadow-sm">
                    "{searchTerm}"
                    <button onClick={() => { setSearchTerm(""); updateParams("q", null); }}><X size={10} /></button>
                  </span>
                )}
                {priceRange !== null && (
                  <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold border" style={{ backgroundColor: style.accent + "12", borderColor: style.accent + "30", color: style.accent }}>
                    {priceRange[1] === Infinity ? `Acima de R$ ${priceRange[0]}` : `R$ ${priceRange[0]}–${priceRange[1]}`}
                    <button onClick={() => setPriceRange(null)}><X size={10} /></button>
                  </span>
                )}
                <button
                  onClick={() => { setSelectedCategory(null); setSearchTerm(""); setPriceRange(null); setSearchParams({}); }}
                  className="text-[10px] font-bold text-red-500 hover:text-red-600 uppercase tracking-wider"
                >
                  Limpar tudo
                </button>
              </div>
            )}

            {/* Count */}
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
              {filtered.length} produto{filtered.length !== 1 ? "s" : ""} encontrado{filtered.length !== 1 ? "s" : ""}
            </p>

            {/* Empty state */}
            {filtered.length === 0 && (
              <div className="py-24 flex flex-col items-center gap-4 text-slate-400">
                <Cpu size={48} strokeWidth={1} className="opacity-30" />
                <div className="text-center">
                  <p className="text-sm font-black uppercase tracking-tight text-slate-500">Nenhum produto encontrado</p>
                  <p className="text-xs text-slate-400 mt-1">Tente outros filtros ou termos</p>
                </div>
                <button
                  onClick={() => { setSearchTerm(""); setSelectedCategory(null); setPriceRange(null); setSearchParams({}); }}
                  style={{ backgroundColor: style.accent }}
                  className="text-white px-6 h-9 rounded-xl text-[11px] font-black uppercase tracking-wider"
                >
                  Limpar filtros
                </button>
              </div>
            )}

            {/* Grid */}
            {viewMode === "grid" && filtered.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
                {paginated.map((product, i) => (
                  <TechProductCard key={product.id} product={product} index={i} slug={slug} style={style} wishlist={wishlist} onWishlist={toggleWishlist} onAddToCart={addToCart} />
                ))}
              </div>
            )}

            {/* List */}
            {viewMode === "list" && filtered.length > 0 && (
              <div className="flex flex-col gap-3">
                {paginated.map((product, i) => (
                  <TechProductRow key={product.id} product={product} index={i} slug={slug} style={style} wishlist={wishlist} onWishlist={toggleWishlist} onAddToCart={addToCart} />
                ))}
              </div>
            )}

            {/* PAGINATION */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-1 pt-4">
                <button
                  onClick={() => { setCurrentPage(p => Math.max(1, p - 1)); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                  disabled={currentPage === 1}
                  className="w-9 h-9 rounded-xl border border-slate-200 bg-white text-slate-500 text-sm font-bold disabled:opacity-30 hover:border-slate-300 transition-all"
                >
                  ‹
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                  .reduce<(number | "…")[]>((acc, p, idx, arr) => {
                    if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push("…");
                    acc.push(p);
                    return acc;
                  }, [])
                  .map((p, i) =>
                    p === "…"
                      ? <span key={`e${i}`} className="w-9 h-9 flex items-center justify-center text-slate-400 text-sm">…</span>
                      : <button
                          key={p}
                          onClick={() => { setCurrentPage(p as number); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                          className={cn("w-9 h-9 rounded-xl border text-sm font-bold transition-all",
                            currentPage === p
                              ? "text-white border-transparent"
                              : "border-slate-200 bg-white text-slate-500 hover:border-slate-300")}
                          style={currentPage === p ? { backgroundColor: style.accent } : {}}
                        >
                          {p}
                        </button>
                  )}
                <button
                  onClick={() => { setCurrentPage(p => Math.min(totalPages, p + 1)); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                  disabled={currentPage === totalPages}
                  className="w-9 h-9 rounded-xl border border-slate-200 bg-white text-slate-500 text-sm font-bold disabled:opacity-30 hover:border-slate-300 transition-all"
                >
                  ›
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Product Card (Grid) ──────────────────────────────────────────────────────

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

function TechProductCard({ product, index, slug, style, wishlist, onWishlist, onAddToCart }: CardProps) {
  const discountPct = product.discount_price
    ? Math.round((1 - Number(product.discount_price) / Number(product.price)) * 100)
    : 0;
  const inWishlist = wishlist.includes(product.id);
  const allImages = Array.isArray(product.images) && product.images.length > 0
    ? product.images as string[]
    : product.image_url ? [product.image_url] : [];
  const primaryImage = allImages[0] ?? null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.04, 0.4) }}
      className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white hover:border-sky-300 hover:-translate-y-1 hover:shadow-[0_8px_28px_rgba(14,165,233,0.13)] transition-all duration-300 shadow-sm"
    >
      <Link to={buildStorePath(slug, `/produto/${productRouteSegment(product)}`)} className="relative aspect-square bg-slate-50 overflow-hidden block">
        {primaryImage
          ? <img src={primaryImage} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
          : <div className="w-full h-full flex items-center justify-center text-slate-300"><Package size={48} strokeWidth={1} /></div>}

        {allImages.length > 1 && (
          <div className="absolute bottom-2 left-2 bg-white/90 text-slate-600 text-[8px] font-black px-2 py-0.5 rounded-lg shadow-sm backdrop-blur-sm border border-slate-100">
            +{allImages.length - 1} fotos
          </div>
        )}

        {/* Badges top-left */}
        <div className="absolute top-2 left-2 flex flex-col gap-1">
          {discountPct > 0 && (
            <span className="text-white text-[9px] font-black px-2 py-0.5 rounded-lg" style={{ backgroundColor: style.accent }}>
              -{discountPct}%
            </span>
          )}
          {product.is_featured && (
            <span className="text-[9px] font-black px-2 py-0.5 rounded-lg flex items-center gap-0.5" style={{ backgroundColor: style.accent + "18", color: style.accent, border: `1px solid ${style.accent}30` }}>
              <Flame size={8} /> Top
            </span>
          )}
        </div>

        {/* Wishlist top-right */}
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={e => { e.preventDefault(); onWishlist(product.id); }}
            className={cn("w-8 h-8 rounded-xl border flex items-center justify-center transition-all shadow-sm",
              inWishlist ? "bg-red-500 border-red-500 text-white" : "bg-white border-slate-200 text-slate-400 hover:text-red-500 hover:border-red-200")}>
            <Heart size={12} fill={inWishlist ? "currentColor" : "none"} />
          </button>
        </div>

        {/* Overlay + add button */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
        <button
          onClick={e => { e.preventDefault(); onAddToCart(product); }}
          style={{ backgroundColor: style.accent }}
          className="absolute inset-x-0 bottom-0 py-2.5 text-white text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 translate-y-full group-hover:translate-y-0 transition-transform duration-200"
        >
          <Plus size={12} strokeWidth={3} /> Adicionar
        </button>
      </Link>

      <div className="p-3 flex flex-col gap-1">
        <p className="text-[9px] font-bold uppercase tracking-wider" style={{ color: style.accent }}>
          {product.category_name || "Tecnologia"}
        </p>
        <Link to={buildStorePath(slug, `/produto/${productRouteSegment(product)}`)} className="text-sm font-bold text-slate-800 line-clamp-2 leading-snug hover:text-sky-600 transition-colors">
          {product.name}
        </Link>
        {product.description && (
          <p className="text-[11px] leading-relaxed line-clamp-2 text-slate-400">{product.description}</p>
        )}
        {Array.isArray(product.variations) && product.variations.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {product.variations[0]?.options.slice(0, 3).map((opt, vi) => (
              <span key={vi} className="text-[9px] border border-slate-200 rounded-lg px-2 py-0.5 text-slate-400 bg-slate-50">{opt.value}</span>
            ))}
          </div>
        )}
        <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100">
          <div>
            {product.discount_price ? (
              <div className="flex flex-col">
                <span className="text-[9px] text-slate-400 line-through font-mono">R$ {Number(product.price).toFixed(2)}</span>
                <span className="text-sm font-black text-slate-900 font-mono">R$ {Number(product.discount_price).toFixed(2)}</span>
              </div>
            ) : (
              <span className="text-sm font-black font-mono" style={{ color: style.accent }}>R$ {Number(product.price).toFixed(2)}</span>
            )}
          </div>
          <button
            onClick={() => onAddToCart(product)}
            style={{ backgroundColor: style.accent + "15", color: style.accent, borderColor: style.accent + "30" }}
            className="w-8 h-8 rounded-xl border flex items-center justify-center transition-all hover:opacity-80 active:scale-90"
          >
            <Plus size={14} strokeWidth={3} />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ── Product Row (List) ──────────────────────────────────────────────────────

function TechProductRow({ product, index, slug, style, wishlist, onWishlist, onAddToCart }: CardProps) {
  const discountPct = product.discount_price
    ? Math.round((1 - Number(product.discount_price) / Number(product.price)) * 100)
    : 0;
  const inWishlist = wishlist.includes(product.id);
  const allImages = Array.isArray(product.images) && product.images.length > 0
    ? product.images as string[]
    : product.image_url ? [product.image_url] : [];
  const primaryImage = allImages[0] ?? null;

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: Math.min(index * 0.03, 0.3) }}
      className="flex gap-4 border transition-all group p-3 rounded-2xl border-slate-200 bg-white hover:border-sky-300 hover:shadow-md shadow-sm"
    >
      <Link to={buildStorePath(slug, `/produto/${productRouteSegment(product)}`)} className="w-24 h-24 shrink-0 rounded-xl overflow-hidden bg-slate-50 border border-slate-100 relative">
        {primaryImage
          ? <img src={primaryImage} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
          : <div className="w-full h-full flex items-center justify-center text-slate-300"><Package size={28} strokeWidth={1} /></div>}
        {discountPct > 0 && (
          <span className="absolute top-1 left-1 text-white text-[8px] font-black px-1.5 py-0.5 rounded-lg" style={{ backgroundColor: style.accent }}>-{discountPct}%</span>
        )}
      </Link>

      <div className="flex-1 min-w-0 flex flex-col justify-between">
        <div>
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[9px] font-bold uppercase tracking-wider mb-0.5" style={{ color: style.accent }}>
                {product.category_name || "Tecnologia"}
              </p>
              <Link to={buildStorePath(slug, `/produto/${productRouteSegment(product)}`)} className="text-sm font-bold text-slate-800 hover:text-sky-600 transition-colors leading-snug line-clamp-2 block">
                {product.name}
              </Link>
            </div>
            <button onClick={() => onWishlist(product.id)}
              className={cn("shrink-0 p-1.5 rounded-lg transition-all", inWishlist ? "text-red-500" : "text-slate-400 hover:text-red-500")}>
              <Heart size={14} fill={inWishlist ? "currentColor" : "none"} />
            </button>
          </div>
          {product.description && (
            <p className="text-[11px] mt-1 line-clamp-2 leading-relaxed text-slate-400">{product.description}</p>
          )}
        </div>
        <div className="flex items-center justify-between mt-2">
          <div>
            {product.discount_price ? (
              <div className="flex items-center gap-2">
                <span className="text-[10px] line-through font-mono text-slate-400">R$ {Number(product.price).toFixed(2)}</span>
                <span className="text-base font-black text-slate-900 font-mono">R$ {Number(product.discount_price).toFixed(2)}</span>
              </div>
            ) : (
              <span className="text-base font-black font-mono" style={{ color: style.accent }}>R$ {Number(product.price).toFixed(2)}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Link to={buildStorePath(slug, `/produto/${productRouteSegment(product)}`)}
              className="h-9 px-3 rounded-xl border border-slate-200 text-[10px] font-bold text-slate-500 hover:border-sky-300 hover:text-sky-600 flex items-center gap-1.5 transition-all">
              Ver produto
            </Link>
            <button
              onClick={() => onAddToCart(product)}
              style={{ backgroundColor: style.accent }}
              className="h-9 px-4 rounded-xl text-white text-[10px] font-bold flex items-center gap-1.5 active:scale-95 transition-all hover:opacity-90"
            >
              <Plus size={12} strokeWidth={3} /> Adicionar
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
