import { useRef } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ArrowUpRight, ChevronLeft, ChevronRight, Heart, MessageCircle, Shirt, Sparkles } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import Hero, { ELO_EDITORIAL, ELO_HERO } from "./Hero";
import { productImage, useKit, whatsappLink } from "./kit";
import { ProductCard } from "./parts";
import "./styles.css";

export default function StoreFront() {
  const { tenant, sf, path, active, categories } = useKit();
  const rail = useRef<HTMLDivElement>(null);
  const featured = [...active.filter((p) => p.is_featured), ...active.filter((p) => !p.is_featured)].slice(0, tenant.featured_limit || 8);
  const collections = categories.filter((category) => active.some((p) => p.category_id === category.id)).slice(0, 4);
  const about = tenant.about_text || "Acreditamos em uma moda que se aproxima de quem você é. Em peças que se encontram, detalhes que fazem diferença e escolhas que acompanham os seus dias.";
  const editorial = tenant.banner_url || sf.hero_slides?.[1]?.image || sf.hero_slides?.[0]?.image || ELO_EDITORIAL;
  const wa = whatsappLink(tenant.whatsapp, `Olá! Gostaria de conhecer a coleção da ${tenant.name}.`);
  const scroll = (direction: number) => rail.current?.scrollBy({ left: direction * rail.current.clientWidth * .8, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  return <div className="els-page els-home">
    <StoreSEO title={`${tenant.name} | Vista a sua essência`} description={about} image={tenant.banner_url || sf.hero_slides?.[0]?.image || ELO_HERO} siteName={tenant.name} url={typeof window !== "undefined" ? window.location.href : ""} />
    <Hero />
    <div className="els-signature"><span>Leveza no vestir.</span><i /><span>Presença no sentir.</span><i /><span>Liberdade para ser.</span></div>
    {collections.length > 0 && <section id="colecao" className="els-wrap els-section"><header className="els-head"><div><span className="els-kicker">Escolhas que se encontram</span><h2>{sf.home_categories_title || "Seu estilo, em cada detalhe."}</h2></div><Link className="els-text-link" to={path("/catalogo")}>Explore as peças <ArrowUpRight size={15} /></Link></header><div className="els-collections">{collections.map((category, index) => {
      const photo = category.cover_url || productImage(active.find((p) => p.category_id === category.id && productImage(p)));
      const count = active.filter((p) => p.category_id === category.id).length;
      return <Link className="els-collection" key={category.id} to={path(`/catalogo?categoria=${category.id}`)}><div className="els-collection-photo">{photo ? <img src={photo} alt="" loading="lazy" /> : <Shirt size={52} strokeWidth={.8} />}<span>0{index + 1}</span></div><div className="els-collection-caption"><span>{category.name}<small>{count} {count === 1 ? "peça para descobrir" : "peças para descobrir"}</small></span><ArrowUpRight size={19} strokeWidth={1} /></div></Link>;
    })}</div></section>}
    <section id="favoritos" className="els-wrap els-section"><header className="els-head"><div><span className="els-kicker">Uma seleção para se apaixonar</span><h2>{sf.home_featured_title || "Seus próximos favoritos."}</h2></div><div className="els-rail-actions"><Link className="els-text-link" to={path("/catalogo")}>Ver toda a coleção <ArrowUpRight size={15} /></Link>{featured.length > 1 && <div><button className="els-round" type="button" aria-label="Peças anteriores" onClick={() => scroll(-1)}><ChevronLeft size={17} /></button><button className="els-round" type="button" aria-label="Próximas peças" onClick={() => scroll(1)}><ChevronRight size={17} /></button></div>}</div></header>{featured.length ? <div className="els-product-rail" ref={rail} role="region" aria-label="Peças em destaque" tabIndex={0}>{featured.map((product) => <ProductCard key={product.id} product={product} />)}</div> : <p className="els-note">Estamos preparando uma nova seleção. Em breve, novas peças por aqui.</p>}</section>
    <section className="els-section"><div className="els-editorial"><div className="els-editorial-image"><img src={editorial} alt="Inspiração de estilo da coleção" loading="lazy" /><span>O seu jeito é o detalhe mais bonito.</span></div><div className="els-editorial-copy"><span className="els-kicker">Muito prazer, sua essência</span><h2>Leve no vestir.<br /><em>Marcante no sentir.</em></h2><p>{about}</p><Link className="els-text-link" to={path("/sobre")}>Conheça a nossa história <ArrowUpRight size={16} /></Link><span className="els-editorial-mark">Feito de escolhas. Vestido de você.</span></div></div></section>
    <section className="els-wrap els-section"><div className="els-details"><article><Shirt size={25} strokeWidth={1} /><h3>Novas combinações</h3><p>Descubra peças para criar o seu próprio jeito de vestir.</p></article><article><Heart size={25} strokeWidth={1} /><h3>Guarde seus favoritos</h3><p>Salve as peças que chamaram sua atenção enquanto explora.</p></article><article><MessageCircle size={25} strokeWidth={1} /><h3>Conte com a gente</h3><p>Converse com a loja para tirar dúvidas sobre as suas escolhas.</p></article></div></section>
    <section className="els-wrap els-section"><div className="els-closing"><span className="els-kicker"><Sparkles size={12} /> Um pouco mais de você</span><h2>Encontre o que faz<br /><em>você se sentir bem.</em></h2><div><Link className="els-btn" to={path("/catalogo")}>Escolha seu próximo favorito <ArrowRight size={16} /></Link>{wa && <a className="els-text-link" href={wa} target="_blank" rel="noreferrer">Falar com a loja <MessageCircle size={15} /></a>}</div></div></section>
  </div>;
}
