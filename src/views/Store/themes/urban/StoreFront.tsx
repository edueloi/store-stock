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
  const image = tenant.banner_url || "/store-assets/urban-editorial-hero-v1.jpg";
  const title = tenant.hero_tagline || "O essencial.\nDo seu jeito.";
  const fallback = <section className="ur-hero">
    <img className={`ur-hero-image${tenant.banner_url ? "" : " ur-hero-default"}`} src={image} alt={tenant.banner_url ? `Campanha da ${tenant.name}` : "Editorial de moda com peças em linho e alfaiataria"} fetchPriority="high" />
    <div className="ur-hero-shade" />
    <div className="ur-hero-copy">
      <span className="ur-kicker">{sf.segment_label || "MODA PARA TODOS OS DIAS"}</span>
      <h1>{title}</h1>
      <p>Peças que acompanham você. Estilo que permanece.</p>
      <Link className="ur-hero-link" to={path("/catalogo")}>{sf.hero_button_label || "Conheça a coleção"}<ArrowRight size={18} /></Link>
    </div>
    <span className="ur-hero-caption">{tenant.name} / A coleção</span>
  </section>;
  return <div className="ur-page ur-home">
    <StoreSEO title={`${tenant.name} | Urban Edit`} description={tenant.about_text || "Roupas, calçados e acessórios para expressar seu estilo todos os dias."} image={image} url={typeof window !== "undefined" ? window.location.href : ""} siteName={tenant.name} />
    <HeroSlider slides={sf.hero_slides} autoplaySeconds={sf.hero_autoplay_seconds ?? 0} animate={false} resolveUrl={u => u.startsWith("/") ? path(u) : u} layout="banner" className="ur-slider" fallback={fallback} />
    <section className="ur-home-selection">
      <header className="ur-section-heading"><div><span className="ur-kicker">ESCOLHIDOS PARA VOCÊ</span><h2>{sf.home_featured_title || "Essenciais da coleção"}</h2></div><Link className="ur-text-link" to={path("/catalogo")}>Ver toda a coleção <ArrowRight size={16} /></Link></header>
      {featured.length ? <div className="ur-grid ur-grid-feature">{featured.map(p => <ProductCard key={p.id} product={p} t="ur" />)}</div> : <div className="ur-empty"><h2>Uma nova coleção está chegando.</h2><p>Estamos preparando as próximas peças. Volte em breve.</p></div>}
    </section>
    <section className="ur-brand-note"><span className="ur-kicker">MENOS EXCESSO. MAIS ESSÊNCIA.</span><h2>Vista o que faz<br />sentido para você.</h2><Link className="ur-text-link" to={path("/sobre")}>Conheça nossa história <ArrowRight size={16} /></Link></section>
  </div>;
}
