import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import { Piece } from "./parts";
import { imageOf, useKit } from "./kit";
import "./styles.css";

export default function StoreFront() {
  const { tenant, categories, active, path, sf } = useKit();
  const featured = active.filter((p) => p.is_featured);
  const picks = (featured.length ? featured : active).slice(0, 5);
  const pickIds = new Set(picks.map((p) => p.id));
  const fresh = [...active].sort((a, b) => b.id - a.id).filter((p) => !pickIds.has(p.id)).slice(0, 4);
  const looks = categories.filter((c) => active.some((p) => p.category_id === c.id)).slice(0, 4);
  const lead = imageOf(picks[0] || ({} as never));
  const heroImg = tenant.banner_url || lead;
  const about = tenant.about_text || "";
  const catImage = (id: number) => {
    const p = active.find((x) => x.category_id === id && imageOf(x));
    return p ? imageOf(p) : "";
  };

  return (
    <div className="atl-page">
      <StoreSEO title={`${tenant.name} — Moda e ateliê`} description={tenant.hero_tagline || about || `Conheça a coleção da ${tenant.name}.`} image={tenant.banner_url || tenant.logo_url} url={typeof window !== "undefined" ? window.location.href : ""} siteName={tenant.name} />

      <section className="atl-hero">
        <div className="atl-hero-text">
          <p className="atl-eyebrow">{sf.segment_label || "Nova coleção"}</p>
          <h1>{tenant.hero_tagline || tenant.name}</h1>
          <p className="atl-hero-sub">{about ? about.slice(0, 150) + (about.length > 150 ? "…" : "") : "Peças pensadas com cuidado, para vestir com calma."}</p>
          <div className="atl-hero-cta">
            <Link to={path("/catalogo")} className="atl-btn">{sf.hero_button_label || "Ver a coleção"} <ArrowRight size={16} /></Link>
            <Link to={path("/sobre")} className="atl-link">Conheça o ateliê</Link>
          </div>
        </div>
        <div className="atl-hero-photo">
          {heroImg ? <img src={heroImg} alt="" /> : <span className="atl-hero-mark" aria-hidden="true">{tenant.name.slice(0, 1)}</span>}
          <span className="atl-hero-cap">{tenant.name}</span>
        </div>
      </section>

      {looks.length > 0 && (
        <section className="atl-section">
          <header className="atl-sec-head">
            <p className="atl-eyebrow">Lookbook</p>
            <h2>{sf.home_categories_title || "Escolha o seu look"}</h2>
          </header>
          <div className="atl-looks">
            {looks.map((c, i) => {
              const img = c.cover_url || catImage(c.id);
              return (
                <Link key={c.id} to={path(`/catalogo?cat=${c.id}`)} className="atl-look">
                  {img ? <img src={img} alt="" loading="lazy" /> : <span className="atl-look-blank" aria-hidden="true" />}
                  <span className="atl-look-num">{String(i + 1).padStart(2, "0")}</span>
                  <span className="atl-look-name">{c.name}<small>Ver peças <ArrowRight size={14} /></small></span>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {picks.length > 0 && (
        <section className="atl-section">
          <header className="atl-sec-head">
            <p className="atl-eyebrow">Seleção do ateliê</p>
            <h2>{sf.home_featured_title || "Peças em destaque"}</h2>
          </header>
          <div className="atl-mosaic">
            {picks.map((p, i) => <Piece key={p.id} product={p} tall={i === 0} />)}
          </div>
        </section>
      )}

      {about && (
        <section className="atl-quote">
          <blockquote>“{about.slice(0, 220)}{about.length > 220 ? "…" : ""}”</blockquote>
          <Link to={path("/sobre")} className="atl-link">Ler a nossa história</Link>
        </section>
      )}

      {fresh.length > 0 && (
        <section className="atl-section">
          <header className="atl-sec-head">
            <p className="atl-eyebrow">Acabou de chegar</p>
            <h2>Novidades</h2>
          </header>
          <div className="atl-row">{fresh.map((p) => <Piece key={p.id} product={p} />)}</div>
          <div className="atl-center"><Link to={path("/catalogo")} className="atl-btn atl-btn-line">Ver toda a coleção</Link></div>
        </section>
      )}

      {active.length === 0 && <p className="atl-note">Em breve, novas peças por aqui.</p>}
    </div>
  );
}
