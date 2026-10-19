import { Link } from "react-router-dom";
import { Clock, Facebook, HeartHandshake, Instagram, MapPin, MessageCircle, Sofa, Store, Truck } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import { hoursRows, useKit, useUsedCategories } from "./kit";
import "./styles.css";

export default function StoreAbout() {
  const { tenant, active, path, sf, waLink } = useKit();
  const rooms = useUsedCategories();
  const hours = hoursRows(tenant);
  const title = sf.about_title || `Conheça a ${tenant.name}`;
  const text = tenant.about_text || `${tenant.name} reúne peças e itens de decoração para você planejar cada cômodo da casa com tranquilidade.`;
  return (
    <main className="hm-page">
      <StoreSEO title={`Sobre — ${tenant.name}`} description={text} image={tenant.banner_url || tenant.logo_url} url={typeof window !== "undefined" ? window.location.href : ""} siteName={tenant.name} />
      <section className="hm-wrap hm-about">
        <div className="hm-about-copy">
          <span className="hm-eyebrow"><Store size={14} /> Sobre a loja</span>
          <h1>{title}</h1>
          <p className="hm-about-text">{text}</p>
          <div className="hm-actions">
            <Link className="hm-btn" to={path("/catalogo")}>Ver catálogo</Link>
            {tenant.whatsapp && <a className="hm-btn hm-btn-soft" href={waLink()} target="_blank" rel="noreferrer"><MessageCircle size={17} /> WhatsApp</a>}
          </div>
        </div>
        <div className="hm-about-art">
          <div className="hm-arch">{tenant.banner_url ? <img src={tenant.banner_url} alt="" /> : <Sofa size={72} aria-hidden="true" />}</div>
        </div>
      </section>

      <section className="hm-wrap hm-about-cards">
        <article><HeartHandshake size={24} /><h3>Curadoria com carinho</h3><p>{active.length} {active.length === 1 ? "peça" : "peças"}{rooms.length ? ` em ${rooms.length} ${rooms.length === 1 ? "cômodo" : "cômodos"}` : ""}, escolhidas para a sua casa.</p></article>
        <article><Store size={24} /><h3>Retirada na loja</h3><p>Monte o pedido pelo site e combine a retirada com a nossa equipe.</p></article>
        <article><Truck size={24} /><h3>Entrega</h3><p>{sf.shipping_status === "enabled" ? "Entrega disponível para a sua região." : "Entrega sob consulta: fale com a loja para combinar."}</p></article>
      </section>

      <section className="hm-wrap hm-about-info">
        <div className="hm-info-card">
          <h2>Onde estamos</h2>
          {tenant.show_address && tenant.address ? <p className="hm-line"><MapPin size={16} /> {tenant.address}</p> : <p>Atendimento online e combinado pelo WhatsApp.</p>}
          <div className="hm-social">
            {tenant.instagram_url && <a href={tenant.instagram_url} target="_blank" rel="noreferrer" aria-label="Instagram"><Instagram size={18} /></a>}
            {tenant.facebook_url && <a href={tenant.facebook_url} target="_blank" rel="noreferrer" aria-label="Facebook"><Facebook size={18} /></a>}
          </div>
        </div>
        <div className="hm-info-card">
          <h2>Horário de atendimento</h2>
          {hours.length ? (
            <ul className="hm-hours">{hours.map((h) => <li key={h.day}><Clock size={13} /> <span>{h.day}</span> {h.text}</li>)}</ul>
          ) : (
            <p>Consulte a loja para confirmar o horário.</p>
          )}
        </div>
      </section>
    </main>
  );
}
