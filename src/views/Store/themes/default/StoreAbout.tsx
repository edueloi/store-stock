import { Link } from "react-router-dom";
import { Clock, Facebook, Instagram, MapPin, MessageCircle } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import { hoursList, useKit, whatsappLink } from "./kit";
import "./styles.css";

export default function StoreAbout() {
  const { tenant, active, categories, path, sf } = useKit();
  const wa = whatsappLink(tenant);
  const hours = hoursList(tenant);
  const policies = tenant.policies;
  const info = [
    { t: "Entrega", v: policies?.shipping },
    { t: "Trocas e devoluções", v: [policies?.returns, policies?.exchange].filter(Boolean).join(" ") },
  ].filter((i) => i.v);
  return (
    <div className="dfl-page">
      <StoreSEO title={`Sobre — ${tenant.name}`} description={tenant.about_text || `Conheça a ${tenant.name}.`} image={tenant.banner_url || tenant.logo_url} url={typeof window !== "undefined" ? window.location.href : ""} siteName={tenant.name} />
      <div className="dfl-wrap">
        <nav className="dfl-crumbs" aria-label="Você está em"><Link to={path()}>Início</Link><span>/</span><span aria-current="page">Sobre a loja</span></nav>
        <div className="dfl-about">
          <article className="dfl-box dfl-about-main">
            <h1>{sf.about_title || `Sobre a ${tenant.name}`}</h1>
            <p className="dfl-about-text">{tenant.about_text || `${tenant.name} reúne produtos selecionados com atendimento próximo e compra simples.`}</p>
            <ul className="dfl-stats">
              <li><strong>{active.length}</strong><span>produtos</span></li>
              <li><strong>{categories.length}</strong><span>categorias</span></li>
              {wa && <li><strong>WhatsApp</strong><span>atendimento direto</span></li>}
            </ul>
            {info.map((i) => <section key={i.t} className="dfl-info"><h2>{i.t}</h2><p>{i.v}</p></section>)}
            <Link to={path("/catalogo")} className="dfl-btn dfl-btn-inline">Ver produtos</Link>
          </article>
          <aside className="dfl-box dfl-about-side">
            {tenant.banner_url && <img src={tenant.banner_url} alt="" className="dfl-about-img" />}
            <h2>Fale com a gente</h2>
            {wa && <a href={wa} target="_blank" rel="noreferrer" className="dfl-line"><MessageCircle size={16} /> {tenant.whatsapp}</a>}
            {tenant.show_address && tenant.address && <p className="dfl-line"><MapPin size={16} /> {tenant.address}</p>}
            {tenant.instagram_url && <a href={tenant.instagram_url} target="_blank" rel="noreferrer" className="dfl-line"><Instagram size={16} /> Instagram</a>}
            {tenant.facebook_url && <a href={tenant.facebook_url} target="_blank" rel="noreferrer" className="dfl-line"><Facebook size={16} /> Facebook</a>}
            {hours.length > 0 && (
              <>
                <h3><Clock size={15} /> Horários</h3>
                <ul className="dfl-hours-list">{hours.map((h) => <li key={h.day}><span>{h.day}</span><b>{h.text}</b></li>)}</ul>
              </>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
