import React from "react";
import { Link, useParams } from "react-router-dom";
import { motion } from "motion/react";
import StoreSEO from "../../../../components/store/StoreSEO";
import {
  ArrowRight, Package, ShoppingBag, Star,
  Zap, TrendingUp, ChevronRight, Tag, Leaf, Sun, Heart,
} from "lucide-react";
import { cn } from "../../../../lib/utils";
import { useStore, StoreStyle } from "../../StoreLayout";
import { Product } from "../../../../types";
import { buildStorePath, resolveStoreSlug } from "../../store-routing";

// ── Decorative helpers ────────────────────────────────────────────────────────

function DotTexture({ className }: { className?: string }) {
  return (
    <div
      className={cn("absolute inset-0 pointer-events-none", className)}
      style={{
        backgroundImage: "radial-gradient(circle, #d9770618 1px, transparent 1px)",
        backgroundSize: "24px 24px",
      }}
    />
  );
}

function BlobDecor() {
  return (
    <>
      <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full bg-amber-100/40 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-10 -left-10 w-48 h-48 rounded-full bg-orange-100/30 blur-3xl pointer-events-none" />
    </>
  );
}

function LeafSVG({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 60 60" className={cn("w-12 h-12 text-amber-300/60", className)} fill="currentColor">
      <path d="M30 5 C10 15 5 35 30 55 C55 35 50 15 30 5Z" />
    </svg>
  );
}

// ── Section Header ────────────────────────────────────────────────────────────

function SectionHeader({ title, icon, link, linkLabel, accent }: {
  title: string; icon?: React.ReactNode; link: string; linkLabel?: string; accent: string;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-8">
      <div className="flex items-center gap-3">
        <div className="w-1 h-7 rounded-full" style={{ backgroundColor: accent }} />
        {icon && <span style={{ color: accent }}>{icon}</span>}
        <h2 className="text-2xl font-serif font-bold tracking-tight text-stone-800">{title}</h2>
      </div>
      <Link
        to={link}
        className="flex items-center gap-1 transition-colors text-[11px] font-semibold uppercase tracking-wider text-amber-600 hover:text-amber-800"
      >
        {linkLabel || "Ver todos"} <ChevronRight size={13} />
      </Link>
    </div>
  );
}

// ── Product Card ──────────────────────────────────────────────────────────────

