import { useRef } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ArrowUpRight, ChevronLeft, ChevronRight, Gift, Heart, MessageCircle, PackageCheck, ShoppingBag, Sparkles, Wine } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import Hero, { BRISA_HERO, BRISA_MOMENT } from "./Hero";
import { productImage, useKit, whatsappLink } from "./kit";
import { ProductCard } from "./parts";
import "./styles.css";

export default function StoreFront() {
  const { tenant, active, categories, sf, path } = useKit();
  const rail = useRef<HTMLDivElement>(null);
  const featured = [...active.filter((p) => p.is_featured), ...active.filter((p) => !p.is_featured)].slice(0, tenant.featured_limit || 8);
  const cats = categories.filter((category) => active.some((p) => p.category_id === category.id)).slice(0, 6);
  const about = tenant.about_text || "Acreditamos que um bom brinde transforma encontros em memórias. Por isso, reunimos bebidas e conveniências para acompanhar a vida como ela acontece.";
  const wa = whatsappLink(tenant.whatsapp, `Olá! Vim pela loja ${tenant.name}.`);
  const photo = tenant.banner_url || sf.hero_slides?.[1]?.image || sf.hero_slides?.[0]?.image || BRISA_MOMENT;
  const scroll = (direction: number) => rail.current?.scrollBy({ left: direction * rail.current.clientWidth * .8, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  return <div className="brs-page brs-home">
    <StoreSEO title={`${tenant.name} | Bons encontros, melhores brindes`} description={about} image={tenant.banner_url || sf.hero_slides?.[0]?.image || BRISA_HERO} siteName={tenant.name} url={typeof window !== "undefined" ? window.location.href : ""} />
    <Hero />
    <div className="brs-promise"><div className="brs-wrap"><span><Wine size={19} strokeWidth={1.3} /> Uma seleção para cada ocasião</span><span><ShoppingBag size={19} strokeWidth={1.3} /> Seu pedido de um jeito simples</span><span><MessageCircle size={19} strokeWidth={1.3} /> Atendimento direto com a adega</span></div></div>
    {cats.length > 0 && <section className="brs-wrap brs-section brs-category-section"><header className="brs-head"><div><span className="brs-kicker">Escolha o seu momento</span><h2>{sf.home_categories_title || "O que vamos abrir hoje?"}</h2></div><Link className="brs-text-link" to={path("/catalogo")}>Explore o catálogo <ArrowUpRight size={17} /></Link></header><div className="brs-category-grid">{cats.map((category) => {
      const image = category.cover_url || productImage(active.find((p) => p.category_id === category.id && productImage(p)));
      return <Link className={`brs-category-card ${category.cover_url ? "has-cover" : ""}`} key={category.id} to={path(`/catalogo?categoria=${category.id}`)}><span className="brs-category-photo">{image ? <img src={image} alt="" loading="lazy" /> : <Wine size={42} strokeWidth={1.2} />}</span><span className="brs-category-label">{category.name}<ArrowUpRight size={14} /></span></Link>;
    })}</div></section>}
    <section id="selecao" className="brs-wrap brs-section"><header className="brs-head"><div><span className="brs-kicker"><Sparkles size={12} /> Boas escolhas começam aqui</span><h2>{sf.home_featured_title || "Os queridinhos da casa"}</h2><p>Para descobrir, compartilhar e repetir.</p></div><div className="brs-rail-actions"><Link className="brs-text-link" to={path("/catalogo")}>Ver toda a seleção <ArrowUpRight size={16} /></Link>{featured.length > 1 && <div><button className="brs-round" type="button" aria-label="Produtos anteriores" onClick={() => scroll(-1)}><ChevronLeft size={17} /></button><button className="brs-round" type="button" aria-label="Próximos produtos" onClick={() => scroll(1)}><ChevronRight size={17} /></button></div>}</div></header>{featured.length ? <div className="brs-product-rail" ref={rail} role="region" aria-label="Produtos em destaque" tabIndex={0}>{featured.map((p) => <ProductCard key={p.id} product={p} />)}</div> : <p className="brs-note">Estamos preparando uma seleção especial. Em breve, novidades por aqui.</p>}</section>
    <section className="brs-wrap brs-section"><div className="brs-story"><div className="brs-story-visual"><img src={photo} alt="Bebidas e detalhes para um bom encontro" loading="lazy" /><span><Heart size={15} /> Feito para compartilhar.</span></div><div className="brs-story-copy"><span className="brs-kicker">Muito prazer, sua adega</span><h2>Todo dia pode ter<br />um motivo para<br /><em>celebrar.</em></h2><p>{about}</p><Link className="brs-text-link" to={path("/sobre")}>Conheça a nossa história <ArrowUpRight size={17} /></Link><div className="brs-story-detail"><Gift size={23} strokeWidth={1.3} /><p>Do encontro casual à ocasião especial.<br /><strong>Encontre o sabor do seu momento.</strong></p></div></div></div></section>
    <section className="brs-wrap brs-section"><header className="brs-head brs-head-center"><span className="brs-kicker">Simples como um bom encontro</span><h2>Seu próximo brinde, em poucos passos.</h2></header><div className="brs-steps"><article><span>01</span><Wine size={25} strokeWidth={1.2} /><h3>Encontre seu favorito</h3><p>Navegue pelas categorias e descubra o que combina com você.</p></article><article><span>02</span><ShoppingBag size={25} strokeWidth={1.2} /><h3>Monte a sua sacola</h3><p>Escolha seus produtos e ajuste as quantidades do seu jeito.</p></article><article><span>03</span><PackageCheck size={25} strokeWidth={1.2} /><h3>Combine com a gente</h3><p>Confira os detalhes de pagamento e entrega ao fechar o pedido.</p></article></div></section>
    <section className="brs-wrap brs-section"><div className="brs-invite"><Sparkles size={32} strokeWidth={1.1} /><div><span className="brs-kicker">A boa companhia você já tem</span><h2>O próximo brinde está por aqui.</h2><p>Descubra a seleção e escolha o que vai à mesa.</p></div><div><Link className="brs-btn brs-btn-white" to={path("/catalogo")}>Vamos escolher? <ArrowRight size={17} /></Link>{wa && <a href={wa} target="_blank" rel="noreferrer">Fale com a adega <MessageCircle size={14} /></a>}</div></div></section>
  </div>;
}
