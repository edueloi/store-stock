import { Link, useParams } from "react-router-dom";
import { ArrowRight, ClipboardList, Ruler, Send } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import HeroSlider from "../../../../components/store/HeroSlider";
import { useStore } from "../../StoreLayout";
import { buildStorePath, productRouteSegment, resolveStoreSlug } from "../../store-routing";
import { VitraProductCard, vitraHidePrices, vitraImage } from "./ThemeParts";

import { vitraContent, VITRA_BACKGROUND } from "./content";

function EditorialTitle({ text }: { text: string }) {
  const lines = text.split("\n");
  return <>{lines.map((line, i) => <span key={i}>{i > 0 && <br/>}{lines.length > 1 && i === lines.length - 1 ? <em>{line}</em> : line}</span>)}</>;
}
export default function StoreFront() {
  const { slug: routeSlug } = useParams();
  const { tenant, products, categories } = useStore();
  const path = (suffix = "") => buildStorePath(resolveStoreSlug(routeSlug), suffix);
  const sf = tenant.policies?.storefront || {}, quoteEnabled = sf.glass_quote_enabled === true;
  const content = vitraContent(tenant);
  const icons = [ClipboardList, Ruler, Send];
  const active = products.filter(p => p.is_active);
  const featured = active.filter(p => p.is_featured);
  const showcase = (featured.length ? featured : active).slice(0,8);
  const lines = categories.filter(c => active.some(p => p.category_id === c.id)).slice(0,4);
  const gallery = sf.glass_gallery?.filter(s => s.image) || [];
  const hero = tenant.banner_url || VITRA_BACKGROUND;
  const heroTitle = sf.glass_hero_title ?? "Novas perspectivas\npara o seu espaço.";
  const heroDescription = sf.glass_hero_description ?? (tenant.about_text || "Conheça nosso catálogo e encontre os produtos que fazem parte do seu próximo projeto.");
  const categoriesTitle = sf.home_categories_title ?? "Um catálogo de possibilidades.";
  const featuredTitle = sf.home_featured_title ?? "Os detalhes começam aqui.";
  const photos = gallery.length ? gallery.slice(0,3).map(s => ({ image: s.image, title: s.title, subtitle: s.subtitle, href: "" })) : content.gallery_use_products ? active.filter(p => vitraImage(p)).slice(0,3).map(p => ({ image: vitraImage(p)!, title: p.name, subtitle: categories.find(c => c.id === p.category_id)?.name, href: path(`/produto/${productRouteSegment(p)}`) })) : [];
  return <main className="vitra-root vitra-home">
    <StoreSEO title={`${tenant.name} | Catálogo de soluções`} description={heroDescription || `Conheça os produtos de ${tenant.name}.`} image={hero} siteName={tenant.name}/>
    {content.show_hero && <div className="vitra-container vitra-hero-wrap"><HeroSlider slides={sf.hero_slides} autoplaySeconds={sf.hero_autoplay_seconds} resolveUrl={url => url.startsWith("/") ? path(url) : url} layout="banner" className="vitra-slider" fallback={<section className="vitra-hero vitra-editorial-hero">
      <img className="vitra-hero-bg" src={hero} alt=""/><div className="vitra-hero-copy">
        {content.hero_eyebrow && <div className="vitra-eyebrow">{content.hero_eyebrow}</div>}{heroTitle && <h1><EditorialTitle text={heroTitle}/></h1>}{heroDescription && <p>{heroDescription}</p>}
        <div className="vitra-hero-actions">{content.hero_catalog_button && <Link className="vitra-btn-primary" to={path("/catalogo")}>{content.hero_catalog_button} <ArrowRight size={16}/></Link>}{quoteEnabled && content.hero_project_button && <Link to={path("/orcamento")} className="vitra-btn-secondary">{content.hero_project_button}</Link>}</div>
      </div>{content.show_catalog_count && <div className="vitra-hero-note"><span>CATÁLOGO DA LOJA</span><b>{String(active.length).padStart(2,"0")}</b><small>produtos para explorar</small></div>}
    </section>}/></div>}
    {content.show_intro && <div className="vitra-container vitra-home-intro">{content.intro_title && <p><EditorialTitle text={content.intro_title}/></p>}{content.intro_text && <span>{content.intro_text}</span>}{content.intro_button && <Link className="vitra-textlink" to={path("/catalogo")}>{content.intro_button} <ArrowRight size={16}/></Link>}</div>}
    {content.show_categories && lines.length > 0 && <section className="vitra-container vitra-section vitra-home-lines"><div className="vitra-sec-head"><div>{content.categories_eyebrow && <span className="vitra-eyebrow">{content.categories_eyebrow}</span>}{categoriesTitle && <h2>{categoriesTitle}</h2>}</div></div><div className="vitra-line-grid">{lines.map((c,i) => { const img = c.cover_url || vitraImage(active.find(p => p.category_id === c.id) || {}); return <Link key={c.id} className="vitra-line-tile" to={path(`/catalogo?cat=${c.id}`)}><span className="vitra-line-photo">{img ? <img src={img} alt="" loading="lazy"/> : <Ruler size={40}/>}</span><small>0{i+1}</small><h3>{c.name}<ArrowRight size={18}/></h3></Link>; })}</div></section>}
    {content.show_featured && <section className="vitra-band"><div className="vitra-container vitra-section"><div className="vitra-sec-head"><div>{content.featured_eyebrow && <div className="vitra-eyebrow">{content.featured_eyebrow}</div>}{featuredTitle && <h2>{featuredTitle}</h2>}</div><Link className="vitra-textlink" to={path("/catalogo")}>Catálogo completo <ArrowRight size={14}/></Link></div>{showcase.length ? <div className="vitra-grid">{showcase.map(p => <VitraProductCard key={p.id} product={p} category={categories.find(c => c.id === p.category_id)?.name} path={path} hidePrices={vitraHidePrices(tenant)} quoteEnabled={quoteEnabled}/>)}</div> : <p>Nosso catálogo está sendo preparado. Volte em breve para conhecer os produtos.</p>}</div></section>}
    {quoteEnabled && content.show_process && <section className="vitra-container vitra-section vitra-process"><div>{content.process_eyebrow && <span className="vitra-eyebrow">{content.process_eyebrow}</span>}{content.process_title && <h2><EditorialTitle text={content.process_title}/></h2>}{content.hero_project_button && <Link to={path("/orcamento")} className="vitra-btn-primary">{content.hero_project_button} <ArrowRight size={16}/></Link>}</div><ol>{content.process_steps.map(({title,text},i) => { const Icon = icons[i]; return (title || text) ? <li key={i}><span>0{i+1}</span><Icon size={24}/><div>{title && <h3>{title}</h3>}{text && <p>{text}</p>}</div></li> : null; })}</ol></section>}
    {content.show_gallery && photos.length > 0 && <section className="vitra-container vitra-section vitra-portfolio"><div className="vitra-sec-head"><div>{content.gallery_eyebrow && <span className="vitra-eyebrow">{content.gallery_eyebrow}</span>}{content.gallery_title && <h2>{content.gallery_title}</h2>}</div></div><div className="vitra-portfolio-grid">{photos.map((photo,i) => <figure key={i}>{photo.href ? <Link to={photo.href}><img src={photo.image} alt={photo.title || "Produto do catálogo"} loading="lazy"/></Link> : <img src={photo.image} alt={photo.title || "Ambiente apresentado pela loja"} loading="lazy"/>}{(photo.title || photo.subtitle) && <figcaption><b>{photo.title}</b><span>{photo.subtitle}</span></figcaption>}</figure>)}</div></section>}
    {content.show_closing && <section className="vitra-container vitra-final-section"><div className="vitra-final-photo">{content.closing_image && <img src={content.closing_image} alt="" loading="lazy"/>}<div>{content.closing_eyebrow && <span className="vitra-eyebrow">{content.closing_eyebrow}</span>}{content.closing_title && <h2><EditorialTitle text={content.closing_title}/></h2>}{content.closing_button && <Link className="vitra-btn-primary" to={path(quoteEnabled ? "/orcamento" : "/catalogo")}>{content.closing_button}<ArrowRight size={16}/></Link>}</div></div></section>}
  </main>;
}
