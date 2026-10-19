import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import HeroSlider from "../../../../components/store/HeroSlider";
import { useKit } from "./kit";
import { ProductCard } from "./parts";
import "./styles.css";

export default function StoreFront() {
  const { tenant, active, path, sf } = useKit();
  const featured = [...active.filter(p => p.is_featured), ...active.filter(p => !p.is_featured)].slice(0, tenant.featured_limit || 8);
  const image = tenant.banner_url || "/store-assets/fragrance-editorial-hero-v1.jpg";
  const title = tenant.hero_tagline || "Uma presença.\nSua assinatura.";
  const fallback = <section className="frg-hero">
    <img className={`frg-hero-image${tenant.banner_url ? "" : " frg-hero-default"}`} src={image} alt={tenant.banner_url ? `Campanha da ${tenant.name}` : "Campanha de perfumaria com frasco âmbar sobre pedra natural"} fetchPriority="high" />
    <div className="frg-hero-shade" />
    <div className="frg-hero-copy">
      <span className="frg-kicker">{sf.segment_label || "PERFUMARIA & MEMÓRIAS"}</span>
      <h1>{title}</h1>
      <p>Fragrâncias que acompanham momentos. Uma assinatura que é só sua.</p>
      <Link className="frg-hero-link" to={path("/catalogo")}>{sf.hero_button_label || "Explorar fragrâncias"}<ArrowRight size={18} /></Link>
    </div>
    <span className="frg-hero-caption">{tenant.name} / A coleção</span>
  </section>;
  return <div className="frg-page frg-home">
    <StoreSEO title={`${tenant.name} | Perfumaria`} description={tenant.about_text || "Uma seleção de perfumes para acompanhar a sua história. Acreditamos na memória de um aroma, na escolha pessoal e nos pequenos gestos que marcam os seus momentos."} image={image} url={typeof window !== "undefined" ? window.location.href : ""} siteName={tenant.name} />
    <HeroSlider slides={sf.hero_slides} autoplaySeconds={sf.hero_autoplay_seconds ?? 0} animate={false} resolveUrl={u => u.startsWith("/") ? path(u) : u} layout="banner" className="frg-slider" fallback={fallback} />
    <section className="frg-home-selection">
      <header className="frg-section-heading"><div><span className="frg-kicker">ESCOLHIDOS PARA VOCÊ</span><h2>{sf.home_featured_title || "Fragrâncias para descobrir"}</h2></div><Link className="frg-text-link" to={path("/catalogo")}>Ver toda a coleção <ArrowRight size={16} /></Link></header>
      {featured.length ? <div className="frg-grid frg-grid-feature">{featured.map(p => <ProductCard key={p.id} product={p} />)}</div> : <div className="frg-empty"><h2>Uma nova coleção está chegando.</h2><p>Estamos preparando a seleção. Volte em breve.</p></div>}
    </section>
    <section className="frg-brand-note"><span className="frg-kicker">O INVISÍVEL TAMBÉM DEIXA SUA MARCA.</span><h2>Uma fragrância. Um gesto.<br />A sua essência.</h2><Link className="frg-text-link" to={path("/sobre")}>Conheça nossa história <ArrowRight size={16} /></Link></section>
  </div>;
}
