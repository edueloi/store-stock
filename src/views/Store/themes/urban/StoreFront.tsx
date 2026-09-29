import { Link, useParams } from "react-router-dom";
import { ArrowUpRight, ChevronRight, Heart, ShoppingBag, Sparkles, Star, Truck } from "lucide-react";
import { motion } from "motion/react";
import StoreSEO from "../../../../components/store/StoreSEO";
import { useStore } from "../../StoreLayout";
import { buildStorePath, productRouteSegment, resolveStoreSlug } from "../../store-routing";
import { productHasStock } from "../../../../utils/productStock";

function price(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export default function StoreFront() {
  const { slug: routeSlug } = useParams();
  const { tenant, products, categories, addToCart, wishlist, toggleWishlist } = useStore();
  const slug = resolveStoreSlug(routeSlug);
  const path = (suffix = "") => buildStorePath(slug, suffix);
  const active = products.filter(product => product.is_active && productHasStock(product));
  const featured = (active.filter(product => product.is_featured).length ? active.filter(product => product.is_featured) : active).slice(0, 4);
  const curatedCategories = categories.slice(0, 4);
  const heroImage = tenant.banner_url || "/store-assets/urban-fashion-hero.png";

  return (
    <div className="bg-[#f5f0e9] text-[#1b1714] overflow-hidden">
      <StoreSEO
        title={`${tenant.name} — moda e acessórios`}
        description={tenant.about_text || `Descubra as novidades, roupas e acessórios da ${tenant.name}.`}
        image={heroImage}
        url={typeof window !== "undefined" ? window.location.href : ""}
        siteName={tenant.name}
      />

      <section className="px-3 pt-3 md:px-6 md:pt-6">
        <div className="relative min-h-[590px] overflow-hidden bg-[#c76532] md:min-h-[650px]">
          <img src={heroImage} alt="Coleção em destaque" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(27,23,20,.60)_0%,rgba(27,23,20,.12)_45%,transparent_75%)]" />
          <div className="relative z-10 flex min-h-[590px] max-w-7xl items-end px-6 pb-8 md:min-h-[650px] md:px-12 md:pb-12">
            <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} className="max-w-xl text-white">
              <p className="mb-5 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.28em] text-white/75"><Sparkles size={13} /> Nova cápsula 2026</p>
              <h1 className="font-serif text-6xl leading-[.78] tracking-[-.075em] sm:text-7xl md:text-[7.6rem]">Vista o<br />seu agora.</h1>
              <p className="mt-7 max-w-sm text-sm leading-relaxed text-white/85">Peças essenciais, acessórios marcantes e uma curadoria feita para acompanhar seu ritmo.</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link to={path("/catalogo")} className="flex h-12 items-center gap-3 bg-white px-5 text-[10px] font-black uppercase tracking-[.18em] text-[#1b1714] transition-transform hover:-translate-y-1">
                  Explorar coleção <ArrowUpRight size={15} />
                </Link>
                {tenant.whatsapp && <a href={`https://wa.me/${tenant.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" className="flex h-12 items-center border border-white/50 px-5 text-[10px] font-bold uppercase tracking-[.18em] transition-colors hover:bg-white hover:text-[#1b1714]">Falar com stylist</a>}
              </div>
            </motion.div>
          </div>
          <div className="absolute right-4 top-4 bg-[#194aa4] px-4 py-3 text-[10px] font-black uppercase tracking-[.15em] text-white md:right-8 md:top-8">Frete especial<br />em todo Brasil</div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-16 md:py-24">
        <div className="mb-8 flex items-end justify-between gap-4 md:mb-12">
          <div><p className="text-[10px] font-bold uppercase tracking-[.28em] text-[#c76532]">Por onde começar</p><h2 className="mt-2 font-serif text-5xl leading-none tracking-[-.06em] md:text-6xl">Escolha seu mood.</h2></div>
          <Link to={path("/catalogo")} className="hidden items-center gap-1 text-[10px] font-bold uppercase tracking-[.18em] md:flex">Ver tudo <ChevronRight size={14} /></Link>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-5">
          {curatedCategories.map((category, index) => {
            const image = category.cover_url || active.find(product => product.category_id === category.id)?.image_url;
            return <Link key={category.id} to={path(`/catalogo?cat=${category.id}`)} className="group relative aspect-[3/4] overflow-hidden bg-[#e7d6c8]">
              {image ? <img src={image} alt={category.name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110" /> : <div className="h-full w-full bg-[linear-gradient(145deg,#dfb99a,#9b4d2b)]" />}
              <div className="absolute inset-0 bg-gradient-to-t from-[#1b1714]/70 via-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-4 text-white"><span className="text-[10px] font-bold text-white/70">0{index + 1}</span><p className="mt-1 text-xl font-semibold leading-none">{category.name}</p><span className="mt-3 inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-[.15em]">Ver peças <ArrowUpRight size={12} /></span></div>
            </Link>;
          })}
        </div>
      </section>

      <section className="border-y border-[#d8cbbf] bg-[#ebe2d8] py-4 text-[#4d433b]">
        <div className="mx-auto flex max-w-7xl flex-wrap justify-around gap-x-10 gap-y-3 px-6 text-center text-[10px] font-bold uppercase tracking-[.14em]">
          <span className="flex items-center gap-2"><Truck size={14} /> Envio seguro</span><span>Troca descomplicada</span><span>Pagamento protegido</span><span>Atendimento humano</span>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-16 md:py-24">
        <div className="mb-8 flex items-end justify-between md:mb-12"><div><p className="text-[10px] font-bold uppercase tracking-[.28em] text-[#194aa4]">Seleção da semana</p><h2 className="mt-2 font-serif text-5xl leading-none tracking-[-.06em] md:text-6xl">Feito para sair.</h2></div><Link to={path("/catalogo")} className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-[.18em]">Ver catálogo <ChevronRight size={14} /></Link></div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-8 md:grid-cols-4 md:gap-x-5">
          {featured.map((product, index) => {
            const image = (Array.isArray(product.images) && product.images[0]) || product.image_url;
            const sale = product.discount_price ? Number(product.discount_price) : Number(product.price);
            return <motion.article key={product.id} initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: index * .05 }} className="group min-w-0">
              <div className="relative aspect-[4/5] overflow-hidden bg-[#dfd3c5]">
                <Link to={path(`/produto/${productRouteSegment(product)}`)}>{image ? <img src={image} alt={product.name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" /> : <div className="h-full w-full bg-[#d8c4b4]" />}</Link>
                {product.discount_price && <span className="absolute left-3 top-3 bg-[#c76532] px-2 py-1 text-[8px] font-black uppercase tracking-wider text-white">Oferta</span>}
                <button onClick={() => toggleWishlist(product.id)} className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center bg-white/90 text-[#1b1714] transition-transform hover:scale-110"><Heart size={14} fill={wishlist.includes(product.id) ? "currentColor" : "none"} /></button>
                <button onClick={() => addToCart(product)} className="absolute bottom-3 left-3 right-3 flex h-10 translate-y-14 items-center justify-center gap-2 bg-[#1b1714] text-[9px] font-black uppercase tracking-[.16em] text-white transition-transform duration-300 group-hover:translate-y-0"><ShoppingBag size={13} /> Adicionar</button>
              </div>
              <div className="pt-3"><p className="text-[9px] font-bold uppercase tracking-[.16em] text-[#847569]">{product.category_name || "Coleção"}</p><Link to={path(`/produto/${productRouteSegment(product)}`)} className="mt-1 block text-sm font-semibold leading-snug hover:underline">{product.name}</Link><div className="mt-2 flex items-center gap-2"><strong className="text-sm">{price(sale)}</strong>{product.discount_price && <span className="text-[10px] text-[#8f8176] line-through">{price(Number(product.price))}</span>}</div></div>
            </motion.article>;
          })}
        </div>
        {featured.length === 0 && <div className="border border-dashed border-[#cdbdad] py-16 text-center text-sm text-[#847569]">Cadastre produtos ativos para montar a seleção.</div>}
      </section>

      <section className="grid bg-[#194aa4] text-white md:grid-cols-2">
        <div className="p-9 md:p-16"><p className="text-[10px] font-bold uppercase tracking-[.28em] text-white/65">Clube {tenant.name}</p><h2 className="mt-4 max-w-md font-serif text-5xl leading-[.85] tracking-[-.06em] md:text-7xl">Novidades no seu radar.</h2><p className="mt-6 max-w-sm text-sm leading-relaxed text-white/80">Receba os lançamentos e seleções especiais antes de todo mundo.</p></div>
        <div className="flex items-center p-9 md:p-16"><div className="w-full border-b border-white/60 pb-3"><div className="flex items-center justify-between"><span className="text-sm text-white/70">seu melhor e-mail</span><ArrowUpRight /></div></div></div>
      </section>
    </div>
  );
}
