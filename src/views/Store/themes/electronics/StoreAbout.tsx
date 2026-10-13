import { Link } from "react-router-dom";
import { Clock, Facebook, Instagram, MapPin, MessageCircle, RefreshCcw, ShieldCheck, Truck } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import { hoursList, useKit, whatsappLink } from "./kit";
import "./styles.css";

export default function StoreAbout() {
  const { tenant, active, categories, path, sf } = useKit();
  const wa = whatsappLink(tenant);
  const hours = hoursList(tenant);
  const pol = tenant.policies;
  const cards = [
    { icon: ShieldCheck, t: "Garantia", v: pol?.warranty_days ? `${pol.warranty_days} dias de garantia${pol.warranty_resolution_days ? `, com resolução em até ${pol.warranty_resolution_days} dias` : ""}.` : "" },
    { icon: Truck, t: "Entrega", v: pol?.shipping || "" },
    { icon: RefreshCcw, t: "Trocas e devoluções", v: [pol?.returns, pol?.exchange].filter(Boolean).join(" ") },
  ].filter((c) => c.v);
  return (
    <div className="elx-page">
      <StoreSEO title={`Sobre — ${tenant.name}`} description={tenant.about_text || `Conheça a ${tenant.name}.`} image={tenant.banner_url || tenant.logo_url} url={typeof window !== "undefined" ? window.location.href : ""} siteName={tenant.name} />
      <section className="elx-about-hero" style={tenant.banner_url ? { backgroundImage: `url(${tenant.banner_url})` } : undefined}>
        <div className="elx-wrap">
          <span className="elx-tag">Quem somos</span>
          <h1>{sf.about_title || `Sobre a ${tenant.name}`}</h1>
          <ul className="elx-about-stats">
            <li><strong>{active.length}</strong><span>produtos</span></li>
            <li><strong>{categories.length}</strong><span>departamentos</span></li>
            {wa && <li><strong>WhatsApp</strong><span>atendimento direto</span></li>}
          </ul>
        </div>
      </section>
      <div className="elx-wrap elx-about-grid">
        <article className="elx-panel">
          <h2>Nossa loja</h2>
          <p className="elx-about-text">{tenant.about_text || `${tenant.name} reúne tecnologia selecionada, atendimento próximo e compra simples.`}</p>
          <Link to={path("/catalogo")} className="elx-btn elx-btn-inline">Ver produtos</Link>
        </article>
        <aside className="elx-panel">
          <h2>Contato</h2>
          {wa && <a href={wa} target="_blank" rel="noreferrer" className="elx-line"><MessageCircle size={17} /> {tenant.whatsapp}</a>}
          {tenant.show_address && tenant.address && <p className="elx-line"><MapPin size={17} /> {tenant.address}</p>}
          {tenant.instagram_url && <a href={tenant.instagram_url} target="_blank" rel="noreferrer" className="elx-line"><Instagram size={17} /> Instagram</a>}
          {tenant.facebook_url && <a href={tenant.facebook_url} target="_blank" rel="noreferrer" className="elx-line"><Facebook size={17} /> Facebook</a>}
          {hours.length > 0 && (
            <>
              <h3><Clock size={15} /> Horário de atendimento</h3>
              <ul className="elx-hours-list">{hours.map((h) => <li key={h.day}><span>{h.day}</span><b>{h.text}</b></li>)}</ul>
            </>
          )}
        </aside>
      </div>
      {cards.length > 0 && (
        <div className="elx-wrap">
          <div className="elx-pol-grid">
            {cards.map(({ icon: Icon, t, v }) => <section key={t} className="elx-pol"><Icon size={26} strokeWidth={1.6} /><h3>{t}</h3><p>{v}</p></section>)}
          </div>
        </div>
      )}
    </div>
  );
}
