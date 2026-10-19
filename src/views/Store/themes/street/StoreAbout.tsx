import { Link } from "react-router-dom";
import { ArrowRight, MapPin, MessageCircle } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import { useKit, whatsappLink } from "./kit";
import { TrustRow } from "./shared";
import "./styles.css";

export default function StoreAbout() {
  const { tenant, active, categories, path, sf } = useKit();
  const about = tenant.about_text || "Moda urbana, expressão e peças para acompanhar o seu corre. Esta loja nasce da rua e conversa com quem vive a cidade.";
  const wa = whatsappLink(tenant.whatsapp, `Olá! Vim pela loja ${tenant.name}.`);
  const cats = categories.filter((c) => active.some((p) => p.category_id === c.id)).length;
  return (
    <div className="sd-page sd-about">
      <StoreSEO title={`${sf.about_title || "Manifesto"} | ${tenant.name}`} description={about} image={tenant.banner_url || tenant.logo_url} url={typeof window !== "undefined" ? window.location.href : ""} siteName={tenant.name} />
      <header className="sd-cat-hero">
        <div>
          <span className="sd-tag">Sobre a marca</span>
          <h1>{sf.about_title || `Somos ${tenant.name}`}</h1>
          <p>{tenant.hero_tagline || "Feito para sair do padrão."}</p>
        </div>
      </header>
      <div className="sd-about-grid">
        <article className="sd-about-text">
          <span className="sd-kicker">Manifesto</span>
          <p>{about}</p>
          <Link className="sd-btn sd-btn-solid sd-btn-lg" to={path("/catalogo")}>
            Ver o drop <ArrowRight size={17} />
          </Link>
        </article>
        <aside className="sd-about-side">
          <div className="sd-stat sd-tint-0">
            <strong>{active.length}</strong>
            <span>peças no catálogo</span>
          </div>
          <div className="sd-stat sd-tint-1">
            <strong>{cats}</strong>
            <span>categorias</span>
          </div>
          <div className="sd-stat sd-stat-wide">
            {wa && (
              <a href={wa} target="_blank" rel="noreferrer">
                <MessageCircle size={18} /> {tenant.whatsapp}
              </a>
            )}
            {tenant.show_address && tenant.address && (
              <p>
                <MapPin size={18} /> {tenant.address}
              </p>
            )}
          </div>
        </aside>
      </div>
      <div className="sd-section">
        <TrustRow t="sd" />
      </div>
    </div>
  );
}
