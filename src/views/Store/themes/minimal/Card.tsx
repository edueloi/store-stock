import { Link } from "react-router-dom";
import { Heart } from "lucide-react";
import type { Product } from "../../../../types";
import { hasDiscount, isSoldOut, money, optionGroups, priceOf, productImage, useKit } from "./kit";

export default function Card({ product }: { product: Product }) {
  const { tenant, hidden, productPath, addToCart, openCart, wishlist, toggleWishlist } = useKit();
  const img = productImage(product);
  const opts = optionGroups(product).length > 0;
  const out = isSoldOut(product, tenant);
  const liked = wishlist.includes(product.id);
  return (
    <article className="mn-card">
      <div className="mn-card-media">
        <Link to={productPath(product)} aria-label={product.name} className="mn-card-img">
          {img ? <img src={img} alt={product.name} loading="lazy" /> : <span aria-hidden="true">Sem foto</span>}
        </Link>
        <button className="mn-heart" aria-pressed={liked} aria-label={liked ? "Remover dos favoritos" : "Adicionar aos favoritos"} onClick={() => toggleWishlist(product.id)}>
          <Heart size={18} fill={liked ? "currentColor" : "none"} />
        </button>
        {out ? (
          <span className="mn-quick mn-quick-off">Esgotado</span>
        ) : opts ? (
          <Link className="mn-quick" to={productPath(product)}>Ver opções</Link>
        ) : (
          <button className="mn-quick" onClick={() => { addToCart(product); openCart(); }}>{hidden ? "Incluir no pedido" : "Adicionar"}</button>
        )}
      </div>
      <Link to={productPath(product)} className="mn-card-name">{product.name}</Link>
      {hidden ? (
        <p className="mn-price mn-muted">Sob consulta</p>
      ) : (
        <p className="mn-price">
          {money(priceOf(product))}
          {hasDiscount(product) && <s>{money(Number(product.price))}</s>}
        </p>
      )}
    </article>
  );
}
