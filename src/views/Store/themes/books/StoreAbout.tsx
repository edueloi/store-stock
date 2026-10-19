import { Link } from "react-router-dom";
import { ArrowRight, BookOpen, Clock, MapPin, MessageCircle, Truck } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import { hoursLines, productImage, useKit, whatsappLink } from "./kit";
import "./styles.css";

export default function StoreAbout() {
  const { tenant, active, categories, path, sf } = useKit();
  const hours = hoursLines(tenant.business_hours);
  const wa = whatsappLink(tenant.whatsapp, `Olá! Vim pela loja ${tenant.name}.`);
  const about = tenant.about_text || `${tenant.name} reúne livros escolhidos com cuidado para quem ama uma boa leitura.`;
  const photo = tenant.banner_url || productImage(active.find((p) => p.is_featured) || active[0]);
  const policies = tenant.policies;
  return (
    <div className="bk-page bk-about">
      <StoreSEO
        title={`${sf.about_title || "A livraria"} | ${tenant.name}`}
        description={about}
        image={tenant.banner_url || tenant.logo_url}
        url={typeof window !== "undefined" ? window.location.href : ""}
        siteName={tenant.name}
      />
      <header className="bk-about-hero">
        <div className="bk-about-copy">
          <span className="bk-kicker">
            <BookOpen size={15} aria-hidden="true" /> A livraria
          </span>
          <h1>{sf.about_title || `Bem-vindo à ${tenant.name}`}</h1>
          <p className="bk-pre">{about}</p>
          <div className="bk-actions">
            <Link className="bk-btn bk-btn-lg" to={path("/catalogo")}>
              Explorar a estante <ArrowRight size={18} />
            </Link>
            {wa && (
              <a className="bk-btn bk-btn-line bk-btn-lg" href={wa} target="_blank" rel="noreferrer">
                <MessageCircle size={18} /> Falar com a livraria
              </a>
            )}
          </div>
        </div>
        <div className="bk-about-cover">{photo ? <img src={photo} alt={tenant.name} /> : <BookOpen size={80} aria-label="Sem imagem" />}</div>
      </header>

      <section className="bk-section bk-about-stats">
        <div>
          <strong>{active.length}</strong>
          <span>títulos na estante</span>
        </div>
        <div>
          <strong>{categories.length}</strong>
          <span>gêneros</span>
        </div>
        <div>
          <BookOpen size={30} aria-hidden="true" />
          <span>curadoria feita com carinho</span>
        </div>
      </section>

      <section className="bk-section bk-info">
        {((tenant.show_address && tenant.address) || hours.length > 0 || wa) && (
          <article className="bk-info-card">
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
              <dl className="bk-hours">
                <dt className="bk-hours-title">
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
          <article className="bk-info-card">
            <h2>
              <Truck size={20} aria-hidden="true" /> Entrega
            </h2>
            <p className="bk-pre">{policies.shipping}</p>
          </article>
        )}
        {policies?.returns && (
          <article className="bk-info-card">
            <h2>Trocas e devoluções</h2>
            <p className="bk-pre">{policies.returns}</p>
          </article>
        )}
        {policies?.exchange && (
          <article className="bk-info-card">
            <h2>Trocas</h2>
            <p className="bk-pre">{policies.exchange}</p>
          </article>
        )}
      </section>
    </div>
  );
}
