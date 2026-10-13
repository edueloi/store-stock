import { Link } from "react-router-dom";
import { Heart, Package, ShoppingCart } from "lucide-react";
import type { Product } from "../../../../types";
import { imageOf, inStock, money, priceInfo, productHref, useKit, variationGroups } from "./kit";

export function Price({ product, big = false }: { product: Product; big?: boolean }) {
  const { hidePrices } = useKit();
  const info = priceInfo(product);
  if (hidePrices) return <p className={`dfl-price dfl-price-ask${big ? " is-big" : ""}`}>Sob consulta</p>;
  return (
    <p className={`dfl-price${big ? " is-big" : ""}`}>
      {info.hasDiscount && <s>{money(info.full)}</s>}
      <strong>{money(info.price)}</strong>
    </p>
  );
}

export function Card({ product }: { product: Product }) {
  const { tenant, addToCart, path, hidePrices, wishlist, toggleWishlist } = useKit();
  const info = priceInfo(product);
  const img = imageOf(product);
  const has = inStock(product, tenant);
  const needsOptions = variationGroups(product).length > 0;
  const fav = wishlist.includes(product.id);
  const href = productHref(path, product);
  return (
    <article className="dfl-card">
      <Link to={href} className="dfl-card-img" aria-label={product.name} tabIndex={-1}>
        {img ? <img src={img} alt="" loading="lazy" /> : <Package size={36} strokeWidth={1.2} />}
        {info.hasDiscount && !hidePrices && <span className="dfl-badge">-{info.pct}%</span>}
        {!has && <span className="dfl-badge dfl-badge-out">Esgotado</span>}
      </Link>
      <button type="button" className={`dfl-fav${fav ? " is-on" : ""}`} aria-pressed={fav} aria-label={fav ? `Remover ${product.name} dos favoritos` : `Favoritar ${product.name}`} onClick={() => toggleWishlist(product.id)}>
        <Heart size={18} fill={fav ? "currentColor" : "none"} />
      </button>
      <div className="dfl-card-body">
        <Link to={href} className="dfl-card-name">{product.name}</Link>
        <Price product={product} />
        {needsOptions || !has ? (
          <Link to={href} className="dfl-btn dfl-btn-line">{has ? "Escolher opções" : "Ver produto"}</Link>
        ) : (
          <button type="button" className="dfl-btn" onClick={() => addToCart(product)}>
            <ShoppingCart size={16} /> {hidePrices ? "Incluir no pedido" : "Comprar"}
          </button>
        )}
      </div>
    </article>
  );
}

export function Empty({ title, text, to, action }: { title: string; text: string; to?: string; action?: string }) {
  return (
    <div className="dfl-empty">
      <Package size={40} strokeWidth={1.2} />
      <h2>{title}</h2>
      <p>{text}</p>
      {to && action && <Link to={to} className="dfl-btn dfl-btn-inline">{action}</Link>}
    </div>
  );
}
