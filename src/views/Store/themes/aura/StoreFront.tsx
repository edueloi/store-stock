import { Link } from "react-router-dom";
import { ArrowRight, ArrowUpRight, MessageCircle, Zap, Puzzle, Package, Heart } from "lucide-react";
import HeroSlider from "../../../../components/store/HeroSlider";
import StoreSEO from "../../../../components/store/StoreSEO";
import { useKit, whatsappLink } from "../street/kit";
import { SoftCard } from "./parts";
import "./styles.css";
export default function StoreFront() {
  const {tenant, active, path, sf} = useKit();
  const picks = [...active.filter(p=>p.is_featured), ...active.filter(p=>!p.is_featured)].filter(p=>p.type!=="internal").slice(0,tenant.featured_limit || 8);
  const image = tenant.banner_url || "/store-assets/aura-editorial-hero-v1.jpg";
  const campaign = <section className="au-hero"><img className="au-hero-image" src={image} alt="Editorial de moda feminina com alfaiataria de linho em tons neutros" fetchPriority="high"/><div className="au-hero-copy"><span className="au-kicker">{sf.segment_label || "AURA / MODA PARA VIVER"}</span><h1>{tenant.hero_tagline || "PRESENÇA\nEM CADA\nDETALHE."}</h1><p>Texturas, formas e a liberdade de vestir o que faz sentido para você.</p><Link className="au-hero-link" to={path("/catalogo")}>{sf.hero_button_label || "Explorar a coleção"}<ArrowUpRight size={20}/></Link></div><span className="au-fashion-caption">O SEU JEITO DE ESTAR NO MUNDO.</span></section>;
  return <div className="au-page au-home">
    <StoreSEO title={tenant.name} description={tenant.about_text || "Moda para acompanhar os seus momentos com naturalidade. Uma seleção de roupas e acessórios para combinar texturas, criar novas composições e vestir o que faz sentido para você."} image={image} siteName={tenant.name} />
    <HeroSlider slides={sf.hero_slides} autoplaySeconds={sf.hero_autoplay_seconds ?? 0} animate={false} resolveUrl={u=>u.startsWith("/")?path(u):u} layout="banner" className="au-slider" fallback={campaign} />
    <section className="au-home-selection"><header className="au-section-heading"><span className="au-kicker">A SELEÇÃO AURA</span><div><h2>{sf.home_featured_title || "Naturalmente, você."}</h2><Link className="au-text-link" to={path("/catalogo")}>Ver toda a coleção <ArrowRight size={16}/></Link></div></header>{picks.length ? <div className="au-grid">{picks.map(p=><SoftCard product={p} key={p.id} />)}</div> : <div className="au-empty"><h2>Novos produtos estão chegando.</h2><p>Estamos preparando o catálogo. Volte em breve.</p></div>}</section>
    <section className="au-fashion-note"><span className="au-kicker">UMA FORMA DE SE EXPRESSAR.</span><h2>Peças que ficam.<br/><em>Estilo que é seu.</em></h2><p>Descubra novas composições e detalhes para acompanhar os seus momentos.</p><Link className="au-text-link" to={path("/sobre")}>Nossa história <ArrowUpRight size={18}/></Link></section>
  </div>;
}
