import { Link } from "react-router-dom";
import { ArrowRight, MapPin, MessageCircle, Shirt } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import { productImage, useKit, whatsappLink } from "../street/kit";
import { TrustRow } from "../street/shared";
import "./styles.css";

export default function StoreAbout() {
  const { tenant, active, path, sf } = useKit();
  const about = tenant.about_text || "Moda urbana com olhar de cidade: peças versáteis, edições limitadas e looks para o dia a dia.";
  const wa = whatsappLink(tenant.whatsapp, `Olá! Vim pela loja ${tenant.name}.`);
  const shots = active.slice(0, 4);
  return (
    <div className="ur-page ur-about">
      <StoreSEO title={`${sf.about_title || "Sobre"} | ${tenant.name}`} description={about} image={tenant.banner_url || tenant.logo_url} url={typeof window !== "undefined" ? window.location.href : ""} siteName={tenant.name} />
      <div className="ur-about-grid">
        <article className="ur-about-copy">
          <span className="ur-mono">Sobre / {tenant.name}</span>
          <h1>{sf.about_title || "A cidade é a nossa vitrine"}</h1>
          <p>{about}</p>
          <div className="ur-about-actions">
            <Link className="ur-btn ur-btn-solid ur-btn-lg" to={path("/catalogo")}>
              Ver o catálogo <ArrowRight size={17} />
            </Link>
            {wa && (
              <a className="ur-btn ur-btn-line ur-btn-lg" href={wa} target="_blank" rel="noreferrer">
                <MessageCircle size={17} /> {tenant.whatsapp}
              </a>
            )}
          </div>
          {tenant.show_address && tenant.address && (
            <p className="ur-about-addr">
              <MapPin size={17} /> {tenant.address}
            </p>
          )}
        </article>
        <div className="ur-about-mosaic">
          {shots.map((p, i) => (
            <div key={p.id} className={`ur-shot ur-tone-${i % 4}`}>
              {productImage(p) ? <img src={productImage(p)} alt="" loading="lazy" /> : <Shirt size={40} />}
            </div>
          ))}
        </div>
      </div>
      <div className="ur-section">
        <TrustRow t="ur" />
      </div>
    </div>
  );
}
