import { Link } from "react-router-dom";
import { ArrowRight, Heart, Image as ImageIcon, MapPin, MessageCircle, Sparkles } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import { StoreButton } from "../../../../components/store/StoreButton";
import { hoursLines, useShop, whatsappHref } from "./kit";
import "./styles.css";

export default function StoreAbout() {
  const { tenant, active, categories, config, path } = useShop();
  const title = config.about_title || "Nossa história";
  const hours = hoursLines(tenant);
  const text = tenant.about_text || `${tenant.name} reúne peças escolhidas com carinho, com atendimento próximo e cuidado em cada detalhe.`;
  return (
    <div className="au-scope au-page">
      <StoreSEO title={`${title} | ${tenant.name}`} description={text} image={tenant.banner_url || tenant.logo_url} siteName={tenant.name} url={typeof window !== "undefined" ? window.location.href : ""} />
      <div className="au-wrap">
        <section className="au-about-hero">
          <div className="au-about-copy">
            <span className="au-eyebrow"><Sparkles size={14} /> {config.segment_label || "Sobre a loja"}</span>
            <h1>{title}</h1>
            <p>{text}</p>
            <div className="au-hero-cta">
              <StoreButton asChild size="lg" className="au-cta"><Link to={path("/catalogo")}>Ver a coleção <ArrowRight size={18} /></Link></StoreButton>
              {tenant.whatsapp && <StoreButton asChild variant="outline" size="lg" className="au-cta-line"><a href={whatsappHref(tenant)} target="_blank" rel="noreferrer"><MessageCircle size={18} /> Conversar</a></StoreButton>}
            </div>
          </div>
          <div className="au-about-art"><div className="au-arch">{tenant.banner_url ? <img src={tenant.banner_url} alt="" /> : <ImageIcon size={64} className="ph" />}</div></div>
        </section>

        <div className="au-values">
          <div className="p0"><b>{active.length}</b><span>peças na vitrine</span></div>
          <div className="p1"><b>{categories.length}</b><span>categorias</span></div>
          <div className="p2"><Heart size={26} aria-hidden="true" /><span>Feito com carinho</span></div>
        </div>

        <div className="au-info">
          <section className="au-info-card">
            <h2>Horários</h2>
            {hours.length ? <table className="au-hours"><tbody>{hours.map((h) => <tr key={h.day}><td>{h.day}</td><td>{h.text}</td></tr>)}</tbody></table> : <p>Fale com a loja para confirmar o atendimento.</p>}
          </section>
          {tenant.show_address && tenant.address && (
            <section className="au-info-card">
              <h2>Endereço</h2>
              <p className="au-addr"><MapPin size={18} aria-hidden="true" />{tenant.address}</p>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
