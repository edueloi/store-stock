import { Link } from "react-router-dom";
import { Clock, Droplets, MapPin, MessageCircle, Truck } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import { StoreButton } from "../../../../components/store/StoreButton";
import { hoursLines, productImage, useKit, whatsappLink } from "./kit";
import "./styles.css";

export default function StoreAbout() {
  const { tenant, active, categories, path, sf } = useKit();
  const hours = hoursLines(tenant.business_hours);
  const wa = whatsappLink(tenant.whatsapp, `Olá! Vim pela loja ${tenant.name}.`);
  const about = tenant.about_text || `${tenant.name} reúne fragrâncias selecionadas para marcar presença em cada momento.`;
  const photo = tenant.banner_url || productImage(active.find((p) => p.is_featured) || active[0]);
  const policies = tenant.policies;
  return (
    <div className="frg-page">
      <StoreSEO title={`${sf.about_title || "Nossa loja"} | ${tenant.name}`} description={about} image={tenant.banner_url || tenant.logo_url} url={typeof window !== "undefined" ? window.location.href : ""} siteName={tenant.name} />
      <header className="frg-wrap frg-about-hero">
        <div className="frg-hero-copy">
          <span className="frg-eyebrow">Nossa essência</span>
          <h1>{sf.about_title || "Perfumaria com alma"}</h1>
          <p className="frg-pre">{about}</p>
          <StoreButton asChild size="lg" className="frg-btn frg-btn-lg"><Link to={path("/catalogo")}>Explorar fragrâncias</Link></StoreButton>
        </div>
        <div className="frg-hero-art">
          <div className="frg-hero-stage">
            <span className="frg-stage-disc" aria-hidden="true" />
            {photo ? <img src={photo} alt={tenant.name} /> : <Droplets size={64} aria-label="Sem imagem" />}
            <span className="frg-stage-shadow" aria-hidden="true" />
          </div>
        </div>
      </header>
      <section className="frg-wrap frg-stats">
        <div><strong>{active.length}</strong><span>fragrâncias na vitrine</span></div>
        <div><strong>{categories.length}</strong><span>famílias para explorar</span></div>
      </section>
      <section className="frg-wrap frg-info">
        {((tenant.show_address && tenant.address) || hours.length > 0 || wa) && (
          <article className="frg-info-card">
            <h2>Venha nos visitar</h2>
            {tenant.show_address && tenant.address && <p><MapPin size={17} aria-hidden="true" /> {tenant.address}</p>}
            {wa && <p><MessageCircle size={17} aria-hidden="true" /> <a href={wa} target="_blank" rel="noreferrer">{tenant.whatsapp}</a></p>}
            {hours.map((h) => <p key={h.day}><Clock size={15} aria-hidden="true" /> <b>{h.day}</b> {h.text}</p>)}
          </article>
        )}
        {policies?.shipping && <article className="frg-info-card"><h2><Truck size={20} aria-hidden="true" /> Entrega</h2><p className="frg-pre">{policies.shipping}</p></article>}
        {policies?.returns && <article className="frg-info-card"><h2>Trocas e devoluções</h2><p className="frg-pre">{policies.returns}</p></article>}
        {policies?.exchange && <article className="frg-info-card"><h2>Trocas</h2><p className="frg-pre">{policies.exchange}</p></article>}
      </section>
    </div>
  );
}