function ProductCard({ product, index, slug, style, onAddToCart }: {
  product: Product;
  index: number;
  slug: string;
  style: StoreStyle;
  onAddToCart: (product: Product) => void;
  key?: React.Key;
}) {
  const img = (Array.isArray(product.images) && (product.images as string[])[0]) || product.image_url || null;
  const hasDiscount = !!product.discount_price;
  const pct = hasDiscount ? Math.round((1 - Number(product.discount_price) / Number(product.price)) * 100) : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.4 }}
      whileHover={{ y: -4 }}
    >
      <Link
        to={buildStorePath(slug, `/produto/${product.id}`)}
        className={cn(
          "group flex flex-col border overflow-hidden transition-all duration-300 rounded-2xl",
          "bg-[#fffbf5] border-[#f0e6d3]",
          "hover:shadow-[0_8px_32px_rgba(217,119,6,0.15)] hover:border-amber-200"
        )}
      >
        <div className="overflow-hidden relative aspect-square bg-amber-50/60">
          {img
            ? <img src={img} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
            : <div className="w-full h-full flex items-center justify-center text-amber-200"><Package size={36} strokeWidth={1} /></div>}
          {hasDiscount && (
            <span className="absolute top-2 right-2 text-white text-[9px] font-bold px-2 py-0.5 shadow rounded-full bg-terracotta-500"
              style={{ backgroundColor: "#c2713a" }}>
              -{pct}%
            </span>
          )}
          {product.is_featured && (
            <span
              className="absolute top-2 left-2 text-[8px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
              style={{ backgroundColor: "#d9770620", color: "#d97706", border: "1px solid #d9770640" }}
            >
              <Star size={7} className="inline -mt-0.5 mr-0.5" fill="currentColor" />Top
            </span>
          )}
        </div>
        <div className="flex flex-col p-4 gap-1">
          <p className="text-[10px] text-amber-600/70 uppercase tracking-widest font-semibold">{product.category_name || "Geral"}</p>
          <p className="text-sm font-semibold text-stone-700 leading-snug line-clamp-2 group-hover:text-stone-900 transition-colors">{product.name}</p>
          <div className="flex items-center justify-between mt-2">
            {hasDiscount ? (
              <div>
                <span className="text-[10px] line-through text-stone-400 font-mono">R$ {Number(product.price).toFixed(2)}</span>
                <p className="text-base font-bold font-mono leading-tight" style={{ color: "#c2713a" }}>R$ {Number(product.discount_price).toFixed(2)}</p>
              </div>
            ) : (
              <p className="text-base font-bold font-mono" style={{ color: style.accent }}>R$ {Number(product.price).toFixed(2)}</p>
            )}
            <button
              onClick={e => { e.preventDefault(); onAddToCart(product); }}
              style={{ backgroundColor: style.accent }}
              className="shrink-0 text-white transition-all active:scale-90 w-9 h-9 flex items-center justify-center shadow-sm hover:shadow-[0_4px_12px_rgba(217,119,6,0.35)] rounded-xl"
            >
              <span className="text-lg font-bold leading-none">+</span>
            </button>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function StoreFront() {
  const { slug: routeSlug } = useParams();
  const { tenant, categories, products, addToCart, style } = useStore();
  const slug = resolveStoreSlug(routeSlug);
  const storePath = (suffix = "") => buildStorePath(slug, suffix);

  const featuredLimit = tenant.featured_limit ?? 4;
  const bestsellerLimit = tenant.bestseller_limit ?? 8;
  const CATEGORY_DISPLAY_LIMIT = 6;

  const allActive = products.filter(p => p.is_active);
  const featured = allActive.filter(p => p.is_featured).slice(0, featuredLimit);
  const onSale = allActive.filter(p => p.discount_price);

  const bestSellers = [
    ...allActive.filter(p => p.is_featured),
    ...allActive.filter(p => !p.is_featured).sort((a, b) => b.stock_quantity - a.stock_quantity),
  ]
    .filter((p, i, arr) => arr.findIndex(x => x.id === p.id) === i)
    .slice(0, bestsellerLimit);

  const getImg = (p: Product | undefined) =>
    p ? ((Array.isArray(p.images) && (p.images as string[])[0]) || p.image_url || null) : null;

  return (
    <div className="space-y-0 bg-[#fefaf6]">
      <StoreSEO
        title={`${tenant.name} — Loja Online`}
        description={tenant.about_text || `Bem-vindo à ${tenant.name}. Confira nossos produtos, promoções e novidades. Atendimento via WhatsApp.`}
        image={tenant.banner_url || tenant.logo_url}
        url={typeof window !== "undefined" ? window.location.href : ""}
        siteName={tenant.name}
        keywords={`${tenant.name}, loja online, ${categories.map(c => c.name).join(", ")}, comprar, promoções`}
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "Store",
          "name": tenant.name,
          "description": tenant.about_text || `Loja online ${tenant.name}`,
          "url": typeof window !== "undefined" ? window.location.href : "",
          "image": tenant.logo_url || tenant.banner_url || "",
          "telephone": tenant.whatsapp ? `+${tenant.whatsapp.replace(/\D/g, "")}` : undefined,
          "address": tenant.address ? { "@type": "PostalAddress", "streetAddress": tenant.address } : undefined,
          "priceRange": "$$",
          "openingHours": "Mo-Su 00:00-23:59",
          "sameAs": [
            tenant.instagram_url ? `https://instagram.com/${tenant.instagram_url.replace("@", "")}` : undefined,
            tenant.facebook_url ? `https://facebook.com/${tenant.facebook_url}` : undefined,
          ].filter(Boolean),
        }}
      />

      {/* ── HERO ──────────────────────────────────────────────── */}
      {tenant.banner_url ? (
        <div className="relative h-[50vh] md:h-[65vh] w-full overflow-hidden">
          <img src={tenant.banner_url} className="w-full h-full object-cover" alt="Banner" />
          <div className="absolute inset-0 bg-gradient-to-r from-stone-900/80 via-stone-900/50 to-transparent flex items-center">
            <div className="max-w-7xl mx-auto px-8 w-full">
              <motion.div
                initial={{ opacity: 0, x: -24 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6 }}
              >
                <p className="text-[11px] font-semibold uppercase tracking-[0.35em] mb-3 text-amber-300">
                  Bem-vindo à
                </p>
                <h1 className="text-4xl md:text-6xl lg:text-7xl font-serif font-bold text-white leading-[0.95] tracking-tight">
                  {tenant.name}
                </h1>
                {tenant.about_text && (
                  <p className="text-white/70 mt-4 max-w-md text-sm leading-relaxed font-light">{tenant.about_text}</p>
                )}
                <div className="flex flex-wrap gap-3 mt-8">
                  <Link
                    to={storePath("/catalogo")}
                    style={{ backgroundColor: style.accent }}
                    className="flex items-center gap-2 px-7 h-12 text-white text-[11px] font-bold uppercase tracking-widest shadow-[0_4px_20px_rgba(217,119,6,0.4)] hover:shadow-[0_6px_28px_rgba(217,119,6,0.55)] hover:opacity-90 transition-all active:scale-95 rounded-2xl"
                  >
                    <ShoppingBag size={15} /> Ver Catálogo
                  </Link>
                  {categories.length > 0 && (
                    <a href="#categorias" className="flex items-center gap-2 px-7 h-12 border border-white/30 bg-white/10 backdrop-blur-sm text-white text-[11px] font-bold uppercase tracking-widest hover:bg-white/20 transition-all rounded-2xl">
                      Categorias <ArrowRight size={13} />
                    </a>
                  )}
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      ) : (
        <div
          className="relative overflow-hidden"
          style={{
            background: "linear-gradient(135deg, #fefaf6 0%, #fdf7ef 60%, #fef9f0 100%)",
            minHeight: "56vh",
          }}
        >
          <DotTexture />
          <BlobDecor />

          <div className="relative max-w-7xl mx-auto px-8 py-24 md:py-36">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <div className="flex items-center gap-3 mb-5">
                <LeafSVG />
                <div className="h-px w-12 bg-amber-300/60" />
                <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-amber-600">
                  Bem-vindo à nossa loja
                </p>
              </div>

              <h1 className="text-5xl md:text-7xl font-serif font-bold text-stone-800 leading-[0.92] tracking-tight max-w-2xl">
                {tenant.name}
              </h1>

              <p className="text-stone-500 mt-6 max-w-lg text-base font-normal leading-relaxed">
                {tenant.about_text || "Produtos naturais e artesanais selecionados com cuidado para você."}
              </p>

              <div className="flex flex-wrap gap-3 mt-10">
                <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                  <Link
                    to={storePath("/catalogo")}
                    style={{ backgroundColor: style.accent }}
                    className="inline-flex items-center gap-2 px-8 h-13 py-3 text-white text-[11px] font-bold uppercase tracking-widest shadow-[0_4px_20px_rgba(217,119,6,0.35)] hover:shadow-[0_6px_28px_rgba(217,119,6,0.5)] transition-all rounded-2xl"
                  >
                    <ShoppingBag size={15} /> Explorar Catálogo <ArrowRight size={13} />
                  </Link>
                </motion.div>
                {onSale.length > 0 && (
                  <Link
                    to={storePath("/catalogo")}
                    className="inline-flex items-center gap-2 px-8 py-3 h-13 border border-amber-200 bg-white/80 text-stone-700 text-[11px] font-bold uppercase tracking-widest hover:border-amber-300 hover:bg-white hover:shadow transition-all rounded-2xl"
                  >
                    <Zap size={13} style={{ color: style.accent }} />
                    {onSale.length} {onSale.length === 1 ? "Promoção" : "Promoções"}
                  </Link>
                )}
              </div>

              {/* Category pills */}
              {categories.length > 0 && (
                <motion.div
                  className="flex flex-wrap gap-2 mt-10"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.35, duration: 0.5 }}
                >
                  {categories.slice(0, 5).map((cat, i) => (
                    <motion.div
                      key={cat.id}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.4 + i * 0.06 }}
                    >
                      <Link
                        to={storePath(`/catalogo?cat=${cat.id}`)}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-full text-[11px] font-semibold bg-white/70 border border-amber-200/70 text-stone-600 hover:bg-amber-50 hover:border-amber-300 hover:text-amber-700 transition-all backdrop-blur-sm shadow-sm"
                      >
                        🌿 {cat.name}
                      </Link>
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </motion.div>
          </div>
        </div>
      )}

      {/* ── STATS BAR ─────────────────────────────────────────── */}
      <div className="bg-[#fdf7ef] border-y border-amber-100/80">
        <div className="max-w-7xl mx-auto px-8 py-5 flex flex-wrap items-center gap-8 md:gap-14">
          {[
            { value: allActive.length, label: "Produtos", icon: <Leaf size={14} /> },
            { value: categories.length, label: "Categorias", icon: <Sun size={14} /> },
            { value: featured.length, label: "Destaques", icon: <Star size={14} /> },
            { value: onSale.length, label: "Promoções", icon: <Heart size={14} /> },
          ].map((s, i) => (
            <motion.div
              key={i}
              className="flex items-center gap-2.5"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
            >
              <span style={{ color: style.accent }} className="opacity-60">{s.icon}</span>
              <span className="text-2xl font-bold tabular-nums font-serif" style={{ color: style.accent }}>{s.value}</span>
              <span className="text-[10px] font-semibold text-stone-400 uppercase tracking-widest">{s.label}</span>
            </motion.div>
          ))}
        </div>
      </div>

      {/* ── CATEGORIES ────────────────────────────────────────── */}
      {categories.length > 0 && (
        <section id="categorias" className="max-w-7xl mx-auto px-4 md:px-8 py-16">
          <SectionHeader
            title="Categorias"
            icon={<Leaf size={17} />}
            link={storePath("/catalogo")}
            linkLabel="Ver catálogo"
            accent={style.accent}
          />
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {categories.slice(0, CATEGORY_DISPLAY_LIMIT).map((cat, i) => {
              const count = allActive.filter(p => p.category_id === cat.id).length;
              return (
                <motion.div
                  key={cat.id}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.06 }}
                  whileHover={{ y: -3 }}
                >
                  <Link
                    to={storePath(`/catalogo?cat=${cat.id}`)}
                    className="group flex flex-col items-center text-center gap-2 p-4 border rounded-2xl bg-[#fffbf5] border-[#f0e6d3] hover:border-amber-300 hover:shadow-[0_6px_20px_rgba(217,119,6,0.12)] transition-all"
                  >
                    <div
                      style={{ backgroundColor: style.accent + "18" }}
                      className="w-11 h-11 flex items-center justify-center group-hover:scale-110 transition-transform duration-300 rounded-xl"
                    >
                      <Leaf size={18} style={{ color: style.accent }} />
                    </div>
                    <p className="text-[11px] font-semibold text-stone-700 leading-tight tracking-tight">{cat.name}</p>
                    <span className="text-[9px] text-stone-400 font-medium">{count} {count === 1 ? "produto" : "produtos"}</span>
                  </Link>
                </motion.div>
              );
            })}
          </div>
          {categories.length > CATEGORY_DISPLAY_LIMIT && (
            <div className="mt-6 text-center">
              <Link
                to={storePath("/catalogo")}
                className="inline-flex items-center gap-2 px-6 h-10 border border-amber-200 bg-white text-stone-600 text-[11px] font-semibold uppercase tracking-wider hover:border-amber-300 hover:shadow-sm transition-all rounded-xl"
              >
                +{categories.length - CATEGORY_DISPLAY_LIMIT} mais categorias <ChevronRight size={13} />
              </Link>
            </div>
          )}
        </section>
      )}

      {/* ── FEATURED ──────────────────────────────────────────── */}
      {featured.length > 0 && (
        <section className="py-16 bg-[#fdf7ef] relative overflow-hidden">
          <DotTexture className="opacity-50" />
          <div className="relative max-w-7xl mx-auto px-8">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="w-1 h-7 rounded-full" style={{ backgroundColor: style.accent }} />
                <Star size={17} style={{ color: style.accent }} />
                <h2 className="text-2xl font-serif font-bold tracking-tight text-stone-800">Destaques</h2>
                <span
                  className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: style.accent + "22", color: style.accent, border: `1px solid ${style.accent}40` }}
                >
                  {featured.length}
                </span>
              </div>
              <Link
                to={storePath("/catalogo")}
                className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-amber-600 hover:text-amber-800 transition-colors"
              >
                Ver catálogo <ChevronRight size={13} />
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {featured.map((product, i) => {
                const img = getImg(product);
                const hasDiscount = !!product.discount_price;
                const pct = hasDiscount ? Math.round((1 - Number(product.discount_price) / Number(product.price)) * 100) : 0;

                return (
                  <motion.div
                    key={product.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.08 }}
                    whileHover={{ y: -5 }}
                    className="group bg-[#fffbf5] border border-[#f0e6d3] overflow-hidden hover:border-amber-200 hover:shadow-[0_10px_36px_rgba(217,119,6,0.14)] transition-all duration-300 rounded-2xl"
                  >
                    <Link to={storePath(`/produto/${product.id}`)} className="block relative overflow-hidden" style={{ aspectRatio: "16/10" }}>
                      {img
                        ? <img src={img} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                        : <div className="w-full h-full flex items-center justify-center bg-amber-50/80 text-amber-200">
                            <Package size={36} strokeWidth={1} />
                          </div>}
                      <div className="absolute inset-0 bg-gradient-to-t from-stone-900/40 to-transparent" />
                      {hasDiscount && (
                        <span className="absolute top-3 right-3 text-white text-[9px] font-bold px-2 py-0.5 rounded-full shadow"
                          style={{ backgroundColor: "#c2713a" }}>-{pct}%</span>
                      )}
                      <span
                        className="absolute top-3 left-3 flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest px-2 py-1 rounded-full"
                        style={{ backgroundColor: style.accent + "28", color: style.accent, border: `1px solid ${style.accent}50` }}
                      >
                        <Star size={8} fill="currentColor" /> Destaque
                      </span>
                    </Link>
                    <div className="p-4 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold text-stone-800 line-clamp-1 tracking-tight">{product.name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <p className="text-sm font-bold font-mono" style={{ color: style.accent }}>
                            R$ {Number(product.discount_price || product.price).toFixed(2)}
                          </p>
                          {hasDiscount && (
                            <span className="text-[9px] text-stone-400 line-through font-mono">R$ {Number(product.price).toFixed(2)}</span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => addToCart(product)}
                        style={{ backgroundColor: style.accent }}
                        className="w-9 h-9 flex items-center justify-center shrink-0 text-white shadow-[0_3px_12px_rgba(217,119,6,0.3)] active:scale-90 transition-all rounded-xl hover:shadow-[0_5px_18px_rgba(217,119,6,0.45)]"
                      >
                        <ShoppingBag size={14} />
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ── BEST SELLERS ──────────────────────────────────────── */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 md:px-8">
          <SectionHeader
            title="Mais Vendidos"
            icon={<TrendingUp size={17} />}
            link={storePath("/catalogo")}
            linkLabel="Ver catálogo"
            accent={style.accent}
          />
          {bestSellers.length === 0 ? (
            <div className="py-16 text-center text-stone-400">
              <Package size={40} strokeWidth={1} className="mx-auto mb-4 opacity-30" />
              <p className="text-xs font-semibold uppercase tracking-wider">Nenhum produto disponível</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {bestSellers.map((product, i) => (
                <ProductCard key={product.id} product={product} index={i} slug={slug} style={style} onAddToCart={addToCart} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── ON SALE ───────────────────────────────────────────── */}
      {onSale.length > 0 && (
        <section className="py-16 bg-[#fdf7ef] relative overflow-hidden">
          <BlobDecor />
          <div className="relative max-w-7xl mx-auto px-4 md:px-8">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="w-1 h-7 rounded-full" style={{ backgroundColor: "#c2713a" }} />
                <Zap size={16} style={{ color: "#c2713a" }} />
                <h2 className="text-2xl font-serif font-bold tracking-tight text-stone-800">Promoções</h2>
                <span className="text-[9px] font-bold px-2 py-0.5 rounded-full border"
                  style={{ backgroundColor: "#c2713a18", color: "#c2713a", borderColor: "#c2713a40" }}>
                  {onSale.length} oferta{onSale.length !== 1 ? "s" : ""}
                </span>
              </div>
              <Link
                to={storePath("/catalogo")}
                className="flex items-center gap-1 transition-colors text-[11px] font-semibold uppercase tracking-wider text-amber-600 hover:text-amber-800"
              >
                Ver todas <ChevronRight size={13} />
              </Link>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {onSale.slice(0, 4).map((product, i) => {
                const pct = Math.round((1 - Number(product.discount_price) / Number(product.price)) * 100);
                const img = getImg(product);
                return (
                  <motion.div
                    key={product.id}
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.06 }}
                    whileHover={{ y: -4 }}
                  >
                    <Link
                      to={storePath(`/produto/${product.id}`)}
                      className="group flex flex-col border transition-all overflow-hidden hover:shadow-[0_8px_32px_rgba(194,113,58,0.18)] rounded-2xl bg-[#fffbf5] border-[#f0e6d3] hover:border-amber-200"
                    >
                      <div className="aspect-square bg-amber-50/60 overflow-hidden relative">
                        {img
                          ? <img src={img} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                          : <div className="w-full h-full flex items-center justify-center text-amber-200"><Package size={36} strokeWidth={1} /></div>}
                        <span className="absolute top-2 right-2 text-white text-[9px] font-bold px-2 py-0.5 rounded-full shadow"
                          style={{ backgroundColor: "#c2713a" }}>-{pct}%</span>
                      </div>
                      <div className="p-4">
                        <p className="text-sm font-medium text-stone-700 line-clamp-2 leading-snug">{product.name}</p>
                        <div className="flex items-center gap-2 mt-3">
                          <span className="text-base font-bold font-mono" style={{ color: "#c2713a" }}>R$ {Number(product.discount_price).toFixed(2)}</span>
                          <span className="text-[10px] text-stone-400 line-through font-mono">R$ {Number(product.price).toFixed(2)}</span>
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
