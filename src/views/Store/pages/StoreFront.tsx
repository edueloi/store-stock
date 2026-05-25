import React, { ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { motion } from "motion/react";
import StoreSEO from "../../../components/store/StoreSEO";
import {
  ArrowRight, Package, ShoppingBag, Star,
  Zap, TrendingUp, ChevronRight, Cpu, Headphones, Monitor,
  Camera, Smartphone, Wifi, HardDrive, Speaker, Tv, Tag,
} from "lucide-react";
import { cn } from "../../../lib/utils";
import { useStore, StoreStyle } from "../StoreLayout";
import { Category, Product } from "../../../types";
import { buildStorePath, resolveStoreSlug } from "../store-routing";

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
  gamer: <Monitor size={20} />, console: <Monitor size={20} />, ps5: <Monitor size={20} />, controle: <Headphones size={20} />,
  alexa: <Speaker size={20} />, assistente: <Speaker size={20} />, smart: <Wifi size={20} />, tablet: <Smartphone size={20} />,
};

function getCategoryIcon(name: string) {
  const lower = name.toLowerCase();
  for (const key of Object.keys(TECH_ICONS)) {
    if (lower.includes(key)) return TECH_ICONS[key];
  }
  return <Cpu size={20} />;
}

function TechCategoryCard({ cat, slug, count, accent, isTechNova = false }: { cat: Category; slug: string; count: number; accent: string; isTechNova?: boolean; key?: React.Key }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} whileHover={{ y: -4, transition: { duration: 0.18 } }}>
      <Link
        to={buildStorePath(slug, `/catalogo?cat=${cat.id}`)}
        className={cn(
          "group flex flex-col items-center gap-3 p-5 text-center transition-all duration-300 relative overflow-hidden",
          isTechNova
            ? "tech-panel tech-card-sheen rounded-[1.7rem] border border-[#d9e6ff] bg-white/82 hover:-translate-y-1 hover:shadow-[0_26px_70px_rgba(52,102,194,0.18)]"
            : "bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-lg"
        )}
      >
        <div
          className={cn(
            "w-12 h-12 flex items-center justify-center transition-transform duration-300 group-hover:scale-110",
            isTechNova ? "rounded-2xl border border-white/80 tech-pulse" : "rounded-xl"
          )}
          style={{ backgroundColor: accent + (isTechNova ? "16" : "12"), color: accent }}
        >
          {getCategoryIcon(cat.name)}
        </div>
        <div>
          <p className={cn(isTechNova ? "store-display text-[1.15rem] font-semibold text-[#071426] leading-none" : "text-[12px] font-bold text-slate-800 leading-tight tracking-tight")}>{cat.name}</p>
          <span className={cn("font-medium mt-0.5 block", isTechNova ? "store-kicker text-[9px] text-[#6f89ad]" : "text-[10px] text-slate-400")}>{count} {count === 1 ? "produto" : "produtos"}</span>
        </div>
        <div
          className={cn("absolute inset-x-0 bottom-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300", isTechNova ? "h-12 blur-2xl" : "h-0.5")}
          style={{ background: isTechNova ? `radial-gradient(circle, ${accent}55 0%, transparent 70%)` : `linear-gradient(90deg, transparent, ${accent}, transparent)` }}
        />
      </Link>
    </motion.div>
  );
}

