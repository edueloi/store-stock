import { Link } from "react-router-dom";
import StoreSEO from "../../../../components/store/StoreSEO";
import { hoursLines, useKit, whatsappLink } from "./kit";
import { Ornament } from "./parts";
import "./styles.css";

export default function StoreAbout() {
  const { tenant, categories, active, path, sf } = useKit();
  const hours = hoursLines(tenant.business_hours);
  const wa = whatsappLink(tenant.whatsapp);
  const title = sf.about_title || "Sobre a livraria";
  const text = tenant.about_text || `${tenant.name} reúne leituras escolhidas com cuidado para quem gosta de histórias, descobertas e boa conversa.`;
  return (
    <main className="bk-root">
      <StoreSEO title={`${title} — ${tenant.name}`} description={text.slice(0, 160)} image={tenant.banner_url || tenant.logo_url} url={typeof window !== "undefined" ? window.location.href : ""} siteName={tenant.name} />
      <header className="bk-pagehead">
        <p className="bk-eyebrow">Colofão</p>
        <h1>{title}</h1>
        <Ornament className="bk-orn" />
      </header>

      <div className="bk-about">
        {tenant.banner_url && (
          <figure className="bk-plate">
            <img src={tenant.banner_url} alt="" loading="lazy" />
            <figcaption>{tenant.name}</figcaption>
          </figure>
        )}
        <div className="bk-columns bk-dropcap-p">
          {text.split(/\n{1,}/).filter(Boolean).map((para, i) => (
            <p key={i}>{para}</p>
          ))}
        </div>
      </div>

      <section className="bk-block bk-block-paper">
        <h2 className="bk-sheet-title">Ficha técnica</h2>
        <dl className="bk-sheet">
          <div>
            <dt>Títulos no catálogo</dt>
            <dd>{active.length}</dd>
          </div>
          <div>
            <dt>Seções</dt>
            <dd>{categories.length}</dd>
          </div>
          {tenant.show_address && tenant.address && (
            <div>
              <dt>Endereço</dt>
              <dd>{tenant.address}</dd>
            </div>
          )}
          {wa && (
            <div>
              <dt>Atendimento</dt>
              <dd>
                <a href={wa} target="_blank" rel="noreferrer">
                  WhatsApp {tenant.whatsapp}
                </a>
              </dd>
            </div>
          )}
          {hours.map((h) => (
            <div key={h.day}>
              <dt>{h.day}</dt>
              <dd>{h.text}</dd>
            </div>
          ))}
        </dl>
        <p className="bk-more">
          <Link to={path("/catalogo")}>Explorar a estante →</Link>
        </p>
      </section>
    </main>
  );
}
