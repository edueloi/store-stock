import { Link } from "react-router-dom";
import { Coffee, Heart, Plus, Search } from "lucide-react";
import { productRouteSegment } from "../../store-routing";
import type { Product } from "../../../../types";
import { priceInfo, productImage, useKit, useQuickAdd } from "./kit";

/** Item de cardápio: miniatura quadrada fixa à esquerda, texto e preço à direita. */
export function ProductCard({ product }: { product: Product }) {
  const { path, hidden, wishlist, toggleWishlist, catName } = useKit();
  const quick = useQuickAdd()(product);
  const price = priceInfo(product, hidden);
  const image = productImage(product);
  const saved = wishlist.includes(product.id);
  const href = path(`/produto/${productRouteSegment(product)}`);
  return (
    <article className="cf-item">
      <Link to={href} className="cf-item-media" aria-label={product.name}>
        {image ? <img src={image} alt={product.name} loading="lazy" /> : <Coffee size={40} aria-label="Produto sem imagem" />}
        {quick.soldOut ? <span className="cf-badge cf-badge-off">Esgotado</span> : price.off ? <span className="cf-badge">Oferta</span> : null}
      </Link>
      <div className="cf-item-body">
        {catName(product) && <span className="cf-item-cat">{catName(product)}</span>}
        <Link className="cf-item-name" to={href}>
          {product.name}
        </Link>
        {product.description && <p className="cf-item-desc">{product.description}</p>}
        <div className="cf-item-foot">
          <div className="cf-price">
            <strong>{price.now}</strong>
            {price.old && <s>{price.old}</s>}
          </div>
          <div className="cf-item-actions">
            <button type="button" className="cf-fav" aria-label={saved ? `Remover ${product.name} dos favoritos` : `Favoritar ${product.name}`} aria-pressed={saved} onClick={() => toggleWishlist(product.id)}>
              <Heart size={17} fill={saved ? "currentColor" : "none"} />
            </button>
            {quick.hasOptions || quick.soldOut ? (
              <Link className="cf-btn cf-btn-sm cf-btn-line" to={href}>
                {quick.soldOut ? "Ver" : "Escolher"}
              </Link>
            ) : (
              <button type="button" className="cf-btn cf-btn-sm" onClick={quick.add}>
                <Plus size={16} /> {hidden ? "Pedir" : "Adicionar"}
              </button>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

export function Empty({ title, text, onClear }: { title: string; text: string; onClear?: () => void }) {
  return (
    <div className="cf-empty">
      <Search size={38} aria-hidden="true" />
      <h2>{title}</h2>
      <p>{text}</p>
      {onClear && (
        <button type="button" className="cf-btn" onClick={onClear}>
          Ver todo o cardápio
        </button>
      )}
    </div>
  );
}
