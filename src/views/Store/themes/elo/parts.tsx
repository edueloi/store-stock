import { Link } from "react-router-dom";
import { ArrowUpRight, Heart, Plus, Search, Shirt } from "lucide-react";
import type { Product } from "../../../../types";
import { productRouteSegment } from "../../store-routing";
import { optionGroups, priceInfo, productImage, useKit, useQuickAdd } from "./kit";

export function SearchField({ value, onChange, placeholder, label = "Buscar", autoFocus = false }: { value: string; onChange: (value: string) => void; placeholder: string; label?: string; autoFocus?: boolean }) {
  return <label className="els-field"><Search size={17} aria-hidden="true" /><span className="els-sr">{label}</span><input type="search" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} autoFocus={autoFocus} /></label>;
}

export function ProductCard({ product }: { product: Product }) {
  const { path, hidden, wishlist, toggleWishlist, catName } = useKit();
  const quick = useQuickAdd()(product);
  const price = priceInfo(product, hidden);
  const photo = productImage(product);
  const second = Array.isArray(product.images) ? product.images[1] : undefined;
  const saved = wishlist.includes(product.id);
  const href = path(`/produto/${productRouteSegment(product)}`);
  const sizes = optionGroups(product).find((group) => /tamanho|numera/i.test(group.name));
  return <article className={`els-card ${quick.soldOut ? "is-out" : ""}`}>
    <div className="els-card-media"><Link className={`els-card-img ${second ? "has-second" : ""}`} to={href} aria-label={product.name}>{photo ? <img src={photo} alt={product.name} loading="lazy" /> : <Shirt size={44} strokeWidth={1} aria-label="Peça sem imagem" />}{second && <img className="els-card-second" src={second} alt="" loading="lazy" />}</Link><div className="els-badges">{quick.soldOut ? <span className="els-badge">Esgotado</span> : price.off ? <span className="els-badge is-sale">Preço especial</span> : product.is_featured ? <span className="els-badge">Seleção Élo</span> : null}</div><button type="button" className="els-heart" aria-label={saved ? `Remover ${product.name} dos favoritos` : `Favoritar ${product.name}`} aria-pressed={saved} onClick={() => toggleWishlist(product.id)}><Heart size={17} strokeWidth={1.4} fill={saved ? "currentColor" : "none"} /></button>{sizes && <span className="els-card-sizes">{sizes.values.join(" · ")}</span>}</div>
    <div className="els-card-body">{catName(product) && <span className="els-kicker">{catName(product)}</span>}<Link className="els-card-name" to={href}>{product.name}</Link><div className="els-card-foot"><div className="els-price">{price.old && <s>{price.old}</s>}<strong>{price.now}</strong></div>{quick.hasOptions || quick.soldOut ? <Link className="els-card-action" to={href} aria-label={`${quick.soldOut ? "Ver" : "Escolher"} ${product.name}`}>{quick.soldOut ? "Ver peça" : sizes ? "Escolher tamanho" : "Ver opções"}<ArrowUpRight size={14} /></Link> : <button type="button" className="els-card-add" onClick={quick.add} aria-label={`${hidden ? "Incluir no pedido" : "Adicionar"} ${product.name}`}><Plus size={16} /><span>Adicionar</span></button>}</div></div>
  </article>;
}

export function Empty({ title, text, onClear }: { title: string; text: string; onClear?: () => void }) {
  return <div className="els-empty"><Shirt size={37} strokeWidth={1} /><h2>{title}</h2><p>{text}</p>{onClear && <button type="button" className="els-btn" onClick={onClear}>Explorar todas as peças</button>}</div>;
}
