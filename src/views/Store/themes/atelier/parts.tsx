import { Link } from "react-router-dom";
import { Heart } from "lucide-react";
import type { Product } from "../../../../types";
import { imageOf, inStock, money, priceInfo, productHref, useKit, variationGroups } from "./kit";

/** Cartão editorial: segunda foto no hover quando existir. */
export function Piece({ product, tall = false }: { product: Product; tall?: boolean }) {
  const { tenant, addToCart, path, hidePrices, wishlist, toggleWishlist } = useKit();
  const info = priceInfo(product);
  const first = imageOf(product);
  const second = product.images?.[1];
  const has = inStock(product, tenant);
  const needsOptions = variationGroups(product).length > 0;
  const fav = wishlist.includes(product.id);
  const href = productHref(path, product);
  return (
    <article className={`atl-piece${tall ? " is-tall" : ""}`}>
      <div className="atl-piece-frame">
        <Link to={href} className="atl-piece-link" aria-label={product.name} tabIndex={-1}>
          {first ? <img className="atl-img-a" src={first} alt="" loading="lazy" /> : <span className="atl-img-empty" aria-hidden="true">{product.name.slice(0, 1)}</span>}
          {second && <img className="atl-img-b" src={second} alt="" loading="lazy" />}
          {info.hasDiscount && !hidePrices && <span className="atl-flag">-{info.pct}%</span>}
          {!has && <span className="atl-flag atl-flag-out">Esgotado</span>}
        </Link>
        <button type="button" className={`atl-heart${fav ? " is-on" : ""}`} aria-pressed={fav} aria-label={fav ? `Remover ${product.name} dos favoritos` : `Favoritar ${product.name}`} onClick={() => toggleWishlist(product.id)}>
          <Heart size={19} strokeWidth={1.5} fill={fav ? "currentColor" : "none"} />
        </button>
      </div>
      <div className="atl-piece-info">
        <Link to={href} className="atl-piece-name">{product.name}</Link>
        <p className="atl-piece-price">
          {hidePrices ? <span>Sob consulta</span> : (
            <>
              {info.hasDiscount && <s>{money(info.full)}</s>}
              <span>{money(info.price)}</span>
            </>
          )}
        </p>
        {needsOptions || !has ? (
          <Link to={href} className="atl-quick">{has ? "Escolher opções" : "Ver peça"}</Link>
        ) : (
          <button type="button" className="atl-quick" onClick={() => addToCart(product)}>{hidePrices ? "Incluir no pedido" : "Adicionar à sacola"}</button>
        )}
      </div>
    </article>
  );
}

export function Empty({ title, text, to, action }: { title: string; text: string; to?: string; action?: string }) {
  return (
    <div className="atl-empty">
      <h2>{title}</h2>
      <p>{text}</p>
      {to && action && <Link to={to} className="atl-btn">{action}</Link>}
    </div>
  );
}
