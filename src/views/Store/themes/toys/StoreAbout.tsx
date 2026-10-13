import { Link } from "react-router-dom";
import { ArrowRight, Clock, Gift, MapPin, MessageCircle, Puzzle, Truck } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import { hoursLines, productImage, useKit, whatsappLink } from "./kit";
import { Shapes } from "./parts";
import "./styles.css";

export default function StoreAbout() {
  const { tenant, active, categories, path, sf } = useKit();
  const hours = hoursLines(tenant.business_hours);
  const wa = whatsappLink(tenant.whatsapp, `Olá! Vim pela loja ${tenant.name}.`);
  const about = tenant.about_text || `${tenant.name} reúne brinquedos escolhidos com carinho para dar asas à imaginação.`;
  const photo = tenant.banner_url || productImage(active.find((p) => p.is_featured) || active[0]);
  const policies = tenant.policies;
  const stats = [
    { n: active.length, label: "brinquedos no catálogo" },
    { n: categories.length, label: "categorias para explorar" },
  ];
  return (
    <div className="toys-page toys-about">
      <StoreSEO
        title={`${sf.about_title || "Nossa loja"} | ${tenant.name}`}
        description={about}
        image={tenant.banner_url || tenant.logo_url}
        url={typeof window !== "undefined" ? window.location.href : ""}
        siteName={tenant.name}
      />
      <header className="toys-about-hero">
        <Shapes />
        <div className="toys-about-copy">
          <span className="toys-pill">
            <Puzzle size={15} /> Quem somos
          </span>
          <h1>{sf.about_title || `Bem-vindo à ${tenant.name}!`}</h1>
          <p>{about}</p>
          <div className="toys-actions">
            <Link className="toys-btn toys-btn-yellow toys-btn-lg" to={path("/catalogo")}>
              Ver os brinquedos <ArrowRight size={19} />
            </Link>
            {wa && (
              <a className="toys-btn toys-btn-white toys-btn-lg" href={wa} target="_blank" rel="noreferrer">
                <MessageCircle size={19} /> Falar com a loja
              </a>
            )}
          </div>
        </div>
        <div className="toys-about-art">
          <div className="toys-polaroid toys-polaroid-tilt">
            <div className="toys-polaroid-img">{photo ? <img src={photo} alt={tenant.name} /> : <Puzzle size={80} aria-label="Sem imagem" />}</div>
            <span className="toys-polaroid-cap">{tenant.name}</span>
          </div>
        </div>
      </header>

      <section className="toys-section">
        <div className="toys-stats">
          {stats.map((s, i) => (
            <div key={s.label} className={`toys-stat toys-tint-${i}`}>
              <strong>{s.n}</strong>
              <span>{s.label}</span>
            </div>
          ))}
          <div className="toys-stat toys-tint-2">
            <strong>
              <Gift size={34} aria-hidden="true" />
            </strong>
            <span>presentes para toda ocasião</span>
          </div>
        </div>
      </section>

      <section className="toys-section toys-info">
        {(tenant.show_address && tenant.address) || hours.length > 0 || wa ? (
          <article className="toys-info-card toys-tint-1">
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
              <dl className="toys-hours toys-hours-dark">
                <dt className="toys-hours-title">
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
        ) : null}
        {policies?.shipping && (
          <article className="toys-info-card toys-tint-2">
            <h2>
              <Truck size={22} aria-hidden="true" /> Entrega
            </h2>
            <p className="toys-pre">{policies.shipping}</p>
          </article>
        )}
        {policies?.returns && (
          <article className="toys-info-card toys-tint-3">
            <h2>Trocas e devoluções</h2>
            <p className="toys-pre">{policies.returns}</p>
          </article>
        )}
        {policies?.exchange && (
          <article className="toys-info-card toys-tint-0">
            <h2>Trocas</h2>
            <p className="toys-pre">{policies.exchange}</p>
          </article>
        )}
      </section>
    </div>
  );
}
