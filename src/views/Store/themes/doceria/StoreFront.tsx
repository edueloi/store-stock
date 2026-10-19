import { useRef } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowRight, BadgeCheck, CakeSlice, Cookie, Gift, Heart, MessageCircle, Sparkles, Truck } from "lucide-react";
import { scrollByCard, useHeroMotion } from "./motion";
import StoreSEO from "../../../../components/store/StoreSEO";
import HeroSlider from "../../../../components/store/HeroSlider";
import { productRouteSegment } from "../../store-routing";
import { productImage, useKit, whatsappLink } from "./kit";
import { CategoryImage, ProductCard } from "./parts";
import "./styles.css";

export default function StoreFront() {
  const { tenant, categories, active, path, sf } = useKit();
  const featured = [...active.filter((p) => p.is_featured), ...active.filter((p) => !p.is_featured)].slice(0, tenant.featured_limit || 8);
  const withPhoto = featured.filter((p) => productImage(p));
  const hero = withPhoto[0] || featured[0];
  const heroImage = tenant.banner_url || productImage(hero);
  const mini = withPhoto.slice(1, 3);
  const cats = categories.filter((c) => active.some((p) => p.category_id === c.id)).slice(0, 14);
  const title = tenant.hero_tagline || "Doces que abraçam o coração";
  const about = tenant.about_text || "Confeitaria artesanal feita com ingredientes selecionados, muito açúcar de carinho e capricho em cada detalhe.";
  const wa = whatsappLink(tenant.whatsapp, `Olá! Quero fazer uma encomenda na ${tenant.name}.`);
  const steps = [
    { icon: Cookie, title: "Escolha os doces", text: "Passeie pelo cardápio e separe seus favoritos." },
    { icon: Gift, title: "Monte o pedido", text: "Adicione à sacola e conte os detalhes da encomenda." },
    { icon: Sparkles, title: "Combine a entrega", text: "A confeitaria confirma data, retirada e pagamento." },
  ];

  const heroRef = useRef<HTMLElement>(null);
  useHeroMotion(heroRef);
  const catsRef = useRef<HTMLDivElement>(null);
  const trust = [
    { icon: Heart, text: "Feito à mão, com carinho" },
    { icon: Truck, text: "Entrega e retirada combinadas" },
    { icon: BadgeCheck, text: "Ingredientes selecionados" },
    { icon: Gift, text: "Embalagem para presente" },
  ];

  const fallback = (
    <section className="dc-hero" ref={heroRef}>
      <div className="dc-hero-copy">
        <span className="dc-kicker" data-hero>
          <Sparkles size={15} aria-hidden="true" /> {sf.segment_label || "Confeitaria artesanal"}
        </span>
        <h1 data-hero>{title}</h1>
        <p data-hero>{about}</p>
        <div className="dc-actions" data-hero>
          <Link className="dc-btn dc-btn-lg" to={path("/catalogo")}>
            {sf.hero_button_label || "Ver o cardápio"} <ArrowRight size={19} />
          </Link>
          {wa && (
            <a className="dc-btn dc-btn-soft dc-btn-lg" href={wa} target="_blank" rel="noreferrer">
              <MessageCircle size={19} /> Fazer encomenda
            </a>
          )}
        </div>
      </div>
      <div className="dc-hero-art">
        <div className="dc-blob">{heroImage ? <img data-parallax src={heroImage} alt={hero?.name || tenant.name} /> : <CakeSlice size={96} aria-label="Sem imagem" />}</div>
        {mini.map((p, i) => (
          <Link key={p.id} className={`dc-mini dc-mini-${i}`} to={path(`/produto/${productRouteSegment(p)}`)} aria-label={p.name}>
            <img src={productImage(p)} alt="" loading="lazy" />
          </Link>
        ))}
        <span className="dc-sticker" aria-hidden="true">
          feito
          <br />à mão
        </span>
      </div>
    </section>
  );

  return (
    <div className="dc-page dc-home">
      <StoreSEO
        title={`${tenant.name} | Confeitaria`}
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
        className="dc-slider"
        fallback={fallback}
      />

      <ul className="dc-trust" aria-label="Diferenciais">
        {trust.map(({ icon: Icon, text }) => (
          <li key={text}>
            <Icon size={18} aria-hidden="true" /> {text}
          </li>
        ))}
      </ul>

      {cats.length > 0 && (
        <section className="dc-section">
          <header className="dc-head">
            <span className="dc-kicker">Sabores</span>
            <h2>{sf.home_categories_title || "Qual é o doce de hoje?"}</h2>
          </header>
          {cats.length > 5 && (
            <div className="dc-arrows">
              <button type="button" aria-label="Categorias anteriores" onClick={() => scrollByCard(catsRef.current, -1)}>
                <ArrowLeft size={18} />
              </button>
              <button type="button" aria-label="Próximas categorias" onClick={() => scrollByCard(catsRef.current, 1)}>
                <ArrowRight size={18} />
              </button>
            </div>
          )}
          <div className="dc-cats" data-no-fx ref={catsRef}>
            {cats.map((c) => {
              const sample = active.find((p) => p.category_id === c.id);
              return (
                <Link key={c.id} className="dc-cat" to={path(`/catalogo?categoria=${c.id}`)}>
                  <CategoryImage src={c.cover_url || productImage(sample)} />
                  <strong>{c.name}</strong>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <section className="dc-section">
        <header className="dc-head dc-head-row">
          <div>
            <span className="dc-kicker">Vitrine</span>
            <h2>{sf.home_featured_title || "Fresquinhos da vitrine"}</h2>
          </div>
          <Link className="dc-btn dc-btn-soft" to={path("/catalogo")}>
            Ver tudo <ArrowRight size={17} />
          </Link>
        </header>
        {featured.length ? (
          <div className="dc-grid">
            {featured.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        ) : (
          <p className="dc-note">Os doces estão no forno. Volte em breve!</p>
        )}
      </section>

      <section className="dc-section">
        <div className="dc-order">
          <header className="dc-head">
            <span className="dc-kicker">Encomendas</span>
            <h2>Do pedido à mesa, sem complicação</h2>
          </header>
          <ol className="dc-steps">
            {steps.map(({ icon: Icon, title: t, text }, i) => (
              <li key={t}>
                <span className="dc-step-icon">
                  <Icon size={26} aria-hidden="true" />
                </span>
                <h3>
                  {i + 1}. {t}
                </h3>
                <p>{text}</p>
              </li>
            ))}
          </ol>
          <div className="dc-actions dc-actions-center">
            {wa ? (
              <a className="dc-btn dc-btn-lg" href={wa} target="_blank" rel="noreferrer">
                <MessageCircle size={19} /> Chamar no WhatsApp
              </a>
            ) : (
              <Link className="dc-btn dc-btn-lg" to={path("/catalogo")}>
                Ver o cardápio <ArrowRight size={19} />
              </Link>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
