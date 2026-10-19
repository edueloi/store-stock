import { Link } from "react-router-dom";
import { ArrowRight, CreditCard, MessageCircle, RefreshCw } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import HeroSlider from "../../../../components/store/HeroSlider";
import Card from "./Card";
import { categoryImage, productImage, useHero, useKit, useUsedCategories } from "./kit";
import "./styles.css";

export default function StoreFront() {
  const { tenant, active, path, sf } = useKit();
  const cats = useUsedCategories();
  const hero = useHero();
  const featured = active.filter((p) => p.is_featured);
  const showcase = (featured.length ? featured : active).slice(0, tenant.featured_limit || 8);
  const lead = active.find((p) => p.is_featured) || active[0];
  const heroImage = tenant.banner_url || (lead ? productImage(lead) : "");
  const title = tenant.hero_tagline || tenant.name;
  const text = tenant.about_text ? tenant.about_text.slice(0, 140) : "Uma seleção simples, feita para escolher com calma.";

  const fallback = (
    <section className="mn-hero">
      <div className="mn-hero-copy">
        <h1>{title}</h1>
        <p>{text}</p>
        <Link className="mn-btn" to={path("/catalogo")}>
          {sf.hero_button_label || "Ver catálogo"} <ArrowRight size={16} />
        </Link>
      </div>
      <div className="mn-hero-art">{heroImage && <img src={heroImage} alt={lead?.name || tenant.name} />}</div>
    </section>
  );

  return (
    <main className="mn-page">
      <StoreSEO
        title={tenant.name}
        description={tenant.hero_tagline || tenant.about_text || `Catálogo de ${tenant.name}`}
        image={tenant.banner_url || tenant.logo_url}
        url={typeof window !== "undefined" ? window.location.href : ""}
        siteName={tenant.name}
      />

      <div className="mn-wrap mn-hero-wrap" data-no-fx>
        <HeroSlider slides={hero.slides} autoplaySeconds={hero.autoplay} resolveUrl={hero.resolveUrl} layout="banner" className="mn-slider" fallback={fallback} />
      </div>

      <div className="mn-wrap">
        <div className="mn-trust">
          <div><MessageCircle size={22} strokeWidth={1.5} /><span>Atendimento direto<small>Tire dúvidas pelo WhatsApp</small></span></div>
          <div><CreditCard size={22} strokeWidth={1.5} /><span>Pagamento combinado<small>Escolha a forma que preferir</small></span></div>
          <div><RefreshCw size={22} strokeWidth={1.5} /><span>Troca facilitada<small>Fale com a loja em caso de dúvida</small></span></div>
        </div>
      </div>

      {cats.length > 0 && (
        <section className="mn-wrap mn-section" aria-labelledby="mn-cats-title">
          <header className="mn-sec-head">
            <h2 id="mn-cats-title">{sf.home_categories_title || "Categorias"}</h2>
            <Link to={path("/catalogo")}>Ver tudo</Link>
          </header>
          <ul className="mn-cats">
            {cats.slice(0, 10).map((c) => {
              const img = categoryImage(c, active);
              return (
                <li key={c.id}>
                  <Link to={path(`/catalogo?categoria=${c.id}`)}>
                    <span className="mn-cat-thumb">{img ? <img src={img} alt="" loading="lazy" /> : null}</span>
                    <span className="mn-cat-name">{c.name}</span>
                    <small>{c.count}</small>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="mn-wrap mn-section">
        <header className="mn-sec-head">
          <h2>{sf.home_featured_title || "Em destaque"}</h2>
          <Link to={path("/catalogo")}>Ver tudo</Link>
        </header>
        {showcase.length ? (
          <div className="mn-grid">
            {showcase.map((p) => (
              <Card key={p.id} product={p} />
            ))}
          </div>
        ) : (
          <p className="mn-muted mn-empty-note">Nenhum produto disponível no momento.</p>
        )}
      </section>
    </main>
  );
}
