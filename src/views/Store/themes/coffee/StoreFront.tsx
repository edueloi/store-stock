import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import { productImage, useKit } from "./kit";
import { ArchCard, Bean, MenuRow, Steam } from "./parts";
import "./styles.css";

export default function StoreFront() {
  const { tenant, categories, active, path, sf } = useKit();
  const featuredAll = active.filter((p) => p.is_featured);
  const featured = (featuredAll.length ? featuredAll : active).slice(0, 6);
  const [lead, ...rest] = featured;
  const sections = categories
    .map((c) => ({ c, n: active.filter((p) => p.category_id === c.id).length }))
    .filter((x) => x.n)
    .slice(0, 8);
  const heroImg = tenant.banner_url || productImage(lead);

  return (
    <main className="cf-root">
      <StoreSEO
        title={`${tenant.name} — ${sf.segment_label || "cafés e empório"}`}
        description={tenant.about_text || "Cafés, acompanhamentos e utensílios para transformar o seu ritual."}
        image={tenant.banner_url || tenant.logo_url}
        url={typeof window !== "undefined" ? window.location.href : ""}
        siteName={tenant.name}
      />

      <section className="cf-hero">
        <div className="cf-hero-text">
          <p className="cf-eyebrow">{sf.segment_label || "Cafés & Empório"}</p>
          <h1>{tenant.hero_tagline || "Faça uma pausa. Descubra um sabor."}</h1>
          <p className="cf-lead">{tenant.about_text ? tenant.about_text.slice(0, 170) : "Cafés, acompanhamentos e utensílios para transformar o seu ritual."}</p>
          <div className="cf-hero-actions">
            <Link to={path("/catalogo")} className="cf-btn">
              {sf.hero_button_label || "Ver o cardápio"} <ArrowUpRight size={18} />
            </Link>
            <Link to={path("/sobre")} className="cf-btn cf-btn-line">
              Nossa casa
            </Link>
          </div>
        </div>
        <div className="cf-hero-photo">
          <Steam className="cf-steam" />
          <div className="cf-arch">{heroImg ? <img src={heroImg} alt="" /> : <Bean className="cf-arch-bean" />}</div>
          <p className="cf-stamp" aria-hidden="true">
            <span>{tenant.name}</span>
          </p>
        </div>
      </section>

      <section className="cf-block">
        <header className="cf-head">
          <p className="cf-eyebrow">Hoje no balcão</p>
          <h2>{sf.home_featured_title || "A seleção da casa"}</h2>
        </header>
        {lead ? (
          <div className="cf-select">
            <div className="cf-select-lead">
              <ArchCard product={lead} tall />
            </div>
            <div className="cf-menu">
              {rest.map((p) => (
                <MenuRow key={p.id} product={p} />
              ))}
              {rest.length === 0 && <p className="cf-muted">Mais sabores chegando em breve.</p>}
              <Link to={path("/catalogo")} className="cf-more">
                Ver cardápio completo <ArrowUpRight size={16} />
              </Link>
            </div>
          </div>
        ) : (
          <p className="cf-empty">O cardápio está sendo preparado. Volte em breve.</p>
        )}
      </section>

      {sections.length > 0 && (
        <section className="cf-block cf-block-alt">
          <header className="cf-head">
            <p className="cf-eyebrow">Cardápio</p>
            <h2>{sf.home_categories_title || "Explore o empório"}</h2>
          </header>
          <ol className="cf-sections">
            {sections.map(({ c, n }, i) => (
              <li key={c.id}>
                <Link to={path(`/catalogo?cat=${c.id}`)}>
                  <span className="cf-sec-num">{String(i + 1).padStart(2, "0")}</span>
                  <span className="cf-sec-name">{c.name}</span>
                  <span className="cf-leader" aria-hidden="true" />
                  <span className="cf-sec-count">{n}</span>
                  <ArrowUpRight size={20} aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ol>
        </section>
      )}

      <section className="cf-ritual">
        <Bean className="cf-ritual-bean" />
        <blockquote>
          <p>{tenant.about_text ? tenant.about_text.slice(0, 220) : "Cada xícara começa com uma boa escolha. Venha descobrir a sua."}</p>
          <footer>
            <Link to={path("/sobre")}>Conheça nossa casa →</Link>
          </footer>
        </blockquote>
      </section>
    </main>
  );
}
