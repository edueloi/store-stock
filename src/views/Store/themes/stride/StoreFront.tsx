import { useRef, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowDown, ArrowRight, ArrowUpRight, ChevronLeft, ChevronRight, Shirt } from "lucide-react";
import HeroSlider from "../../../../components/store/HeroSlider";
import StoreSEO from "../../../../components/store/StoreSEO";
import { productImage, useKit } from "../street/kit";
import { categoryImage, ProductCard } from "../street/shared";
import "./styles.css";

function ProductRail({ children }: { children: ReactNode }) {
  const rail = useRef<HTMLDivElement>(null);
  const scroll = (direction: number) => rail.current?.scrollBy({ left: direction * rail.current.clientWidth * .8, behavior: "smooth" });
  return <div className="sr-rail-wrap">
    <div className="sr-rail-controls"><button type="button" aria-label="Produtos anteriores" onClick={() => scroll(-1)}><ChevronLeft size={20} /></button><button type="button" aria-label="Próximos produtos" onClick={() => scroll(1)}><ChevronRight size={20} /></button></div>
    <div className="sr-rail" ref={rail} tabIndex={0} role="list" aria-label="Produtos em destaque">{children}</div>
  </div>;
}

export default function StoreFront() {
  const { tenant, active, categories, path, sf } = useKit();
  const featured = [...active.filter(p => p.is_featured), ...active.filter(p => !p.is_featured)].slice(0, tenant.featured_limit || 10);
  const collections = categories.filter(c => active.some(p => p.category_id === c.id)).slice(0, 3);
  const heroImage = tenant.banner_url || "/store-assets/stride-campaign-v1.jpg";
  const title = tenant.hero_tagline || "SEU ESTILO.\nSEM LIMITES.";
  const fallback = <section className="sr-campaign">
    <img className="sr-campaign-image" src={heroImage} alt="Campanha de moda esportiva: seu estilo em movimento" fetchPriority="high" />
    <div className="sr-campaign-shade" />
    <div className="sr-campaign-copy">
      <span className="sr-eyebrow"><span className="sr-live-dot" /> {sf.segment_label || "SPORTSWEAR / EVERYDAY CULTURE"}</span>
      <h1>{title}</h1>
      <p>Da rua ao próximo desafio. Encontre as peças que acompanham o seu ritmo.</p>
      <div className="sr-campaign-links"><Link className="sr-btn sr-btn-solid sr-btn-lg" to={path("/catalogo")}>{sf.hero_button_label || "Encontre seu próximo favorito"} <ArrowUpRight size={20} /></Link><a href="#stride-collections" className="sr-campaign-secondary">Explore o seu estilo <ArrowDown size={16} /></a></div>
    </div>
    <div className="sr-campaign-bottom"><span>FEITO PARA ACOMPANHAR VOCÊ.</span><span>01 / SEU PRÓXIMO MOVIMENTO ↗</span></div>
  </section>;
  return <div className="sr-page sr-home">
    <StoreSEO title={`${tenant.name} | Seu estilo em movimento`} description={tenant.about_text || "Camisetas, tênis e roupas para acompanhar o seu ritmo. Explore a coleção."} image={heroImage} url={typeof window !== "undefined" ? window.location.href : ""} siteName={tenant.name} />
    <HeroSlider slides={sf.hero_slides} autoplaySeconds={sf.hero_autoplay_seconds ?? 6} resolveUrl={u => u.startsWith("/") ? path(u) : u} layout="banner" className="sr-slider" fallback={fallback} />
    <div className="sr-manifesto-strip" aria-label="Moda para o seu ritmo"><span>DA RUA AO SEU PRÓXIMO DESAFIO</span><span aria-hidden="true">✳</span><span>VISTA O SEU RITMO</span><span aria-hidden="true">✳</span><span>O MOVIMENTO É SEU</span><ArrowUpRight size={24} aria-hidden="true" /></div>
    <section className="sr-section sr-home-section" id="stride-collections">
      <header className="sr-section-head"><div><span className="sr-eyebrow">01 / ENCONTRE SUA VIBE</span><h2 className="sr-h2">{sf.home_categories_title || "Vista o seu ritmo."}</h2></div><Link to={path("/catalogo")} className="sr-text-link">Toda a coleção <ArrowUpRight size={17} /></Link></header>
      {collections.length > 0 ? <div className="sr-collection-grid">{collections.map((c, i) => {
        const image = categoryImage(c, active);
        return <Link className={`sr-collection sr-collection-${i}`} to={path(`/catalogo?categoria=${c.id}`)} key={c.id}>
          <span className="sr-collection-number">0{i + 1} / COLLECTION</span>
          <div className="sr-collection-photo">{image ? <img src={image} alt={c.name} loading="lazy" /> : <Shirt size={90} />}</div>
          <div className="sr-collection-label"><div><small>EXPLORE A COLEÇÃO</small><h3>{c.name}</h3></div><span><ArrowUpRight size={24} /></span></div>
        </Link>;
      })}</div> : <div className="sr-empty"><Shirt size={40} /><h3>Uma nova coleção está chegando.</h3><p>Em breve, novas peças para acompanhar você.</p></div>}
    </section>
    <section className="sr-section sr-home-section">
      <header className="sr-section-head"><div><span className="sr-eyebrow">02 / ESCOLHAS EM DESTAQUE</span><h2 className="sr-h2">{sf.home_featured_title || "No radar."}</h2></div><Link to={path("/catalogo")} className="sr-text-link">Ver produtos <ArrowRight size={17} /></Link></header>
      {featured.length ? <ProductRail>{featured.map(p => <div className="sr-rail-item" role="listitem" key={p.id}><ProductCard product={p} t="sr" fab /></div>)}</ProductRail> : <p className="sr-empty">O catálogo está sendo preparado. Volte em breve.</p>}
    </section>
    <section className="sr-editorial">
      <div className="sr-editorial-copy"><span className="sr-eyebrow">MAIS QUE UM LOOK. UMA ATITUDE.</span><h2>O PRÓXIMO<br />MOVIMENTO<br /><em>É SEU.</em></h2><p>Conforto para o dia. Presença em cada passo. Escolha o que combina com você.</p><Link className="sr-btn sr-btn-solid sr-btn-lg" to={path("/catalogo")}>Explore a coleção <ArrowUpRight size={20} /></Link></div>
      <div className="sr-editorial-photo">{productImage(featured[0]) ? <img src={productImage(featured[0])} alt={featured[0].name} loading="lazy" /> : <Shirt size={160} aria-hidden="true" />}<span>EVERYDAY. YOUR WAY.</span></div>
    </section>
  </div>;
}
