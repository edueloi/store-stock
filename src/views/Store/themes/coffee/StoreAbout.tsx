import { Link } from "react-router-dom";
import { ArrowRight, Clock, Coffee, MapPin, MessageCircle, Truck } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import { hoursLines, useKit, whatsappLink } from "./kit";
import "./styles.css";

export default function StoreAbout() {
  const { tenant, active, categories, path, sf } = useKit();
  const hours = hoursLines(tenant.business_hours);
  const wa = whatsappLink(tenant.whatsapp, `Olá! Vim pela loja ${tenant.name}.`);
  const about = tenant.about_text || `${tenant.name} nasceu para transformar cada pausa em um momento especial.`;
  const photo = tenant.banner_url || "/store-assets/coffee-house-footer-v1.jpg";
  const policies = tenant.policies;
  return (
    <div className="cf-page cf-about">
      <StoreSEO
        title={`${sf.about_title || "Nossa casa"} | ${tenant.name}`}
        description={about}
        image={tenant.banner_url || tenant.logo_url}
        url={typeof window !== "undefined" ? window.location.href : ""}
        siteName={tenant.name}
      />
      <header className="cf-about-hero">
        <div className="cf-about-copy">
          <span className="cf-hand">nossa casa</span>
          <h1>{sf.about_title || `Prazer, somos a ${tenant.name}`}</h1>
          <p className="cf-pre">{about}</p>
          <div className="cf-actions">
            <Link className="cf-btn cf-btn-lg" to={path("/catalogo")}>
              Ver o cardápio <ArrowRight size={18} />
            </Link>
            {wa && (
              <a className="cf-btn cf-btn-line cf-btn-lg" href={wa} target="_blank" rel="noreferrer">
                <MessageCircle size={18} /> Falar com a gente
              </a>
            )}
          </div>
        </div>
        <div className="cf-about-photo">{photo ? <img src={photo} alt={tenant.name} /> : <Coffee size={90} aria-label="Sem imagem" />}</div>
      </header>

      <section className="cf-section cf-about-stats">
        <div>
          <strong>{active.length}</strong>
          <span>itens no cardápio</span>
        </div>
        <div>
          <strong>{categories.length}</strong>
          <span>seções</span>
        </div>
        <div>
          <Coffee size={30} aria-hidden="true" />
          <span>cafés e sabores</span>
        </div>
      </section>

      <section className="cf-section cf-info">
        {((tenant.show_address && tenant.address) || hours.length > 0 || wa) && (
          <article className="cf-info-card">
            <h2>Venha nos visitar</h2>
            {tenant.show_address && tenant.address && (
              <p>
                <MapPin size={18} aria-hidden="true" /> {tenant.address}
              </p>
            )}
            {wa && (
              <p>
                <MessageCircle size={18} aria-hidden="true" />
                <a href={wa} target="_blank" rel="noreferrer">
                  {tenant.whatsapp}
                </a>
              </p>
            )}
            {hours.length > 0 && (
              <dl className="cf-hours">
                <dt className="cf-hours-title">
                  <Clock size={16} aria-hidden="true" /> Horários
                </dt>
                {hours.map((h) => (
                  <div key={h.day}>
                    <dt>{h.day}</dt>
                    <dd>{h.text}</dd>
                  </div>
                ))}
              </dl>
            )}
          </article>
        )}
        {policies?.shipping && (
          <article className="cf-info-card">
            <h2>
              <Truck size={20} aria-hidden="true" /> Entrega
            </h2>
            <p className="cf-pre">{policies.shipping}</p>
          </article>
        )}
        {policies?.returns && (
          <article className="cf-info-card">
            <h2>Trocas e devoluções</h2>
            <p className="cf-pre">{policies.returns}</p>
          </article>
        )}
        {policies?.exchange && (
          <article className="cf-info-card">
            <h2>Trocas</h2>
            <p className="cf-pre">{policies.exchange}</p>
          </article>
        )}
      </section>
    </div>
  );
}
