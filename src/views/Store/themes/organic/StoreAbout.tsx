import { Link } from "react-router-dom";
import { ArrowRight, Facebook, Instagram, MapPin, MessageCircle } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import { hoursRows, pageUrl, useShop, whatsappLink } from "./core";
import { Leaf, Seal, Sprig, T } from "./parts";

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
        <span className="or-over">{config.about_title || "Nossa história"}</span>
        <h1>{tenant.name}</h1>
        <p>{tenant.hero_tagline || T.hero}</p>
        <Sprig className="or-sprig" />
      </header>

      <section className="or-aboutgrid">
        <div className="or-arch-wrap">
          <div className="or-arch"><div className="or-arch-in">{tenant.banner_url ? <img src={tenant.banner_url} alt={tenant.name} /> : tenant.logo_url ? <img className="or-contain" src={tenant.logo_url} alt={tenant.name} /> : <Leaf size={90} />}</div></div>
          <Seal className="or-seal-big" />
        </div>
        <div className="or-text">
          <p className="or-dropcap">{tenant.about_text || T.sub}</p>
          <Link to={path("/catalogo")} className="or-btn">Ver o catálogo <ArrowRight size={18} aria-hidden="true" /></Link>
        </div>
      </section>

      <section className="or-values">
        {values.map(([t, d], i) => (
          <div key={t}><span>{["I", "II", "III"][i]}</span><h2>{t}</h2><p>{d}</p></div>
        ))}
      </section>

      <section className="or-visit">
        <div>
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
          <div>
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
