import { Link } from "react-router-dom";
import StoreSEO from "../../../../components/store/StoreSEO";
import { hoursLines, useShop, whatsappHref } from "./kit";
import "./styles.css";

export default function StoreAbout() {
  const { tenant, categories, active, config, path } = useShop();
  const title = config.about_title || "Nossa casa";
  const hours = hoursLines(tenant);
  const text = tenant.about_text || `${tenant.name} reúne uma seleção cuidadosa de peças para marcar momentos especiais, com atendimento próximo e atenção a cada detalhe.`;
  return (
    <div className="lx-scope lx-page">
      <StoreSEO title={`${title} | ${tenant.name}`} description={text} image={tenant.banner_url || tenant.logo_url} siteName={tenant.name} url={typeof window !== "undefined" ? window.location.href : ""} />
      <div className="lx-wrap">
        <header className="lx-about-hero">
          <span className="lx-eyebrow">{tenant.name}</span>
          <h1>{title}</h1>
          <div className="lx-rule"><span /></div>
        </header>
        <div className="lx-about-body" style={tenant.banner_url ? undefined : { gridTemplateColumns: "minmax(0, 720px)", justifyContent: "center" }}>
          {tenant.banner_url && <img src={tenant.banner_url} alt="" />}
          <div>
            <p className="lx-about-text">{text}</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginTop: 34 }}>
              <Link className="lx-btn is-solid" to={path("/catalogo")}>Conhecer a coleção</Link>
              {tenant.whatsapp && <a className="lx-btn" href={whatsappHref(tenant)} target="_blank" rel="noreferrer">Falar com a loja</a>}
            </div>
          </div>
        </div>
        <div className="lx-facts">
          <div><span className="lx-eyebrow">A coleção</span><h3>{active.length} {active.length === 1 ? "peça" : "peças"}</h3><p>em {categories.length} {categories.length === 1 ? "categoria" : "categorias"}</p></div>
          <div>
            <span className="lx-eyebrow">Atendimento</span><h3>Horários</h3>
            {hours.length ? <ul>{hours.map((h) => <li key={h.day}>{h.day}: {h.text}</li>)}</ul> : <p>Fale com a loja para combinar.</p>}
          </div>
          <div><span className="lx-eyebrow">Onde estamos</span><h3>{tenant.show_address && tenant.address ? "Endereço" : "Loja online"}</h3><p>{tenant.show_address && tenant.address ? tenant.address : "Compre de onde estiver, com atendimento direto."}</p></div>
        </div>
      </div>
    </div>
  );
}
