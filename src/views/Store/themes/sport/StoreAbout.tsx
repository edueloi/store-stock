import { Link } from "react-router-dom";
import { ArrowUpRight, Clock, MapPin, MessageCircle } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import { useKit } from "./lib";
import "./styles.css";

const DAYS: Record<string, string> = { seg: "Segunda", ter: "Terça", qua: "Quarta", qui: "Quinta", sex: "Sexta", sab: "Sábado", dom: "Domingo" };

export default function StoreAbout() {
  const { tenant, active, categories, path, sf, countIn } = useKit();
  const wa = tenant.whatsapp ? tenant.whatsapp.replace(/\D/g, "") : "";
  const hours = tenant.business_hours ? Object.entries(tenant.business_hours).filter(([, v]) => v) : [];
  const usedCats = categories.filter((c) => countIn(c.id) > 0).length;
  const values = [
    ["01", "Produtos selecionados"],
    ["02", "Atendimento de quem vive o esporte"],
    ["03", "Pedido simples e acompanhado"],
  ];
  return (
    <main className="sp-root">
      <StoreSEO
        title={`${sf.about_title || "Nossa loja"} | ${tenant.name}`}
        description={tenant.about_text || `Conheça a ${tenant.name}.`}
        image={tenant.banner_url || tenant.logo_url}
        url={typeof window !== "undefined" ? window.location.href : ""}
        siteName={tenant.name}
      />
      <section className="sp-about-hero">
        {tenant.banner_url && <img src={tenant.banner_url} alt="" />}
        <div className="sp-wrap" style={{ position: "relative" }}>
          <span className="sp-kicker">{sf.segment_label || "Quem somos"}</span>
          <h1 className="sp-h">{sf.about_title || "Nossa loja"}</h1>
        </div>
      </section>

      <div className="sp-wrap">
        <div className="sp-about-grid">
          <div>
            <p className="sp-about-text">{tenant.about_text || `${tenant.name} reúne equipamentos e acessórios para quem leva o esporte a sério, do treino de todo dia ao grande jogo.`}</p>
            <div style={{ marginTop: 28, display: "flex", gap: 12, flexWrap: "wrap" }}>
              <Link to={path("/catalogo")} className="sp-btn">Ver catálogo <ArrowUpRight size={20} /></Link>
              {wa && <a href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer" className="sp-btn sp-btn--dark"><MessageCircle size={20} /> WhatsApp</a>}
            </div>
            <div className="sp-values" style={{ marginTop: 40 }}>
              {values.map(([n, t]) => (
                <div className="sp-value" key={n}><b>{n}</b><span>{t}</span></div>
              ))}
            </div>
          </div>
          <aside>
            <div className="sp-band" style={{ marginBottom: 16 }}>
              <div className="sp-band-inner" style={{ gridTemplateColumns: "1fr 1fr", padding: 28, gap: 16 }}>
                <div className="sp-stat"><b>{active.length}</b><span>produtos</span></div>
                <div className="sp-stat"><b>{usedCats}</b><span>categorias</span></div>
              </div>
            </div>
            <div className="sp-contact">
              <h3 className="sp-h">Fale com a gente</h3>
              {tenant.show_address && tenant.address && <p><MapPin size={18} />{tenant.address}</p>}
              {wa && <p><MessageCircle size={18} />+{wa}</p>}
              {hours.length > 0 && (
                <p>
                  <Clock size={18} />
                  <span>
                    {hours.map(([d, h]) => (
                      <span key={d} style={{ display: "block" }}>{DAYS[d] || d}: {h.closed ? "fechado" : `${h.open} às ${h.close}`}</span>
                    ))}
                  </span>
                </p>
              )}
              {!wa && !hours.length && !(tenant.show_address && tenant.address) && <p>Use a busca e o catálogo para fazer seu pedido online.</p>}
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
