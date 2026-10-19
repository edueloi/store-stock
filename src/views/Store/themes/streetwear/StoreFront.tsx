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
  const image = tenant.banner_url || "/store-assets/streetwear-editorial-hero-v1.jpg";
  const title = tenant.hero_tagline || "Seu ritmo.\nSua liberdade.";
  const fallback = <section className="sw-hero">
    <img className={`sw-hero-image${tenant.banner_url ? "" : " sw-hero-default"}`} src={image} alt={tenant.banner_url ? `Campanha da ${tenant.name}` : "Campanha de streetwear e skate com camiseta ampla e skateboard em cenário urbano"} fetchPriority="high" />
    <div className="sw-hero-shade" />
    <div className="sw-hero-copy">
      <span className="sw-kicker">{sf.segment_label || "STREETWEAR & SKATE / EVERYDAY"}</span>
      <h1>{title}</h1>
      <p>Peças para ir além. Conforto e identidade em todos os seus caminhos.</p>
      <Link className="sw-hero-link" to={path("/catalogo")}>{sf.hero_button_label || "Conhecer a coleção"}<ArrowRight size={18} /></Link>
    </div>
    <span className="sw-hero-caption">{tenant.name} / A coleção</span>
  </section>;
  return <div className="sw-page sw-home">
    <StoreSEO title={`${tenant.name} | Streetwear & Skate`} description={tenant.about_text || "Streetwear e skate fazem parte de um jeito livre de viver. Reunimos camisetas, calçados e peças versáteis para o seu dia a dia, com espaço para a sua personalidade e para os caminhos que você escolher."} image={image} url={typeof window !== "undefined" ? window.location.href : ""} siteName={tenant.name} />
    <HeroSlider slides={sf.hero_slides} autoplaySeconds={sf.hero_autoplay_seconds ?? 0} animate={false} resolveUrl={u => u.startsWith("/") ? path(u) : u} layout="banner" className="sw-slider" fallback={fallback} />
    <section className="sw-home-selection">
      <header className="sw-section-heading"><div><span className="sw-kicker">ESCOLHIDOS PARA VOCÊ</span><h2>{sf.home_featured_title || "Essenciais para o seu ritmo"}</h2></div><Link className="sw-text-link" to={path("/catalogo")}>Ver toda a coleção <ArrowRight size={16} /></Link></header>
      {featured.length ? <div className="sw-grid sw-grid-feature">{featured.map(p => <ProductCard key={p.id} product={p} t="sw" />)}</div> : <div className="sw-empty"><h2>Uma nova coleção está chegando.</h2><p>Estamos preparando as próximas peças. Volte em breve.</p></div>}
    </section>
    <section className="sw-brand-note"><span className="sw-kicker">LIBERDADE PARA SER VOCÊ.</span><h2>Vista a sua história.<br />Siga o seu caminho.</h2><Link className="sw-text-link" to={path("/sobre")}>Conheça nossa história <ArrowRight size={16} /></Link></section>
  </div>;
}
