import React from "react";
import { Link, useParams } from "react-router-dom";
import { motion } from "motion/react";
import StoreSEO from "../../../../components/store/StoreSEO";
import {
  ArrowRight, Package, ShoppingBag, Star,
  Zap, TrendingUp, ChevronRight, Tag,
} from "lucide-react";
import { cn } from "../../../../lib/utils";
import { useStore, StoreStyle } from "../../StoreLayout";
import { Product } from "../../../../types";
import { buildStorePath, resolveStoreSlug } from "../../store-routing";

function SectionHeader({ title, icon, link, linkLabel, accent, isDark }: {
  title: string; icon?: React.ReactNode; link: string; linkLabel?: string; accent: string; isDark: boolean;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-8">
      <div className="flex items-center gap-3">
        <div className="w-1 h-6 rounded-full" style={{ backgroundColor: accent }} />
        {icon && <span style={{ color: accent }}>{icon}</span>}
        <h2 className={cn("text-2xl font-bold tracking-tight", isDark ? "text-white" : "text-slate-900")}>{title}</h2>
      </div>
      <Link
        to={link}
        className={cn(
          "flex items-center gap-1 transition-colors text-[11px] font-semibold uppercase tracking-wider",
          isDark ? "text-slate-400 hover:text-white" : "text-slate-400 hover:text-slate-700"
        )}
      >
        {linkLabel || "Ver todos"} <ChevronRight size={13} />
      </Link>
    </div>
  );
}

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
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.04 }}>
      <Link
        to={buildStorePath(slug, `/produto/${product.id}`)}
        className={cn(
          "group flex flex-col border overflow-hidden transition-all hover:shadow-xl",
          style.card,
          style.radius
        )}
      >
        <div className="overflow-hidden relative aspect-square bg-slate-50">
          {img
            ? <img src={img} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
            : <div className="w-full h-full flex items-center justify-center text-slate-200"><Package size={36} strokeWidth={1} /></div>}
          {hasDiscount && (
            <span className="absolute top-2 right-2 text-white text-[9px] font-bold px-2 py-0.5 shadow rounded-full bg-red-500">
              -{pct}%
            </span>
          )}
          {product.is_featured && (
            <span
              className="absolute top-2 left-2 text-[8px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
              style={{ backgroundColor: style.accent + "20", color: style.accent, border: `1px solid ${style.accent}40` }}
            >
              <Star size={7} className="inline -mt-0.5 mr-0.5" fill="currentColor" />Top
            </span>
          )}
        </div>
        <div className="flex flex-col p-4 gap-1">
          <p className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold">{product.category_name || "Geral"}</p>
          <p className="text-sm font-semibold text-slate-800 leading-snug line-clamp-2 transition-colors group-hover:text-slate-900">{product.name}</p>
          <div className="flex items-center justify-between mt-2">
            {hasDiscount ? (
              <div>
                <span className="text-[10px] line-through text-slate-400 font-mono">R$ {Number(product.price).toFixed(2)}</span>
                <p className="text-base font-bold text-emerald-600 font-mono leading-tight">R$ {Number(product.discount_price).toFixed(2)}</p>
              </div>
            ) : (
              <p className="text-base font-bold font-mono" style={{ color: style.accent }}>R$ {Number(product.price).toFixed(2)}</p>
            )}
            <button
              onClick={e => { e.preventDefault(); onAddToCart(product); }}
              style={{ backgroundColor: style.accent }}
              className={cn(
                "shrink-0 text-white transition-all active:scale-90 w-9 h-9 flex items-center justify-center shadow-sm hover:shadow-md",
                style.radius
              )}
            >
              <span className="text-lg font-bold leading-none">+</span>
            </button>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

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

  const isTech = tenant.template_id === "tech";
  const isDark = ["cyber", "luxury"].includes(tenant.template_id || "");

  const getImg = (p: Product | undefined) =>
    p ? ((Array.isArray(p.images) && (p.images as string[])[0]) || p.image_url || null) : null;

  return (
    <div className="space-y-0">
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
          <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-transparent flex items-center">
            <div className="max-w-7xl mx-auto px-8 w-full">
              <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.55 }}>
                <p className="text-[11px] font-semibold uppercase tracking-[0.35em] mb-3" style={{ color: style.accent }}>
                  Bem-vindo à
                </p>
                <h1 className="text-4xl md:text-6xl lg:text-7xl font-extrabold text-white leading-[0.95] tracking-tight">
                  {tenant.name}
                </h1>
                {tenant.about_text && (
                  <p className="text-white/65 mt-4 max-w-md text-sm leading-relaxed font-light">{tenant.about_text}</p>
                )}
                <div className="flex flex-wrap gap-3 mt-8">
                  <Link
                    to={storePath("/catalogo")}
                    style={{ backgroundColor: style.accent }}
                    className={cn("flex items-center gap-2 px-7 h-12 text-white text-[11px] font-bold uppercase tracking-widest shadow-xl hover:opacity-90 transition-all active:scale-95", style.radius)}
                  >
                    <ShoppingBag size={15} /> Ver Catálogo
                  </Link>
                  {categories.length > 0 && (
                    <a href="#categorias" className={cn("flex items-center gap-2 px-7 h-12 border border-white/25 bg-white/10 backdrop-blur-sm text-white text-[11px] font-bold uppercase tracking-widest hover:bg-white/20 transition-all", style.radius)}>
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
            background: isTech
              ? `linear-gradient(135deg, #e8f4fd 0%, #f4f6fb 60%, #edf3fb 100%)`
              : `linear-gradient(135deg, ${style.accent}18, ${style.accent}06)`,
            minHeight: "52vh",
          }}
        >
          {isTech && (
            <div
              className="absolute top-0 right-0 w-[55%] h-full opacity-[0.06] pointer-events-none"
              style={{
                backgroundImage: `linear-gradient(${style.accent} 1px, transparent 1px), linear-gradient(90deg, ${style.accent} 1px, transparent 1px)`,
                backgroundSize: "48px 48px",
              }}
            />
          )}
          <div className="relative max-w-7xl mx-auto px-8 py-24 md:py-32">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
              <div className="flex items-center gap-2 mb-5">
                <div className="w-8 h-px" style={{ backgroundColor: style.accent }} />
                <p className="text-[11px] font-semibold uppercase tracking-[0.35em]" style={{ color: style.accent }}>
                  {isTech ? "Tecnologia & Inovação" : "Bem-vindo à loja"}
                </p>
              </div>
              <h1 className="text-5xl md:text-7xl font-extrabold text-slate-900 leading-[0.92] tracking-tight">
                {tenant.name}
              </h1>
              <p className="text-slate-500 mt-5 max-w-lg text-base font-normal leading-relaxed">
                {tenant.about_text || "Os melhores produtos com qualidade e atendimento de excelência."}
              </p>
              <div className="flex flex-wrap gap-3 mt-10">
                <Link
                  to={storePath("/catalogo")}
                  style={{ backgroundColor: style.accent }}
                  className={cn("inline-flex items-center gap-2 px-8 h-12 text-white text-[11px] font-bold uppercase tracking-widest shadow-lg hover:opacity-90 transition-all active:scale-95", style.radius)}
                >
                  <ShoppingBag size={15} /> Explorar Catálogo <ArrowRight size={13} />
                </Link>
                {onSale.length > 0 && (
                  <Link
                    to={storePath("/catalogo")}
                    className={cn("inline-flex items-center gap-2 px-8 h-12 border border-slate-300 bg-white text-slate-700 text-[11px] font-bold uppercase tracking-widest hover:border-slate-400 hover:shadow transition-all", style.radius)}
                  >
                    <Zap size={13} style={{ color: style.accent }} />
                    {onSale.length} {onSale.length === 1 ? "Promoção" : "Promoções"}
                  </Link>
                )}
              </div>
            </motion.div>
          </div>
        </div>
      )}

      {/* ── STATS BAR ─────────────────────────────────────────── */}
      <div className={cn("border-b", isDark ? "bg-slate-950 border-slate-800" : "bg-white border-slate-100")}>
        <div className="max-w-7xl mx-auto px-8 py-4 flex flex-wrap items-center gap-8 md:gap-14">
          {[
            { value: allActive.length, label: "Produtos" },
            { value: categories.length, label: "Categorias" },
            { value: featured.length, label: "Destaques" },
            { value: onSale.length, label: "Promoções" },
          ].map((s, i) => (
            <div key={i} className="flex items-baseline gap-2">
              <span className="text-2xl font-extrabold tabular-nums" style={{ color: style.accent }}>{s.value}</span>
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── CATEGORIES ────────────────────────────────────────── */}
      {categories.length > 0 && (
        <section id="categorias" className="max-w-7xl mx-auto px-4 md:px-8 py-16">
          <SectionHeader
            title="Categorias"
            icon={<Tag size={17} />}
            link={storePath("/catalogo")}
            linkLabel="Ver catálogo"
            accent={style.accent}
            isDark={isDark}
          />
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {categories.slice(0, CATEGORY_DISPLAY_LIMIT).map((cat, i) => {
              const count = allActive.filter(p => p.category_id === cat.id).length;
              return (
                <motion.div key={cat.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                  <Link
                    to={storePath(`/catalogo?cat=${cat.id}`)}
                    className={cn(
                      "group flex flex-col items-center text-center gap-2 p-4 border hover:shadow-md",
                      style.card,
                      style.radius
                    )}
                  >
                    <div style={{ backgroundColor: style.accent + "18" }} className={cn("w-11 h-11 flex items-center justify-center group-hover:scale-110 transition-transform duration-300", style.radius)}>
                      <Tag size={18} style={{ color: style.accent }} />
                    </div>
                    <p className="text-[11px] font-semibold text-slate-700 leading-tight tracking-tight">{cat.name}</p>
                    <span className="text-[9px] text-slate-400 font-medium">{count} {count === 1 ? "produto" : "produtos"}</span>
                  </Link>
                </motion.div>
              );
            })}
          </div>
          {categories.length > CATEGORY_DISPLAY_LIMIT && (
            <div className="mt-5 text-center">
              <Link
                to={storePath("/catalogo")}
                className={cn(
                  "inline-flex items-center gap-2 px-6 h-10 border border-slate-200 bg-white text-slate-600 text-[11px] font-semibold uppercase tracking-wider hover:border-slate-300 hover:shadow-sm transition-all",
                  style.radius
                )}
              >
                +{categories.length - CATEGORY_DISPLAY_LIMIT} mais categorias <ChevronRight size={13} />
              </Link>
            </div>
          )}
        </section>
      )}

      {/* ── FEATURED ──────────────────────────────────────────── */}
      {featured.length > 0 && (
        <section className={cn("py-16", isDark ? "bg-slate-950" : "bg-slate-900")}>
          <div className="max-w-7xl mx-auto px-8">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="w-1 h-6 rounded-full" style={{ backgroundColor: style.accent }} />
                <h2 className="text-2xl font-bold tracking-tight text-white">Destaques</h2>
                <span
                  className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: style.accent + "25", color: style.accent, border: `1px solid ${style.accent}40` }}
                >
                  {featured.length}
                </span>
              </div>
              <Link to={storePath("/catalogo")} className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500 hover:text-white transition-colors">
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
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.07 }}
                    className={cn("group bg-white/5 border border-white/10 overflow-hidden hover:bg-white/[0.08] hover:border-white/20 transition-all", style.radius)}
                  >
                    <Link to={storePath(`/produto/${product.id}`)} className="block relative overflow-hidden" style={{ aspectRatio: "16/10" }}>
                      {img
                        ? <img src={img} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                        : <div className="w-full h-full flex items-center justify-center" style={{ color: style.accent + "25" }}>
                            <Package size={36} strokeWidth={1} />
                          </div>}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                      {hasDiscount && (
                        <span className="absolute top-3 right-3 bg-red-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-full">-{pct}%</span>
                      )}
                      <span
                        className="absolute top-3 left-3 flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest px-2 py-1 rounded-full"
                        style={{ backgroundColor: style.accent + "30", color: style.accent, border: `1px solid ${style.accent}50` }}
                      >
                        <Star size={8} fill="currentColor" /> Destaque
                      </span>
                    </Link>
                    <div className="p-4 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold text-white/90 line-clamp-1 tracking-tight">{product.name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <p className="text-sm font-bold font-mono" style={{ color: style.accent }}>
                            R$ {Number(product.discount_price || product.price).toFixed(2)}
                          </p>
                          {hasDiscount && (
                            <span className="text-[9px] text-white/30 line-through font-mono">R$ {Number(product.price).toFixed(2)}</span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => addToCart(product)}
                        style={{ backgroundColor: style.accent }}
                        className={cn("w-9 h-9 flex items-center justify-center shrink-0 text-white shadow-lg active:scale-90 transition-all", style.radius)}
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
      <section className={cn("py-16", isDark ? "bg-[#080a0e]" : "bg-white")}>
        <div className="max-w-7xl mx-auto px-4 md:px-8">
          <SectionHeader
            title="Mais Vendidos"
            icon={<TrendingUp size={17} />}
            link={storePath("/catalogo")}
            linkLabel="Ver catálogo"
            accent={style.accent}
            isDark={isDark}
          />
          {bestSellers.length === 0 ? (
            <div className="py-16 text-center text-slate-400">
              <Package size={40} strokeWidth={1} className="mx-auto mb-4 opacity-30" />
              <p className="text-xs font-semibold uppercase tracking-wider">Nenhum produto disponível</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {bestSellers.map((product, i) => <ProductCard key={product.id} product={product} index={i} slug={slug} style={style} onAddToCart={addToCart} />)}
            </div>
          )}
        </div>
      </section>

      {/* ── ON SALE ───────────────────────────────────────────── */}
      {onSale.length > 0 && (
        <section className={cn("py-16", isDark ? "bg-slate-950" : "bg-slate-50")}>
          <div className="max-w-7xl mx-auto px-4 md:px-8">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="w-1 h-6 rounded-full bg-red-500" />
                <Zap size={16} className="text-red-500" />
                <h2 className={cn("text-2xl font-bold tracking-tight", isDark ? "text-white" : "text-slate-900")}>Promoções</h2>
                <span className="text-[9px] font-bold px-2 py-0.5 rounded-full border bg-red-50 text-red-500 border-red-200">
                  {onSale.length} oferta{onSale.length !== 1 ? "s" : ""}
                </span>
              </div>
              <Link
                to={storePath("/catalogo")}
                className={cn(
                  "flex items-center gap-1 transition-colors text-[11px] font-semibold uppercase tracking-wider",
                  isDark ? "text-slate-500 hover:text-white" : "text-slate-400 hover:text-slate-700"
                )}
              >
                Ver todas <ChevronRight size={13} />
              </Link>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {onSale.slice(0, 4).map((product, i) => {
                const pct = Math.round((1 - Number(product.discount_price) / Number(product.price)) * 100);
                const img = getImg(product);
                return (
                  <motion.div key={product.id} initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.05 }}>
                    <Link
                      to={storePath(`/produto/${product.id}`)}
                      className={cn(
                        "group flex flex-col border transition-all overflow-hidden hover:shadow-xl",
                        style.card,
                        style.radius
                      )}
                    >
                      <div className="aspect-square bg-slate-50 overflow-hidden relative">
                        {img
                          ? <img src={img} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                          : <div className="w-full h-full flex items-center justify-center text-slate-200"><Package size={36} strokeWidth={1} /></div>}
                        <span className="absolute top-2 right-2 bg-red-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-full shadow">-{pct}%</span>
                      </div>
                      <div className="p-4">
                        <p className="text-sm font-medium text-slate-800 line-clamp-2 leading-snug">{product.name}</p>
                        <div className="flex items-center gap-2 mt-3">
                          <span className="text-base font-bold text-emerald-600 font-mono">R$ {Number(product.discount_price).toFixed(2)}</span>
                          <span className="text-[10px] text-slate-400 line-through font-mono">R$ {Number(product.price).toFixed(2)}</span>
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
