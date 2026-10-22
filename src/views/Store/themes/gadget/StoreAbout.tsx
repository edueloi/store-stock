import { Link } from "react-router-dom";
import { Clock, Instagram, MapPin, MessageCircle } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import { formatPhone, hoursRows, useKit } from "./kit";
import "./styles.css";

export default function StoreAbout() {
  const { tenant, path, sf, waLink } = useKit();
  const hours = hoursRows(tenant);
  const title = sf.about_title || "Sobre";
  const text = tenant.about_text || `${tenant.name} reúne tecnologia selecionada com atendimento próximo e compra simples.`;
  const paras = text.split(/\n+/).map((t) => t.trim()).filter(Boolean);
  const [lead, ...rest] = paras;
  const hasContact = tenant.whatsapp || tenant.instagram_url || (tenant.show_address && tenant.address) || hours.length > 0;
  return (
    <main className="gd-page">
      <StoreSEO title={`Sobre — ${tenant.name}`} description={text} image={tenant.banner_url || tenant.logo_url} url={typeof window !== "undefined" ? window.location.href : ""} siteName={tenant.name} />
      <section className="gd-wrap gd-about">
        <header className="gd-about-head">
          <span className="gd-kicker">{tenant.name}</span>
          <h1>{title}</h1>
          {lead && <p className="gd-about-lead">{lead}</p>}
        </header>
        {tenant.banner_url && <img className="gd-about-img" src={tenant.banner_url} alt="" />}
        <div className={`gd-about-body${hasContact ? "" : " gd-about-single"}`}>
          <div className="gd-about-text">
            {rest.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
          {hasContact ? (
            <aside className="gd-about-card" aria-label="Contato">
              <h2>Fale com a gente</h2>
              <ul>
                {tenant.whatsapp && <li><MessageCircle size={16} strokeWidth={1.6} /><a href={waLink()} target="_blank" rel="noreferrer">{formatPhone(tenant.whatsapp)}</a></li>}
                {tenant.instagram_url && <li><Instagram size={16} strokeWidth={1.6} /><a href={tenant.instagram_url} target="_blank" rel="noreferrer">Instagram</a></li>}
                {tenant.show_address && tenant.address && <li><MapPin size={16} strokeWidth={1.6} /><span>{tenant.address}</span></li>}
                {hours.length > 0 && <li><Clock size={16} strokeWidth={1.6} /><span>{hours.map((h) => <span key={h.day} className="gd-hour-line">{h.day} · {h.text}</span>)}</span></li>}
              </ul>
              <Link className="gd-btn gd-btn-accent gd-btn-full" to={path("/catalogo")}>Ver catálogo</Link>
            </aside>
          ) : (
            <Link className="gd-btn gd-btn-accent" to={path("/catalogo")}>Ver catálogo</Link>
          )}
        </div>
      </section>
    </main>
  );
}
