import { Link } from "react-router-dom";
import StoreSEO from "../../../../components/store/StoreSEO";
import { imageOf, useShop } from "./kit";
import { Empty, Piece } from "./parts";
import "./styles.css";

const ROMAN = ["I", "II", "III", "IV", "V", "VI"];

export default function StoreFront() {
  const { tenant, categories, active, config, path } = useShop();
  const featured = active.filter((p) => p.is_featured);
  const shown = (featured.length ? featured : active).slice(0, 6);
  const heroImage = tenant.banner_url || imageOf(shown[0]);
  const title = tenant.hero_tagline || "O extraordinário está nos detalhes.";
  const sub = "Descubra uma seleção para marcar seus momentos.";
  const words = title.split(" ");
  const last = words.pop();

  return (
    <div className="lx-scope lx-page">
      <StoreSEO title={tenant.name} description={tenant.about_text || sub} image={heroImage} siteName={tenant.name} url={typeof window !== "undefined" ? window.location.href : ""} />
      <section className="lx-hero lx-wrap">
        <span className="lx-eyebrow">{config.segment_label || "Joias & Seleções Especiais"}</span>
        <h1>{words.join(" ")} {words.length ? <em>{last}</em> : last}</h1>
        <div className="lx-rule"><span /></div>
        <p>{sub}</p>
        <Link className="lx-btn" to={path("/catalogo")}>{config.hero_button_label || "Descobrir a coleção"}</Link>
        <div className="lx-hero-img">
          {heroImage ? <img src={heroImage} alt="" /> : <div className="lx-hero-ph">{tenant.name}</div>}
        </div>
      </section>

      {categories.length > 0 && (
        <section className="lx-section lx-wrap">
          <div className="lx-sec-head">
            <span className="lx-eyebrow">Capítulos</span>
            <h2>{config.home_categories_title || "Universos da coleção"}</h2>
          </div>
          <div className="lx-cols">
            {categories.slice(0, 6).map((c, i) => (
              <Link key={c.id} className="lx-col" to={path("/catalogo", { categoria: String(c.id) })}>
                <span className="num" aria-hidden="true">{ROMAN[i]}</span>
                <strong>{c.name}</strong>
                <span>{active.filter((p) => p.category_id === c.id).length} peças</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="lx-section lx-wrap">
        <div className="lx-sec-head">
          <span className="lx-eyebrow">Seleção</span>
          <h2>{config.home_featured_title || "Peças selecionadas"}</h2>
        </div>
        {shown.length ? (
          <div className="lx-grid is-3">{shown.map((p) => <Piece key={p.id} product={p} />)}</div>
        ) : (
          <Empty title="Em breve" text="A coleção está sendo preparada. Volte para conhecer as peças." />
        )}
        {shown.length > 0 && (
          <div style={{ textAlign: "center", paddingTop: 64 }}>
            <Link className="lx-text-link" to={path("/catalogo")}>Ver toda a coleção</Link>
          </div>
        )}
      </section>

      <section className="lx-wrap">
        <div className="lx-ritual">
          <div><b>I</b><h3>Peça exclusiva</h3><p>Cada item é apresentado individualmente, com os detalhes que importam.</p></div>
          <div><b>II</b><h3>Atendimento próximo</h3><p>{tenant.whatsapp ? "Tire dúvidas diretamente com a loja pelo WhatsApp." : "Fale com a loja para confirmar disponibilidade e detalhes."}</p></div>
          <div><b>III</b><h3>Pedido simples</h3><p>Escolha, confirme as opções e finalize pelo carrinho.</p></div>
        </div>
      </section>
    </div>
  );
}
