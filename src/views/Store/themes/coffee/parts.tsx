import { Link } from 'react-router-dom';
import { ArrowUpRight, Coffee, Heart, Plus, ShoppingBag } from 'lucide-react';
import type { Product } from '../../../../types';
import { productRouteSegment } from '../../store-routing';
import { optionGroups, priceInfo, productImage, initials, useKit } from './kit';
import './styles.css';

export function Steam({className=''}:{className?:string}) { return <svg className={className} viewBox="0 0 80 90" aria-hidden="true"><path d="M18 80C2 58 39 45 19 17M43 80C27 60 64 46 44 17M67 80C51 61 88 45 68 17" stroke="currentColor" strokeWidth="3" strokeLinecap="round" fill="none"/></svg>; }
export function Bean({className=''}:{className?:string}) { return <svg className={className} viewBox="0 0 60 76" aria-hidden="true"><ellipse cx="30" cy="38" rx="25" ry="34" fill="currentColor"/><path d="M30 8C7 30 48 41 30 68" fill="none" stroke="var(--cf-espresso,#29180f)" strokeWidth="4"/></svg>; }
export function CoffeeCard({product,index=0}:{product:Product;index?:number}) {
 const {path,hidden,tracks,cart,addToCart,openCart,wishlist,toggleWishlist}=useKit();
 const image=productImage(product); const info=priceInfo(product,hidden);
 const href=path(`/produto/${productRouteSegment(product)}`); const hasOptions=optionGroups(product).length>0;
 const liked=wishlist.includes(product.id);
 const stock=tracks ? (Array.isArray(product.skus)&&product.skus.length ? product.skus.reduce((s,x)=>s+(Number(x.stock)||0),0) : null) : null;
 // Some installations do not expose a quantity field: leave the validation to the shared cart.
 const soldOut=tracks && typeof stock==='number' && stock<=0;
 return <article className="cf-product-card" style={{animationDelay:`${Math.min(index,7)*65}ms`}}>
 <Link to={href} className="cf-product-media" aria-label={product.name}>{image?<img loading="lazy" src={image} alt={product.name}/>:<span className="cf-fallback"><Coffee size={44}/>{initials(product.name)}</span>}{info.off&&<span className="cf-offer">Oferta</span>}</Link>
 <button type="button" className="cf-favorite" aria-label={liked?'Remover dos favoritos':'Favoritar'} aria-pressed={liked} onClick={()=>toggleWishlist(product.id)}><Heart size={18} fill={liked?'currentColor':'none'}/></button>
 <div className="cf-product-content"><span className="cf-product-eyebrow">SELEÇÃO DA CASA</span><Link className="cf-product-name" to={href}>{product.name}</Link><div className="cf-product-bottom"><span className="cf-product-price">{info.old&&<s>{info.old}</s>}<strong>{info.now}</strong></span>{hasOptions||soldOut?<Link className="cf-square-btn" to={href} aria-label={`Ver opções de ${product.name}`}><ArrowUpRight size={19}/></Link>:<button className="cf-square-btn" type="button" aria-label={`Adicionar ${product.name}`} onClick={()=>{addToCart(product);openCart();}}><Plus size={20}/></button>}</div></div>
 </article>;
}
export function MenuRow({product}:{product:Product}) {
 const {path,hidden,addToCart,openCart}=useKit();const info=priceInfo(product,hidden);const img=productImage(product);const href=path(`/produto/${productRouteSegment(product)}`);const simple=optionGroups(product).length===0;
 return <article className="cf-menu-row"><Link to={href} className="cf-menu-picture">{img?<img src={img} loading="lazy" alt=""/>:<Coffee size={24}/>}</Link><div className="cf-menu-detail"><Link to={href} className="cf-menu-name">{product.name}</Link>{product.description&&<p>{product.description}</p>}</div><strong className="cf-menu-price">{info.now}</strong>{simple?<button className="cf-mini-btn" onClick={()=>{addToCart(product);openCart();}} aria-label={`Adicionar ${product.name}`}><Plus size={18}/></button>:<Link to={href} className="cf-mini-btn" aria-label={`Ver ${product.name}`}><ArrowUpRight size={18}/></Link>}</article>;
}
export const ArchCard=CoffeeCard;
