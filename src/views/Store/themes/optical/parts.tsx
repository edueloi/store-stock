import { Link } from 'react-router-dom';
import { ArrowRight, Glasses, Heart, Search } from 'lucide-react';
import type { Product } from '../../../../types';
import { productRouteSegment } from '../../store-routing';
import { optionGroups, priceInfo, productImage, useKit, useQuickAdd } from './kit';

export function ProductCard({ product }: {product: Product}) {
  const {path, hidden, wishlist, toggleWishlist, catName} = useKit();
  const quick=useQuickAdd()(product), price=priceInfo(product,hidden), image=productImage(product);
  const href=path(`/produto/${productRouteSegment(product)}`), saved=wishlist.includes(product.id);
  return <article className="product-card reveal visible">
    <div className="product-art"><Link to={href} aria-label={`Ver ${product.name}`}>{image?<img src={image} alt={product.name} loading="lazy"/>:<Glasses className="product-placeholder" size={80} strokeWidth={1}/>}</Link>
      {(quick.soldOut||price.off||product.is_featured)&&<span className="product-tag">{quick.soldOut?'Indisponível':price.off?'Oferta':'Em destaque'}</span>}
      <button type="button" className={`heart ${saved?'active':''}`} aria-pressed={saved} aria-label={`${saved?'Remover dos favoritos':'Favoritar'} ${product.name}`} onClick={()=>toggleWishlist(product.id)}><Heart size={18}/></button>
      {quick.hasOptions||quick.soldOut?<Link className="quick-add" to={href}>{quick.soldOut?'Ver produto':'Escolher opções'}<ArrowRight size={16}/></Link>:<button type="button" className="quick-add" onClick={quick.add}>Adicionar à sacola<ArrowRight size={16}/></button>}
    </div>
    <Link className="product-title" to={href}><h3>{product.name}</h3><span>{price.now}</span></Link>
    <p>{catName(product)||'Seleção da loja'}{product.sku?` · Ref. ${product.sku}`:''}</p>
    {price.old&&<small className="opt-old-price"><s>{price.old}</s></small>}
    {optionGroups(product).length>0&&<span className="opt-options-note">Disponível em opções · descubra a sua</span>}
  </article>;
}
export function SearchField({value,onChange,autoFocus=false}:{value:string;onChange:(s:string)=>void;autoFocus?:boolean}){
 return <label className="search-field"><Search size={18}/><input type="search" aria-label="Buscar produtos" placeholder="Busque seu próximo olhar" value={value} onChange={e=>onChange(e.target.value)} autoFocus={autoFocus}/></label>;
}
export function Empty({favorites=false}:{favorites?:boolean}){const {path}=useKit();return <div className="empty"><Glasses size={45} strokeWidth={1}/><h2>{favorites?'Sua seleção começa com um olhar.':'Um novo olhar está chegando.'}</h2><p>{favorites?'Toque no coração dos produtos para guardar seus favoritos.':'Confira os filtros ou conheça mais sobre a nossa loja.'}</p><Link className="btn primary" to={path(favorites?'/catalogo':'/sobre')}>{favorites?'Explorar a coleção':'Conheça a loja'}<ArrowRight size={18}/></Link></div>;}
