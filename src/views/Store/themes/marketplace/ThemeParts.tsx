import { Link } from "react-router-dom";
import { Heart, Package, ShoppingCart } from "lucide-react";
import { productRouteSegment } from "../../store-routing";

import { HIDDEN_PRICE } from "../../../../lib/storePrice";
export const marketImage = (product?: { image_url?: string | null; images?: unknown } | null) => (!product ? null : (Array.isArray(product.images) && typeof product.images[0] === "string" ? product.images[0] : product.image_url) || null);
export const marketMoney = (value: number) => value === HIDDEN_PRICE ? "Sob consulta" : value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const marketHide = (tenant: any) => tenant.policies?.storefront?.checkout_mode === "order_request" || tenant.policies?.storefront?.hide_prices === true;

export function MarketCard({ product, path, category, saved, onFavorite, onAdd, hidePrices }: any) {
  const image = marketImage(product);
  const price = Number(product.discount_price || product.price);
  const original = Number(product.price);
  const discount = product.discount_price && original > price ? Math.round((1 - price / original) * 100) : 0;
  const href = path(`/produto/${productRouteSegment(product)}`);
  return (
    <article className="mk-card">
      <Link to={href} className="mk-card-img">
        {image ? <img src={image} alt={product.name} loading="lazy" /> : <Package size={38} />}
        {discount > 0 ? <span className="mk-badge">-{discount}%</span> : product.is_featured && <span className="mk-badge">Oferta</span>}
      </Link>
      <button type="button" onClick={onFavorite} aria-label="Favoritar" className={`mk-fav ${saved ? "is-on" : ""}`}>
        <Heart size={16} fill={saved ? "currentColor" : "none"} />
      </button>
      <div className="mk-card-body">
        <span className="mk-card-cat">{category || "Produtos"}</span>
        <Link to={href} className="mk-card-name">{product.name}</Link>
        <div className="mk-card-price">
          {!hidePrices && discount > 0 && <s>{marketMoney(original)}</s>}
          <strong>{hidePrices ? "Sob consulta" : marketMoney(price)}</strong>
        </div>
        {!hidePrices && <small className="mk-card-note">Frete e condições com a loja</small>}
        <button type="button" onClick={onAdd} className="mk-add"><ShoppingCart size={15} /> Adicionar</button>
      </div>
    </article>
  );
}
