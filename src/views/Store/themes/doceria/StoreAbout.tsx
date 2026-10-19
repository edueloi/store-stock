import { Link } from "react-router-dom";
import { ArrowRight, CakeSlice, Clock, MapPin, MessageCircle, Truck } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import { hoursLines, productImage, useKit, whatsappLink } from "./kit";
import "./styles.css";

export default function StoreAbout() {
  const { tenant, active, categories, path, sf } = useKit();
  const hours = hoursLines(tenant.business_hours);
  const wa = whatsappLink(tenant.whatsapp, `Olá! Vim pela loja ${tenant.name}.`);
  const about = tenant.about_text || `${tenant.name} faz doces artesanais com ingredientes selecionados e muito carinho em cada receita.`;
  const photo = tenant.banner_url || productImage(active.find((p) => p.is_featured) || active[0]);
  const policies = tenant.policies;
  return (
    <div className="dc-page dc-about">
      <StoreSEO
        title={`${sf.about_title || "Nossa história"} | ${tenant.name}`}
        description={about}
        image={tenant.banner_url || tenant.logo_url}
        url={typeof window !== "undefined" ? window.location.href : ""}
        siteName={tenant.name}
      />
      <header className="dc-hero dc-about-hero">
        <div className="dc-hero-copy">
          <span className="dc-kicker">
            <CakeSlice size={15} aria-hidden="true" /> Nossa história
          </span>
          <h1>{sf.about_title || `Bem-vindo à ${tenant.name}`}</h1>
          <p className="dc-pre">{about}</p>
          <div className="dc-actions">
            <Link className="dc-btn dc-btn-lg" to={path("/catalogo")}>
              Ver o cardápio <ArrowRight size={19} />
            </Link>
            {wa && (
              <a className="dc-btn dc-btn-soft dc-btn-lg" href={wa} target="_blank" rel="noreferrer">
                <MessageCircle size={19} /> Falar com a loja
              </a>
            )}
          </div>
        </div>
        <div className="dc-hero-art">
          <div className="dc-blob">{photo ? <img src={photo} alt={tenant.name} /> : <CakeSlice size={96} aria-label="Sem imagem" />}</div>
        </div>
      </header>

      <section className="dc-section">
        <div className="dc-stats">
          <div>
            <strong>{active.length}</strong>
            <span>doces no cardápio</span>
          </div>
          <div>
            <strong>{categories.length}</strong>
            <span>sabores para explorar</span>
          </div>
          <div>
            <strong>100%</strong>
            <span>feito com carinho</span>
          </div>
        </div>
      </section>

      <section className="dc-section dc-info">
        {((tenant.show_address && tenant.address) || hours.length > 0 || wa) && (
          <article className="dc-info-card">
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
              <dl className="dc-hours">
                <dt className="dc-hours-title">
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
          <article className="dc-info-card">
            <h2>
              <Truck size={22} aria-hidden="true" /> Entrega
            </h2>
            <p className="dc-pre">{policies.shipping}</p>
          </article>
        )}
        {policies?.returns && (
          <article className="dc-info-card">
            <h2>Trocas e devoluções</h2>
            <p className="dc-pre">{policies.returns}</p>
          </article>
        )}
        {policies?.exchange && (
          <article className="dc-info-card">
            <h2>Trocas</h2>
            <p className="dc-pre">{policies.exchange}</p>
          </article>
        )}
      </section>
    </div>
  );
}
