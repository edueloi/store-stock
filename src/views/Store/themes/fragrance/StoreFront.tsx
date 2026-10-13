import { Link } from "react-router-dom";
import { ArrowRight, MessageCircle, Sparkles } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import { productImage, useKit, useQuickAdd, whatsappLink } from "./kit";
import { FragranceEmpty, FragranceProductCard, FragranceTrust } from "./parts";
import "./styles.css";

export default function StoreFront() {
  const { tenant, categories, active, path, sf, hidden, wishlist, toggleWishlist, openCart } = useKit();
  const quickAdd = useQuickAdd();
  const featuredAll = active.filter(p=>p.is_featured);
  const featured = (featuredAll.length ? featuredAll : active).slice(0, 8);
  const cats = categories.filter(c=>active.some(p=>p.category_id === c.id)).slice(0, 6);
  const image = tenant.banner_url || productImage(featured[0]);
  const subtitle = tenant.about_text || "Uma seleção especial para acompanhar seus momentos.";
  const wa = whatsappLink(tenant.whatsapp);
  const add = (product: typeof featured[number]) => { const a=quickAdd(product); if(!a.hasOptions && !a.soldOut){a.add();openCart();} };
  return <main className="fragrance-page fr-modern">
    <StoreSEO title={`${tenant.name} | ${sf.segment_label || "Coleção"}`} description={subtitle} image={image} url={typeof window !== "undefined" ? window.location.href : ""} siteName={tenant.name}/>
    <section className="fr-hero"><div className="fr-hero-image">{image && <img src={image} alt=""/>}</div><div className="fr-hero-copy"><p className="fr-overline"><Sparkles size={15}/> {sf.segment_label || tenant.name}</p><h1>{tenant.hero_tagline || "Sua essência, suas escolhas."}</h1><p>{subtitle}</p><div className="fr-hero-actions"><Link to={path("/catalogo")} className="fr-primary">{sf.hero_button_label || "Explorar coleção"}<ArrowRight size={17}/></Link>{wa && <a href={wa} target="_blank" rel="noreferrer" className="fr-secondary"><MessageCircle size={17}/>Fale conosco</a>}</div></div></section>
    {cats.length>0 && <section className="fr-container fr-home-section"><div className="fr-section-heading"><div><p className="fr-overline">Navegue por categorias</p><h2>{sf.home_categories_title || "Encontre o que combina com você"}</h2></div><Link to={path("/catalogo")}>Ver coleção <ArrowRight size={15}/></Link></div><div className="fr-category-grid">{cats.map(c=>{const sample=active.find(p=>p.category_id===c.id);return <Link key={c.id} to={path(`/catalogo?cat=${c.id}`)} className="fr-category"><div>{productImage(sample)?<img src={productImage(sample)} alt="" loading="lazy"/>:<Sparkles size={30}/>}</div><strong>{c.name}</strong><span>Explorar <ArrowRight size={13}/></span></Link>})}</div></section>}
    <section className="fr-featured"><div className="fr-container"><div className="fr-section-heading"><div><p className="fr-overline">Curadoria da loja</p><h2>{sf.home_featured_title || "Produtos em destaque"}</h2></div><Link to={path("/catalogo")}>Ver todos <ArrowRight size={15}/></Link></div>{featured.length?<div className="fr-product-grid">{featured.map((p,i)=><FragranceProductCard key={p.id} product={p} index={i} category={categories.find(c=>c.id===p.category_id)?.name} path={path} saved={wishlist.includes(p.id)} onFavorite={()=>toggleWishlist(p.id)} onAdd={()=>add(p)} hidePrices={hidden}/>)}</div>:<FragranceEmpty/>}</div></section>
    <section className="fr-container fr-home-section"><FragranceTrust/></section>
    <section className="fr-story"><div className="fr-container"><p className="fr-overline">Nossa história</p><h2>{sf.about_title || `Conheça ${tenant.name}`}</h2><p>{tenant.about_text || "Mais que produtos, acreditamos em escolhas com personalidade e atendimento próximo."}</p><Link className="fr-primary" to={path("/sobre")}>Conheça a loja <ArrowRight size={16}/></Link></div></section>
  </main>;
}
