import { Link } from "react-router-dom";
import { Heart } from "lucide-react";
import type { Product } from "../../../../types";
import { availableUnits, storeTracksStock } from "../../../../utils/storeStock";
import { hasDiscount, isSoldOut, money, optionGroups, priceOf, productImage, useKit } from "./kit";

export default function Card({ product }: { product: Product }) {
  const { tenant, hidden, productPath, addToCart, openCart, wishlist, toggleWishlist } = useKit();
  const first = productImage(product);
  const second = Array.isArray(product.images) ? product.images[1] : undefined;
  const opts = optionGroups(product).length > 0;
  const out = isSoldOut(product, tenant);
  const units = storeTracksStock(tenant) ? availableUnits(product) : null;
  const low = units !== null && units > 0 && units <= 3;
  const liked = wishlist.includes(product.id);
  const sale = hasDiscount(product) && !hidden;
  const pct = sale ? Math.round((1 - priceOf(product) / Number(product.price)) * 100) : 0;
  return (
    <article className="atl-card">
      <div className="atl-card-media">
        <Link to={productPath(product)} className="atl-card-img" aria-label={product.name}>
          {first ? <img className="atl-img-a" src={first} alt="" loading="lazy" /> : <span className="atl-img-empty" aria-hidden="true">{product.name.slice(0, 1)}</span>}
          {second && <img className="atl-img-b" src={second} alt="" loading="lazy" />}
        </Link>
        {out ? <span className="atl-flag atl-flag-off">Esgotado</span> : sale ? <span className="atl-flag">-{pct}%</span> : low ? <span className="atl-flag atl-flag-low">Últimas peças</span> : null}
        <button type="button" className="atl-heart" aria-pressed={liked} aria-label={liked ? "Remover dos favoritos" : "Favoritar"} onClick={() => toggleWishlist(product.id)}>
          <Heart size={18} strokeWidth={1.5} fill={liked ? "currentColor" : "none"} />
        </button>
        {!out && (
          <div className="atl-card-cta">
            {opts ? (
              <Link to={productPath(product)}>Escolher tamanho</Link>
            ) : (
              <button type="button" onClick={() => { addToCart(product); openCart(); }}>{hidden ? "Incluir no pedido" : "Adicionar à sacola"}</button>
            )}
          </div>
        )}
      </div>
      <div className="atl-card-info">
        <Link to={productPath(product)} className="atl-card-name">{product.name}</Link>
        {hidden ? (
          <p className="atl-price atl-muted">Sob consulta</p>
        ) : (
          <p className="atl-price">
            <strong>{money(priceOf(product))}</strong>
            {sale && <s>{money(Number(product.price))}</s>}
          </p>
        )}
      </div>
    </article>
  );
}
