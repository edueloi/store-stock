import { useRef } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, MessageCircle, Shirt, Sparkles } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import HeroSlider from "../../../../components/store/HeroSlider";
import { StoreButton } from "../../../../components/store/StoreButton";
import { productRouteSegment } from "../../store-routing";
import { productImage, useKit, whatsappLink } from "./kit";
import { ProductCard, TrustRow, categoryImage, useHeroMotion } from "./shared";
import "./styles.css";

export default function StoreFront() {
  const { tenant, categories, active, path, sf } = useKit();
  const heroRef = useRef<HTMLElement>(null);
  useHeroMotion(heroRef);
  const featured = [...active.filter((p) => p.is_featured), ...active.filter((p) => !p.is_featured)].slice(0, tenant.featured_limit || 8);
  const hero = active.find((p) => p.is_featured) || active[0];
  const heroImage = productImage(hero) || tenant.banner_url || "";
  const cats = categories.filter((c) => active.some((p) => p.category_id === c.id));
  const title = tenant.hero_tagline || "Feito para sair do padrão";
  const about = tenant.about_text || "Moda de rua para quem vive a cidade. Peças novas toda semana.";
  const wa = whatsappLink(tenant.whatsapp, `Olá! Vim pela loja ${tenant.name}.`);
  const ticker = [...cats.map((c) => c.name), "Novo drop", "Peças limitadas"];

  const fallback = (
    <section className="sd-hero" ref={heroRef}>
      <div className="sd-hero-copy">
        <span className="sd-tag" data-hero-in>
          <Sparkles size={14} /> Drop da semana · {active.length} peças
        </span>
        <h1 data-hero-in>{title}</h1>
        <p data-hero-in>{about}</p>
        <div className="sd-actions" data-hero-in>
          <StoreButton asChild className="sd-btn-hero">
            <Link to={path("/catalogo")}>
              {sf.hero_button_label || "Ver o drop"} <ArrowRight size={18} />
            </Link>
          </StoreButton>
          {wa && (
            <a className="sd-btn sd-btn-line" href={wa} target="_blank" rel="noreferrer">
              <MessageCircle size={17} /> Chamar
            </a>
          )}
        </div>
      </div>
      <div className="sd-hero-art">
        <div className="sd-hero-blob" aria-hidden="true" />
        <div className="sd-hero-img" data-hero-img>
          {heroImage ? <img src={heroImage} alt={hero?.name || tenant.name} /> : <Shirt size={90} aria-label="Sem imagem" />}
        </div>
        {hero && (
          <Link className="sd-hero-chip" to={path(`/produto/${productRouteSegment(hero)}`)} data-hero-in>
            <small>Em destaque</small>
            <strong>{hero.name}</strong>
          </Link>
        )}
        <span className="sd-sticker" aria-hidden="true">
          NOVO
          <br />
          DROP
        </span>
      </div>
    </section>
  );

  return (
    <div className="sd-page sd-home">
      <StoreSEO title={`${tenant.name} | Streetwear`} description={about} image={heroImage || tenant.logo_url} url={typeof window !== "undefined" ? window.location.href : ""} siteName={tenant.name} />

      <HeroSlider
        slides={sf.hero_slides}
        autoplaySeconds={sf.hero_autoplay_seconds ?? 6}
        resolveUrl={(u) => (u.startsWith("/") ? path(u) : u)}
        layout="banner"
        className="sd-slider"
        fallback={fallback}
      />

      {ticker.length > 0 && (
        <div className="sd-marquee" data-no-fx aria-hidden="true">
          <div className="sd-marquee-track">
            {[0, 1].map((k) => (
              <div key={k} className="sd-marquee-set">
                {ticker.map((w, i) => (
                  <span key={`${k}-${i}`}>
                    {w} <i>✦</i>
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      <TrustRow t="sd" />

      {cats.length > 0 && (
        <section className="sd-section">
          <header className="sd-head">
            <div>
              <span className="sd-kicker">Categorias</span>
              <h2 className="sd-h2">{sf.home_categories_title || "Escolha seu estilo"}</h2>
            </div>
          </header>
          <div className="sd-cats" role="list">
            {cats.map((c, i) => {
              const img = categoryImage(c, active);
              const n = active.filter((p) => p.category_id === c.id).length;
              return (
                <Link key={c.id} role="listitem" className={`sd-cat sd-tint-${i % 4}`} to={path(`/catalogo?categoria=${c.id}`)}>
                  <span className="sd-cat-img">{img ? <img src={img} alt="" loading="lazy" /> : <Shirt size={36} aria-hidden="true" />}</span>
                  <span className="sd-cat-count">{n} peças</span>
                  <strong>{c.name}</strong>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <section className="sd-section">
        <header className="sd-head">
          <div>
            <span className="sd-kicker">Drop atual</span>
            <h2 className="sd-h2">{sf.home_featured_title || "Acabou de chegar"}</h2>
          </div>
          <Link className="sd-btn sd-btn-line" to={path("/catalogo")}>
            Ver tudo <ArrowRight size={16} />
          </Link>
        </header>
        {featured.length ? (
          <div className="sd-grid">
            {featured.map((p) => (
              <ProductCard key={p.id} product={p} t="sd" />
            ))}
          </div>
        ) : (
          <p className="sd-note">As peças estão sendo preparadas. Volte em breve.</p>
        )}
      </section>

      <section className="sd-cta">
        <div>
          <h2>Não perca o próximo drop</h2>
          <p>Peças limitadas saem rápido. Fale com a loja e garanta a sua.</p>
        </div>
        {wa ? (
          <a className="sd-btn sd-btn-ink sd-btn-lg" href={wa} target="_blank" rel="noreferrer">
            <MessageCircle size={18} /> Chamar no WhatsApp
          </a>
        ) : (
          <Link className="sd-btn sd-btn-ink sd-btn-lg" to={path("/catalogo")}>
            Ver o catálogo <ArrowRight size={18} />
          </Link>
        )}
      </section>
    </div>
  );
}
