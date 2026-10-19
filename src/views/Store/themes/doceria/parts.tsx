import { Link } from "react-router-dom";
import { CakeSlice, Heart, Plus, Search } from "lucide-react";
import { productRouteSegment } from "../../store-routing";
import type { Product } from "../../../../types";
import { priceInfo, productImage, useKit, useQuickAdd } from "./kit";

/** Cartão de produto: foto grande em moldura 4:5 fixa, preço claro e botão redondo de adicionar. */
export function ProductCard({ product }: { product: Product }) {
  const { path, hidden, wishlist, toggleWishlist, catName } = useKit();
  const quick = useQuickAdd()(product);
  const price = priceInfo(product, hidden);
  const image = productImage(product);
  const saved = wishlist.includes(product.id);
  const href = path(`/produto/${productRouteSegment(product)}`);
  return (
    <article className="dc-card">
      <div className="dc-card-media">
        <Link to={href} className="dc-card-photo" aria-label={product.name}>
          {image ? <img src={image} alt={product.name} loading="lazy" /> : <CakeSlice size={56} aria-label="Produto sem imagem" />}
        </Link>
        {quick.soldOut ? (
          <span className="dc-tag dc-tag-off">Esgotado</span>
        ) : price.off ? (
          <span className="dc-tag">Oferta</span>
        ) : product.is_featured ? (
          <span className="dc-tag dc-tag-gold">Queridinho</span>
        ) : null}
        <button
          type="button"
          className="dc-heart"
          aria-label={saved ? `Remover ${product.name} dos favoritos` : `Favoritar ${product.name}`}
          aria-pressed={saved}
          onClick={() => toggleWishlist(product.id)}
        >
          <Heart size={18} fill={saved ? "currentColor" : "none"} />
        </button>
      </div>
      <div className="dc-card-body">
        {catName(product) && <span className="dc-card-cat">{catName(product)}</span>}
        <Link className="dc-card-name" to={href}>
          {product.name}
        </Link>
        <div className="dc-card-foot">
          <div className="dc-price">
            <strong>{price.now}</strong>
            {price.old && <s>{price.old}</s>}
          </div>
          {quick.hasOptions || quick.soldOut ? (
            <Link className="dc-add dc-add-text" to={href}>
              {quick.soldOut ? "Ver" : "Escolher"}
            </Link>
          ) : (
            <button type="button" className="dc-add" aria-label={`${hidden ? "Incluir no pedido" : "Adicionar"} ${product.name}`} onClick={quick.add}>
              <Plus size={22} />
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

export function Empty({ title, text, onClear }: { title: string; text: string; onClear?: () => void }) {
  return (
    <div className="dc-empty">
      <Search size={38} aria-hidden="true" />
      <h2>{title}</h2>
      <p>{text}</p>
      {onClear && (
        <button type="button" className="dc-btn" onClick={onClear}>
          Ver todos os doces
        </button>
      )}
    </div>
  );
}

/** Círculo com a foto da categoria (ou a do primeiro produto dela). */
export function CategoryImage({ src }: { src?: string }) {
  return <span className="dc-cat-photo">{src ? <img src={src} alt="" loading="lazy" /> : <CakeSlice size={34} aria-hidden="true" />}</span>;
}
