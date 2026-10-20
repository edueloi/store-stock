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

  const image = tenant.banner_url || "/store-assets/feed-editorial-hero-v1.jpg";
  const campaign = <section className="feed-hero"><div className="feed-hero-copy"><span className="feed-kicker">{sf.segment_label || "NUTRIÇÃO, ROTINA & COMPANHIA"}</span><h1>{tenant.hero_tagline || "Cuidar bem.\nEm cada porção."}</h1><p>Alimentação e cuidados para os animais que fazem parte da sua vida.</p><Link className="feed-hero-link" to={path("/catalogo")}>{sf.hero_button_label || "Explorar os cuidados"}<ArrowRight size={18} /></Link></div><div className="feed-campaign-photo"><img className="feed-hero-image" src={image} alt="Ração e grãos em bancada de madeira com cavalo ao fundo" fetchPriority="high" /><span className="feed-photo-label">DO RANCHO. PARA A SUA ROTINA.</span></div></section>;
  return <div className="feed-page feed-home">
    <StoreSEO title={tenant.name} description={tenant.about_text || "Alimentação e cuidado para pets e animais de criação."} image={image} siteName={tenant.name} />
    <HeroSlider slides={sf.hero_slides} autoplaySeconds={sf.hero_autoplay_seconds ?? 0} animate={false} resolveUrl={resolve} layout="banner" className="feed-slider" fallback={campaign} />
    <section className="feed-home-selection"><header className="feed-section-heading"><span className="feed-kicker">A DESPENSA DOS SEUS ANIMAIS</span><h2>{sf.home_featured_title || "Nutrição que faz parte do dia."}</h2><Link className="feed-text-link" to={path("/catalogo")}>Ver todos os produtos <ArrowRight size={16} /></Link></header>
    {picks.length ? <div className="feed-grid">{picks.map(p => <Card key={p.id} product={p} />)}</div> : <div className="feed-empty"><h2>Novos produtos estão chegando.</h2><p>Estamos preparando o catálogo. Volte em breve.</p></div>}</section>
    <section className="feed-choice-guide"><header><span className="feed-kicker">CUIDADO COMEÇA NA ESCOLHA</span><h2>O que olhar<br />antes de levar?</h2><Link className="feed-text-link" to={path("/sobre")}>Converse com a loja <ArrowUpRight size={18} /></Link></header><div className="feed-guide-steps">{[
      ["01", "Para qual animal?", "Confira a espécie e a fase de vida indicadas na embalagem."],
      ["02", "Na medida da sua rotina.", "Compare as apresentações e a quantidade de cada produto."],
      ["03", "Informação vem primeiro.", "Leia o rótulo e confirme os detalhes com a equipe antes de comprar."],
    ].map(([number,title,text]) => <article key={number}><span>{number}</span><div><h3>{title}</h3><p>{text}</p></div></article>)}</div></section>
  </div>;
}
