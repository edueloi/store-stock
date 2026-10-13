import { Link } from "react-router-dom";
import { ArrowUpRight, Clock, MapPin, MessageCircle } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import { useStore } from "../../StoreLayout";
import { PERKS } from "./parts";
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
  const text = tenant.about_text || `${tenant.name} reúne produtos selecionados com atendimento próximo, para você comprar com tranquilidade.`;

  return (
    <main className="nx-page">
      <StoreSEO
        title={`Sobre — ${tenant.name}`}
        description={text}
        image={tenant.banner_url || tenant.logo_url}
        url={typeof window !== "undefined" ? window.location.href : ""}
        siteName={tenant.name}
      />
      <section className="nx-hero nx-about-hero">
        <div className="nx-hero-glow" aria-hidden="true" />
        <div className="nx-wrap nx-about-in">
          <div className="nx-hero-copy">
            <p className="nx-kicker">Sobre a loja</p>
            <h1>{title}</h1>
            <p className="nx-hero-sub nx-about-text">{text}</p>
            <div className="nx-hero-cta">
              <Link to={path("/catalogo")} className="nx-btn nx-btn-gold nx-btn-lg">Ver catálogo <ArrowUpRight size={18} aria-hidden="true" /></Link>
              {tenant.whatsapp && (
                <a href={waLink(tenant, "Olá! Gostaria de falar com a loja.")} target="_blank" rel="noreferrer" className="nx-btn nx-btn-outline nx-btn-lg">
                  <MessageCircle size={18} aria-hidden="true" /> WhatsApp
                </a>
              )}
            </div>
          </div>
          {tenant.banner_url && <img className="nx-about-img" src={tenant.banner_url} alt="" />}
        </div>
      </section>

      <section className="nx-wrap nx-perks" aria-label="Diferenciais">
        {PERKS.map(({ icon: Icon, title: t, text: d }) => (
          <div key={t} className="nx-perk">
            <span className="nx-perk-ico"><Icon size={22} aria-hidden="true" /></span>
            <div><h3>{t}</h3><p>{d}</p></div>
          </div>
        ))}
      </section>

      <section className="nx-wrap nx-sec nx-about-grid">
        <div className="nx-info">
          <p className="nx-kicker nx-kicker-dark">A loja em números</p>
          <div className="nx-stats">
            <div><b>{active.length}</b><span>produtos no catálogo</span></div>
            <div><b>{catCount}</b><span>categorias</span></div>
          </div>
        </div>
        <div className="nx-info">
          <h2><Clock size={18} aria-hidden="true" /> Atendimento</h2>
          {hours.length ? (
            <table className="nx-hours">
              <tbody>
                {hours.map((h) => (
                  <tr key={h.day} className={h.closed ? "is-closed" : ""}><th scope="row">{h.day}</th><td>{h.text}</td></tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="nx-desc">Consulte nossos horários pelo WhatsApp.</p>
          )}
        </div>
        <div className="nx-info">
          <h2><MapPin size={18} aria-hidden="true" /> Onde estamos</h2>
          <p className="nx-desc">{tenant.show_address && tenant.address ? tenant.address : "Atendemos pela loja online. Fale conosco para combinar entrega ou retirada."}</p>
        </div>
      </section>
    </main>
  );
}
