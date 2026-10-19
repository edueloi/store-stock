import { Link } from "react-router-dom";
import { ArrowRight, HeartHandshake, MessageCircle, ShoppingBag, Sparkles } from "lucide-react";
import HeroSlider from "../../../../components/store/HeroSlider";
import StoreSEO from "../../../../components/store/StoreSEO";
import { productImage, useKit, whatsappLink } from "./kit";
import { Cloud, GiftCard, Star, tintOf } from "./parts";
import "./styles.css";

export default function StoreFront() {
  const { tenant, categories, active, path, sf } = useKit();
  const featuredAll = active.filter(p => p.is_featured);
  const featured = (featuredAll.length ? featuredAll : active).slice(0, 8);
  const cats = categories.map(c => ({ c, items: active.filter(p => p.category_id === c.id) }))
    .filter(x => x.items.length > 0).slice(0, 8);
  const wa = whatsappLink(tenant.whatsapp);
  const title = tenant.hero_tagline || "Para os primeiros grandes momentos.";
  const subtitle = tenant.about_text || "Enxoval, presentes e carinho em cada detalhe da infância.";
  const heroImage = tenant.banner_url || "/store-assets/baby-knit-hero-v1.png";

  return (
    <main className="bb-root bb-v2">
      <StoreSEO
        title={`${tenant.name} — ${sf.segment_label || "Bebês e enxoval"}`}
        description={subtitle.slice(0, 160)}
        image={tenant.banner_url || tenant.logo_url}
        url={typeof window !== "undefined" ? window.location.href : ""}
        siteName={tenant.name}
      />
      <HeroSlider
        slides={sf.hero_slides}
        autoplaySeconds={sf.hero_autoplay_seconds ?? 6}
        resolveUrl={(u) => (u.startsWith("/") ? path(u) : u)}
        layout="split"
        className="bb-slider"
        fallback={
          <section className="bb-hero bb-v2-hero" aria-labelledby="bb-v2-title">
            <div className="bb-hero-text">
              <p className="bb-kicker"><Sparkles size={14} aria-hidden="true" /> {sf.segment_label || "Bebês & Enxoval"}</p>
              <h1 id="bb-v2-title" className="bb-script">{title}</h1>
              <p className="bb-lead">{subtitle.length > 175 ? `${subtitle.slice(0, 172)}…` : subtitle}</p>
              <div className="bb-hero-actions">
                <Link to={path("/catalogo")} className="bb-btn bb-btn-main">
                  {sf.hero_button_label || "Explorar produtos"} <ArrowRight size={17} aria-hidden="true" />
                </Link>
                {wa && <a className="bb-btn bb-btn-ghost" href={wa} target="_blank" rel="noopener noreferrer">
                  <MessageCircle size={17} aria-hidden="true" /> Atendimento
                </a>}
              </div>
              <div className="bb-v2-highlights" aria-label="Destaques da loja">
                <span><HeartHandshake size={17} aria-hidden="true" /> Feito com carinho</span>
                <span><ShoppingBag size={17} aria-hidden="true" /> Escolha com facilidade</span>
              </div>
            </div>
            <div className="bb-v2-hero-art">
              <div className="bb-v2-hero-frame">
                <img src={heroImage} alt="" fetchPriority="high" />
              </div>
              <span className="bb-v2-hero-sticker" aria-hidden="true"><Star /> Com carinho</span>
            </div>
          </section>
        }
      />

      {cats.length > 0 && <section className="bb-section bb-v2-categories" aria-labelledby="bb-v2-categories-heading">
        <header className="bb-head">
          <p className="bb-kicker">Encontre o que procura</p>
          <h2 id="bb-v2-categories-heading" className="bb-script">{sf.home_categories_title || "Cada fase, um carinho"}</h2>
          <p>Navegue pelas categorias da nossa loja.</p>
        </header>
        <div className="bb-v2-category-grid">
          {cats.map(({c, items}, i) => {
            const image = productImage(items[0]);
            return <Link key={c.id} className={`bb-v2-category ${tintOf(i)}`} to={path(`/catalogo?cat=${c.id}`)}>
              <span className="bb-v2-category-photo">{image ? <img src={image} alt="" loading="lazy" /> : <Star />}</span>
              <span className="bb-v2-category-title">{c.name}</span>
              <span className="bb-v2-category-count">{items.length} {items.length === 1 ? "produto" : "produtos"}</span>
            </Link>;
          })}
        </div>
      </section>}

      <section className="bb-section bb-section-tint bb-v2-featured" aria-labelledby="bb-v2-featured-heading">
        <header className="bb-head">
          <p className="bb-kicker">Seleção especial</p>
          <h2 id="bb-v2-featured-heading" className="bb-script">{sf.home_featured_title || "Detalhes que acolhem"}</h2>
          <p>Descubra os produtos em destaque.</p>
        </header>
        {featured.length ? <div className="bb-grid">{featured.map((p,i) => <GiftCard key={p.id} product={p} index={i} />)}</div>
          : <div className="bb-empty"><Cloud className="bb-empty-cloud" /><p>Ainda estamos preparando o catálogo. Volte em breve!</p></div>}
        {active.length > featured.length && <div className="bb-center"><Link to={path("/catalogo")} className="bb-btn bb-btn-main">Ver todos os produtos <ArrowRight size={17} /></Link></div>}
      </section>

      <section className="bb-v2-story" aria-labelledby="bb-v2-story-heading">
        <div className="bb-v2-story-content">
          <p className="bb-kicker">Nossa história</p>
          <h2 id="bb-v2-story-heading" className="bb-script">{sf.about_title || `Conheça a ${tenant.name}`}</h2>
          <p>{subtitle}</p>
          <Link to={path("/sobre")} className="bb-btn bb-btn-soft">Saiba mais <ArrowRight size={17} /></Link>
        </div>
      </section>
    </main>
  );
}
