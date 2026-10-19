import { useRef } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CreditCard, Flame, Dumbbell, RefreshCw, Tag, Truck } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import HeroSlider from "../../../../components/store/HeroSlider";
import Card from "./Card";
import { useHeroFx } from "./fx";
import { imageOf, priceOf, useKit } from "./lib";
import "./styles.css";

export default function StoreFront() {
  const { tenant, active, usedCategories, path, sf, countIn } = useKit();
  const featured = (active.some((p) => p.is_featured) ? active.filter((p) => p.is_featured) : active).slice(0, 8);
  const deals = active.filter((p) => priceOf(p).off).length;
  const withPhoto = active.find((p) => imageOf(p));
  const title = tenant.hero_tagline || "Treine forte. Evolua todo dia.";
  const hero = tenant.banner_url || imageOf(withPhoto);
  const root = useRef<HTMLElement>(null);
  useHeroFx(root, active.length);
  const coverOf = (id: number) => imageOf(active.find((p) => p.category_id === id && imageOf(p)));

  const fallback = (
    <section className="ft-hero">
      <div className="ft-hero-copy" data-fx="copy">
        <span className="ft-tag"><Flame size={14} /> {sf.segment_label || "Fitness & performance"}</span>
        <h1 className="ft-h1">{title}</h1>
        <p className="ft-lead">{tenant.about_text || "Suplementos, equipamentos e acessórios para acompanhar cada meta do seu treino."}</p>
        <div className="ft-hero-cta">
          <Link to={path("/catalogo")} className="ft-btn">{sf.hero_button_label || "Ver produtos"} <ArrowRight size={18} /></Link>
          <Link to={path("/sobre")} className="ft-btn ft-btn--ghost">Conhecer a loja</Link>
        </div>
        <ul className="ft-hero-stats">
          <li><b>{active.length}</b> produtos</li>
          <li><b>{usedCategories.length}</b> categorias</li>
          {deals > 0 && <li><b>{deals}</b> {deals === 1 ? "oferta" : "ofertas"}</li>}
        </ul>
      </div>
      <div className="ft-hero-visual" data-fx="visual">
        <span className="ft-hero-blob" aria-hidden="true" data-parallax />
        {hero ? <img src={hero} alt="" /> : <Dumbbell className="ft-hero-symbol" size={140} strokeWidth={1.2} />}
        <span className="ft-float ft-float--a"><Flame size={16} /> Alta performance</span>
        <span className="ft-float ft-float--b"><Tag size={16} /> {deals > 0 ? `${deals} em oferta` : "Novidades"}</span>
      </div>
    </section>
  );

  return (
    <main className="ft-root" ref={root}>
      <StoreSEO
        title={`${tenant.name} | Treino, suplementos e fitness`}
        description={tenant.about_text || `Produtos de performance da ${tenant.name}.`}
        image={hero || imageOf(featured[0])}
        url={typeof window !== "undefined" ? window.location.href : ""}
        siteName={tenant.name}
      />
      <div className="ft-wrap ft-hero-wrap">
        <HeroSlider
          slides={sf.hero_slides}
          autoplaySeconds={sf.hero_autoplay_seconds ?? 6}
          resolveUrl={(u) => (u.startsWith("/") ? path(u) : u)}
          layout="banner"
          className="ft-slider"
          fallback={fallback}
        />
      </div>

      <div className="ft-wrap">
        <ul className="ft-trust" aria-label="Vantagens">
          <li><Truck size={20} /><span><b>Entrega ou retirada</b>combine com a loja</span></li>
          <li><CreditCard size={20} /><span><b>Pagamento facilitado</b>escolha no pedido</span></li>
          <li><RefreshCw size={20} /><span><b>Troca simples</b>fale com a gente</span></li>
        </ul>
      </div>

      {usedCategories.length > 0 && (
        <section className="ft-section" aria-labelledby="ft-cats-title">
          <div className="ft-wrap">
            <div className="ft-section-head">
              <div><span className="ft-tag">Escolha seu foco</span><h2 className="ft-h2" id="ft-cats-title">{sf.home_categories_title || "Compre por categoria"}</h2></div>
              <Link to={path("/catalogo")} className="ft-more">Ver tudo <ArrowRight size={16} /></Link>
            </div>
            <div className="ft-cat-rail" data-no-fx>
              {usedCategories.slice(0, 12).map((c) => {
                const cover = coverOf(c.id);
                return (
                  <Link key={c.id} to={path(`/catalogo?cat=${c.id}`)} className="ft-cat">
                    <span className="ft-cat-img">{cover ? <img src={cover} alt="" loading="lazy" /> : <Dumbbell size={30} />}</span>
                    <span className="ft-cat-name">{c.name}</span>
                    <span className="ft-cat-n">{countIn(c.id)} {countIn(c.id) === 1 ? "item" : "itens"}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}

      <section className="ft-section">
        <div className="ft-wrap">
          <div className="ft-section-head">
            <div><span className="ft-tag">Seleção</span><h2 className="ft-h2">{sf.home_featured_title || "Mais procurados"}</h2></div>
            <Link to={path("/catalogo")} className="ft-more">Ver todos <ArrowRight size={16} /></Link>
          </div>
          {featured.length ? (
            <div className="ft-grid">{featured.map((p) => <Card key={p.id} product={p} />)}</div>
          ) : (
            <div className="ft-empty"><h3>Catálogo em preparação</h3><p>Volte em breve para ver os produtos.</p></div>
          )}
        </div>
      </section>

      <section className="ft-section">
        <div className="ft-wrap">
          <div className="ft-cta-block">
            <div><h2>Sua próxima meta começa aqui.</h2><p>Monte seu pedido em poucos toques e finalize direto com a loja.</p></div>
            <Link to={path("/catalogo")} className="ft-btn ft-btn--lime">Ver catálogo <ArrowRight size={18} /></Link>
          </div>
        </div>
      </section>
    </main>
  );
}
