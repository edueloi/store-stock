import { Link } from "react-router-dom";
import { Clock, MapPin, MessageCircle, PawPrint } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import { StoreButton } from "../../../../components/store/StoreButton";
import { hoursLines, useKit } from "./kit";
import { whatsappLink } from "./extras";

export default function StoreAbout() {
  const { tenant, categories, active, config, path } = useKit();
  const hours = hoursLines(tenant.business_hours);
  const wa = whatsappLink(tenant.whatsapp, `Olá! Vim pela loja ${tenant.name}.`);
  return (
    <div className="feed-page">
      <StoreSEO title={`${config.about_title || "Nossa loja"} - ${tenant.name}`} description={tenant.about_text || `Conheça a ${tenant.name}.`} image={tenant.banner_url || tenant.logo_url} url={typeof window !== "undefined" ? window.location.href : ""} siteName={tenant.name} />
      <div className="feed-wrap">
        <section className="feed-about">
          <div className="feed-about-art">
            <span className="feed-hero-orb" aria-hidden="true" />
            <div className="feed-hero-pic">{tenant.banner_url ? <img src={tenant.banner_url} alt="" /> : <PawPrint size={80} aria-hidden="true" />}</div>
          </div>
          <div className="feed-about-copy">
            <span className="feed-eyebrow"><PawPrint size={15} aria-hidden="true" /> {config.segment_label || "Rações e nutrição"}</span>
            <h1>{config.about_title || `Quem é a ${tenant.name}`}</h1>
            <p>{tenant.about_text || `${tenant.name} cuida da alimentação de quem você ama, com produtos selecionados e atendimento próximo.`}</p>
            <div className="feed-about-actions">
              <StoreButton asChild className="feed-cta"><Link to={path("/catalogo")}>Ver produtos</Link></StoreButton>
              {wa && <StoreButton asChild variant="outline" className="feed-ghost"><a href={wa} target="_blank" rel="noreferrer"><MessageCircle size={18} aria-hidden="true" /> WhatsApp</a></StoreButton>}
            </div>
          </div>
        </section>
        <div className="feed-about-cards">
          <section className="feed-box">
            <h2>A loja em números</h2>
            <ul><li><span>Produtos</span><b>{active.length}</b></li><li><span>Linhas e animais</span><b>{categories.length}</b></li></ul>
          </section>
          {hours.length > 0 && (
            <section className="feed-box">
              <h2><Clock size={18} aria-hidden="true" /> Horário</h2>
              <ul>{hours.map((h) => <li key={h.label}><span>{h.label}</span><b>{h.text}</b></li>)}</ul>
            </section>
          )}
          {tenant.show_address && tenant.address && (
            <section className="feed-box"><h2><MapPin size={18} aria-hidden="true" /> Onde estamos</h2><p>{tenant.address}</p></section>
          )}
        </div>
      </div>
    </div>
  );
}
