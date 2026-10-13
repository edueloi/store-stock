import { Link } from "react-router-dom";
import { ArrowRight, MapPin, MessageCircle } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import { hoursLines, useShop, whatsappHref } from "./kit";
import "./styles.css";

export default function StoreAbout() {
  const { tenant, categories, active, config, path } = useShop();
  const title = config.about_title || "Sobre a loja";
  const hours = hoursLines(tenant);
  const text = tenant.about_text || `${tenant.name} reúne eletrônicos e acessórios para conectar trabalho, casa e diversão, com atendimento direto para tirar dúvidas antes da compra.`;
  return (
    <div className="tp-scope tp-page">
      <StoreSEO title={`${title} | ${tenant.name}`} description={text} image={tenant.banner_url || tenant.logo_url} siteName={tenant.name} url={typeof window !== "undefined" ? window.location.href : ""} />
      <div className="tp-wrap">
        <header className="tp-about-top"><span className="tp-kicker">{config.segment_label || "Eletrônicos & Conectividade"}</span><h1>{title}</h1></header>
        <div className="tp-bento tp-about-bento">
          <section className="tp-tile wide" style={{ padding: 28 }}>
            <p className="tp-about-text">{text}</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 22 }}>
              <Link className="tp-btn" to={path("/catalogo")}>Ver catálogo <ArrowRight size={16} /></Link>
              {tenant.whatsapp && <a className="tp-btn is-ghost" href={whatsappHref(tenant)} target="_blank" rel="noreferrer"><MessageCircle size={16} /> Falar com a loja</a>}
            </div>
          </section>
          <section className="tp-tile photo" style={{ gridColumn: "span 1", minHeight: 240 }} aria-label="Imagem da loja">
            {tenant.banner_url && <img src={tenant.banner_url} alt="" />}
            <span className="cap">{tenant.name}</span>
          </section>
          <div className="tp-tile tp-stat"><b>{active.length}</b><span>produtos</span></div>
          <div className="tp-tile tp-stat"><b>{categories.length}</b><span>categorias</span></div>
          <section className="tp-tile">
            <span className="tp-kicker">Horários</span>
            {hours.length ? <table className="tp-hours" style={{ marginTop: 10 }}><tbody>{hours.map((h) => <tr key={h.day}><td>{h.day}</td><td>{h.text}</td></tr>)}</tbody></table> : <p style={{ color: "var(--tp-dim)" }}>Fale com a loja para confirmar o atendimento.</p>}
          </section>
          {tenant.show_address && tenant.address && (
            <section className="tp-tile">
              <span className="tp-kicker">Endereço</span>
              <p style={{ display: "flex", gap: 8, marginTop: 10 }}><MapPin size={18} style={{ color: "var(--tp-cy)", flex: "none" }} aria-hidden="true" />{tenant.address}</p>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
