import { useRef } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Clock, Coffee, CreditCard, MessageCircle, Repeat, Truck } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import HeroSlider from "../../../../components/store/HeroSlider";
import { hoursLines, productImage, useKit, whatsappLink } from "./kit";
import { useHeroMotion } from "./motion";
import { CountUp, ProductCard } from "./parts";
import "./styles.css";

export default function StoreFront() {
  const { tenant, categories, active, path, sf } = useKit();
  const heroRef = useRef<HTMLElement>(null);
  useHeroMotion(heroRef);
  const featured = [...active.filter((p) => p.is_featured), ...active.filter((p) => !p.is_featured)].slice(0, tenant.featured_limit || 8);
  const hero = featured.find((p) => productImage(p)) || featured[0];
  const heroImage = tenant.banner_url || productImage(hero);
  const cats = categories
    .map((c) => ({ c, items: active.filter((p) => p.category_id === c.id) }))
    .filter((x) => x.items.length > 0)
    .slice(0, 10);
  const title = tenant.hero_tagline || "Um cafezinho para cada momento do dia";
  const about = tenant.about_text || "Grãos selecionados, receitas caseiras e um cantinho aconchegante para pedir com calma.";
  const wa = whatsappLink(tenant.whatsapp, `Olá! Vim pela loja ${tenant.name}.`);
  const hours = hoursLines(tenant.business_hours).slice(0, 7);
  const trust = [
    { icon: Truck, text: "Entrega ou retirada" },
    { icon: CreditCard, text: "Pague como preferir" },
    { icon: Repeat, text: "Trocas facilitadas" },
  ];
  const sideImage = (cats[0] && (cats[0].c.cover_url || productImage(cats[0].items[0]))) || productImage(hero);

  const fallback = (
    <section className="cf-hero" ref={heroRef}>
      <div className="cf-hero-photo">
        {heroImage ? <img data-parallax src={heroImage} alt={hero?.name || tenant.name} /> : <Coffee size={110} aria-label="Sem imagem" />}
      </div>
      <div className="cf-hero-card">
        <span className="cf-hand" data-hero>
          {sf.segment_label || "Hoje no cardápio"}
        </span>
        <h1 data-hero>{title}</h1>
        <p data-hero>{about}</p>
        <div className="cf-actions" data-hero>
          <Link className="cf-btn cf-btn-lg" to={path("/catalogo")}>
            {sf.hero_button_label || "Ver o cardápio"} <ArrowRight size={18} />
          </Link>
          {wa && (
            <a className="cf-btn cf-btn-line cf-btn-lg" href={wa} target="_blank" rel="noreferrer">
              <MessageCircle size={18} /> Pedir pelo WhatsApp
            </a>
          )}
        </div>
      </div>
    </section>
  );

  return (
    <div className="cf-page cf-home">
      <StoreSEO
        title={`${tenant.name} | Cardápio`}
        description={about}
        image={heroImage || tenant.logo_url}
        url={typeof window !== "undefined" ? window.location.href : ""}
        siteName={tenant.name}
      />

      <HeroSlider
        slides={sf.hero_slides}
        autoplaySeconds={sf.hero_autoplay_seconds ?? 6}
        resolveUrl={(u) => (u.startsWith("/") ? path(u) : u)}
        layout="banner"
        className="cf-slider"
        fallback={fallback}
      />

      <div className="cf-stats" aria-label="Resumo da casa">
        <div>
          <CountUp value={active.length} />
          <span>itens no cardápio</span>
        </div>
        <div>
          <CountUp value={cats.length} />
          <span>seções para explorar</span>
        </div>
        {trust.map(({ icon: Icon, text }) => (
          <div key={text} className="cf-stat-trust">
            <Icon size={22} aria-hidden="true" />
            <span>{text}</span>
          </div>
        ))}
      </div>

      {cats.length > 0 && (
        <section className="cf-section">
          <header className="cf-head">
            <span className="cf-hand">o cardápio da casa</span>
            <h2>{sf.home_categories_title || "Escolha por seção"}</h2>
          </header>
          <div className="cf-board">
            <div className="cf-board-photo">{sideImage ? <img src={sideImage} alt="" loading="lazy" /> : <Coffee size={80} aria-hidden="true" />}</div>
            <ul className="cf-board-list">
              {cats.map(({ c, items }) => (
                <li key={c.id}>
                  <Link to={path(`/catalogo?categoria=${c.id}`)}>
                    <span className="cf-board-name">{c.name}</span>
                    <i aria-hidden="true" />
                    <span className="cf-board-count">
                      {items.length} {items.length === 1 ? "item" : "itens"}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {cats.length > 0 && (
        <div className="cf-marquee" data-no-fx aria-hidden="true">
          <div className="cf-marquee-track">
            {[0, 1].map((k) => (
              <div key={k}>
                {cats.map(({ c }) => (
                  <span key={`${k}-${c.id}`}>{c.name}</span>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      <section className="cf-section">
        <header className="cf-head cf-head-row">
          <div>
            <span className="cf-hand">quem pede, repete</span>
            <h2>{sf.home_featured_title || "Os favoritos da casa"}</h2>
          </div>
          <Link className="cf-btn cf-btn-line" to={path("/catalogo")}>
            Cardápio completo <ArrowRight size={17} />
          </Link>
        </header>
        {featured.length ? (
          <div className="cf-list">
            {featured.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        ) : (
          <p className="cf-note">O cardápio está sendo preparado. Volte em breve!</p>
        )}
      </section>

      <section className="cf-section">
        <div className="cf-visit">
          <div>
            <span className="cf-hand">venha tomar um café</span>
            <h2>Sua mesa está pronta</h2>
            <p>Peça por aqui e combine retirada ou entrega direto com a gente.</p>
            <div className="cf-actions">
              {wa ? (
                <a className="cf-btn cf-btn-lg" href={wa} target="_blank" rel="noreferrer">
                  <MessageCircle size={18} /> Chamar no WhatsApp
                </a>
              ) : (
                <Link className="cf-btn cf-btn-lg" to={path("/sobre")}>
                  Conheça a casa
                </Link>
              )}
            </div>
          </div>
          {hours.length > 0 && (
            <dl className="cf-hours cf-hours-card">
              <dt className="cf-hours-title">
                <Clock size={16} aria-hidden="true" /> Horários
              </dt>
              {hours.map((h) => (
                <div key={h.day}>
                  <dt>{h.day}</dt>
                  <dd>{h.text}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      </section>
    </div>
  );
}
