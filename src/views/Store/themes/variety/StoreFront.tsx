import { Link } from "react-router-dom";
import { ArrowRight, ArrowUpRight, MessageCircle, Zap, Puzzle, Package, Heart } from "lucide-react";
import HeroSlider from "../../../../components/store/HeroSlider";
import StoreSEO from "../../../../components/store/StoreSEO";
import { useKit, whatsappLink } from "../street/kit";
import { VarietyProductCard } from "./ThemeParts";
import "./styles.css";
export default function StoreFront() {
  const {tenant, active, path, sf} = useKit();
  const picks = [...active.filter(p=>p.is_featured), ...active.filter(p=>!p.is_featured)].filter(p=>p.type!=="internal").slice(0,tenant.featured_limit || 8);
  const image = tenant.banner_url || "/store-assets/variety-editorial-hero-v1.jpg";
  const campaign = <section className="variety-hero"><div className="variety-hero-copy"><span className="variety-kicker">{sf.segment_label || "ÚTIL. BONITO. PARTE DO SEU DIA."}</span><h1>{tenant.hero_tagline || "Boas escolhas.\nTodo dia."}</h1></div><div className="variety-still-life"><img className="variety-hero-image" src={image} alt="Objetos de casa e escritório em composição contemporânea" fetchPriority="high"/><span>O EXTRAORDINÁRIO MORA NOS DETALHES.</span></div><div className="variety-hero-bottom"><p>Pequenas descobertas para a casa, a rotina e quem você gosta.</p><Link className="variety-hero-link" to={path("/catalogo")}>{sf.hero_button_label || "Encontrar boas descobertas"}<ArrowUpRight size={20}/></Link></div></section>;
  return <div className="variety-page variety-home">
    <StoreSEO title={tenant.name} description={tenant.about_text || "Uma seleção de utilidades, presentes e objetos para o dia a dia. A Vitrine Mix reúne pequenas descobertas para organizar a rotina, cuidar da casa e encontrar algo especial."} image={image} siteName={tenant.name} />
    <HeroSlider slides={sf.hero_slides} autoplaySeconds={sf.hero_autoplay_seconds ?? 0} animate={false} resolveUrl={u=>u.startsWith("/")?path(u):u} layout="banner" className="variety-slider" fallback={campaign} />
    <section className="variety-home-selection"><header className="variety-section-heading"><div><span className="variety-kicker">BEM-VINDO À SUA PRÓXIMA DESCOBERTA</span><h2>{sf.home_featured_title || "Encontros do dia a dia."}</h2></div><Link className="variety-text-link" to={path("/catalogo")}>Ver todos os produtos <ArrowRight size={18}/></Link></header>{picks.length ? <div className="variety-grid">{picks.map(p=><VarietyProductCard product={p} key={p.id} />)}</div> : <div className="variety-empty"><h2>Novos produtos estão chegando.</h2><p>Estamos preparando o catálogo. Volte em breve.</p></div>}</section>
    <section className="variety-everyday-note"><span><Package size={28}/></span><h2>Para usar.<br/>Para presentear.<br/>Para fazer parte.</h2><div><p>Uma vitrine para olhar com calma e encontrar objetos que fazem sentido na sua rotina.</p><Link className="variety-text-link" to={path("/sobre")}>Conheça a Vitrine Mix <ArrowUpRight size={18}/></Link></div></section>
  </div>;
}
