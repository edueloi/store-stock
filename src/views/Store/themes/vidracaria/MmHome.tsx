import { Link, useParams } from "react-router-dom";
import { ArrowDown, ArrowRight, Layers3, MessageCircle, Ruler, ScanLine } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import HeroSlider from "../../../../components/store/HeroSlider";
import { useStore } from "../../StoreLayout";
import { buildStorePath, resolveStoreSlug } from "../../store-routing";
import { VitraProductCard, vitraHidePrices, vitraImage } from "./ThemeParts";
import { vitraContent } from "./content";
import { mmContactNumber } from "./mm";

export const MM_ART = {
  hero: "/store-assets/mm-glass/shower-hero-v1.webp",
  portrait: "/store-assets/mm-glass/windows-portrait-v1.webp",
};

export default function MmHome() {
  const { tenant, products, categories } = useStore();
  const { slug } = useParams();
  const path = (suffix = "") => buildStorePath(resolveStoreSlug(slug), suffix);
  const sf = tenant.policies?.storefront || {}, content = vitraContent(tenant);
  const active = products.filter(p => p.is_active);
  const featured = active.filter(p => p.is_featured);
  const lines = categories.filter(c => active.some(p => p.category_id === c.id));
  const byCategory = lines.map(category => active.find(p => p.category_id === category.id && vitraImage(p)) || active.find(p => p.category_id === category.id)!);
  const showcase = (featured.length ? featured : [...new Map([...byCategory, ...active].map(product => [product.id, product])).values()]).slice(0, 8);
  const hero = tenant.banner_url || MM_ART.hero;
  const title = sf.glass_hero_title ?? "Transparência que\ntransforma espaços.";
  const description = sf.glass_hero_description ?? "Vidros, alumínios e ferragens para dar forma ao seu projeto. Encontre os detalhes que fazem a diferença.";
  const wa = tenant.whatsapp ? `https://wa.me/${mmContactNumber(tenant.whatsapp)}` : "";
  return <main className="vitra-root vitra-home mm-home">
    <StoreSEO title={`${tenant.name} | Vidros, alumínios e ferragens`} description={description} image={hero} siteName={tenant.name}/>
    {content.show_hero && <HeroSlider slides={sf.hero_slides} autoplaySeconds={sf.hero_autoplay_seconds} resolveUrl={url => url.startsWith("/") ? path(url) : url} layout="banner" className="mm-slider" fallback={<section className="mm-hero">
      <picture>{hero === MM_ART.hero && <source media="(max-width: 700px)" srcSet={MM_ART.portrait}/>}<img src={hero} alt="Vidros transparentes e esquadrias de alumínio em um ambiente contemporâneo" fetchPriority="high"/></picture>
      <div className="mm-hero-shade"/>
      <div className="vitra-container mm-hero-inner"><div className="mm-hero-copy">
        {content.hero_eyebrow && <span className="mm-label">{content.hero_eyebrow}</span>}
        {title && <h1>{title.split("\n").map((line, index) => <span key={index}>{line}</span>)}</h1>}
        {description && <p>{description}</p>}
        <div className="mm-actions">{content.hero_catalog_button && <Link className="mm-button" to={path("/catalogo")}>{content.hero_catalog_button}<ArrowRight size={18}/></Link>}{wa && <a className="mm-hero-contact" href={wa} target="_blank" rel="noreferrer">Falar com a equipe <MessageCircle size={17}/></a>}</div>
      </div><div className="mm-hero-bottom"><span>BOX · JANELAS · ESQUADRIAS · ACESSÓRIOS</span><a href="#mm-catalogo" aria-label="Conhecer a seleção de produtos"><ArrowDown size={18}/></a>{content.show_catalog_count && <span>{String(active.length).padStart(2, "0")} produtos no catálogo</span>}</div></div>
    </section>}/>}
    {content.show_intro && <section className="mm-benefits" aria-label="Soluções da M&M"><div className="vitra-container"><div><ScanLine size={26}/><span><strong>Vidros e transparência</strong>Novas possibilidades para cada ambiente.</span></div><div><Layers3 size={26}/><span><strong>Alumínios e ferragens</strong>Os detalhes que conectam seu projeto.</span></div><div><Ruler size={26}/><span><strong>Escolha com orientação</strong>Converse com quem entende do assunto.</span></div></div></section>}
    {content.show_featured && <section id="mm-catalogo" className="vitra-container vitra-section mm-featured"><div className="vitra-sec-head"><div><span className="vitra-eyebrow">{content.featured_eyebrow}</span><h2>{sf.home_featured_title || "Seu projeto começa nos detalhes."}</h2><p>Conheça os produtos e encontre a peça que você precisa.</p></div><Link className="mm-textlink" to={path("/catalogo")}>Ver catálogo completo<ArrowRight size={18}/></Link></div>{showcase.length ? <div className="vitra-grid">{showcase.map(product => <VitraProductCard key={product.id} product={product} category={categories.find(c => c.id === product.category_id)?.name} path={path} hidePrices={vitraHidePrices(tenant)} quoteEnabled={sf.glass_quote_enabled === true}/>)}</div> : <p>Em breve, novas soluções no nosso catálogo.</p>}</section>}
    {content.show_gallery && <section className="mm-editorial"><div className="mm-editorial-photo"><img src={MM_ART.portrait} alt="Portas de vidro com esquadrias de alumínio integrando o ambiente a um jardim" loading="lazy"/><span>INSPIRAÇÃO PARA O SEU AMBIENTE</span></div><div className="mm-editorial-copy"><span className="vitra-eyebrow">VIDRO, LUZ E POSSIBILIDADES</span><h2>Mais luz.<br/>Mais espaço.<br/><em>Mais possibilidades.</em></h2><p>Da transparência do vidro à precisão dos acabamentos, cada escolha muda a maneira de viver um ambiente. Encontre na M&M materiais e acessórios para o seu próximo projeto.</p><Link className="mm-button" to={path("/catalogo")}>Explore nossas soluções<ArrowRight size={18}/></Link><div className="mm-materials"><span>01 / Vidros temperados</span><span>02 / Perfis de alumínio</span><span>03 / Ferragens e acessórios</span></div></div></section>}
    {content.show_categories && lines.length > 0 && <section className="vitra-container vitra-section mm-categories"><div className="vitra-sec-head"><div><span className="vitra-eyebrow">{content.categories_eyebrow}</span><h2>{sf.home_categories_title || "Encontre sua solução."}</h2></div></div><div className="mm-category-grid">{lines.map((category, index) => <Link key={category.id} to={path(`/catalogo?cat=${category.id}`)}><span>{String(index + 1).padStart(2, "0")}</span><h3>{category.name}</h3><ArrowRight size={21}/></Link>)}</div></section>}
    {content.show_closing && <section className="mm-closing"><img src={content.closing_image || MM_ART.hero} alt="" loading="lazy"/><div className="vitra-container"><span className="mm-label">{content.closing_eyebrow}</span><h2>{content.closing_title || "Vamos dar forma\nao seu próximo projeto?"}</h2><div className="mm-actions"><Link className="mm-button" to={path(sf.glass_quote_enabled === true ? "/orcamento" : "/catalogo")}>{content.closing_button || "Conhecer o catálogo"}<ArrowRight size={18}/></Link>{wa && <a className="mm-hero-contact" href={wa} target="_blank" rel="noreferrer"><MessageCircle size={18}/>Atendimento M&M</a>}</div></div></section>}
  </main>;
}
