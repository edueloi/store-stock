import { useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check, ChevronDown, Heart, Loader2, MessageCircle, Minus, Plus, ShieldCheck, Shirt, ShoppingBag, Truck } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import { parseProductIdFromRoute } from "../../store-routing";
import { useBuy, useKit, priceInfo, money, whatsappLink } from "../street/kit";
import { ProductCard } from "../street/shared";
import { cepMask } from "./StoreCheckout";
import "./styles.css";
import "./product.css";

export default function StoreProduct() {
  const kit=useKit(), {productId}=useParams();
  const product=kit.active.find(product=>product.id===parseProductIdFromRoute(productId));
  const buy=useBuy(product), navigate=useNavigate();
  const [cep,setCep]=useState(""),[delivery,setDelivery]=useState<string|null>(null),[calculating,setCalculating]=useState(false);
  if(!product)return <div className="sr-page sr-checkout-empty"><Shirt size={42}/><h1>Peça indisponível.</h1><p>Explore a coleção para encontrar seu próximo favorito.</p><Link to={kit.path("/catalogo")} className="sr-btn sr-btn-solid">Voltar ao catálogo</Link></div>;
  const price=priceInfo(product,kit.hidden), favorite=kit.wishlist.includes(product.id);
  const support=whatsappLink(kit.tenant.whatsapp,`Olá! Tenho uma dúvida sobre ${product.name}.`);
  const missing=buy.groups.filter(group=>!buy.selected[group.name]).map(group=>group.name);
  const related=kit.active.filter(item=>item.id!==product.id && item.category_id===product.category_id).slice(0,4);
  const online=kit.sf.checkout_mode === "online" && !kit.hidden;
  const quote=async(event:FormEvent)=>{
    event.preventDefault();if(calculating)return;setCalculating(true);setDelivery(null);
    try{
      const response=await fetch("/api/public/store-checkout/details",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({tenantId:kit.tenant.id,cep})});
      const data=await response.json();if(!response.ok)throw new Error(data.error);
      setDelivery(data.delivery.delivery_available ? `${Number(data.delivery.delivery_fee)>0 ? `Entrega: ${money(data.delivery.delivery_fee)}` : "Entrega grátis"}${data.delivery.delivery_zone ? ` · ${data.delivery.delivery_zone}` : ""}. O prazo será combinado com a loja.` : `${data.delivery.delivery_enabled ? "Este CEP não está na área de entrega." : "A loja não oferece entrega neste momento."}${data.delivery.pickup_available ? " Retirada disponível na loja, sem custo." : " Fale com a equipe."}`);
    }catch(error){setDelivery(error instanceof Error ? error.message : "Não foi possível calcular a entrega agora.");}
    finally{setCalculating(false);}
  };
  const buyNow=()=>{if(!buy.canAdd)return;buy.add();kit.closeCart();navigate(kit.path("/checkout"));};
  return <div className="sr-page sr-product sr-product-commerce">
    <StoreSEO title={`${product.name} | ${kit.tenant.name}`} description={product.description || product.name} image={buy.gallery[0]} type="product" price={kit.hidden ? undefined : String(Number(product.discount_price)>0 ? product.discount_price : product.price)} siteName={kit.tenant.name}/>
    <nav className="sr-crumbs" aria-label="Você está em"><Link to={kit.path("/catalogo")}><ArrowLeft size={12}/> Coleção</Link>{kit.catName(product) && <><span>/</span><Link to={kit.path(`/catalogo?categoria=${product.category_id}`)}>{kit.catName(product)}</Link></>}</nav>
    <div className="sr-commerce-product-grid"><section className="sr-commerce-gallery" aria-label="Fotos do produto"><div className="sr-commerce-main-photo">{buy.gallery.length ? <img src={buy.gallery[buy.photo] || buy.gallery[0]} alt={product.name} fetchPriority="high"/> : <Shirt size={90}/>}<button type="button" className="sr-product-favorite" aria-label={favorite ? `Remover ${product.name} dos favoritos` : `Favoritar ${product.name}`} aria-pressed={favorite} onClick={()=>kit.toggleWishlist(product.id)}><Heart size={21} fill={favorite ? "currentColor" : "none"}/></button>{price.off && <span className="sr-product-off">{Math.round((1-Number(product.discount_price)/Number(product.price))*100)}% OFF</span>}</div>{buy.gallery.length>1 && <div className="sr-commerce-thumbnails">{buy.gallery.map((image,index)=><button type="button" key={`${image}-${index}`} onClick={()=>buy.setPhoto(index)} aria-label={`Ver foto ${index+1}`} aria-pressed={buy.photo===index}><img src={image} alt=""/></button>)}</div>}</section>
    <section className="sr-commerce-buy"><span className="sr-eyebrow">{kit.catName(product) || "SEU PRÓXIMO FAVORITO"}</span><h1>{product.name}</h1>{product.sku && <p className="sr-product-code">REF. {product.sku}</p>}<div className="sr-commerce-price">{kit.hidden ? <strong>Valor sob consulta</strong> : <>{price.old && <del>{price.old}</del>}<strong>{price.now}</strong></>}<span>{online ? "Escolha suas opções e finalize pela loja." : "Confira as condições de compra com a loja."}</span></div>
    {buy.groups.map(group=><fieldset key={group.name} className="sr-product-options"><legend>{group.name}{buy.selected[group.name] && <strong> / {buy.selected[group.name]}</strong>}</legend><div>{group.values.map(value=><button type="button" key={value} aria-pressed={buy.selected[group.name]===value} onClick={()=>buy.setSelected(current=>({...current,[group.name]:value}))}>{value}{buy.selected[group.name]===value && <Check size={13}/>}</button>)}</div></fieldset>)}
    <div className="sr-product-buy-actions"><div className="sr-product-quantity"><button type="button" aria-label="Diminuir quantidade" disabled={buy.qty<=1} onClick={()=>buy.setQty(quantity=>Math.max(1,quantity-1))}><Minus size={16}/></button><output aria-label="Quantidade selecionada">{buy.qty}</output><button type="button" aria-label="Aumentar quantidade" disabled={buy.qty>=buy.maxQty} onClick={()=>buy.setQty(quantity=>Math.min(buy.maxQty,quantity+1))}><Plus size={16}/></button></div><button type="button" className="sr-btn sr-btn-solid" disabled={!buy.canAdd} onClick={buy.add}><ShoppingBag size={18}/>{buy.soldOut ? "Indisponível" : "Adicionar à sacola"}</button></div>
    {missing.length>0 ? <p className="sr-product-selection-note">Selecione: {missing.join(" e ")}.</p> : buy.soldOut ? <p className="sr-product-selection-note">Esta opção está sem estoque. Experimente outra combinação.</p> : buy.added ? <p className="sr-product-selection-note" role="status">Peça adicionada à sua sacola.</p> : <p className="sr-product-selection-note">Opções selecionadas. Tudo pronto para continuar.</p>}{online && <button type="button" className="sr-btn sr-btn-line sr-buy-now" disabled={!buy.canAdd} onClick={buyNow}>Comprar agora <ArrowRight size={17}/></button>}
    <div className="sr-product-trust"><ShieldCheck size={18}/><p>Seu pedido é conferido pela loja.<span>Você recebe a confirmação e combina os próximos passos.</span></p></div>
    {online && <form onSubmit={quote} className="sr-product-shipping"><label htmlFor="stride-product-cep"><Truck size={19}/> Entrega e retirada</label><div><input id="stride-product-cep" inputMode="numeric" autoComplete="postal-code" required pattern="[0-9]{5}-[0-9]{3}" placeholder="Seu CEP" value={cep} onChange={event=>{setCep(cepMask(event.target.value));setDelivery(null);}}/><button type="submit" disabled={calculating}>{calculating ? <Loader2 size={17} className="sr-spin"/> : "Consultar"}</button></div>{delivery && <p role="status">{delivery}</p>}</form>}
    <div className="sr-product-information"><details open><summary>Sobre a peça <ChevronDown size={16}/></summary><p>{product.description || "Quer saber mais sobre esta peça? Fale com a loja para conferir os detalhes antes de comprar."}</p></details><details><summary>Entrega, trocas e devoluções <ChevronDown size={16}/></summary><p>{kit.tenant.policies?.shipping || "A entrega e a retirada seguem a disponibilidade da loja e da sua região."}</p><Link to={kit.path("/ajuda")}>Consultar informações da loja <ArrowRight size={14}/></Link></details></div>{support && <a className="sr-product-help" href={support} target="_blank" rel="noreferrer"><MessageCircle size={17}/> Dúvida de tamanho ou sobre a peça? Fale com a loja.</a>}</section></div>
    {related.length>0 && <section className="sr-section"><header className="sr-section-head"><div><span className="sr-eyebrow">COMPLETE SEU MOVIMENTO.</span><h2 className="sr-h2">Vai bem com você.</h2></div><Link to={kit.path("/catalogo")} className="sr-text-link">Toda a coleção <ArrowRight size={16}/></Link></header><div className="sr-grid">{related.map(item=><ProductCard key={item.id} product={item} t="sr" fab/>)}</div></section>}
  </div>;
}
