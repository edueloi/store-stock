import React, { ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { motion } from "motion/react";
import StoreSEO from "../../../../components/store/StoreSEO";
import {
  ArrowRight, Package, ShoppingBag, Star,
  Zap, TrendingUp, ChevronRight, Cpu, Headphones, Monitor,
  Camera, Smartphone, Wifi, HardDrive, Speaker, Tv, Tag,
  Shield, Truck, Clock, Award,
} from "lucide-react";
import { useStore, StoreStyle } from "../../StoreLayout";
import { Category, Product } from "../../../../types";
import { buildStorePath, resolveStoreSlug, productRouteSegment } from "../../store-routing";
import { productHasStock } from "../../../../utils/productStock";

// ── Tech Icons Map ──────────────────────────────────────────────────────────

const TECH_ICONS: Record<string, ReactNode> = {
  camera: <Camera size={20} />, câmera: <Camera size={20} />, cameras: <Camera size={20} />,
  receiver: <Speaker size={20} />, receivers: <Speaker size={20} />, áudio: <Headphones size={20} />, audio: <Headphones size={20} />,
  projetor: <Monitor size={20} />, projetores: <Monitor size={20} />,
  fone: <Headphones size={20} />, headphone: <Headphones size={20} />,
  celular: <Smartphone size={20} />, smartphone: <Smartphone size={20} />, telefone: <Smartphone size={20} />,
  tv: <Tv size={20} />, televisão: <Tv size={20} />,
  wifi: <Wifi size={20} />, rede: <Wifi size={20} />, roteador: <Wifi size={20} />,
  hd: <HardDrive size={20} />, ssd: <HardDrive size={20} />, armazenamento: <HardDrive size={20} />,
  notebook: <Monitor size={20} />, laptop: <Monitor size={20} />, computador: <Cpu size={20} />, pc: <Cpu size={20} />,
  gamer: <Monitor size={20} />, console: <Monitor size={20} />, ps5: <Monitor size={20} />, tablet: <Smartphone size={20} />,
  alexa: <Speaker size={20} />, smart: <Wifi size={20} />,
};

function getCategoryIcon(name: string) {
  const lower = name.toLowerCase();
  for (const key of Object.keys(TECH_ICONS)) {
    if (lower.includes(key)) return TECH_ICONS[key];
  }
  return <Cpu size={20} />;
}

// ── Grid Pattern (very subtle on light bg) ──────────────────────────────────

const gridStyle = {
  backgroundImage: "linear-gradient(rgba(14,165,233,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(14,165,233,0.07) 1px, transparent 1px)",
  backgroundSize: "48px 48px",
};

// ── Section Header ─────────────────────────────────────────────────────────

function SectionHeader({ title, icon, link, linkLabel, accent }: {
  title: string; icon?: ReactNode; link: string; linkLabel?: string; accent: string;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-8">
      <div className="flex items-center gap-3">
        <div className="w-1 h-7 rounded-full" style={{ backgroundColor: accent }} />
        {icon && <span style={{ color: accent }}>{icon}</span>}
        <h2 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight leading-none">{title}</h2>
      </div>
      <Link
        to={link}
        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 bg-white text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500 hover:border-sky-400 hover:text-sky-600 transition-all shadow-sm"
      >
        {linkLabel || "Ver todos"} <ChevronRight size={13} />
      </Link>
    </div>
  );
}

// ── Category Card ──────────────────────────────────────────────────────────

function CategoryCard({ cat, slug, count, accent }: { cat: Category; slug: string; count: number; accent: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.2 }}
    >
      <Link
        to={buildStorePath(slug, `/catalogo?cat=${cat.id}`)}
        className="group relative flex flex-col items-center gap-3 p-5 text-center rounded-2xl border border-slate-200 bg-white overflow-hidden transition-all duration-300 hover:border-sky-300 hover:shadow-[0_4px_20px_rgba(14,165,233,0.12)] shadow-sm"
      >
        <div
          className="relative w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300 group-hover:scale-110"
          style={{ backgroundColor: accent + "15", color: accent }}
        >
          {getCategoryIcon(cat.name)}
        </div>
        <div>
          <p className="text-sm font-bold text-slate-800 leading-tight">{cat.name}</p>
          <span className="text-[10px] font-medium text-slate-400 mt-0.5 block">{count} produto{count !== 1 ? "s" : ""}</span>
        </div>
        {/* Bottom accent bar on hover */}
        <div
          className="absolute inset-x-0 bottom-0 h-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
          style={{ backgroundColor: accent }}
        />
      </Link>
    </motion.div>
  );
}

