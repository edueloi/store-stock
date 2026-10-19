import { Link } from "react-router-dom";
import { ArrowRight, Clock, Facebook, Instagram, MapPin, MessageCircle, Truck } from "lucide-react";
import { StoreButton } from "../../../../components/store/StoreButton";
import StoreSEO from "../../../../components/store/StoreSEO";
import { hoursRows, pageUrl, useShop, whatsappLink } from "./core";
import { Cross, T } from "./parts";

export default function StoreAbout() {
  const { tenant, config, path } = useShop();
  const hours = hoursRows(tenant);
  const policies = tenant.policies;
  return (
    <div className="ph ph-page">
      <StoreSEO title={`${config.about_title || "Nossa loja"} | ${tenant.name}`} description={tenant.about_text || T.sub} image={tenant.banner_url} siteName={tenant.name} url={pageUrl()} />
      <section className="ph-about-head">
        <div className="ph-wrap">
          <span className="ph-kicker"><Cross size={14} /> {config.about_title || "Nossa loja"}</span>
          <h1>{tenant.name}</h1>
          <p>{tenant.hero_tagline || T.hero}</p>
        </div>
      </section>
      <div className="ph-wrap ph-about-grid">
        <article className="ph-about-text">
          {tenant.banner_url && <img src={tenant.banner_url} alt={tenant.name} />}
          <h2>Cuidado com clareza</h2>
          <p>{tenant.about_text || T.sub}</p>
          <StoreButton asChild size="md"><Link to={path("/catalogo")}>Ver catálogo <ArrowRight size={17} aria-hidden="true" /></Link></StoreButton>
        </article>
        <aside className="ph-about-side">
          <div className="ph-infocard">
            <h2>Fale com a loja</h2>
            <ul>
              {tenant.whatsapp && <li><MessageCircle size={18} aria-hidden="true" /><a href={whatsappLink(tenant)} target="_blank" rel="noreferrer">{tenant.whatsapp}</a></li>}
              {tenant.show_address && tenant.address && <li><MapPin size={18} aria-hidden="true" /><span>{tenant.address}</span></li>}
              {tenant.instagram_url && <li><Instagram size={18} aria-hidden="true" /><a href={tenant.instagram_url} target="_blank" rel="noreferrer">Instagram</a></li>}
              {tenant.facebook_url && <li><Facebook size={18} aria-hidden="true" /><a href={tenant.facebook_url} target="_blank" rel="noreferrer">Facebook</a></li>}
            </ul>
          </div>
          {hours.length > 0 && (
            <div className="ph-infocard">
              <h2><Clock size={18} aria-hidden="true" /> Horário de atendimento</h2>
              <ul className="ph-hours">
                {hours.map((h) => (<li key={h.day} className={h.closed ? "is-closed" : ""}><span>{h.day}</span><span>{h.text}</span></li>))}
              </ul>
            </div>
          )}
          {(policies?.shipping || policies?.returns || policies?.exchange) && (
            <div className="ph-infocard">
              <h2><Truck size={18} aria-hidden="true" /> Entrega e trocas</h2>
              {policies?.shipping && <p><b>Entrega.</b> {policies.shipping}</p>}
              {policies?.exchange && <p><b>Troca.</b> {policies.exchange}</p>}
              {policies?.returns && <p><b>Devolução.</b> {policies.returns}</p>}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
