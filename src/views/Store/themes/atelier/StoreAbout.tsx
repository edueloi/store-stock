import { Link } from "react-router-dom";
import { Facebook, Instagram, MapPin, MessageCircle } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import { hoursList, imageOf, useKit, whatsappLink } from "./kit";
import "./styles.css";

export default function StoreAbout() {
  const { tenant, active, categories, path, sf } = useKit();
  const wa = whatsappLink(tenant);
  const hours = hoursList(tenant);
  const pol = tenant.policies;
  const photo = tenant.banner_url || imageOf(active[0] || ({} as never));
  const notes = [
    { t: "Entrega", v: pol?.shipping },
    { t: "Trocas e devoluções", v: [pol?.returns, pol?.exchange].filter(Boolean).join(" ") },
  ].filter((n) => n.v);
  return (
    <div className="atl-page">
      <StoreSEO title={`Sobre — ${tenant.name}`} description={tenant.about_text || `Conheça a ${tenant.name}.`} image={tenant.banner_url || tenant.logo_url} url={typeof window !== "undefined" ? window.location.href : ""} siteName={tenant.name} />
      <header className="atl-cat-head">
        <p className="atl-eyebrow">O ateliê</p>
        <h1>{sf.about_title || `Sobre a ${tenant.name}`}</h1>
      </header>
      <section className="atl-about">
        <div className="atl-about-photo">{photo ? <img src={photo} alt="" /> : <span aria-hidden="true">{tenant.name.slice(0, 1)}</span>}</div>
        <div className="atl-about-copy">
          <p className="atl-dropcap">{tenant.about_text || `${tenant.name} nasce do gosto pelo detalhe: peças selecionadas, atendimento próximo e um jeito calmo de escolher o que vestir.`}</p>
          <ul className="atl-facts">
            <li><strong>{active.length}</strong><span>peças</span></li>
            <li><strong>{categories.length}</strong><span>categorias</span></li>
          </ul>
          <Link to={path("/catalogo")} className="atl-btn">Ver a coleção</Link>
        </div>
      </section>
      {notes.length > 0 && (
        <section className="atl-notes">
          {notes.map((n) => <div key={n.t}><h2>{n.t}</h2><p>{n.v}</p></div>)}
        </section>
      )}
      <section className="atl-visit">
        <h2>Fale com o ateliê</h2>
        <div className="atl-visit-links">
          {wa && <a href={wa} target="_blank" rel="noreferrer"><MessageCircle size={18} strokeWidth={1.4} /> {tenant.whatsapp}</a>}
          {tenant.instagram_url && <a href={tenant.instagram_url} target="_blank" rel="noreferrer"><Instagram size={18} strokeWidth={1.4} /> Instagram</a>}
          {tenant.facebook_url && <a href={tenant.facebook_url} target="_blank" rel="noreferrer"><Facebook size={18} strokeWidth={1.4} /> Facebook</a>}
        </div>
        {tenant.show_address && tenant.address && <p className="atl-addr"><MapPin size={16} strokeWidth={1.4} /> {tenant.address}</p>}
        {hours.length > 0 && <ul className="atl-hours">{hours.map((h) => <li key={h.day}><span>{h.day}</span><b>{h.text}</b></li>)}</ul>}
      </section>
    </div>
  );
}
