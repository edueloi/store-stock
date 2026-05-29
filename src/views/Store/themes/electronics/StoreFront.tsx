import React, { ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { motion } from "motion/react";
import StoreSEO from "../../../../components/store/StoreSEO";
import {
  Package, ShoppingBag, Star,
  Zap, TrendingUp, ChevronRight, Cpu, Headphones, Monitor,
  Camera, Smartphone, Wifi, HardDrive, Speaker, Tv, Tag,
} from "lucide-react";
import { cn } from "../../../../lib/utils";
import { useStore } from "../../StoreLayout";
import { Category, Product } from "../../../../types";
import { buildStorePath, resolveStoreSlug } from "../../store-routing";

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

      {/* HERO */}
      <section className="relative overflow-hidden min-h-[80vh] flex items-center">
        <div className="absolute inset-0 bg-[linear-gradient(135deg,#080c14_0%,#0d1730_50%,#080c14_100%)]" />
        <div className="absolute inset-0" style={{ backgroundImage: "radial-gradient(circle at 20% 50%, rgba(59,130,246,0.12) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(139,92,246,0.08) 0%, transparent 45%)" }} />
        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: "linear-gradient(rgba(59,130,246,1) 1px, transparent 1px), linear-gradient(90deg, rgba(59,130,246,1) 1px, transparent 1px)", backgroundSize: "60px 60px" }} />

        <div className="relative max-w-7xl mx-auto px-4 md:px-8 py-20 w-full">
          <div className="grid lg:grid-cols-2 gap-8 items-center">
            <motion.div initial={{ opacity: 0, x: -24 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6 }}>
              <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-4 py-2 mb-6">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                <span className="text-[10px] font-bold uppercase tracking-[0.24em] text-blue-400">Loja Online</span>
              </div>
              <h1 className="text-5xl sm:text-6xl md:text-7xl font-black text-white leading-[0.9] tracking-tight">
                {tenant.name}
              </h1>
              <p className="mt-5 text-slate-400 text-base md:text-lg leading-relaxed max-w-lg">
                {tenant.about_text || "Os melhores eletrônicos, gadgets e tecnologia com os melhores preços. Produtos de alta qualidade, entrega rápida e atendimento via WhatsApp."}
              </p>
              <div className="flex flex-wrap gap-3 mt-8">
                <Link
                  to={storePath("/catalogo")}
                  style={{ backgroundColor: style.accent }}
                  className="inline-flex items-center gap-2 h-13 px-7 py-3.5 rounded-xl text-white font-bold text-sm uppercase tracking-wider shadow-[0_0_30px_rgba(59,130,246,0.4)] hover:shadow-[0_0_40px_rgba(59,130,246,0.5)] transition-all"
                >
                  <ShoppingBag size={16} /> Ver Catálogo
                </Link>
                {onSale.length > 0 && (
                  <Link to={storePath("/catalogo")} className="inline-flex items-center gap-2 h-13 px-7 py-3.5 rounded-xl border border-[#1e2d4a] bg-[#0e1525]/80 text-white font-bold text-sm uppercase tracking-wider hover:border-blue-500/50 transition-all">
                    <Zap size={14} className="text-blue-400" /> {onSale.length} Promoções
                  </Link>
                )}
              </div>
              <div className="flex flex-wrap gap-2 mt-7">
                {categories.slice(0, 4).map(cat => (
                  <Link key={cat.id} to={storePath(`/catalogo?cat=${cat.id}`)}
                    className="rounded-lg border border-[#1e2d4a] bg-[#0e1525]/60 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400 hover:text-white hover:border-blue-500/40 transition-all">
                    {cat.name}
                  </Link>
                ))}
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6, delay: 0.1 }} className="relative">
              {heroImage ? (
                <div className="relative rounded-2xl overflow-hidden border border-[#1e2d4a] shadow-[0_0_60px_rgba(59,130,246,0.15)]">
                  <img src={heroImage} alt={tenant.name} className="w-full aspect-[4/3] object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#080c14]/60 to-transparent" />
                  <div className="absolute bottom-5 left-5 right-5 flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-400/80">Produto em destaque</p>
                      {featured[0] && <p className="text-white font-bold mt-1 text-lg">{featured[0].name}</p>}
                    </div>
                    {featured[0] && (
                      <span className="bg-blue-500 text-white font-black text-sm px-4 py-2 rounded-lg shadow-[0_0_20px_rgba(59,130,246,0.5)]">
                        R$ {Number(featured[0].discount_price || featured[0].price).toFixed(2)}
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <div className="relative rounded-2xl border border-[#1e2d4a] bg-[#0e1525] p-8 flex flex-col gap-5">
                  <div className="grid grid-cols-2 gap-4">
                    {[allActive.length, categories.length, featured.length, onSale.length].map((val, i) => (
                      <div key={i} className="rounded-xl border border-[#1e2d4a] bg-[#080c14] p-5">
                        <span className="text-3xl font-black text-white">{val}</span>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-blue-400/70 mt-1">
                          {["Produtos", "Categorias", "Destaques", "Promoções"][i]}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-blue-500/20 blur-3xl pointer-events-none" />
              <div className="absolute -bottom-8 -left-8 w-24 h-24 rounded-full bg-violet-500/15 blur-3xl pointer-events-none" />
            </motion.div>
          </div>
        </div>
      </section>

      {/* STATS BAR */}
      <div className="border-y border-[#1a2540] bg-[#0a1020]">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-5 grid grid-cols-2 md:grid-cols-4 gap-px bg-[#1a2540]">
          {[
            { value: allActive.length, label: "Produtos ativos", icon: <Package size={16} /> },
            { value: categories.length, label: "Categorias", icon: <Tag size={16} /> },
            { value: featured.length, label: "Destaques", icon: <Star size={16} /> },
            { value: onSale.length, label: "Promoções", icon: <Zap size={16} /> },
          ].map((s, i) => (
            <div key={i} className="bg-[#0a1020] px-6 py-5 flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${style.accent}18`, color: style.accent }}>{s.icon}</div>
              <div>
                <span className="text-2xl font-black text-white tabular-nums">{s.value}</span>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mt-0.5">{s.label}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* CATEGORIES */}
      {categories.length > 0 && (
        <section id="categorias" className="max-w-7xl mx-auto px-4 md:px-8 py-16">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="w-1 h-6 rounded-full" style={{ backgroundColor: style.accent }} />
              <h2 className="text-2xl font-black text-white tracking-tight">Categorias</h2>
            </div>
            <Link to={storePath("/catalogo")} className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-slate-500 hover:text-blue-400 transition-colors">
              Ver todos <ChevronRight size={13} />
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {categories.slice(0, CATEGORY_DISPLAY_LIMIT).map((cat, i) => {
              const count = allActive.filter(p => p.category_id === cat.id).length;
              return (
                <motion.div key={cat.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} whileHover={{ y: -3 }}>
                  <Link to={storePath(`/catalogo?cat=${cat.id}`)}
                    className="group flex flex-col items-center gap-3 p-5 text-center rounded-2xl border border-[#1e2d4a] bg-[#0e1525]/80 hover:border-blue-500/40 hover:bg-[#0e1525] transition-all relative overflow-hidden">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center transition-all group-hover:scale-110 group-hover:shadow-[0_0_16px_rgba(59,130,246,0.4)]" style={{ backgroundColor: `${style.accent}18`, color: style.accent }}>
                      {getCategoryIcon(cat.name)}
                    </div>
                    <div>
                      <p className="text-[13px] font-bold text-white leading-tight">{cat.name}</p>
                      <span className="text-[10px] font-medium text-slate-500 mt-0.5 block">{count} produto{count !== 1 ? "s" : ""}</span>
                    </div>
                    <div className="absolute inset-x-0 bottom-0 h-10 opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: `radial-gradient(circle at 50% 100%, ${style.accent}25 0%, transparent 70%)` }} />
                  </Link>
                </motion.div>
              );
            })}
          </div>
          {categories.length > CATEGORY_DISPLAY_LIMIT && (
            <div className="mt-5 text-center">
              <Link to={storePath("/catalogo")} className="inline-flex items-center gap-2 px-6 h-10 rounded-xl border border-[#1e2d4a] bg-[#0e1525] text-slate-400 text-[11px] font-bold uppercase tracking-wider hover:border-blue-500/40 hover:text-white transition-all">
                +{categories.length - CATEGORY_DISPLAY_LIMIT} mais categorias <ChevronRight size={13} />
              </Link>
            </div>
          )}
        </section>
      )}

      {/* FEATURED */}
      {featured.length > 0 && (
        <section className="py-16">
          <div className="max-w-7xl mx-auto px-4 md:px-8">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="w-1 h-6 rounded-full" style={{ backgroundColor: style.accent }} />
                <Star size={16} style={{ color: style.accent }} />
                <h2 className="text-2xl font-black text-white tracking-tight">Destaques</h2>
                <span className="text-[9px] font-black px-2.5 py-1 rounded-full" style={{ backgroundColor: `${style.accent}20`, color: style.accent, border: `1px solid ${style.accent}35` }}>{featured.length}</span>
              </div>
              <Link to={storePath("/catalogo")} className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-slate-500 hover:text-blue-400 transition-colors">
                Ver todos <ChevronRight size={13} />
              </Link>
            </div>

            <div className="grid lg:grid-cols-[1.15fr_0.85fr] gap-4">
              <Link to={storePath(`/produto/${featured[0].id}`)}
                className="group relative overflow-hidden rounded-2xl border border-[#1e2d4a] min-h-[480px] bg-[#0e1525]">
                {getImg(featured[0]) ? (
                  <img src={getImg(featured[0])!} alt={featured[0].name} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center" style={{ background: `linear-gradient(135deg, #0e1525, ${style.accent}18)` }}>
                    <Package size={64} className="text-slate-700" strokeWidth={1} />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-[#080c14]/90 via-[#080c14]/30 to-transparent" />
                <div className="absolute inset-0 bg-gradient-to-r from-[#080c14]/40 to-transparent" />
                <div className="absolute top-4 left-4 flex gap-2 flex-wrap">
                  <span className="rounded-lg border border-white/20 bg-white/10 backdrop-blur-md px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white">Destaque</span>
                  {featured[0].discount_price && (
                    <span className="rounded-lg bg-blue-500 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white shadow-[0_0_14px_rgba(59,130,246,0.5)]">Oferta</span>
                  )}
                </div>
                <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8">
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-blue-400/80">{featured[0].category_name || "Eletrônicos"}</p>
                  <h3 className="text-3xl md:text-4xl font-black text-white mt-3 leading-tight">{featured[0].name}</h3>
                  {featured[0].description && (
                    <p className="mt-2 text-slate-400 text-sm leading-relaxed line-clamp-2 max-w-lg">{featured[0].description}</p>
                  )}
                  <div className="mt-4 flex items-end gap-3">
                    <span className="text-3xl font-black text-white" style={{ textShadow: `0 0 20px ${style.accent}60` }}>
                      R$ {Number(featured[0].discount_price || featured[0].price).toFixed(2)}
                    </span>
                    {featured[0].discount_price && (
                      <span className="text-sm text-slate-500 line-through font-mono">R$ {Number(featured[0].price).toFixed(2)}</span>
                    )}
                  </div>
                </div>
                <div className="absolute inset-0 rounded-2xl border-2 border-transparent group-hover:border-blue-500/40 transition-all duration-300 pointer-events-none" />
              </Link>

              <div className="grid sm:grid-cols-2 lg:grid-cols-1 gap-4 lg:max-h-[480px] lg:overflow-y-auto lg:overflow-x-hidden pr-0.5">
                {featured.slice(1, 5).map((product, i) => {
                  const img = getImg(product);
                  const hasDiscount = !!product.discount_price;
                  const pct = hasDiscount ? Math.round((1 - Number(product.discount_price) / Number(product.price)) * 100) : 0;
                  return (
                    <motion.div key={product.id} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.07 }}>
                      <Link to={storePath(`/produto/${product.id}`)}
                        className="group flex gap-4 p-4 rounded-2xl border border-[#1e2d4a] bg-[#0e1525]/80 hover:border-blue-500/40 hover:bg-[#0e1525] transition-all">
                        <div className="w-20 h-20 rounded-xl overflow-hidden border border-[#1e2d4a] shrink-0 flex items-center justify-center bg-[#080c14]">
                          {img ? <img src={img} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                            : <Package size={24} className="text-slate-700" strokeWidth={1} />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-blue-400/70">{product.category_name || "Eletrônicos"}</p>
                          <p className="text-white font-bold text-sm mt-0.5 line-clamp-2 leading-snug group-hover:text-blue-200 transition-colors">{product.name}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <span className="text-base font-black text-white">{hasDiscount ? `R$ ${Number(product.discount_price).toFixed(2)}` : `R$ ${Number(product.price).toFixed(2)}`}</span>
                            {hasDiscount && <span className="text-[9px] font-bold text-white bg-blue-600 px-2 py-0.5 rounded-full">-{pct}%</span>}
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

      {/* BEST SELLERS */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 md:px-8">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="w-1 h-6 rounded-full" style={{ backgroundColor: style.accent }} />
              <TrendingUp size={16} style={{ color: style.accent }} />
              <h2 className="text-2xl font-black text-white tracking-tight">Mais Vendidos</h2>
            </div>
            <Link to={storePath("/catalogo")} className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-slate-500 hover:text-blue-400 transition-colors">
              Ver catálogo <ChevronRight size={13} />
            </Link>
          </div>
          {bestSellers.length === 0 ? (
            <div className="py-16 text-center text-slate-600">
              <Package size={40} strokeWidth={1} className="mx-auto mb-4 opacity-30" />
              <p className="text-xs font-semibold uppercase tracking-wider">Nenhum produto disponível</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {bestSellers.map((product, i) => {
                const img = getImg(product);
                const hasDiscount = !!product.discount_price;
                const pct = hasDiscount ? Math.round((1 - Number(product.discount_price) / Number(product.price)) * 100) : 0;
                return (
                  <motion.div key={product.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                    <Link to={storePath(`/produto/${product.id}`)}
                      className="group flex flex-col rounded-2xl border border-[#1e2d4a] bg-[#0e1525]/80 overflow-hidden hover:border-blue-500/40 hover:-translate-y-1 transition-all duration-300">
                      <div className="relative aspect-square bg-[#080c14] overflow-hidden">
                        {img ? <img src={img} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                          : <div className="w-full h-full flex items-center justify-center"><Package size={40} className="text-slate-700" strokeWidth={1} /></div>}
                        {hasDiscount && (
                          <span className="absolute top-2 right-2 bg-blue-500 text-white text-[9px] font-black px-2 py-0.5 rounded-lg shadow-[0_0_10px_rgba(59,130,246,0.5)]">-{pct}%</span>
                        )}
                        {product.is_featured && (
                          <span className="absolute top-2 left-2 flex items-center gap-1 text-[8px] font-bold px-2 py-0.5 rounded-lg" style={{ backgroundColor: `${style.accent}25`, color: style.accent, border: `1px solid ${style.accent}40` }}>
                            <Star size={7} fill="currentColor" />Top
                          </span>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-[#080c14]/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                        <button
                          onClick={e => { e.preventDefault(); addToCart(product); }}
                          style={{ backgroundColor: style.accent }}
                          className="absolute bottom-3 right-3 w-9 h-9 rounded-xl flex items-center justify-center text-white shadow-[0_0_16px_rgba(59,130,246,0.5)] opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-200"
                        >
                          <ShoppingBag size={14} />
                        </button>
                      </div>
                      <div className="p-4">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-blue-400/60 mb-1">{product.category_name || "Eletrônicos"}</p>
                        <p className="text-white font-bold text-sm leading-snug line-clamp-2 group-hover:text-blue-200 transition-colors">{product.name}</p>
                        <div className="flex items-center gap-2 mt-3">
                          {hasDiscount ? (
                            <>
                              <span className="text-base font-black text-white">R$ {Number(product.discount_price).toFixed(2)}</span>
                              <span className="text-[10px] text-slate-600 line-through font-mono">R$ {Number(product.price).toFixed(2)}</span>
                            </>
                          ) : (
                            <span className="text-base font-black" style={{ color: style.accent }}>R$ {Number(product.price).toFixed(2)}</span>
                          )}
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* ON SALE */}
      {onSale.length > 0 && (
        <section className="py-16 bg-[#060a12]">
          <div className="max-w-7xl mx-auto px-4 md:px-8">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="w-1 h-6 rounded-full bg-blue-500" />
                <Zap size={16} className="text-blue-400" />
                <h2 className="text-2xl font-black text-white tracking-tight">Promoções</h2>
                <span className="text-[9px] font-bold px-2 py-0.5 rounded-full border bg-blue-500/15 text-blue-400 border-blue-500/30">
                  {onSale.length} oferta{onSale.length !== 1 ? "s" : ""}
                </span>
              </div>
              <Link to={storePath("/catalogo")} className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-slate-500 hover:text-blue-400 transition-colors">
                Ver todas <ChevronRight size={13} />
              </Link>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {onSale.slice(0, 4).map((product, i) => {
                const pct = Math.round((1 - Number(product.discount_price) / Number(product.price)) * 100);
                const img = getImg(product);
                return (
                  <motion.div key={product.id} initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.05 }}>
                    <Link to={storePath(`/produto/${product.id}`)}
                      className="group flex flex-col rounded-2xl border border-[#1e2d4a] bg-[#0e1525]/80 overflow-hidden hover:border-blue-500/40 hover:-translate-y-1 transition-all duration-300">
                      <div className="relative aspect-square bg-[#080c14] overflow-hidden">
                        {img ? <img src={img} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                          : <div className="w-full h-full flex items-center justify-center"><Package size={36} className="text-slate-700" strokeWidth={1} /></div>}
                        <span className="absolute top-2 right-2 bg-blue-500 text-white text-[9px] font-black px-2.5 py-1 rounded-lg shadow-[0_0_12px_rgba(59,130,246,0.5)]">-{pct}%</span>
                        <div className="absolute inset-0 bg-gradient-to-t from-[#080c14]/60 to-transparent" />
                      </div>
                      <div className="p-4">
                        <p className="text-white font-bold text-sm line-clamp-2 leading-snug group-hover:text-blue-200 transition-colors">{product.name}</p>
                        <div className="flex items-center gap-2 mt-3">
                          <span className="text-base font-black text-white">R$ {Number(product.discount_price).toFixed(2)}</span>
                          <span className="text-[10px] text-slate-600 line-through font-mono">R$ {Number(product.price).toFixed(2)}</span>
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
