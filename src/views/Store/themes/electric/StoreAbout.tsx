import { Link } from "react-router-dom";
import { ArrowRight, Clock, MapPin, MessageCircle } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import { useStore } from "../../StoreLayout";
import { hoursRows, useTheme, waLink } from "./lib";
import "./styles.css";

export default function StoreAbout() {
  const { tenant, products, categories } = useStore();
  const { path } = useTheme();
  const sf = tenant.policies?.storefront || {};
  const active = products.filter((p) => p.is_active && p.type !== "internal");
  const catCount = categories.filter((c) => active.some((p) => p.category_id === c.id)).length;
  const hours = hoursRows(tenant);
  const title = sf.about_title || `Conheça a ${tenant.name}`;
  const text = tenant.about_text || `${tenant.name} reúne materiais para instalação, obra e manutenção, com catálogo organizado e atendimento direto.`;

  return (
    <main className="ep-page">
      <StoreSEO
        title={`Sobre — ${tenant.name}`}
        description={text}
        image={tenant.banner_url || tenant.logo_url}
        url={typeof window !== "undefined" ? window.location.href : ""}
        siteName={tenant.name}
      />
      <section className="ep-about-hero">
        <div className="ep-hazard" aria-hidden="true" />
        <div className="ep-wrap ep-about-in">
          <div>
            <p className="ep-eyebrow">Sobre a loja</p>
            <h1>{title}</h1>
            <p className="ep-about-text">{text}</p>
            <div className="ep-about-cta">
              <Link to={path("/catalogo")} className="ep-btn ep-btn-lg">Ver catálogo <ArrowRight size={18} aria-hidden="true" /></Link>
              {tenant.whatsapp && (
                <a href={waLink(tenant, "Olá! Gostaria de falar com a loja.")} target="_blank" rel="noreferrer" className="ep-btn ep-btn-lg ep-btn-ghost">
                  <MessageCircle size={18} aria-hidden="true" /> WhatsApp
                </a>
              )}
            </div>
          </div>
          {tenant.banner_url && <img className="ep-about-img" src={tenant.banner_url} alt="" />}
        </div>
      </section>

      <section className="ep-wrap ep-about-grid">
        <div className="ep-card">
          <h2>Dados do catálogo</h2>
          <table className="ep-kv">
            <tbody>
              <tr><th scope="row">Materiais cadastrados</th><td>{active.length}</td></tr>
              <tr><th scope="row">Tipos de material</th><td>{catCount}</td></tr>
              <tr><th scope="row">Atendimento</th><td>{tenant.whatsapp ? "WhatsApp e loja online" : "Loja online"}</td></tr>
            </tbody>
          </table>
        </div>
        <div className="ep-card">
          <h2><Clock size={18} aria-hidden="true" /> Horário de atendimento</h2>
          {hours.length ? (
            <table className="ep-kv">
              <tbody>
                {hours.map((h) => (
                  <tr key={h.day} className={h.closed ? "is-closed" : ""}><th scope="row">{h.day}</th><td>{h.text}</td></tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="ep-desc">Consulte o horário de atendimento pelo WhatsApp.</p>
          )}
        </div>
        <div className="ep-card">
          <h2><MapPin size={18} aria-hidden="true" /> Onde estamos</h2>
          <p className="ep-desc">{tenant.show_address && tenant.address ? tenant.address : "Atendemos pela loja online. Fale com a gente para combinar retirada ou entrega."}</p>
        </div>
      </section>
    </main>
  );
}
