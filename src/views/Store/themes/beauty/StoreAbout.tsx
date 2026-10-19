import { Link } from "react-router-dom";
import { Clock, MapPin, MessageCircle, Sparkles, Truck } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import { StoreButton } from "../../../../components/store/StoreButton";
import { hoursLines, productImage, useKit, whatsappLink } from "./kit";
import "./styles.css";

export default function StoreAbout() {
  const { tenant, active, categories, path, sf } = useKit();
  const hours = hoursLines(tenant.business_hours);
  const wa = whatsappLink(tenant.whatsapp, `Olá! Vim pela loja ${tenant.name}.`);
  const about = tenant.about_text || "Uma curadoria de beleza para deixar a sua rotina mais leve, consciente e especial.";
  const photo = tenant.banner_url || productImage(active.find((p) => p.is_featured) || active[0]);
  const policies = tenant.policies;
  return (
    <div className="bty-page">
      <StoreSEO title={`${sf.about_title || "Nossa loja"} | ${tenant.name}`} description={about} image={tenant.banner_url || tenant.logo_url} url={typeof window !== "undefined" ? window.location.href : ""} siteName={tenant.name} />
      <header className="bty-wrap bty-about-hero">
        <div className="bty-hero-copy">
          <span className="bty-eyebrow">Nossa essência</span>
          <h1>{sf.about_title || `Beleza que acompanha os seus rituais`}</h1>
          <p className="bty-pre">{about}</p>
          <StoreButton asChild size="lg" className="bty-btn bty-btn-lg"><Link to={path("/catalogo")}>Conhecer os produtos</Link></StoreButton>
        </div>
        <div className="bty-hero-art">
          <span className="bty-arch-ring" aria-hidden="true" />
          <div className="bty-arch is-cover">{photo ? <img src={photo} alt={tenant.name} /> : <Sparkles size={56} aria-label="Sem imagem" />}</div>
        </div>
      </header>
      <section className="bty-wrap bty-section">
        <div className="bty-stats">
          <div><strong>{active.length}</strong><span>produtos selecionados</span></div>
          <div><strong>{categories.length}</strong><span>categorias para explorar</span></div>
        </div>
      </section>
      <section className="bty-wrap bty-info">
        {((tenant.show_address && tenant.address) || hours.length > 0 || wa) && (
          <article className="bty-info-card">
            <h2>Venha nos visitar</h2>
            {tenant.show_address && tenant.address && <p><MapPin size={17} aria-hidden="true" /> {tenant.address}</p>}
            {wa && <p><MessageCircle size={17} aria-hidden="true" /> <a href={wa} target="_blank" rel="noreferrer">{tenant.whatsapp}</a></p>}
            {hours.map((h) => <p key={h.day} className="bty-hour"><Clock size={15} aria-hidden="true" /> <span>{h.day}</span> {h.text}</p>)}
          </article>
        )}
        {policies?.shipping && <article className="bty-info-card"><h2><Truck size={20} aria-hidden="true" /> Entrega</h2><p className="bty-pre">{policies.shipping}</p></article>}
        {policies?.returns && <article className="bty-info-card"><h2>Trocas e devoluções</h2><p className="bty-pre">{policies.returns}</p></article>}
        {policies?.exchange && <article className="bty-info-card"><h2>Trocas</h2><p className="bty-pre">{policies.exchange}</p></article>}
      </section>
    </div>
  );
}
