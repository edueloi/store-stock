import React, { ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { motion } from "motion/react";
import StoreSEO from "../../../../components/store/StoreSEO";
import {
  ArrowRight, Package, ShoppingBag, Star,
  Zap, TrendingUp, ChevronRight, Cpu, Headphones, Monitor,
  Camera, Smartphone, Wifi, HardDrive, Speaker, Tv, Tag,
  Shield, Truck, Sparkles, BarChart3,
} from "lucide-react";
import { cn } from "../../../../lib/utils";
import { useStore, StoreStyle } from "../../StoreLayout";
import { Category, Product } from "../../../../types";
import { buildStorePath, resolveStoreSlug } from "../../store-routing";
import { productHasStock } from "../../../../utils/productStock";

// ── Icons ─────────────────────────────────────────────────────────────────────

const TECH_ICONS: Record<string, ReactNode> = {
  camera: <Camera size={18} />, câmera: <Camera size={18} />, cameras: <Camera size={18} />,
  receiver: <Speaker size={18} />, receivers: <Speaker size={18} />, áudio: <Headphones size={18} />, audio: <Headphones size={18} />,
  projetor: <Monitor size={18} />, projetores: <Monitor size={18} />,
  fone: <Headphones size={18} />, headphone: <Headphones size={18} />,
  celular: <Smartphone size={18} />, smartphone: <Smartphone size={18} />, telefone: <Smartphone size={18} />,
  tv: <Tv size={18} />, televisão: <Tv size={18} />,
  wifi: <Wifi size={18} />, rede: <Wifi size={18} />, roteador: <Wifi size={18} />,
  hd: <HardDrive size={18} />, ssd: <HardDrive size={18} />, armazenamento: <HardDrive size={18} />,
  notebook: <Monitor size={18} />, laptop: <Monitor size={18} />, computador: <Cpu size={18} />, pc: <Cpu size={18} />,
  gamer: <Monitor size={18} />, console: <Monitor size={18} />, ps5: <Monitor size={18} />, controle: <Headphones size={18} />,
  alexa: <Speaker size={18} />, assistente: <Speaker size={18} />, smart: <Wifi size={18} />, tablet: <Smartphone size={18} />,
};

function getCategoryIcon(name: string) {
  const lower = name.toLowerCase();
  for (const key of Object.keys(TECH_ICONS)) {
    if (lower.includes(key)) return TECH_ICONS[key];
  }
  return <Cpu size={18} />;
}

// ── Section Header ────────────────────────────────────────────────────────────

function SectionHeader({ title, subtitle, link, linkLabel, accent }: {
  title: string; subtitle?: string; link: string; linkLabel?: string; accent: string;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between mb-10">
      <div>
        <p className="store-kicker text-[10px] font-semibold text-[#6f89ad] mb-2">{subtitle || "Seleção especial"}</p>
        <h2 className="store-display text-[2.6rem] md:text-5xl font-semibold tracking-[-0.04em] text-[#071426] leading-[0.92]">{title}</h2>
      </div>
      <Link
        to={link}
        className="shrink-0 inline-flex items-center gap-1.5 rounded-full border border-[#d7e4ff] bg-white/80 px-5 py-2.5 text-[10px] font-semibold tracking-[0.16em] uppercase text-[#4d6990] hover:text-[#071426] hover:border-[#b3caff] hover:bg-white transition-all"
      >
        {linkLabel || "Ver todos"} <ChevronRight size={12} />
      </Link>
    </div>
  );
}

// ── Category Card ─────────────────────────────────────────────────────────────

function TechCategoryCard({ cat, slug, count, accent }: { cat: Category; slug: string; count: number; accent: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -6, transition: { duration: 0.18 } }}
    >
      <Link
        to={buildStorePath(slug, `/catalogo?cat=${cat.id}`)}
        className="group flex flex-col items-center gap-3 p-5 text-center transition-all duration-300 relative overflow-hidden tech-panel tech-card-sheen rounded-[1.8rem] border border-[#d7e4ff] bg-white/90 hover:shadow-[0_20px_60px_rgba(37,99,235,0.14)] hover:border-[#b3caff]"
      >
        {/* Glow orb behind icon */}
        <div
          className="absolute -top-6 -right-6 w-20 h-20 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
          style={{ background: accent + "22" }}
        />
        <div
          className="relative w-11 h-11 flex items-center justify-center rounded-2xl border border-white/80 tech-pulse transition-transform duration-300 group-hover:scale-110"
          style={{ backgroundColor: accent + "14", color: accent }}
        >
          {getCategoryIcon(cat.name)}
        </div>
        <div>
          <p className="store-display text-[1.05rem] font-semibold text-[#071426] leading-tight">{cat.name}</p>
          <span className="store-kicker text-[9px] text-[#7b9ac0] font-medium mt-0.5 block">{count} {count === 1 ? "produto" : "produtos"}</span>
        </div>
      </Link>
    </motion.div>
  );
}

