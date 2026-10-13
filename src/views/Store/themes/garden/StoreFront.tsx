import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import { productImage, useKit } from "./kit";
import { Leaf, Masonry } from "./parts";

export default function StoreFront() {
  const { tenant, categories, active, config, path } = useKit();
  const featured = active.filter((p) => p.is_featured);
  const picks = (featured.length ? featured : active).slice(0, 8);
  const withImg = picks.filter((p) => productImage(p));
  const hero = tenant.hero_tagline || "Um pouco mais de verde. Todos os dias.";
  const parts = hero.split(/(?<=\.)\s+/);
  const countBy = (id: number) => active.filter((p) => p.category_id === id).length;
  return (
    <div className="garden-page">
      <StoreSEO title={tenant.name} description={tenant.hero_tagline || "Sementes, ferramentas e detalhes para cultivar seus espaços."} image={tenant.banner_url || tenant.logo_url} url={typeof window !== "undefined" ? window.location.href : ""} siteName={tenant.name} />
      <section className="garden-hero">
        <div className="garden-wrap garden-hero-grid">
          <div>
            <span className="garden-eyebrow"><Leaf size={20} /> {config.segment_label || "Horta & Jardinagem"}</span>
            <h1>{parts[0]}{parts[1] && <> <em>{parts.slice(1).join(" ")}</em></>}</h1>
            <p className="garden-lead">Sementes, ferramentas e detalhes para cultivar seus espaços.</p>
            <div className="garden-hero-actions">
              <Link className="garden-btn" to={path("/catalogo")}>{config.hero_button_label || "Explorar o catálogo"} <ArrowRight size={18} aria-hidden /></Link>
              <Link className="garden-btn is-line" to={path("/sobre")}>Nossa história</Link>
            </div>
          </div>
          <div className="garden-bloom">
            <Leaf size={64} className="a" />
            <Leaf size={46} className="b" />
            <div className={`garden-bloom-main${tenant.banner_url ? "" : " is-product"}`}>
              {tenant.banner_url ? <img src={tenant.banner_url} alt="" /> : withImg[0] ? <img src={productImage(withImg[0])} alt={withImg[0].name} /> : <Leaf size={140} className="" />}
            </div>
            {withImg[tenant.banner_url ? 0 : 1] && <div className="garden-bloom-chip"><img src={productImage(withImg[tenant.banner_url ? 0 : 1])} alt="" /></div>}
          </div>
        </div>
      </section>

      {categories.length > 0 && (
        <section className="garden-section">
          <div className="garden-wrap">
            <div className="garden-head">
              <div>
                <span className="garden-eyebrow"><Leaf size={18} /> Coleções</span>
                <h2 className="garden-title">{config.home_categories_title || "Cultive novas possibilidades"}</h2>
              </div>
              <Link to={path("/catalogo")}>Ver tudo <ArrowRight size={16} aria-hidden /></Link>
            </div>
            <div className="garden-collections">
              {categories.map((c) => (
                <Link key={c.id} className="garden-coll" to={path("/catalogo", { cat: String(c.id) })}>
                  <Leaf size={110} className="" />
                  <small>{countBy(c.id)} {countBy(c.id) === 1 ? "produto" : "produtos"}</small>
                  <b>{c.name}</b>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="garden-section">
        <div className="garden-wrap">
          <div className="garden-head">
            <div>
              <span className="garden-eyebrow"><Leaf size={18} /> Da horta para a sua casa</span>
              <h2 className="garden-title">{config.home_featured_title || "Escolhas para florescer"}</h2>
            </div>
            <Link to={path("/catalogo")}>Ver catálogo completo <ArrowRight size={16} aria-hidden /></Link>
          </div>
          {picks.length ? <Masonry products={picks} /> : <p>Em breve, novos produtos por aqui.</p>}
        </div>
      </section>
      <p className="garden-quote">{tenant.about_text ? tenant.about_text.split(/\n/)[0].slice(0, 160) : "Cada espaço verde começa com uma pequena escolha."}</p>
      <div className="garden-wrap" style={{ textAlign: "center", padding: "10px 22px 20px" }}>
        {tenant.whatsapp ? (
          <a className="garden-btn is-ink" href={`https://wa.me/${tenant.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noreferrer">Tirar dúvidas no WhatsApp</a>
        ) : (
          <Link className="garden-btn is-ink" to={path("/sobre")}>Conhecer a loja</Link>
        )}
      </div>
    </div>
  );
}
