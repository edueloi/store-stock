import { Link } from "react-router-dom";
import { Heart, Package, ShoppingCart, Store, Truck } from "lucide-react";
import type { Product } from "../../../../types";
import { hasDiscount, isSoldOut, money, optionGroups, priceOf, productImage, useKit } from "./kit";

export default function Card({ product }: { product: Product }) {
  const { tenant, hidden, sf, productPath, addToCart, openCart, wishlist, toggleWishlist } = useKit();
  const img = productImage(product);
  const opts = optionGroups(product).length > 0;
  const out = isSoldOut(product, tenant);
  const liked = wishlist.includes(product.id);
  const delivery = sf.shipping_status === "enabled" ? "Entrega" : "Entrega sob consulta";
  return (
    <article className="hm-card">
      <Link to={productPath(product)} className="hm-card-img" aria-label={product.name}>
        {img ? <img src={img} alt={product.name} loading="lazy" /> : <Package size={42} aria-hidden="true" />}
        {hasDiscount(product) && !hidden && <span className="hm-tag-sale">Oferta</span>}
      </Link>
      <button className="hm-heart" aria-pressed={liked} aria-label={liked ? "Remover dos favoritos" : "Adicionar aos favoritos"} onClick={() => toggleWishlist(product.id)}>
        <Heart size={18} fill={liked ? "currentColor" : "none"} />
      </button>
      <div className="hm-card-body">
        <p className="hm-card-badges">
          <span><Store size={12} aria-hidden="true" /> Retirada</span>
          <span><Truck size={12} aria-hidden="true" /> {delivery}</span>
        </p>
        <Link to={productPath(product)} className="hm-card-name">{product.name}</Link>
        {hidden ? (
          <p className="hm-price-ask">Sob consulta</p>
        ) : (
          <p className="hm-price">
            {hasDiscount(product) && <s>{money(Number(product.price))}</s>}
            <strong>{money(priceOf(product))}</strong>
          </p>
        )}
        {out ? (
          <button className="hm-btn hm-btn-line" disabled>Esgotado</button>
        ) : opts ? (
          <Link className="hm-btn hm-btn-line" to={productPath(product)}>Escolher opções</Link>
        ) : (
          <button className="hm-btn hm-btn-accent" onClick={() => { addToCart(product); openCart(); }}>
            <ShoppingCart size={16} aria-hidden="true" /> {hidden ? "Incluir no pedido" : "Adicionar"}
          </button>
        )}
      </div>
    </article>
  );
}
