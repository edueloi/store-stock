import { Link } from "react-router-dom";
import { Heart, ShoppingBag } from "lucide-react";
import type { Product } from "../../../../types";
import { discountPct, hasDiscount, isSoldOut, money, optionGroups, priceOf, productImage, useKit } from "./kit";

export default function Card({ product, rank }: { product: Product; rank?: number }) {
  const { tenant, categories, hidden, productPath, addToCart, openCart, wishlist, toggleWishlist } = useKit();
  const img = productImage(product);
  const opts = optionGroups(product).length > 0;
  const out = isSoldOut(product, tenant);
  const liked = wishlist.includes(product.id);
  const cat = categories.find((c) => c.id === product.category_id)?.name;
  const off = hidden ? 0 : discountPct(product);
  return (
    <article className="gd-card">
      <div className="gd-card-media">
        <Link to={productPath(product)} aria-label={product.name} className="gd-card-img">
          {img ? <img src={img} alt={product.name} loading="lazy" /> : <span aria-hidden="true">Sem foto</span>}
        </Link>
        <div className="gd-badges">
          {rank ? <span className="gd-badge gd-badge-rank">#{rank}</span> : null}
          {out ? <span className="gd-badge">Esgotado</span> : off > 0 ? <span className="gd-badge gd-badge-off">-{off}%</span> : product.is_featured && !rank ? <span className="gd-badge">Destaque</span> : null}
        </div>
        <button type="button" className="gd-heart" aria-pressed={liked} aria-label={liked ? "Remover dos favoritos" : "Adicionar aos favoritos"} onClick={() => toggleWishlist(product.id)}>
          <Heart size={15} strokeWidth={1.7} fill={liked ? "currentColor" : "none"} />
        </button>
      </div>
      <div className="gd-card-body">
        {cat && <span className="gd-card-cat">{cat}</span>}
        <Link to={productPath(product)} className="gd-card-name">
          {product.name}
        </Link>
        <div className="gd-card-foot">
          {hidden ? (
            <p className="gd-price gd-muted">Sob consulta</p>
          ) : (
            <p className="gd-price">
              {hasDiscount(product) && <s>{money(Number(product.price))}</s>}
              <strong>{money(priceOf(product))}</strong>
            </p>
          )}
          {out ? (
            <span className="gd-add gd-add-off">Esgotado</span>
          ) : opts ? (
            <Link className="gd-add" to={productPath(product)} aria-label={`Ver opções de ${product.name}`}>
              Opções
            </Link>
          ) : (
            <button
              type="button"
              className="gd-add"
              aria-label={`Adicionar ${product.name} ao carrinho`}
              onClick={() => {
                addToCart(product);
                openCart();
              }}
            >
              <ShoppingBag size={14} strokeWidth={1.8} /> {hidden ? "Pedir" : "Comprar"}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
