import { Link } from "react-router-dom";
import { Clock, Instagram, MapPin, MessageCircle } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import { formatPhone, hoursRows, useKit } from "./kit";
import "./styles.css";

export default function StoreAbout() {
  const { tenant, path, sf, waLink } = useKit();
  const hours = hoursRows(tenant);
  const title = sf.about_title || "Sobre";
  const text = tenant.about_text || `${tenant.name} reúne uma seleção de produtos pensada para ser simples de escolher e de comprar.`;
  const paras = text.split(/\n+/).map((t) => t.trim()).filter(Boolean);
  const [lead, ...rest] = paras;
  const hasContact = tenant.whatsapp || tenant.instagram_url || (tenant.show_address && tenant.address) || hours.length > 0;
  return (
    <main className="mn-page">
      <StoreSEO title={`Sobre — ${tenant.name}`} description={text} image={tenant.banner_url || tenant.logo_url} url={typeof window !== "undefined" ? window.location.href : ""} siteName={tenant.name} />
      <section className="mn-wrap mn-about">
        <header className="mn-about-head">
          <span className="mn-kicker">{tenant.name}</span>
          <h1>{title}</h1>
          {lead && <p className="mn-about-lead">{lead}</p>}
        </header>
        {tenant.banner_url && <img className="mn-about-img" src={tenant.banner_url} alt="" />}
        <div className={`mn-about-body${hasContact ? "" : " mn-about-single"}`}>
          <div className="mn-about-text">
            {rest.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
          {hasContact ? (
            <aside className="mn-about-card" aria-label="Contato">
              <h2>Fale com a gente</h2>
              <ul>
                {tenant.whatsapp && (
                  <li><MessageCircle size={18} strokeWidth={1.5} /><a href={waLink()} target="_blank" rel="noreferrer">{formatPhone(tenant.whatsapp)}</a></li>
                )}
                {tenant.instagram_url && (
                  <li><Instagram size={18} strokeWidth={1.5} /><a href={tenant.instagram_url} target="_blank" rel="noreferrer">Instagram</a></li>
                )}
                {tenant.show_address && tenant.address && (
                  <li><MapPin size={18} strokeWidth={1.5} /><span>{tenant.address}</span></li>
                )}
                {hours.length > 0 && (
                  <li><Clock size={18} strokeWidth={1.5} /><span>{hours.map((h) => <span key={h.day} className="mn-hour-line">{h.day} · {h.text}</span>)}</span></li>
                )}
              </ul>
              <Link className="mn-btn" to={path("/catalogo")}>Ver catálogo →</Link>
            </aside>
          ) : (
            <Link className="mn-btn" to={path("/catalogo")}>Ver catálogo →</Link>
          )}
        </div>
      </section>
    </main>
  );
}
