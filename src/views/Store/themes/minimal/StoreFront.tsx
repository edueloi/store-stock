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
import { buildStorePath, resolveStoreSlug, productRouteSegment } from "../../store-routing";
import { productHasStock } from "../../../../utils/productStock";

// ── Section Header ────────────────────────────────────────────────────────────

function SectionHeader({ title, icon, link, linkLabel, accent }: {
  title: string; icon?: React.ReactNode; link: string; linkLabel?: string; accent: string;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-10">
      <div className="flex items-center gap-3">
        <div className="w-0.5 h-6 rounded-full" style={{ backgroundColor: accent }} />
        {icon && <span style={{ color: accent }}>{icon}</span>}
        <h2 className="text-2xl font-black tracking-tight text-[#0f172a]">{title}</h2>
      </div>
      <Link
        to={link}
        className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400 hover:text-[#2563eb] transition-colors"
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
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.4 }}
      whileHover={{ y: -2 }}
    >
      <Link
        to={buildStorePath(slug, `/produto/${productRouteSegment(product)}`)}
        className={cn(
          "group flex flex-col border overflow-hidden transition-all duration-300 rounded-2xl",
          "bg-white border-slate-100",
          "hover:shadow-md hover:border-slate-200"
        )}
      >
        <div className="overflow-hidden relative aspect-square bg-slate-50">
          {img
            ? <img src={img} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
            : <div className="w-full h-full flex items-center justify-center text-slate-200"><Package size={36} strokeWidth={1} /></div>}
          {hasDiscount && (
            <span className="absolute top-3 left-3 text-white text-[9px] font-bold px-2.5 py-1 rounded-full bg-red-500">
              -{pct}%
            </span>
          )}
          {product.is_featured && !hasDiscount && (
            <span
              className="absolute top-3 left-3 text-[9px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full text-white"
              style={{ backgroundColor: style.accent }}
            >
              <Star size={7} className="inline -mt-0.5 mr-0.5" fill="currentColor" />Destaque
            </span>
          )}
        </div>
        <div className="flex flex-col p-4 gap-1.5">
          <p className="text-[9px] text-slate-400 uppercase tracking-[0.12em] font-semibold">{product.category_name || "Geral"}</p>
          <p className="text-sm font-semibold text-[#0f172a] leading-snug line-clamp-2 group-hover:text-[#2563eb] transition-colors">{product.name}</p>
          <div className="flex items-center justify-between mt-2">
            {hasDiscount ? (
              <div>
                <span className="text-[10px] line-through text-slate-400 font-mono">R$ {Number(product.price).toFixed(2)}</span>
                <p className="text-base font-bold font-mono leading-tight text-red-500">R$ {Number(product.discount_price).toFixed(2)}</p>
              </div>
            ) : (
              <p className="text-base font-bold font-mono" style={{ color: style.accent }}>R$ {Number(product.price).toFixed(2)}</p>
            )}
            <button
              onClick={e => { e.preventDefault(); onAddToCart(product); }}
              style={{ backgroundColor: style.accent }}
              className="shrink-0 text-white transition-all active:scale-90 w-9 h-9 flex items-center justify-center shadow-sm rounded-xl hover:shadow-md"
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

  const allActive = products.filter(p => p.is_active && productHasStock(p));
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

  const heroProduct = featured[0] ?? allActive[0];
  const heroImg = getImg(heroProduct);

  return (
    <div className="space-y-0 bg-white">
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
      <div
        className="relative overflow-hidden bg-white"
        style={{
          background: "radial-gradient(circle at 70% 50%, #eff6ff 0%, transparent 60%), #ffffff",
          minHeight: "56vh",
        }}
      >
        <div className="max-w-7xl mx-auto px-6 md:px-8 py-20 md:py-32 grid md:grid-cols-2 gap-12 items-center">

          {/* Left: text */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <motion.p
              className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 mb-4"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              Bem-vindo à nossa loja
            </motion.p>

            <motion.h1
              className="text-5xl md:text-6xl lg:text-7xl font-black tracking-tight leading-[0.92] text-[#0f172a] mb-5"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, duration: 0.6 }}
            >
              {tenant.name}
            </motion.h1>

            {/* Accent separator */}
            <motion.div
              className="h-0.5 w-16 rounded-full mb-5"
              style={{ backgroundColor: style.accent, transformOrigin: "left" }}
              initial={{ opacity: 0, scaleX: 0 }}
              animate={{ opacity: 1, scaleX: 1 }}
              transition={{ delay: 0.3, duration: 0.4 }}
            />

            <motion.p
              className="text-slate-500 text-base leading-relaxed max-w-md mb-8"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35, duration: 0.5 }}
            >
              {tenant.about_text || "Produtos selecionados com cuidado para você. Qualidade e atenção em cada detalhe."}
            </motion.p>

            <motion.div
              className="flex flex-wrap gap-3"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45, duration: 0.5 }}
            >
              <Link
                to={storePath("/catalogo")}
                style={{ backgroundColor: style.accent }}
                className="flex items-center gap-2 px-7 h-12 text-white text-[11px] font-bold uppercase tracking-[0.1em] rounded-2xl shadow-sm hover:shadow-md hover:opacity-90 transition-all active:scale-95"
              >
                <ShoppingBag size={15} /> Ver Catálogo
              </Link>
              {onSale.length > 0 && (
                <Link
                  to={storePath("/catalogo")}
                  className="flex items-center gap-2 px-7 h-12 border border-slate-200 bg-white text-[#0f172a] text-[11px] font-bold uppercase tracking-[0.1em] hover:border-slate-300 hover:shadow-sm transition-all rounded-2xl"
                >
                  <Zap size={13} style={{ color: style.accent }} />
                  {onSale.length} {onSale.length === 1 ? "Promoção" : "Promoções"}
                </Link>
              )}
            </motion.div>
          </motion.div>

          {/* Right: floating product card */}
          {heroProduct && (
            <motion.div
              className="hidden md:flex justify-center items-center"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25, duration: 0.7 }}
            >
              <motion.div
                animate={{ y: [0, -6, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                className="w-72 bg-white rounded-2xl shadow-md border-t-4 overflow-hidden"
                style={{ borderTopColor: style.accent }}
              >
                <div className="aspect-square bg-slate-50 overflow-hidden">
                  {heroImg
                    ? <img src={heroImg} alt={heroProduct.name} className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center text-slate-200"><Package size={48} strokeWidth={1} /></div>}
                </div>
                <div className="p-5">
                  <p className="text-[9px] text-slate-400 uppercase tracking-[0.12em] font-semibold mb-1">
                    {heroProduct.category_name || "Destaque"}
                  </p>
                  <p className="text-sm font-bold text-[#0f172a] leading-snug line-clamp-2 mb-3">{heroProduct.name}</p>
                  <div className="flex items-center justify-between">
                    <p className="text-xl font-black font-mono" style={{ color: style.accent }}>
                      R$ {Number(heroProduct.discount_price || heroProduct.price).toFixed(2)}
                    </p>
                    <span
                      className="w-9 h-9 flex items-center justify-center rounded-xl text-white text-lg font-bold shadow-sm"
                      style={{ backgroundColor: style.accent }}
                    >+</span>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </div>
      </div>

      {/* ── STATS BAR ─────────────────────────────────────────── */}
      <div className="bg-white border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-6 md:px-8 py-5 flex flex-wrap items-center gap-8 md:gap-14">
          {[
            { value: allActive.length, label: "Produtos" },
            { value: categories.length, label: "Categorias" },
            { value: featured.length, label: "Destaques" },
            { value: onSale.length, label: "Promoções" },
          ].map((s, i) => (
            <motion.div
              key={i}
              className="flex items-center gap-2.5"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
            >
              <span className="text-2xl font-black tabular-nums" style={{ color: style.accent }}>{s.value}</span>
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-[0.12em]">{s.label}</span>
            </motion.div>
          ))}
        </div>
      </div>

      {/* ── CATEGORIES ────────────────────────────────────────── */}
      {categories.length > 0 && (
        <section id="categorias" className="max-w-7xl mx-auto px-4 md:px-8 py-20">
          <SectionHeader
            title="Categorias"
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
                  whileHover={{ y: -2 }}
                >
                  <Link
                    to={storePath(`/catalogo?cat=${cat.id}`)}
                    className="group flex flex-col items-center text-center gap-2.5 p-5 border rounded-2xl bg-white border-slate-100 hover:border-slate-200 hover:shadow-sm transition-all"
                  >
                    <div
                      className="w-10 h-10 flex items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-110"
                      style={{ backgroundColor: style.accent + "14" }}
                    >
                      <Tag size={16} style={{ color: style.accent }} />
                    </div>
                    <p className="text-[11px] font-semibold text-[#0f172a] leading-tight">{cat.name}</p>
                    <span
                      className="text-[9px] font-bold px-2.5 py-0.5 rounded-full"
                      style={{ backgroundColor: style.accent + "14", color: style.accent }}
                    >
                      {count}
                    </span>
                  </Link>
                </motion.div>
              );
            })}
          </div>
          {categories.length > CATEGORY_DISPLAY_LIMIT && (
            <div className="mt-6 text-center">
              <Link
                to={storePath("/catalogo")}
                className="inline-flex items-center gap-2 px-6 h-10 border border-slate-200 bg-white text-slate-600 text-[11px] font-semibold uppercase tracking-wider hover:border-slate-300 hover:shadow-sm transition-all rounded-xl"
              >
                +{categories.length - CATEGORY_DISPLAY_LIMIT} mais categorias <ChevronRight size={13} />
              </Link>
            </div>
          )}
        </section>
      )}

      {/* ── FEATURED ──────────────────────────────────────────── */}
      {featured.length > 0 && (
        <section className="py-20 bg-slate-50">
          <div className="max-w-7xl mx-auto px-6 md:px-8">
            <div className="flex items-center justify-between mb-10">
              <div className="flex items-center gap-3">
                <div className="w-0.5 h-6 rounded-full" style={{ backgroundColor: style.accent }} />
                <Star size={16} style={{ color: style.accent }} />
                <h2 className="text-2xl font-black tracking-tight text-[#0f172a]">Destaques</h2>
                <span
                  className="text-[9px] font-bold px-2.5 py-0.5 rounded-full"
                  style={{ backgroundColor: style.accent + "14", color: style.accent }}
                >
                  {featured.length}
                </span>
              </div>
              <Link
                to={storePath("/catalogo")}
                className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400 hover:text-[#2563eb] transition-colors"
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
                    whileHover={{ y: -2 }}
                    className="group bg-white border border-slate-100 overflow-hidden hover:border-slate-200 hover:shadow-md transition-all duration-300 rounded-2xl"
                  >
                    <Link to={storePath(`/produto/${productRouteSegment(product)}`)} className="block relative overflow-hidden" style={{ aspectRatio: "16/10" }}>
                      {img
                        ? <img src={img} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                        : <div className="w-full h-full flex items-center justify-center bg-slate-50 text-slate-200">
                            <Package size={36} strokeWidth={1} />
                          </div>}
                      {hasDiscount && (
                        <span className="absolute top-3 right-3 text-white text-[9px] font-bold px-2.5 py-1 rounded-full bg-red-500">-{pct}%</span>
                      )}
                      <span
                        className="absolute top-3 left-3 flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full text-white"
                        style={{ backgroundColor: style.accent }}
                      >
                        <Star size={8} fill="currentColor" /> Destaque
                      </span>
                    </Link>
                    <div className="p-4 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold text-[#0f172a] line-clamp-1 tracking-tight">{product.name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <p className="text-sm font-bold font-mono" style={{ color: style.accent }}>
                            R$ {Number(product.discount_price || product.price).toFixed(2)}
                          </p>
                          {hasDiscount && (
                            <span className="text-[9px] text-slate-400 line-through font-mono">R$ {Number(product.price).toFixed(2)}</span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => addToCart(product)}
                        style={{ backgroundColor: style.accent }}
                        className="w-9 h-9 flex items-center justify-center shrink-0 text-white shadow-sm active:scale-90 transition-all rounded-xl hover:shadow-md"
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
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 md:px-8">
          <SectionHeader
            title="Mais Vendidos"
            icon={<TrendingUp size={16} />}
            link={storePath("/catalogo")}
            linkLabel="Ver catálogo"
            accent={style.accent}
          />
          {bestSellers.length === 0 ? (
            <div className="py-20 text-center text-slate-400">
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
        <section className="py-20 bg-slate-50">
          <div className="max-w-7xl mx-auto px-4 md:px-8">
            <div className="flex items-center justify-between mb-10">
              <div className="flex items-center gap-3">
                <div className="w-0.5 h-6 rounded-full bg-red-500" />
                <Zap size={16} className="text-red-500" />
                <h2 className="text-2xl font-black tracking-tight text-[#0f172a]">Promoções</h2>
                <span className="text-[9px] font-bold px-2.5 py-0.5 rounded-full bg-red-50 text-red-500 border border-red-100">
                  {onSale.length} oferta{onSale.length !== 1 ? "s" : ""}
                </span>
              </div>
              <Link
                to={storePath("/catalogo")}
                className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400 hover:text-[#2563eb] transition-colors"
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
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.06 }}
                    whileHover={{ y: -2 }}
                  >
                    <Link
                      to={storePath(`/produto/${productRouteSegment(product)}`)}
                      className="group flex flex-col border transition-all overflow-hidden hover:shadow-md rounded-2xl bg-white border-slate-100 hover:border-slate-200"
                    >
                      <div className="aspect-square bg-slate-50 overflow-hidden relative">
                        {img
                          ? <img src={img} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                          : <div className="w-full h-full flex items-center justify-center text-slate-200"><Package size={36} strokeWidth={1} /></div>}
                        <span className="absolute top-3 left-3 text-white text-[9px] font-bold px-2.5 py-1 rounded-full bg-red-500">-{pct}%</span>
                      </div>
                      <div className="p-4">
                        <p className="text-sm font-medium text-[#0f172a] line-clamp-2 leading-snug">{product.name}</p>
                        <div className="flex items-center gap-2 mt-3">
                          <span className="text-base font-bold font-mono text-red-500">R$ {Number(product.discount_price).toFixed(2)}</span>
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