// ── Product Card ──────────────────────────────────────────────────────────

function ProductCard({ product, index, slug, style, onAddToCart }: {
  product: Product; index: number; slug: string; style: StoreStyle; onAddToCart: (p: Product) => void;
}) {
  const img = (Array.isArray(product.images) && (product.images as string[])[0]) || product.image_url || null;
  const hasDiscount = !!product.discount_price;
  const pct = hasDiscount ? Math.round((1 - Number(product.discount_price) / Number(product.price)) * 100) : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.05, 0.4) }}
      className="group flex flex-col rounded-2xl border border-slate-200 bg-white overflow-hidden transition-all duration-300 hover:border-sky-300 hover:-translate-y-1 hover:shadow-[0_8px_28px_rgba(14,165,233,0.13)] shadow-sm"
    >
      <Link to={buildStorePath(slug, `/produto/${productRouteSegment(product)}`)} className="relative block overflow-hidden aspect-square bg-slate-50">
        {img
          ? <img src={img} alt={product.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
          : <div className="w-full h-full flex items-center justify-center text-slate-300"><Package size={44} strokeWidth={1} /></div>}

        <div className="absolute top-2 left-2 flex flex-col gap-1">
          {hasDiscount && (
            <span className="text-[9px] font-black px-2 py-0.5 rounded-lg text-white" style={{ backgroundColor: style.accent }}>
              -{pct}%
            </span>
          )}
          {product.is_featured && (
            <span className="text-[9px] font-black px-2 py-0.5 rounded-lg flex items-center gap-0.5 text-white" style={{ backgroundColor: style.accent + "22", color: style.accent, border: `1px solid ${style.accent}40` }}>
              <Star size={7} fill="currentColor" /> Top
            </span>
          )}
        </div>

        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
        <button
          onClick={e => { e.preventDefault(); onAddToCart(product); }}
          style={{ backgroundColor: style.accent }}
          className="absolute bottom-0 inset-x-0 py-2.5 text-white text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 translate-y-full group-hover:translate-y-0 transition-transform duration-200"
        >
          <ShoppingBag size={12} strokeWidth={2.5} /> Adicionar
        </button>
      </Link>

      <div className="p-4 flex flex-col gap-1.5">
        <p className="text-[9px] font-bold uppercase tracking-wider" style={{ color: style.accent }}>
          {product.category_name || "Tecnologia"}
        </p>
        <Link
          to={buildStorePath(slug, `/produto/${productRouteSegment(product)}`)}
          className="text-sm font-bold text-slate-800 leading-snug line-clamp-2 hover:text-sky-600 transition-colors"
        >
          {product.name}
        </Link>
        <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100">
          <div>
            {hasDiscount ? (
              <div className="flex flex-col">
                <span className="text-[9px] line-through text-slate-400 font-mono">R$ {Number(product.price).toFixed(2)}</span>
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
            <ShoppingBag size={13} />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────

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
  const heroImage = tenant.banner_url || getImg(featured[0]) || getImg(bestSellers[0]) || getImg(allActive[0]);

  return (
    <div className="bg-[#f4f6fb]">
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

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section className="relative min-h-[88vh] flex items-center overflow-hidden bg-white">
        {/* Subtle grid */}
        <div className="absolute inset-0 pointer-events-none" style={gridStyle} />

        {/* Sky blue gradient accent top-right */}
        <div className="absolute top-0 right-0 w-[600px] h-[600px] pointer-events-none"
          style={{ background: `radial-gradient(ellipse at 100% 0%, ${style.accent}18 0%, transparent 65%)` }} />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] pointer-events-none"
          style={{ background: `radial-gradient(ellipse at 0% 100%, ${style.accent}10 0%, transparent 65%)` }} />

        <div className="relative z-10 max-w-7xl mx-auto px-4 md:px-8 py-20 w-full">
          <div className="grid lg:grid-cols-2 gap-12 items-center">

            {/* Left: text */}
            <motion.div initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6 }}>
              {/* Badge */}
              <div className="inline-flex items-center gap-2.5 rounded-full border px-4 py-2 mb-8"
                style={{ borderColor: style.accent + "40", backgroundColor: style.accent + "10" }}>
                <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: style.accent }} />
                <span className="text-[10px] font-black uppercase tracking-[0.28em]" style={{ color: style.accent }}>
                  Tecnologia & Inovação
                </span>
              </div>

              <h1 className="text-5xl md:text-6xl lg:text-7xl font-black text-slate-900 leading-none tracking-tight">
                {tenant.name}
              </h1>

              {/* Sky blue underline accent */}
              <div className="h-1.5 w-20 rounded-full mt-4 mb-5" style={{ backgroundColor: style.accent }} />

              <p className="text-slate-500 text-base md:text-lg leading-relaxed max-w-lg">
                {tenant.about_text || "Os melhores produtos de tecnologia com preços imbatíveis. Inovação, qualidade e atendimento de excelência."}
              </p>

              <div className="flex flex-wrap gap-3 mt-8">
                <Link
                  to={storePath("/catalogo")}
                  style={{ backgroundColor: style.accent, boxShadow: `0 4px 20px ${style.accent}40` }}
                  className="inline-flex items-center gap-2 h-12 px-7 rounded-xl text-white font-black text-[11px] uppercase tracking-[0.18em] transition-all hover:opacity-90 shadow-lg active:scale-95"
                >
                  <ShoppingBag size={15} /> Ver Catálogo
                </Link>
                <Link
                  to={storePath("/sobre")}
                  className="inline-flex items-center gap-2 h-12 px-7 rounded-xl border border-slate-200 bg-white text-slate-700 font-black text-[11px] uppercase tracking-[0.18em] hover:border-sky-300 hover:text-sky-600 transition-all shadow-sm"
                >
                  Sobre nós <ArrowRight size={13} />
                </Link>
              </div>

              {/* Category chips */}
              <div className="flex flex-wrap gap-2 mt-7">
                {categories.slice(0, 5).map(cat => (
                  <Link
                    key={cat.id}
                    to={storePath(`/catalogo?cat=${cat.id}`)}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-[10px] font-bold uppercase tracking-wider text-slate-500 hover:border-sky-300 hover:text-sky-600 transition-all shadow-sm"
                  >
                    {cat.name}
                  </Link>
                ))}
              </div>
            </motion.div>

            {/* Right: hero image / stats */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="relative"
            >
              {heroImage ? (
                <div className="relative rounded-2xl overflow-hidden border border-slate-200 shadow-[0_12px_48px_rgba(14,165,233,0.15)]">
                  <img src={heroImage} alt={tenant.name} className="w-full aspect-[4/3] object-cover" />
                  {/* Light overlay at bottom */}
                  <div className="absolute inset-0 bg-gradient-to-t from-white/60 via-transparent to-transparent" />
                  <div className="absolute bottom-5 left-5 right-5 flex items-end justify-between">
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-[0.22em] mb-1" style={{ color: style.accent }}>
                        Produto em destaque
                      </p>
                      {featured[0] && (
                        <p className="text-slate-900 font-black text-xl leading-tight">{featured[0].name}</p>
                      )}
                    </div>
                    {featured[0] && (
                      <span
                        className="text-white font-black text-base px-4 py-2 rounded-xl font-mono shrink-0 shadow-lg"
                        style={{ backgroundColor: style.accent }}
                      >
                        R$ {Number(featured[0].discount_price || featured[0].price).toFixed(2)}
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { value: allActive.length, label: "Produtos" },
                      { value: categories.length, label: "Categorias" },
                      { value: featured.length, label: "Destaques" },
                      { value: onSale.length, label: "Promoções" },
                    ].map((s, i) => (
                      <div key={i} className="rounded-xl border border-slate-100 bg-slate-50 p-5 text-center">
                        <span className="text-3xl font-black font-mono" style={{ color: style.accent }}>{s.value}</span>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-1">{s.label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Decorative dots grid */}
              <div className="absolute -bottom-6 -right-6 w-24 h-24 pointer-events-none opacity-30"
                style={{
                  backgroundImage: `radial-gradient(circle, ${style.accent} 1.5px, transparent 1.5px)`,
                  backgroundSize: "10px 10px",
                }}
              />
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── STATS BAR ────────────────────────────────────────────────────── */}
      <div className="bg-white border-y border-slate-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 md:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-slate-100">
            {[
              { value: allActive.length, label: "Produtos ativos", icon: <Package size={16} /> },
              { value: categories.length, label: "Categorias", icon: <Tag size={16} /> },
              { value: featured.length, label: "Destaques", icon: <Star size={16} /> },
              { value: onSale.length, label: "Promoções", icon: <Zap size={16} /> },
            ].map((s, i) => (
              <div key={i} className="flex items-center gap-4 px-6 py-5">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{ backgroundColor: style.accent + "15", color: style.accent }}
                >
                  {s.icon}
                </div>
                <div>
                  <span className="text-2xl font-black text-slate-900 tabular-nums font-mono">{s.value}</span>
                  <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mt-0.5">{s.label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── CATEGORIES ───────────────────────────────────────────────────── */}
      {categories.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 md:px-8 py-16">
          <SectionHeader
            title="Categorias"
            icon={<Tag size={18} />}
            link={storePath("/catalogo")}
            linkLabel="Ver catálogo"
            accent={style.accent}
          />
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {categories.slice(0, CATEGORY_DISPLAY_LIMIT).map((cat, i) => {
              const count = allActive.filter(p => p.category_id === cat.id).length;
              return (
                <motion.div key={cat.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                  <CategoryCard cat={cat} slug={slug} count={count} accent={style.accent} />
                </motion.div>
              );
            })}
          </div>
          {categories.length > CATEGORY_DISPLAY_LIMIT && (
            <div className="mt-6 text-center">
              <Link
                to={storePath("/catalogo")}
                className="inline-flex items-center gap-2 px-6 h-10 rounded-xl border border-slate-200 bg-white text-slate-500 text-[10px] font-black uppercase tracking-wider hover:border-sky-300 hover:text-sky-600 transition-all shadow-sm"
              >
                +{categories.length - CATEGORY_DISPLAY_LIMIT} mais categorias <ChevronRight size={13} />
              </Link>
            </div>
          )}
        </section>
      )}

      {/* ── FEATURED ─────────────────────────────────────────────────────── */}
      {featured.length > 0 && (
        <section className="py-16 bg-white">
          <div className="max-w-7xl mx-auto px-4 md:px-8">
            <SectionHeader
              title="Destaques"
              icon={<Star size={18} />}
              link={storePath("/catalogo")}
              linkLabel="Ver vitrine"
              accent={style.accent}
            />
            <div className="grid lg:grid-cols-[1.2fr_0.8fr] gap-5">
              {/* Hero featured card */}
              <Link
                to={storePath(`/produto/${productRouteSegment(featured[0])}`)}
                className="group relative overflow-hidden rounded-2xl border border-slate-200 min-h-[440px] bg-white hover:border-sky-300 hover:shadow-[0_8px_40px_rgba(14,165,233,0.15)] transition-all duration-300 shadow-sm"
              >
                {getImg(featured[0]) ? (
                  <img src={getImg(featured[0])!} alt={featured[0].name} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center" style={{ background: `linear-gradient(135deg, #f8fafc, ${style.accent}10)` }}>
                    <Package size={80} className="text-slate-200" strokeWidth={1} />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-white/90 via-white/20 to-transparent" />

                <div className="absolute top-5 left-5 flex gap-2 flex-wrap">
                  <span className="rounded-xl border border-slate-200 bg-white/90 backdrop-blur-sm px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-600 shadow-sm">Vitrine</span>
                  {featured[0].discount_price && (
                    <span className="rounded-xl px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-white shadow-sm" style={{ backgroundColor: style.accent }}>
                      Oferta especial
                    </span>
                  )}
                </div>

                <div className="absolute bottom-0 left-0 right-0 p-7 md:p-9">
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] mb-2" style={{ color: style.accent }}>
                    {featured[0].category_name || "Tecnologia"}
                  </p>
                  <h3 className="text-2xl md:text-3xl font-black leading-tight text-slate-900">{featured[0].name}</h3>
                  {featured[0].description && (
                    <p className="mt-2 text-sm text-slate-500 leading-relaxed line-clamp-2 max-w-md">{featured[0].description}</p>
                  )}
                  <div className="mt-4 flex items-end gap-3">
                    <span className="text-2xl font-black font-mono text-slate-900">
                      R$ {Number(featured[0].discount_price || featured[0].price).toFixed(2)}
                    </span>
                    {featured[0].discount_price && (
                      <span className="text-sm text-slate-400 line-through font-mono">R$ {Number(featured[0].price).toFixed(2)}</span>
                    )}
                  </div>
                </div>
              </Link>

              {/* Side cards */}
              <div className="grid sm:grid-cols-2 lg:grid-cols-1 gap-4">
                {featured.slice(1, 5).map((product, i) => {
                  const img = getImg(product);
                  const hasDiscount = !!product.discount_price;
                  const pct = hasDiscount ? Math.round((1 - Number(product.discount_price) / Number(product.price)) * 100) : 0;
                  return (
                    <motion.div key={product.id} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }}>
                      <Link
                        to={storePath(`/produto/${productRouteSegment(product)}`)}
                        className="group flex gap-4 p-4 rounded-2xl border border-slate-200 bg-white hover:border-sky-300 hover:shadow-md transition-all shadow-sm"
                      >
                        <div className="w-20 h-20 rounded-xl overflow-hidden border border-slate-100 shrink-0 flex items-center justify-center bg-slate-50">
                          {img
                            ? <img src={img} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                            : <Package size={24} className="text-slate-300" strokeWidth={1} />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[9px] font-black uppercase tracking-wider mb-0.5" style={{ color: style.accent }}>
                            {product.category_name || "Tecnologia"}
                          </p>
                          <p className="text-sm font-bold text-slate-800 line-clamp-2 leading-snug group-hover:text-sky-600 transition-colors">
                            {product.name}
                          </p>
                          <div className="flex items-center gap-2 mt-2">
                            <span className="text-sm font-black text-slate-900 font-mono">
                              R$ {Number(product.discount_price || product.price).toFixed(2)}
                            </span>
                            {hasDiscount && (
                              <span className="text-[9px] font-black text-white px-1.5 py-0.5 rounded-lg" style={{ backgroundColor: style.accent }}>-{pct}%</span>
                            )}
                          </div>
                        </div>
                      </Link>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── BEST SELLERS ─────────────────────────────────────────────────── */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 md:px-8">
          <SectionHeader
            title="Mais Vendidos"
            icon={<TrendingUp size={18} />}
            link={storePath("/catalogo")}
            linkLabel="Ver catálogo"
            accent={style.accent}
          />
          {bestSellers.length === 0 ? (
            <div className="py-20 flex flex-col items-center gap-4 text-slate-300">
              <Package size={48} strokeWidth={1} className="opacity-30" />
              <p className="text-xs font-black uppercase tracking-wider text-slate-400">Nenhum produto disponível</p>
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

      {/* ── ON SALE ──────────────────────────────────────────────────────── */}
      {onSale.length > 0 && (
        <section className="py-16 bg-white">
          <div className="max-w-7xl mx-auto px-4 md:px-8">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="w-1 h-7 rounded-full bg-sky-400" />
                <Zap size={18} className="text-sky-500" />
                <h2 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight leading-none">Promoções</h2>
                <span className="text-[9px] font-black px-2.5 py-1 rounded-full border text-sky-600 bg-sky-50 border-sky-200">
                  {onSale.length} oferta{onSale.length !== 1 ? "s" : ""}
                </span>
              </div>
              <Link
                to={storePath("/catalogo")}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 bg-white text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500 hover:border-sky-300 hover:text-sky-600 transition-all shadow-sm"
              >
                Ver todas <ChevronRight size={13} />
              </Link>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {onSale.slice(0, 8).map((product, i) => (
                <ProductCard key={product.id} product={product} index={i} slug={slug} style={style} onAddToCart={addToCart} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── TRUST STRIP ──────────────────────────────────────────────────── */}
      <div className="border-t border-slate-100 py-10 bg-[#f4f6fb]">
        <div className="max-w-7xl mx-auto px-4 md:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { icon: <Shield size={22} />, title: "Compra Segura", desc: "Dados protegidos" },
              { icon: <Truck size={22} />, title: "Envio Rápido", desc: "Para todo o Brasil" },
              { icon: <Clock size={22} />, title: "Suporte 24/7", desc: "Atendimento via WA" },
              { icon: <Award size={22} />, title: "Qualidade", desc: "Produtos certificados" },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-4">
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                  style={{ backgroundColor: style.accent + "15", color: style.accent }}
                >
                  {item.icon}
                </div>
                <div>
                  <p className="text-sm font-black text-slate-800">{item.title}</p>
                  <p className="text-[11px] text-slate-400">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
