import { Link } from "react-router-dom";
import { Clock, Leaf, MapPin, MessageCircle, Sprout } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import { StoreButton } from "../../../../components/store/StoreButton";
import { hoursLines, useKit } from "./kit";
import { whatsappLink } from "./extras";
import { LeafArt } from "./parts";

export default function StoreAbout() {
  const { tenant, categories, active, config, path } = useKit();
  const hours = hoursLines(tenant.business_hours);
  const wa = whatsappLink(tenant.whatsapp, `Olá! Vim pela loja ${tenant.name}.`);
  return (
    <div className="garden-page">
      <StoreSEO title={`${config.about_title || "Nossa história"} - ${tenant.name}`} description={tenant.about_text || `Conheça a ${tenant.name}.`} image={tenant.banner_url || tenant.logo_url} url={typeof window !== "undefined" ? window.location.href : ""} siteName={tenant.name} />
      <div className="garden-wrap">
        <section className="garden-about">
          <div className="garden-about-copy">
            <span className="garden-eyebrow"><Leaf size={14} aria-hidden="true" /> {config.segment_label || "Jardinagem"}</span>
            <h1>{config.about_title || `Quem é a ${tenant.name}`}</h1>
            <p>{tenant.about_text || `${tenant.name} nasceu do gosto por plantas e por quem cultiva. Aqui você encontra tudo para o seu jardim, com atendimento de quem entende.`}</p>
            <div className="garden-about-actions">
              <StoreButton asChild className="garden-cta"><Link to={path("/catalogo")}>Ver catálogo</Link></StoreButton>
              {wa && <StoreButton asChild variant="outline" className="garden-ghost"><a href={wa} target="_blank" rel="noreferrer"><MessageCircle size={18} aria-hidden="true" /> WhatsApp</a></StoreButton>}
            </div>
          </div>
          <div className="garden-about-art">
            <LeafArt className="garden-leaf-float garden-leaf-1" />
            <span className="garden-blob garden-blob-a">{tenant.banner_url ? <img src={tenant.banner_url} alt="" /> : <Sprout size={64} aria-hidden="true" />}</span>
          </div>
        </section>
        <div className="garden-about-cards">
          <section className="garden-box"><h2>A loja em números</h2><ul><li><span>Produtos</span><b>{active.length}</b></li><li><span>Categorias</span><b>{categories.length}</b></li></ul></section>
          {hours.length > 0 && <section className="garden-box"><h2><Clock size={18} aria-hidden="true" /> Horário</h2><ul>{hours.map((h) => <li key={h.label}><span>{h.label}</span><b>{h.text}</b></li>)}</ul></section>}
          {tenant.show_address && tenant.address && <section className="garden-box"><h2><MapPin size={18} aria-hidden="true" /> Onde estamos</h2><p>{tenant.address}</p></section>}
        </div>
      </div>
    </div>
  );
}
