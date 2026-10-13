import { Link } from "react-router-dom";
import { ArrowRight, Boxes, Layers, MessageCircle } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import { imageOf, useShop, whatsappHref } from "./kit";
import { Empty, TechCard } from "./parts";
import "./styles.css";

export default function StoreFront() {
  const { tenant, categories, active, config, path } = useShop();
  const featured = active.filter((p) => p.is_featured);
  const shown = (featured.length ? featured : active).slice(0, 7);
  const photo = tenant.banner_url || imageOf(shown[0]);
  const title = tenant.hero_tagline || "Tecnologia que acompanha você.";
  const sub = "Encontre eletrônicos e acessórios para conectar trabalho, casa e diversão.";
  const [lead, ...rest] = shown;

  return (
    <div className="tp-scope tp-page">
      <StoreSEO title={tenant.name} description={tenant.about_text || sub} image={photo} siteName={tenant.name} url={typeof window !== "undefined" ? window.location.href : ""} />
      <div className="tp-wrap" style={{ paddingTop: 20 }}>
        <div className="tp-bento">
          <section className="tp-tile hero">
            <div style={{ position: "relative", zIndex: 1 }}>
              <span className="tp-kicker">{config.segment_label || "Eletrônicos & Conectividade"}</span>
              <h1 style={{ marginTop: 12 }}>{title}</h1>
              <p>{sub}</p>
            </div>
            <div className="btns">
              <Link className="tp-btn is-light" to={path("/catalogo")}>{config.hero_button_label || "Ver catálogo"} <ArrowRight size={16} /></Link>
              <Link className="tp-btn is-line" to={path("/sobre")}>Conhecer a loja</Link>
            </div>
          </section>
          <section className="tp-tile photo" aria-label="Destaque visual">
            {photo && <img src={photo} alt="" />}
            <span className="cap">{tenant.name}</span>
          </section>
          <div className="tp-tile tp-stat"><Boxes size={20} style={{ color: "var(--tp-cy)", marginBottom: 12 }} aria-hidden="true" /><b>{active.length}</b><span>produtos ativos</span></div>
          <div className="tp-tile tp-stat"><Layers size={20} style={{ color: "var(--tp-cy)", marginBottom: 12 }} aria-hidden="true" /><b>{categories.length}</b><span>categorias</span></div>
        </div>

        {categories.length > 0 && (
          <section className="tp-section">
            <div className="tp-sec-head">
              <div><span className="tp-kicker">Navegação por conexões</span><h2>{config.home_categories_title || "Explore as conexões"}</h2></div>
              <Link className="tp-link" to={path("/catalogo")}>Todas as categorias <ArrowRight size={15} /></Link>
            </div>
            <div className="tp-bento">
              {categories.slice(0, 8).map((c, i) => (
                <Link key={c.id} className="tp-tile cat" to={path("/catalogo", { categoria: String(c.id) })}>
                  <span className="ic" aria-hidden="true">{String(i + 1).padStart(2, "0")}</span>
                  <div><strong>{c.name}</strong><br /><small>{active.filter((p) => p.category_id === c.id).length} produtos</small></div>
                </Link>
              ))}
            </div>
          </section>
        )}

        <section className="tp-section">
          <div className="tp-sec-head">
            <div><span className="tp-kicker">Seleção</span><h2>{config.home_featured_title || "Conecte novas possibilidades"}</h2></div>
            <Link className="tp-link" to={path("/catalogo")}>Ver tudo <ArrowRight size={15} /></Link>
          </div>
          {lead ? (
            <div className="tp-grid is-4">
              <TechCard product={lead} wide />
              {rest.map((p) => <TechCard key={p.id} product={p} />)}
            </div>
          ) : (
            <Empty title="Nenhum produto disponível" text="Em breve novos dispositivos e acessórios por aqui." />
          )}
        </section>

        {tenant.whatsapp && (
          <section className="tp-section">
            <div className="tp-tile" style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center", justifyContent: "space-between" }}>
              <div><span className="tp-kicker">Suporte</span><h2 style={{ marginTop: 6, fontSize: 24 }}>Precisa confirmar compatibilidade?</h2><p style={{ margin: "6px 0 0", color: "var(--tp-dim)" }}>Fale com a equipe antes de comprar.</p></div>
              <a className="tp-btn" href={whatsappHref(tenant)} target="_blank" rel="noreferrer"><MessageCircle size={17} /> Falar no WhatsApp</a>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
