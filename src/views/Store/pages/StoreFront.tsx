import { Link, useParams } from "react-router-dom";
import { motion } from "motion/react";
import { ArrowRight, Flame, Tag, Package, ShoppingBag, Star } from "lucide-react";
import { cn } from "../../../lib/utils";
import { useStore } from "../StoreLayout";

export default function StoreFront() {
  const { slug } = useParams();
  const { tenant, categories, products, addToCart, style } = useStore();

  const featured = products.filter(p => p.is_featured && p.is_active);
  const recent = products.filter(p => p.is_active).slice(0, 8);
  const onSale = products.filter(p => p.is_active && p.discount_price);

  return (
    <div className="space-y-0">

      {/* ── HERO ─────────────────────────────────────────────────── */}
      {tenant.banner_url ? (
        <div className="relative h-[45vh] md:h-[60vh] w-full overflow-hidden">
          <img src={tenant.banner_url} className="w-full h-full object-cover" alt="Banner" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/30 to-black/60 flex items-end">
            <div className="max-w-7xl mx-auto px-6 pb-12 w-full">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                <p style={{ color: style.accent }} className="text-[11px] font-black uppercase tracking-[0.4em] mb-2">
                  Bem-vindo à
                </p>
                <h1 className="text-4xl md:text-6xl font-black text-white uppercase tracking-tighter leading-none drop-shadow-2xl">
                  {tenant.name}
                </h1>
                <div className="flex flex-wrap gap-3 mt-6">
                  <Link
                    to={`/s/${slug}/catalogo`}
                    style={{ backgroundColor: style.accent }}
                    className="flex items-center gap-2 px-6 h-12 rounded-2xl text-white text-xs font-black uppercase tracking-widest shadow-2xl hover:opacity-90 transition-all active:scale-95"
                  >
                    <ShoppingBag size={15} /> Ver Catálogo
                  </Link>
                  <a
                    href="#categorias"
                    className="flex items-center gap-2 px-6 h-12 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 text-white text-xs font-black uppercase tracking-widest hover:bg-white/20 transition-all"
                  >
                    Categorias <ArrowRight size={13} />
                  </a>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ background: `linear-gradient(135deg, ${style.accent}22, ${style.accent}08)` }}
          className="relative h-[40vh] md:h-[55vh] flex items-center border-b border-slate-200">
          <div className="max-w-7xl mx-auto px-6 w-full">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <p style={{ color: style.accent }} className="text-[11px] font-black uppercase tracking-[0.4em] mb-2">
                Bem-vindo à
              </p>
              <h1 className="text-5xl md:text-7xl font-black uppercase tracking-tighter leading-none text-slate-900">
                {tenant.name}
              </h1>
              <p className="text-slate-500 mt-4 max-w-md text-sm font-medium leading-relaxed">
                {tenant.about_text || "Encontre os melhores produtos com qualidade e praticidade."}
              </p>
              <Link
                to={`/s/${slug}/catalogo`}
                style={{ backgroundColor: style.accent }}
                className="inline-flex items-center gap-2 mt-8 px-7 h-12 rounded-2xl text-white text-xs font-black uppercase tracking-widest shadow-lg hover:opacity-90 transition-all"
              >
                <ShoppingBag size={15} /> Explorar Catálogo <ArrowRight size={13} />
              </Link>
            </motion.div>
          </div>
        </div>
      )}

      {/* ── STATS BAR ────────────────────────────────────────────── */}
      <div className="bg-white border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-6 py-4 flex flex-wrap items-center gap-6 md:gap-12">
          {[
            { value: products.filter(p => p.is_active).length, label: "Produtos" },
            { value: categories.length, label: "Categorias" },
            { value: featured.length, label: "Destaques" },
            { value: onSale.length, label: "Em Promoção" },
          ].map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-2xl font-black" style={{ color: style.accent }}>{s.value}</span>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-tight">{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── CATEGORIES ───────────────────────────────────────────── */}
      {categories.length > 0 && (
        <section id="categorias" className="max-w-7xl mx-auto px-6 py-14">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div style={{ backgroundColor: style.accent }} className="w-1 h-7 rounded-full" />
              <h2 className="text-xl font-black uppercase tracking-tighter">Categorias</h2>
            </div>
            <Link to={`/s/${slug}/catalogo`} className="text-[11px] font-black uppercase tracking-wider text-slate-400 hover:text-slate-700 flex items-center gap-1 transition-colors">
              Ver tudo <ArrowRight size={12} />
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {categories.map((cat, i) => {
              const count = products.filter(p => p.is_active && p.category_id === cat.id).length;
              return (
                <motion.div key={cat.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                  <Link
                    to={`/s/${slug}/catalogo?cat=${cat.id}`}
                    className={cn("group flex flex-col items-center gap-2 p-4 border hover:shadow-md transition-all text-center", style.card, style.radius)}
                  >
                    <div
                      style={{ backgroundColor: style.accent + "18" }}
                      className={cn("w-12 h-12 flex items-center justify-center transition-colors group-hover:scale-110 duration-300", style.radius)}
                    >
                      <Tag size={20} style={{ color: style.accent }} />
                    </div>
                    <p className="text-[11px] font-black uppercase tracking-tight text-slate-800 leading-tight">{cat.name}</p>
                    <span className="text-[9px] text-slate-400 font-bold">{count} produto{count !== 1 ? "s" : ""}</span>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── FEATURED ─────────────────────────────────────────────── */}
      {featured.length > 0 && (
        <section className="bg-slate-950 py-14">
          <div className="max-w-7xl mx-auto px-6">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <Flame size={18} className="text-amber-400" />
                <h2 className="text-xl font-black uppercase tracking-tighter text-white">Destaques</h2>
              </div>
              <Link to={`/s/${slug}/catalogo`} className="text-[11px] font-black uppercase tracking-wider text-slate-500 hover:text-white flex items-center gap-1 transition-colors">
                Ver catálogo <ArrowRight size={12} />
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {featured.slice(0, 4).map((product, i) => (
                <motion.div
                  key={product.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.07 }}
                  className="group bg-white/5 border border-white/10 rounded-2xl overflow-hidden hover:bg-white/10 transition-all"
                >
                  <Link to={`/s/${slug}/produto/${product.id}`} className="block relative aspect-video overflow-hidden">
                    {product.image_url
                      ? <img src={product.image_url} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                      : <div className="w-full h-full flex items-center justify-center text-white/10"><Package size={40} strokeWidth={1} /></div>}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                    <span className="absolute top-3 left-3 flex items-center gap-1 text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-full"
                      style={{ backgroundColor: style.accent + "40", color: style.accent, border: `1px solid ${style.accent}60` }}>
                      <Star size={8} fill="currentColor" /> Destaque
                    </span>
                  </Link>
                  <div className="p-4 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-black text-white uppercase tracking-tight line-clamp-1">{product.name}</p>
                      <p className="text-sm font-black font-mono mt-1" style={{ color: style.accent }}>
                        R$ {Number(product.discount_price || product.price).toFixed(2)}
                      </p>
                    </div>
                    <button
                      onClick={() => addToCart(product)}
                      style={{ backgroundColor: style.accent }}
                      className="w-9 h-9 rounded-xl flex items-center justify-center text-white shadow-lg active:scale-90 transition-all"
                    >
                      <ShoppingBag size={14} />
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── ON SALE ──────────────────────────────────────────────── */}
      {onSale.length > 0 && (
        <section className="max-w-7xl mx-auto px-6 py-14">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div style={{ backgroundColor: style.accent }} className="w-1 h-7 rounded-full" />
              <h2 className="text-xl font-black uppercase tracking-tighter">Promoções</h2>
              <span className="bg-red-100 text-red-600 text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                {onSale.length} ofertas
              </span>
            </div>
            <Link to={`/s/${slug}/catalogo`} className="text-[11px] font-black uppercase tracking-wider text-slate-400 hover:text-slate-700 flex items-center gap-1 transition-colors">
              Ver todas <ArrowRight size={12} />
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {onSale.slice(0, 4).map((product, i) => {
              const pct = Math.round((1 - Number(product.discount_price) / Number(product.price)) * 100);
              return (
                <motion.div key={product.id} initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.05 }}>
                  <Link to={`/s/${slug}/produto/${product.id}`}
                    className={cn("group flex flex-col border hover:shadow-xl transition-all overflow-hidden relative", style.card, style.radius)}>
                    <div className="aspect-square bg-slate-50 overflow-hidden relative">
                      {product.image_url
                        ? <img src={product.image_url} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                        : <div className="w-full h-full flex items-center justify-center text-slate-200"><Package size={40} strokeWidth={1} /></div>}
                      <span className="absolute top-2 right-2 bg-red-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full">
                        -{pct}%
                      </span>
                    </div>
                    <div className="p-3">
                      <p className="text-xs font-bold text-slate-800 line-clamp-2 leading-snug">{product.name}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-sm font-black text-emerald-600 font-mono">R$ {Number(product.discount_price).toFixed(2)}</span>
                        <span className="text-[10px] text-slate-400 line-through font-mono">R$ {Number(product.price).toFixed(2)}</span>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── RECENT PRODUCTS ──────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-6 py-14">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div style={{ backgroundColor: style.accent }} className="w-1 h-7 rounded-full" />
            <h2 className="text-xl font-black uppercase tracking-tighter">Produtos</h2>
          </div>
          <Link
            to={`/s/${slug}/catalogo`}
            style={{ color: style.accent }}
            className="text-[11px] font-black uppercase tracking-wider flex items-center gap-1 transition-colors hover:opacity-70"
          >
            Ver catálogo completo <ArrowRight size={12} />
          </Link>
        </div>
        {recent.length === 0 ? (
          <div className="py-20 text-center text-slate-400">
            <Package size={40} strokeWidth={1} className="mx-auto mb-4 opacity-30" />
            <p className="text-xs font-bold uppercase tracking-wider">Nenhum produto disponível</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {recent.map((product, i) => (
              <motion.div key={product.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                <Link
                  to={`/s/${slug}/produto/${product.id}`}
                  className={cn("group flex flex-col border hover:shadow-xl transition-all overflow-hidden", style.card, style.radius)}
                >
                  <div className="aspect-square bg-slate-50 overflow-hidden relative">
                    {product.image_url
                      ? <img src={product.image_url} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                      : <div className="w-full h-full flex items-center justify-center text-slate-200"><Package size={40} strokeWidth={1} /></div>}
                    {product.discount_price && (
                      <span className="absolute top-2 left-2 bg-red-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full">
                        -{Math.round((1 - Number(product.discount_price) / Number(product.price)) * 100)}%
                      </span>
                    )}
                  </div>
                  <div className="p-3 flex flex-col gap-1">
                    <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest">{product.category_name || "Geral"}</p>
                    <p className="text-xs font-bold text-slate-800 line-clamp-2 leading-snug group-hover:text-blue-600 transition-colors">{product.name}</p>
                    <div className="flex items-center justify-between mt-auto pt-2">
                      {product.discount_price ? (
                        <div className="flex flex-col">
                          <span className="text-[10px] line-through text-slate-400 font-mono">R$ {Number(product.price).toFixed(2)}</span>
                          <span className="text-sm font-black text-emerald-600 font-mono">R$ {Number(product.discount_price).toFixed(2)}</span>
                        </div>
                      ) : (
                        <span className="text-sm font-black font-mono" style={{ color: style.accent }}>R$ {Number(product.price).toFixed(2)}</span>
                      )}
                      <button
                        onClick={e => { e.preventDefault(); addToCart(product); }}
                        style={{ backgroundColor: style.accent }}
                        className={cn("w-8 h-8 flex items-center justify-center text-white transition-all active:scale-90", style.radius)}
                      >
                        <span className="text-base font-black leading-none">+</span>
                      </button>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
