import { useRef } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ArrowUpRight, Shirt } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import HeroSlider from "../../../../components/store/HeroSlider";
import { StoreButton } from "../../../../components/store/StoreButton";
import { productRouteSegment } from "../../store-routing";
import { productImage, useKit } from "../street/kit";
import { ProductCard, TrustRow, categoryImage, useHeroMotion } from "../street/shared";
import type { Product } from "../../../../types";
import "./styles.css";

export default function StoreFront() {
  const { tenant, categories, active, path, sf } = useKit();
  const heroRef = useRef<HTMLElement>(null);
  useHeroMotion(heroRef);
  const ordered = [...active.filter((p) => p.is_featured), ...active.filter((p) => !p.is_featured)];
  const featured = ordered.slice(0, Math.max(tenant.featured_limit || 7, 7));
  const [main, second, third] = ordered;
  const mainImage = tenant.banner_url || productImage(main);
  const cats = categories.filter((c) => active.some((p) => p.category_id === c.id)).slice(0, 7);
  const title = tenant.hero_tagline || "Edição urbana";

  const mini = (p: Product | undefined, tone: string) =>
    p ? (
      <Link className={`ur-tile ur-tile-${tone}`} to={path(`/produto/${productRouteSegment(p)}`)} data-hero-in>
        {productImage(p) ? <img src={productImage(p)} alt="" loading="lazy" /> : <Shirt size={44} />}
        <span>{p.name}</span>
      </Link>
    ) : null;

  const fallback = (
    <section className="ur-hero" ref={heroRef}>
      <div className="ur-tile ur-tile-main">
        <div className="ur-main-img" data-hero-img>
          {mainImage ? <img src={mainImage} alt={main?.name || tenant.name} /> : <Shirt size={100} aria-label="Sem imagem" />}
        </div>
        <div className="ur-main-copy">
          <span className="ur-mono" data-hero-in>
            {sf.segment_label || "Urban Edit"} / {String(active.length).padStart(2, "0")} itens
          </span>
          <h1 data-hero-in>{title}</h1>
          <StoreButton asChild className="ur-hero-cta" data-hero-in>
            <Link to={path("/catalogo")}>
              {sf.hero_button_label || "Ver o lookbook"} <ArrowRight size={18} />
            </Link>
          </StoreButton>
        </div>
      </div>
      {mini(second, "yellow")}
      {mini(third, "blue")}
      <Link className="ur-tile ur-tile-pink" to={path("/catalogo")} data-hero-in>
        <strong>{active.length}</strong>
        <span>peças no catálogo</span>
        <ArrowUpRight size={24} />
      </Link>
    </section>
  );

  return (
    <div className="ur-page ur-home">
      <StoreSEO title={`${tenant.name} | Urban Edit`} description={tenant.about_text || title} image={mainImage || tenant.logo_url} url={typeof window !== "undefined" ? window.location.href : ""} siteName={tenant.name} />

      <HeroSlider
        slides={sf.hero_slides}
        autoplaySeconds={sf.hero_autoplay_seconds ?? 6}
        resolveUrl={(u) => (u.startsWith("/") ? path(u) : u)}
        layout="banner"
        className="ur-slider"
        fallback={fallback}
      />

      <TrustRow t="ur" />

      {cats.length > 0 && (
        <section className="ur-section">
          <header className="ur-head">
            <span className="ur-mono">01 / Categorias</span>
            <h2 className="ur-h2">{sf.home_categories_title || "Explore o mosaico"}</h2>
          </header>
          <div className="ur-mosaic">
            {cats.map((c, i) => {
              const img = categoryImage(c, active);
              const n = active.filter((p) => p.category_id === c.id).length;
              return (
                <Link key={c.id} className={`ur-mos ur-mos-${i} ur-tone-${i % 4}`} to={path(`/catalogo?categoria=${c.id}`)}>
                  {img ? <img src={img} alt="" loading="lazy" /> : <Shirt size={48} aria-hidden="true" />}
                  <span className="ur-mos-label">
                    <strong>{c.name}</strong>
                    <small>{n} itens</small>
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <section className="ur-section">
        <header className="ur-head ur-head-row">
          <div>
            <span className="ur-mono">02 / Lookbook</span>
            <h2 className="ur-h2">{sf.home_featured_title || "Seleção da semana"}</h2>
          </div>
          <Link className="ur-btn ur-btn-line" to={path("/catalogo")}>
            Ver tudo <ArrowRight size={16} />
          </Link>
        </header>
        {featured.length ? (
          <div className="ur-grid ur-grid-feature">
            {featured.map((p) => (
              <ProductCard key={p.id} product={p} t="ur" />
            ))}
          </div>
        ) : (
          <p className="ur-note">As peças estão sendo preparadas.</p>
        )}
      </section>
    </div>
  );
}
