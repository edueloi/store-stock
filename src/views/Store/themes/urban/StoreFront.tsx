import { Link, useParams } from "react-router-dom";
import {
  ArrowUpRight,
  ChevronRight,
  Heart,
  MessageCircle,
  ShoppingBag,
  Sparkles,
  ShieldCheck,
  Truck,
} from "lucide-react";
import { motion } from "motion/react";
import StoreSEO from "../../../../components/store/StoreSEO";
import { useStore } from "../../StoreLayout";
import {
  buildStorePath,
  productRouteSegment,
  resolveStoreSlug,
} from "../../store-routing";
import { productHasStock } from "../../../../utils/productStock";

function price(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export default function StoreFront() {
  const { slug: routeSlug } = useParams();
  const { tenant, products, categories, addToCart, wishlist, toggleWishlist } =
    useStore();
  const slug = resolveStoreSlug(routeSlug);
  const path = (suffix = "") => buildStorePath(slug, suffix);
  const active = products.filter(
    (product) => product.is_active && productHasStock(product),
  );
  const featured = (
    active.filter((product) => product.is_featured).length
      ? active.filter((product) => product.is_featured)
      : active
  ).slice(0, 4);
  const curatedCategories = categories
    .filter((category) =>
      active.some((product) => product.category_id === category.id),
    )
    .slice(0, 4);
  const heroImage = tenant.banner_url || "/store-assets/urban-fashion-hero.png";
  const accent = tenant.primary_color || "#2563eb";
  const heroTitle = tenant.hero_tagline || "Sua moda, sua assinatura.";
  const storefront = tenant.policies?.storefront || {};
  const categoriesTitle = storefront.home_categories_title || "Explore a loja.";
  const featuredTitle = storefront.home_featured_title || "Seleção da loja.";

  return (
    <div className="bg-white text-slate-900 overflow-hidden">
      <StoreSEO
        title={`${tenant.name} — moda e acessórios`}
        description={
          tenant.about_text ||
          `Descubra as novidades, roupas e acessórios da ${tenant.name}.`
        }
        image={heroImage}
        url={typeof window !== "undefined" ? window.location.href : ""}
        siteName={tenant.name}
      />

      <section className="px-3 pt-3 md:px-6 md:pt-6">
        <div
          className="relative min-h-[590px] overflow-hidden md:min-h-[650px]"
          style={{ backgroundColor: accent }}
        >
          <img
            src={heroImage}
            alt="Coleção em destaque"
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(27,23,20,.60)_0%,rgba(27,23,20,.12)_45%,transparent_75%)]" />
          <div className="relative z-10 flex min-h-[590px] max-w-7xl items-end px-6 pb-8 md:min-h-[650px] md:px-12 md:pb-12">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-xl text-white"
            >
              <p className="mb-5 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.28em] text-white/75">
                <Sparkles size={13} /> {tenant.name}
              </p>
              <h1 className="text-5xl font-bold leading-[.88] tracking-[-.07em] sm:text-7xl md:text-[6.4rem]">
                {heroTitle}
              </h1>
              <p className="mt-7 max-w-sm text-sm leading-relaxed text-white/85">
                {tenant.about_text ||
                  "Conheça as peças e acessórios selecionados para a sua loja."}
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  to={path("/catalogo")}
                  className="flex h-12 items-center gap-3 bg-white px-5 text-[10px] font-black uppercase tracking-[.18em] text-[#1b1714] transition-transform hover:-translate-y-1"
                >
                  Explorar coleção <ArrowUpRight size={15} />
                </Link>
                {tenant.whatsapp && (
                  <a
                    href={`https://wa.me/${tenant.whatsapp.replace(/\D/g, "")}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex h-12 items-center border border-white/50 px-5 text-[10px] font-bold uppercase tracking-[.18em] transition-colors hover:bg-white hover:text-[#1b1714]"
                  >
                    Falar com stylist
                  </a>
                )}
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-16 md:py-24">
        <div className="mb-8 flex items-end justify-between gap-4 md:mb-12">
          <div>
            <p
              className="text-[10px] font-bold uppercase tracking-[.28em]"
              style={{ color: accent }}
            >
              Categorias
            </p>
            <h2 className="mt-2 text-4xl font-bold leading-none tracking-[-.06em] md:text-5xl">
              {categoriesTitle}
            </h2>
          </div>
          <Link
            to={path("/catalogo")}
            className="hidden items-center gap-1 text-[10px] font-bold uppercase tracking-[.18em] md:flex"
          >
            Ver tudo <ChevronRight size={14} />
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-5">
          {curatedCategories.map((category, index) => {
            const image =
              category.cover_url ||
              active.find((product) => product.category_id === category.id)
                ?.image_url;
            return (
              <Link
                key={category.id}
                to={path(`/catalogo?cat=${category.id}`)}
                className="group relative aspect-[3/4] overflow-hidden bg-slate-100"
              >
                {image ? (
                  <img
                    src={image}
                    alt={category.name}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                ) : (
                  <div
                    className="h-full w-full"
                    style={{ backgroundColor: category.color || accent }}
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-[#1b1714]/70 via-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
                  <span className="text-[10px] font-bold text-white/70">
                    0{index + 1}
                  </span>
                  <p className="mt-1 text-xl font-semibold leading-none">
                    {category.name}
                  </p>
                  <span className="mt-3 inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-[.15em]">
                    Ver peças <ArrowUpRight size={12} />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {curatedCategories.length === 0 && (
        <section className="mx-auto max-w-7xl px-6 pb-16 text-sm text-slate-500">
          Crie categorias e vincule produtos em{" "}
          <strong>Catálogo → Categorias</strong> para exibi-las aqui.
        </section>
      )}

      <section className="mx-auto max-w-7xl px-6 py-16 md:py-24">
        <div className="mb-8 flex items-end justify-between md:mb-12">
          <div>
            <p
              className="text-[10px] font-bold uppercase tracking-[.28em]"
              style={{ color: accent }}
            >
              Produtos em destaque
            </p>
            <h2 className="mt-2 text-4xl font-bold leading-none tracking-[-.06em] md:text-5xl">
              {featuredTitle}
            </h2>
          </div>
          <Link
            to={path("/catalogo")}
            className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-[.18em]"
          >
            Ver catálogo <ChevronRight size={14} />
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-8 md:grid-cols-4 md:gap-x-5">
          {featured.map((product, index) => {
            const image =
              (Array.isArray(product.images) && product.images[0]) ||
              product.image_url;
            const sale = product.discount_price
              ? Number(product.discount_price)
              : Number(product.price);
            return (
              <motion.article
                key={product.id}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.05 }}
                className="group min-w-0"
              >
                <div className="relative aspect-[4/5] overflow-hidden bg-slate-100">
                  <Link to={path(`/produto/${productRouteSegment(product)}`)}>
                    {image ? (
                      <img
                        src={image}
                        alt={product.name}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="h-full w-full bg-slate-100" />
                    )}
                  </Link>
                  {product.discount_price && (
                    <span
                      className="absolute left-3 top-3 px-2 py-1 text-[8px] font-black uppercase tracking-wider text-white"
                      style={{ backgroundColor: accent }}
                    >
                      Oferta
                    </span>
                  )}
                  <button
                    onClick={() => toggleWishlist(product.id)}
                    className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center bg-white/90 text-[#1b1714] transition-transform hover:scale-110"
                  >
                    <Heart
                      size={14}
                      fill={
                        wishlist.includes(product.id) ? "currentColor" : "none"
                      }
                    />
                  </button>
                  <button
                    onClick={() => addToCart(product)}
                    className="absolute bottom-3 left-3 right-3 flex h-10 translate-y-14 items-center justify-center gap-2 bg-[#1b1714] text-[9px] font-black uppercase tracking-[.16em] text-white transition-transform duration-300 group-hover:translate-y-0"
                  >
                    <ShoppingBag size={13} /> Adicionar
                  </button>
                </div>
                <div className="pt-3">
                  <p className="text-[9px] font-bold uppercase tracking-[.16em] text-slate-500">
                    {product.category_name || "Coleção"}
                  </p>
                  <Link
                    to={path(`/produto/${productRouteSegment(product)}`)}
                    className="mt-1 block text-sm font-semibold leading-snug hover:underline"
                  >
                    {product.name}
                  </Link>
                  <div className="mt-2 flex items-center gap-2">
                    <strong className="text-sm">{price(sale)}</strong>
                    {product.discount_price && (
                      <span className="text-[10px] text-slate-400 line-through">
                        {price(Number(product.price))}
                      </span>
                    )}
                  </div>
                </div>
              </motion.article>
            );
          })}
        </div>
        {featured.length === 0 && (
          <div className="border border-dashed border-slate-300 py-16 text-center text-sm text-slate-500">
            Cadastre produtos ativos para montar a seleção.
          </div>
        )}
      </section>

      <section className="relative isolate overflow-hidden bg-[#071426] text-white">
        <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full opacity-30 blur-3xl" style={{ backgroundColor: accent }} />
        <div className="relative mx-auto grid max-w-7xl gap-9 px-6 py-12 sm:px-8 md:grid-cols-[1.05fr_1fr] md:items-center md:py-16">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[.26em] text-white/55">Comprar com tranquilidade</p>
            <h2 className="mt-3 max-w-lg text-3xl font-black leading-[.96] tracking-[-.055em] sm:text-5xl">Uma seleção feita para o seu ritmo.</h2>
            <p className="mt-5 max-w-md text-sm leading-relaxed text-white/70">Escolha suas peças com calma e conte com atendimento humano quando precisar.</p>
            {tenant.whatsapp ? (
              <a href={`https://wa.me/${tenant.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" className="mt-7 inline-flex h-11 items-center gap-2 rounded-full bg-white px-5 text-[10px] font-black uppercase tracking-[.15em] text-[#071426] transition-transform hover:-translate-y-0.5"><MessageCircle size={15} /> Falar no WhatsApp <ArrowUpRight size={14} /></a>
            ) : (
              <Link to={path("/catalogo")} className="mt-7 inline-flex h-11 items-center gap-2 rounded-full bg-white px-5 text-[10px] font-black uppercase tracking-[.15em] text-[#071426] transition-transform hover:-translate-y-0.5">Ver catálogo <ArrowUpRight size={14} /></Link>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-3 md:grid-cols-1">
            {[
              { icon: ShieldCheck, title: "Compra segura", text: "Seu pedido é revisado com cuidado." },
              { icon: MessageCircle, title: "Atendimento real", text: "Dúvidas? Chame a loja pelo WhatsApp." },
              { icon: Truck, title: "Entrega combinada", text: "Você acompanha tudo com a equipe." },
            ].map(({ icon: Icon, title, text }) => <div key={title} className="flex gap-4 rounded-2xl border border-white/10 bg-white/[.06] p-4 backdrop-blur-sm"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10"><Icon size={17} /></span><div><p className="text-sm font-bold">{title}</p><p className="mt-1 text-xs leading-relaxed text-white/60">{text}</p></div></div>)}
          </div>
        </div>
      </section>
    </div>
  );
}
