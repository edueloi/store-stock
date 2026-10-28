import { Link } from "react-router-dom";
import { Clock, MapPin, MessageCircle, Truck, Wine } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import { hoursLines, productImage, useKit, whatsappLink } from "./kit";
import "./styles.css";

export default function StoreAbout() {
  const { tenant, active, categories, path, sf } = useKit();
  const hours = hoursLines(tenant.business_hours);
  const wa = whatsappLink(tenant.whatsapp, `Olá! Vim pela loja ${tenant.name}.`);
  const about = tenant.about_text || `${tenant.name} é a adega do bairro: bebida gelada, gelo, carvão e conveniência para a sua noite.`;
  const photo = tenant.banner_url || productImage(active.find((p) => p.is_featured) || active[0]);
  const policies = tenant.policies;
  const showAddress = tenant.show_address && tenant.address;
  const mapUrl = showAddress ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(tenant.address || "")}` : "";
  return (
    <div className="adg-page">
      <StoreSEO title={`${sf.about_title || "A adega"} | ${tenant.name}`} description={about} image={tenant.banner_url || tenant.logo_url} url={typeof window !== "undefined" ? window.location.href : ""} siteName={tenant.name} />
      <header className="adg-wrap adg-about-hero">
        <div className="adg-about-copy">
          <span className="adg-kicker">Nossa história</span>
          <h1>{sf.about_title || tenant.name}</h1>
          <p className="adg-pre">{about}</p>
          <div className="adg-hero-cta">
            <Link className="adg-btn adg-btn-lg" to={path("/catalogo")}>Ver cardápio</Link>
            {wa && <a className="adg-btn adg-btn-ghost adg-btn-lg" href={wa} target="_blank" rel="noreferrer"><MessageCircle size={18} /> WhatsApp</a>}
          </div>
        </div>
        <div className="adg-about-art">{photo ? <img src={photo} alt={tenant.name} /> : <Wine size={64} aria-label="Sem imagem" />}</div>
      </header>
      <section className="adg-wrap adg-stats">
        <div><strong>{String(active.length).padStart(2, "0")}</strong><span>produtos no cardápio</span></div>
        <div><strong>{String(categories.length).padStart(2, "0")}</strong><span>categorias</span></div>
      </section>
      <section className="adg-wrap adg-info-cards">
        {(showAddress || hours.length > 0 || wa) && (
          <article>
            <h2>Venha ou peça</h2>
            {showAddress && <p><MapPin size={17} aria-hidden="true" /> {tenant.address}</p>}
            {mapUrl && <p><a className="adg-link" href={mapUrl} target="_blank" rel="noreferrer">Abrir no mapa</a></p>}
            {wa && <p><MessageCircle size={17} aria-hidden="true" /> <a href={wa} target="_blank" rel="noreferrer">{tenant.whatsapp}</a></p>}
            {hours.map((h) => <p key={h.day}><Clock size={15} aria-hidden="true" /> <b>{h.day}</b> {h.text}</p>)}
          </article>
        )}
        {policies?.shipping && <article><h2><Truck size={20} aria-hidden="true" /> Entrega</h2><p className="adg-pre">{policies.shipping}</p></article>}
        {policies?.returns && <article><h2>Trocas e devoluções</h2><p className="adg-pre">{policies.returns}</p></article>}
        {policies?.exchange && <article><h2>Trocas</h2><p className="adg-pre">{policies.exchange}</p></article>}
      </section>
    </div>
  );
}
