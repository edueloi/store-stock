import { Link } from "react-router-dom";
import { ArrowRight, Clock, MapPin, MessageCircle } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import { useKit } from "./lib";
import "./styles.css";

const DAYS: Record<string, string> = { seg: "Segunda", ter: "Terça", qua: "Quarta", qui: "Quinta", sex: "Sexta", sab: "Sábado", dom: "Domingo" };

export default function StoreAbout() {
  const { tenant, active, categories, path, sf, countIn } = useKit();
  const wa = tenant.whatsapp ? tenant.whatsapp.replace(/\D/g, "") : "";
  const hours = tenant.business_hours ? Object.entries(tenant.business_hours).filter(([, v]) => v) : [];
  const cats = categories.filter((c) => countIn(c.id) > 0).length;
  return (
    <main className="ft-root">
      <StoreSEO
        title={`${sf.about_title || "Sobre"} | ${tenant.name}`}
        description={tenant.about_text || `Conheça a ${tenant.name}.`}
        image={tenant.banner_url || tenant.logo_url}
        url={typeof window !== "undefined" ? window.location.href : ""}
        siteName={tenant.name}
      />
      <div className="ft-wrap">
        <section className="ft-about-hero">
          <span className="ft-tag"><i /> {sf.segment_label || "Fitness"} · sobre</span>
          <h1 className="ft-h1">{sf.about_title || "Sobre a loja"}</h1>
        </section>
        <section className="ft-goals" aria-label="Números da loja" style={{ margin: "8px 0 28px" }}>
          <div className="ft-goal"><b>{active.length}</b><span>produtos</span></div>
          <div className="ft-goal"><b>{cats}</b><span>categorias</span></div>
          <div className="ft-goal"><b>{wa ? "Zap" : "On"}<i>.</i></b><span>{wa ? "atendimento direto" : "loja online"}</span></div>
          <div className="ft-goal"><b>24h</b><span>catálogo aberto</span></div>
        </section>
        <div className="ft-about-grid">
          <div className="ft-panel">
            {tenant.banner_url && <img className="ft-about-img" src={tenant.banner_url} alt="" />}
            <p className="ft-about-text">{tenant.about_text || `${tenant.name} reúne produtos de treino, suplementação e acessórios para quem leva a evolução a sério.`}</p>
            <div style={{ marginTop: 24, display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Link to={path("/catalogo")} className="ft-btn">Ver catálogo <ArrowRight size={16} /></Link>
              {wa && <a href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer" className="ft-btn ft-btn--line"><MessageCircle size={16} /> WhatsApp</a>}
            </div>
          </div>
          <aside className="ft-panel ft-contact">
            <h3>Contato e horários</h3>
            {tenant.show_address && tenant.address && <p><MapPin size={18} />{tenant.address}</p>}
            {wa && <p><MessageCircle size={18} />+{wa}</p>}
            {hours.length > 0 && (
              <p>
                <Clock size={18} />
                <span>
                  {hours.map(([d, h]) => <span key={d} style={{ display: "block" }}>{DAYS[d] || d}: {h.closed ? "fechado" : `${h.open} às ${h.close}`}</span>)}
                </span>
              </p>
            )}
            {!wa && !hours.length && !(tenant.show_address && tenant.address) && <p>Faça seu pedido pelo catálogo online.</p>}
          </aside>
        </div>
      </div>
    </main>
  );
}
