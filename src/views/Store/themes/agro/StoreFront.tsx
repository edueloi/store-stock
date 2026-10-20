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

  const image = tenant.banner_url || "/store-assets/agro-editorial-hero-v1.jpg";
  const wa = whatsappLink(tenant.whatsapp, `Olá! Preciso de ajuda com os produtos da ${tenant.name}.`);
  const campaign = <section className="agro-hero">
    <div className="agro-hero-copy"><span className="agro-kicker">{sf.segment_label || "PARCEIRA DE QUEM PRODUZ"}</span><h1>{tenant.hero_tagline || "A FORÇA\nDO CAMPO."}</h1><p>Da primeira semente ao trabalho de todo dia. Encontre o que a sua propriedade precisa.</p><Link className="agro-hero-link" to={path("/catalogo")}>{sf.hero_button_label || "Explorar o campo"}<ArrowUpRight size={20} /></Link><span className="agro-campaign-stamp"><Tractor size={22} /> CULTIVAR. CUIDAR. PRODUZIR.</span></div>
    <img className="agro-hero-image" src={image} alt="Plantação e trator em uma fazenda ao amanhecer" fetchPriority="high" /><span className="agro-hero-caption">{tenant.name} / FEITA PARA O CAMPO</span>
  </section>;
  return <div className="agro-page agro-home">
    <StoreSEO title={tenant.name} description={tenant.about_text || "Insumos, ferramentas e cuidados para a sua propriedade."} image={image} siteName={tenant.name} />
    <HeroSlider slides={sf.hero_slides} autoplaySeconds={sf.hero_autoplay_seconds ?? 0} animate={false} resolveUrl={resolve} layout="banner" className="agro-slider" fallback={campaign} />
    <div className="agro-field-strip"><span><Wheat size={22} /> DA ROTINA À SAFRA</span><span>PRODUTOS PARA QUEM FAZ ACONTECER</span><ArrowUpRight size={26} aria-hidden="true" /></div>
    <section className="agro-home-selection"><header className="agro-section-heading"><div><span className="agro-kicker">01 / EQUIPAR A PROPRIEDADE</span><h2>{sf.home_featured_title || "Prontos para o trabalho."}</h2></div><Link className="agro-text-link" to={path("/catalogo")}>Ver todos os produtos <ArrowRight size={18} /></Link></header>
    {picks.length ? <div className="agro-grid">{picks.map(p => <Card key={p.id} product={p} />)}</div> : <div className="agro-empty"><h2>Novos produtos estão chegando.</h2><p>Estamos preparando o catálogo. Volte em breve.</p></div>}</section>
    <section className="agro-field-note"><span className="agro-field-number" aria-hidden="true">02</span><div><span className="agro-kicker">GENTE QUE ENTENDE A SUA ROTINA.</span><h2>Seu trabalho não para.<br />A gente está por perto.</h2><p>Confira as informações dos produtos e fale com a loja para encontrar o que combina com a sua propriedade.</p></div>{wa ? <a className="agro-hero-link" href={wa} target="_blank" rel="noreferrer">Falar com a equipe <MessageCircle size={18} /></a> : <Link className="agro-hero-link" to={path("/sobre")}>Conheça a loja <ArrowRight size={18} /></Link>}</section>
  </div>;
}
