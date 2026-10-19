import { Link } from "react-router-dom";
import { ArrowRight, Scissors } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import HeroSlider from "../../../../components/store/HeroSlider";
import Card from "./Card";
import { categoryImage, hasDiscount, money, priceOf, productImage, useHero, useKit, useUsedCategories } from "./kit";
import "./styles.css";

export default function StoreFront() {
  const { tenant, active, path, sf, productPath, hidden } = useKit();
  const cats = useUsedCategories();
  const hero = useHero();
  const featured = active.filter((p) => p.is_featured);
  const pool = featured.length ? featured : active;
  const showcase = pool.slice(0, tenant.featured_limit || 8);
  const withPhoto = active.filter((p) => productImage(p));
  const [a, b, c] = [withPhoto[0], withPhoto[1], withPhoto[2]];
  const mainImage = tenant.banner_url || (a ? productImage(a) : "");
  const title = tenant.hero_tagline || "Moda com assinatura, feita para ser vivida";
  const about = tenant.about_text ? tenant.about_text.slice(0, 160) : "Peças selecionadas, cortes limpos e acabamento que se nota.";

  const side = (p: typeof a, cls: string) =>
    p ? (
      <Link to={productPath(p)} className={`atl-look ${cls}`}>
        <img src={productImage(p)} alt={p.name} loading="lazy" />
        <span>
          <strong>{p.name}</strong>
          {!hidden && <em>{money(priceOf(p))}{hasDiscount(p) && <s>{money(Number(p.price))}</s>}</em>}
        </span>
      </Link>
    ) : null;

  const fallback = (
    <section className="atl-hero">
      <div className="atl-hero-main">
        {mainImage && <img src={mainImage} alt="" />}
        <div className="atl-hero-card">
          <span className="atl-kicker">{sf.segment_label || "Nova coleção"}</span>
          <h1>{title}</h1>
          <p>{about}</p>
          <Link className="atl-btn" to={path("/catalogo")}>{sf.hero_button_label || "Ver a coleção"} <ArrowRight size={17} /></Link>
        </div>
      </div>
      {(b || c) && (
        <div className="atl-hero-side">
          {side(b, "atl-look-1")}
          {side(c, "atl-look-2")}
        </div>
      )}
    </section>
  );

  return (
    <main className="atl-page">
      <StoreSEO
        title={tenant.name}
        description={tenant.hero_tagline || tenant.about_text || `Moda — ${tenant.name}`}
        image={tenant.banner_url || tenant.logo_url}
        url={typeof window !== "undefined" ? window.location.href : ""}
        siteName={tenant.name}
      />

      <div className="atl-wrap atl-hero-wrap" data-no-fx>
        <HeroSlider slides={hero.slides} autoplaySeconds={hero.autoplay} resolveUrl={hero.resolveUrl} layout="banner" className="atl-slider" fallback={fallback} />
      </div>

      {cats.length > 0 && (
        <div className="atl-marquee" data-no-fx aria-hidden="true">
          <div className="atl-marquee-track">
            {[0, 1].map((k) => (
              <div key={k} className="atl-marquee-set">
                {cats.slice(0, 8).map((x) => (
                  <span key={`${k}${x.id}`}>{x.name} <Scissors size={14} /></span>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {cats.length > 0 && (
        <section className="atl-wrap atl-section" aria-labelledby="atl-cats">
          <header className="atl-head">
            <span className="atl-kicker">Lookbook</span>
            <h2 id="atl-cats">{sf.home_categories_title || "Explore por categoria"}</h2>
          </header>
          <ol className="atl-looks">
            {cats.slice(0, 8).map((x, i) => {
              const img = categoryImage(x, active);
              return (
                <li key={x.id}>
                  <Link to={path(`/catalogo?categoria=${x.id}`)}>
                    <span className="atl-looks-img">{img && <img src={img} alt="" loading="lazy" />}</span>
                    <span className="atl-looks-n">{String(i + 1).padStart(2, "0")}</span>
                    <strong>{x.name}</strong>
                  </Link>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      <section className="atl-wrap atl-section">
        <header className="atl-head atl-head-row">
          <div>
            <span className="atl-kicker">Seleção</span>
            <h2>{sf.home_featured_title || "Peças em destaque"}</h2>
          </div>
          <Link className="atl-link" to={path("/catalogo")}>Ver tudo <ArrowRight size={16} /></Link>
        </header>
        {showcase.length ? (
          <div className="atl-grid">{showcase.map((p) => <Card key={p.id} product={p} />)}</div>
        ) : (
          <p className="atl-empty">A coleção está sendo preparada. Volte em breve.</p>
        )}
      </section>

      <section className="atl-wrap atl-section">
        <div className="atl-band">
          <span className="atl-kicker">O ateliê</span>
          <p>{tenant.about_text ? tenant.about_text.slice(0, 220) : "Cada peça é escolhida com atenção ao caimento, ao tecido e ao detalhe."}</p>
          <Link className="atl-btn atl-btn-ghost" to={path("/sobre")}>Conheça nossa história</Link>
        </div>
      </section>
    </main>
  );
}
