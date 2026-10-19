import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import HeroSlider from "../../../../components/store/HeroSlider";
import { useShop } from "./kit";
import { TechCard } from "./parts";
import "./styles.css";

export default function StoreFront() {
  const { tenant, active, path, config: sf } = useShop();
  const featured = [...active.filter(p => p.is_featured), ...active.filter(p => !p.is_featured)].slice(0, tenant.featured_limit || 8);
  const image = tenant.banner_url || "/store-assets/tech-editorial-hero-v1.jpg";
  const title = tenant.hero_tagline || "Mais conexão.\nMais possibilidades.";
  const fallback = <section className="tp-hero">
    <img className={`tp-hero-image${tenant.banner_url ? "" : " tp-hero-default"}`} src={image} alt={tenant.banner_url ? `Campanha da ${tenant.name}` : "Campanha de tecnologia com notebook, smartphone e fones em mesa de grafite"} fetchPriority="high" />
    <div className="tp-hero-shade" />
    <div className="tp-hero-copy">
      <span className="tp-kicker">{sf.segment_label || "TECNOLOGIA PARA O SEU DIA"}</span>
      <h1>{title}</h1>
      <p>Dispositivos e acessórios para conectar trabalho, casa e os seus momentos.</p>
      <Link className="tp-hero-link" to={path("/catalogo")}>{sf.hero_button_label || "Explorar tecnologia"}<ArrowRight size={18} /></Link>
    </div>
    <span className="tp-hero-caption">{tenant.name} / A coleção</span>
  </section>;
  return <div className="tp-page tp-home">
    <StoreSEO title={`${tenant.name} | Tecnologia Pro`} description={tenant.about_text || "Eletrônicos e acessórios para conectar trabalho, casa e diversão. Uma seleção para acompanhar as suas necessidades, com atendimento direto para ajudar você a escolher e confirmar a compatibilidade antes da compra."} image={image} url={typeof window !== "undefined" ? window.location.href : ""} siteName={tenant.name} />
    <HeroSlider slides={sf.hero_slides} autoplaySeconds={sf.hero_autoplay_seconds ?? 0} animate={false} resolveUrl={u => { if (!u.startsWith("/")) return u; const [part, query] = u.split("?"); return path(part, Object.fromEntries(new URLSearchParams(query))); }} layout="banner" className="tp-slider" fallback={fallback} />
    <section className="tp-home-selection">
      <header className="tp-section-heading"><div><span className="tp-kicker">ESCOLHIDOS PARA VOCÊ</span><h2>{sf.home_featured_title || "Essenciais para conectar"}</h2></div><Link className="tp-text-link" to={path("/catalogo")}>Ver toda a coleção <ArrowRight size={16} /></Link></header>
      {featured.length ? <div className="tp-grid tp-grid-feature">{featured.map(p => <TechCard key={p.id} product={p} />)}</div> : <div className="tp-empty"><h2>Uma nova coleção está chegando.</h2><p>Estamos preparando a seleção. Volte em breve.</p></div>}
    </section>
    <section className="tp-brand-note"><span className="tp-kicker">ESCOLHAS QUE ACOMPANHAM VOCÊ.</span><h2>Tecnologia com propósito.<br />Todos os dias.</h2><Link className="tp-text-link" to={path("/sobre")}>Conheça nossa história <ArrowRight size={16} /></Link></section>
  </div>;
}
