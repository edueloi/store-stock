import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ArrowUpRight, ChevronLeft, ChevronRight, Shirt } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import HeroSlider from "../../../../components/store/HeroSlider";
import { StoreButton } from "../../../../components/store/StoreButton";
import { productRouteSegment } from "../../store-routing";
import { productImage, useKit } from "../street/kit";
import { ProductCard, TrustRow, categoryImage, useHeroMotion } from "../street/shared";
import "./styles.css";

/** Carrossel horizontal com scroll-snap e setas. */
function Carousel({ children, label }: { children: React.ReactNode; label: string }) {
  const track = useRef<HTMLDivElement>(null);
  const scroll = (dir: 1 | -1) => {
    const el = track.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: "smooth" });
  };
  return (
    <div className="sw-carousel" data-no-fx>
      <button type="button" className="sw-arrow sw-arrow-prev" aria-label={`${label}: anterior`} onClick={() => scroll(-1)}>
        <ChevronLeft size={22} />
      </button>
      <div className="sw-track" ref={track} role="list" aria-label={label} tabIndex={0}>
        {children}
      </div>
      <button type="button" className="sw-arrow sw-arrow-next" aria-label={`${label}: próximo`} onClick={() => scroll(1)}>
        <ChevronRight size={22} />
      </button>
    </div>
  );
}

export default function StoreFront() {
  const { tenant, categories, active, path, sf } = useKit();
  const heroRef = useRef<HTMLElement>(null);
  useHeroMotion(heroRef);
  const [hover, setHover] = useState(0);
  const featured = [...active.filter((p) => p.is_featured), ...active.filter((p) => !p.is_featured)].slice(0, Math.max(tenant.featured_limit || 10, 6));
  const hero = active.find((p) => p.is_featured) || active[0];
  const banner = tenant.banner_url || "";
  const heroImage = banner || productImage(hero);
  const cats = categories.filter((c) => active.some((p) => p.category_id === c.id)).slice(0, 8);
  const title = tenant.hero_tagline || "Nova coleção";
  const current = cats[Math.min(hover, Math.max(cats.length - 1, 0))];
  const previewImg = current ? categoryImage(current, active) : "";
  const duo = cats.slice(0, 2);

  const fallback = (
    <section className="sw-hero" ref={heroRef}>
      <div className="sw-hero-copy">
        <span className="sw-eyebrow" data-hero-in>
          {sf.segment_label || "Streetwear & Skate"}
        </span>
        <h1 data-hero-in>{title}</h1>
        <StoreButton asChild className="sw-hero-cta" data-hero-in>
          <Link to={path("/catalogo")}>
            {sf.hero_button_label || "Explorar a coleção"} <ArrowRight size={18} />
          </Link>
        </StoreButton>
      </div>
      <div className={`sw-hero-img ${banner ? "is-cover" : ""}`}>
        <div className="sw-hero-frame" data-hero-img>
          {heroImage ? <img src={heroImage} alt={hero?.name || tenant.name} /> : <Shirt size={96} aria-label="Sem imagem" />}
        </div>
        {hero && (
          <Link className="sw-hero-tag" to={path(`/produto/${productRouteSegment(hero)}`)} data-hero-in>
            <span>{hero.name}</span>
            <ArrowUpRight size={18} />
          </Link>
        )}
      </div>
    </section>
  );

  return (
    <div className="sw-page sw-home">
      <StoreSEO title={`${tenant.name} | Streetwear & Skate`} description={tenant.about_text || title} image={heroImage || tenant.logo_url} url={typeof window !== "undefined" ? window.location.href : ""} siteName={tenant.name} />

      <HeroSlider
        slides={sf.hero_slides}
        autoplaySeconds={sf.hero_autoplay_seconds ?? 6}
        resolveUrl={(u) => (u.startsWith("/") ? path(u) : u)}
        layout="banner"
        className="sw-slider"
        fallback={fallback}
      />

      <section className="sw-section">
        <header className="sw-head">
          <h2 className="sw-h2">{sf.home_featured_title || "Novidades"}</h2>
          <Link className="sw-more-link" to={path("/catalogo")}>
            Ver tudo <ArrowRight size={16} />
          </Link>
        </header>
        {featured.length ? (
          <Carousel label="Novidades">
            {featured.map((p) => (
              <div key={p.id} className="sw-slide" role="listitem">
                <ProductCard product={p} t="sw" fab />
              </div>
            ))}
          </Carousel>
        ) : (
          <p className="sw-note">As peças estão sendo preparadas.</p>
        )}
      </section>

      {cats.length > 0 && (
        <section className="sw-section sw-collections">
          <div className="sw-col-list">
            <h2 className="sw-h2">{sf.home_categories_title || "Coleções"}</h2>
            <ol>
              {cats.map((c, i) => (
                <li key={c.id}>
                  <Link to={path(`/catalogo?categoria=${c.id}`)} className={i === hover ? "is-on" : ""} onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)}>
                    <small>{String(i + 1).padStart(2, "0")}</small>
                    <span>{c.name}</span>
                    <ArrowUpRight size={22} aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ol>
          </div>
          <div className="sw-col-preview" aria-hidden="true">
            {previewImg ? <img key={previewImg} src={previewImg} alt="" /> : <Shirt size={80} />}
            {current && <span>{current.name}</span>}
          </div>
        </section>
      )}

      {duo.length > 0 && (
        <section className="sw-section sw-duo">
          {duo.map((c, i) => (
            <Link key={c.id} className={`sw-duo-card sw-duo-${i}`} to={path(`/catalogo?categoria=${c.id}`)}>
              <span className="sw-duo-img">{categoryImage(c, active) ? <img src={categoryImage(c, active)} alt="" loading="lazy" /> : <Shirt size={64} />}</span>
              <span className="sw-duo-label">
                <small>Lookbook</small>
                <strong>{c.name}</strong>
                <ArrowUpRight size={22} />
              </span>
            </Link>
          ))}
        </section>
      )}

      <section className="sw-section">
        <TrustRow t="sw" />
      </section>
    </div>
  );
}
