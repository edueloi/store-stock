import { Link } from "react-router-dom";
import { ArrowRight, MapPin, MessageCircle } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import { productImage, useKit, whatsappLink } from "../street/kit";
import { TrustRow } from "../street/shared";
import "./styles.css";

export default function StoreAbout() {
  const { tenant, active, path, sf } = useKit();
  const about = tenant.about_text || "Camisetas, tênis e roupas para viver o seu próprio ritmo. Acreditamos no conforto, na expressão pessoal e no movimento de todos os dias.";
  const wa = whatsappLink(tenant.whatsapp, `Olá! Vim pela loja ${tenant.name}.`);
  const img = tenant.banner_url || productImage(active.find((p) => p.is_featured) || active[0]);
  return (
    <div className="sr-page sr-about">
      <StoreSEO title={`${sf.about_title || "Sobre"} | ${tenant.name}`} description={about} image={img || tenant.logo_url} url={typeof window !== "undefined" ? window.location.href : ""} siteName={tenant.name} />
      <div className="sr-about-grid">
        <div className="sr-about-img">{img && <img src={img} alt="" />}</div>
        <article className="sr-about-copy">
          <span className="sr-eyebrow">Sobre</span>
          <h1>{sf.about_title || tenant.name}</h1>
          <p>{about}</p>
          <div className="sr-about-links">
            <Link className="sr-btn sr-btn-solid sr-btn-lg" to={path("/catalogo")}>
              Ver a coleção <ArrowRight size={17} />
            </Link>
            {wa && (
              <a className="sr-btn sr-btn-line sr-btn-lg" href={wa} target="_blank" rel="noreferrer">
                <MessageCircle size={17} /> {tenant.whatsapp}
              </a>
            )}
          </div>
          {tenant.show_address && tenant.address && (
            <p className="sr-about-addr">
              <MapPin size={17} /> {tenant.address}
            </p>
          )}
        </article>
      </div>
      <section className="sr-section">
        <TrustRow t="sr" />
      </section>
    </div>
  );
}
