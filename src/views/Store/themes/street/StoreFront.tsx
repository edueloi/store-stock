import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import HeroSlider from "../../../../components/store/HeroSlider";
import { useKit } from "../street/kit";
import { ProductCard } from "../street/shared";
import "./styles.css";

export default function StoreFront() {
  const { tenant, active, path, sf } = useKit();
  const featured = [...active.filter(p => p.is_featured), ...active.filter(p => !p.is_featured)].slice(0, tenant.featured_limit || 8);
  const image = tenant.banner_url || "/store-assets/street-editorial-hero-v1.jpg";
  const title = tenant.hero_tagline || "A rua é sua.\nO estilo também.";
  const fallback = <section className="sd-hero">
    <img className={`sd-hero-image${tenant.banner_url ? "" : " sd-hero-default"}`} src={image} alt={tenant.banner_url ? `Campanha da ${tenant.name}` : "Campanha de streetwear com camiseta ampla e calça cargo em cenário de concreto"} fetchPriority="high" />
    <div className="sd-hero-shade" />
    <div className="sd-hero-copy">
      <span className="sd-kicker">{sf.segment_label || "STREETWEAR / CULTURA URBANA"}</span>
      <h1>{title}</h1>
      <p>Camisetas, sneakers e peças para viver a cidade do seu jeito.</p>
      <Link className="sd-hero-link" to={path("/catalogo")}>{sf.hero_button_label || "Explorar o drop"}<ArrowRight size={18} /></Link>
    </div>
    <span className="sd-hero-caption">{tenant.name} / A coleção</span>
  </section>;
  return <div className="sd-page sd-home">
    <StoreSEO title={`${tenant.name} | Street Drop`} description={tenant.about_text || "Camisetas, sneakers e peças que acompanham o ritmo da cidade. Uma seleção de moda urbana para expressar a sua identidade, com conforto e liberdade para fazer as suas próprias escolhas."} image={image} url={typeof window !== "undefined" ? window.location.href : ""} siteName={tenant.name} />
    <HeroSlider slides={sf.hero_slides} autoplaySeconds={sf.hero_autoplay_seconds ?? 0} animate={false} resolveUrl={u => u.startsWith("/") ? path(u) : u} layout="banner" className="sd-slider" fallback={fallback} />
    <section className="sd-home-selection">
      <header className="sd-section-heading"><div><span className="sd-kicker">ESCOLHIDOS PARA VOCÊ</span><h2>{sf.home_featured_title || "Escolhas do drop"}</h2></div><Link className="sd-text-link" to={path("/catalogo")}>Ver toda a coleção <ArrowRight size={16} /></Link></header>
      {featured.length ? <div className="sd-grid sd-grid-feature">{featured.map(p => <ProductCard key={p.id} product={p} t="sd" />)}</div> : <div className="sd-empty"><h2>Uma nova coleção está chegando.</h2><p>Estamos preparando as próximas peças. Volte em breve.</p></div>}
    </section>
    <section className="sd-brand-note"><span className="sd-kicker">PRESENÇA SEM EXCESSO.</span><h2>Sua identidade.<br />Em cada detalhe.</h2><Link className="sd-text-link" to={path("/sobre")}>Conheça nossa história <ArrowRight size={16} /></Link></section>
  </div>;
}
