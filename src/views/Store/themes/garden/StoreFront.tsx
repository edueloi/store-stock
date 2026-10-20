import { Link } from "react-router-dom";
import { ArrowRight, ArrowUpRight, MessageCircle, Leaf, Tractor, Wheat, Sprout } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import HeroSlider from "../../../../components/store/HeroSlider";
import { useKit } from "./kit";
import { whatsappLink } from "./extras";
import { Card } from "./parts";
import "./styles.css";

export default function StoreFront() {
  const { tenant, active, path, config: sf } = useKit();
  const picks = [...active.filter(p => p.is_featured), ...active.filter(p => !p.is_featured)].slice(0, tenant.featured_limit || 8);
  const resolve = (url: string) => { if (!url.startsWith("/")) return url; const [part, query] = url.split("?"); return path(part, Object.fromEntries(new URLSearchParams(query))); };

  const image = tenant.banner_url || "/store-assets/garden-editorial-hero-v1.jpg";
  const campaign = <section className="garden-hero"><img className="garden-hero-image" src={image} alt="Ervas e mudas em vasos de terracota sobre bancada de cultivo" fetchPriority="high" /><div className="garden-hero-copy"><span className="garden-kicker">{sf.segment_label || "A VIDA PEDE MAIS VERDE"}</span><h1>{tenant.hero_tagline || "Para cultivar.\nPara viver."}</h1><p>Pequenos começos, novas folhas. Descubra o que faz o seu jardim crescer.</p><Link className="garden-hero-link" to={path("/catalogo")}>{sf.hero_button_label || "Explorar o jardim"}<ArrowUpRight size={18} /></Link></div><span className="garden-hero-caption">HORTA / CASA / JARDIM</span></section>;
  return <div className="garden-page garden-home">
    <StoreSEO title={tenant.name} description={tenant.about_text || "Plantas, sementes e ferramentas para cultivar os seus espaços."} image={image} siteName={tenant.name} />
    <HeroSlider slides={sf.hero_slides} autoplaySeconds={sf.hero_autoplay_seconds ?? 0} animate={false} resolveUrl={resolve} layout="banner" className="garden-slider" fallback={campaign} />
    <section className="garden-home-selection"><header className="garden-section-heading"><span className="garden-kicker"><Sprout size={17} /> DA NOSSA SELEÇÃO PARA O SEU ESPAÇO</span><div><h2>{sf.home_featured_title || "Deixe a vida florescer."}</h2><Link className="garden-text-link" to={path("/catalogo")}>Ver todos os produtos <ArrowRight size={16} /></Link></div></header>
    {picks.length ? <div className="garden-grid">{picks.map(p => <Card key={p.id} product={p} />)}</div> : <div className="garden-empty"><h2>Novos produtos estão chegando.</h2><p>Estamos preparando o catálogo. Volte em breve.</p></div>}</section>
    <section className="garden-journal"><div className="garden-journal-photo"><img src={image} alt="Detalhes de uma bancada de cultivo" loading="lazy" /><span>O PRAZER DE CULTIVAR</span></div><div className="garden-journal-copy"><Leaf size={30} strokeWidth={1} /><span className="garden-kicker">MAIS TEMPO PERTO DO VERDE.</span><h2>Um jardim começa<br />nos detalhes.</h2><p>Uma muda, um vaso, um novo canto da casa. Encontre ferramentas e cuidados para fazer parte desse começo.</p><Link className="garden-text-link" to={path("/sobre")}>Conheça nossa história <ArrowUpRight size={18} /></Link></div></section>
  </div>;
}
