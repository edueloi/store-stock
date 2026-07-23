import React, { useState, useRef, useEffect } from "react";
import { useParams, useSearchParams, Link, useNavigate } from "react-router-dom";
import StoreSEO from "../../../../components/store/StoreSEO";
import { motion, AnimatePresence } from "motion/react";
import {
  Search, X, LayoutGrid, List, ArrowUpDown, Check,
  ChevronDown, Package, Heart, Eye, Plus, Flame, SlidersHorizontal, Leaf,
} from "lucide-react";
import { cn } from "../../../../lib/utils";
import { useStore } from "../../StoreLayout";
import { Product } from "../../../../types";
import { buildStorePath, resolveStoreSlug } from "../../store-routing";
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

  const catName = selectedCategory
    ? categories.find(c => c.id === selectedCategory)?.name
    : null;

  const pageTitle = catName ? `${catName} — ${tenant.name}` : `Catálogo — ${tenant.name}`;

  return (
    <div className="min-h-screen bg-[#fefaf6]">
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

      <div className="max-w-7xl mx-auto px-4 md:px-6 py-8">

        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-[10px] font-bold uppercase mb-6 text-stone-400 tracking-wider">
          <Link to={buildStorePath(slug)} className="transition-colors hover:text-amber-700">Início</Link>
          <span>/</span>
          <span className="text-stone-700">Catálogo</span>
          {catName && <><span>/</span><span style={{ color: style.accent }}>{catName}</span></>}
        </nav>

        <div className="flex gap-6">

          {/* ── SIDEBAR ──────────────────────────────────────────── */}
          <aside className="hidden lg:flex flex-col gap-1.5 w-56 shrink-0">
            <div className="bg-[#fffbf5] border border-[#f0e6d3] rounded-2xl p-4 space-y-1.5">
              <p className="text-[10px] font-black uppercase tracking-widest px-1 mb-2 text-stone-400 flex items-center gap-1.5">
                <Leaf size={11} className="text-amber-400" /> Filtrar por
              </p>

              <button
                onClick={() => { setSelectedCategory(null); updateParams("cat", null); }}
                className={cn(
                  "flex items-center justify-between px-3 py-2.5 text-xs font-bold transition-all rounded-xl w-full",
                  selectedCategory === null
                    ? "text-white shadow-sm"
                    : "text-stone-600 hover:bg-amber-50 hover:text-amber-700"
                )}
                style={selectedCategory === null ? { backgroundColor: style.accent } : {}}
              >
                <span className="flex items-center gap-2"><LayoutGrid size={13} /> Todos</span>
                <span className={cn("text-[10px] font-black px-1.5 py-0.5 rounded-full",
                  selectedCategory === null ? "bg-white/20 text-white" : "bg-amber-100 text-amber-600")}>
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
                      "flex items-center justify-between px-3 py-2.5 text-xs font-bold transition-all rounded-xl w-full",
                      active
                        ? "text-white shadow-sm"
                        : "text-stone-600 hover:bg-amber-50 hover:text-amber-700"
                    )}
                    style={active ? { backgroundColor: style.accent } : {}}
                  >
                    <span className="flex items-center gap-2 truncate"><Leaf size={13} className="shrink-0" /> <span className="truncate">{cat.name}</span></span>
                    <span className={cn("text-[10px] font-black px-1.5 py-0.5 rounded-full shrink-0",
                      active ? "bg-white/20 text-white" : "bg-amber-100 text-amber-600")}>{count}</span>
                  </button>
                );
              })}

              {products.length > 0 && (
                <div className="mt-3 pt-3 border-t border-amber-100">
                  <p className="text-[10px] font-black uppercase tracking-widest px-1 mb-2 text-stone-400">Faixa de preço</p>
                  <div className="px-1 space-y-1">
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
                          className={cn("flex items-center justify-between w-full text-[10px] transition-colors py-1 rounded px-1",
                            active ? "text-amber-700 font-black" : "text-stone-500 hover:text-amber-700")}
                        >
                          <span className="font-medium">{label}</span>
                          <span className={cn("text-[9px] px-1.5 py-0.5 rounded-full font-bold",
                            active ? "bg-amber-600 text-white" : "bg-amber-100 text-amber-600")}>{count}</span>
                        </button>
                      );
                    })}
                    {priceRange !== null && (
                      <button onClick={() => setPriceRange(null)} className="text-[9px] font-bold text-amber-600 hover:text-amber-800 px-1 mt-1">
                        Limpar faixa ×
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </aside>

          {/* ── MAIN ─────────────────────────────────────────────── */}
          <div className="flex-1 min-w-0 space-y-5">

            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">

              {/* Search */}
              <div className="flex-1 relative group w-full">
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors text-stone-400 group-focus-within:text-amber-600" />
                <input
                  type="text"
                  placeholder="Buscar produtos..."
                  value={searchTerm}
                  onChange={e => { setSearchTerm(e.target.value); updateParams("q", e.target.value || null); }}
                  className="w-full pl-10 pr-9 h-11 text-sm font-medium outline-none transition-all bg-white border border-[#f0e6d3] rounded-xl placeholder:text-stone-300 focus:border-amber-400 focus:ring-2 focus:ring-amber-100 text-stone-700"
                />
                {searchTerm && (
                  <button onClick={() => { setSearchTerm(""); updateParams("q", null); }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700">
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Mobile filter button */}
              <button
                onClick={() => setSidebarOpen(v => !v)}
                className="lg:hidden flex items-center gap-2 h-11 px-3 text-xs font-bold border border-[#f0e6d3] bg-white rounded-xl text-stone-600 hover:border-amber-300"
              >
                <SlidersHorizontal size={14} className="text-amber-600" /> Filtros
                {selectedCategory !== null && (
                  <span style={{ backgroundColor: style.accent }} className="w-4 h-4 rounded-full text-white text-[8px] font-black flex items-center justify-center">1</span>
                )}
              </button>

              <div className="flex items-center gap-2 shrink-0">
                {/* Sort */}
                <div ref={sortRef} className="relative">
                  <button
                    onClick={() => setShowSortMenu(v => !v)}
                    className="flex items-center gap-2 h-11 px-3 text-xs font-bold transition-all border border-[#f0e6d3] bg-white rounded-xl text-stone-600 hover:border-amber-300"
                  >
                    <ArrowUpDown size={13} className="text-amber-500" />
                    <span className="hidden sm:inline">{sortLabels[sortBy]}</span>
                    <ChevronDown size={12} className={cn("transition-transform", showSortMenu && "rotate-180")} />
                  </button>
                  <AnimatePresence>
                    {showSortMenu && (
                      <motion.div
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        className="absolute right-0 top-full mt-2 rounded-2xl shadow-xl z-50 min-w-[180px] py-1 border bg-white border-[#f0e6d3]"
                      >
                        {(Object.entries(sortLabels) as [SortKey, string][]).map(([val, label]) => (
                          <button
                            key={val}
                            onClick={() => { setSortBy(val); setShowSortMenu(false); }}
                            className="w-full flex items-center justify-between gap-3 px-4 py-2.5 text-xs font-semibold transition-colors text-stone-700 hover:bg-amber-50"
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
                <div className="flex h-11 overflow-hidden bg-white border border-[#f0e6d3] rounded-xl">
                  {(["grid", "list"] as ViewMode[]).map(mode => (
                    <button
                      key={mode}
                      onClick={() => setViewMode(mode)}
                      className={cn("w-10 flex items-center justify-center transition-all",
                        viewMode === mode ? "text-white" : "text-stone-400 hover:text-amber-600")}
                      style={viewMode === mode ? { backgroundColor: style.accent } : {}}
                    >
                      {mode === "grid" ? <LayoutGrid size={14} /> : <List size={14} />}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Mobile sidebar drawer */}
            <AnimatePresence>
              {sidebarOpen && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="lg:hidden overflow-hidden"
                >
                  <div className="bg-[#fffbf5] border border-[#f0e6d3] rounded-2xl p-4 space-y-1.5">
                    <button
                      onClick={() => { setSelectedCategory(null); updateParams("cat", null); setSidebarOpen(false); }}
                      className={cn("flex items-center justify-between px-3 py-2.5 text-xs font-bold transition-all rounded-xl w-full",
                        selectedCategory === null ? "text-white" : "text-stone-600 hover:bg-amber-50")}
                      style={selectedCategory === null ? { backgroundColor: style.accent } : {}}
                    >
                      <span className="flex items-center gap-2"><LayoutGrid size={13} /> Todos</span>
                      <span className={cn("text-[10px] font-black px-1.5 py-0.5 rounded-full",
                        selectedCategory === null ? "bg-white/20 text-white" : "bg-amber-100 text-amber-600")}>
                        {products.filter(p => p.is_active).length}
                      </span>
                    </button>
                    {categories.map(cat => {
                      const count = products.filter(p => p.is_active && p.category_id === cat.id).length;
                      const active = selectedCategory === cat.id;
                      return (
                        <button
                          key={cat.id}
                          onClick={() => { setSelectedCategory(cat.id); updateParams("cat", String(cat.id)); setSidebarOpen(false); }}
                          className={cn("flex items-center justify-between px-3 py-2.5 text-xs font-bold transition-all rounded-xl w-full",
                            active ? "text-white" : "text-stone-600 hover:bg-amber-50")}
                          style={active ? { backgroundColor: style.accent } : {}}
                        >
                          <span className="flex items-center gap-2 truncate"><Leaf size={13} className="shrink-0" /><span className="truncate">{cat.name}</span></span>
                          <span className={cn("text-[10px] font-black px-1.5 py-0.5 rounded-full shrink-0",
                            active ? "bg-white/20 text-white" : "bg-amber-100 text-amber-600")}>{count}</span>
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Mobile categories pills */}
            <div className="flex lg:hidden gap-2 overflow-x-auto pb-1 no-scrollbar">
              {[{ id: null as number | null, name: "Todos" }, ...categories].map((cat, i) => (
                <button
                  key={i}
                  onClick={() => { setSelectedCategory(cat.id); updateParams("cat", cat.id ? String(cat.id) : null); }}
                  style={selectedCategory === cat.id ? { backgroundColor: style.accent } : {}}
                  className={cn("px-3 h-8 whitespace-nowrap font-bold text-[10px] uppercase tracking-wider rounded-full border shrink-0 transition-all",
                    selectedCategory === cat.id ? "text-white border-transparent" : "bg-white text-stone-500 border-[#f0e6d3] hover:border-amber-300")}
                >
                  {cat.name}
                </button>
              ))}
            </div>

            {/* Active filters */}
            {(selectedCategory !== null || searchTerm || priceRange !== null) && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-stone-400">Filtros:</span>
                {catName && (
                  <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold bg-amber-50 border border-amber-200 text-amber-700">
                    {catName}
                    <button onClick={() => { setSelectedCategory(null); updateParams("cat", null); }}><X size={10} /></button>
                  </span>
                )}
                {searchTerm && (
                  <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold bg-stone-100 border border-stone-200 text-stone-600">
                    "{searchTerm}"
                    <button onClick={() => { setSearchTerm(""); updateParams("q", null); }}><X size={10} /></button>
                  </span>
                )}
                {priceRange !== null && (
                  <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold bg-amber-50 border border-amber-200 text-amber-700">
                    {priceRange[1] === Infinity ? `Acima de R$ ${priceRange[0]}` : `R$ ${priceRange[0]}–${priceRange[1]}`}
                    <button onClick={() => setPriceRange(null)}><X size={10} /></button>
                  </span>
                )}
                <button
                  onClick={() => { setSelectedCategory(null); setSearchTerm(""); setPriceRange(null); setSearchParams({}); }}
                  className="text-[10px] font-bold text-amber-600 hover:text-amber-800 uppercase tracking-wider"
                >
                  Limpar tudo
                </button>
              </div>
            )}

            {/* Result count */}
            <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400">
              {filtered.length} produto{filtered.length !== 1 ? "s" : ""} encontrado{filtered.length !== 1 ? "s" : ""}
            </p>

            {/* Empty */}
            {filtered.length === 0 && (
              <div className="py-24 flex flex-col items-center gap-4 text-stone-400">
                <Package size={48} strokeWidth={1} className="opacity-30 text-amber-300" />
                <div className="text-center">
                  <p className="text-sm font-black uppercase tracking-tight text-stone-700">Nenhum produto encontrado</p>
                  <p className="text-xs text-stone-400 mt-1">Tente outros filtros ou termos</p>
                </div>
                <button
                  onClick={() => { setSearchTerm(""); setSelectedCategory(null); setPriceRange(null); setSearchParams({}); }}
                  style={{ backgroundColor: style.accent }}
                  className="text-white px-6 h-10 rounded-xl text-[11px] font-black uppercase tracking-wider shadow-[0_4px_16px_rgba(217,119,6,0.3)] hover:shadow-[0_6px_22px_rgba(217,119,6,0.45)] transition-all"
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
                  className="w-9 h-9 rounded-xl border border-[#f0e6d3] bg-white text-stone-500 text-sm font-bold disabled:opacity-30 hover:border-amber-300 hover:text-amber-700 transition-all"
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
                      ? <span key={`e${i}`} className="w-9 h-9 flex items-center justify-center text-stone-400 text-sm">…</span>
                      : <button
                          key={p}
                          onClick={() => { setCurrentPage(p as number); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                          className={cn("w-9 h-9 rounded-xl border text-sm font-bold transition-all",
                            currentPage === p
                              ? "text-white border-transparent shadow-sm"
                              : "border-[#f0e6d3] bg-white text-stone-500 hover:border-amber-300 hover:text-amber-700")}
                          style={currentPage === p ? { backgroundColor: style.accent } : {}}
                        >
                          {p}
                        </button>
                  )}
                <button
                  onClick={() => { setCurrentPage(p => Math.min(totalPages, p + 1)); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                  disabled={currentPage === totalPages}
                  className="w-9 h-9 rounded-xl border border-[#f0e6d3] bg-white text-stone-500 text-sm font-bold disabled:opacity-30 hover:border-amber-300 hover:text-amber-700 transition-all"
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
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.04, 0.4) }}
      whileHover={{ y: -4 }}
      className="group relative flex flex-col overflow-hidden border transition-all duration-300 rounded-2xl bg-[#fffbf5] border-[#f0e6d3] hover:shadow-[0_8px_32px_rgba(217,119,6,0.15)] hover:border-amber-200"
    >
      <Link to={buildStorePath(slug, `/produto/${product.id}`)} className="relative overflow-hidden block aspect-square bg-amber-50/60">
        {primaryImage
          ? <img src={primaryImage} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
          : <div className="w-full h-full flex items-center justify-center text-amber-200"><Package size={48} strokeWidth={1} /></div>}
        {allImages.length > 1 && (
          <div className="absolute bottom-2 left-2 bg-stone-800/60 text-white text-[8px] font-black px-2 py-0.5 rounded-full backdrop-blur-sm flex items-center gap-1">
            <span>+{allImages.length - 1}</span> fotos
          </div>
        )}
        <div className="absolute top-2 left-2 flex flex-col gap-1">
          {discountPct > 0 && (
            <span className="text-white text-[9px] font-black px-2 py-0.5 rounded-full" style={{ backgroundColor: "#c2713a" }}>
              -{discountPct}%
            </span>
          )}
          {product.is_featured && (
            <span className="text-white text-[9px] font-black px-2 py-0.5 rounded-full flex items-center gap-0.5"
              style={{ backgroundColor: style.accent }}>
              <Flame size={8} /> Top
            </span>
          )}
        </div>
        <div className="absolute top-2 right-2 flex flex-col gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={e => { e.preventDefault(); onWishlist(product.id); }}
            className={cn("w-8 h-8 rounded-full flex items-center justify-center shadow border transition-all",
              inWishlist ? "bg-red-500 border-red-500 text-white" : "bg-white border-amber-200 text-stone-400 hover:text-red-500")}
          >
            <Heart size={12} fill={inWishlist ? "currentColor" : "none"} />
          </button>
          <button
            onClick={e => { e.preventDefault(); e.stopPropagation(); navigate(buildStorePath(slug, `/produto/${product.id}`)); }}
            className="w-8 h-8 rounded-full bg-white border border-amber-200 flex items-center justify-center shadow text-stone-400 hover:text-amber-600 transition-all"
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
      <div className="flex flex-col flex-1 p-3 gap-1">
        <p className="text-[9px] font-black uppercase tracking-widest text-amber-600/60">{product.category_name || "Geral"}</p>
        <Link to={buildStorePath(slug, `/produto/${product.id}`)} className="text-xs font-semibold text-stone-700 line-clamp-2 leading-snug hover:text-amber-700 transition-colors">
          {product.name}
        </Link>
        {Array.isArray(product.variations) && product.variations.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {product.variations[0]?.options.slice(0, 4).map((opt, i) => (
              <span key={i} className="text-[9px] border border-amber-100 rounded px-1.5 py-0.5 text-stone-500 bg-amber-50/50">{opt.value}</span>
            ))}
          </div>
        )}
        <div className="flex items-center justify-between mt-auto pt-2">
          <div>
            {product.discount_price ? (
              <div className="flex flex-col">
                <span className="text-[10px] text-stone-400 line-through font-mono">R$ {Number(product.price).toFixed(2)}</span>
                <span className="text-sm font-black font-mono" style={{ color: "#c2713a" }}>R$ {Number(product.discount_price).toFixed(2)}</span>
              </div>
            ) : (
              <span className="text-sm font-black font-mono" style={{ color: style.accent }}>R$ {Number(product.price).toFixed(2)}</span>
            )}
          </div>
          <button
            onClick={() => onAddToCart(product)}
            style={{ backgroundColor: style.accent }}
            className="text-white transition-all active:scale-90 w-8 h-8 flex items-center justify-center rounded-xl shadow-sm hover:shadow-[0_4px_12px_rgba(217,119,6,0.35)]"
          >
            <Plus size={14} strokeWidth={3} />
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
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: Math.min(index * 0.03, 0.3) }}
      className="flex gap-4 border transition-all group p-3 rounded-2xl bg-[#fffbf5] border-[#f0e6d3] hover:shadow-[0_4px_20px_rgba(217,119,6,0.1)] hover:border-amber-200"
    >
      <Link to={buildStorePath(slug, `/produto/${product.id}`)} className="w-24 h-24 shrink-0 rounded-xl overflow-hidden bg-amber-50/60 relative">
        {primaryImage
          ? <img src={primaryImage} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
          : <div className="w-full h-full flex items-center justify-center text-amber-200"><Package size={28} strokeWidth={1} /></div>}
        {discountPct > 0 && (
          <span className="absolute top-1 left-1 text-white text-[8px] font-black px-1.5 py-0.5 rounded-full"
            style={{ backgroundColor: "#c2713a" }}>-{discountPct}%</span>
        )}
        {allImages.length > 1 && (
          <span className="absolute bottom-1 right-1 bg-stone-800/60 text-white text-[7px] font-black px-1.5 py-0.5 rounded-full">+{allImages.length - 1}</span>
        )}
      </Link>

      <div className="flex-1 min-w-0 flex flex-col justify-between">
        <div>
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[9px] font-black text-amber-600/60 uppercase tracking-widest">{product.category_name || "Geral"}</p>
              <Link to={buildStorePath(slug, `/produto/${product.id}`)} className="text-sm font-semibold text-stone-700 hover:text-amber-700 transition-colors leading-snug line-clamp-2 mt-0.5 block">
                {product.name}
              </Link>
            </div>
            <button
              onClick={() => onWishlist(product.id)}
              className={cn("shrink-0 p-1.5 rounded-lg transition-all", inWishlist ? "text-red-500" : "text-stone-300 hover:text-red-400")}
            >
              <Heart size={14} fill={inWishlist ? "currentColor" : "none"} />
            </button>
          </div>
          {product.description && <p className="text-[11px] mt-1 line-clamp-2 leading-relaxed text-stone-500">{product.description}</p>}
          {Array.isArray(product.variations) && product.variations.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {product.variations.map((v, vi) => (
                <span key={vi} className="text-[9px] font-bold px-2 py-0.5 bg-amber-50 text-amber-600 rounded-full border border-amber-100">
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
                <span className="text-[10px] line-through font-mono text-stone-400">R$ {Number(product.price).toFixed(2)}</span>
                <span className="text-base font-black font-mono" style={{ color: "#c2713a" }}>R$ {Number(product.discount_price).toFixed(2)}</span>
              </div>
            ) : (
              <span className="text-base font-black font-mono" style={{ color: style.accent }}>R$ {Number(product.price).toFixed(2)}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Link to={buildStorePath(slug, `/produto/${product.id}`)}
              className="h-8 px-3 rounded-xl border border-[#f0e6d3] text-[10px] font-bold text-stone-500 hover:border-amber-300 hover:text-amber-700 flex items-center gap-1.5 transition-all bg-white">
              <Eye size={12} /> Ver
            </Link>
            <button
              onClick={() => onAddToCart(product)}
              style={{ backgroundColor: style.accent }}
              className="h-8 px-4 rounded-xl text-white text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 active:scale-95 transition-all shadow-sm hover:shadow-[0_4px_14px_rgba(217,119,6,0.35)]"
            >
              <Plus size={12} strokeWidth={3} /> Adicionar
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
