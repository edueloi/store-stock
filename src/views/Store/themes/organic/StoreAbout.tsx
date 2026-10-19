import { Link } from "react-router-dom";
import { ArrowRight, Facebook, Instagram, MapPin, MessageCircle } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import { StoreButton } from "../../../../components/store/StoreButton";
import { hoursRows, pageUrl, useShop, whatsappLink } from "./core";
import { Leaf, Seal, T, Wave } from "./parts";

export default function StoreAbout() {
  const { tenant, config, path } = useShop();
  const hours = hoursRows(tenant);
  const policies = tenant.policies;
  const values = [
    ["Simplicidade", "Menos excessos, mais essência em cada escolha."],
    ["Cuidado artesanal", "Olhamos com calma para cada detalhe da seleção."],
    ["Proximidade", "Atendimento humano, do pedido à entrega."],
  ];
  return (
    <div className="or or-page">
      <StoreSEO title={`${config.about_title || "Nossa história"} | ${tenant.name}`} description={tenant.about_text || T.sub} image={tenant.banner_url} siteName={tenant.name} url={pageUrl()} />
      <header className="or-cathead">
        <div className="or-wrap or-cathead-in">
          <span className="or-over">{config.about_title || "Nossa história"}</span>
          <h1>{tenant.name}</h1>
          <p>{tenant.hero_tagline || T.hero}</p>
        </div>
        <Wave fill="var(--or-bg)" />
      </header>

      <section className="or-wrap or-aboutgrid">
        <div className="or-hero-art">
          <div className="or-blob">{tenant.banner_url ? <img src={tenant.banner_url} alt={tenant.name} /> : tenant.logo_url ? <img className="or-contain" src={tenant.logo_url} alt={tenant.name} /> : <Leaf size={90} />}</div>
          <Seal className="or-seal-float" />
        </div>
        <div className="or-text">
          <p className="or-dropcap">{tenant.about_text || T.sub}</p>
          <StoreButton asChild size="lg" className="or-cta">
            <Link to={path("/catalogo")}>Ver o catálogo <ArrowRight size={18} aria-hidden="true" /></Link>
          </StoreButton>
        </div>
      </section>

      <section className="or-wrap or-block">
        <ul className="or-values or-values-3">
          {values.map(([t, d]) => (
            <li key={t}><span className="or-values-ico"><Leaf size={22} /></span><b>{t}</b><p>{d}</p></li>
          ))}
        </ul>
      </section>

      <section className="or-wrap or-visit">
        <div className="or-vcard">
          <h2>Visite ou fale com a gente</h2>
          <ul className="or-contact">
            {tenant.show_address && tenant.address && <li><MapPin size={18} aria-hidden="true" /> {tenant.address}</li>}
            {tenant.whatsapp && <li><MessageCircle size={18} aria-hidden="true" /> <a href={whatsappLink(tenant)} target="_blank" rel="noreferrer">{tenant.whatsapp}</a></li>}
            {tenant.instagram_url && <li><Instagram size={18} aria-hidden="true" /> <a href={tenant.instagram_url} target="_blank" rel="noreferrer">Instagram</a></li>}
            {tenant.facebook_url && <li><Facebook size={18} aria-hidden="true" /> <a href={tenant.facebook_url} target="_blank" rel="noreferrer">Facebook</a></li>}
          </ul>
          {(policies?.shipping || policies?.returns || policies?.exchange) && (
            <div className="or-policies">
              {policies?.shipping && <p><b>Entrega.</b> {policies.shipping}</p>}
              {policies?.exchange && <p><b>Troca.</b> {policies.exchange}</p>}
              {policies?.returns && <p><b>Devolução.</b> {policies.returns}</p>}
            </div>
          )}
        </div>
        {hours.length > 0 && (
          <div className="or-vcard">
            <h2>Horários</h2>
            <ul className="or-hours or-hours-lg">
              {hours.map((h) => (<li key={h.day} className={h.closed ? "is-closed" : ""}><span>{h.day}</span><i /><span>{h.text}</span></li>))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}
