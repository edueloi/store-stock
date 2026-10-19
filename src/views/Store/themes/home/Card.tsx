import { Link } from "react-router-dom";
import { Heart, Package } from "lucide-react";
import type { Product } from "../../../../types";
import { availableUnits, storeTracksStock } from "../../../../utils/storeStock";
import { hasDiscount, isSoldOut, money, optionGroups, priceOf, productImage, useKit } from "./kit";

export default function Card({ product }: { product: Product }) {
  const { tenant, hidden, productPath, addToCart, openCart, wishlist, toggleWishlist } = useKit();
  const img = productImage(product);
  const opts = optionGroups(product).length > 0;
  const out = isSoldOut(product, tenant);
  const units = storeTracksStock(tenant) ? availableUnits(product) : null;
  const low = units !== null && units > 0 && units <= 3;
  const liked = wishlist.includes(product.id);
  const sale = hasDiscount(product) && !hidden;
  const pct = sale ? Math.round((1 - priceOf(product) / Number(product.price)) * 100) : 0;
  return (
    <article className="hm-card">
      <div className="hm-card-media">
        <Link to={productPath(product)} className="hm-card-img" aria-label={product.name}>
          {img ? <img src={img} alt={product.name} loading="lazy" /> : <Package size={40} aria-hidden="true" />}
        </Link>
        {out ? <span className="hm-tag hm-tag-off">Esgotado</span> : sale ? <span className="hm-tag">-{pct}%</span> : low ? <span className="hm-tag hm-tag-low">Últimas unidades</span> : null}
        <button type="button" className="hm-heart" aria-pressed={liked} aria-label={liked ? "Remover dos favoritos" : "Adicionar aos favoritos"} onClick={() => toggleWishlist(product.id)}>
          <Heart size={18} fill={liked ? "currentColor" : "none"} />
        </button>
      </div>
      <div className="hm-card-body">
        <Link to={productPath(product)} className="hm-card-name">{product.name}</Link>
        {hidden ? (
          <p className="hm-price hm-muted">Sob consulta</p>
        ) : (
          <p className="hm-price">
            <strong>{money(priceOf(product))}</strong>
            {sale && <s>{money(Number(product.price))}</s>}
          </p>
        )}
        {out ? (
          <span className="hm-add hm-add-off">Esgotado</span>
        ) : opts ? (
          <Link className="hm-add" to={productPath(product)}>Ver opções</Link>
        ) : (
          <button type="button" className="hm-add" onClick={() => { addToCart(product); openCart(); }}>
            {hidden ? "Incluir no pedido" : "Adicionar"}
          </button>
        )}
      </div>
    </article>
  );
}
