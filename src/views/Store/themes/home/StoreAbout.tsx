import { Link } from "react-router-dom";
import { Clock, Facebook, Instagram, MapPin, MessageCircle, Ruler, Store, Truck } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import { hoursRows, useKit } from "./kit";
import "./styles.css";

export default function StoreAbout() {
  const { tenant, categories, active, path, sf, waLink } = useKit();
  const hours = hoursRows(tenant);
  const title = sf.about_title || `Conheça a ${tenant.name}`;
  const text = tenant.about_text || `${tenant.name} reúne materiais, acabamentos e itens de decoração para você planejar cada cômodo da casa com tranquilidade.`;
  return (
    <main className="hm-page">
      <StoreSEO title={`Sobre — ${tenant.name}`} description={text} image={tenant.banner_url || tenant.logo_url} url={typeof window !== "undefined" ? window.location.href : ""} siteName={tenant.name} />
      <section className="hm-about-hero">
        <div className="hm-wrap hm-about-grid">
          <div>
            <p className="hm-kicker"><Store size={14} aria-hidden="true" /> Sobre a loja</p>
            <h1>{title}</h1>
            <p className="hm-about-text">{text}</p>
            <div className="hm-hero-links">
              <Link className="hm-btn hm-btn-dark" to={path("/catalogo")}>Ver catálogo</Link>
              {tenant.whatsapp && <a className="hm-btn hm-btn-line" href={waLink()} target="_blank" rel="noreferrer"><MessageCircle size={16} aria-hidden="true" /> WhatsApp</a>}
            </div>
          </div>
          <div className="hm-about-img">{tenant.banner_url ? <img src={tenant.banner_url} alt="" /> : <div className="hm-scene-art" aria-hidden="true"><span className="hm-scene-win" /><span className="hm-scene-sofa" /><span className="hm-scene-lamp" /><span className="hm-scene-floor" /></div>}</div>
        </div>
      </section>

      <section className="hm-section">
        <div className="hm-wrap hm-about-cards">
          <article><Ruler size={22} aria-hidden="true" /><h3>Produto e medida certos</h3><p>{active.length} {active.length === 1 ? "item" : "itens"} em {categories.length} {categories.length === 1 ? "departamento" : "departamentos"}. Confira medidas na aba de cada produto.</p></article>
          <article><Store size={22} aria-hidden="true" /><h3>Retirada na loja</h3><p>Monte o pedido pelo site e combine a retirada com a nossa equipe.</p></article>
          <article><Truck size={22} aria-hidden="true" /><h3>Entrega</h3><p>{sf.shipping_status === "enabled" ? "Entrega disponível para a sua região." : "Entrega sob consulta: fale com a loja para combinar."}</p></article>
        </div>
      </section>

      <section className="hm-section hm-section-concrete">
        <div className="hm-wrap hm-about-info">
          <div>
            <h2>Onde estamos</h2>
            {tenant.show_address && tenant.address ? <p className="hm-line"><MapPin size={16} aria-hidden="true" /> {tenant.address}</p> : <p>Atendimento online e combinado pelo WhatsApp.</p>}
            <div className="hm-social hm-social-dark">
              {tenant.instagram_url && <a href={tenant.instagram_url} target="_blank" rel="noreferrer" aria-label="Instagram"><Instagram size={18} /></a>}
              {tenant.facebook_url && <a href={tenant.facebook_url} target="_blank" rel="noreferrer" aria-label="Facebook"><Facebook size={18} /></a>}
            </div>
          </div>
          <div>
            <h2>Horário de atendimento</h2>
            {hours.length ? hours.map((h) => <p key={h.day} className="hm-hours hm-hours-dark"><Clock size={13} aria-hidden="true" /> <span>{h.day}</span> <b>{h.text}</b></p>) : <p>Consulte a loja para confirmar o horário.</p>}
          </div>
        </div>
      </section>
    </main>
  );
}
