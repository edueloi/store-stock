import { Link } from "react-router-dom";
import { ArrowRight, Clock, Facebook, HeartHandshake, Instagram, Leaf, MapPin, MessageCircle, Sparkles } from "lucide-react";
import { StoreButton } from "../../../../components/store/StoreButton";
import StoreSEO from "../../../../components/store/StoreSEO";
import { hoursRows, pageUrl, useShop, whatsappLink } from "./core";
import { Blob, T } from "./parts";

export default function StoreAbout() {
  const { tenant, config, path } = useShop();
  const hours = hoursRows(tenant);
  const policies = tenant.policies;
  const values = [
    { icon: <HeartHandshake size={22} />, title: "Acolhimento", text: "Atendimento próximo e sem pressa." },
    { icon: <Leaf size={22} />, title: "Seleção cuidadosa", text: "Produtos pensados para a sua rotina." },
    { icon: <Sparkles size={22} />, title: "Clareza", text: "Informações simples para decidir bem." },
  ];
  return (
    <div className="ca ca-page">
      <StoreSEO title={`${config.about_title || "Nossa história"} | ${tenant.name}`} description={tenant.about_text || T.sub} image={tenant.banner_url} siteName={tenant.name} url={pageUrl()} />
      <section className="ca-about">
        <div className="ca-about-art">
          <Blob className="ca-blob-a" />
          <div className="ca-hero-photo">{tenant.banner_url ? <img src={tenant.banner_url} alt={tenant.name} /> : tenant.logo_url ? <img className="ca-contain" src={tenant.logo_url} alt={tenant.name} /> : <Leaf size={90} aria-hidden="true" />}</div>
        </div>
        <div className="ca-about-copy">
          <span className="ca-eyebrow">{config.about_title || "Nossa história"}</span>
          <h1>{tenant.name}</h1>
          <p className="ca-lead">{tenant.hero_tagline || T.hero}</p>
          <p>{tenant.about_text || T.sub}</p>
          <StoreButton asChild size="lg" className="ca-b ca-b-solid">
            <Link to={path("/catalogo")}>Explorar produtos <ArrowRight size={18} aria-hidden="true" /></Link>
          </StoreButton>
        </div>
      </section>

      <section className="ca-benefits" aria-label="Nossos valores">
        {values.map((b) => (
          <div key={b.title} className="ca-benefit"><span>{b.icon}</span><div><b>{b.title}</b><p>{b.text}</p></div></div>
        ))}
      </section>

      <section className="ca-contact">
        <div className="ca-card-soft">
          <h2>Onde nos encontrar</h2>
          <ul>
            {tenant.show_address && tenant.address && <li><MapPin size={18} aria-hidden="true" /> {tenant.address}</li>}
            {tenant.whatsapp && <li><MessageCircle size={18} aria-hidden="true" /> <a href={whatsappLink(tenant)} target="_blank" rel="noreferrer">{tenant.whatsapp}</a></li>}
            {tenant.instagram_url && <li><Instagram size={18} aria-hidden="true" /> <a href={tenant.instagram_url} target="_blank" rel="noreferrer">Instagram</a></li>}
            {tenant.facebook_url && <li><Facebook size={18} aria-hidden="true" /> <a href={tenant.facebook_url} target="_blank" rel="noreferrer">Facebook</a></li>}
          </ul>
        </div>
        {hours.length > 0 && (
          <div className="ca-card-soft">
            <h2><Clock size={18} aria-hidden="true" /> Horários</h2>
            <ul className="ca-hours">
              {hours.map((h) => <li key={h.day} className={h.closed ? "is-closed" : ""}><span>{h.day}</span><span>{h.text}</span></li>)}
            </ul>
          </div>
        )}
        {(policies?.shipping || policies?.returns || policies?.exchange) && (
          <div className="ca-card-soft">
            <h2>Entrega e trocas</h2>
            {policies?.shipping && <p>{policies.shipping}</p>}
            {policies?.exchange && <p>{policies.exchange}</p>}
            {policies?.returns && <p>{policies.returns}</p>}
          </div>
        )}
      </section>
    </div>
  );
}
