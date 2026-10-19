import { Link } from "react-router-dom";
import { Facebook, Instagram, MapPin, MessageCircle } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import { hoursRows, useKit } from "./kit";
import "./styles.css";

export default function StoreAbout() {
  const { tenant, path, sf, waLink } = useKit();
  const hours = hoursRows(tenant);
  const title = sf.about_title || "O ateliê";
  const text = tenant.about_text || `${tenant.name} nasceu do cuidado com cada detalhe: tecido, modelagem e acabamento.`;
  return (
    <main className="atl-page">
      <StoreSEO title={`Sobre — ${tenant.name}`} description={text} image={tenant.banner_url || tenant.logo_url} url={typeof window !== "undefined" ? window.location.href : ""} siteName={tenant.name} />
      <section className="atl-wrap atl-about">
        <div className="atl-about-copy">
          <span className="atl-kicker">Nossa história</span>
          <h1>{title}</h1>
          <p className="atl-about-text">{text}</p>
          <div className="atl-actions">
            <Link className="atl-btn" to={path("/catalogo")}>Ver a coleção</Link>
            {tenant.whatsapp && <a className="atl-btn atl-btn-ghost" href={waLink()} target="_blank" rel="noreferrer"><MessageCircle size={17} /> WhatsApp</a>}
          </div>
        </div>
        <div className="atl-about-art">{tenant.banner_url ? <img src={tenant.banner_url} alt="" /> : <span aria-hidden="true">{tenant.name.slice(0, 1)}</span>}</div>
      </section>
      <section className="atl-wrap atl-about-info">
        <div className="atl-info-card">
          <h2>Visite o ateliê</h2>
          {tenant.show_address && tenant.address ? <p className="atl-line"><MapPin size={16} /> {tenant.address}</p> : <p>Atendimento online e pelo WhatsApp.</p>}
          <div className="atl-social">
            {tenant.instagram_url && <a href={tenant.instagram_url} target="_blank" rel="noreferrer" aria-label="Instagram"><Instagram size={19} strokeWidth={1.5} /></a>}
            {tenant.facebook_url && <a href={tenant.facebook_url} target="_blank" rel="noreferrer" aria-label="Facebook"><Facebook size={19} strokeWidth={1.5} /></a>}
          </div>
        </div>
        <div className="atl-info-card">
          <h2>Horários</h2>
          {hours.length ? <ul className="atl-hours">{hours.map((h) => <li key={h.day}><span>{h.day}</span> {h.text}</li>)}</ul> : <p>Consulte a loja para confirmar o horário.</p>}
        </div>
      </section>
    </main>
  );
}
