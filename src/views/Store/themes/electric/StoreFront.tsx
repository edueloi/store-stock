import { Link } from "react-router-dom";
import { ArrowRight, ArrowUpRight, MessageCircle, Zap, Puzzle, Package, Heart } from "lucide-react";
import HeroSlider from "../../../../components/store/HeroSlider";
import StoreSEO from "../../../../components/store/StoreSEO";
import { useKit, whatsappLink } from "../street/kit";
import { ProductRow } from "./parts";
import "./styles.css";
export default function StoreFront() {
  const {tenant, active, path, sf} = useKit();
  const picks = [...active.filter(p=>p.is_featured), ...active.filter(p=>!p.is_featured)].filter(p=>p.type!=="internal").slice(0,tenant.featured_limit || 8);
  const image = tenant.banner_url || "/store-assets/electric-editorial-hero-v1.jpg";
  const campaign = <section className="ep-hero"><img className="ep-hero-image" src={image} alt="Interruptores e iluminação em ambiente arquitetônico" fetchPriority="high"/><div className="ep-hero-shade"/><div className="ep-hero-copy"><span className="ep-kicker">{sf.segment_label || "CONEXÕES / MATERIAIS / ILUMINAÇÃO"}</span><h1>{tenant.hero_tagline || "PROJETE.\nCONECTE.\nILUMINE."}</h1><p>Da infraestrutura ao acabamento. Materiais para dar forma ao seu projeto.</p><Link className="ep-hero-link" to={path("/catalogo")}>{sf.hero_button_label || "Explorar materiais"}<ArrowUpRight size={20}/></Link></div><span className="ep-campaign-caption">DETALHES QUE FAZEM A DIFERENÇA.</span></section>;
  return <div className="ep-page ep-home">
    <StoreSEO title={tenant.name} description={tenant.about_text || "Materiais elétricos, acessórios e iluminação em um catálogo para consultar com atenção. Confira medidas, tensão e as informações técnicas de cada item antes de escolher."} image={image} siteName={tenant.name} />
    <HeroSlider slides={sf.hero_slides} autoplaySeconds={sf.hero_autoplay_seconds ?? 0} animate={false} resolveUrl={u=>u.startsWith("/")?path(u):u} layout="banner" className="ep-slider" fallback={campaign} />
    <div className="ep-project-index"><span><Zap size={18}/> SEU PROJETO, PEÇA POR PEÇA.</span><span>CONFIRA AS ESPECIFICAÇÕES ANTES DE ESCOLHER.</span></div>
    <section className="ep-home-selection"><header className="ep-section-heading"><div><span className="ep-kicker">ÍNDICE DE MATERIAIS</span><h2>{sf.home_featured_title || "A base do seu próximo projeto."}</h2></div><Link className="ep-text-link" to={path("/catalogo")}>Ver todos os produtos <ArrowRight size={18}/></Link></header>{picks.length ? <div className="ep-grid">{picks.map(p=><ProductRow product={p} key={p.id} />)}</div> : <div className="ep-empty"><h2>Novos produtos estão chegando.</h2><p>Estamos preparando o catálogo. Volte em breve.</p></div>}</section>
    <section className="ep-project-help"><span className="ep-kicker">DA ESPECIFICAÇÃO À ESCOLHA</span><h2>O detalhe certo<br/>muda o resultado.</h2><p>Consulte tensão, medidas, unidade de venda e disponibilidade na ficha de cada produto. Nossa equipe ajuda a conferir as informações do catálogo.</p><Link className="ep-text-link" to={path("/sobre")}>Fale com a loja <MessageCircle size={18}/></Link></section>
  </div>;
}
