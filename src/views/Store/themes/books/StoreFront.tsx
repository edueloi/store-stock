import { useRef } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowRight, BookOpen, CreditCard, MessageCircle, Repeat, Truck } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import HeroSlider from "../../../../components/store/HeroSlider";
import { productRouteSegment } from "../../store-routing";
import { productImage, useKit, whatsappLink } from "./kit";
import { scrollByCard, useHeroMotion } from "./motion";
import { BookCard } from "./parts";
import type { Product } from "../../../../types";
import "./styles.css";

/** Prateleira horizontal com scroll-snap e setas; os livros "apoiam" na borda da estante. */
function Shelf({ title, kicker, to, items }: { title: string; kicker: string; to: string; items: Product[] }) {
  const track = useRef<HTMLDivElement>(null);
  return (
    <section className="bk-section">
      <header className="bk-head bk-head-row">
        <div>
          <span className="bk-kicker">{kicker}</span>
          <h2>{title}</h2>
        </div>
        <div className="bk-head-tools">
          <Link className="bk-link-all" to={to}>
            Ver todos <ArrowRight size={16} />
          </Link>
          <button type="button" className="bk-arrow" aria-label={`${title}: anteriores`} onClick={() => scrollByCard(track.current, -1)}>
            <ArrowLeft size={18} />
          </button>
          <button type="button" className="bk-arrow" aria-label={`${title}: próximos`} onClick={() => scrollByCard(track.current, 1)}>
            <ArrowRight size={18} />
          </button>
        </div>
      </header>
      <div className="bk-shelf" data-no-fx>
        <div className="bk-shelf-track" ref={track}>
          {items.map((p) => (
            <BookCard key={p.id} product={p} />
          ))}
        </div>
      </div>
    </section>
  );
}

export default function StoreFront() {
  const { tenant, categories, active, path, sf } = useKit();
  const heroRef = useRef<HTMLElement>(null);
  useHeroMotion(heroRef);
  const featured = [...active.filter((p) => p.is_featured), ...active.filter((p) => !p.is_featured)].slice(0, Math.max(tenant.featured_limit || 10, 6));
  const covers = featured.filter((p) => productImage(p)).slice(0, 3);
  const heroImage = tenant.banner_url;
  const genres = categories
    .map((c) => ({ c, items: active.filter((p) => p.category_id === c.id) }))
    .filter((x) => x.items.length > 0);
  const title = tenant.hero_tagline || "Sua próxima história começa aqui";
  const about = tenant.about_text || "Uma seleção cuidadosa de livros para ler, presentear e guardar na estante.";
  const wa = whatsappLink(tenant.whatsapp, `Olá! Vim pela loja ${tenant.name}.`);
  const trust = [
    { icon: Truck, text: "Envio e retirada" },
    { icon: CreditCard, text: "Várias formas de pagar" },
    { icon: Repeat, text: "Troca de exemplares" },
  ];

  const fallback = (
    <section className="bk-hero" ref={heroRef}>
      <div className="bk-hero-copy">
        <span className="bk-kicker" data-hero>
          {sf.segment_label || "Livraria"}
        </span>
        <h1 data-hero>{title}</h1>
        <p data-hero>{about}</p>
        <div className="bk-actions" data-hero>
          <Link className="bk-btn bk-btn-lg" to={path("/catalogo")}>
            {sf.hero_button_label || "Explorar a estante"} <ArrowRight size={18} />
          </Link>
          {wa && (
            <a className="bk-btn bk-btn-line bk-btn-lg" href={wa} target="_blank" rel="noreferrer">
              <MessageCircle size={18} /> Pedir uma indicação
            </a>
          )}
        </div>
      </div>
      <div className="bk-hero-art" data-parallax>
        {heroImage && <img className="bk-hero-banner" src={heroImage} alt="" />}
        <div className="bk-hero-shelf">
          {covers.length ? (
            covers.map((p, i) => (
              <Link key={p.id} className={`bk-lean bk-lean-${i}`} to={path(`/produto/${productRouteSegment(p)}`)} aria-label={p.name}>
                <img src={productImage(p)} alt="" />
              </Link>
            ))
          ) : (
            <span className="bk-lean bk-lean-1 bk-lean-empty">
              <BookOpen size={56} aria-label="Sem capas" />
            </span>
          )}
        </div>
      </div>
    </section>
  );

  return (
    <div className="bk-page bk-home">
      <StoreSEO
        title={`${tenant.name} | Livraria`}
        description={about}
        image={heroImage || tenant.logo_url}
        url={typeof window !== "undefined" ? window.location.href : ""}
        siteName={tenant.name}
      />

      <HeroSlider
        slides={sf.hero_slides}
        autoplaySeconds={sf.hero_autoplay_seconds ?? 6}
        resolveUrl={(u) => (u.startsWith("/") ? path(u) : u)}
        layout="split"
        className="bk-slider"
        fallback={fallback}
      />

      <ul className="bk-trust" aria-label="Diferenciais">
        {trust.map(({ icon: Icon, text }) => (
          <li key={text}>
            <Icon size={18} aria-hidden="true" /> {text}
          </li>
        ))}
      </ul>

      {featured.length > 0 ? (
        <Shelf title={sf.home_featured_title || "Na estante em destaque"} kicker="Seleção da casa" to={path("/catalogo")} items={featured} />
      ) : (
        <p className="bk-note">A estante está sendo organizada. Volte em breve!</p>
      )}

      {genres.length > 0 && (
        <section className="bk-section">
          <header className="bk-head">
            <span className="bk-kicker">Por gênero</span>
            <h2>{sf.home_categories_title || "Qual é o seu gênero favorito?"}</h2>
          </header>
          <div className="bk-spines">
            {genres.slice(0, 12).map(({ c, items }, i) => (
              <Link key={c.id} className={`bk-spine bk-spine-${i % 5}`} to={path(`/catalogo?categoria=${c.id}`)}>
                <span className="bk-spine-n">{items.length}</span>
                <strong>{c.name}</strong>
                <span className="bk-spine-go" aria-hidden="true">
                  <ArrowRight size={16} />
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {genres.slice(0, 3).map(({ c, items }) => (
        <Shelf key={c.id} title={c.name} kicker="Estante de gênero" to={path(`/catalogo?categoria=${c.id}`)} items={items.slice(0, 10)} />
      ))}

      <section className="bk-section">
        <div className="bk-cta">
          <div>
            <span className="bk-kicker">Precisa de uma dica?</span>
            <h2>Conte o que você gosta de ler</h2>
            <p>A gente indica o livro certo para você ou para presentear alguém.</p>
          </div>
          {wa ? (
            <a className="bk-btn bk-btn-lg" href={wa} target="_blank" rel="noreferrer">
              <MessageCircle size={18} /> Chamar no WhatsApp
            </a>
          ) : (
            <Link className="bk-btn bk-btn-lg" to={path("/sobre")}>
              Conheça a livraria
            </Link>
          )}
        </div>
      </section>
    </div>
  );
}
