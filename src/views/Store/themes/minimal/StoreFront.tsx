import { Link } from "react-router-dom";
import StoreSEO from "../../../../components/store/StoreSEO";
import Card from "./Card";
import { useKit } from "./kit";
import "./styles.css";

export default function StoreFront() {
  const { tenant, categories, active, path, sf } = useKit();
  const featured = active.filter((p) => p.is_featured);
  const showcase = (featured.length ? featured : active).slice(0, 8);
  const title = tenant.hero_tagline || tenant.name;

  return (
    <main className="mn-page">
      <StoreSEO title={tenant.name} description={tenant.hero_tagline || tenant.about_text || `Catálogo de ${tenant.name}`} image={tenant.banner_url || tenant.logo_url} url={typeof window !== "undefined" ? window.location.href : ""} siteName={tenant.name} />

      <section className="mn-hero">
        <h1>{title}<span className="mn-dot">.</span></h1>
        <div className="mn-hero-row">
          <p>{tenant.about_text ? tenant.about_text.slice(0, 140) : "Uma seleção simples, feita para escolher com calma."}</p>
          <Link className="mn-btn" to={path("/catalogo")}>{sf.hero_button_label || "Ver catálogo"} →</Link>
        </div>
      </section>

      {categories.length > 0 && (
        <section className="mn-cats" aria-label={sf.home_categories_title || "Categorias"}>
          <h2 className="mn-eyebrow">{sf.home_categories_title || "Categorias"}</h2>
          <ul>
            {categories.slice(0, 10).map((c) => (
              <li key={c.id}><Link to={path(`/catalogo?categoria=${c.id}`)}>{c.name}</Link></li>
            ))}
          </ul>
        </section>
      )}

      <section className="mn-section">
        <header className="mn-sec-head">
          <h2>{sf.home_featured_title || "Em destaque"}</h2>
          <Link to={path("/catalogo")}>Ver tudo →</Link>
        </header>
        {showcase.length ? (
          <div className="mn-grid">{showcase.map((p) => <Card key={p.id} product={p} />)}</div>
        ) : (
          <p className="mn-muted">Nenhum produto disponível no momento.</p>
        )}
      </section>
    </main>
  );
}
