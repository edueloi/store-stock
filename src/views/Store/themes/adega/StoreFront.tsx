import { useRef } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ArrowUpRight, ChevronLeft, ChevronRight, GlassWater, MessageCircle, Moon, PackageCheck, ShoppingBag, Snowflake, Wine } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import Hero, { ADEGA_HERO, ADEGA_WINE } from "./Hero";
import { productImage, useKit, whatsappLink } from "./kit";
import { ProductCard } from "./parts";
import "./styles.css";

export default function StoreFront() {
  const { tenant, categories, active, path, sf } = useKit();
  const rail = useRef<HTMLDivElement>(null);
  const featured = [...active.filter((p) => p.is_featured), ...active.filter((p) => !p.is_featured)].slice(0, tenant.featured_limit || 8);
  const cats = categories.filter((c) => active.some((p) => p.category_id === c.id)).slice(0, 6);
  const about = tenant.about_text || "Bebidas geladas, gelo e conveniência para os seus melhores momentos.";
  const wa = whatsappLink(tenant.whatsapp, `Olá! Vim pela loja ${tenant.name}.`);
  const scrollProducts = (direction: number) => rail.current?.scrollBy({ left: direction * rail.current.clientWidth * 0.8, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });

  return (
    <div className="adg-page adg-home">
      <StoreSEO title={`${tenant.name} | A sua noite começa aqui`} description={about} image={tenant.banner_url || sf.hero_slides?.[0]?.image || ADEGA_HERO} url={typeof window !== "undefined" ? window.location.href : ""} siteName={tenant.name} />
      <Hero />
      <div className="adg-benefits"><div className="adg-wrap adg-benefit-grid">
        <div><Snowflake size={23} strokeWidth={1.4} /><span><strong>No ponto para brindar</strong><small>Bebidas para todos os momentos</small></span></div>
        <div><ShoppingBag size={23} strokeWidth={1.4} /><span><strong>Escolha sem complicação</strong><small>Seu pedido em poucos toques</small></span></div>
        <div><PackageCheck size={23} strokeWidth={1.4} /><span><strong>Além da bebida</strong><small>Confira nossa conveniência</small></span></div>
        <div><MessageCircle size={23} strokeWidth={1.4} /><span><strong>Atendimento de verdade</strong><small>Fale diretamente com a adega</small></span></div>
      </div></div>

      {cats.length > 0 && <section className="adg-wrap adg-section adg-category-section">
        <header className="adg-head"><div><span className="adg-kicker">Cada momento tem seu sabor</span><h2>{sf.home_categories_title || "Qual é a boa de hoje?"}</h2></div><Link className="adg-link" to={path("/catalogo")}>Todas as categorias <ArrowUpRight size={17} /></Link></header>
        <div className="adg-category-grid">{cats.map((category, index) => {
          const photo = category.cover_url || productImage(active.find((p) => p.category_id === category.id && productImage(p)));
          return <Link key={category.id} className={`adg-category-card ${category.cover_url ? "has-cover" : ""}`} to={path(`/catalogo?categoria=${category.id}`)}>
            <span className="adg-category-number">0{index + 1}</span>
            <div className="adg-category-photo">{photo ? <img src={photo} alt="" loading="lazy" /> : <Wine size={46} strokeWidth={1} />}</div>
            <span className="adg-category-label">{category.name}<ArrowUpRight size={17} /></span>
          </Link>;
        })}</div>
      </section>}

      <section id="selecao" className="adg-wrap adg-section adg-featured">
        <header className="adg-head"><div><span className="adg-kicker"><span className="adg-live-dot" /> A seleção da casa</span><h2>{sf.home_featured_title || "Favoritos da noite"}</h2><p>Escolha o seu. A gente cuida do próximo brinde.</p></div><div className="adg-rail-actions"><Link className="adg-link" to={path("/catalogo")}>Ver cardápio <ArrowUpRight size={17} /></Link>{featured.length > 1 && <div><button type="button" className="adg-round" aria-label="Produtos anteriores" onClick={() => scrollProducts(-1)}><ChevronLeft size={19} /></button><button type="button" className="adg-round" aria-label="Próximos produtos" onClick={() => scrollProducts(1)}><ChevronRight size={19} /></button></div>}</div></header>
        {featured.length ? <div className="adg-product-rail" ref={rail} role="region" aria-label="Produtos em destaque" tabIndex={0}>{featured.map((p) => <ProductCard key={p.id} product={p} />)}</div> : <p className="adg-note">Estamos preparando nossa seleção. Em breve, novidades por aqui.</p>}
        {featured.length > 1 && <p className="adg-rail-hint">Deslize para descobrir mais <ArrowRight size={14} /></p>}
      </section>

      <section className="adg-wrap adg-section"><div className="adg-editorial">
        <div className="adg-editorial-photo"><img src={tenant.banner_url || sf.hero_slides?.[1]?.image || sf.hero_slides?.[0]?.image || ADEGA_WINE} alt="Seleção de bebidas da adega" loading="lazy" /><span><Moon size={17} /> O encontro começa aqui.</span></div>
        <div className="adg-editorial-copy"><span className="adg-kicker">Muito além de uma adega</span><h2>Tem noites que<br />merecem ficar<br /><em>na memória.</em></h2><p>{about}</p><p>Do encontro de última hora à ocasião especial, encontre aqui o que combina com você.</p><Link className="adg-btn adg-btn-ghost" to={path("/sobre")}>Conheça a nossa história <ArrowUpRight size={17} /></Link><div className="adg-editorial-stamp"><GlassWater size={26} strokeWidth={1.3} /><span>Boa companhia.<br /><strong>O resto, deixa com a gente.</strong></span></div></div>
      </div></section>

      <section className="adg-wrap adg-section"><div className="adg-night-cta"><div className="adg-night-icon"><Moon size={32} strokeWidth={1.2} /></div><div><span className="adg-kicker">Sua noite, do seu jeito</span><h2>Já sabe o que vai pedir?</h2><p>Monte sua sacola ou converse com a gente.</p></div><div className="adg-night-buttons"><Link className="adg-btn" to={path("/catalogo")}>Escolher minhas bebidas <ArrowRight size={17} /></Link>{wa && <a className="adg-link" href={wa} target="_blank" rel="noreferrer"><MessageCircle size={17} /> Falar com a adega</a>}</div></div></section>
    </div>
  );
}
