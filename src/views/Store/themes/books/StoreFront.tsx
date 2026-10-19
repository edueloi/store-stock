import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import HeroSlider from "../../../../components/store/HeroSlider";
import { useKit } from "./kit";
import { BookCard } from "./parts";
import "./styles.css";

export default function StoreFront() {
  const { tenant, active, path, sf } = useKit();
  const featured = [...active.filter(p => p.is_featured), ...active.filter(p => !p.is_featured)].slice(0, tenant.featured_limit || 8);
  const image = tenant.banner_url || "/store-assets/books-editorial-hero-v1.jpg";
  const title = tenant.hero_tagline || "Uma pausa.\nMuitas histórias.";
  const fallback = <section className="bk-hero">
    <img className={`bk-hero-image${tenant.banner_url ? "" : " bk-hero-default"}`} src={image} alt={tenant.banner_url ? `Campanha da ${tenant.name}` : "Campanha de livraria com livros de capa em tecido e livro aberto sobre mesa de madeira"} fetchPriority="high" />
    <div className="bk-hero-shade" />
    <div className="bk-hero-copy">
      <span className="bk-kicker">{sf.segment_label || "LIVRARIA & CULTURA"}</span>
      <h1>{title}</h1>
      <p>Livros para descobrir outras ideias, viver novas histórias e encontrar o seu tempo.</p>
      <Link className="bk-hero-link" to={path("/catalogo")}>{sf.hero_button_label || "Explorar a estante"}<ArrowRight size={18} /></Link>
    </div>
    <span className="bk-hero-caption">{tenant.name} / A coleção</span>
  </section>;
  return <div className="bk-page bk-home">
    <StoreSEO title={`${tenant.name} | Livraria & Cultura`} description={tenant.about_text || "Uma seleção de livros e cultura para quem valoriza o tempo de uma boa leitura. Reunimos histórias, ideias e descobertas para fazer parte da sua estante e acompanhar diferentes momentos da sua vida."} image={image} url={typeof window !== "undefined" ? window.location.href : ""} siteName={tenant.name} />
    <HeroSlider slides={sf.hero_slides} autoplaySeconds={sf.hero_autoplay_seconds ?? 0} animate={false} resolveUrl={u => u.startsWith("/") ? path(u) : u} layout="banner" className="bk-slider" fallback={fallback} />
    <section className="bk-home-selection">
      <header className="bk-section-heading"><div><span className="bk-kicker">ESCOLHIDOS PARA VOCÊ</span><h2>{sf.home_featured_title || "Leituras para descobrir"}</h2></div><Link className="bk-text-link" to={path("/catalogo")}>Ver toda a coleção <ArrowRight size={16} /></Link></header>
      {featured.length ? <div className="bk-grid bk-grid-feature">{featured.map(p => <BookCard key={p.id} product={p} />)}</div> : <div className="bk-empty"><h2>Uma nova coleção está chegando.</h2><p>Estamos preparando a seleção. Volte em breve.</p></div>}
    </section>
    <section className="bk-brand-note"><span className="bk-kicker">O TEMPO DE UMA BOA HISTÓRIA.</span><h2>Abra um livro.<br />Encontre novos caminhos.</h2><Link className="bk-text-link" to={path("/sobre")}>Conheça nossa história <ArrowRight size={16} /></Link></section>
  </div>;
}
