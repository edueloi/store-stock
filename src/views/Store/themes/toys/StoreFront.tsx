import { Link } from "react-router-dom";
import { ArrowRight, ArrowUpRight, MessageCircle, Zap, Puzzle, Package, Heart } from "lucide-react";
import HeroSlider from "../../../../components/store/HeroSlider";
import StoreSEO from "../../../../components/store/StoreSEO";
import { useKit, whatsappLink } from "../street/kit";
import { ProductCard } from "./parts";
import "./styles.css";
export default function StoreFront() {
  const {tenant, active, path, sf} = useKit();
  const picks = [...active.filter(p=>p.is_featured), ...active.filter(p=>!p.is_featured)].filter(p=>p.type!=="internal").slice(0,tenant.featured_limit || 8);
  const image = tenant.banner_url || "/store-assets/toys-editorial-hero-v1.jpg";
  const campaign = <section className="toys-hero"><div className="toys-play-photo"><img className="toys-hero-image" src={image} alt="Trem de madeira, blocos suaves e urso de pelúcia em brinquedoteca" fetchPriority="high"/><span>UM MUNDO PARA DESCOBRIR.</span></div><div className="toys-hero-copy"><span className="toys-kicker">{sf.segment_label || "IMAGINAR É SÓ O COMEÇO"}</span><h1>{tenant.hero_tagline || "Pequenas mãos.\nGrandes histórias."}</h1><p>Brinquedos e jogos que abrem espaço para inventar, descobrir e brincar de novo.</p><Link className="toys-hero-link" to={path("/catalogo")}>{sf.hero_button_label || "Descobrir os brinquedos"}<ArrowRight size={18}/></Link><Puzzle size={28} strokeWidth={1} className="toys-play-mark"/></div></section>;
  return <div className="toys-page toys-home">
    <StoreSEO title={tenant.name} description={tenant.about_text || "Brinquedos, jogos e presentes para acompanhar descobertas e criar memórias. Confira a faixa etária e as informações da embalagem para encontrar uma escolha para cada momento."} image={image} siteName={tenant.name} />
    <HeroSlider slides={sf.hero_slides} autoplaySeconds={sf.hero_autoplay_seconds ?? 0} animate={false} resolveUrl={u=>u.startsWith("/")?path(u):u} layout="banner" className="toys-slider" fallback={campaign} />
    <section className="toys-home-selection"><header className="toys-section-heading"><span className="toys-kicker">ESCOLHIDOS PARA BRINCAR</span><h2>{sf.home_featured_title || "Qual vai ser a brincadeira?"}</h2><Link className="toys-text-link" to={path("/catalogo")}>Ver todos os produtos <ArrowRight size={16}/></Link></header>{picks.length ? <div className="toys-grid">{picks.map(p=><ProductCard product={p} key={p.id} />)}</div> : <div className="toys-empty"><h2>Novos produtos estão chegando.</h2><p>Estamos preparando o catálogo. Volte em breve.</p></div>}</section>
    <section className="toys-play-note"><Puzzle size={34} strokeWidth={1}/><span className="toys-kicker">TEMPO DE DESCOBERTAS</span><h2>Menos pressa.<br/>Mais tempo de brincar.</h2><p>Confira a faixa etária e as informações de cada brinquedo. Encontre um presente para acompanhar novas histórias.</p><Link className="toys-text-link" to={path("/sobre")}>Conheça a loja <ArrowUpRight size={18}/></Link></section>
  </div>;
}
