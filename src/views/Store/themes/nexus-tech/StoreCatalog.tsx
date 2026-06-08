import React, { useState, useRef, useEffect } from "react";
import { useParams, useSearchParams, Link, useNavigate } from "react-router-dom";
import StoreSEO from "../../../../components/store/StoreSEO";
import { motion, AnimatePresence } from "motion/react";
import {
  Search, X, LayoutGrid, List, ArrowUpDown, Check,
  ChevronDown, Tag, Package, Heart, Eye, Plus, Flame,
  SlidersHorizontal, ChevronRight, ShoppingBag, Sparkles,
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
    <div className="min-h-screen">
      <StoreSEO
        title={pageTitle}
        description={`Confira ${catName ? `os melhores produtos de ${catName}` : "todo o catálogo"} da ${tenant.name}. Preços atualizados, atendimento via WhatsApp.`}
        url={typeof window !== "undefined" ? window.location.href : ""}
        siteName={tenant.name}
        keywords={`${catName ? `${catName}, ` : ""}${tenant.name}, catálogo, produtos, comprar online${categories.map(c => `, ${c.name}`).join("")}`}
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          "name": pageTitle,
          "description": `Catálogo de produtos da ${tenant.name}`,
          "url": typeof window !== "undefined" ? window.location.href : "",
          "numberOfItems": filtered.length,
        }}
      />

      {/* ═══════════════════════════════════════════════════════════════════════
          HEADER HERO
      ═══════════════════════════════════════════════════════════════════════ */}
      <div className="relative overflow-hidden bg-[linear-gradient(160deg,#f0f6ff_0%,#fafcff_50%,#eef4ff_100%)] border-b border-[#e2ecff]">
        {/* Ambient */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-12 right-1/4 w-64 h-64 rounded-full bg-[#3b82f6]/7 blur-3xl" />
          <div className="absolute bottom-0 left-1/3 w-48 h-48 rounded-full bg-[#6366f1]/7 blur-3xl" />
        </div>
        <div className="absolute inset-0 tech-grid opacity-35 pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-4 md:px-8 pt-10 pb-10 md:pt-12 md:pb-12">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#8baed0] mb-6">
            <Link to={buildStorePath(slug)} className="hover:text-[#071426] transition-colors">Início</Link>
            <ChevronRight size={10} />
            <span className="text-[#071426]">Catálogo</span>
            {catName && (
              <>
                <ChevronRight size={10} />
                <span style={{ color: style.accent }}>{catName}</span>
              </>
            )}
          </nav>

          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[#d7e4ff] bg-white/80 px-3 py-1.5 mb-4">
                <Sparkles size={10} style={{ color: style.accent }} />
                <p className="store-kicker text-[9px] font-semibold text-[#5b7898] tracking-[0.2em]">Catálogo inteligente</p>
              </div>
              <h1 className="store-display text-[3rem] sm:text-5xl md:text-6xl leading-[0.88] text-[#071426] tracking-[-0.02em]">
                {catName || "Linha completa"}
              </h1>
              <p className="mt-3 max-w-lg text-[13px] md:text-[15px] leading-relaxed text-[#4e6c8e]">
                {catName
                  ? `Produtos selecionados em ${catName} com qualidade garantida e os melhores preços.`
                  : "Explore toda a linha de produtos com filtros inteligentes, preços claros e ordenação por preferência."}
              </p>
            </div>

            {/* Stats chips */}
            <div className="flex gap-3 shrink-0">
              {[
                { value: filtered.length, label: "Itens" },
                { value: categories.length, label: "Categorias" },
                { value: saleCount, label: "Ofertas" },
              ].map(item => (
                <div key={item.label} className="tech-panel rounded-[1.4rem] border border-[#dbe6ff] bg-white/90 px-4 py-3 text-center shadow-[0_2px_16px_rgba(37,99,235,0.07)] min-w-[64px]">
                  <p className="store-display text-[2rem] leading-none font-semibold" style={{ color: style.accent }}>{item.value}</p>
                  <p className="store-kicker mt-1 text-[9px] font-semibold text-[#7b9ac0]">{item.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          BODY
      ═══════════════════════════════════════════════════════════════════════ */}
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-8">
        <div className="flex gap-7">

          {/* ── SIDEBAR ────────────────────────────────────────── */}
          <aside className="hidden lg:flex flex-col gap-1.5 w-56 shrink-0">

            <p className="text-[9px] font-bold uppercase tracking-[0.26em] px-3 mb-3 text-[#8baed0]">Filtrar por linha</p>

            {/* All button */}
            <button
              onClick={() => { setSelectedCategory(null); updateParams("cat", null); }}
              className={cn(
                "flex items-center justify-between px-4 py-2.5 text-[11px] font-semibold transition-all rounded-[1.1rem] border",
                selectedCategory === null
                  ? "text-white border-transparent shadow-[0_8px_20px_rgba(37,99,235,0.22)]"
                  : "text-[#4e6c8e] bg-white/90 border-[#dbe6ff] hover:bg-white hover:border-[#b3caff]"
              )}
              style={selectedCategory === null ? { backgroundColor: style.accent } : {}}
            >
              <span className="flex items-center gap-2"><LayoutGrid size={12} /> Todos os produtos</span>
              <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded-full",
                selectedCategory === null ? "bg-white/20 text-white" : "bg-[#edf4ff] text-[#5b7898]")}>
                {products.filter(p => p.is_active).length}
              </span>
            </button>

            {/* Category buttons */}
            {categories.map(cat => {
              const count = products.filter(p => p.is_active && p.category_id === cat.id).length;
              const active = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => { setSelectedCategory(cat.id); updateParams("cat", String(cat.id)); }}
                  className={cn(
                    "flex items-center justify-between px-4 py-2.5 text-[11px] font-semibold transition-all rounded-[1.1rem] border",
                    active
                      ? "text-white border-transparent shadow-[0_8px_20px_rgba(37,99,235,0.22)]"
                      : "text-[#4e6c8e] bg-white/90 border-[#dbe6ff] hover:bg-white hover:border-[#b3caff]"
                  )}
                  style={active ? { backgroundColor: style.accent } : {}}
                >
                  <span className="flex items-center gap-2 truncate min-w-0">
                    <Tag size={11} className="shrink-0" />
                    <span className="truncate">{cat.name}</span>
                  </span>
                  <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0",
                    active ? "bg-white/20 text-white" : "bg-[#edf4ff] text-[#5b7898]")}>{count}</span>
                </button>
              );
            })}

            {/* Price range */}
            {products.length > 0 && (
              <div className="mt-5 pt-5 border-t border-[#e2ecff]">
                <p className="text-[9px] font-bold uppercase tracking-[0.26em] px-3 mb-3 text-[#8baed0]">Faixa de preço</p>
                <div className="px-1 space-y-1">
                  {([
                    ["Até R$ 50", 0, 50],
                    ["R$ 50 – 200", 50, 200],
                    ["R$ 200 – 500", 200, 500],
                    ["Acima de R$ 500", 500, Infinity],
                  ] as [string, number, number][]).map(([label, min, max]) => {
                    const count = products.filter(p => p.is_active && Number(p.price) >= min && Number(p.price) < max).length;
                    if (count === 0) return null;
                    const active = priceRange !== null && priceRange[0] === min && priceRange[1] === max;
                    return (
                      <button
                        key={label}
                        onClick={() => { setPriceRange(active ? null : [min, max]); setCurrentPage(1); }}
                        className={cn("flex items-center justify-between w-full text-[11px] font-medium py-1.5 px-3 rounded-xl transition-all",
                          active ? "text-[#071426] bg-white/80 font-bold" : "text-[#4e6c8e] hover:text-[#071426] hover:bg-white/80")}
                      >
                        <span>{label}</span>
                        <span className={cn("text-[9px] px-2 py-0.5 rounded-full font-bold",
                          active ? "text-white" : "bg-[#edf4ff] text-[#5b7898]")}
                          style={active ? { backgroundColor: style.accent } : {}}>{count}</span>
                      </button>
                    );
                  })}
                  {priceRange !== null && (
                    <button onClick={() => setPriceRange(null)} className="text-[9px] font-bold text-[#5b7898] hover:text-[#071426] px-3 mt-1">
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
                <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8baed0] group-focus-within:text-[#2563eb] transition-colors" />
                <input
                  type="text"
                  placeholder="Buscar produtos..."
                  value={searchTerm}
                  onChange={e => { setSearchTerm(e.target.value); updateParams("q", e.target.value || null); }}
                  className="w-full pl-11 pr-10 h-11 text-[13px] font-medium outline-none transition-all bg-white/90 border border-[#dbe6ff] rounded-full placeholder:text-[#a0b8d4] text-[#071426] focus:border-[#7aa2ff] focus:ring-2 focus:ring-[#dce8ff] shadow-[0_2px_12px_rgba(37,99,235,0.06)]"
                />
                {searchTerm && (
                  <button
                    onClick={() => { setSearchTerm(""); updateParams("q", null); }}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-[#edf4ff] flex items-center justify-center text-[#5b7898] hover:bg-[#dbe6ff] transition-all"
                  >
                    <X size={11} />
                  </button>
                )}
              </div>

              {/* Mobile filter */}
              <button
                onClick={() => { /* mobile sidebar toggle */ }}
                className="lg:hidden flex items-center gap-2 h-11 px-4 text-[11px] font-semibold border border-[#dbe6ff] bg-white/90 rounded-full text-[#4e6c8e] shadow-[0_2px_12px_rgba(37,99,235,0.06)]"
              >
                <SlidersHorizontal size={13} /> Filtros
                {selectedCategory !== null && (
                  <span style={{ backgroundColor: style.accent }} className="w-4 h-4 rounded-full text-white text-[8px] font-bold flex items-center justify-center">1</span>
                )}
              </button>

              <div className="flex items-center gap-2 shrink-0">
                {/* Sort */}
                <div ref={sortRef} className="relative">
                  <button
                    onClick={() => setShowSortMenu(v => !v)}
                    className="flex items-center gap-2 h-11 px-4 text-[11px] font-semibold transition-all border border-[#dbe6ff] bg-white/90 rounded-full text-[#4e6c8e] hover:border-[#b3caff] shadow-[0_2px_12px_rgba(37,99,235,0.06)]"
                  >
                    <ArrowUpDown size={12} />
                    <span className="hidden sm:inline">{sortLabels[sortBy]}</span>
                    <ChevronDown size={11} className={cn("transition-transform", showSortMenu && "rotate-180")} />
                  </button>
                  <AnimatePresence>
                    {showSortMenu && (
                      <motion.div
                        initial={{ opacity: 0, y: -8, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -8, scale: 0.97 }}
                        transition={{ duration: 0.15 }}
                        className="absolute right-0 top-full mt-2 rounded-2xl shadow-[0_8px_40px_rgba(37,99,235,0.14)] z-50 min-w-[190px] py-1.5 border border-[#dbe6ff] bg-white"
                      >
                        {(Object.entries(sortLabels) as [SortKey, string][]).map(([val, label]) => (
                          <button
                            key={val}
                            onClick={() => { setSortBy(val); setShowSortMenu(false); }}
                            className="w-full flex items-center justify-between gap-3 px-4 py-2.5 text-[11px] font-semibold transition-colors text-[#4e6c8e] hover:bg-[#f4f8ff] hover:text-[#071426]"
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
                <div className="flex h-11 overflow-hidden bg-white/90 border border-[#dbe6ff] rounded-full shadow-[0_2px_12px_rgba(37,99,235,0.06)]">
                  {(["grid", "list"] as ViewMode[]).map(mode => (
                    <button
                      key={mode}
                      onClick={() => setViewMode(mode)}
                      className={cn(
                        "w-11 flex items-center justify-center transition-all",
                        viewMode === mode ? "text-white" : "text-[#8baed0] hover:text-[#4e6c8e]"
                      )}
                      style={viewMode === mode ? { backgroundColor: style.accent } : {}}
                    >
                      {mode === "grid" ? <LayoutGrid size={13} /> : <List size={13} />}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Mobile categories scroll */}
            <div className="flex lg:hidden gap-2 overflow-x-auto pb-1 no-scrollbar">
              {[{ id: null as number | null, name: "Todos" }, ...categories].map((cat, i) => (
                <button
                  key={i}
                  onClick={() => { setSelectedCategory(cat.id); updateParams("cat", cat.id ? String(cat.id) : null); }}
                  style={selectedCategory === cat.id ? { backgroundColor: style.accent } : {}}
                  className={cn(
                    "px-4 h-9 whitespace-nowrap font-semibold text-[10px] uppercase tracking-[0.16em] rounded-full border shrink-0 transition-all",
                    selectedCategory === cat.id ? "text-white border-transparent shadow-[0_6px_16px_rgba(37,99,235,0.22)]" : "bg-white/90 text-[#4e6c8e] border-[#dbe6ff] hover:border-[#b3caff]"
                  )}
                >
                  {cat.name}
                </button>
              ))}
            </div>

            {/* Active filters */}
            <AnimatePresence>
              {(selectedCategory !== null || searchTerm || priceRange !== null) && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex flex-wrap items-center gap-2"
                >
                  <span className="text-[9px] font-bold uppercase tracking-[0.22em] text-[#8baed0]">Filtros ativos:</span>
                  {catName && (
                    <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-semibold bg-white/90 border border-[#dbe6ff] shadow-sm" style={{ color: style.accent }}>
                      <Tag size={9} /> {catName}
                      <button onClick={() => { setSelectedCategory(null); updateParams("cat", null); }} className="ml-0.5 hover:opacity-70"><X size={9} /></button>
                    </span>
                  )}
                  {searchTerm && (
                    <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-semibold bg-white/90 border border-[#dbe6ff] text-[#4e6c8e] shadow-sm">
                      <Search size={9} /> "{searchTerm}"
                      <button onClick={() => { setSearchTerm(""); updateParams("q", null); }} className="ml-0.5 hover:opacity-70"><X size={9} /></button>
                    </span>
                  )}
                  {priceRange !== null && (
                    <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-semibold bg-white/90 border border-[#dbe6ff] shadow-sm" style={{ color: style.accent }}>
                      {priceRange[1] === Infinity ? `Acima de R$ ${priceRange[0]}` : `R$ ${priceRange[0]}–${priceRange[1]}`}
                      <button onClick={() => setPriceRange(null)} className="ml-0.5 hover:opacity-70"><X size={9} /></button>
                    </span>
                  )}
                  <button
                    onClick={() => { setSelectedCategory(null); setSearchTerm(""); setPriceRange(null); setSearchParams({}); }}
                    className="text-[10px] font-semibold text-red-400 hover:text-red-600 uppercase tracking-wider transition-colors"
                  >
                    Limpar tudo
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Result count */}
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#8baed0]">
              {filtered.length} produto{filtered.length !== 1 ? "s" : ""} encontrado{filtered.length !== 1 ? "s" : ""}
            </p>

            {/* Empty state */}
            <AnimatePresence>
              {filtered.length === 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="py-24 flex flex-col items-center gap-5"
                >
                  <div className="tech-pulse w-20 h-20 rounded-[1.8rem] border border-[#dbe6ff] bg-[#f4f8ff] flex items-center justify-center">
                    <Package size={36} strokeWidth={1} className="text-[#b0c4de]" />
                  </div>
                  <div className="text-center">
                    <p className="store-display text-2xl font-semibold text-[#071426]">Nenhum produto encontrado</p>
                    <p className="text-[13px] text-[#6a85a8] mt-1">Tente outros filtros ou termos de busca</p>
                  </div>
                  <button
                    onClick={() => { setSearchTerm(""); setSelectedCategory(null); setPriceRange(null); setSearchParams({}); }}
                    style={{ backgroundColor: style.accent }}
                    className="text-white px-7 h-10 rounded-full text-[11px] font-semibold uppercase tracking-[0.18em] shadow-[0_10px_24px_rgba(37,99,235,0.24)] hover:-translate-y-0.5 transition-all"
                  >
                    Limpar filtros
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── GRID ── */}
            {viewMode === "grid" && filtered.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-5">
                {paginated.map((product, i) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    index={i}
                    slug={slug}
                    style={style}
                    wishlist={wishlist}
                    onWishlist={toggleWishlist}
                    onAddToCart={addToCart}
                  />
                ))}
              </div>
            )}

            {/* ── LIST ── */}
            {viewMode === "list" && filtered.length > 0 && (
              <div className="flex flex-col gap-3">
                {paginated.map((product, i) => (
                  <ProductRow
                    key={product.id}
                    product={product}
                    index={i}
                    slug={slug}
                    style={style}
                    wishlist={wishlist}
                    onWishlist={toggleWishlist}
                    onAddToCart={addToCart}
                  />
                ))}
              </div>
            )}

            {/* PAGINATION */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-1 pt-4">
                <button
                  onClick={() => { setCurrentPage(p => Math.max(1, p - 1)); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                  disabled={currentPage === 1}
                  className="w-9 h-9 rounded-full border border-[#dbe6ff] bg-white text-[#4e6c8e] text-sm font-bold disabled:opacity-30 hover:border-[#7aa2ff] hover:text-[#071426] transition-all"
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
                      ? <span key={`e${i}`} className="w-9 h-9 flex items-center justify-center text-[#8baed0] text-sm">…</span>
                      : <button
                          key={p}
                          onClick={() => { setCurrentPage(p as number); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                          className={cn("w-9 h-9 rounded-full border text-sm font-bold transition-all",
                            currentPage === p
                              ? "text-white border-transparent"
                              : "border-[#dbe6ff] bg-white text-[#4e6c8e] hover:border-[#7aa2ff] hover:text-[#071426]")}
                          style={currentPage === p ? { backgroundColor: style.accent } : {}}
                        >
                          {p}
                        </button>
                  )}
                <button
                  onClick={() => { setCurrentPage(p => Math.min(totalPages, p + 1)); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                  disabled={currentPage === totalPages}
                  className="w-9 h-9 rounded-full border border-[#dbe6ff] bg-white text-[#4e6c8e] text-sm font-bold disabled:opacity-30 hover:border-[#7aa2ff] hover:text-[#071426] transition-all"
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

// ── Shared props ───────────────────────────────────────────────────────────────

interface CardProps {
  product: Product;
  index: number;
  slug: string;
  style: { accent: string; card: string; radius: string; font?: string };
  wishlist: number[];
  onWishlist: (id: number) => void;
  onAddToCart: (p: Product) => void;
}

// ── Product Card (Grid) ────────────────────────────────────────────────────────

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
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.04, 0.32), duration: 0.4 }}
      className="h-full"
    >
      <div className={cn(
        "group relative flex flex-col h-full overflow-hidden border transition-all duration-300 tech-panel tech-card-sheen bg-white/90 hover:-translate-y-1.5 hover:shadow-[0_24px_60px_rgba(37,99,235,0.15)]",
        style.card,
        style.radius
      )}>
        {/* Image */}
        <Link
          to={buildStorePath(slug, `/produto/${product.id}`)}
          className="relative overflow-hidden block aspect-square tech-grid bg-[linear-gradient(160deg,#f4f8ff_0%,#edf4ff_100%)]"
        >
          {primaryImage
            ? <img src={primaryImage} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
            : <div className="w-full h-full flex items-center justify-center"><Package size={44} strokeWidth={1} className="text-[#c5d8f5]" /></div>
          }

          {/* Badges */}
          <div className="absolute top-2.5 left-2.5 flex flex-col gap-1.5">
            {discountPct > 0 && (
              <span className="bg-gradient-to-r from-[#ef4444] to-[#f97316] text-white text-[9px] font-bold px-2.5 py-1 rounded-full shadow-md">
                -{discountPct}%
              </span>
            )}
            {product.is_featured && (
              <span className="bg-gradient-to-r from-[#f59e0b] to-[#f97316] text-white text-[9px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1 shadow-md">
                <Flame size={7} /> Top
              </span>
            )}
          </div>

          {/* Extra images indicator */}
          {allImages.length > 1 && (
            <div className="absolute bottom-2 left-2 bg-black/55 text-white text-[8px] font-bold px-2 py-0.5 rounded-full backdrop-blur-sm">
              +{allImages.length - 1} fotos
            </div>
          )}

          {/* Hover actions */}
          <div className="absolute top-2.5 right-2.5 flex flex-col gap-1.5 opacity-0 group-hover:opacity-100 transition-all duration-200 translate-x-2 group-hover:translate-x-0">
            <button
              onClick={e => { e.preventDefault(); onWishlist(product.id); }}
              className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center shadow-md border transition-all",
                inWishlist ? "bg-red-500 border-red-500 text-white" : "bg-white border-[#dbe6ff] text-[#8baed0] hover:text-red-500 hover:border-red-300"
              )}
            >
              <Heart size={11} fill={inWishlist ? "currentColor" : "none"} />
            </button>
            <button
              onClick={e => { e.preventDefault(); e.stopPropagation(); navigate(buildStorePath(slug, `/produto/${product.id}`)); }}
              className="w-8 h-8 rounded-full bg-white border border-[#dbe6ff] flex items-center justify-center shadow-md text-[#8baed0] hover:text-[#2563eb] hover:border-[#b3caff] transition-all"
            >
              <Eye size={11} />
            </button>
          </div>

          {/* Quick add on hover */}
          <div className="absolute inset-x-0 bottom-0 translate-y-full group-hover:translate-y-0 transition-transform duration-200">
            <button
              onClick={e => { e.preventDefault(); onAddToCart(product); }}
              style={{ backgroundColor: style.accent }}
              className="w-full py-3 text-white text-[10px] font-bold uppercase tracking-[0.18em] flex items-center justify-center gap-2"
            >
              <Plus size={12} strokeWidth={2.5} /> Adicionar ao carrinho
            </button>
          </div>
        </Link>

        {/* Content */}
        <div className="flex flex-col flex-1 p-4 sm:p-5 gap-2">
          <p className="store-kicker text-[9px] font-semibold text-[#7b9ac0]">{product.category_name || "Tecnologia"}</p>
          <Link
            to={buildStorePath(slug, `/produto/${product.id}`)}
            className="store-display text-[1.1rem] sm:text-[1.28rem] font-semibold text-[#071426] line-clamp-2 leading-[1.02] hover:text-[#1d4ed8] transition-colors"
          >
            {product.name}
          </Link>
          {product.description && (
            <p className="text-[11px] leading-relaxed line-clamp-2 text-[#6a85a8]">{product.description}</p>
          )}

          {/* Variation chips */}
          {Array.isArray(product.variations) && product.variations.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {product.variations[0]?.options.slice(0, 4).map((opt, i) => (
                <span key={i} className="text-[9px] border border-[#dbe6ff] rounded-full px-2.5 py-0.5 text-[#6a85a8] bg-white/80">
                  {opt.value}
                </span>
              ))}
            </div>
          )}

          {/* Price + CTA */}
          <div className="flex items-center justify-between mt-auto pt-3 border-t border-[#e2ecff]">
            <div>
              {product.discount_price ? (
                <div>
                  <span className="text-[10px] text-[#b0c4de] line-through font-mono">R$ {Number(product.price).toFixed(2)}</span>
                  <p className="store-display text-[1.28rem] sm:text-[1.48rem] font-semibold text-[#071426] leading-none">
                    R$ {Number(product.discount_price).toFixed(2)}
                  </p>
                </div>
              ) : (
                <p className="store-display text-[1.28rem] sm:text-[1.48rem] font-semibold leading-none" style={{ color: style.accent }}>
                  R$ {Number(product.price).toFixed(2)}
                </p>
              )}
            </div>
            <button
              onClick={() => onAddToCart(product)}
              style={{ backgroundColor: style.accent }}
              className="shrink-0 text-white active:scale-90 w-10 h-10 rounded-full shadow-[0_10px_22px_rgba(37,99,235,0.26)] hover:shadow-[0_14px_28px_rgba(37,99,235,0.36)] hover:scale-105 flex items-center justify-center transition-all"
            >
              <ShoppingBag size={14} />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ── Product Row (List) ─────────────────────────────────────────────────────────

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
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: Math.min(index * 0.03, 0.25), duration: 0.35 }}
    >
      <div className={cn(
        "flex gap-4 border transition-all group tech-panel tech-card-sheen bg-white/90 p-4 sm:p-5 hover:-translate-y-0.5 hover:shadow-[0_20px_50px_rgba(37,99,235,0.12)]",
        style.card,
        style.radius
      )}>
        {/* Image */}
        <Link
          to={buildStorePath(slug, `/produto/${product.id}`)}
          className="w-24 h-24 sm:w-28 sm:h-28 shrink-0 rounded-[1.4rem] overflow-hidden tech-grid bg-[linear-gradient(160deg,#f4f8ff_0%,#edf4ff_100%)] relative"
        >
          {primaryImage
            ? <img src={primaryImage} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
            : <div className="w-full h-full flex items-center justify-center"><Package size={28} strokeWidth={1} className="text-[#c5d8f5]" /></div>
          }
          {discountPct > 0 && (
            <span className="absolute top-1.5 left-1.5 text-white text-[8px] font-bold px-2 py-0.5 bg-gradient-to-r from-[#ef4444] to-[#f97316] rounded-full shadow">-{discountPct}%</span>
          )}
          {allImages.length > 1 && (
            <span className="absolute bottom-1 right-1 bg-black/55 text-white text-[7px] font-bold px-1.5 py-0.5 rounded-full">+{allImages.length - 1}</span>
          )}
        </Link>

        {/* Details */}
        <div className="flex-1 min-w-0 flex flex-col justify-between">
          <div>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="store-kicker text-[9px] font-semibold text-[#7b9ac0]">{product.category_name || "Tecnologia"}</p>
                <Link
                  to={buildStorePath(slug, `/produto/${product.id}`)}
                  className="store-display text-[1.25rem] sm:text-[1.48rem] font-semibold text-[#071426] hover:text-[#1d4ed8] transition-colors leading-[0.97] line-clamp-2 mt-0.5 block"
                >
                  {product.name}
                </Link>
              </div>
              <button
                onClick={() => onWishlist(product.id)}
                className={cn(
                  "shrink-0 w-8 h-8 rounded-full border flex items-center justify-center transition-all",
                  inWishlist ? "bg-red-50 border-red-300 text-red-500" : "border-[#dbe6ff] text-[#8baed0] hover:text-red-400 hover:border-red-200"
                )}
              >
                <Heart size={13} fill={inWishlist ? "currentColor" : "none"} />
              </button>
            </div>
            {product.description && (
              <p className="text-[11px] mt-1.5 line-clamp-2 leading-relaxed text-[#6a85a8]">{product.description}</p>
            )}
            {Array.isArray(product.variations) && product.variations.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {product.variations.map((v, vi) => (
                  <span key={vi} className="text-[9px] font-semibold px-2 py-0.5 bg-white border border-[#dbe6ff] text-[#6a85a8] rounded-full">
                    {v.name}: {v.options.map(o => o.value).join(", ")}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Price + actions */}
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-[#e2ecff]">
            <div>
              {product.discount_price ? (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] line-through font-mono text-[#b0c4de]">R$ {Number(product.price).toFixed(2)}</span>
                  <span className="store-display text-[1.4rem] sm:text-[1.62rem] font-semibold text-[#071426]">
                    R$ {Number(product.discount_price).toFixed(2)}
                  </span>
                </div>
              ) : (
                <span className="store-display text-[1.4rem] sm:text-[1.62rem] font-semibold" style={{ color: style.accent }}>
                  R$ {Number(product.price).toFixed(2)}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Link
                to={buildStorePath(slug, `/produto/${product.id}`)}
                className="h-10 px-4 rounded-full border border-[#dbe6ff] bg-white text-[10px] font-semibold uppercase tracking-[0.14em] text-[#4e6c8e] hover:border-[#b3caff] hover:text-[#071426] flex items-center gap-1.5 transition-all"
              >
                <Eye size={11} /> Ver
              </Link>
              <button
                onClick={() => onAddToCart(product)}
                style={{ backgroundColor: style.accent }}
                className="h-10 px-5 rounded-full text-white text-[10px] font-semibold uppercase tracking-[0.14em] flex items-center gap-1.5 active:scale-95 transition-all shadow-[0_10px_22px_rgba(37,99,235,0.24)] hover:shadow-[0_14px_28px_rgba(37,99,235,0.34)]"
              >
                <Plus size={11} strokeWidth={2.5} /> Adicionar
              </button>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
