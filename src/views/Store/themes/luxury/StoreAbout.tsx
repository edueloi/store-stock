import { Link } from "react-router-dom";
import { Clock, Gem, MapPin, MessageCircle, Truck } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import { StoreButton } from "../../../../components/store/StoreButton";
import { hoursLines, productImage, useKit, whatsappLink } from "./kit";
import "./styles.css";

export default function StoreAbout() {
  const { tenant, active, categories, path, sf } = useKit();
  const hours = hoursLines(tenant.business_hours);
  const wa = whatsappLink(tenant.whatsapp, `Olá! Vim pela loja ${tenant.name}.`);
  const about = tenant.about_text || `${tenant.name} reúne peças selecionadas com o cuidado que cada detalhe merece.`;
  const photo = tenant.banner_url || productImage(active.find((p) => p.is_featured) || active[0]);
  const policies = tenant.policies;
  return (
    <div className="lux-page">
      <StoreSEO title={`${sf.about_title || "Maison"} | ${tenant.name}`} description={about} image={tenant.banner_url || tenant.logo_url} url={typeof window !== "undefined" ? window.location.href : ""} siteName={tenant.name} />
      <header className="lux-wrap lux-about-hero">
        <div className="lux-about-copy">
          <span className="lux-eyebrow">A maison</span>
          <h1>{sf.about_title || `${tenant.name}, em essência`}</h1>
          <p className="lux-pre">{about}</p>
          <StoreButton asChild size="lg" className="lux-btn lux-btn-lg"><Link to={path("/catalogo")}>Descobrir a coleção</Link></StoreButton>
        </div>
        <div className="lux-about-art">
          <div className="lux-arch">{photo ? <img src={photo} alt={tenant.name} /> : <Gem size={56} aria-label="Sem imagem" />}</div>
        </div>
      </header>
      <section className="lux-wrap lux-stats">
        <div><strong>{String(active.length).padStart(2, "0")}</strong><span>peças na coleção</span></div>
        <div><strong>{String(categories.length).padStart(2, "0")}</strong><span>coleções para explorar</span></div>
      </section>
      <section className="lux-wrap lux-info">
        {((tenant.show_address && tenant.address) || hours.length > 0 || wa) && (
          <article className="lux-info-card">
            <h2>Visite-nos</h2>
            {tenant.show_address && tenant.address && <p><MapPin size={17} aria-hidden="true" /> {tenant.address}</p>}
            {wa && <p><MessageCircle size={17} aria-hidden="true" /> <a href={wa} target="_blank" rel="noreferrer">{tenant.whatsapp}</a></p>}
            {hours.map((h) => <p key={h.day}><Clock size={15} aria-hidden="true" /> <b>{h.day}</b> {h.text}</p>)}
          </article>
        )}
        {policies?.shipping && <article className="lux-info-card"><h2><Truck size={20} aria-hidden="true" /> Entrega</h2><p className="lux-pre">{policies.shipping}</p></article>}
        {policies?.returns && <article className="lux-info-card"><h2>Trocas e devoluções</h2><p className="lux-pre">{policies.returns}</p></article>}
        {policies?.exchange && <article className="lux-info-card"><h2>Trocas</h2><p className="lux-pre">{policies.exchange}</p></article>}
      </section>
    </div>
  );
}
