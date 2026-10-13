import { Link } from "react-router-dom";
import { Sprout } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import { hoursLines, useKit } from "./kit";
import { Leaf } from "./parts";

export default function StoreAbout() {
  const { tenant, categories, active, config, path } = useKit();
  const hours = hoursLines(tenant.business_hours);
  const wa = tenant.whatsapp?.replace(/\D/g, "");
  return (
    <div className="garden-page">
      <StoreSEO title={`${config.about_title || "Nossa loja"} - ${tenant.name}`} description={tenant.about_text || `Conheça a ${tenant.name}.`} image={tenant.banner_url || tenant.logo_url} url={typeof window !== "undefined" ? window.location.href : ""} siteName={tenant.name} />
      <div className="garden-wrap">
        <section className="garden-about">
          <div>
            <span className="garden-eyebrow"><Leaf size={18} /> {config.segment_label || "Horta & Jardinagem"}</span>
            <h1>{config.about_title || `Raízes da ${tenant.name}`}</h1>
            <p className="garden-about-text">{tenant.about_text || `${tenant.name} nasceu para ajudar você a cultivar espaços mais verdes, com sementes, ferramentas e atendimento de quem entende de jardim.`}</p>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 26 }}>
              <Link className="garden-btn" to={path("/catalogo")}>Ver o catálogo</Link>
              {wa && <a className="garden-btn is-line" href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer">WhatsApp</a>}
            </div>
          </div>
          <div className="garden-about-art">
            <Leaf size={72} className="garden-leaf-a" />
            <Leaf size={52} className="garden-leaf-b" />
            <div className="garden-arch">
              {tenant.banner_url ? <img src={tenant.banner_url} alt="" /> : <Sprout size={110} aria-hidden />}
            </div>
          </div>
        </section>
        <div className="garden-info">
          <div>
            <h2>No jardim da loja</h2>
            <ul>
              <li><span>Produtos</span><b>{active.length}</b></li>
              <li><span>Coleções</span><b>{categories.length}</b></li>
            </ul>
          </div>
          {hours.length > 0 && (
            <div>
              <h2>Horários</h2>
              <ul>{hours.map((h) => <li key={h.label}><span>{h.label}</span><b>{h.text}</b></li>)}</ul>
            </div>
          )}
          <div>
            <h2>Visite ou chame</h2>
            {tenant.show_address && tenant.address && <p>{tenant.address}</p>}
            {wa ? <p><a href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer">Chamar no WhatsApp</a></p> : <p>Monte sua seleção no catálogo e a loja confirma com você.</p>}
            {tenant.instagram_url && <p><a href={tenant.instagram_url} target="_blank" rel="noreferrer">Instagram</a></p>}
            {tenant.facebook_url && <p><a href={tenant.facebook_url} target="_blank" rel="noreferrer">Facebook</a></p>}
          </div>
        </div>
      </div>
    </div>
  );
}
