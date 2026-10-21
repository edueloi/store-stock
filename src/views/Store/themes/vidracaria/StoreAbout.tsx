import { Link, useParams } from "react-router-dom";
import { ArrowRight, MapPin, MessageCircle } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import { useStore } from "../../StoreLayout";
import { buildStorePath, resolveStoreSlug } from "../../store-routing";
export default function StoreAbout() {
  const { tenant } = useStore(), { slug: routeSlug } = useParams();
  const path = (suffix = "") => buildStorePath(resolveStoreSlug(routeSlug), suffix);
  const sf = tenant.policies?.storefront || {}, image = sf.glass_gallery?.find(s => s.image)?.image || tenant.banner_url;
  return <main className="vitra-root vitra-about-page"><StoreSEO title={`Sobre a loja | ${tenant.name}`} description={tenant.about_text || `Conheça ${tenant.name}.`} siteName={tenant.name}/><section className="vitra-container vitra-section"><span className="vitra-eyebrow">{tenant.name}</span><h1>{sf.about_title || "Conheça a nossa loja."}</h1><div className="vitra-about-content"><div>{tenant.about_text && <p>{tenant.about_text}</p>}{tenant.show_address && tenant.address && <p><MapPin size={18}/>{tenant.address}</p>}<div className="vitra-hero-actions"><Link className="vitra-btn-primary" to={path("/catalogo")}>Conhecer o catálogo <ArrowRight size={16}/></Link>{sf.glass_quote_enabled === true && <Link className="vitra-btn-secondary" to={path("/orcamento")}>Montar meu projeto</Link>}{tenant.whatsapp && <a className="vitra-textlink" href={`https://wa.me/${tenant.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noreferrer"><MessageCircle size={17}/>Falar com a loja</a>}</div></div>{image && <img src={image} alt={sf.glass_gallery?.find(s => s.image)?.title || "Imagem apresentada pela loja"}/>}</div></section></main>;
}
