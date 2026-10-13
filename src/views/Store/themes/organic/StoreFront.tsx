import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import { pageUrl, productImage, useShop } from "./core";
import { Leaf, ProductCard, Seal, Sprig, T } from "./parts";

export default function StoreFront() {
  const { tenant, categories, active, config, path } = useShop();
  const featured = active.filter((p) => p.is_featured);
  const shelf = (featured.length ? featured : active).slice(0, 8);
  const cats = categories.filter((c) => active.some((p) => p.category_id === c.id));
  const art = tenant.banner_url || productImage(shelf[0]);
  const seals = [
    ["100% natural", "Ingredientes e materiais escolhidos com critério."],
    ["Seleção artesanal", "Pequenas escolhas, grandes diferenças."],
    ["Feito com calma", "Cada item passa pelo nosso olhar."],
    ["Do seu jeito", "Escolha, combine e monte sua cesta."],
  ];
  return (
    <div className="or or-page">
      <StoreSEO title={`${tenant.name} | ${config.segment_label || T.tag}`} description={tenant.about_text || T.sub} image={tenant.banner_url} siteName={tenant.name} url={pageUrl()} />

      <section className="or-hero">
        <div className="or-hero-copy">
          <span className="or-over">{config.segment_label || T.tag}</span>
          <h1>{tenant.hero_tagline || T.hero}</h1>
          <p>{T.sub}</p>
          <Link to={path("/catalogo")} className="or-btn">{config.hero_button_label || "Conheça a seleção"} <ArrowRight size={18} aria-hidden="true" /></Link>
        </div>
        <div className="or-arch-wrap">
          <div className="or-arch"><div className="or-arch-in">{art ? <img src={art} alt="" /> : <Leaf size={90} />}</div></div>
          <Seal className="or-seal-big" />
        </div>
      </section>

      <section className="or-seals" aria-label="Nossos compromissos">
        {seals.map(([t, d]) => (
          <div key={t}><Leaf size={22} /><b>{t}</b><p>{d}</p></div>
        ))}
      </section>

      {cats.length > 0 && (
        <section className="or-block">
          <header className="or-sechead"><Sprig className="or-sprig" /><h2>{config.home_categories_title || T.categories}</h2></header>
          <div className="or-collections">
            {cats.map((c) => (
              <Link key={c.id} to={path(`/catalogo?cat=${c.id}`)} className="or-coll">
                <span className="or-coll-arch">{c.cover_url ? <img src={c.cover_url} alt="" loading="lazy" /> : <Leaf size={36} />}</span>
                <b>{c.name}</b>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="or-block">
        <header className="or-sechead"><Sprig className="or-sprig" /><h2>{config.home_featured_title || T.featured}</h2></header>
        {shelf.length ? (
          <div className="or-masonry">{shelf.map((p, i) => <ProductCard key={p.id} product={p} index={i} />)}</div>
        ) : (
          <p className="or-empty">Em breve, novas escolhas por aqui.</p>
        )}
        <div className="or-center"><Link to={path("/catalogo")} className="or-btn or-btn-line">Ver todo o catálogo</Link></div>
      </section>

      <section className="or-story">
        <div className="or-story-arch">{tenant.logo_url ? <img src={tenant.logo_url} alt="" /> : <Leaf size={70} />}</div>
        <div>
          <span className="or-over">{config.about_title || "Nossa história"}</span>
          <h2>{tenant.name}</h2>
          <p>{tenant.about_text || T.sub}</p>
          <Link to={path("/sobre")} className="or-textlink">Conheça a loja <ArrowRight size={16} aria-hidden="true" /></Link>
        </div>
      </section>
    </div>
  );
}
