import { Link } from "react-router-dom";
import { MapPin, MessageCircle, Wheat } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import { hoursLines, useKit } from "./kit";
import { Seal } from "./parts";

export default function StoreAbout() {
  const { tenant, categories, active, config, path } = useKit();
  const hours = hoursLines(tenant.business_hours);
  const wa = tenant.whatsapp?.replace(/\D/g, "");
  return (
    <div className="agro-page">
      <StoreSEO title={`${config.about_title || "Nossa loja"} - ${tenant.name}`} description={tenant.about_text || `Conheça a ${tenant.name}.`} image={tenant.banner_url || tenant.logo_url} url={typeof window !== "undefined" ? window.location.href : ""} siteName={tenant.name} />
      <section className="agro-about-hero">
        <div className="agro-wrap">
          <div>
            <span className="agro-tag">{config.segment_label || "Agropecuária & Campo"}</span>
            <h1>{config.about_title || `Quem é a ${tenant.name}`}</h1>
          </div>
          <div className="agro-hero-pic">
            {tenant.banner_url ? <img src={tenant.banner_url} alt="" /> : <div className="agro-hero-fallback"><Wheat size={80} aria-hidden /></div>}
            <Seal text="ATENDIMENTO DIRETO" />
          </div>
        </div>
      </section>
      <div className="agro-wrap agro-about-cols">
        <div>
          <p className="agro-about-text">{tenant.about_text || `${tenant.name} reúne produtos para cuidar da propriedade, dos animais e do trabalho de cada dia, com atendimento direto e catálogo sempre à mão.`}</p>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 28 }}>
            <Link className="agro-btn" to={path("/catalogo")}>Ver catálogo</Link>
            {wa && <a className="agro-btn is-ghost" href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer"><MessageCircle size={18} aria-hidden /> WhatsApp</a>}
          </div>
        </div>
        <aside>
          <div className="agro-box">
            <h2>A loja em números</h2>
            <ul>
              <li><span>Produtos</span><b>{active.length}</b></li>
              <li><span>Departamentos</span><b>{categories.length}</b></li>
            </ul>
          </div>
          {hours.length > 0 && (
            <div className="agro-box">
              <h2>Horário de atendimento</h2>
              <ul>{hours.map((h) => <li key={h.label}><span>{h.label}</span><b>{h.text}</b></li>)}</ul>
            </div>
          )}
          {(tenant.show_address && tenant.address) && (
            <div className="agro-box">
              <h2>Onde estamos</h2>
              <p><MapPin size={16} aria-hidden style={{ display: "inline", verticalAlign: "-2px", marginRight: 6 }} />{tenant.address}</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
