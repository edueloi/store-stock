import { Link } from "react-router-dom";
import { Clock, MapPin, MessageCircle, Wheat } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import { StoreButton } from "../../../../components/store/StoreButton";
import { hoursLines, useKit } from "./kit";
import { whatsappLink } from "./extras";

export default function StoreAbout() {
  const { tenant, categories, active, config, path } = useKit();
  const hours = hoursLines(tenant.business_hours);
  const wa = whatsappLink(tenant.whatsapp, `Olá! Vim pela loja ${tenant.name}.`);
  return (
    <div className="agro-page">
      <StoreSEO title={`${config.about_title || "Nossa loja"} - ${tenant.name}`} description={tenant.about_text || `Conheça a ${tenant.name}.`} image={tenant.banner_url || tenant.logo_url} url={typeof window !== "undefined" ? window.location.href : ""} siteName={tenant.name} />
      <div className="agro-wrap">
        <section className="agro-about-hero">
          <div>
            <span className="agro-eyebrow">{config.segment_label || "Agropecuária"}</span>
            <h1>{config.about_title || `Quem é a ${tenant.name}`}</h1>
            <p>{tenant.about_text || `${tenant.name} reúne produtos para cuidar da propriedade, dos animais e do trabalho de cada dia, com atendimento direto.`}</p>
            <div className="agro-about-actions">
              <StoreButton asChild className="agro-cta"><Link to={path("/catalogo")}>Ver catálogo</Link></StoreButton>
              {wa && (
                <StoreButton asChild variant="outline" className="agro-ghost">
                  <a href={wa} target="_blank" rel="noreferrer"><MessageCircle size={18} aria-hidden="true" /> WhatsApp</a>
                </StoreButton>
              )}
            </div>
          </div>
          <div className="agro-about-pic">{tenant.banner_url ? <img src={tenant.banner_url} alt="" /> : <Wheat size={88} aria-hidden="true" />}</div>
        </section>
        <div className="agro-about-cards">
          <section className="agro-box">
            <h2>A loja em números</h2>
            <ul>
              <li><span>Produtos</span><b>{active.length}</b></li>
              <li><span>Departamentos</span><b>{categories.length}</b></li>
            </ul>
          </section>
          {hours.length > 0 && (
            <section className="agro-box">
              <h2><Clock size={18} aria-hidden="true" /> Horário de atendimento</h2>
              <ul>{hours.map((h) => <li key={h.label}><span>{h.label}</span><b>{h.text}</b></li>)}</ul>
            </section>
          )}
          {tenant.show_address && tenant.address && (
            <section className="agro-box">
              <h2><MapPin size={18} aria-hidden="true" /> Onde estamos</h2>
              <p>{tenant.address}</p>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
