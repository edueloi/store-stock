import { Link } from "react-router-dom";
import { ArrowRight, MapPin, MessageCircle } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import { hoursLines, useShop, whatsappHref } from "./kit";
import "./styles.css";

export default function StoreAbout() {
  const { tenant, categories, active, config, path } = useShop();
  const title = config.about_title || "Sobre a loja";
  const hours = hoursLines(tenant);
  const text = tenant.about_text || `${tenant.name} reúne produtos, acessórios e novidades para você montar o seu espaço com atendimento direto.`;
  return (
    <div className="cy-scope cy-page">
      <StoreSEO title={`${title} | ${tenant.name}`} description={text} image={tenant.banner_url || tenant.logo_url} siteName={tenant.name} url={typeof window !== "undefined" ? window.location.href : ""} />
      <div className="cy-wrap" style={{ paddingTop: 34 }}>
        <span className="cy-tag">perfil</span>
        <h1 style={{ fontSize: "clamp(28px,5vw,48px)", color: "#fff", marginTop: 6 }}>{title}</h1>
        <div className="cy-about-grid">
          <div className="cy-term">
            <div className="cy-term-head"><span /><span /><span /><em>cat sobre.txt</em></div>
            <div className="cy-term-body">
              {tenant.banner_url && <img src={tenant.banner_url} alt="" style={{ width: "100%", maxHeight: 260, objectFit: "cover", marginBottom: 18, border: "1px solid var(--cy-line)" }} />}
              <p className="cy-cat-out">{text}</p>
              <div className="cy-stat-row">
                <div className="cy-stat"><b>{active.length}</b><span>produtos</span></div>
                <div className="cy-stat"><b>{categories.length}</b><span>módulos</span></div>
                <div className="cy-stat"><b>{tenant.whatsapp ? "ON" : "WEB"}</b><span>{tenant.whatsapp ? "whatsapp" : "loja online"}</span></div>
              </div>
              <div className="cy-actions" style={{ marginTop: 22 }}>
                <Link className="cy-btn is-solid" to={path("/catalogo")}>Ver catálogo <ArrowRight size={16} /></Link>
                {tenant.whatsapp && <a className="cy-btn is-hot" href={whatsappHref(tenant)} target="_blank" rel="noreferrer"><MessageCircle size={16} /> WhatsApp</a>}
              </div>
            </div>
          </div>
          <aside style={{ display: "grid", gap: 16, alignContent: "start" }}>
            <div className="cy-term">
              <div className="cy-term-head"><span /><span /><span /><em>horarios</em></div>
              <div className="cy-term-body" style={{ padding: 16 }}>
                {hours.length ? <table className="cy-hours"><tbody>{hours.map((h) => <tr key={h.day}><td>{h.day}</td><td>{h.text}</td></tr>)}</tbody></table> : <p style={{ margin: 0, color: "var(--cy-dim)" }}>Fale com a loja para confirmar o atendimento.</p>}
              </div>
            </div>
            {tenant.show_address && tenant.address && (
              <div className="cy-term">
                <div className="cy-term-head"><span /><span /><span /><em>localizacao</em></div>
                <div className="cy-term-body" style={{ padding: 16, display: "flex", gap: 10 }}><MapPin size={18} style={{ color: "var(--cy-m)", flex: "none" }} aria-hidden="true" /><span>{tenant.address}</span></div>
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
