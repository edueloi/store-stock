import { Link } from "react-router-dom";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import Card from "./Card";
import { imageOf, priceOf, useKit } from "./lib";
import "./styles.css";

export default function StoreFront() {
  const { tenant, active, categories, path, sf, countIn } = useKit();
  const featured = (active.some((p) => p.is_featured) ? active.filter((p) => p.is_featured) : active).slice(0, 8);
  const deals = active.filter((p) => priceOf(p).off).length;
  const cats = categories.filter((c) => countIn(c.id) > 0);
  const withPhoto = active.find((p) => imageOf(p));
  const bar = (n: number, max: number) => `${Math.max(6, Math.min(100, Math.round((n / Math.max(max, 1)) * 100)))}%`;
  const maxv = Math.max(active.length, cats.length, deals, 1);
  const title = tenant.hero_tagline || "Treine forte. Evolua todo dia.";
  const hero = tenant.banner_url;

  return (
    <main className="ft-root">
      <StoreSEO
        title={`${tenant.name} | Treino, suplementos e fitness`}
        description={tenant.about_text || `Produtos de performance da ${tenant.name}.`}
        image={hero || imageOf(featured[0])}
        url={typeof window !== "undefined" ? window.location.href : ""}
        siteName={tenant.name}
      />
      <section className="ft-hero">
        <div className="ft-wrap">
          <div className="ft-hero-grid">
            <div>
              <span className="ft-tag"><i /> {sf.segment_label || "Fit Lab"} // online</span>
              <h1 className="ft-title">{title}</h1>
              <p className="ft-lead">{tenant.about_text || "Suplementos, equipamentos e acessórios para acompanhar cada meta do seu treino."}</p>
              <div className="ft-hero-cta">
                <Link to={path("/catalogo")} className="ft-btn">{sf.hero_button_label || "Montar meu pedido"} <ArrowRight size={18} /></Link>
                <Link to={path("/sobre")} className="ft-btn ft-btn--line">Conhecer a loja</Link>
              </div>
            </div>
            <div className="ft-panel ft-bracket" aria-label="Painel de performance da loja">
              {hero && <img className="ft-panel-img" src={hero} alt="" />}
              <div className="ft-panel-head"><span>Painel de performance</span><span>{new Date().toLocaleDateString("pt-BR")}</span></div>
              {[
                ["Produtos", active.length],
                ["Categorias", cats.length],
                ["Ofertas", deals],
              ].map(([label, n]) => (
                <div className="ft-meter" key={label as string}>
                  <div className="ft-meter-top"><span>{label}</span><b>{n}</b></div>
                  <div className="ft-bar-track"><div className="ft-bar-fill" style={{ width: bar(n as number, maxv) }} /></div>
                </div>
              ))}
              {withPhoto && (
                <Link to={path(`/catalogo`)} className="ft-hero-media" aria-label="Ver catálogo">
                  <img src={imageOf(withPhoto)} alt={withPhoto.name} />
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="ft-wrap" aria-label="Metas da loja" style={{ paddingTop: 12 }}>
        <div className="ft-goals">
          <div className="ft-goal"><b>{active.length}<i>un.</i></b><span>produtos no catálogo</span></div>
          <div className="ft-goal"><b>{cats.length}</b><span>categorias de treino</span></div>
          <div className="ft-goal"><b>{deals}</b><span>{deals === 1 ? "oferta ativa" : "ofertas ativas"}</span></div>
          <div className="ft-goal"><b>{active.filter((p) => p.is_featured).length}</b><span>em destaque</span></div>
        </div>
      </section>

      {cats.length > 0 && (
        <section className="ft-section">
          <div className="ft-wrap">
            <div className="ft-section-head">
              <div><span className="ft-tag">Módulos</span><h2 className="ft-title">{sf.home_categories_title || "Escolha seu foco"}</h2></div>
            </div>
            <div className="ft-rows">
              {cats.slice(0, 8).map((c, i) => (
                <Link key={c.id} to={path(`/catalogo?cat=${c.id}`)} className="ft-row">
                  <span className="n">{String(i + 1).padStart(2, "0")}</span>
                  <span className="t">{c.name}</span>
                  <span className="c">{countIn(c.id)} {countIn(c.id) === 1 ? "item" : "itens"}</span>
                  <ArrowUpRight size={22} />
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="ft-section">
        <div className="ft-wrap">
          <div className="ft-section-head">
            <div><span className="ft-tag">Seleção</span><h2 className="ft-title">{sf.home_featured_title || "Mais procurados"}</h2></div>
            <Link to={path("/catalogo")} className="ft-more">Ver todos <ArrowRight size={16} /></Link>
          </div>
          {featured.length ? (
            <div className="ft-grid">{featured.map((p) => <Card key={p.id} product={p} />)}</div>
          ) : (
            <div className="ft-empty"><h3>Catálogo em preparação</h3><p>Volte em breve para ver os produtos.</p></div>
          )}
        </div>
      </section>

      <section className="ft-section" style={{ paddingTop: 8 }}>
        <div className="ft-wrap">
          <div className="ft-steps">
            {[
              ["01", "Escolha", "Navegue por categoria e encontre o que combina com a sua rotina."],
              ["02", "Monte o pedido", "Selecione opções, quantidade e adicione observações se precisar."],
              ["03", "Finalize", "Conclua pelo carrinho e acompanhe o atendimento da loja."],
            ].map(([n, t, d]) => (
              <div className="ft-step" key={n}><b>{n} //</b><h3>{t}</h3><p>{d}</p></div>
            ))}
          </div>
          <div className="ft-cta-block">
            <h2>Sua próxima meta começa aqui.</h2>
            <Link to={path("/catalogo")} className="ft-btn">Ver catálogo <ArrowRight size={18} /></Link>
          </div>
        </div>
      </section>
    </main>
  );
}
