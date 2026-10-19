import { useRef } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ArrowUpRight, CreditCard, RefreshCw, Trophy, Truck } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import HeroSlider from "../../../../components/store/HeroSlider";
import Card from "./Card";
import { useHeroFx } from "./fx";
import { imageOf, priceOf, useKit } from "./lib";
import "./styles.css";

const TICKER = ["Treine melhor", "Jogue mais", "Vá mais longe", "Equipamento de verdade", "Seu ritmo, sua escolha"];

export default function StoreFront() {
  const { tenant, active, path, sf, hidden, usedCategories, countIn } = useKit();
  const root = useRef<HTMLElement>(null);
  const featured = (active.some((p) => p.is_featured) ? active.filter((p) => p.is_featured) : active).slice(0, 8);
  const offers = hidden ? [] : active.filter((p) => priceOf(p).off).slice(0, 8);
  const photos = featured.filter((p) => imageOf(p));
  const main = tenant.banner_url || (photos[0] ? imageOf(photos[0]) : "");
  const title = tenant.hero_tagline || "Seu movimento. Sua próxima conquista.";
  const coverOf = (id: number) => imageOf(active.find((p) => p.category_id === id && imageOf(p)));
  useHeroFx(root, active.length);

  const fallback = (
    <section className="sp-hero">
      <div className="sp-hero-copy" data-fx="copy">
        <span className="sp-kicker">{sf.segment_label || "Viva o esporte"}</span>
        <h1>{title}</h1>
        <p>{tenant.about_text || "Artigos esportivos, vestuário e acessórios para acompanhar você em cada etapa."}</p>
        <div className="sp-hero-actions">
          <Link to={path("/catalogo")} className="sp-btn">{sf.hero_button_label || "Explorar produtos"} <ArrowUpRight size={19} /></Link>
          <Link to={path("/sobre")} className="sp-btn sp-btn--soft">Conhecer a loja</Link>
        </div>
      </div>
      <div className="sp-mosaic" data-fx="visual">
        <div className="sp-mosaic-main" data-parallax>{main ? <img src={main} alt="" /> : <Trophy size={96} />}</div>
        {photos.slice(1, 3).map((p) => (
          <Link key={p.id} to={path(`/catalogo?q=${encodeURIComponent(p.name)}`)} className="sp-mosaic-tile" aria-label={p.name}><img src={imageOf(p)} alt="" loading="lazy" /></Link>
        ))}
      </div>
    </section>
  );

  return (
    <main className="sp-root" ref={root}>
      <StoreSEO title={`${tenant.name} | Artigos esportivos`} description={tenant.about_text || `Conheça os produtos da ${tenant.name}.`} image={main || tenant.logo_url} url={typeof window !== "undefined" ? window.location.href : ""} siteName={tenant.name} />
      <div className="sp-wrap sp-hero-wrap">
        <HeroSlider
          slides={sf.hero_slides}
          autoplaySeconds={sf.hero_autoplay_seconds ?? 6}
          resolveUrl={(u) => (u.startsWith("/") ? path(u) : u)}
          layout="split"
          className="sp-slider"
          fallback={fallback}
        />
      </div>

      <div className="sp-wrap">
        <ul className="sp-trust" aria-label="Vantagens">
          <li><Truck size={20} /><span><b>Entrega ou retirada</b>combine com a loja</span></li>
          <li><CreditCard size={20} /><span><b>Pagamento facilitado</b>escolha no pedido</span></li>
          <li><RefreshCw size={20} /><span><b>Troca simples</b>fale com a gente</span></li>
        </ul>
      </div>

      <div className="sp-ticker" aria-hidden="true" data-no-fx>
        <div className="sp-ticker-track">{[...TICKER, ...TICKER, ...TICKER].map((t, i) => <span key={i}>{t}<i /></span>)}</div>
      </div>

      {usedCategories.length > 0 && (
        <section className="sp-wrap sp-section" aria-labelledby="sp-cats">
          <div className="sp-head">
            <div><span className="sp-kicker">Escolha seu caminho</span><h2 id="sp-cats">{sf.home_categories_title || "Explore por categoria"}</h2></div>
            <Link to={path("/catalogo")} className="sp-link">Ver catálogo <ArrowUpRight size={18} /></Link>
          </div>
          <div className="sp-tiles">
            {usedCategories.slice(0, 5).map((c) => {
              const cover = coverOf(c.id);
              return (
                <Link to={path(`/catalogo?cat=${c.id}`)} key={c.id} className="sp-tile">
                  {cover && <img src={cover} alt="" loading="lazy" />}
                  <span className="sp-tile-label"><strong>{c.name}</strong><small>{countIn(c.id)} {countIn(c.id) === 1 ? "produto" : "produtos"}</small></span>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <section className="sp-wrap sp-section">
        <div className="sp-head">
          <div><span className="sp-kicker">Seleção da loja</span><h2>{sf.home_featured_title || "Destaques para você"}</h2></div>
          <Link to={path("/catalogo")} className="sp-link">Ver todos <ArrowUpRight size={18} /></Link>
        </div>
        {featured.length ? <div className="sp-grid">{featured.map((p) => <Card key={p.id} product={p} />)}</div> : <div className="sp-empty">O catálogo está sendo preparado. Volte em breve!</div>}
      </section>

      {offers.length > 0 && (
        <section className="sp-wrap sp-section">
          <div className="sp-offers">
            <div className="sp-offers-head">
              <span className="sp-kicker">Aproveite</span>
              <h2>Ofertas da loja</h2>
              <Link to={path("/catalogo?sort=ofertas")} className="sp-btn sp-btn--white">Ver ofertas <ArrowRight size={18} /></Link>
            </div>
            <div className="sp-offers-rail" data-no-fx>{offers.map((p) => <Card key={p.id} product={p} />)}</div>
          </div>
        </section>
      )}
    </main>
  );
}
