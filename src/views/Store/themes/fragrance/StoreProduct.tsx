import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Check, Heart, Minus, Plus, ShoppingBag, MessageCircle } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import StockAvailability from "../../../../components/store/StockAvailability";
import { parseProductIdFromRoute } from "../../store-routing";
import { priceInfo, useBuy, useKit, useQuickAdd, whatsappLink } from "./kit";
import { FragranceProductCard } from "./parts";
import "./styles.css";

export default function StoreProduct(){
  const { productId }=useParams();
  const { tenant, products, categories, path, hidden, wishlist, toggleWishlist, active, sf, openCart }=useKit();
  const product=products.find(p=>p.id===parseProductIdFromRoute(productId) && p.is_active);
  const buy=useBuy(product);
  const quickAdd=useQuickAdd();
  if(!product) return <main className="fragrance-page fr-modern fr-not-found"><h1>Produto não encontrado</h1><Link className="fr-primary" to={path("/catalogo")}>Voltar à coleção</Link></main>;
  const category=categories.find(c=>c.id===product.category_id);
  const price=priceInfo(product,hidden);
  const liked=wishlist.includes(product.id);
  const wa=whatsappLink(tenant.whatsapp,`Olá! Tenho interesse em ${product.name}.`);
  const related=active.filter(p=>p.id!==product.id && p.category_id===product.category_id).slice(0,4);
  const more=related.length?related:active.filter(p=>p.id!==product.id).slice(0,4);
  return <main className="fragrance-page fr-modern">
    <StoreSEO title={`${product.name} | ${tenant.name}`} description={product.description || product.name} image={buy.gallery[0]} type="product" price={hidden?undefined:String(product.discount_price??product.price)} url={typeof window!=="undefined"?window.location.href:""} siteName={tenant.name}/>
    <div className="fr-container fr-product-page"><nav className="fr-breadcrumb"><Link to={path()}>Início</Link><span>/</span><Link to={path("/catalogo")}>Coleção</Link>{category&&<><span>/</span><Link to={path(`/catalogo?cat=${category.id}`)}>{category.name}</Link></>}</nav>
      <div className="fr-product-detail"><section className="fr-gallery" aria-label="Galeria de fotos"><div className="fr-main-photo">{buy.gallery.length?<img src={buy.gallery[buy.photo]||buy.gallery[0]} alt={product.name}/>:<ShoppingBag size={50}/>} {price.off&&<span className="fr-offer">Oferta</span>}</div>{buy.gallery.length>1&&<div className="fr-thumbnails">{buy.gallery.map((src,i)=><button key={`${src}-${i}`} aria-label={`Ver imagem ${i+1}`} aria-pressed={buy.photo===i} onClick={()=>buy.setPhoto(i)}><img src={src} alt=""/></button>)}</div>}</section>
        <section className="fr-purchase"><p className="fr-overline">{category?.name || sf.segment_label || "Coleção"}</p><div className="fr-product-title"><h1>{product.name}</h1><button aria-label={liked?"Remover dos favoritos":"Adicionar aos favoritos"} aria-pressed={liked} onClick={()=>toggleWishlist(product.id)}><Heart size={21} fill={liked?"currentColor":"none"}/></button></div>{product.sku&&<p className="fr-sku">Referência: {product.sku}</p>}<div className="fr-product-price"><strong>{price.now}</strong>{price.old&&<s>{price.old}</s>}</div>{product.description&&<p className="fr-product-description">{product.description}</p>}
          {buy.groups.map(g=><fieldset className="fr-variant" key={g.name}><legend>{g.name} <span>{buy.selected[g.name]||"Selecione uma opção"}</span></legend><div>{g.values.map(v=><button key={v} className={buy.selected[g.name]===v?"selected":""} aria-pressed={buy.selected[g.name]===v} onClick={()=>buy.setSelected(s=>({...s,[g.name]:v}))}>{buy.selected[g.name]===v&&<Check size={14}/>} {v}</button>)}</div></fieldset>)}
          <StockAvailability product={product} tenant={tenant} selected={buy.ready?buy.selected:undefined} className="fr-stock"/>

          {!buy.ready&&<p className="fr-option-hint">Escolha as opções do produto para adicionar ao pedido.</p>}
          <div className="fr-checkout-row"><div className="fr-quantity"><button aria-label="Diminuir quantidade" disabled={buy.qty<=1} onClick={()=>buy.setQty(q=>Math.max(1,q-1))}><Minus size={17}/></button><output>{buy.qty}</output><button aria-label="Aumentar quantidade" disabled={buy.qty>=buy.maxQty} onClick={()=>buy.setQty(q=>Math.min(buy.maxQty||1,q+1))}><Plus size={17}/></button></div><button className="fr-primary fr-add" disabled={!buy.canAdd} onClick={buy.add}><ShoppingBag size={18}/>{buy.soldOut?"Esgotado":hidden?"Adicionar ao pedido":"Adicionar à sacola"}</button></div>
          {buy.added&&<div className="fr-added" role="status"><Check size={18}/> Produto adicionado. <button onClick={openCart}>Ver pedido <ArrowLeft size={14}/></button></div>}
          {wa&&<a className="fr-contact" href={wa} target="_blank" rel="noreferrer"><MessageCircle size={17}/> Tire suas dúvidas pelo WhatsApp</a>}
        </section></div>
      {more.length>0&&<section className="fr-related"><div className="fr-section-heading"><div><p className="fr-overline">Continue explorando</p><h2>Você também pode gostar</h2></div><Link to={path("/catalogo")}>Ver coleção</Link></div><div className="fr-product-grid">{more.map((p,i)=><FragranceProductCard key={p.id} product={p} index={i} path={path} category={categories.find(c=>c.id===p.category_id)?.name} saved={wishlist.includes(p.id)} onFavorite={()=>toggleWishlist(p.id)} onAdd={()=>{const action=quickAdd(p);if(!action.hasOptions&&!action.soldOut){action.add();openCart();}}} hidePrices={hidden}/>)}</div></section>}
    </div>
  </main>;
}
