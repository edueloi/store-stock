import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import HeroSlider from "../../../../components/store/HeroSlider";
import { useKit } from "./kit";
import { ProductCard } from "./ThemeParts";
import "./styles.css";

export default function StoreFront() {
  const { tenant, active, path, sf } = useKit();
  const featured = [...active.filter(p => p.is_featured), ...active.filter(p => !p.is_featured)].slice(0, tenant.featured_limit || 8);
  const image = tenant.banner_url || "/store-assets/beauty-editorial-hero-v1.jpg";
  const title = tenant.hero_tagline || "Seu cuidado.\nSeu tempo.";
  const fallback = <section className="bty-hero">
    <img className={`bty-hero-image${tenant.banner_url ? "" : " bty-hero-default"}`} src={image} alt={tenant.banner_url ? `Campanha da ${tenant.name}` : "Campanha de skincare com frascos e creme sobre pedra clara"} fetchPriority="high" />
    <div className="bty-hero-shade" />
    <div className="bty-hero-copy">
      <span className="bty-kicker">{sf.segment_label || "SKINCARE & AUTOCUIDADO"}</span>
      <h1>{title}</h1>
      <p>Um momento para você. Escolhas para fazer parte da sua rotina.</p>
      <Link className="bty-hero-link" to={path("/catalogo")}>{sf.hero_button_label || "Descobrir os cuidados"}<ArrowRight size={18} /></Link>
    </div>
    <span className="bty-hero-caption">{tenant.name} / A coleção</span>
  </section>;
  return <div className="bty-page bty-home">
    <StoreSEO title={`${tenant.name} | Beleza e skincare`} description={tenant.about_text || "Uma seleção de skincare, cosméticos e autocuidado para acompanhar os seus momentos. Acreditamos em escolhas conscientes e no valor de reservar um tempo para você."} image={image} url={typeof window !== "undefined" ? window.location.href : ""} siteName={tenant.name} />
    <HeroSlider slides={sf.hero_slides} autoplaySeconds={sf.hero_autoplay_seconds ?? 0} animate={false} resolveUrl={u => u.startsWith("/") ? path(u) : u} layout="banner" className="bty-slider" fallback={fallback} />
    <section className="bty-home-selection">
      <header className="bty-section-heading"><div><span className="bty-kicker">ESCOLHIDOS PARA VOCÊ</span><h2>{sf.home_featured_title || "Essenciais do seu cuidado"}</h2></div><Link className="bty-text-link" to={path("/catalogo")}>Ver toda a coleção <ArrowRight size={16} /></Link></header>
      {featured.length ? <div className="bty-grid bty-grid-feature">{featured.map(p => <ProductCard key={p.id} product={p} />)}</div> : <div className="bty-empty"><h2>Uma nova coleção está chegando.</h2><p>Estamos preparando a seleção. Volte em breve.</p></div>}
    </section>
    <section className="bty-brand-note"><span className="bty-kicker">UM MOMENTO PARA CUIDAR DE VOCÊ.</span><h2>Sua rotina merece<br />um pouco mais de calma.</h2><Link className="bty-text-link" to={path("/sobre")}>Conheça nossa história <ArrowRight size={16} /></Link></section>
  </div>;
}
