import { Link } from "react-router-dom";
import { ArrowRight, Heart, Sprout, TreeDeciduous } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import HeroSlider from "../../../../components/store/HeroSlider";
import { StoreButton } from "../../../../components/store/StoreButton";
import { pageUrl, productImage, useShop } from "./core";
import { Leaf, ProductCard, Seal, T, Wave } from "./parts";

const VALUES = [
  { icon: Leaf, title: "Seleção cuidadosa", text: "Escolhemos cada item com critério e carinho." },
  { icon: Sprout, title: "Origem em primeiro lugar", text: "Valorizamos quem produz e como é produzido." },
  { icon: Heart, title: "Atendimento próximo", text: "Gente de verdade do pedido à entrega." },
  { icon: TreeDeciduous, title: "Feito com calma", text: "Sem pressa, com atenção aos detalhes." },
];

export default function StoreFront() {
  const { tenant, categories, active, config, path } = useShop();
  const featured = active.filter((p) => p.is_featured);
  const shelf = (featured.length ? featured : active).slice(0, 8);
  const cats = categories.filter((c) => active.some((p) => p.category_id === c.id));
  const art = tenant.banner_url || productImage(shelf[0]);

  const fallback = (
    <section className="or-hero">
      <div className="or-hero-copy">
        <span className="or-over">{config.segment_label || T.tag}</span>
        <h1>{tenant.hero_tagline || T.hero}</h1>
        <p>{T.sub}</p>
        <StoreButton asChild size="lg" className="or-cta">
          <Link to={path("/catalogo")}>{config.hero_button_label || "Conheça a seleção"} <ArrowRight size={18} aria-hidden="true" /></Link>
        </StoreButton>
      </div>
      <div className="or-hero-art">
        <div className="or-blob">{art ? <img src={art} alt="" /> : <Leaf size={90} />}</div>
        <Seal className="or-seal-float" />
      </div>
    </section>
  );

  return (
    <div className="or or-page">
      <StoreSEO title={`${tenant.name} | ${config.segment_label || T.tag}`} description={tenant.about_text || T.sub} image={tenant.banner_url} siteName={tenant.name} url={pageUrl()} />

      <div className="or-wrap" data-no-fx>
        <HeroSlider
          slides={config.hero_slides}
          autoplaySeconds={config.hero_autoplay_seconds ?? 6}
          resolveUrl={(u) => (u.startsWith("/") ? path(u) : u)}
          layout="banner"
          className="or-slider"
          fallback={fallback}
        />
      </div>

      {cats.length > 0 && (
        <section className="or-wrap or-block">
          <header className="or-sechead"><h2>{config.home_categories_title || T.categories}</h2></header>
          <div className="or-collections">
            {cats.map((c) => (
              <Link key={c.id} to={path(`/catalogo?cat=${c.id}`)} className="or-coll">
                <span className="or-coll-leaf">{c.cover_url ? <img src={c.cover_url} alt="" loading="lazy" /> : <Leaf size={36} />}</span>
                <b>{c.name}</b>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="or-band">
        <Wave fill="var(--or-sand)" />
        <div className="or-band-in or-wrap">
          <header className="or-sechead"><h2>{config.home_featured_title || T.featured}</h2></header>
          {shelf.length ? (
            <div className="or-grid">{shelf.map((p, i) => <ProductCard key={p.id} product={p} index={i} />)}</div>
          ) : (
            <p className="or-empty">Em breve, novas escolhas por aqui.</p>
          )}
          <div className="or-center">
            <StoreButton asChild variant="outline" className="or-line">
              <Link to={path("/catalogo")}>Ver todo o catálogo</Link>
            </StoreButton>
          </div>
        </div>
        <Wave fill="var(--or-sand)" flip />
      </section>

      <section className="or-wrap or-block">
        <ul className="or-values">
          {VALUES.map(({ icon: Icon, title, text }) => (
            <li key={title}>
              <span className="or-values-ico"><Icon size={22} aria-hidden="true" /></span>
              <b>{title}</b>
              <p>{text}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="or-wrap or-story">
        <div className="or-blob or-blob-b">{tenant.logo_url ? <img className="or-contain" src={tenant.logo_url} alt="" /> : <Leaf size={70} />}</div>
        <div>
          <span className="or-over">{config.about_title || "Nossa origem"}</span>
          <h2>{tenant.name}</h2>
          <p>{tenant.about_text || T.sub}</p>
          <Link to={path("/sobre")} className="or-textlink">Conheça a loja <ArrowRight size={16} aria-hidden="true" /></Link>
        </div>
      </section>
    </div>
  );
}
