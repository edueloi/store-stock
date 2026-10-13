import { Link } from "react-router-dom";
import { ArrowRight, Terminal } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import { imageOf, pad, useShop } from "./kit";
import { CircuitCard, Empty } from "./parts";
import "./styles.css";

export default function StoreFront() {
  const { tenant, categories, active, config, path } = useShop();
  const featured = active.filter((p) => p.is_featured);
  const shown = (featured.length ? featured : active).slice(0, 8);
  const heroImage = tenant.banner_url || imageOf(shown[0]);
  const title = tenant.hero_tagline || "Prepare o seu próximo nível.";
  const sub = "Produtos, acessórios e novidades para montar seu espaço.";
  const ticker = [config.segment_label || "Games & Cultura Digital", `${active.length} produtos`, `${categories.length} módulos`, tenant.name];

  return (
    <div className="cy-scope cy-page">
      <StoreSEO title={tenant.name} description={tenant.about_text || sub} image={heroImage} siteName={tenant.name} url={typeof window !== "undefined" ? window.location.href : ""} />
      <section className="cy-hero">
        <div className="cy-wrap cy-hero-grid">
          <div className="cy-term">
            <div className="cy-term-head"><span /><span /><span /><em>loja.sh</em></div>
            <div className="cy-term-body">
              <ul className="cy-log" aria-hidden="true">
                <li>carregando vitrine... <b>ok</b></li>
                <li>{active.length} itens em estoque virtual <b>ok</b></li>
              </ul>
              <h1><span className="cy-cursor">{title}</span></h1>
              <p className="cy-sub">{sub}</p>
              <div className="cy-actions">
                <Link className="cy-btn is-solid" to={path("/catalogo")}>{config.hero_button_label || "Explorar catálogo"} <ArrowRight size={16} /></Link>
                <Link className="cy-btn is-hot" to={path("/sobre")}><Terminal size={16} /> Sobre a loja</Link>
              </div>
            </div>
          </div>
          <div className="cy-corner">
            <div className="cy-viewport" style={{ minHeight: 280 }}>
              {heroImage ? <img src={heroImage} alt="" /> : <Terminal className="cy-empty-art" size={72} aria-hidden="true" />}
              <div className="cy-hud"><span>cam://<b>{tenant.name}</b></span><span>rec ●</span></div>
            </div>
          </div>
        </div>
      </section>

      <div className="cy-ticker" aria-hidden="true">
        <div className="cy-ticker-track">
          {[...ticker, ...ticker, ...ticker, ...ticker].map((t, i) => <span key={i}>{t}</span>)}
        </div>
      </div>

      {categories.length > 0 && (
        <section className="cy-section">
          <div className="cy-wrap">
            <div className="cy-sec-head">
              <div><span className="cy-tag">navegação</span><h2>{config.home_categories_title || "Escolha seu universo"}</h2></div>
              <Link className="cy-link" to={path("/catalogo")}>listar tudo <ArrowRight size={14} /></Link>
            </div>
            <div className="cy-modules">
              {categories.slice(0, 8).map((c, i) => (
                <Link key={c.id} className="cy-module" to={path("/catalogo", { categoria: String(c.id) })}>
                  <small>MOD_{pad(i + 1)}</small>
                  <strong>{c.name}</strong>
                  <span>{active.filter((p) => p.category_id === c.id).length} itens →</span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="cy-section">
        <div className="cy-wrap">
          <div className="cy-sec-head">
            <div><span className="cy-tag">destaques</span><h2>{config.home_featured_title || "Em foco no setup"}</h2></div>
            <Link className="cy-link" to={path("/catalogo")}>ver catálogo <ArrowRight size={14} /></Link>
          </div>
          {shown.length ? (
            <div className="cy-grid is-4">{shown.map((p, i) => <CircuitCard key={p.id} product={p} index={i} />)}</div>
          ) : (
            <Empty title="nenhum produto disponível" text="Volte em breve: novos itens entram em órbita por aqui." />
          )}
        </div>
      </section>

      <section className="cy-section" style={{ paddingBottom: 12 }}>
        <div className="cy-wrap">
          <div className="cy-term">
            <div className="cy-term-head"><span /><span /><span /><em>fale com a gente</em></div>
            <div className="cy-term-body" style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <span className="cy-tag">próxima missão</span>
                <p style={{ margin: "6px 0 0", maxWidth: 560 }}>{tenant.about_text ? tenant.about_text.slice(0, 160) + (tenant.about_text.length > 160 ? "…" : "") : "Monte seu loadout e finalize o pedido direto pelo carrinho."}</p>
              </div>
              <Link className="cy-btn" to={path("/catalogo")}>Abrir catálogo <ArrowRight size={16} /></Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
