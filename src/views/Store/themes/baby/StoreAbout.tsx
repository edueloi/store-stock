import { Link } from "react-router-dom";
import { Clock, MapPin, MessageCircle } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import { hoursLines, useKit, whatsappLink } from "./kit";
import { Balloon, Bow, Cloud, Star } from "./parts";
import "./styles.css";

export default function StoreAbout() {
  const { tenant, categories, active, path, sf } = useKit();
  const hours = hoursLines(tenant.business_hours);
  const wa = whatsappLink(tenant.whatsapp);
  const title = sf.about_title || "Nossa história";
  const text = tenant.about_text || `${tenant.name} nasceu para acolher famílias nos primeiros e mais especiais momentos, com produtos escolhidos um a um.`;
  return (
    <main className="bb-root">
      <StoreSEO title={`${title} — ${tenant.name}`} description={text.slice(0, 160)} image={tenant.banner_url || tenant.logo_url} url={typeof window !== "undefined" ? window.location.href : ""} siteName={tenant.name} />
      <section className="bb-about-hero">
        <Balloon className="bb-deco bb-deco-balloon" color="var(--bb-accent)" />
        <Star className="bb-deco bb-deco-star1" />
        <Cloud className="bb-deco bb-deco-cloud1" />
        <div className="bb-letter bb-letter-wide">
          <Bow className="bb-letter-bow" />
          <p className="bb-kicker">Uma cartinha para você</p>
          <h1 className="bb-script">{title}</h1>
          <p className="bb-letter-text">{text}</p>
          <p className="bb-signature">Com carinho, {tenant.name}</p>
        </div>
        {tenant.banner_url && (
          <div className="bb-about-photo">
            <img src={tenant.banner_url} alt="" loading="lazy" />
          </div>
        )}
      </section>

      <section className="bb-section">
        <div className="bb-facts">
          <div className="bb-fact bb-t1">
            <strong>{active.length}</strong>
            <span>{active.length === 1 ? "mimo no catálogo" : "mimos no catálogo"}</span>
          </div>
          <div className="bb-fact bb-t2">
            <strong>{categories.length}</strong>
            <span>{categories.length === 1 ? "fase ou ocasião" : "fases e ocasiões"}</span>
          </div>
          <div className="bb-fact bb-t3">
            <strong>{wa ? "Zap" : "Online"}</strong>
            <span>{wa ? "atendimento direto" : "loja sempre aberta"}</span>
          </div>
        </div>
      </section>

      <section className="bb-section bb-section-tint">
        <div className="bb-visit">
          {tenant.show_address && tenant.address && (
            <div className="bb-foot-card bb-t4">
              <h2>
                <MapPin size={20} /> Onde estamos
              </h2>
              <p>{tenant.address}</p>
            </div>
          )}
          {hours.length > 0 && (
            <div className="bb-foot-card bb-t2">
              <h2>
                <Clock size={20} /> Horários
              </h2>
              <dl className="bb-hours">
                {hours.map((h) => (
                  <div key={h.day}>
                    <dt>{h.day}</dt>
                    <dd>{h.text}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
          <div className="bb-foot-card bb-t3">
            <h2>
              <MessageCircle size={20} /> Fale com a gente
            </h2>
            <p>Dúvidas sobre tamanhos, presentes ou prazos? Conversamos com você.</p>
            {wa ? (
              <a className="bb-btn bb-btn-main" href={wa} target="_blank" rel="noreferrer">
                Chamar no WhatsApp
              </a>
            ) : (
              <Link className="bb-btn bb-btn-main" to={path("/catalogo")}>
                Ver o catálogo
              </Link>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
