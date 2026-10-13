import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import { productImage, useKit } from "./kit";
import { Grain, Paw, Shelf } from "./parts";

export default function StoreFront() {
  const { tenant, categories, active, config, path } = useKit();
  const featured = active.filter((p) => p.is_featured);
  const picks = (featured.length ? featured : active).slice(0, 10);
  const scene = picks.filter((p) => productImage(p)).slice(0, 3);
  const hero = tenant.hero_tagline || "Cuidado em cada porção.";
  const words = hero.split(" ");
  const last = words.pop();
  const shelves = categories.map((c) => ({ c, items: active.filter((p) => p.category_id === c.id).slice(0, 8) })).filter((s) => s.items.length).slice(0, 3);
  return (
    <div className="feed-page">
      <StoreSEO title={tenant.name} description={tenant.hero_tagline || "Alimentação, acessórios e cuidados para os seus animais."} image={tenant.banner_url || tenant.logo_url} url={typeof window !== "undefined" ? window.location.href : ""} siteName={tenant.name} />
      <section className="feed-hero">
        <div className="feed-wrap feed-hero-grid">
          <div>
            <span className="feed-kicker"><Paw size={16} /> {config.segment_label || "Rações, Pets & Criação"}</span>
            <h1>{words.join(" ")} <span>{last}</span></h1>
            <p className="feed-lead">Encontre alimentação, acessórios e cuidados para os seus animais.</p>
            <div className="feed-hero-actions">
              <Link className="feed-btn" to={path("/catalogo")}>{config.hero_button_label || "Ver as prateleiras"} <ArrowRight size={18} aria-hidden /></Link>
              <Link className="feed-btn is-line" to={path("/sobre")}>Conhecer a loja</Link>
            </div>
          </div>
          <div className="feed-scene" aria-hidden={scene.length === 0 && !tenant.banner_url}>
            <Paw size={54} className="feed-paws" />
            {tenant.banner_url && <div className="feed-scene-banner"><img src={tenant.banner_url} alt="" /></div>}
            {!tenant.banner_url && (
              <div className="feed-scene-row">
                {scene.length ? scene.map((p) => <figure key={p.id}><img src={productImage(p)} alt={p.name} /></figure>) : [0, 1, 2].map((i) => <figure key={i}>{i === 1 ? <Paw size={64} /> : <Grain size={56} />}</figure>)}
              </div>
            )}
            {tenant.banner_url && <div style={{ aspectRatio: "4 / 3" }} />}
            <div className="feed-plank" aria-hidden />
          </div>
        </div>
      </section>
      <div className="feed-trail" aria-hidden>{[0, 1, 2, 3, 4, 5].map((i) => <Paw key={i} size={22} />)}</div>

      {categories.length > 0 && (
        <section className="feed-section">
          <div className="feed-wrap">
            <div style={{ marginBottom: 26, textAlign: "center" }}>
              <span className="feed-sign">{config.home_categories_title || "Encontre por categoria"}</span>
            </div>
            <div className="feed-aisles">
              {categories.map((c) => {
                const n = active.filter((p) => p.category_id === c.id).length;
                return (
                  <Link key={c.id} className="feed-aisle" to={path("/catalogo", { cat: String(c.id) })}>
                    <Grain size={28} />
                    <span>{c.name}<small>{n} {n === 1 ? "item" : "itens"}</small></span>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}

      <div className="feed-wrap" style={{ paddingTop: 52 }}>
        {picks.length > 0 && <Shelf title={config.home_featured_title || "Na prateleira da loja"} kicker="Destaques" to={path("/catalogo")} products={picks} />}
        {shelves.map(({ c, items }) => <Shelf key={c.id} title={c.name} kicker="Prateleira" to={path("/catalogo", { cat: String(c.id) })} products={items} />)}
        {!active.length && <p style={{ textAlign: "center", padding: "30px 0 60px" }}>As prateleiras estão sendo abastecidas. Volte em breve!</p>}
        <div className="feed-banner-cta">
          <Paw className="" size={170} />
          <div>
            <h2>Dúvida sobre qual produto escolher?</h2>
            <p>{tenant.whatsapp ? "Fale com a loja pelo WhatsApp e receba ajuda antes de pedir." : "Conheça a loja e veja como podemos ajudar."}</p>
          </div>
          {tenant.whatsapp ? (
            <a className="feed-btn" href={`https://wa.me/${tenant.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noreferrer">Chamar no WhatsApp</a>
          ) : (
            <Link className="feed-btn" to={path("/sobre")}>Nossa loja</Link>
          )}
        </div>
      </div>
    </div>
  );
}