function SectionHeader({ title, icon, link, linkLabel, accent, isDark, isFashion = false, isTechNova = false }: {
  title: string; icon?: ReactNode; link: string; linkLabel?: string; accent: string; isDark: boolean; isFashion?: boolean; isTechNova?: boolean;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-8">
      <div className="flex items-center gap-3">
        <div className="w-1 h-6 rounded-full" style={{ backgroundColor: accent }} />
        {icon && <span style={{ color: accent }}>{icon}</span>}
        <h2 className={cn(
          isFashion || isTechNova ? "store-display text-[2.35rem] md:text-5xl font-semibold tracking-[-0.04em]" : "text-2xl font-bold tracking-tight",
          isDark ? "text-white" : isFashion ? "text-[#2d221f]" : isTechNova ? "text-[#071426]" : "text-slate-900"
        )}>{title}</h2>
      </div>
      <Link
        to={link}
        className={cn(
          "flex items-center gap-1 transition-colors",
          isFashion
            ? "text-[11px] font-semibold tracking-[0.22em] uppercase text-[#8c6c63] hover:text-[#2d221f]"
            : isTechNova
              ? "rounded-full border border-[#d7e4ff] bg-white/70 px-4 py-2 text-[10px] font-semibold tracking-[0.18em] uppercase text-[#5b789e] hover:text-[#071426] hover:border-[#bfd2ff]"
            : "text-[11px] font-semibold uppercase tracking-wider",
          isDark ? "text-slate-400 hover:text-white" : !isFashion && !isTechNova && "text-slate-400 hover:text-slate-700"
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
  const isFashion = style.font === "font-editorial";
  const isTechNova = style.font === "font-tech";

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.04 }}>
      <Link
        to={buildStorePath(slug, `/produto/${product.id}`)}
        className={cn(
          "group flex flex-col border overflow-hidden transition-all",
          isFashion
            ? "fashion-soft-shadow hover:-translate-y-1 hover:shadow-[0_26px_70px_rgba(108,64,55,0.12)]"
            : isTechNova
              ? "tech-soft-shadow tech-card-sheen bg-white/84 hover:-translate-y-1 hover:shadow-[0_28px_70px_rgba(42,94,188,0.18)]"
              : "hover:shadow-xl",
          style.card,
          style.radius
        )}
      >
        <div className={cn("overflow-hidden relative", isFashion ? "aspect-[4/5] bg-[#f8efe8]" : isTechNova ? "aspect-square tech-grid bg-[linear-gradient(180deg,#f8fbff_0%,#edf4ff_100%)]" : "aspect-square bg-slate-50")}>
          {img
            ? <img src={img} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
            : <div className="w-full h-full flex items-center justify-center text-slate-200"><Package size={36} strokeWidth={1} /></div>}
          {hasDiscount && (
            <span className={cn("absolute top-2 right-2 text-white text-[9px] font-bold px-2 py-0.5 shadow rounded-full", isTechNova ? "bg-[#ff5f6d]" : "bg-red-500")}>
              -{pct}%
            </span>
          )}
          {product.is_featured && (
            <span
              className={cn("absolute top-2 left-2 text-[8px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full", isTechNova && "backdrop-blur-sm")}
              style={{ backgroundColor: style.accent + (isTechNova ? "18" : "20"), color: style.accent, border: `1px solid ${style.accent}40` }}
            >
              <Star size={7} className="inline -mt-0.5 mr-0.5" fill="currentColor" />Top
            </span>
          )}
          {isTechNova && (
            <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#071426]/30 to-transparent" />
          )}
        </div>
        <div className={cn("flex flex-col", isFashion ? "p-4 sm:p-5 gap-2" : isTechNova ? "p-4 sm:p-5 gap-2" : "p-4 gap-1")}>
          <p className={cn("font-semibold", isFashion ? "store-kicker text-[9px] text-[#9c7b72]" : isTechNova ? "store-kicker text-[9px] text-[#6684ab]" : "text-[10px] text-slate-400 uppercase tracking-widest")}>{product.category_name || "Geral"}</p>
          <p className={cn(
            "line-clamp-2 transition-colors",
            isFashion
              ? "store-display text-[1.28rem] sm:text-[1.55rem] font-semibold text-[#2d221f] leading-[0.95]"
              : isTechNova
                ? "store-display text-[1.15rem] sm:text-[1.4rem] font-semibold text-[#071426] leading-[1.02] group-hover:text-[#1e57b7]"
              : "text-sm font-semibold text-slate-800 leading-snug group-hover:text-slate-900"
          )}>{product.name}</p>
          {(isFashion || isTechNova) && product.description && (
            <p className={cn("text-[11px] sm:text-[12px] leading-relaxed line-clamp-2", isFashion ? "text-[#8c6c63]" : "text-[#607b9d]")}>{product.description}</p>
          )}
          <div className={cn("flex items-center justify-between mt-2", isFashion ? "pt-3 border-t border-[#eee2d6]" : isTechNova ? "pt-3 border-t border-[#dbe6ff]" : "")}>
            {hasDiscount ? (
              <div>
                <span className="text-[10px] line-through text-slate-400 font-mono">R$ {Number(product.price).toFixed(2)}</span>
                <p className={cn(isFashion ? "store-display text-[1.45rem] sm:text-[1.8rem] font-semibold text-[#2d221f] leading-none" : isTechNova ? "store-display text-[1.35rem] sm:text-[1.65rem] font-semibold text-[#071426] leading-none" : "text-base font-bold text-emerald-600 font-mono leading-tight")}>R$ {Number(product.discount_price).toFixed(2)}</p>
              </div>
            ) : (
              <p className={cn(isFashion ? "store-display text-[1.45rem] sm:text-[1.8rem] font-semibold leading-none" : isTechNova ? "store-display text-[1.35rem] sm:text-[1.65rem] font-semibold leading-none" : "text-base font-bold font-mono")} style={{ color: style.accent }}>R$ {Number(product.price).toFixed(2)}</p>
            )}
            <button
              onClick={e => { e.preventDefault(); onAddToCart(product); }}
              style={{ backgroundColor: style.accent }}
              className={cn(
                "shrink-0 text-white transition-all active:scale-90",
                isFashion
                  ? "w-10 h-10 sm:w-auto sm:px-4 rounded-full shadow-sm hover:shadow-md text-[10px] font-semibold uppercase tracking-[0.18em] sm:tracking-[0.24em] flex items-center justify-center gap-2"
                  : isTechNova
                    ? "min-w-[44px] h-11 px-4 rounded-full shadow-[0_16px_30px_rgba(37,99,235,0.22)] hover:shadow-[0_18px_34px_rgba(37,99,235,0.3)] text-[10px] font-semibold uppercase tracking-[0.16em] flex items-center justify-center gap-2"
                  : "w-9 h-9 flex items-center justify-center shadow-sm hover:shadow-md",
                style.radius
              )}
            >
              {isFashion || isTechNova ? <><ShoppingBag size={13} /><span className={cn(isTechNova && "hidden sm:inline")}>Adicionar</span></> : <span className="text-lg font-bold leading-none">+</span>}
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

  const isTechNova = tenant.template_id === "nexus_tech";
  const isTech = tenant.template_id === "tech" || isTechNova;
  const isFashion = tenant.template_id === "atelier";
  const isDark = ["cyber", "luxury"].includes(tenant.template_id || "");

  const getImg = (p: Product) =>
    (Array.isArray(p.images) && (p.images as string[])[0]) || p.image_url || null;
  const heroImage = tenant.banner_url || getImg(featured[0]) || getImg(bestSellers[0]) || getImg(allActive[0]);

  return (
    <div className="space-y-0">
      <StoreSEO
        title={tenant.name}
        description={tenant.about_text || `Bem-vindo à loja ${tenant.name}. Confira nossos produtos e promoções.`}
        image={tenant.banner_url || tenant.logo_url}
        url={typeof window !== "undefined" ? window.location.href : ""}
        siteName={tenant.name}
      />

      {/* ── HERO ──────────────────────────────────────────────── */}
      {isTechNova ? (
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 tech-grid opacity-50 pointer-events-none" />
          <div className="max-w-7xl mx-auto px-4 md:px-8 pt-6 md:pt-10 pb-6 md:pb-10 relative">
            <div className="grid lg:grid-cols-[1.05fr_0.95fr] gap-5 items-stretch">
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.55 }}
                className="tech-panel relative overflow-hidden rounded-[2rem] border border-[#dbe6ff] bg-[linear-gradient(135deg,#fdfefe_0%,#f3f8ff_42%,#eef4ff_100%)] px-6 py-7 sm:px-8 sm:py-9 md:p-12"
              >
                <div className="absolute -top-12 right-10 h-40 w-40 rounded-full bg-[#60a5fa]/18 blur-3xl" />
                <div className="absolute bottom-0 left-0 h-28 w-28 rounded-full bg-[#38bdf8]/16 blur-3xl" />
                <p className="store-kicker text-[10px] font-semibold text-[#6180aa]">Tecnologia de alta procura</p>
                <h1 className="store-display mt-4 text-[3rem] sm:text-6xl md:text-7xl lg:text-[5.3rem] leading-[0.9] text-[#071426]">
                  {tenant.name}
                </h1>
                <p className="mt-5 max-w-2xl text-[15px] sm:text-base md:text-lg leading-relaxed text-[#577395]">
                  {tenant.about_text || "Eletrônicos, informática, games e casa inteligente apresentados em uma vitrine clara, moderna e preparada para converter."}
                </p>
                <div className="mt-7 flex flex-col sm:flex-row gap-3">
                  <Link
                    to={storePath("/catalogo")}
                    style={{ backgroundColor: style.accent }}
                    className="inline-flex w-full sm:w-auto justify-center h-12 items-center gap-2 rounded-full px-6 sm:px-7 text-[11px] font-semibold uppercase tracking-[0.2em] text-white shadow-[0_20px_44px_rgba(37,99,235,0.24)] transition-all hover:-translate-y-0.5"
                  >
                    <ShoppingBag size={15} /> Explorar catálogo
                  </Link>
                  <a
                    href="#categorias"
                    className="inline-flex w-full sm:w-auto justify-center h-12 items-center gap-2 rounded-full border border-[#d7e4ff] bg-white/80 px-6 sm:px-7 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#4d6990] transition-all hover:bg-white"
                  >
                    Ver linhas <ArrowRight size={13} />
                  </a>
                </div>
                <div className="mt-8 flex flex-wrap gap-2">
                  {(categories.slice(0, 4).map(cat => cat.name).length > 0
                    ? categories.slice(0, 4).map(cat => cat.name)
                    : ["Notebooks", "Celulares", "Games", "Casa inteligente"]).map((label) => (
                    <span key={label} className="rounded-full border border-[#d7e4ff] bg-white/74 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#6883a9]">
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
                  className="tech-panel tech-scan relative min-h-[320px] sm:min-h-[420px] overflow-hidden rounded-[2rem] border border-[#dbe6ff] bg-[linear-gradient(140deg,#edf5ff_0%,#f9fcff_100%)]"
                >
                  {heroImage ? (
                    <img src={heroImage} alt={tenant.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="absolute inset-0 tech-grid bg-[linear-gradient(145deg,#eff6ff_0%,#f8fbff_100%)]" />
                  )}
                  <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(3,12,28,0.02)_0%,rgba(3,12,28,0.08)_45%,rgba(3,12,28,0.72)_100%)]" />
                  <div className="absolute top-4 right-4 rounded-full border border-white/60 bg-white/78 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#426285] backdrop-blur-md tech-float">
                    Setup em destaque
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8 text-white">
                    <p className="store-kicker text-[10px] font-semibold text-white/72">Performance & conectividade</p>
                    <p className="store-display mt-3 text-3xl md:text-4xl leading-[0.95]">Produtos para vender do celular ao setup completo.</p>
                    <div className="mt-5 flex flex-wrap gap-3 text-[11px] font-medium text-white/82">
                      <span>{allActive.length} itens ativos</span>
                      <span>{featured.length} destaques</span>
                      <span>{onSale.length} ofertas no ar</span>
                    </div>
                  </div>
                </motion.div>

                <div className="grid sm:grid-cols-2 gap-5">
                  <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }} className="tech-panel tech-float rounded-[2rem] border border-[#dbe6ff] bg-white/82 p-6">
                    <p className="store-kicker text-[10px] font-semibold text-[#6f89ad]">Curadoria</p>
                    <p className="store-display mt-4 text-[2rem] sm:text-[2.2rem] leading-[0.92] text-[#071426]">Linha visual criada para eletrônicos e produtos de alto giro.</p>
                    <p className="mt-3 text-sm leading-relaxed text-[#6883a8]">Blocos claros, brilho sutil, tipografia forte e foco total em leitura rápida, preço e confiança.</p>
                  </motion.div>
                  <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }} className="tech-panel rounded-[2rem] border border-[#dbe6ff] bg-[linear-gradient(160deg,#ffffff_0%,#f3f8ff_100%)] p-6">
                    <p className="store-kicker text-[10px] font-semibold text-[#6f89ad]">Pronto para venda</p>
                    <div className="mt-4 space-y-3">
                      {[
                        `${categories.length} categorias organizadas`,
                        `${bestSellers.length} produtos em evidência`,
                        "Visual ideal para informática, games e smart home",
                      ].map((item) => (
                        <div key={item} className="flex items-center gap-3 text-sm text-[#587495]">
                          <span className="h-2.5 w-2.5 rounded-full shadow-[0_0_0_6px_rgba(37,99,235,0.08)]" style={{ backgroundColor: style.accent }} />
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
      ) : isFashion ? (
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
      ) : tenant.banner_url ? (
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
      <div className={cn(
        isFashion ? "max-w-7xl mx-auto px-4 md:px-8" : "border-b",
        isDark ? "bg-slate-950 border-slate-800" : isTechNova ? "bg-transparent border-transparent" : !isFashion && "bg-white border-slate-100"
      )}>
        <div className={cn(
          "max-w-7xl mx-auto",
          isFashion ? "grid grid-cols-2 md:grid-cols-4 gap-4" : isTechNova ? "grid grid-cols-2 md:grid-cols-4 gap-4 px-4 md:px-8 pb-6" : "px-8 py-4 flex flex-wrap items-center gap-8 md:gap-14"
        )}>
          {[
            { value: allActive.length, label: "Produtos" },
            { value: categories.length, label: "Categorias" },
            { value: featured.length, label: "Destaques" },
            { value: onSale.length, label: "Promoções" },
          ].map((s, i) => (
            <div key={i} className={cn(
              isFashion
                ? "fashion-panel rounded-[1.75rem] border border-[#ead9ce] bg-white/80 px-5 py-4"
                : isTechNova
                  ? "tech-panel rounded-[1.7rem] border border-[#dbe6ff] bg-white/82 px-5 py-5"
                  : "flex items-baseline gap-2"
            )}>
              <span className={cn(isFashion || isTechNova ? "store-display text-4xl leading-none" : "text-2xl font-extrabold tabular-nums")} style={{ color: style.accent }}>{s.value}</span>
              <span className={cn(isFashion ? "mt-2 block text-[10px] font-semibold uppercase tracking-[0.26em] text-[#8c6c63]" : isTechNova ? "mt-2 block store-kicker text-[9px] font-semibold text-[#6b87ad]" : "text-[10px] font-semibold text-slate-400 uppercase tracking-widest")}>{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── CATEGORIES ────────────────────────────────────────── */}
      {categories.length > 0 && (
        <section id="categorias" className="max-w-7xl mx-auto px-4 md:px-8 py-16">
          <SectionHeader
            title={isFashion ? "Estilos & Categorias" : "Categorias"}
            icon={<Tag size={17} />}
            link={storePath("/catalogo")}
            linkLabel={isFashion ? "Ver coleção completa" : "Ver catálogo"}
            accent={style.accent}
            isDark={isDark}
            isFashion={isFashion}
            isTechNova={isTechNova}
          />
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {categories.slice(0, CATEGORY_DISPLAY_LIMIT).map((cat, i) => {
              const count = allActive.filter(p => p.category_id === cat.id).length;
              if (isTech) {
                return <TechCategoryCard key={cat.id} cat={cat} slug={slug} count={count} accent={style.accent} isTechNova={isTechNova} />;
              }
              return (
                <motion.div key={cat.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                  <Link
                    to={storePath(`/catalogo?cat=${cat.id}`)}
                    className={cn(
                      "group flex flex-col items-center text-center",
                      isFashion
                        ? "fashion-panel gap-3 p-5 border hover:-translate-y-1 hover:shadow-[0_24px_60px_rgba(109,65,56,0.12)]"
                        : "gap-2 p-4 border hover:shadow-md",
                      style.card,
                      style.radius
                    )}
                  >
                    <div style={{ backgroundColor: style.accent + "18" }} className={cn(isFashion ? "w-14 h-14 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform duration-300" : "w-11 h-11 flex items-center justify-center group-hover:scale-110 transition-transform duration-300", style.radius)}>
                      <Tag size={18} style={{ color: style.accent }} />
                    </div>
                    <p className={cn(isFashion ? "store-display text-[1.6rem] font-semibold leading-none text-[#2d221f]" : "text-[11px] font-semibold text-slate-700 leading-tight tracking-tight")}>{cat.name}</p>
                    <span className={cn(isFashion ? "text-[10px] font-semibold uppercase tracking-[0.24em] text-[#8c6c63]" : "text-[9px] text-slate-400 font-medium")}>{count} {count === 1 ? "produto" : "produtos"}</span>
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
                  isFashion
                    ? "inline-flex items-center gap-2 px-6 h-11 rounded-full border border-[#ead9ce] bg-white text-[#6b5149] text-[11px] font-semibold uppercase tracking-[0.24em] hover:bg-[#fff7f1] transition-all"
                    : "inline-flex items-center gap-2 px-6 h-10 border border-slate-200 bg-white text-slate-600 text-[11px] font-semibold uppercase tracking-wider hover:border-slate-300 hover:shadow-sm transition-all",
                  !isFashion && style.radius
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
        isTechNova ? (
          <section className="py-16">
            <div className="max-w-7xl mx-auto px-4 md:px-8">
              <SectionHeader
                title="Seleção em Destaque"
                icon={<Star size={17} />}
                link={storePath("/catalogo")}
                linkLabel="Ver vitrine completa"
                accent={style.accent}
                isDark={false}
                isTechNova
              />
              <div className="grid lg:grid-cols-[1.08fr_0.92fr] gap-5">
                <Link
                  to={storePath(`/produto/${featured[0].id}`)}
                  className="tech-panel tech-card-sheen group relative overflow-hidden rounded-[2rem] border border-[#dbe6ff] min-h-[520px] bg-[linear-gradient(140deg,#f2f7ff_0%,#ffffff_100%)]"
                >
                  {getImg(featured[0]) ? (
                    <img src={getImg(featured[0])!} alt={featured[0].name} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
                  ) : (
                    <div className="absolute inset-0 tech-grid bg-[linear-gradient(145deg,#edf5ff_0%,#f8fbff_100%)]" />
                  )}
                  <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(7,20,38,0.04)_0%,rgba(7,20,38,0.1)_45%,rgba(7,20,38,0.82)_100%)]" />
                  <div className="absolute top-5 left-5 flex flex-wrap gap-2">
                    <span className="rounded-full border border-white/35 bg-white/12 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/92 backdrop-blur-md">
                      Produto vitrine
                    </span>
                    {featured[0].discount_price && (
                      <span className="rounded-full bg-[#ff5f6d] px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-white shadow-lg">
                        Oferta especial
                      </span>
                    )}
                  </div>
                  <div className="absolute left-0 right-0 bottom-0 p-7 md:p-9 text-white">
                    <p className="store-kicker text-[10px] font-semibold text-white/70">{featured[0].category_name || "Tecnologia"}</p>
                    <h3 className="store-display mt-5 text-4xl md:text-5xl leading-[0.92]">{featured[0].name}</h3>
                    {featured[0].description && (
                      <p className="mt-4 max-w-xl text-sm md:text-base leading-relaxed text-white/76 line-clamp-3">
                        {featured[0].description}
                      </p>
                    )}
                    <div className="mt-5 flex items-end gap-3">
                      <p className="store-display text-4xl md:text-5xl leading-none">
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
        ) : isFashion ? (
          <section className="py-16">
            <div className="max-w-7xl mx-auto px-4 md:px-8">
              <SectionHeader
                title="Seleção em Destaque"
                icon={<Star size={17} />}
                link={storePath("/catalogo")}
                linkLabel="Ver coleção"
                accent={style.accent}
                isDark={false}
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
        ) : (
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
        )
      )}

      {/* ── BEST SELLERS ──────────────────────────────────────── */}
      <section className={cn("py-16", isFashion ? "bg-transparent" : isTechNova ? "bg-transparent" : isDark ? "bg-[#080a0e]" : "bg-white")}>
        <div className="max-w-7xl mx-auto px-4 md:px-8">
          <SectionHeader
            title="Mais Vendidos"
            icon={<TrendingUp size={17} />}
            link={storePath("/catalogo")}
            linkLabel={isFashion ? "Ver coleção" : "Ver catálogo"}
            accent={style.accent}
            isDark={isDark}
            isFashion={isFashion}
            isTechNova={isTechNova}
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
        <section className={cn("py-16", isFashion ? "bg-[#fff6ef]" : isTechNova ? "bg-transparent" : isDark ? "bg-slate-950" : "bg-slate-50")}>
          <div className="max-w-7xl mx-auto px-4 md:px-8">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="w-1 h-6 rounded-full bg-red-500" />
                <Zap size={16} className="text-red-500" />
                <h2 className={cn(isFashion || isTechNova ? "store-display text-4xl font-semibold tracking-[-0.04em]" : "text-2xl font-bold tracking-tight", isDark ? "text-white" : isFashion ? "text-[#2d221f]" : isTechNova ? "text-[#071426]" : "text-slate-900")}>Promoções</h2>
                <span className="bg-red-50 text-red-500 text-[9px] font-bold px-2 py-0.5 rounded-full border border-red-200">
                  {onSale.length} oferta{onSale.length !== 1 ? "s" : ""}
                </span>
              </div>
              <Link
                to={storePath("/catalogo")}
                className={cn(
                  "flex items-center gap-1 transition-colors",
                  isFashion
                    ? "text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8c6c63] hover:text-[#2d221f]"
                    : isTechNova
                      ? "rounded-full border border-[#d7e4ff] bg-white/70 px-4 py-2 text-[10px] font-semibold tracking-[0.18em] uppercase text-[#5b789e] hover:text-[#071426] hover:border-[#bfd2ff]"
                    : "text-[11px] font-semibold uppercase tracking-wider",
                  isDark ? "text-slate-500 hover:text-white" : !isFashion && !isTechNova && "text-slate-400 hover:text-slate-700"
                )}
              >
                {isFashion ? "Ver coleção" : "Ver todas"} <ChevronRight size={13} />
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
                        isFashion ? "fashion-soft-shadow hover:-translate-y-1 hover:shadow-[0_26px_70px_rgba(108,64,55,0.12)]" : "hover:shadow-xl",
                        style.card,
                        style.radius
                      )}
                    >
                      <div className={cn(isFashion ? "aspect-[4/5] bg-[#f8efe8] overflow-hidden relative" : "aspect-square bg-slate-50 overflow-hidden relative")}>
                        {img
                          ? <img src={img} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                          : <div className="w-full h-full flex items-center justify-center text-slate-200"><Package size={36} strokeWidth={1} /></div>}
                        <span className="absolute top-2 right-2 bg-red-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-full shadow">-{pct}%</span>
                      </div>
                      <div className={cn(isFashion ? "p-5" : "p-4")}>
                        <p className={cn(isFashion ? "store-display text-[1.5rem] font-semibold text-[#2d221f] line-clamp-2 leading-[0.95]" : "text-sm font-medium text-slate-800 line-clamp-2 leading-snug")}>{product.name}</p>
                        <div className="flex items-center gap-2 mt-3">
                          <span className={cn(isFashion ? "store-display text-[1.8rem] font-semibold text-[#2d221f]" : "text-base font-bold text-emerald-600 font-mono")}>R$ {Number(product.discount_price).toFixed(2)}</span>
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
