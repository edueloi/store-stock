import { Link } from "react-router-dom";
import { ArrowRight, MapPin, MessageCircle, Store } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import { StoreButton } from "../../../../components/store/StoreButton";
import { varietyImage, useVariety } from "./ThemeParts";
import "./styles.css";

export default function StoreAbout() {
  const { tenant, active, usedCategories, path, whatsapp } = useVariety();
  const images = active.map(varietyImage).filter(Boolean).slice(0, 4) as string[];
  const about = tenant.about_text || "Uma loja completa para encontrar utilidades, presentes e produtos para o dia a dia com praticidade.";

  return (
    <main className="variety-page">
      <StoreSEO
        title={`A loja | ${tenant.name}`}
        description={about}
        image={tenant.banner_url || tenant.logo_url}
        url={typeof window !== "undefined" ? window.location.href : ""}
        siteName={tenant.name}
      />
      <div className="variety-wrap variety-block">
        <section className="variety-about-hero">
          <div>
            <span className="variety-kicker">A nossa loja</span>
            <h1>Variedade que resolve sua rotina.</h1>
            <p>{about}</p>
            <div className="variety-hero-actions">
              <StoreButton asChild className="variety-btn-yellow">
                <Link to={path("/catalogo")}>Ver catálogo <ArrowRight size={15} /></Link>
              </StoreButton>
              {whatsapp && (
                <StoreButton asChild variant="ghost" className="variety-btn-ghost">
                  <a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noreferrer"><MessageCircle size={15} /> WhatsApp</a>
                </StoreButton>
              )}
            </div>
          </div>
          <div className="variety-about-pics">
            {images.length ? (
              images.map((src) => (
                <span key={src}><img src={src} alt="" loading="lazy" /></span>
              ))
            ) : (
              <span className="variety-about-empty"><Store size={40} aria-hidden="true" /></span>
            )}
          </div>
        </section>

        <section className="variety-stats">
          <div className="variety-stat"><strong>{active.length}</strong><span>Produtos</span></div>
          <div className="variety-stat"><strong>{usedCategories.length}</strong><span>Seções</span></div>
          <div className="variety-stat variety-stat-wide">
            {tenant.address ? (
              <><MapPin size={20} aria-hidden="true" /><p>{tenant.address}</p></>
            ) : (
              <><MessageCircle size={20} aria-hidden="true" /><p>Pedidos online e atendimento da loja</p></>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
