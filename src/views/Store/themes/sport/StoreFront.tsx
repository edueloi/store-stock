import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import Card from "./Card";
import { imageOf, priceOf, useKit } from "./lib";
import "./styles.css";

export default function StoreFront() {
  const { tenant, active, categories, path, sf, hidden, productPath, countIn } = useKit();
  const featured = (active.some((p) => p.is_featured) ? active.filter((p) => p.is_featured) : active).slice(0, 8);
  const deals = active.filter((p) => priceOf(p).off);
  const spot = deals[0] || featured[0];
  const cats = categories.filter((c) => countIn(c.id) > 0).slice(0, 8);
  const title = tenant.hero_tagline || "Movimento é o seu melhor jogo";
  const words = title.trim().split(/\s+/);
  const hero = tenant.banner_url || "";
  const btn = sf.hero_button_label || "Ver coleção";
  const strip = (cats.length ? cats.map((c) => c.name) : ["Performance", "Treino", "Jogo", "Equipamento"]).slice(0, 8);

  return (
    <main className="sport-root">
      <StoreSEO
        title={`${tenant.name} | Artigos esportivos`}
        description={tenant.about_text || `Conheça os produtos da ${tenant.name}.`}
        image={hero || imageOf(featured[0])}
        url={typeof window !== "undefined" ? window.location.href : ""}
        siteName={tenant.name}
      />

      <section className="sport-hero">
        {hero && (
          <div className="sport-hero-media" aria-hidden="true">
            <img src={hero} alt="" />
          </div>
        )}
        <div className="sport-hero-slab" aria-hidden="true" />
        <div className="sport-hero-slab" aria-hidden="true" />
        <div className="sport-wrap">
          <div className="sport-hero-inner">
            <span className="sport-kicker">{sf.segment_label || "Nova temporada"}</span>
            <h1 className="sport-display">
              {words.length > 2 ? (
                <>
                  {words.slice(0, Math.ceil(words.length / 2)).join(" ")}
                  <br />
                  <span style={{ color: "var(--sp-accent)" }}>{words.slice(Math.ceil(words.length / 2)).join(" ")}</span>
                </>
              ) : (
                title
              )}
            </h1>
            <p className="sport-lead">{tenant.about_text || "Equipamentos, vestuário e acessórios para quem vive o esporte todos os dias."}</p>
            <div className="sport-hero-cta">
              <Link to={path("/catalogo")} className="sport-btn">
                {btn} <ArrowUpRight size={20} />
              </Link>
              <Link to={path("/sobre")} className="sport-btn sport-btn--ghost">
                Nossa loja
              </Link>
            </div>
          </div>
        </div>
        <div className="sport-hero-cut" aria-hidden="true" />
      </section>

      <div className="sport-marquee sport-h" aria-hidden="true">
        <div className="sport-marquee-track">
          {[...strip, ...strip, ...strip, ...strip].map((t, i) => (
            <span key={i}>{t}</span>
          ))}
        </div>
      </div>

      {cats.length > 0 && (
        <section className="sport-section">
          <div className="sport-wrap">
            <div className="sport-section-head">
              <div>
                <span className="sport-kicker">Escolha seu esporte</span>
                <h2 className="sport-h">{sf.home_categories_title || "Categorias"}</h2>
              </div>
            </div>
            <div className="sport-cats">
              {cats.map((c, i) => (
                <Link key={c.id} to={path(`/catalogo?cat=${c.id}`)} className="sport-cat">
                  <span className="sport-cat-n" aria-hidden="true">{String(i + 1).padStart(2, "0")}</span>
                  <b className="sport-h">{c.name}</b>
                  <small>{countIn(c.id)} {countIn(c.id) === 1 ? "produto" : "produtos"}</small>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="sport-section" style={{ paddingTop: cats.length ? 0 : 72 }}>
        <div className="sport-wrap">
          <div className="sport-section-head">
            <div>
              <span className="sport-kicker">Em campo agora</span>
              <h2 className="sport-h">{sf.home_featured_title || "Destaques da casa"}</h2>
            </div>
            <Link to={path("/catalogo")} className="sport-link-more">Ver tudo <ArrowUpRight size={18} /></Link>
          </div>
          {featured.length ? (
            <div className="sport-grid">
              {featured.map((p) => (
                <Card key={p.id} product={p} />
              ))}
            </div>
          ) : (
            <div className="sport-empty">
              <h3 className="sport-h">Em breve por aqui</h3>
              <p>Estamos preparando os produtos da loja.</p>
            </div>
          )}
        </div>
      </section>

      {spot && (
        <section className="sport-promo">
          <div className="sport-promo-text">
            <span className="sport-kicker" style={{ color: "#fff" }}>{priceOf(spot).off && !hidden ? "Oferta em destaque" : "Produto em destaque"}</span>
            <h2 className="sport-h">{spot.name}</h2>
            <Link to={productPath(spot)} className="sport-btn sport-btn--dark">Quero este <ArrowUpRight size={20} /></Link>
          </div>
          <div className="sport-promo-media">{imageOf(spot) && <img src={imageOf(spot)} alt={spot.name} loading="lazy" />}</div>
        </section>
      )}

      <section className="sport-band">
        <div className="sport-wrap">
          <div className="sport-band-inner">
            <div className="sport-stat"><b>{active.length}</b><span>produtos no catálogo</span></div>
            <div className="sport-stat"><b>{cats.length}</b><span>categorias</span></div>
            <div className="sport-stat"><b>{deals.length}</b><span>{deals.length === 1 ? "oferta ativa" : "ofertas ativas"}</span></div>
          </div>
        </div>
      </section>
    </main>
  );
}
