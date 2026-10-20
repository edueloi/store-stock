import { Link } from "react-router-dom";
import { ArrowRight, ArrowUpRight, Clock, Coffee, MessageCircle } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import HeroSlider from "../../../../components/store/HeroSlider";
import { hoursLines, useKit, whatsappLink } from "./kit";
import { ProductCard } from "./parts";
import "./styles.css";

export default function StoreFront() {
  const { tenant, categories, active, path, sf } = useKit();
  const featured = [...active.filter(p => p.is_featured), ...active.filter(p => !p.is_featured)].slice(0, tenant.featured_limit || 8);
  const sections = categories.map(category => ({ ...category, count: active.filter(p => p.category_id === category.id).length })).filter(category => category.count).slice(0, 8);
  const image = tenant.banner_url || "/store-assets/coffee-editorial-hero-v1.jpg";
  const about = tenant.about_text || "Cafés, sabores e pequenos encontros para aproveitar o seu tempo.";
  const wa = whatsappLink(tenant.whatsapp, `Olá! Vim pela loja ${tenant.name}.`);
  const hours = hoursLines(tenant.business_hours);
  const campaign = (
    <section className="cf-hero">
      <div className="cf-hero-card">
        <span className="cf-hand"><Coffee size={16} />{sf.segment_label || "CAFÉ, CONVERSA & BOAS PAUSAS"}</span>
        <h1>{tenant.hero_tagline || "A pausa\npede café."}</h1>
        <p>{about}</p>
        <Link className="cf-btn cf-btn-lg" to={path("/catalogo")}>{sf.hero_button_label || "Explorar o cardápio"}<ArrowUpRight size={18} /></Link>
        <span className="cf-hero-signature">Um convite para desacelerar.</span>
      </div>
      <div className="cf-hero-photo"><img src={image} alt="Café em xícara de cerâmica sobre um balcão de madeira, com luz acolhedora" fetchPriority="high" /><span className="cf-photo-label">A SUA PRÓXIMA PAUSA COMEÇA AQUI.</span></div>
    </section>
  );
  return (
    <div className="cf-page cf-home">
      <StoreSEO title={`${tenant.name} | Cafés e sabores`} description={about} image={image} siteName={tenant.name} />
      <HeroSlider slides={sf.hero_slides} autoplaySeconds={sf.hero_autoplay_seconds ?? 0} animate={false} resolveUrl={url => url.startsWith("/") ? path(url) : url} layout="banner" className="cf-slider" fallback={campaign} />
      <div className="cf-ritual-band"><span><Coffee size={19} /> Uma boa xícara.</span><span>Um momento seu.</span><Link to={path("/sobre")}>Conheça a nossa casa <ArrowRight size={17} /></Link></div>
      <section className={`cf-menu-section${sections.length ? "" : " cf-menu-section-full"}`}>
        {sections.length > 0 && <aside className="cf-house-menu" aria-label="Seções do cardápio"><span className="cf-hand">ESCOLHA A SUA PAUSA</span><h2>O cardápio<br /><em>da casa.</em></h2><nav>{sections.map(section => <Link key={section.id} to={path(`/catalogo?categoria=${section.id}`)}><span>{section.name}</span><small>{String(section.count).padStart(2, "0")}</small><ArrowUpRight size={15} /></Link>)}</nav><Link className="cf-menu-all" to={path("/catalogo")}>Ver tudo <ArrowRight size={17} /></Link></aside>}
        <div className="cf-menu-picks"><header className="cf-head cf-head-row"><div><span className="cf-hand">PARA ACOMPANHAR O SEU DIA</span><h2>{sf.home_featured_title || "Uma escolha gostosa."}</h2></div><Link className="cf-text-link" to={path("/catalogo")}>Cardápio completo <ArrowUpRight size={17} /></Link></header>{featured.length ? <div className="cf-list">{featured.map(product => <ProductCard key={product.id} product={product} />)}</div> : <div className="cf-empty"><Coffee size={36} /><h2>O cardápio está sendo preparado.</h2><p>Volte em breve para descobrir os sabores da casa.</p></div>}</div>
      </section>
      <section className="cf-visit-section"><div className="cf-visit"><div><span className="cf-hand">TEMPO PARA O QUE FAZ BEM</span><h2>Fique mais um pouco.<br /><em>O café é só o começo.</em></h2><p>Explore o cardápio e fale com a equipe para combinar os detalhes do seu pedido.</p><div className="cf-actions">{wa ? <a className="cf-btn" href={wa} target="_blank" rel="noreferrer"><MessageCircle size={18} /> Falar com a casa</a> : <Link className="cf-btn" to={path("/sobre")}>Conheça a casa <ArrowUpRight size={18} /></Link>}</div></div>{hours.length > 0 ? <dl className="cf-hours cf-hours-card"><dt className="cf-hours-title"><Clock size={17} /> QUANDO NOS ENCONTRAMOS</dt>{hours.map(hour => <div key={hour.day}><dt>{hour.day}</dt><dd>{hour.text}</dd></div>)}</dl> : <div className="cf-visit-note"><Coffee size={32} /><p>Entre uma coisa e outra,<br />cabe uma boa pausa.</p><span>CAFÉ • SABORES • ENCONTROS</span></div>}</div></section>
    </div>
  );
}
