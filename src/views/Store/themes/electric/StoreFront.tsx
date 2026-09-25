import React from "react";
import { Link, useParams } from "react-router-dom";
import { motion } from "motion/react";
import StoreSEO from "../../../../components/store/StoreSEO";
import { ArrowRight, BadgeCheck, Cable, ChevronRight, Package, Search, ShieldCheck, ShoppingCart, Sparkles, Truck, Wrench, Zap } from "lucide-react";
import { useStore } from "../../StoreLayout";
import { Product } from "../../../../types";
import { buildStorePath, resolveStoreSlug, productRouteSegment } from "../../store-routing";
import { productHasStock } from "../../../../utils/productStock";

const price = (value: number | string) => `R$ ${Number(value).toFixed(2)}`;

function Heading({ eyebrow, title, description, link, accent }: { eyebrow: string; title: string; description?: string; link: string; accent: string }) {
  return <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
    <div><p className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-[.22em]" style={{ color: accent }}><i className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: accent }} />{eyebrow}</p>
      <h2 className="text-2xl font-black tracking-[-.04em] text-[#071426] sm:text-3xl">{title}</h2>
      {description && <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-500">{description}</p>}
    </div>
    <Link to={link} className="group inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-[.12em] text-slate-600 hover:text-[#071426]">Ver catálogo <ChevronRight size={15} className="transition-transform group-hover:translate-x-0.5" /></Link>
  </div>;
}

function Card({ product, slug, accent, add, index }: { product: Product; slug: string; accent: string; add: (p: Product) => void; index: number }) {
  const image = (Array.isArray(product.images) && (product.images as string[])[0]) || product.image_url || null;
  const special = product.discount_price ? Number(product.discount_price) : null;
  const off = special ? Math.round((1 - special / Number(product.price)) * 100) : 0;
  return <motion.article initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-40px" }} transition={{ duration: .35, delay: Math.min(index, 5) * .04 }}
    className="group overflow-hidden rounded-[1.35rem] border border-slate-200/90 bg-white shadow-[0_10px_28px_rgba(15,23,42,.05)] transition-all hover:-translate-y-1 hover:border-slate-300 hover:shadow-[0_18px_34px_rgba(15,23,42,.12)]">
    <Link to={buildStorePath(slug, `/produto/${productRouteSegment(product)}`)} className="block"><div className="relative aspect-[1.08/1] overflow-hidden bg-[#f4f7fb]">
      {image ? <img src={image} alt={product.name} className="h-full w-full object-contain p-4 transition-transform duration-500 group-hover:scale-105 sm:p-5" /> : <div className="flex h-full items-center justify-center text-slate-300"><Package size={38} strokeWidth={1.4} /></div>}
      {off > 0 && <span className="absolute left-3 top-3 rounded-full bg-[#ff5d22] px-2.5 py-1 text-[10px] font-black text-white">-{off}%</span>}
      {product.is_featured && !off && <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-[#071426] px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-white"><Sparkles size={10} /> Destaque</span>}
    </div></Link>
    <div className="p-4"><p className="mb-1 text-[10px] font-bold uppercase tracking-[.11em] text-slate-400">{product.category_name || "Seleção da loja"}</p>
      <Link to={buildStorePath(slug, `/produto/${productRouteSegment(product)}`)} className="line-clamp-2 min-h-[2.7rem] text-[13px] font-bold leading-snug text-[#12213a] hover:text-blue-600">{product.name}</Link>
      <div className="mt-3 flex items-end justify-between gap-2"><div>{special && <p className="text-[10px] text-slate-400 line-through">{price(product.price)}</p>}<p className="font-mono text-base font-black tracking-tight" style={{ color: special ? "#ef4c23" : accent }}>{price(special || product.price)}</p><p className="text-[10px] text-slate-400">à vista</p></div>
        <button onClick={() => add(product)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow-lg transition-all hover:scale-105 active:scale-95" style={{ backgroundColor: accent, boxShadow: `0 10px 20px ${accent}33` }} aria-label={`Adicionar ${product.name} ao carrinho`}><ShoppingCart size={17} /></button>
      </div>
    </div>
  </motion.article>;
}

export default function StoreFront() {
  const { slug: routeSlug } = useParams();
  const { tenant, categories, products, addToCart, style } = useStore();
  const slug = resolveStoreSlug(routeSlug);
  const path = (suffix = "") => buildStorePath(slug, suffix);
  const active = products.filter(p => p.is_active && productHasStock(p));
  const offers = active.filter(p => p.discount_price);
  const featured = active.filter(p => p.is_featured);
  const showcase = [...offers, ...featured, ...active].filter((p, i, all) => all.findIndex(item => item.id === p.id) === i);
  const best = showcase.slice(0, tenant.bestseller_limit ?? 8);
  const hero = showcase.slice(0, 2);

  return <main className="overflow-hidden bg-[#f7f9fc]">
    <StoreSEO title={`${tenant.name} — Loja Online`} description={tenant.about_text || `Compre na ${tenant.name}: produtos selecionados, atendimento rápido e compra segura.`} url={typeof window !== "undefined" ? window.location.href : ""} siteName={tenant.name} keywords={`${tenant.name}, catálogo, produtos, loja online, ofertas`} />

    <section className="relative isolate overflow-hidden bg-[#071426] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_10%,rgba(28,112,255,.42),transparent_30%),radial-gradient(circle_at_90%_100%,rgba(255,105,29,.28),transparent_32%)]" />
      <div className="absolute -right-24 top-8 h-80 w-80 rounded-full border border-white/10" /><div className="absolute -right-8 top-24 h-80 w-80 rounded-full border border-white/5" />
      <div className="relative mx-auto grid max-w-7xl gap-10 px-5 pb-14 pt-12 sm:px-8 md:grid-cols-[minmax(0,1.04fr)_minmax(360px,.96fr)] md:items-center md:py-16 lg:px-10 lg:py-20">
        <div className="max-w-2xl">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 backdrop-blur"><Zap size={13} className="text-orange-300" fill="currentColor" /><span className="text-[10px] font-black uppercase tracking-[.18em] text-blue-100">Seleção pronta para você</span></motion.div>
          <motion.h1 initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .55, delay: .08 }} className="max-w-xl text-4xl font-black leading-[.98] tracking-[-.06em] sm:text-5xl lg:text-6xl">Tudo para o seu projeto, <span className="text-blue-200">em um só lugar.</span></motion.h1>
          <motion.p initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .55, delay: .15 }} className="mt-6 max-w-lg text-base leading-relaxed text-slate-300 sm:text-lg">Na {tenant.name}, você encontra produtos selecionados, preço justo e atendimento que acompanha a sua compra.</motion.p>
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .22 }} className="mt-8 flex flex-wrap gap-3"><Link to={path("/catalogo")} className="inline-flex h-12 items-center gap-2 rounded-xl px-5 text-sm font-black text-white shadow-xl transition-transform hover:-translate-y-0.5" style={{ backgroundColor: style.accent, boxShadow: `0 15px 30px ${style.accent}55` }}>Comprar agora <ArrowRight size={17} /></Link><Link to={path("/catalogo")} className="inline-flex h-12 items-center gap-2 rounded-xl border border-white/20 bg-white/5 px-5 text-sm font-bold text-white hover:bg-white/10"><Search size={16} /> Explorar catálogo</Link></motion.div>
          <div className="mt-9 grid max-w-xl grid-cols-1 gap-3 sm:grid-cols-3">{[{ icon: <ShieldCheck size={17} />, text: "Compra segura" }, { icon: <Truck size={17} />, text: "Atendimento rápido" }, { icon: <BadgeCheck size={17} />, text: "Produtos selecionados" }].map(item => <div key={item.text} className="flex items-center gap-2 text-xs font-semibold text-slate-300"><span className="text-blue-300">{item.icon}</span>{item.text}</div>)}</div>
        </div>
        <motion.div initial={{ opacity: 0, scale: .96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: .65, delay: .12 }} className="relative mx-auto w-full max-w-xl">
          {tenant.banner_url ? <div className="relative overflow-hidden rounded-[2rem] border border-white/15 bg-white/10 p-2 shadow-2xl backdrop-blur-sm"><img src={tenant.banner_url} alt={tenant.name} className="aspect-[1.25/1] w-full rounded-[1.5rem] object-cover" /><div className="absolute inset-x-2 bottom-2 rounded-b-[1.5rem] bg-gradient-to-t from-[#071426]/90 via-[#071426]/20 to-transparent p-6 pt-16"><p className="text-xs font-bold uppercase tracking-[.15em] text-blue-200">Catálogo online</p><p className="mt-1 text-xl font-black">Escolhas que fazem a diferença.</p></div></div> :
            hero.length ? <div className="grid min-h-[350px] grid-cols-2 gap-3 rounded-[2rem] border border-white/15 bg-white/10 p-3 shadow-2xl backdrop-blur-sm sm:min-h-[410px]">
              <div className="row-span-2 overflow-hidden rounded-[1.35rem] bg-white p-4">{(() => { const image = (Array.isArray(hero[0].images) && (hero[0].images as string[])[0]) || hero[0].image_url; return image ? <img src={image} alt={hero[0].name} className="h-full w-full object-contain" /> : <Package className="m-auto h-full text-slate-200" />; })()}</div>
              <div className="flex flex-col justify-between rounded-[1.35rem] bg-[#1463ff] p-5"><div><p className="text-[10px] font-black uppercase tracking-[.18em] text-blue-100">Ofertas da semana</p><p className="mt-2 text-3xl font-black tracking-[-.06em]">Produtos em destaque</p></div><Link to={path("/catalogo")} className="inline-flex items-center gap-1 text-xs font-black">Ver ofertas <ArrowRight size={14} /></Link></div>
              <div className="overflow-hidden rounded-[1.35rem] bg-[#eaf1ff] p-4">{hero[1] && (() => { const image = (Array.isArray(hero[1].images) && (hero[1].images as string[])[0]) || hero[1].image_url; return image ? <img src={image} alt={hero[1].name} className="h-full w-full object-contain" /> : <Package className="m-auto h-full text-slate-300" />; })()}</div>
            </div> : <div className="relative flex min-h-[350px] flex-col justify-end overflow-hidden rounded-[2rem] border border-white/15 bg-gradient-to-br from-[#1463ff] to-[#0b2c76] p-8 shadow-2xl"><Cable size={88} className="absolute right-8 top-8 text-white/15" strokeWidth={1} /><p className="text-[10px] font-black uppercase tracking-[.2em] text-blue-100">Catálogo em construção</p><p className="mt-3 max-w-sm text-3xl font-black tracking-[-.05em]">Uma experiência de compra feita para o seu ritmo.</p></div>}
        </motion.div>
      </div>
    </section>

    <section className="border-b border-slate-200 bg-white"><div className="mx-auto grid max-w-7xl grid-cols-2 divide-x divide-y divide-slate-100 px-5 sm:grid-cols-4 sm:divide-y-0 sm:px-8 lg:px-10">{[{ value: active.length, label: "Produtos disponíveis" }, { value: categories.length, label: "Categorias" }, { value: offers.length, label: "Ofertas ativas" }, { value: "100%", label: "Compra assistida" }].map(item => <div key={item.label} className="py-5 text-center sm:py-6"><p className="text-xl font-black tracking-tight text-[#071426] sm:text-2xl">{item.value}</p><p className="mt-1 text-[9px] font-bold uppercase tracking-[.12em] text-slate-500">{item.label}</p></div>)}</div></section>

    {categories.length > 0 && <section className="mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:px-10 lg:py-20"><Heading eyebrow="Encontre por categoria" title="O que você procura hoje?" description="Navegue pelas linhas da loja e encontre o item certo sem perder tempo." link={path("/catalogo")} accent={style.accent} /><div className="mt-9 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {categories.slice(0, 6).map((category, index) => { const count = active.filter(product => product.category_id === category.id).length; const first = active.find(product => product.category_id === category.id); const image = category.cover_url || (first && ((Array.isArray(first.images) && (first.images as string[])[0]) || first.image_url)); const color = category.color || style.accent; return <motion.div key={category.id} initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: index * .04 }}><Link to={path(`/catalogo?cat=${category.id}`)} className="group relative flex min-h-[155px] flex-col justify-end overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg">{image && <img src={image} alt="" className="absolute inset-0 h-full w-full object-cover opacity-[.14] transition duration-500 group-hover:scale-110 group-hover:opacity-[.22]" />}<div className="absolute inset-0 bg-gradient-to-t from-white via-white/85 to-white/15" /><span className="relative mb-auto flex h-10 w-10 items-center justify-center rounded-xl text-lg font-black" style={{ backgroundColor: `${color}18`, color }}>{category.name.charAt(0)}</span><div className="relative mt-4"><p className="line-clamp-2 text-sm font-black leading-tight text-[#12213a]">{category.name}</p><p className="mt-1 text-[10px] font-semibold text-slate-500">{count} {count === 1 ? "produto" : "produtos"}</p></div></Link></motion.div>; })}</div></section>}

    {offers.length > 0 && <section className="bg-[#071426] py-16 text-white lg:py-20"><div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10"><div className="mb-9 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-[.2em] text-orange-300"><Zap size={13} fill="currentColor" /> Oportunidades</p><h2 className="text-3xl font-black tracking-[-.05em] sm:text-4xl">Ofertas que valem a pena.</h2></div><Link to={path("/catalogo")} className="inline-flex items-center gap-1 text-xs font-black uppercase tracking-[.1em] text-blue-200 hover:text-white">Ver todas <ArrowRight size={15} /></Link></div><div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">{offers.slice(0, 4).map((product, index) => <Card key={product.id} product={product} slug={slug} accent={style.accent} add={addToCart} index={index} />)}</div></div></section>}

    <section className="mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:px-10 lg:py-20"><Heading eyebrow="Escolhas da loja" title="Produtos em destaque" description="Uma seleção prática de itens disponíveis para seu próximo projeto." link={path("/catalogo")} accent={style.accent} />{best.length ? <div className="mt-9 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">{best.map((product, index) => <Card key={product.id} product={product} slug={slug} accent={style.accent} add={addToCart} index={index} />)}</div> : <div className="mt-9 rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center"><Wrench size={36} className="mx-auto text-slate-300" /><p className="mt-4 text-sm font-bold text-slate-500">Os produtos desta loja aparecerão aqui em breve.</p></div>}</section>

    <section className="mx-auto max-w-7xl px-5 pb-16 sm:px-8 lg:px-10 lg:pb-20"><div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#1260ed] via-[#1654c7] to-[#071426] px-6 py-10 text-white sm:px-10 sm:py-12"><div className="absolute -right-14 -top-20 h-72 w-72 rounded-full border border-white/10" /><div className="relative max-w-2xl"><p className="text-[10px] font-black uppercase tracking-[.2em] text-blue-100">Catálogo sempre acessível</p><h2 className="mt-3 text-3xl font-black tracking-[-.05em] sm:text-4xl">Pronto para encontrar o produto ideal?</h2><p className="mt-3 text-sm leading-relaxed text-blue-100 sm:text-base">Explore o catálogo completo e peça atendimento quando precisar de uma orientação.</p><Link to={path("/catalogo")} className="mt-7 inline-flex h-11 items-center gap-2 rounded-xl bg-white px-5 text-sm font-black text-[#102a5b] transition-transform hover:-translate-y-0.5">Abrir catálogo <ArrowRight size={16} /></Link></div></div></section>
  </main>;
}
