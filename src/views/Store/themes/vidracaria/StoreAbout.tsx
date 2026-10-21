import { Link, useParams } from "react-router-dom";
import { ArrowRight, MapPin, MessageCircle, Store } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import { useStore } from "../../StoreLayout";
import { buildStorePath, resolveStoreSlug } from "../../store-routing";
export default function StoreAbout() {
  const { tenant, categories, products } = useStore(), { slug: routeSlug } = useParams();
  const path = (suffix = "") => buildStorePath(resolveStoreSlug(routeSlug), suffix);
  const sf = tenant.policies?.storefront || {}, image = sf.glass_gallery?.find(s => s.image)?.image || tenant.banner_url;
  const whatsapp = tenant.whatsapp?.replace(/\D/g, "");
  const location = tenant.show_address ? tenant.address || [tenant.address_city, tenant.address_state].filter(Boolean).join(" · ") : "";
  const catalogCategories = categories.filter(category => products.some(product => product.is_active && product.category_id === category.id)).slice(0, 6);
  const rawText = tenant.about_text?.trim() || "";
  // Outer quotation marks copied into the editor are presentation, not part of the story.
  const story = /^"[\s\S]*"$/.test(rawText) ? rawText.slice(1, -1) : rawText;
  const paragraphs = story.split(/\n+/).filter(part => part.trim());
  return <main className="vitra-root vitra-about-page vitra-about-editorial">
    <StoreSEO title={`Sobre a loja | ${tenant.name}`} description={story || `Conheça ${tenant.name}.`} image={image || tenant.logo_url || undefined} siteName={tenant.name}/>
    <section className="vitra-container vitra-section">
      <div className="vitra-about-layout">
        <div className="vitra-about-story"><span className="vitra-eyebrow">Sobre a loja</span><h1>{sf.about_title || "Conheça a nossa loja."}</h1>
          {paragraphs.length > 0 && <div className="vitra-about-story-text">{paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div>}
          <div className="vitra-hero-actions"><Link className="vitra-btn-primary" to={path("/catalogo")}>Conhecer o catálogo <ArrowRight size={16}/></Link>{sf.glass_quote_enabled === true && <Link className="vitra-btn-secondary" to={path("/orcamento")}>Montar meu projeto</Link>}{whatsapp && <a className="vitra-textlink" href={`https://wa.me/${whatsapp}`} target="_blank" rel="noreferrer"><MessageCircle size={17}/>Falar com a loja</a>}</div>
        </div>
        <aside className="vitra-about-identity" aria-label="Identidade da loja">
          <div className="vitra-about-brand-panel"><div className="vitra-about-logo">{tenant.logo_url ? <img src={tenant.logo_url} alt={`Logo de ${tenant.name}`}/> : <Store size={44} aria-hidden="true"/>}</div><h2>{tenant.name}</h2>{tenant.hero_tagline && <p>{tenant.hero_tagline}</p>}{location && <div className="vitra-about-location"><MapPin size={16}/><span>{location}</span></div>}</div>
          {image && <figure className="vitra-about-photo"><img src={image} alt={sf.glass_gallery?.find(s => s.image)?.title || "Imagem apresentada pela loja"} loading="lazy"/></figure>}
          {whatsapp && <a className="vitra-about-contact" href={`https://wa.me/${whatsapp}`} target="_blank" rel="noreferrer"><MessageCircle size={23}/><span>Atendimento da loja<strong>Converse com a nossa equipe</strong></span><ArrowRight size={18}/></a>}
        </aside>
      </div>
      {catalogCategories.length > 0 && <section className="vitra-about-categories" aria-label="Categorias da loja"><div><span className="vitra-eyebrow">Nosso catálogo</span><h2>Encontre o que precisa.</h2></div><div>{catalogCategories.map(category => <Link key={category.id} to={path(`/catalogo?cat=${category.id}`)}>{category.name}<ArrowRight size={15}/></Link>)}</div></section>}
    </section>
  </main>;
}
