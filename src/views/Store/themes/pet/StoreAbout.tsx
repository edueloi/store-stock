import { Link } from "react-router-dom";
import { ArrowRight, Clock, Heart, MapPin, MessageCircle, PawPrint } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import { useKit } from "./lib";
import "./styles.css";

const DAYS: Record<string, string> = { seg: "Segunda", ter: "Terça", qua: "Quarta", qui: "Quinta", sex: "Sexta", sab: "Sábado", dom: "Domingo" };

export default function StoreAbout() {
  const { tenant, active, path, sf, usedCategories } = useKit();
  const wa = tenant.whatsapp ? tenant.whatsapp.replace(/\D/g, "") : "";
  const hours = tenant.business_hours ? Object.entries(tenant.business_hours).filter(([, v]) => v) : [];
  const stats: [string | number, string, string][] = [
    [active.length, "produtos", "#ffdfe0"],
    [usedCategories.length, "categorias", "#d4e9ff"],
    [active.filter((p) => p.is_featured).length, "queridinhos", "#ffe9a8"],
  ];
  return (
    <main className="pet-root">
      <StoreSEO
        title={`${sf.about_title || "Nossa loja"} | ${tenant.name}`}
        description={tenant.about_text || `Conheça a ${tenant.name}.`}
        image={tenant.banner_url || tenant.logo_url}
        url={typeof window !== "undefined" ? window.location.href : ""}
        siteName={tenant.name}
      />
      <div className="pet-wrap">
        <section className="pet-about-hero">
          <div className="pet-about-grid">
            <div>
              <span className="pet-pill-tag"><Heart size={16} /> {sf.segment_label || "Quem somos"}</span>
              <h1 className="pet-h">{sf.about_title || "Nossa casinha"}</h1>
              <p className="pet-about-text">{tenant.about_text || `A ${tenant.name} nasceu do amor pelos animais. Aqui você encontra produtos escolhidos com carinho para o seu melhor amigo.`}</p>
              <div className="pet-hero-cta">
                <Link to={path("/catalogo")} className="pet-btn">Ver produtos <ArrowRight size={20} /></Link>
                {wa && <a href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer" className="pet-btn pet-btn--light"><MessageCircle size={20} /> WhatsApp</a>}
              </div>
            </div>
            <div className="pet-blob" style={{ background: "var(--pt-mint)" }}>
              {tenant.banner_url ? <img src={tenant.banner_url} alt="" /> : tenant.logo_url ? <img src={tenant.logo_url} alt="" className="contain" /> : <PawPrint size={120} className="pet-blob-empty" />}
            </div>
          </div>
        </section>

        <section className="pet-stats" aria-label="Números da loja">
          {stats.map(([n, l, bg]) => (
            <div className="pet-stat" key={l} style={{ ["--b" as string]: bg }}><b>{n}</b><span>{l}</span></div>
          ))}
        </section>

        <section className="pet-contact">
          <h3>Venha nos visitar</h3>
          {tenant.show_address && tenant.address && <p><MapPin size={20} />{tenant.address}</p>}
          {wa && <p><MessageCircle size={20} />+{wa}</p>}
          {hours.length > 0 && (
            <p>
              <Clock size={20} />
              <span>{hours.map(([d, h]) => <span key={d} style={{ display: "block" }}>{DAYS[d] || d}: {h.closed ? "fechado" : `${h.open} às ${h.close}`}</span>)}</span>
            </p>
          )}
          {!wa && !hours.length && !(tenant.show_address && tenant.address) && <p><PawPrint size={20} />Faça seu pedido pelo catálogo online.</p>}
        </section>
      </div>
    </main>
  );
}
