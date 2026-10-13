import { Link } from "react-router-dom";
import StoreSEO from "../../../../components/store/StoreSEO";
import { hoursLines, useKit } from "./kit";
import { Grain, Paw } from "./parts";

export default function StoreAbout() {
  const { tenant, categories, active, config, path } = useKit();
  const hours = hoursLines(tenant.business_hours);
  const wa = tenant.whatsapp?.replace(/\D/g, "");
  return (
    <div className="feed-page">
      <StoreSEO title={`${config.about_title || "Nossa loja"} - ${tenant.name}`} description={tenant.about_text || `Conheça a ${tenant.name}.`} image={tenant.banner_url || tenant.logo_url} url={typeof window !== "undefined" ? window.location.href : ""} siteName={tenant.name} />
      <div className="feed-wrap">
        <header className="feed-about-top">
          <span className="feed-sign">{config.segment_label || "Rações, Pets & Criação"}</span>
          <h1>{config.about_title || `Tudo sobre a ${tenant.name}`}</h1>
        </header>
        <div className="feed-story">{tenant.about_text || `${tenant.name} reúne alimentação, acessórios e cuidados para pets e animais de criação, com atendimento próximo e produtos escolhidos com carinho.`}</div>
        {tenant.banner_url && <div className="feed-about-pic"><img src={tenant.banner_url} alt="" /></div>}
        <div className="feed-trail" aria-hidden>{[0, 1, 2, 3, 4].map((i) => <Paw key={i} size={22} />)}</div>
        <div className="feed-info">
          <div>
            <h2><Grain size={22} /> Na loja</h2>
            <ul>
              <li><span>Produtos</span><b>{active.length}</b></li>
              <li><span>Categorias</span><b>{categories.length}</b></li>
            </ul>
            <p style={{ marginTop: 14 }}><Link to={path("/catalogo")}>Ver as prateleiras</Link></p>
          </div>
          {hours.length > 0 && (
            <div>
              <h2><Paw size={22} /> Horários</h2>
              <ul>{hours.map((h) => <li key={h.label}><span>{h.label}</span><b>{h.text}</b></li>)}</ul>
            </div>
          )}
          <div>
            <h2><Grain size={22} /> Fale com a gente</h2>
            {tenant.show_address && tenant.address && <p style={{ marginBottom: 10 }}>{tenant.address}</p>}
            {wa ? <p><a href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer">Chamar no WhatsApp</a></p> : <p>Peça pelo catálogo e a loja confirma com você.</p>}
            {tenant.instagram_url && <p><a href={tenant.instagram_url} target="_blank" rel="noreferrer">Instagram</a></p>}
            {tenant.facebook_url && <p><a href={tenant.facebook_url} target="_blank" rel="noreferrer">Facebook</a></p>}
          </div>
        </div>
      </div>
    </div>
  );
}
