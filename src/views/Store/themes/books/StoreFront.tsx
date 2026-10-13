import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import { productImage, useKit } from "./kit";
import { Cover, Ornament, spineOf } from "./parts";
import { productRouteSegment } from "../../store-routing";
import "./styles.css";

export default function StoreFront() {
  const { tenant, categories, active, path, sf } = useKit();
  const featuredAll = active.filter((p) => p.is_featured);
  const featured = (featuredAll.length ? featuredAll : active).slice(0, 10);
  const fan = featured.filter((p) => productImage(p)).slice(0, 3);
  const sections = categories
    .map((c) => ({ c, n: active.filter((p) => p.category_id === c.id).length }))
    .filter((x) => x.n)
    .slice(0, 8);
  const tagline = tenant.hero_tagline || "Histórias para levar com você.";

  return (
    <main className="bk-root">
      <StoreSEO
        title={`${tenant.name} — ${sf.segment_label || "livraria e cultura"}`}
        description={tenant.about_text || "Explore o catálogo e encontre a próxima leitura para sua estante."}
        image={tenant.banner_url || tenant.logo_url}
        url={typeof window !== "undefined" ? window.location.href : ""}
        siteName={tenant.name}
      />

      <section className="bk-hero">
        <div className="bk-spread">
          <div className="bk-page bk-page-l">
            <p className="bk-eyebrow">{sf.segment_label || "Livraria & Cultura"}</p>
            <h1 className="bk-dropcap">{tagline}</h1>
            <Ornament className="bk-orn" />
            <p className="bk-intro">{tenant.about_text ? tenant.about_text.slice(0, 190) : "Explore o catálogo e encontre a próxima leitura para sua estante."}</p>
            <div className="bk-actions">
              <Link to={path("/catalogo")} className="bk-btn">
                {sf.hero_button_label || "Explorar a estante"} <ArrowRight size={17} />
              </Link>
              <Link to={path("/sobre")} className="bk-btn bk-btn-line">
                Sobre a livraria
              </Link>
            </div>
          </div>
          <div className="bk-page bk-page-r" aria-hidden={fan.length ? undefined : true}>
            {tenant.banner_url && !fan.length ? (
              <img className="bk-banner" src={tenant.banner_url} alt="" />
            ) : (
              <div className="bk-fan">
                {fan.map((p, i) => (
                  <Link key={p.id} to={path(`/produto/${productRouteSegment(p)}`)} className={`bk-fan-book bk-fan-${i + 1}`} aria-label={p.name}>
                    <img src={productImage(p)} alt={p.name} />
                  </Link>
                ))}
                {!fan.length && <span className="bk-fan-empty">{tenant.name}</span>}
              </div>
            )}
            <span className="bk-pageno" aria-hidden="true">
              — 1 —
            </span>
          </div>
        </div>
      </section>

      <section className="bk-block">
        <header className="bk-head">
          <p className="bk-eyebrow">Capítulo I</p>
          <h2>{sf.home_featured_title || "Na estante da loja"}</h2>
          <Ornament className="bk-orn" />
        </header>
        {featured.length ? (
          <div className="bk-shelf-books">
            {featured.map((p, i) => (
              <Cover key={p.id} product={p} index={i} />
            ))}
          </div>
        ) : (
          <p className="bk-empty">A estante está sendo arrumada. Volte em breve.</p>
        )}
        {active.length > featured.length && (
          <p className="bk-more">
            <Link to={path("/catalogo")}>Ver todos os {active.length} títulos →</Link>
          </p>
        )}
      </section>

      {sections.length > 0 && (
        <section className="bk-block bk-block-paper">
          <header className="bk-head">
            <p className="bk-eyebrow">Capítulo II</p>
            <h2>{sf.home_categories_title || "Percorra as seções"}</h2>
            <Ornament className="bk-orn" />
          </header>
          <ol className="bk-toc">
            {sections.map(({ c, n }, i) => {
              const s = spineOf(i);
              return (
                <li key={c.id}>
                  <Link to={path(`/catalogo?cat=${c.id}`)}>
                    <span className="bk-toc-num" style={{ background: s.bg, color: s.ink }}>
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="bk-toc-name">{c.name}</span>
                    <span className="bk-toc-dots" aria-hidden="true" />
                    <span className="bk-toc-count">
                      {n} {n === 1 ? "título" : "títulos"}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      <section className="bk-quote">
        <blockquote>
          <p>“{tagline}”</p>
          <footer>— {tenant.name}</footer>
        </blockquote>
      </section>
    </main>
  );
}
