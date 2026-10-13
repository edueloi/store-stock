import { Link } from "react-router-dom";
import StoreSEO from "../../../../components/store/StoreSEO";
import { hoursLines, useKit, whatsappLink } from "./kit";
import { Bean, Steam } from "./parts";
import "./styles.css";

export default function StoreAbout() {
  const { tenant, categories, active, path, sf } = useKit();
  const hours = hoursLines(tenant.business_hours);
  const wa = whatsappLink(tenant.whatsapp);
  const title = sf.about_title || "Nossa casa";
  const text = tenant.about_text || `${tenant.name} seleciona cafés, acompanhamentos e utensílios para transformar o seu ritual de pausa.`;
  return (
    <main className="cf-root">
      <StoreSEO title={`${title} — ${tenant.name}`} description={text.slice(0, 160)} image={tenant.banner_url || tenant.logo_url} url={typeof window !== "undefined" ? window.location.href : ""} siteName={tenant.name} />
      <section className="cf-about">
        <div className="cf-about-text">
          <p className="cf-eyebrow">Sobre</p>
          <h1>{title}</h1>
          <div className="cf-story">
            {text.split(/\n{1,}/).filter(Boolean).map((para, i) => (
              <p key={i}>{para}</p>
            ))}
          </div>
          <Link to={path("/catalogo")} className="cf-btn">
            Ver o cardápio
          </Link>
        </div>
        <div className="cf-hero-photo">
          <Steam className="cf-steam" />
          <div className="cf-arch">{tenant.banner_url ? <img src={tenant.banner_url} alt="" loading="lazy" /> : <Bean className="cf-arch-bean" />}</div>
        </div>
      </section>

      <section className="cf-block cf-block-alt">
        <div className="cf-about-grid">
          <div className="cf-slip">
            <h2>Em números</h2>
            <p className="cf-slipline">
              <span>Itens no cardápio</span>
              <i aria-hidden="true" />
              <b>{active.length}</b>
            </p>
            <p className="cf-slipline">
              <span>Seções</span>
              <i aria-hidden="true" />
              <b>{categories.length}</b>
            </p>
            {tenant.show_address && tenant.address && (
              <p className="cf-slipline">
                <span>Endereço</span>
                <i aria-hidden="true" />
                <b>{tenant.address}</b>
              </p>
            )}
            {wa && (
              <p className="cf-slipline">
                <span>WhatsApp</span>
                <i aria-hidden="true" />
                <a href={wa} target="_blank" rel="noreferrer">
                  {tenant.whatsapp}
                </a>
              </p>
            )}
          </div>
          {hours.length > 0 && (
            <div className="cf-slip">
              <h2>Horários</h2>
              {hours.map((h) => (
                <p key={h.day} className="cf-slipline">
                  <span>{h.day}</span>
                  <i aria-hidden="true" />
                  <b>{h.text}</b>
                </p>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
