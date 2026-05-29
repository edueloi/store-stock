import React, { useState, useRef, useEffect } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import StoreSEO from "../../../../components/store/StoreSEO";
import { motion, AnimatePresence } from "motion/react";
import {
  Search, X, LayoutGrid, List, ArrowUpDown, Check,
  ChevronDown, Package, Heart, Eye, Plus, SlidersHorizontal, Tag,
} from "lucide-react";
import { cn } from "../../../../lib/utils";
import { useStore } from "../../StoreLayout";
import { Product } from "../../../../types";
import { buildStorePath, resolveStoreSlug } from "../../store-routing";

type SortKey = "default" | "price_asc" | "price_desc" | "name";
type ViewMode = "grid" | "list";

export default function StoreCatalog() {
  const { slug: routeSlug } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { categories, products, addToCart, style, tenant } = useStore();
  const slug = resolveStoreSlug(routeSlug);

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

  useEffect(() => {
    const q = searchParams.get("q") || "";
    const cat = searchParams.get("cat") ? Number(searchParams.get("cat")) : null;
    setSearchTerm(q);
    setSelectedCategory(cat);
  }, [searchParams]);

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

  return (
    <div className="min-h-screen bg-white">
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
        <nav className="flex items-center gap-2 text-[10px] font-bold uppercase mb-6 text-slate-400 tracking-[0.12em]">
          <Link to={buildStorePath(slug)} className="transition-colors hover:text-[#2563eb]">Início</Link>
          <span>/</span>
          <span className="text-[#0f172a]">Catálogo</span>
          {catName && <><span>/</span><span style={{ color: style.accent }}>{catName}</span></>}
        </nav>

        <div className="flex gap-6">

          {/* ── SIDEBAR ──────────────────────────────────────────── */}
          <aside className="hidden lg:flex flex-col gap-1.5 w-56 shrink-0">
            <div className="bg-white border border-slate-100 rounded-2xl p-4 space-y-1.5">
              <p className="text-[9px] font-black uppercase tracking-[0.15em] px-1 mb-3 text-slate-400 flex items-center gap-1.5">
                <Tag size={10} style={{ color: style.accent }} /> Filtrar por
              </p>

              <button
                onClick={() => { setSelectedCategory(null); updateParams("cat", null); }}
                className={cn(
                  "flex items-center justify-between px-3 py-2.5 text-xs font-bold transition-all rounded-xl w-full",
                  selectedCategory === null
                    ? "text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-50 hover:text-[#2563eb]"
                )}
                style={selectedCategory === null ? { backgroundColor: style.accent } : {}}
              >
                <span className="flex items-center gap-2"><LayoutGrid size={13} /> Todos</span>
                <span className={cn("text-[9px] font-black px-1.5 py-0.5 rounded-full",
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
                      "flex items-center justify-between px-3 py-2.5 text-xs font-bold transition-all rounded-xl w-full",
                      active
                        ? "text-white shadow-sm"
                        : "text-slate-600 hover:bg-slate-50 hover:text-[#2563eb]"
                    )}
                    style={active ? { backgroundColor: style.accent } : {}}
                  >
                    <span className="flex items-center gap-2 truncate"><Tag size={12} className="shrink-0" /> <span className="truncate">{cat.name}</span></span>
                    <span className={cn("text-[9px] font-black px-1.5 py-0.5 rounded-full shrink-0",
                      active ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500")}>{count}</span>
                  </button>
                );
              })}

              {products.length > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-100">
                  <p className="text-[9px] font-black uppercase tracking-[0.15em] px-1 mb-2 text-slate-400">Faixa de preço</p>
                  <div className="px-1 space-y-1">
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
                          onClick={() => { }}
                          className="flex items-center justify-between w-full text-[10px] transition-colors py-1 text-slate-500 hover:text-[#2563eb]"
                        >
                          <span className="font-medium">{label as string}</span>
                          <span
                            className="text-[9px] px-1.5 py-0.5 rounded-full font-bold"
                            style={{ backgroundColor: style.accent + "14", color: style.accent }}
                          >{count}</span>
                        </button>
                      );
                    })}
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
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors text-slate-400 group-focus-within:text-[#2563eb]" />
                <input
                  type="text"
                  placeholder="Buscar produtos..."
                  value={searchTerm}
                  onChange={e => { setSearchTerm(e.target.value); updateParams("q", e.target.value || null); }}
                  className="w-full pl-10 pr-9 h-11 text-sm font-medium outline-none transition-all bg-white border border-slate-200 rounded-xl placeholder:text-slate-300 focus:border-[#2563eb] focus:ring-2 focus:ring-blue-100 text-[#0f172a]"
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
                className="lg:hidden flex items-center gap-2 h-11 px-3 text-xs font-bold border border-slate-200 bg-white rounded-xl text-slate-600 hover:border-slate-300"
              >
                <SlidersHorizontal size={14} style={{ color: style.accent }} /> Filtros
                {selectedCategory !== null && (
                  <span style={{ backgroundColor: style.accent }} className="w-4 h-4 rounded-full text-white text-[8px] font-black flex items-center justify-center">1</span>
                )}
              </button>

              <div className="flex items-center gap-2 shrink-0">
                {/* Sort */}
                <div ref={sortRef} className="relative">
                  <button
                    onClick={() => setShowSortMenu(v => !v)}
                    className="flex items-center gap-2 h-11 px-3 text-xs font-bold transition-all border border-slate-200 bg-white rounded-xl text-slate-600 hover:border-slate-300"
                  >
                    <ArrowUpDown size={13} style={{ color: style.accent }} />
                    <span className="hidden sm:inline">{sortLabels[sortBy]}</span>
                    <ChevronDown size={12} className={cn("transition-transform", showSortMenu && "rotate-180")} />
                  </button>
                  <AnimatePresence>
                    {showSortMenu && (
                      <motion.div
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        className="absolute right-0 top-full mt-2 rounded-2xl shadow-md z-50 min-w-[180px] py-1 border bg-white border-slate-100"
                      >
                        {(Object.entries(sortLabels) as [SortKey, string][]).map(([val, label]) => (
                          <button
                            key={val}
                            onClick={() => { setSortBy(val); setShowSortMenu(false); }}
                            className="w-full flex items-center justify-between gap-3 px-4 py-2.5 text-xs font-semibold transition-colors text-slate-700 hover:bg-slate-50"
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
                <div className="flex h-11 overflow-hidden bg-white border border-slate-200 rounded-xl">
                  {(["grid", "list"] as ViewMode[]).map(mode => (
                    <button
                      key={mode}
                      onClick={() => setViewMode(mode)}
                      className={cn("w-10 flex items-center justify-center transition-all",
                        viewMode === mode ? "text-white" : "text-slate-400 hover:text-[#2563eb]")}
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
                  <div className="bg-white border border-slate-100 rounded-2xl p-4 space-y-1.5">
                    <button
                      onClick={() => { setSelectedCategory(null); updateParams("cat", null); setSidebarOpen(false); }}
                      className={cn("flex items-center justify-between px-3 py-2.5 text-xs font-bold transition-all rounded-xl w-full",
                        selectedCategory === null ? "text-white" : "text-slate-600 hover:bg-slate-50")}
                      style={selectedCategory === null ? { backgroundColor: style.accent } : {}}
                    >
                      <span className="flex items-center gap-2"><LayoutGrid size={13} /> Todos</span>
                      <span className={cn("text-[9px] font-black px-1.5 py-0.5 rounded-full",
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
                          onClick={() => { setSelectedCategory(cat.id); updateParams("cat", String(cat.id)); setSidebarOpen(false); }}
                          className={cn("flex items-center justify-between px-3 py-2.5 text-xs font-bold transition-all rounded-xl w-full",
                            active ? "text-white" : "text-slate-600 hover:bg-slate-50")}
                          style={active ? { backgroundColor: style.accent } : {}}
                        >
                          <span className="flex items-center gap-2 truncate"><Tag size={12} className="shrink-0" /><span className="truncate">{cat.name}</span></span>
                          <span className={cn("text-[9px] font-black px-1.5 py-0.5 rounded-full shrink-0",
                            active ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500")}>{count}</span>
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
                  className={cn("px-3 h-8 whitespace-nowrap font-bold text-[10px] uppercase tracking-[0.1em] rounded-full border shrink-0 transition-all",
                    selectedCategory === cat.id ? "text-white border-transparent" : "bg-white text-slate-500 border-slate-200 hover:border-slate-300")}
                >
                  {cat.name}
                </button>
              ))}
            </div>

            {/* Active filters */}
            {(selectedCategory !== null || searchTerm) && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">Filtros:</span>
                {catName && (
                  <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold border"
                    style={{ backgroundColor: style.accent + "14", borderColor: style.accent + "30", color: style.accent }}>
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
                <button
                  onClick={() => { setSelectedCategory(null); setSearchTerm(""); setSearchParams({}); }}
                  className="text-[10px] font-bold uppercase tracking-[0.1em]"
                  style={{ color: style.accent }}
                >
                  Limpar tudo
                </button>
              </div>
            )}

            {/* Result count */}
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
              {filtered.length} produto{filtered.length !== 1 ? "s" : ""} encontrado{filtered.length !== 1 ? "s" : ""}
            </p>

            {/* Empty */}
            {filtered.length === 0 && (
              <div className="py-24 flex flex-col items-center gap-4 text-slate-400">
                <Package size={48} strokeWidth={1} className="opacity-30" />
                <div className="text-center">
                  <p className="text-sm font-black uppercase tracking-tight text-[#0f172a]">Nenhum produto encontrado</p>
                  <p className="text-xs text-slate-400 mt-1">Tente outros filtros ou termos</p>
                </div>
                <button
                  onClick={() => { setSearchTerm(""); setSelectedCategory(null); setSearchParams({}); }}
                  style={{ backgroundColor: style.accent }}
                  className="text-white px-6 h-10 rounded-xl text-[11px] font-black uppercase tracking-wider shadow-sm hover:shadow-md transition-all"
                >
                  Limpar filtros
                </button>
              </div>
            )}

            {/* GRID */}
            {viewMode === "grid" && filtered.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
                {filtered.map((product, i) => (
                  <ProductCard key={product.id} product={product} index={i} slug={slug} style={style} wishlist={wishlist} onWishlist={toggleWishlist} onAddToCart={addToCart} />
                ))}
              </div>
            )}

            {/* LIST */}
            {viewMode === "list" && filtered.length > 0 && (
              <div className="flex flex-col gap-3">
                {filtered.map((product, i) => (
                  <ProductRow key={product.id} product={product} index={i} slug={slug} style={style} wishlist={wishlist} onWishlist={toggleWishlist} onAddToCart={addToCart} />
                ))}
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
      whileHover={{ y: -2 }}
      className="group relative flex flex-col overflow-hidden border transition-all duration-300 rounded-2xl bg-white border-slate-100 hover:shadow-md hover:border-slate-200"
    >
      <Link to={buildStorePath(slug, `/produto/${product.id}`)} className="relative overflow-hidden block aspect-square bg-slate-50">
        {primaryImage
          ? <img src={primaryImage} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
          : <div className="w-full h-full flex items-center justify-center text-slate-200"><Package size={48} strokeWidth={1} /></div>}
        {allImages.length > 1 && (
          <div className="absolute bottom-2 left-2 bg-[#0f172a]/60 text-white text-[8px] font-black px-2 py-0.5 rounded-full backdrop-blur-sm flex items-center gap-1">
            <span>+{allImages.length - 1}</span> fotos
          </div>
        )}
        <div className="absolute top-2.5 left-2.5 flex flex-col gap-1">
          {discountPct > 0 && (
            <span className="text-white text-[9px] font-black px-2 py-0.5 rounded-full bg-red-500">
              -{discountPct}%
            </span>
          )}
          {product.is_featured && (
            <span className="text-white text-[9px] font-black px-2 py-0.5 rounded-full flex items-center gap-0.5"
              style={{ backgroundColor: style.accent }}>
              Top
            </span>
          )}
        </div>
        <div className="absolute top-2.5 right-2.5 flex flex-col gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={e => { e.preventDefault(); onWishlist(product.id); }}
            className={cn("w-8 h-8 rounded-full flex items-center justify-center shadow-sm border transition-all",
              inWishlist ? "bg-red-500 border-red-500 text-white" : "bg-white border-slate-200 text-slate-400 hover:text-red-500")}
          >
            <Heart size={12} fill={inWishlist ? "currentColor" : "none"} />
          </button>
          <Link
            to={buildStorePath(slug, `/produto/${product.id}`)}
            onClick={e => e.stopPropagation()}
            className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center shadow-sm text-slate-400 hover:text-[#2563eb] transition-all"
          >
            <Eye size={12} />
          </Link>
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
      <div className="flex flex-col flex-1 p-3 gap-1.5">
        <p className="text-[9px] font-black uppercase tracking-[0.12em] text-slate-400">{product.category_name || "Geral"}</p>
        <Link to={buildStorePath(slug, `/produto/${product.id}`)} className="text-xs font-semibold text-[#0f172a] line-clamp-2 leading-snug hover:text-[#2563eb] transition-colors">
          {product.name}
        </Link>
        {Array.isArray(product.variations) && product.variations.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {product.variations[0]?.options.slice(0, 4).map((opt, i) => (
              <span key={i} className="text-[9px] border border-slate-100 rounded px-1.5 py-0.5 text-slate-500 bg-slate-50">{opt.value}</span>
            ))}
          </div>
        )}
        <div className="flex items-center justify-between mt-auto pt-2">
          <div>
            {product.discount_price ? (
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-400 line-through font-mono">R$ {Number(product.price).toFixed(2)}</span>
                <span className="text-sm font-black font-mono text-red-500">R$ {Number(product.discount_price).toFixed(2)}</span>
              </div>
            ) : (
              <span className="text-sm font-black font-mono" style={{ color: style.accent }}>R$ {Number(product.price).toFixed(2)}</span>
            )}
          </div>
          <button
            onClick={() => onAddToCart(product)}
            style={{ backgroundColor: style.accent }}
            className="text-white transition-all active:scale-90 w-8 h-8 flex items-center justify-center rounded-xl shadow-sm hover:shadow-md"
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
      className="flex gap-4 border transition-all group p-3 rounded-2xl bg-white border-slate-100 hover:shadow-sm hover:border-slate-200"
    >
      <Link to={buildStorePath(slug, `/produto/${product.id}`)} className="w-24 h-24 shrink-0 rounded-xl overflow-hidden bg-slate-100 relative">
        {primaryImage
          ? <img src={primaryImage} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
          : <div className="w-full h-full flex items-center justify-center text-slate-200"><Package size={28} strokeWidth={1} /></div>}
        {discountPct > 0 && (
          <span className="absolute top-1 left-1 text-white text-[8px] font-black px-1.5 py-0.5 rounded-full bg-red-500">-{discountPct}%</span>
        )}
        {allImages.length > 1 && (
          <span className="absolute bottom-1 right-1 bg-[#0f172a]/60 text-white text-[7px] font-black px-1.5 py-0.5 rounded-full">+{allImages.length - 1}</span>
        )}
      </Link>

      <div className="flex-1 min-w-0 flex flex-col justify-between">
        <div>
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.12em]">{product.category_name || "Geral"}</p>
              <Link to={buildStorePath(slug, `/produto/${product.id}`)} className="text-sm font-semibold text-[#0f172a] hover:text-[#2563eb] transition-colors leading-snug line-clamp-2 mt-0.5 block">
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
                <span key={vi} className="text-[9px] font-bold px-2 py-0.5 rounded-full border border-slate-100 text-slate-500 bg-slate-50">
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
                <span className="text-base font-black font-mono text-red-500">R$ {Number(product.discount_price).toFixed(2)}</span>
              </div>
            ) : (
              <span className="text-base font-black font-mono" style={{ color: style.accent }}>R$ {Number(product.price).toFixed(2)}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Link to={buildStorePath(slug, `/produto/${product.id}`)}
              className="h-8 px-3 rounded-xl border border-slate-200 text-[10px] font-bold text-slate-500 hover:border-slate-300 hover:text-[#2563eb] flex items-center gap-1.5 transition-all bg-white">
              <Eye size={12} /> Ver
            </Link>
            <button
              onClick={() => onAddToCart(product)}
              style={{ backgroundColor: style.accent }}
              className="h-8 px-4 rounded-xl text-white text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 active:scale-95 transition-all shadow-sm hover:shadow-md"
            >
              <Plus size={12} strokeWidth={3} /> Adicionar
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
