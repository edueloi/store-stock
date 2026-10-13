import { Link } from "react-router-dom";
import { Heart, Puzzle, ShoppingBag, Search } from "lucide-react";
import { productRouteSegment } from "../../store-routing";
import type { Product } from "../../../../types";
import { priceInfo, productImage, useKit, useQuickAdd } from "./kit";

/** Formas decorativas flutuantes (puramente visuais). */
export function Shapes({ className = "" }: { className?: string }) {
  return (
    <div className={`toys-shapes ${className}`} aria-hidden="true">
      <i className="toys-shape toys-sh-circle" />
      <i className="toys-shape toys-sh-tri" />
      <i className="toys-shape toys-sh-star" />
      <i className="toys-shape toys-sh-ring" />
      <i className="toys-shape toys-sh-square" />
    </div>
  );
}

/** Peça de encaixe usada como ícone de marca. */
export function Brick({ className = "" }: { className?: string }) {
  return (
    <span className={`toys-brick ${className}`} aria-hidden="true">
      <i />
      <i />
    </span>
  );
}

export function ProductCard({ product, index = 0 }: { product: Product; index?: number }) {
  const { path, hidden, wishlist, toggleWishlist, catName } = useKit();
  const quick = useQuickAdd()(product);
  const price = priceInfo(product, hidden);
  const image = productImage(product);
  const saved = wishlist.includes(product.id);
  const href = path(`/produto/${productRouteSegment(product)}`);
  return (
    <article className={`toys-card toys-tint-${index % 4}`}>
      <Link className="toys-card-media" to={href} aria-label={product.name}>
        {image ? <img src={image} alt={product.name} loading="lazy" /> : <Puzzle size={52} aria-label="Produto sem imagem" />}
        {quick.soldOut ? (
          <span className="toys-sticker toys-sticker-off">Esgotado</span>
        ) : price.off ? (
          <span className="toys-sticker toys-sticker-sale">Oferta</span>
        ) : product.is_featured ? (
          <span className="toys-sticker toys-sticker-new">Destaque</span>
        ) : null}
      </Link>
      <button
        type="button"
        className="toys-heart"
        aria-label={saved ? `Remover ${product.name} dos favoritos` : `Favoritar ${product.name}`}
        aria-pressed={saved}
        onClick={() => toggleWishlist(product.id)}
      >
        <Heart size={18} fill={saved ? "currentColor" : "none"} />
      </button>
      <div className="toys-card-body">
        {catName(product) && <span className="toys-chip">{catName(product)}</span>}
        <Link className="toys-card-name" to={href}>
          {product.name}
        </Link>
        <div className="toys-price">
          <strong>{price.now}</strong>
          {price.old && <s>{price.old}</s>}
        </div>
        {quick.hasOptions || quick.soldOut ? (
          <Link className="toys-btn toys-btn-line" to={href}>
            {quick.soldOut ? "Ver brinquedo" : "Escolher opções"}
          </Link>
        ) : (
          <button type="button" className="toys-btn toys-btn-solid" onClick={quick.add}>
            <ShoppingBag size={17} /> {hidden ? "Incluir no pedido" : "Adicionar"}
          </button>
        )}
      </div>
    </article>
  );
}

export function Empty({ title, text, onClear }: { title: string; text: string; onClear?: () => void }) {
  return (
    <div className="toys-empty">
      <Search size={38} aria-hidden="true" />
      <h2>{title}</h2>
      <p>{text}</p>
      {onClear && (
        <button type="button" className="toys-btn toys-btn-solid" onClick={onClear}>
          Ver todos os brinquedos
        </button>
      )}
    </div>
  );
}
