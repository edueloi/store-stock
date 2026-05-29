import React, { ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { motion } from "motion/react";
import StoreSEO from "../../../../components/store/StoreSEO";
import {
  ArrowRight, Package, ShoppingBag, Star,
  Zap, TrendingUp, ChevronRight, Tag,
} from "lucide-react";
import { cn } from "../../../../lib/utils";
import { useStore, StoreStyle } from "../../StoreLayout";
import { Category, Product } from "../../../../types";
import { buildStorePath, resolveStoreSlug } from "../../store-routing";

function SectionHeader({ title, icon, link, linkLabel, accent, isFashion = false }: {
  title: string; icon?: ReactNode; link: string; linkLabel?: string; accent: string; isFashion?: boolean;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-8">
      <div className="flex items-center gap-3">
        <div className="w-1 h-6 rounded-full" style={{ backgroundColor: accent }} />
        {icon && <span style={{ color: accent }}>{icon}</span>}
        <h2 className={cn(
          "store-display text-[2.35rem] md:text-5xl font-semibold tracking-[-0.04em]",
          "text-[#2d221f]"
        )}>{title}</h2>
      </div>
      <Link
        to={link}
        className="flex items-center gap-1 transition-colors text-[11px] font-semibold tracking-[0.22em] uppercase text-[#8c6c63] hover:text-[#2d221f]"
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
          "group flex flex-col border overflow-hidden transition-all",
          "fashion-soft-shadow hover:-translate-y-1 hover:shadow-[0_26px_70px_rgba(108,64,55,0.12)]",
          style.card,
          style.radius
        )}
      >
        <div className="overflow-hidden relative aspect-[4/5] bg-[#f8efe8]">
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
        <div className="flex flex-col p-4 sm:p-5 gap-2">
          <p className="store-kicker text-[9px] font-semibold text-[#9c7b72]">{product.category_name || "Geral"}</p>
          <p className="store-display text-[1.28rem] sm:text-[1.55rem] font-semibold text-[#2d221f] leading-[0.95] line-clamp-2 transition-colors">
            {product.name}
          </p>
          {product.description && (
            <p className="text-[11px] sm:text-[12px] leading-relaxed line-clamp-2 text-[#8c6c63]">{product.description}</p>
          )}
          <div className="flex items-center justify-between mt-2 pt-3 border-t border-[#eee2d6]">
            {hasDiscount ? (
              <div>
                <span className="text-[10px] line-through text-slate-400 font-mono">R$ {Number(product.price).toFixed(2)}</span>
                <p className="store-display text-[1.45rem] sm:text-[1.8rem] font-semibold text-[#2d221f] leading-none">R$ {Number(product.discount_price).toFixed(2)}</p>
              </div>
            ) : (
              <p className="store-display text-[1.45rem] sm:text-[1.8rem] font-semibold leading-none" style={{ color: style.accent }}>R$ {Number(product.price).toFixed(2)}</p>
            )}
            <button
              onClick={e => { e.preventDefault(); onAddToCart(product); }}
              style={{ backgroundColor: style.accent }}
              className={cn(
                "shrink-0 text-white transition-all active:scale-90",
                "w-10 h-10 sm:w-auto sm:px-4 rounded-full shadow-sm hover:shadow-md text-[10px] font-semibold uppercase tracking-[0.18em] sm:tracking-[0.24em] flex items-center justify-center gap-2",
                style.radius
              )}
            >
              <ShoppingBag size={13} /><span>Adicionar</span>
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

  const getImg = (p: Product | undefined) =>
    p ? ((Array.isArray(p.images) && (p.images as string[])[0]) || p.image_url || null) : null;
  const heroImage = tenant.banner_url || getImg(featured[0]) || getImg(bestSellers[0]) || getImg(allActive[0]);

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
      <section className="relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 md:px-8 pt-6 md:pt-12 pb-6 md:pb-10">
          <div className="grid lg:grid-cols-[1.05fr_0.95fr] gap-5 items-stretch">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55 }}
              className="fashion-panel relative overflow-hidden rounded-[2rem] border border-[#ead9ce] bg-[linear-gradient(135deg,#fff8f3_0%,#f7ece4_55%,#fffdfb_100%)] p-6 sm:p-8 md:p-12"
            >
              <div className="absolute top-0 right-0 h-36 w-36 rounded-full bg-[#f1ddd3]/80 blur-3xl" />
              <div className="absolute bottom-0 left-0 h-24 w-24 rounded-full bg-white/70 blur-2xl" />
              <p className="store-kicker text-[10px] font-semibold text-[#9d6d63]">Nova coleção</p>
              <h1 className="store-display mt-4 sm:mt-5 text-[3.25rem] sm:text-6xl md:text-7xl lg:text-[5.6rem] leading-[0.88] text-[#2d221f]">
                {tenant.name}
              </h1>
              <p className="mt-5 sm:mt-6 max-w-xl text-[15px] sm:text-base md:text-lg leading-relaxed text-[#6b5149]">
                {tenant.about_text || "Roupas e acessórios com curadoria leve, elegante e pensada para uma vitrine que vende com presença."}
              </p>
              <div className="mt-7 sm:mt-8 flex flex-col sm:flex-row gap-3">
                <Link
                  to={storePath("/catalogo")}
                  style={{ backgroundColor: style.accent }}
                  className="inline-flex w-full sm:w-auto justify-center h-12 items-center gap-2 rounded-full px-6 sm:px-7 text-[11px] font-semibold uppercase tracking-[0.18em] sm:tracking-[0.28em] text-white shadow-lg shadow-[#c99f94]/30 transition-all hover:-translate-y-0.5"
                >
                  <ShoppingBag size={15} /> Ver coleção
                </Link>
                <a
                  href="#categorias"
                  className="inline-flex w-full sm:w-auto justify-center h-12 items-center gap-2 rounded-full border border-[#e7d6ca] bg-white/75 px-6 sm:px-7 text-[11px] font-semibold uppercase tracking-[0.18em] sm:tracking-[0.24em] text-[#6b5149] transition-all hover:bg-white"
                >
                  Estilos <ArrowRight size={13} />
                </a>
              </div>
              <div className="mt-8 sm:mt-10 flex flex-wrap gap-2">
                {(categories.slice(0, 4).map(cat => cat.name).length > 0
                  ? categories.slice(0, 4).map(cat => cat.name)
                  : ["Moda feminina", "Acessórios", "Novidades", "Favoritos"]).map((label) => (
                  <span key={label} className="rounded-full border border-[#ead7cc] bg-white/70 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#8c6c63]">
                    {label}
                  </span>
                ))}
              </div>
            </motion.div>

            <div className="grid gap-5">
              <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.6, delay: 0.08 }}
                className="fashion-panel relative min-h-[320px] sm:min-h-[420px] overflow-hidden rounded-[2rem] border border-[#ead9ce] bg-[#f3e7dd]"
              >
                {heroImage ? (
                  <img src={heroImage} alt={tenant.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="absolute inset-0 bg-[linear-gradient(145deg,#f5e6dc_0%,#fffaf5_100%)]" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-[#2d221f]/62 via-[#2d221f]/18 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8 text-white">
                  <p className="store-kicker text-[10px] font-semibold text-white/72">Editorial claro</p>
                  <p className="store-display mt-3 text-3xl md:text-4xl leading-none">Peças para montar um look memorável.</p>
                  <div className="mt-5 flex flex-wrap gap-3 text-[11px] font-medium text-white/82">
                    <span>{allActive.length} produtos ativos</span>
                    <span>{featured.length} destaques</span>
                    <span>{onSale.length} promoções</span>
                  </div>
                </div>
              </motion.div>

              <div className="grid sm:grid-cols-2 gap-5">
                <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }} className="fashion-panel rounded-[2rem] border border-[#ead9ce] bg-white/85 p-6">
                  <p className="store-kicker text-[10px] font-semibold text-[#9d6d63]">Essência</p>
                  <p className="store-display mt-4 text-3xl leading-none text-[#2d221f]">Vitrine leve, elegante e feita para moda.</p>
                  <p className="mt-3 text-sm leading-relaxed text-[#7d6259]">Tipografia editorial, blocos claros e proporções melhores para destacar roupas e acessórios.</p>
                </motion.div>
                <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }} className="fashion-panel rounded-[2rem] border border-[#ead9ce] bg-[#fff4ec] p-6">
                  <p className="store-kicker text-[10px] font-semibold text-[#9d6d63]">Curadoria</p>
                  <div className="mt-4 space-y-3">
                    {[
                      `${categories.length} categorias organizadas`,
                      `${bestSellers.length} peças em evidência`,
                      "Experiência clara para vender mais",
                    ].map((item) => (
                      <div key={item} className="flex items-center gap-3 text-sm text-[#6b5149]">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: style.accent }} />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── STATS BAR ─────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-4 md:px-8">
        <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { value: allActive.length, label: "Produtos" },
            { value: categories.length, label: "Categorias" },
            { value: featured.length, label: "Destaques" },
            { value: onSale.length, label: "Promoções" },
          ].map((s, i) => (
            <div key={i} className="fashion-panel rounded-[1.75rem] border border-[#ead9ce] bg-white/80 px-5 py-4">
              <span className="store-display text-4xl leading-none" style={{ color: style.accent }}>{s.value}</span>
              <span className="mt-2 block text-[10px] font-semibold uppercase tracking-[0.26em] text-[#8c6c63]">{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── CATEGORIES ────────────────────────────────────────── */}
      {categories.length > 0 && (
        <section id="categorias" className="max-w-7xl mx-auto px-4 md:px-8 py-16">
          <SectionHeader
            title="Estilos & Categorias"
            icon={<Tag size={17} />}
            link={storePath("/catalogo")}
            linkLabel="Ver coleção completa"
            accent={style.accent}
            isFashion
          />
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {categories.slice(0, CATEGORY_DISPLAY_LIMIT).map((cat, i) => {
              const count = allActive.filter(p => p.category_id === cat.id).length;
              return (
                <motion.div key={cat.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                  <Link
                    to={storePath(`/catalogo?cat=${cat.id}`)}
                    className={cn(
                      "group flex flex-col items-center text-center",
                      "fashion-panel gap-3 p-5 border hover:-translate-y-1 hover:shadow-[0_24px_60px_rgba(109,65,56,0.12)]",
                      style.card,
                      style.radius
                    )}
                  >
                    <div style={{ backgroundColor: style.accent + "18" }} className="w-14 h-14 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                      <Tag size={18} style={{ color: style.accent }} />
                    </div>
                    <p className="store-display text-[1.6rem] font-semibold leading-none text-[#2d221f]">{cat.name}</p>
                    <span className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#8c6c63]">{count} {count === 1 ? "produto" : "produtos"}</span>
                  </Link>
                </motion.div>
              );
            })}
          </div>
          {categories.length > CATEGORY_DISPLAY_LIMIT && (
            <div className="mt-5 text-center">
              <Link
                to={storePath("/catalogo")}
                className="inline-flex items-center gap-2 px-6 h-11 rounded-full border border-[#ead9ce] bg-white text-[#6b5149] text-[11px] font-semibold uppercase tracking-[0.24em] hover:bg-[#fff7f1] transition-all"
              >
                +{categories.length - CATEGORY_DISPLAY_LIMIT} mais categorias <ChevronRight size={13} />
              </Link>
            </div>
          )}
        </section>
      )}

      {/* ── FEATURED ──────────────────────────────────────────── */}
      {featured.length > 0 && (
        <section className="py-16">
          <div className="max-w-7xl mx-auto px-4 md:px-8">
            <SectionHeader
              title="Seleção em Destaque"
              icon={<Star size={17} />}
              link={storePath("/catalogo")}
              linkLabel="Ver coleção"
              accent={style.accent}
              isFashion
            />
            <div className="grid lg:grid-cols-[1.08fr_0.92fr] gap-5">
              <Link
                to={storePath(`/produto/${featured[0].id}`)}
                className="fashion-panel group relative overflow-hidden rounded-[2rem] border border-[#ead9ce] min-h-[540px] bg-[#f1e3d8]"
              >
                {getImg(featured[0]) ? (
                  <img src={getImg(featured[0])!} alt={featured[0].name} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
                ) : (
                  <div className="absolute inset-0 bg-[linear-gradient(145deg,#f5e6dc_0%,#fffaf5_100%)]" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-[#2d221f]/72 via-[#2d221f]/18 to-transparent" />
                <div className="absolute left-0 right-0 bottom-0 p-7 md:p-9 text-white">
                  <span className="inline-flex rounded-full border border-white/30 bg-white/10 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.24em] backdrop-blur-sm">
                    Peça destaque
                  </span>
                  <h3 className="store-display mt-5 text-4xl md:text-5xl leading-[0.9]">{featured[0].name}</h3>
                  <div className="mt-4 flex items-end gap-3">
                    <p className="store-display text-4xl md:text-5xl leading-none" style={{ color: style.accent }}>
                      R$ {Number(featured[0].discount_price || featured[0].price).toFixed(2)}
                    </p>
                    {featured[0].discount_price && (
                      <span className="text-sm font-mono text-white/55 line-through">R$ {Number(featured[0].price).toFixed(2)}</span>
                    )}
                  </div>
                </div>
              </Link>
              <div className="grid sm:grid-cols-2 gap-5">
                {featured.slice(1, 5).map((product, i) => (
                  <ProductCard key={product.id} product={product} index={i} slug={slug} style={style} onAddToCart={addToCart} />
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── BEST SELLERS ──────────────────────────────────────── */}
      <section className="py-16 bg-transparent">
        <div className="max-w-7xl mx-auto px-4 md:px-8">
          <SectionHeader
            title="Mais Vendidos"
            icon={<TrendingUp size={17} />}
            link={storePath("/catalogo")}
            linkLabel="Ver coleção"
            accent={style.accent}
            isFashion
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
        <section className="py-16 bg-[#fff6ef]">
          <div className="max-w-7xl mx-auto px-4 md:px-8">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="w-1 h-6 rounded-full bg-red-500" />
                <Zap size={16} className="text-red-500" />
                <h2 className="store-display text-4xl font-semibold tracking-[-0.04em] text-[#2d221f]">Promoções</h2>
                <span className="text-[9px] font-bold px-2 py-0.5 rounded-full border bg-red-50 text-red-500 border-red-200">
                  {onSale.length} oferta{onSale.length !== 1 ? "s" : ""}
                </span>
              </div>
              <Link
                to={storePath("/catalogo")}
                className="flex items-center gap-1 transition-colors text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8c6c63] hover:text-[#2d221f]"
              >
                Ver coleção <ChevronRight size={13} />
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
                        "group flex flex-col border transition-all overflow-hidden",
                        "fashion-soft-shadow hover:-translate-y-1 hover:shadow-[0_26px_70px_rgba(108,64,55,0.12)]",
                        style.card,
                        style.radius
                      )}
                    >
                      <div className="aspect-[4/5] bg-[#f8efe8] overflow-hidden relative">
                        {img
                          ? <img src={img} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                          : <div className="w-full h-full flex items-center justify-center text-slate-200"><Package size={36} strokeWidth={1} /></div>}
                        <span className="absolute top-2 right-2 bg-red-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-full shadow">-{pct}%</span>
                      </div>
                      <div className="p-5">
                        <p className="store-display text-[1.5rem] font-semibold text-[#2d221f] line-clamp-2 leading-[0.95]">{product.name}</p>
                        <div className="flex items-center gap-2 mt-3">
                          <span className="store-display text-[1.8rem] font-semibold text-[#2d221f]">R$ {Number(product.discount_price).toFixed(2)}</span>
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
