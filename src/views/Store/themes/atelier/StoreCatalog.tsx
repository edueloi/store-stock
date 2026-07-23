import React, { useState, useRef, useEffect } from "react";
import { useParams, useSearchParams, Link, useNavigate } from "react-router-dom";
import StoreSEO from "../../../../components/store/StoreSEO";
import { motion, AnimatePresence } from "motion/react";
import {
  Search, X, LayoutGrid, List, ArrowUpDown, Check,
  ChevronDown, Tag, Package, Heart, Eye, Plus, Flame, SlidersHorizontal,
} from "lucide-react";
import { cn } from "../../../../lib/utils";
import { useStore } from "../../StoreLayout";
import { Product } from "../../../../types";
import { buildStorePath, resolveStoreSlug, productRouteSegment } from "../../store-routing";
import { productHasStock } from "../../../../utils/productStock";

type SortKey = "default" | "price_asc" | "price_desc" | "name";
type ViewMode = "grid" | "list";

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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 20;
  const sortRef = useRef<HTMLDivElement>(null);

  // Sync URL params → state
  useEffect(() => {
    const q = searchParams.get("q") || "";
    const cat = searchParams.get("cat") ? Number(searchParams.get("cat")) : null;
    setSearchTerm(q);
    setSelectedCategory(cat);
    setCurrentPage(1);
  }, [searchParams]);

  useEffect(() => { setCurrentPage(1); }, [priceRange, sortBy]);

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

  const catName = selectedCategory
    ? categories.find(c => c.id === selectedCategory)?.name
    : null;

  const pageTitle = catName ? `${catName} — ${tenant.name}` : `Catálogo — ${tenant.name}`;
  const saleCount = products.filter(p => p.is_active && p.discount_price).length;

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-8 space-y-6">
      <StoreSEO
        title={pageTitle}
        description={`Confira ${catName ? `os melhores produtos de ${catName}` : "todo o catálogo"} da ${tenant.name}. Preços e promoções atualizados, atendimento via WhatsApp.`}
        url={typeof window !== "undefined" ? window.location.href : ""}
        siteName={tenant.name}
        keywords={`${catName ? `${catName}, ` : ""}${tenant.name}, catálogo, produtos, comprar online, promoções${categories.map(c => `, ${c.name}`).join("")}`}
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          "name": pageTitle,
          "description": `Catálogo de produtos da ${tenant.name}`,
          "url": typeof window !== "undefined" ? window.location.href : "",
          "numberOfItems": filtered.length,
        }}
      />

      {/* Header panel */}
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

      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-[10px] font-bold uppercase text-[#9c7b72] tracking-[0.24em] mb-6">
        <Link to={buildStorePath(slug)} className="hover:text-slate-700">Início</Link>
        <span>/</span>
        <span className="text-slate-700">Catálogo</span>
        {catName && <><span>/</span><span style={{ color: style.accent }}>{catName}</span></>}
      </nav>

      <div className="flex gap-6">

        {/* ── SIDEBAR ──────────────────────────────────────────── */}
        {/* Desktop */}
        <aside className="hidden lg:flex flex-col gap-2 w-56 shrink-0">
          <p className="text-[10px] font-black uppercase tracking-widest px-3 mb-1 text-slate-400">Filtrar por</p>

          <button
            onClick={() => { setSelectedCategory(null); updateParams("cat", null); }}
            className={cn("flex items-center justify-between px-3 py-2.5 text-xs font-bold transition-all rounded-xl",
              selectedCategory === null
                ? "text-white shadow-sm border-transparent"
                : "text-slate-600 hover:bg-slate-100")}
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
                className={cn("flex items-center justify-between px-3 py-2.5 text-xs font-bold transition-all rounded-xl",
                  active
                    ? "text-white shadow-sm border-transparent"
                    : "text-slate-600 hover:bg-slate-100")}
                style={active ? { backgroundColor: style.accent } : {}}
              >
                <span className="flex items-center gap-2 truncate"><Tag size={13} className="shrink-0" /> <span className="truncate">{cat.name}</span></span>
                <span className={cn("text-[10px] font-black px-1.5 py-0.5 rounded-full shrink-0",
                  active ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500")}>{count}</span>
              </button>
            );
          })}

          {products.length > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-200">
              <p className="text-[10px] font-black uppercase tracking-widest px-3 mb-2 text-slate-400">Faixa de preço</p>
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
                      className={cn("flex items-center justify-between w-full text-[10px] transition-colors py-0.5 rounded px-1",
                        active ? "text-slate-800 font-black" : "text-slate-500 hover:text-slate-800")}
                    >
                      <span className="font-medium">{label}</span>
                      <span className={cn("text-[9px] px-1.5 py-0.5 rounded-full font-bold",
                        active ? "text-white" : "bg-slate-100 text-slate-500")}
                        style={active ? { backgroundColor: style.accent } : {}}>{count}</span>
                    </button>
                  );
                })}
                {priceRange !== null && (
                  <button onClick={() => setPriceRange(null)} className="text-[9px] font-bold text-slate-500 hover:text-slate-800 px-1 mt-1">
                    Limpar faixa ×
                  </button>
                )}
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
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors text-slate-400 group-focus-within:text-blue-500" />
              <input
                type="text"
                placeholder="Buscar produtos..."
                value={searchTerm}
                onChange={e => { setSearchTerm(e.target.value); updateParams("q", e.target.value || null); }}
                className="w-full pl-10 pr-9 h-10 text-sm font-medium outline-none transition-all bg-white border border-[#ead9ce] rounded-full placeholder:text-slate-300 focus:border-[#c7978d] focus:ring-2 focus:ring-[#ead9ce]"
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
              className="lg:hidden flex items-center gap-2 h-10 px-3 text-xs font-bold border border-[#ead9ce] bg-white rounded-full text-[#6b5149]"
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
                  className="flex items-center gap-2 h-10 px-3 text-xs font-bold transition-all border border-[#ead9ce] bg-white rounded-full text-[#6b5149] hover:border-[#c7978d]"
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
                      className="absolute right-0 top-full mt-2 rounded-2xl shadow-xl z-50 min-w-[180px] py-1 border bg-white border-[#ead9ce]"
                    >
                      {(Object.entries(sortLabels) as [SortKey, string][]).map(([val, label]) => (
                        <button
                          key={val}
                          onClick={() => { setSortBy(val); setShowSortMenu(false); }}
                          className="w-full flex items-center justify-between gap-3 px-4 py-2.5 text-xs font-semibold transition-colors text-slate-700 hover:bg-slate-50"
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
              <div className="flex h-10 overflow-hidden bg-white border border-[#ead9ce] rounded-full">
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
                  selectedCategory === cat.id ? "text-white border-transparent" : "bg-white text-[#6b5149] border-[#ead9ce]")}
              >
                {cat.name}
              </button>
            ))}
          </div>

          {/* Active filters */}
          {(selectedCategory !== null || searchTerm || priceRange !== null) && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Filtros:</span>
              {catName && (
                <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold bg-blue-50 border border-blue-200 text-blue-700">
                  {catName}
                  <button onClick={() => { setSelectedCategory(null); updateParams("cat", null); }}><X size={10} /></button>
                </span>
              )}
              {searchTerm && (
                <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold bg-slate-100 border border-slate-200 text-slate-600">
                  "{searchTerm}"
                  <button onClick={() => { setSearchTerm(""); updateParams("q", null); }}><X size={10} /></button>
                </span>
              )}
              {priceRange !== null && (
                <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold bg-slate-100 border border-slate-200 text-slate-600">
                  {priceRange[1] === Infinity ? `Acima de R$ ${priceRange[0]}` : `R$ ${priceRange[0]}–${priceRange[1]}`}
                  <button onClick={() => setPriceRange(null)}><X size={10} /></button>
                </span>
              )}
              <button
                onClick={() => { setSelectedCategory(null); setSearchTerm(""); setPriceRange(null); setSearchParams({}); }}
                className="text-[10px] font-bold text-red-500 hover:text-red-700 uppercase tracking-wider"
              >
                Limpar tudo
              </button>
            </div>
          )}

          {/* Result count */}
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
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
                onClick={() => { setSearchTerm(""); setSelectedCategory(null); setPriceRange(null); setSearchParams({}); }}
                style={{ backgroundColor: style.accent }}
                className="text-white px-6 h-9 rounded-full text-[11px] font-black uppercase tracking-wider"
              >
                Limpar filtros
              </button>
            </div>
          )}

          {/* GRID */}
          {viewMode === "grid" && filtered.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
              {paginated.map((product, i) => (
                <ProductCard key={product.id} product={product} index={i} slug={slug} style={style} wishlist={wishlist} onWishlist={toggleWishlist} onAddToCart={addToCart} />
              ))}
            </div>
          )}

          {/* LIST */}
          {viewMode === "list" && filtered.length > 0 && (
            <div className="flex flex-col gap-3">
              {paginated.map((product, i) => (
                <ProductRow key={product.id} product={product} index={i} slug={slug} style={style} wishlist={wishlist} onWishlist={toggleWishlist} onAddToCart={addToCart} />
              ))}
            </div>
          )}

          {/* PAGINATION */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-1 pt-4">
              <button
                onClick={() => { setCurrentPage(p => Math.max(1, p - 1)); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                disabled={currentPage === 1}
                className="w-9 h-9 rounded-full border border-[#ead9ce] bg-white text-slate-500 text-sm font-bold disabled:opacity-30 hover:border-[#c7978d] transition-all"
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
                        className={cn("w-9 h-9 rounded-full border text-sm font-bold transition-all",
                          currentPage === p
                            ? "text-white border-transparent"
                            : "border-[#ead9ce] bg-white text-slate-500 hover:border-[#c7978d]")}
                        style={currentPage === p ? { backgroundColor: style.accent } : {}}
                      >
                        {p}
                      </button>
                )}
              <button
                onClick={() => { setCurrentPage(p => Math.min(totalPages, p + 1)); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                disabled={currentPage === totalPages}
                className="w-9 h-9 rounded-full border border-[#ead9ce] bg-white text-slate-500 text-sm font-bold disabled:opacity-30 hover:border-[#c7978d] transition-all"
              >
                ›
              </button>
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
  const navigate = useNavigate();
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
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.04, 0.4) }}
      className={cn(
        "group relative flex flex-col overflow-hidden border transition-all duration-300",
        "fashion-soft-shadow hover:-translate-y-1 hover:shadow-[0_26px_70px_rgba(108,64,55,0.12)]",
        style.card,
        style.radius
      )}
    >
      <Link to={buildStorePath(slug, `/produto/${productRouteSegment(product)}`)} className="relative overflow-hidden block aspect-[4/5] bg-[#f8efe8]">
        {primaryImage
          ? <img src={primaryImage} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
          : <div className="w-full h-full flex items-center justify-center text-slate-200"><Package size={48} strokeWidth={1} /></div>}
        {allImages.length > 1 && (
          <div className="absolute bottom-2 left-2 bg-black/60 text-white text-[8px] font-black px-2 py-0.5 rounded-full backdrop-blur-sm flex items-center gap-1">
            <span>+{allImages.length - 1}</span> fotos
          </div>
        )}
        <div className="absolute top-2 left-2 flex flex-col gap-1">
          {discountPct > 0 && <span className="bg-red-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full">-{discountPct}%</span>}
          {product.is_featured && (
            <span className="bg-amber-400 text-white text-[9px] font-black px-2 py-0.5 rounded-full flex items-center gap-0.5">
              <Flame size={8} /> Top
            </span>
          )}
        </div>
        <div className="absolute top-2 right-2 flex flex-col gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={e => { e.preventDefault(); onWishlist(product.id); }}
            className={cn("w-8 h-8 rounded-full flex items-center justify-center shadow border transition-all",
              inWishlist ? "bg-red-500 border-red-500 text-white" : "bg-white border-slate-200 text-slate-400 hover:text-red-500")}
          >
            <Heart size={12} fill={inWishlist ? "currentColor" : "none"} />
          </button>
          <button
            onClick={e => { e.preventDefault(); e.stopPropagation(); navigate(buildStorePath(slug, `/produto/${productRouteSegment(product)}`)); }}
            className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center shadow text-slate-400 hover:text-blue-600 transition-all"
          >
            <Eye size={12} />
          </button>
        </div>
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
      <div className="flex flex-col flex-1 p-4 sm:p-5 gap-2">
        <p className="store-kicker text-[9px] font-semibold text-[#9c7b72]">{product.category_name || "Geral"}</p>
        <Link to={buildStorePath(slug, `/produto/${productRouteSegment(product)}`)} className="store-display text-[1.28rem] sm:text-[1.5rem] font-semibold text-[#2d221f] line-clamp-2 leading-[0.95] hover:text-[#7b4e46] transition-colors">
          {product.name}
        </Link>
        {product.description && (
          <p className="text-[11px] sm:text-[12px] leading-relaxed line-clamp-2 text-[#8c6c63]">{product.description}</p>
        )}
        {Array.isArray(product.variations) && product.variations.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {product.variations[0]?.options.slice(0, 4).map((opt, i) => (
              <span key={i} className="text-[9px] border border-[#ead9ce] rounded-full px-2.5 py-1 text-[#8c6c63]">{opt.value}</span>
            ))}
          </div>
        )}
        <div className="flex items-center justify-between mt-auto pt-4 border-t border-[#eee2d6]">
          <div>
            {product.discount_price ? (
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-400 line-through font-mono">R$ {Number(product.price).toFixed(2)}</span>
                <span className="store-display text-[1.45rem] sm:text-[1.8rem] font-semibold text-[#2d221f]">R$ {Number(product.discount_price).toFixed(2)}</span>
              </div>
            ) : (
              <span className="store-display text-[1.45rem] sm:text-[1.8rem] font-semibold" style={{ color: style.accent }}>R$ {Number(product.price).toFixed(2)}</span>
            )}
          </div>
          <button
            onClick={() => onAddToCart(product)}
            style={{ backgroundColor: style.accent }}
            className={cn(
              "text-white transition-all active:scale-90",
              "w-10 h-10 sm:w-auto sm:px-4 rounded-full text-[10px] font-semibold uppercase tracking-[0.18em] sm:tracking-[0.22em] flex items-center justify-center gap-2",
              style.radius
            )}
          >
            <Plus size={12} strokeWidth={3} /><span>Adicionar</span>
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

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: Math.min(index * 0.03, 0.3) }}
      className={cn(
        "flex gap-4 border transition-all group",
        "fashion-soft-shadow p-4 hover:-translate-y-1 hover:shadow-[0_26px_70px_rgba(108,64,55,0.12)]",
        style.card,
        style.radius
      )}
    >
      <Link to={buildStorePath(slug, `/produto/${productRouteSegment(product)}`)} className="w-24 h-32 sm:w-28 sm:h-36 shrink-0 rounded-[1.4rem] overflow-hidden bg-[#f8efe8] relative">
        {primaryImage
          ? <img src={primaryImage} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
          : <div className="w-full h-full flex items-center justify-center text-slate-200"><Package size={28} strokeWidth={1} /></div>}
        {discountPct > 0 && <span className="absolute top-1 left-1 text-white text-[8px] font-black px-1.5 py-0.5 bg-red-500 rounded-full">-{discountPct}%</span>}
        {allImages.length > 1 && (
          <span className="absolute bottom-1 right-1 bg-black/60 text-white text-[7px] font-black px-1.5 py-0.5 rounded-full">+{allImages.length - 1}</span>
        )}
      </Link>

      <div className="flex-1 min-w-0 flex flex-col justify-between">
        <div>
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{product.category_name || "Geral"}</p>
              <Link to={buildStorePath(slug, `/produto/${productRouteSegment(product)}`)} className="store-display text-[1.45rem] sm:text-[1.8rem] font-semibold text-[#2d221f] hover:text-[#7b4e46] transition-colors leading-[0.95] line-clamp-2 mt-0.5 block">
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
          {product.description && <p className="text-[11px] mt-1 line-clamp-2 leading-relaxed text-slate-500">{product.description}</p>}
          {Array.isArray(product.variations) && product.variations.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {product.variations.map((v, vi) => (
                <span key={vi} className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
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
                <span className="text-[10px] line-through font-mono text-slate-400">R$ {Number(product.price).toFixed(2)}</span>
                <span className="store-display text-[1.55rem] sm:text-[1.9rem] font-semibold text-[#2d221f]">R$ {Number(product.discount_price).toFixed(2)}</span>
              </div>
            ) : (
              <span className="store-display text-[1.55rem] sm:text-[1.9rem] font-semibold" style={{ color: style.accent }}>R$ {Number(product.price).toFixed(2)}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Link to={buildStorePath(slug, `/produto/${productRouteSegment(product)}`)}
              className="h-10 px-3 sm:px-4 rounded-full border border-[#ead9ce] text-[10px] font-semibold uppercase tracking-[0.16em] sm:tracking-[0.22em] text-[#6b5149] hover:bg-[#fff7f1] flex items-center gap-1.5 transition-all">
              <Eye size={12} /> Ver
            </Link>
            <button
              onClick={() => onAddToCart(product)}
              style={{ backgroundColor: style.accent }}
              className="h-10 px-4 sm:px-5 rounded-full text-white text-[10px] font-semibold uppercase tracking-[0.16em] sm:tracking-[0.22em] flex items-center gap-1.5 active:scale-95 transition-all"
            >
              <Plus size={12} strokeWidth={3} /> Adicionar
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
