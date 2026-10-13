import { Link } from "react-router-dom";
import { ArrowRight, Wheat } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import { productImage, useKit } from "./kit";
import { Card, Seal } from "./parts";

export default function StoreFront() {
  const { tenant, categories, active, config, path } = useKit();
  const featured = active.filter((p) => p.is_featured);
  const picks = (featured.length ? featured : active).slice(0, 8);
  const hero = tenant.banner_url || productImage(picks[0]);
  const countBy = (id: number) => active.filter((p) => p.category_id === id).length;
  return (
    <div className="agro-page">
      <StoreSEO title={tenant.name} description={tenant.hero_tagline || "A força do campo começa aqui."} image={tenant.banner_url || tenant.logo_url} url={typeof window !== "undefined" ? window.location.href : ""} siteName={tenant.name} />
      <section className="agro-hero">
        <div className="agro-wrap agro-hero-grid">
          <div>
            <span className="agro-tag is-gold">{config.segment_label || "Agropecuária & Campo"}</span>
            <h1>{tenant.hero_tagline || "A força do campo começa aqui."}</h1>
            <p className="agro-lead">Produtos para cuidar da propriedade, dos animais e de cada dia de trabalho.</p>
            <Link className="agro-btn" to={path("/catalogo")}>{config.hero_button_label || "Ver o catálogo"} <ArrowRight size={18} aria-hidden /></Link>
          </div>
          <div className="agro-hero-pic">
            {hero ? <img src={hero} alt="" /> : <div className="agro-hero-fallback"><Wheat size={96} aria-hidden /></div>}
            <Seal />
          </div>
        </div>
      </section>
      <div className="agro-numbers">
        <div className="agro-wrap">
          <div><strong>{active.length}</strong><span>produtos</span></div>
          <div><strong>{categories.length}</strong><span>departamentos</span></div>
          <div><strong>{featured.length || picks.length}</strong><span>em destaque</span></div>
        </div>
      </div>

      {categories.length > 0 && (
        <section className="agro-block">
          <div className="agro-wrap">
            <div className="agro-section-title">
              <h2>{config.home_categories_title || "Do campo à criação"}</h2>
              <Link to={path("/catalogo")}>Todos os departamentos <ArrowRight size={16} aria-hidden /></Link>
            </div>
            <div className="agro-dept-grid">
              {categories.map((c, i) => (
                <Link key={c.id} className="agro-dept" to={path("/catalogo", { cat: String(c.id) })}>
                  <i aria-hidden>{String(i + 1).padStart(2, "0")}</i>
                  <small>Depto {String(i + 1).padStart(2, "0")}</small>
                  <b>{c.name}</b>
                  <small>{countBy(c.id)} {countBy(c.id) === 1 ? "item" : "itens"} →</small>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="agro-feature-band">
        <div className="agro-wrap">
          <div className="agro-section-title">
            <h2>{config.home_featured_title || "Essenciais para o trabalho"}</h2>
            <Link to={path("/catalogo")}>Ver catálogo completo <ArrowRight size={16} aria-hidden /></Link>
          </div>
          {picks.length ? (
            <div className="agro-grid">{picks.map((p) => <Card key={p.id} product={p} />)}</div>
          ) : (
            <p>Em breve, novos produtos por aqui.</p>
          )}
        </div>
      </section>

      <section className="agro-block">
        <div className="agro-wrap">
          <div className="agro-cta">
            <div>
              <h2>Precisa de ajuda para escolher?</h2>
              <p>{tenant.whatsapp ? "Chame a loja pelo WhatsApp e tire suas dúvidas antes de pedir." : "Conheça a loja e veja como atendemos."}</p>
            </div>
            {tenant.whatsapp ? (
              <a className="agro-btn is-dark" href={`https://wa.me/${tenant.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noreferrer">Chamar no WhatsApp</a>
            ) : (
              <Link className="agro-btn is-dark" to={path("/sobre")}>Nossa loja</Link>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
