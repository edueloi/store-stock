import { Link } from "react-router-dom";
import { ArrowRight, MapPin, MessageCircle } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import { productImage, useKit, whatsappLink } from "../street/kit";
import { TrustRow } from "../street/shared";
import "./styles.css";

export default function StoreAbout() {
  const { tenant, active, path, sf } = useKit();
  const about = tenant.about_text || "Streetwear e skate com curadoria. Peças escolhidas a dedo para quem vive a rua.";
  const wa = whatsappLink(tenant.whatsapp, `Olá! Vim pela loja ${tenant.name}.`);
  const img = tenant.banner_url || productImage(active.find((p) => p.is_featured) || active[0]);
  return (
    <div className="sw-page sw-about">
      <StoreSEO title={`${sf.about_title || "Sobre"} | ${tenant.name}`} description={about} image={img || tenant.logo_url} url={typeof window !== "undefined" ? window.location.href : ""} siteName={tenant.name} />
      <div className="sw-about-grid">
        <div className="sw-about-img">{img && <img src={img} alt="" />}</div>
        <article className="sw-about-copy">
          <span className="sw-eyebrow">Sobre</span>
          <h1>{sf.about_title || tenant.name}</h1>
          <p>{about}</p>
          <div className="sw-about-links">
            <Link className="sw-btn sw-btn-solid sw-btn-lg" to={path("/catalogo")}>
              Ver a coleção <ArrowRight size={17} />
            </Link>
            {wa && (
              <a className="sw-btn sw-btn-line sw-btn-lg" href={wa} target="_blank" rel="noreferrer">
                <MessageCircle size={17} /> {tenant.whatsapp}
              </a>
            )}
          </div>
          {tenant.show_address && tenant.address && (
            <p className="sw-about-addr">
              <MapPin size={17} /> {tenant.address}
            </p>
          )}
        </article>
      </div>
      <section className="sw-section">
        <TrustRow t="sw" />
      </section>
    </div>
  );
}
