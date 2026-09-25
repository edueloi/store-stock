import React from "react";
import { Link, useParams } from "react-router-dom";
import { motion } from "motion/react";
import StoreSEO from "../../../../components/store/StoreSEO";
import {
  Package, ShoppingBag, Star, Zap, TrendingUp, ChevronRight, Tag,
  Plug, Cable, Wrench, ShieldCheck, Settings2,
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
        <div className="w-1.5 h-7 rounded-full" style={{ backgroundColor: accent }} />
        {icon && <span style={{ color: accent }}>{icon}</span>}
        <h2 className="text-2xl font-black tracking-tight text-slate-900">{title}</h2>
      </div>
      <Link
        to={link}
        className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500 hover:text-slate-900 transition-colors"
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
      whileHover={{ y: -3 }}
    >
      <Link
        to={buildStorePath(slug, `/produto/${productRouteSegment(product)}`)}
        className="group flex flex-col bg-white border-2 border-slate-200 overflow-hidden transition-all duration-300 rounded-xl hover:shadow-lg hover:border-slate-300"
      >
        <div className="overflow-hidden relative aspect-square bg-slate-50 border-b-2 border-slate-100">
          {img
            ? <img src={img} alt={product.name} className="w-full h-full object-contain p-3 group-hover:scale-105 transition-transform duration-500" />
            : <div className="w-full h-full flex items-center justify-center text-slate-300"><Package size={36} strokeWidth={1.5} /></div>}
          {hasDiscount && (
            <span className="absolute top-3 left-3 text-white text-[9px] font-black px-2.5 py-1 rounded-md bg-red-600 shadow-sm">
              -{pct}%
            </span>
          )}
          {product.is_featured && !hasDiscount && (
            <span
              className="absolute top-3 left-3 text-[9px] font-black uppercase tracking-wider px-2.5 py-1 rounded-md text-white shadow-sm"
              style={{ backgroundColor: style.accent }}
            >
              <Zap size={9} className="inline -mt-0.5 mr-0.5" fill="currentColor" />Top
            </span>
          )}
        </div>
        <div className="flex flex-col p-4 gap-1.5">
          <p className="text-[9px] text-slate-400 uppercase tracking-[0.12em] font-bold">{product.category_name || "Geral"}</p>
          <p className="text-[13px] font-bold text-slate-900 leading-snug line-clamp-2 group-hover:text-slate-700 transition-colors">{product.name}</p>
          <div className="flex items-center justify-between mt-2">
            {hasDiscount ? (
              <div>
                <span className="text-[10px] line-through text-slate-400 font-mono">R$ {Number(product.price).toFixed(2)}</span>
                <p className="text-sm font-black font-mono leading-tight text-red-600">R$ {Number(product.discount_price).toFixed(2)}</p>
              </div>
            ) : (
              <p className="text-sm font-black font-mono" style={{ color: style.accent }}>R$ {Number(product.price).toFixed(2)}</p>
            )}
            <button
              onClick={e => { e.preventDefault(); onAddToCart(product); }}
              style={{ backgroundColor: style.accent }}
              className="shrink-0 text-white transition-all active:scale-90 w-8 h-8 flex items-center justify-center shadow-sm rounded-lg hover:shadow-md"
            >
              <span className="text-base font-bold leading-none">+</span>
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

  const heroImage = tenant.banner_url || null;

  return (
    <div className="space-y-0 bg-white">
      <StoreSEO
        title={`${tenant.name} — Loja Online`}
        description={tenant.about_text || `Bem-vindo à ${tenant.name}. Material elétrico, ferragens e eletrônicos com os melhores preços. Atendimento via WhatsApp.`}
        image={tenant.banner_url || tenant.logo_url}
        url={typeof window !== "undefined" ? window.location.href : ""}
        siteName={tenant.name}
        keywords={`${tenant.name}, material elétrico, ferragens, eletrônicos, loja online, ${categories.map(c => c.name).join(", ")}, comprar, promoções`}
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
      <div className="relative overflow-hidden bg-slate-50 border-b-2 border-slate-100">
        {/* Hazard-stripe accent bar */}
        <div
          className="h-1.5 w-full"
          style={{
            backgroundImage: `repeating-linear-gradient(135deg, ${style.accent} 0 14px, #0f172a 14px 28px)`,
          }}
        />
        <div className="max-w-7xl mx-auto px-6 md:px-8 py-16 md:py-24 grid md:grid-cols-2 gap-12 items-center">

          {/* Left: text */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <motion.div
              className="inline-flex items-center gap-2 rounded-full border-2 px-4 py-1.5 mb-5"
              style={{ borderColor: style.accent, backgroundColor: `${style.accent}12` }}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Zap size={12} style={{ color: style.accent }} fill="currentColor" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: style.accent }}>Material Elétrico & Ferragens</span>
            </motion.div>

            <motion.h1
              className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black tracking-tight leading-[0.95] text-slate-900 mb-5"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, duration: 0.6 }}
            >
              {tenant.name}
            </motion.h1>

            <motion.p
              className="text-slate-600 text-base leading-relaxed max-w-md mb-8"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35, duration: 0.5 }}
            >
              {tenant.hero_tagline || "Fios, conectores, ferramentas e componentes com qualidade e preço justo. Peça pelo WhatsApp e receba rápido."}
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
                className="flex items-center gap-2 px-6 h-12 text-white text-[12px] font-black uppercase tracking-[0.1em] rounded-xl shadow-md hover:shadow-lg hover:opacity-95 transition-all active:scale-95"
              >
                <ShoppingBag size={15} /> Ver Catálogo
              </Link>
              {onSale.length > 0 && (
                <Link
                  to={storePath("/catalogo")}
                  className="flex items-center gap-2 px-6 h-12 border-2 border-slate-300 bg-white text-slate-900 text-[12px] font-black uppercase tracking-[0.1em] hover:border-slate-400 hover:shadow-sm transition-all rounded-xl"
                >
                  <Zap size={13} style={{ color: style.accent }} />
                  {onSale.length} {onSale.length === 1 ? "Promoção" : "Promoções"}
                </Link>
              )}
            </motion.div>

            <motion.div
              className="flex flex-wrap gap-2 mt-7"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.55, duration: 0.5 }}
            >
              {categories.slice(0, 4).map(cat => (
                <Link key={cat.id} to={storePath(`/catalogo?cat=${cat.id}`)}
                  className="rounded-lg border-2 border-slate-200 bg-white px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-600 hover:text-slate-900 hover:border-slate-300 transition-all">
                  {cat.name}
                </Link>
              ))}
            </motion.div>
          </motion.div>

          {/* Right: banner image (generous ratio) OR stats/category panel fallback — never a cropped isolated product photo */}
          <motion.div
            className="relative"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25, duration: 0.7 }}
          >
            {heroImage ? (
              <div className="relative rounded-2xl overflow-hidden border-2 border-slate-200 shadow-lg">
                <img src={heroImage} alt={tenant.name} className="w-full aspect-[4/3] object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/50 via-transparent to-transparent" />
                <div className="absolute bottom-5 left-5 right-5 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/80">Loja Online</p>
                    <p className="text-white font-black mt-1 text-base">{tenant.name}</p>
                  </div>
                  {onSale.length > 0 && (
                    <span className="bg-white text-slate-900 font-black text-[12px] px-3.5 py-1.5 rounded-lg shadow-md">
                      {onSale.length} ofertas
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div className="relative rounded-2xl border-2 border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center gap-2 mb-5">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${style.accent}18`, color: style.accent }}>
                    <Plug size={18} />
                  </div>
                  <p className="text-[11px] font-black uppercase tracking-widest text-slate-500">Painel da loja</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { value: allActive.length, label: "Produtos", icon: <Package size={16} /> },
                    { value: categories.length, label: "Categorias", icon: <Cable size={16} /> },
                    { value: featured.length, label: "Destaques", icon: <Star size={16} /> },
                    { value: onSale.length, label: "Promoções", icon: <Zap size={16} /> },
                  ].map((s, i) => (
                    <div key={i} className="rounded-xl border-2 border-slate-100 bg-slate-50 p-4">
                      <div className="flex items-center gap-2 mb-1.5" style={{ color: style.accent }}>{s.icon}</div>
                      <span className="text-xl font-black text-slate-900">{s.value}</span>
                      <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500 mt-0.5">{s.label}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 pt-4 border-t-2 border-dashed border-slate-100 flex items-center gap-2 text-slate-400">
                  <ShieldCheck size={14} />
                  <span className="text-[10px] font-bold uppercase tracking-wider">Compra segura via WhatsApp</span>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      </div>

      {/* ── STATS BAR ─────────────────────────────────────────── */}
      <div className="bg-white border-b-2 border-slate-100">
        <div className="max-w-7xl mx-auto px-6 md:px-8 py-5 flex flex-wrap items-center gap-8 md:gap-14">
          {[
            { value: allActive.length, label: "Produtos", icon: <Package size={14} /> },
            { value: categories.length, label: "Categorias", icon: <Tag size={14} /> },
            { value: featured.length, label: "Destaques", icon: <Star size={14} /> },
            { value: onSale.length, label: "Promoções", icon: <Zap size={14} /> },
          ].map((s, i) => (
            <motion.div
              key={i}
              className="flex items-center gap-2.5"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
            >
              <span style={{ color: style.accent }}>{s.icon}</span>
              <span className="text-lg font-black tabular-nums text-slate-900">{s.value}</span>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.12em]">{s.label}</span>
            </motion.div>
          ))}
        </div>
      </div>

      {/* ── CATEGORIES ────────────────────────────────────────── */}
      {categories.length > 0 && (
        <section id="categorias" className="max-w-7xl mx-auto px-4 md:px-8 py-20">
          <SectionHeader
            title="Categorias"
            icon={<Settings2 size={18} />}
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
                    className="group flex flex-col items-center text-center gap-2.5 p-5 border-2 rounded-xl bg-white border-slate-200 hover:border-slate-300 hover:shadow-md transition-all"
                  >
                    <div
                      className="w-10 h-10 flex items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-110"
                      style={{ backgroundColor: style.accent + "16" }}
                    >
                      <Cable size={16} style={{ color: style.accent }} />
                    </div>
                    <p className="text-[11px] font-bold text-slate-900 leading-tight">{cat.name}</p>
                    <span
                      className="text-[9px] font-black px-2.5 py-0.5 rounded-full"
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
                className="inline-flex items-center gap-2 px-6 h-10 border-2 border-slate-200 bg-white text-slate-600 text-[11px] font-bold uppercase tracking-wider hover:border-slate-300 hover:shadow-sm transition-all rounded-xl"
              >
                +{categories.length - CATEGORY_DISPLAY_LIMIT} mais categorias <ChevronRight size={13} />
              </Link>
            </div>
          )}
        </section>
      )}

      {/* ── FEATURED ──────────────────────────────────────────── */}
      {featured.length > 0 && (
        <section className="py-20 bg-slate-50 border-y-2 border-slate-100">
          <div className="max-w-7xl mx-auto px-6 md:px-8">
            <div className="flex items-center justify-between mb-10">
              <div className="flex items-center gap-3">
                <div className="w-1.5 h-7 rounded-full" style={{ backgroundColor: style.accent }} />
                <Star size={18} style={{ color: style.accent }} />
                <h2 className="text-2xl font-black tracking-tight text-slate-900">Destaques</h2>
                <span
                  className="text-[9px] font-black px-2.5 py-0.5 rounded-full"
                  style={{ backgroundColor: style.accent + "14", color: style.accent }}
                >
                  {featured.length}
                </span>
              </div>
              <Link
                to={storePath("/catalogo")}
                className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500 hover:text-slate-900 transition-colors"
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
                    className="group bg-white border-2 border-slate-200 overflow-hidden hover:border-slate-300 hover:shadow-lg transition-all duration-300 rounded-xl"
                  >
                    <Link to={storePath(`/produto/${productRouteSegment(product)}`)} className="block relative overflow-hidden bg-slate-50 border-b-2 border-slate-100" style={{ aspectRatio: "4/3" }}>
                      {img
                        ? <img src={img} alt={product.name} className="w-full h-full object-contain p-4 group-hover:scale-105 transition-transform duration-500" />
                        : <div className="w-full h-full flex items-center justify-center text-slate-300">
                            <Package size={36} strokeWidth={1.5} />
                          </div>}
                      {hasDiscount && (
                        <span className="absolute top-3 right-3 text-white text-[9px] font-black px-2.5 py-1 rounded-md bg-red-600 shadow-sm">-{pct}%</span>
                      )}
                      <span
                        className="absolute top-3 left-3 flex items-center gap-1 text-[9px] font-black uppercase tracking-wider px-2.5 py-1 rounded-md text-white shadow-sm"
                        style={{ backgroundColor: style.accent }}
                      >
                        <Zap size={9} fill="currentColor" /> Destaque
                      </span>
                    </Link>
                    <div className="p-4 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[11px] font-bold text-slate-900 line-clamp-1 tracking-tight">{product.name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <p className="text-sm font-black font-mono" style={{ color: style.accent }}>
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
                        className="w-8 h-8 flex items-center justify-center shrink-0 text-white shadow-sm active:scale-90 transition-all rounded-lg hover:shadow-md"
                      >
                        <ShoppingBag size={13} />
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
            icon={<TrendingUp size={18} />}
            link={storePath("/catalogo")}
            linkLabel="Ver catálogo"
            accent={style.accent}
          />
          {bestSellers.length === 0 ? (
            <div className="py-20 text-center text-slate-400">
              <Wrench size={40} strokeWidth={1.5} className="mx-auto mb-4 opacity-30" />
              <p className="text-xs font-bold uppercase tracking-wider">Nenhum produto disponível</p>
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
        <section className="py-20 bg-slate-50 border-t-2 border-slate-100">
          <div className="max-w-7xl mx-auto px-4 md:px-8">
            <div className="flex items-center justify-between mb-10">
              <div className="flex items-center gap-3">
                <div className="w-1.5 h-7 rounded-full bg-red-600" />
                <Zap size={18} className="text-red-600" fill="currentColor" />
                <h2 className="text-2xl font-black tracking-tight text-slate-900">Promoções</h2>
                <span className="text-[9px] font-black px-2.5 py-0.5 rounded-full bg-red-50 text-red-600 border-2 border-red-100">
                  {onSale.length} oferta{onSale.length !== 1 ? "s" : ""}
                </span>
              </div>
              <Link
                to={storePath("/catalogo")}
                className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500 hover:text-slate-900 transition-colors"
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
                      className="group flex flex-col border-2 transition-all overflow-hidden hover:shadow-lg rounded-xl bg-white border-slate-200 hover:border-slate-300"
                    >
                      <div className="aspect-square bg-slate-50 overflow-hidden relative border-b-2 border-slate-100">
                        {img
                          ? <img src={img} alt={product.name} className="w-full h-full object-contain p-3 group-hover:scale-105 transition-transform duration-500" />
                          : <div className="w-full h-full flex items-center justify-center text-slate-300"><Package size={36} strokeWidth={1.5} /></div>}
                        <span className="absolute top-3 left-3 text-white text-[9px] font-black px-2.5 py-1 rounded-md bg-red-600 shadow-sm">-{pct}%</span>
                      </div>
                      <div className="p-4">
                        <p className="text-[13px] font-semibold text-slate-900 line-clamp-2 leading-snug">{product.name}</p>
                        <div className="flex items-center gap-2 mt-3">
                          <span className="text-sm font-black font-mono text-red-600">R$ {Number(product.discount_price).toFixed(2)}</span>
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