// ── Product Card ──────────────────────────────────────────────────────────────

function ProductCard({ product, index, slug, style, onAddToCart }: {
  product: Product;
  index: number;
  slug: string;
  style: StoreStyle;
  onAddToCart: (product: Product) => void;
}) {
  const img = (Array.isArray(product.images) && (product.images as string[])[0]) || product.image_url || null;
  const hasDiscount = !!product.discount_price;
  const pct = hasDiscount ? Math.round((1 - Number(product.discount_price) / Number(product.price)) * 100) : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.4 }}
    >
      <Link
        to={buildStorePath(slug, `/produto/${product.id}`)}
        className={cn(
          "group flex flex-col border overflow-hidden transition-all duration-300 tech-panel tech-card-sheen bg-white/90 hover:-translate-y-1.5 hover:shadow-[0_24px_60px_rgba(37,99,235,0.16)]",
          style.card,
          style.radius
        )}
      >
        {/* Image */}
        <div className="relative overflow-hidden aspect-square tech-grid bg-[linear-gradient(160deg,#f4f8ff_0%,#edf4ff_100%)]">
          {img
            ? <img src={img} alt={product.name} className="w-full h-full object-cover group-hover:scale-106 transition-transform duration-600" />
            : <div className="w-full h-full flex items-center justify-center"><Package size={36} strokeWidth={1} className="text-[#c5d8f5]" /></div>
          }
          {/* Badges */}
          <div className="absolute top-2.5 left-2.5 flex flex-col gap-1.5">
            {hasDiscount && (
              <span className="text-white text-[9px] font-bold px-2.5 py-1 shadow-md rounded-full bg-gradient-to-r from-[#ef4444] to-[#f97316]">
                -{pct}%
              </span>
            )}
            {product.is_featured && (
              <span
                className="text-[8px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full backdrop-blur-sm flex items-center gap-1"
                style={{ backgroundColor: style.accent + "18", color: style.accent, border: `1px solid ${style.accent}35` }}
              >
                <Star size={7} fill="currentColor" /> Top
              </span>
            )}
          </div>
          {/* Hover overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#071426]/12 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        </div>

        {/* Content */}
        <div className="flex flex-col flex-1 p-4 sm:p-5 gap-2">
          <p className="store-kicker text-[9px] font-semibold text-[#7b9ac0]">{product.category_name || "Tecnologia"}</p>
          <p className="store-display text-[1.12rem] sm:text-[1.3rem] font-semibold text-[#071426] leading-[1.02] line-clamp-2 group-hover:text-[#1d4ed8] transition-colors">
            {product.name}
          </p>
          {product.description && (
            <p className="text-[11px] leading-relaxed line-clamp-2 text-[#6a85a8]">{product.description}</p>
          )}
          <div className="flex items-center justify-between mt-auto pt-3 border-t border-[#e2ecff]">
            <div>
              {hasDiscount ? (
                <div>
                  <span className="text-[10px] line-through text-[#b0c4de] font-mono">R$ {Number(product.price).toFixed(2)}</span>
                  <p className="store-display text-[1.3rem] sm:text-[1.55rem] font-semibold text-[#071426] leading-none">R$ {Number(product.discount_price).toFixed(2)}</p>
                </div>
              ) : (
                <p className="store-display text-[1.3rem] sm:text-[1.55rem] font-semibold leading-none" style={{ color: style.accent }}>
                  R$ {Number(product.price).toFixed(2)}
                </p>
              )}
            </div>
            <button
              onClick={e => { e.preventDefault(); onAddToCart(product); }}
              style={{ backgroundColor: style.accent }}
              className="shrink-0 text-white transition-all active:scale-90 w-10 h-10 rounded-full shadow-[0_12px_24px_rgba(37,99,235,0.28)] hover:shadow-[0_16px_32px_rgba(37,99,235,0.38)] hover:scale-105 flex items-center justify-center"
            >
              <ShoppingBag size={14} />
            </button>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function StoreFront() {
  const { slug: routeSlug } = useParams();
  const { tenant, categories, products, addToCart, style } = useStore();
  const slug = resolveStoreSlug(routeSlug);
  const storePath = (suffix = "") => buildStorePath(slug, suffix);

  const featuredLimit = tenant.featured_limit ?? 5;
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
  const heroProduct = featured[0] || bestSellers[0] || allActive[0];

  return (
    <div className="space-y-0">
      <StoreSEO
        title={`${tenant.name} — Loja Online`}
        description={tenant.about_text || `Bem-vindo à ${tenant.name}. Confira nossos produtos, promoções e novidades.`}
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
        }}
      />

      {/* ═══════════════════════════════════════════════════════════════════════
          HERO
      ═══════════════════════════════════════════════════════════════════════ */}
      <section className="relative overflow-hidden bg-[linear-gradient(160deg,#f0f6ff_0%,#fafcff_50%,#eef4ff_100%)]">

        {/* Ambient orbs */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-[#3b82f6]/8 blur-[80px]" />
          <div className="absolute top-1/3 right-0 w-80 h-80 rounded-full bg-[#6366f1]/7 blur-[80px]" />
          <div className="absolute bottom-0 left-1/3 w-64 h-64 rounded-full bg-[#38bdf8]/8 blur-[60px]" />
        </div>

        {/* Subtle grid */}
        <div className="absolute inset-0 tech-grid opacity-40 pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-4 md:px-8 pt-8 md:pt-14 pb-10 md:pb-16">
          <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-6 items-center">

            {/* ── Left: copy block ────────────────────────────── */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="tech-panel relative overflow-hidden rounded-[2.2rem] border border-[#dbe6ff] bg-white/72 px-7 py-8 sm:px-10 sm:py-10 md:p-14 shadow-[0_2px_40px_rgba(37,99,235,0.07)]">
                {/* Inner ambient */}
                <div className="absolute -top-16 right-8 w-48 h-48 rounded-full bg-[#60a5fa]/12 blur-3xl pointer-events-none" />
                <div className="absolute bottom-0 -left-8 w-40 h-40 rounded-full bg-[#818cf8]/10 blur-3xl pointer-events-none" />

                {/* Kicker */}
                <div className="inline-flex items-center gap-2 rounded-full border border-[#d7e4ff] bg-white/90 px-4 py-1.5 mb-6">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#2563eb] tech-pulse" />
                  <p className="store-kicker text-[9px] font-semibold text-[#4d6990] tracking-[0.22em]">{categories[0]?.name ?? tenant.name}</p>
                </div>

                {/* Headline */}
                <h1 className="store-display text-[3.4rem] sm:text-6xl md:text-7xl lg:text-[5.5rem] leading-[0.88] text-[#071426] tracking-[-0.02em]">
                  {tenant.name}
                </h1>

                {/* Body */}
                <p className="mt-6 max-w-lg text-[14px] sm:text-base md:text-[17px] leading-relaxed text-[#4e6c8e]">
                  {tenant.about_text || "Os melhores produtos com os melhores preços. Atendimento rápido via WhatsApp e experiência de compra segura."}
                </p>

                {/* CTAs */}
                <div className="mt-8 flex flex-col sm:flex-row gap-3">
                  <Link
                    to={storePath("/catalogo")}
                    style={{ backgroundColor: style.accent }}
                    className="inline-flex w-full sm:w-auto justify-center h-13 items-center gap-2 rounded-full px-8 text-[11px] font-semibold uppercase tracking-[0.2em] text-white shadow-[0_16px_40px_rgba(37,99,235,0.28)] hover:shadow-[0_20px_50px_rgba(37,99,235,0.38)] transition-all hover:-translate-y-0.5 active:scale-95"
                  >
                    <ShoppingBag size={14} /> Explorar catálogo
                  </Link>
                  <a
                    href="#categorias"
                    className="inline-flex w-full sm:w-auto justify-center h-13 items-center gap-2 rounded-full border border-[#d7e4ff] bg-white/80 px-8 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#4d6990] hover:bg-white hover:border-[#b3caff] transition-all"
                  >
                    Ver linhas <ArrowRight size={13} />
                  </a>
                </div>

                {/* Category pills */}
                {categories.length > 0 && (
                  <div className="mt-8 flex flex-wrap gap-2">
                    {categories.slice(0, 5).map(cat => (
                      <Link
                        key={cat.id}
                        to={storePath(`/catalogo?cat=${cat.id}`)}
                        className="rounded-full border border-[#dbe6ff] bg-white/80 px-4 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#5b7898] hover:border-[#b3caff] hover:text-[#2563eb] transition-all"
                      >
                        {cat.name}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>

            {/* ── Right: image + floating cards ───────────────── */}
            <div className="flex flex-col gap-5">
              <motion.div
                initial={{ opacity: 0, scale: 0.97, y: 16 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.65, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
                className="tech-panel tech-scan relative min-h-[340px] sm:min-h-[440px] overflow-hidden rounded-[2.2rem] border border-[#dbe6ff] bg-[linear-gradient(145deg,#edf5ff_0%,#f9fdff_100%)] shadow-[0_4px_40px_rgba(37,99,235,0.09)]"
              >
                {heroImage ? (
                  <img src={heroImage} alt={tenant.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="absolute inset-0 tech-grid" />
                )}
                {/* Dark gradient overlay */}
                <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(3,12,28,0.01)_0%,rgba(3,12,28,0.05)_40%,rgba(3,12,28,0.65)_100%)]" />

                {/* Floating badge */}
                <div className="tech-float absolute top-4 right-4 rounded-full border border-white/50 bg-white/80 backdrop-blur-md px-4 py-2 shadow-lg">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#2563eb]">{featured[0]?.name ?? tenant.name}</p>
                </div>

                {/* Bottom info */}
                <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8 text-white">
                  <p className="store-kicker text-[9px] font-semibold text-white/65">{categories.slice(0, 3).map(c => c.name).join(" · ") || tenant.name}</p>
                  <p className="store-display mt-2 text-2xl md:text-3xl leading-[0.95]">
                    {featured[0]?.name ?? tenant.name}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-4 text-[11px] font-medium text-white/70">
                    <span className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />{allActive.length} itens ativos
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />{featured.length} destaques
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-400" />{onSale.length} ofertas
                    </span>
                  </div>
                </div>
              </motion.div>

              {/* Stats row */}
              <div className="grid grid-cols-3 gap-4">
                {[
                  { value: allActive.length, label: "Produtos", icon: <Package size={14} /> },
                  { value: featured.length, label: "Destaques", icon: <Star size={14} /> },
                  { value: onSale.length, label: "Promoções", icon: <Zap size={14} /> },
                ].map((s, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.18 + i * 0.06 }}
                    className="tech-panel rounded-[1.6rem] border border-[#dbe6ff] bg-white/90 p-4 text-center shadow-[0_2px_16px_rgba(37,99,235,0.07)]"
                  >
                    <span className="store-display text-[2rem] leading-none font-semibold" style={{ color: style.accent }}>{s.value}</span>
                    <span className="store-kicker mt-1.5 block text-[9px] font-semibold text-[#7b9ac0]">{s.label}</span>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          TRUST BAR
      ═══════════════════════════════════════════════════════════════════════ */}
      <div className="bg-white/70 border-y border-[#e8efff]">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: <Shield size={16} />, label: "Compra segura" },
              { icon: <Truck size={16} />, label: "Entrega ágil" },
              { icon: <Sparkles size={16} />, label: "Produtos premium" },
              { icon: <BarChart3 size={16} />, label: "Melhores preços" },
            ].map((item, i) => (
              <div key={i} className="flex items-center justify-center gap-2.5 text-[11px] font-semibold text-[#4e6c8e]">
                <span className="tech-pulse w-8 h-8 flex items-center justify-center rounded-xl border border-[#dbe6ff] bg-white" style={{ color: style.accent }}>
                  {item.icon}
                </span>
                {item.label}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          CATEGORIES
      ═══════════════════════════════════════════════════════════════════════ */}
      {categories.length > 0 && (
        <section id="categorias" className="max-w-7xl mx-auto px-4 md:px-8 py-16 md:py-20">
          <SectionHeader
            title="Linhas & Categorias"
            subtitle="Explore por segmento"
            link={storePath("/catalogo")}
            linkLabel="Ver catálogo completo"
            accent={style.accent}
          />
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 md:gap-4">
            {categories.slice(0, CATEGORY_DISPLAY_LIMIT).map(cat => {
              const count = allActive.filter(p => p.category_id === cat.id).length;
              return <TechCategoryCard key={cat.id} cat={cat} slug={slug} count={count} accent={style.accent} />;
            })}
          </div>
          {categories.length > CATEGORY_DISPLAY_LIMIT && (
            <div className="mt-6 text-center">
              <Link
                to={storePath("/catalogo")}
                className="inline-flex items-center gap-2 px-7 h-11 rounded-full border border-[#dbe6ff] bg-white text-[11px] font-semibold uppercase tracking-[0.2em] text-[#4d6990] hover:bg-[#f4f8ff] hover:border-[#b3caff] transition-all"
              >
                +{categories.length - CATEGORY_DISPLAY_LIMIT} categorias <ChevronRight size={12} />
              </Link>
            </div>
          )}
        </section>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          FEATURED — hero product + grid
      ═══════════════════════════════════════════════════════════════════════ */}
      {featured.length > 0 && (
        <section className="py-16 md:py-20 bg-[linear-gradient(180deg,#fafcff_0%,#f0f6ff_100%)]">
          <div className="max-w-7xl mx-auto px-4 md:px-8">
            <SectionHeader
              title="Seleção em Destaque"
              subtitle="Os melhores da vitrine"
              link={storePath("/catalogo")}
              linkLabel="Ver vitrine completa"
              accent={style.accent}
            />
            <div className="grid lg:grid-cols-[1.15fr_0.85fr] gap-5">
              {/* Hero featured product */}
              <Link
                to={storePath(`/produto/${featured[0].id}`)}
                className="tech-panel tech-card-sheen group relative overflow-hidden rounded-[2.2rem] border border-[#dbe6ff] min-h-[480px] md:min-h-[560px] bg-[linear-gradient(145deg,#f0f6ff_0%,#fafcff_100%)] shadow-[0_4px_40px_rgba(37,99,235,0.09)] hover:shadow-[0_8px_60px_rgba(37,99,235,0.18)] transition-all duration-500"
              >
                {getImg(featured[0]) ? (
                  <img
                    src={getImg(featured[0])!}
                    alt={featured[0].name}
                    className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                ) : (
                  <div className="absolute inset-0 tech-grid" />
                )}
                <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(7,20,38,0.02)_0%,rgba(7,20,38,0.06)_35%,rgba(7,20,38,0.84)_100%)]" />

                {/* Top badges */}
                <div className="absolute top-5 left-5 flex flex-wrap gap-2">
                  <span className="rounded-full border border-white/30 bg-white/15 backdrop-blur-md px-4 py-1.5 text-[9px] font-semibold uppercase tracking-[0.2em] text-white/90">
                    Produto vitrine
                  </span>
                  {featured[0].discount_price && (
                    <span className="rounded-full bg-gradient-to-r from-[#ef4444] to-[#f97316] px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.16em] text-white shadow-lg">
                      Oferta especial
                    </span>
                  )}
                </div>

                {/* Bottom info */}
                <div className="absolute left-0 right-0 bottom-0 p-7 md:p-10 text-white">
                  <p className="store-kicker text-[9px] font-semibold text-white/65">{featured[0].category_name || "Tecnologia"}</p>
                  <h3 className="store-display mt-3 text-4xl md:text-[3.2rem] leading-[0.9]">{featured[0].name}</h3>
                  {featured[0].description && (
                    <p className="mt-3 max-w-md text-sm leading-relaxed text-white/72 line-clamp-2">{featured[0].description}</p>
                  )}
                  <div className="mt-5 flex items-center gap-4">
                    <p className="store-display text-[3rem] md:text-[3.5rem] leading-none">
                      R$ {Number(featured[0].discount_price || featured[0].price).toFixed(2)}
                    </p>
                    {featured[0].discount_price && (
                      <span className="text-sm font-mono text-white/50 line-through">R$ {Number(featured[0].price).toFixed(2)}</span>
                    )}
                  </div>
                  <div
                    className="mt-5 inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-white border border-white/25 bg-white/15 backdrop-blur-sm group-hover:bg-white/25 transition-all"
                  >
                    Ver produto <ArrowRight size={12} />
                  </div>
                </div>
              </Link>

              {/* Secondary featured grid */}
              <div className="grid sm:grid-cols-2 gap-4 content-start items-start">
                {featured.slice(1, 5).map((product, i) => (
                  <ProductCard key={product.id} product={product} index={i} slug={slug} style={style} onAddToCart={addToCart} />
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          BEST SELLERS
      ═══════════════════════════════════════════════════════════════════════ */}
      <section className="py-16 md:py-20">
        <div className="max-w-7xl mx-auto px-4 md:px-8">
          <SectionHeader
            title="Mais Vendidos"
            subtitle="Os favoritos da loja"
            link={storePath("/catalogo")}
            linkLabel="Ver catálogo"
            accent={style.accent}
          />
          {bestSellers.length === 0 ? (
            <div className="py-20 text-center text-[#a0b8d4]">
              <Package size={44} strokeWidth={1} className="mx-auto mb-4 opacity-40" />
              <p className="text-xs font-semibold uppercase tracking-wider">Nenhum produto disponível</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-5">
              {bestSellers.map((product, i) => (
                <ProductCard key={product.id} product={product} index={i} slug={slug} style={style} onAddToCart={addToCart} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          ON SALE
      ═══════════════════════════════════════════════════════════════════════ */}
      {onSale.length > 0 && (
        <section className="py-16 md:py-20 bg-[linear-gradient(160deg,#fff7f7_0%,#fafcff_50%,#f0f6ff_100%)]">
          <div className="max-w-7xl mx-auto px-4 md:px-8">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between mb-10">
              <div>
                <p className="store-kicker text-[10px] font-semibold text-red-400 mb-2">Ofertas ativas agora</p>
                <div className="flex items-center gap-3">
                  <h2 className="store-display text-[2.6rem] md:text-5xl font-semibold tracking-[-0.04em] text-[#071426] leading-[0.92]">Promoções</h2>
                  <span className="text-[9px] font-bold px-2.5 py-1 rounded-full border bg-red-50 text-red-500 border-red-200">
                    {onSale.length} oferta{onSale.length !== 1 ? "s" : ""}
                  </span>
                </div>
              </div>
              <Link
                to={storePath("/catalogo")}
                className="shrink-0 inline-flex items-center gap-1.5 rounded-full border border-[#d7e4ff] bg-white/80 px-5 py-2.5 text-[10px] font-semibold tracking-[0.16em] uppercase text-[#4d6990] hover:text-[#071426] hover:border-[#b3caff] hover:bg-white transition-all"
              >
                Ver todas <ChevronRight size={12} />
              </Link>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-5">
              {onSale.slice(0, 4).map((product, i) => {
                const pct = Math.round((1 - Number(product.discount_price) / Number(product.price)) * 100);
                const img = getImg(product);
                return (
                  <motion.div
                    key={product.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.06 }}
                    className="h-full"
                  >
                    <Link
                      to={storePath(`/produto/${product.id}`)}
                      className={cn(
                        "group flex flex-col h-full border overflow-hidden transition-all duration-300 tech-panel tech-card-sheen bg-white/90 hover:-translate-y-1.5 hover:shadow-[0_24px_60px_rgba(37,99,235,0.15)]",
                        style.card,
                        style.radius
                      )}
                    >
                      <div className="relative aspect-square overflow-hidden tech-grid bg-[linear-gradient(160deg,#f4f8ff_0%,#edf4ff_100%)]">
                        {img
                          ? <img src={img} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                          : <div className="w-full h-full flex items-center justify-center"><Package size={36} strokeWidth={1} className="text-[#c5d8f5]" /></div>
                        }
                        <span className="absolute top-2.5 right-2.5 bg-gradient-to-r from-[#ef4444] to-[#f97316] text-white text-[9px] font-bold px-2.5 py-1 rounded-full shadow-md">
                          -{pct}%
                        </span>
                      </div>
                      <div className="flex flex-col flex-1 p-4 gap-2">
                        <p className="store-display text-[1.1rem] sm:text-[1.25rem] font-semibold text-[#071426] line-clamp-2 leading-[1.02] group-hover:text-[#1d4ed8] transition-colors">
                          {product.name}
                        </p>
                        <div className="flex items-center gap-2 mt-auto pt-2 border-t border-[#e2ecff]">
                          <span className="store-display text-[1.3rem] sm:text-[1.5rem] font-semibold text-[#071426]">
                            R$ {Number(product.discount_price).toFixed(2)}
                          </span>
                          <span className="text-[10px] text-[#b0c4de] line-through font-mono">
                            R$ {Number(product.price).toFixed(2)}
                          </span>
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

      {/* ═══════════════════════════════════════════════════════════════════════
          CTA BANNER
      ═══════════════════════════════════════════════════════════════════════ */}
      <section className="py-16 md:py-20">
        <div className="max-w-7xl mx-auto px-4 md:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="tech-panel relative overflow-hidden rounded-[2.2rem] border border-[#dbe6ff] bg-[linear-gradient(135deg,#eff6ff_0%,#eef4ff_50%,#f0f6ff_100%)] px-8 py-12 md:px-16 md:py-16 text-center shadow-[0_4px_40px_rgba(37,99,235,0.09)]"
          >
            {/* Orbs */}
            <div className="pointer-events-none absolute -top-10 left-1/4 w-56 h-56 rounded-full bg-[#3b82f6]/10 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-10 right-1/4 w-56 h-56 rounded-full bg-[#6366f1]/10 blur-3xl" />

            <div className="relative">
              <p className="store-kicker text-[10px] font-semibold text-[#6f89ad] mb-4">Pronto para começar?</p>
              <h2 className="store-display text-[2.4rem] sm:text-5xl md:text-6xl leading-[0.9] text-[#071426] mb-4">
                Encontre o produto ideal
              </h2>
              <p className="max-w-lg mx-auto text-[14px] md:text-base text-[#4e6c8e] leading-relaxed mb-8">
                Navegue pelo catálogo completo, filtre por categoria e descubra os melhores produtos com os melhores preços.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link
                  to={storePath("/catalogo")}
                  style={{ backgroundColor: style.accent }}
                  className="inline-flex items-center justify-center gap-2 h-13 px-10 rounded-full text-[11px] font-semibold uppercase tracking-[0.2em] text-white shadow-[0_16px_40px_rgba(37,99,235,0.28)] hover:shadow-[0_20px_50px_rgba(37,99,235,0.38)] hover:-translate-y-0.5 transition-all"
                >
                  <ShoppingBag size={14} /> Ver catálogo completo
                </Link>
                {tenant.whatsapp && (
                  <a
                    href={`https://wa.me/${tenant.whatsapp.replace(/\D/g, "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 h-13 px-8 rounded-full border border-[#d7e4ff] bg-white text-[11px] font-semibold uppercase tracking-[0.18em] text-[#4d6990] hover:bg-[#f4f8ff] hover:border-[#b3caff] transition-all"
                  >
                    Falar conosco
                  </a>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      </section>

    </div>
  );
}
