import { Link, useParams } from "react-router-dom";
import { ArrowRight, BadgeCheck, ChevronRight, Headphones, MapPin, PackageCheck, ShieldCheck } from "lucide-react";
import HeroSlider from "../../../../components/store/HeroSlider";
import StoreSEO from "../../../../components/store/StoreSEO";
import { useStore } from "../../StoreLayout";
import { buildStorePath, resolveStoreSlug } from "../../store-routing";
import { MarketCard, marketHide, marketImage } from "./ThemeParts";

const BENEFITS = [
  { Icon: PackageCheck, title: "Pedido online", text: "Compre direto pela loja" },
  { Icon: ShieldCheck, title: "Compra acompanhada", text: "Confirmação e atendimento" },
  { Icon: BadgeCheck, title: "Catálogo atualizado", text: "Produtos disponíveis" },
  { Icon: Headphones, title: "Suporte da loja", text: "WhatsApp quando precisar" },
];

export default function StoreFront() {
  const { slug: routeSlug } = useParams();
  const { tenant, products, categories, addToCart, wishlist, toggleWishlist } = useStore();
  const slug = resolveStoreSlug(routeSlug);
  const path = (suffix = "") => buildStorePath(slug, suffix);
  const active = products.filter((p) => p.is_active);
  const featuredList = active.filter((p) => p.is_featured);
  const featured = (featuredList.length ? featuredList : active).slice(0, 10);
  const shownCategories = categories.filter((c) => active.some((p) => p.category_id === c.id)).slice(0, 12);
  const hero = tenant.banner_url || marketImage(featured[0]);
  const hidePrices = marketHide(tenant);
  const sf = tenant.policies?.storefront || {};

  return (
    <main className="mk-page">
      <StoreSEO
        title={`${tenant.name} | Loja online`}
        description={tenant.about_text || `Compre online na ${tenant.name}.`}
        image={hero}
        url={typeof window !== "undefined" ? window.location.href : ""}
        siteName={tenant.name}
      />

      <section className="mk-wrap mk-hero-wrap">
        <HeroSlider
          slides={sf.hero_slides}
          autoplaySeconds={sf.hero_autoplay_seconds ?? 6}
          resolveUrl={(u) => (u.startsWith("/") ? path(u) : u)}
          layout="banner"
          className="mk-slider"
          fallback={
          <div className="mk-hero">
            <div className="mk-hero-text">
              <span className="mk-pill">Loja online segura</span>
              <h1>{tenant.hero_tagline || "Encontre o que precisa em um só lugar."}</h1>
              <p>{tenant.about_text || "Produtos selecionados, catálogo sempre atualizado e atendimento direto da loja."}</p>
              <Link to={path("/catalogo")} className="mk-cta">
                Ver ofertas <ArrowRight size={16} />
              </Link>
            </div>
            <div className="mk-hero-media">
              <div className="mk-hero-blob" aria-hidden="true" />
              {hero ? <img src={hero} alt="Destaque da loja" /> : <PackageCheck size={72} />}
            </div>
          </div>
          }
        />
      </section>

      <section className="mk-wrap mk-benefits">
        {BENEFITS.map(({ Icon, title, text }) => (
          <div key={title} className="mk-benefit">
            <span className="mk-benefit-icon"><Icon size={20} /></span>
            <div>
              <strong>{title}</strong>
              <small>{text}</small>
            </div>
          </div>
        ))}
      </section>

      {shownCategories.length > 0 && (
        <section className="mk-wrap mk-section">
          <div className="mk-section-head">
            <h2>Compre por categoria</h2>
            <Link to={path("/catalogo")}>Ver tudo <ChevronRight size={16} /></Link>
          </div>
          <div className="mk-cats">
            {shownCategories.map((c) => {
              const sample = active.find((p) => p.category_id === c.id);
              const image = sample && marketImage(sample);
              return (
                <Link key={c.id} to={path(`/catalogo?cat=${c.id}`)} className="mk-cat">
                  <span className="mk-cat-img">
                    {image ? <img src={image} alt="" loading="lazy" /> : <PackageCheck size={26} />}
                  </span>
                  <span className="mk-cat-name">{c.name}</span>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <section className="mk-wrap mk-section">
        <div className="mk-section-head">
          <h2>Produtos em destaque</h2>
          <Link to={path("/catalogo")}>Ver catálogo <ChevronRight size={16} /></Link>
        </div>
        <div className="mk-grid">
          {featured.map((p) => (
            <MarketCard
              key={p.id}
              product={p}
              path={path}
              category={categories.find((c) => c.id === p.category_id)?.name}
              saved={wishlist.includes(p.id)}
              onFavorite={() => toggleWishlist(p.id)}
              onAdd={() => addToCart(p)}
              hidePrices={hidePrices}
            />
          ))}
        </div>
      </section>

      <section className="mk-wrap mk-section">
        <div className="mk-address">
          <MapPin size={20} />
          <span>{tenant.address || "Atendimento online para sua região."}</span>
        </div>
      </section>
    </main>
  );
}
