import { Link } from "react-router-dom";
import { Heart, ShoppingBag } from "lucide-react";
import type { Product } from "../../../../types";
import { groups, imageOf, money, priceOf, useKit } from "./lib";

export function Price({ product, hidden, big }: { product: Product; hidden: boolean; big?: boolean }) {
  if (hidden) return <span className={`sport-price sport-price--ask${big ? " sport-big" : ""}`}>Sob consulta</span>;
  const { price, full, off } = priceOf(product);
  return (
    <span className={`sport-price${off ? " sport-price--off" : ""}`}>
      {off && <span className="sport-old">{money(full)}</span>}
      {money(price)}
    </span>
  );
}

export default function Card({ product }: { product: Product }) {
  const { wishlist, toggleWishlist, addToCart, openCart, productPath, hidden, soldOut, catName, cart, tracks } = useKit();
  const inCart = cart.filter(i => i.id === product.id).reduce((s,i) => s + i.quantity, 0);
  const stock = product.skus?.length ? product.skus.reduce((s,k)=>s+(Number(k.stock)||0),0) : Number(product.stock);
  const limitReached = tracks && Number.isFinite(stock) && inCart >= stock;
  const img = imageOf(product);
  const { off, price, full } = priceOf(product);
  const out = soldOut(product) || !!limitReached;
  const hasChoices = groups(product).length > 0;
  const saved = wishlist.includes(product.id);
  const pct = off && full > 0 ? Math.round((1 - price / full) * 100) : 0;
  return (
    <article className={`sport-card${out ? " sport-soldout" : ""}`}>
      <Link to={productPath(product)} className="sport-card-media" aria-label={product.name}>
        {img ? <img src={img} alt="" loading="lazy" /> : <span className="sport-h" style={{ fontSize: 56, opacity: 0.15 }}>{product.name.slice(0, 2)}</span>}
        {out ? <span className="sport-badge sport-badge--dark" style={{ top: 12 }}>Esgotado</span> : off && !hidden && <span className="sport-badge">-{pct}%</span>}
      </Link>
      <button className="sport-fav" aria-pressed={saved} aria-label={saved ? "Remover dos favoritos" : "Favoritar"} onClick={() => toggleWishlist(product.id)}>
        <Heart size={20} fill={saved ? "currentColor" : "none"} />
      </button>
      <p className="sport-card-cat">{catName(product.category_id) || "Esporte"}</p>
      <Link to={productPath(product)} className="sport-card-name">{product.name}</Link>
      <div className="sport-price-row">
        <Price product={product} hidden={hidden} />
        {hasChoices || out ? (
          <Link to={productPath(product)} className="sport-add" aria-label={`Ver opções de ${product.name}`}>
            <ShoppingBag size={20} />
          </Link>
        ) : (
          <button
            className="sport-add"
            aria-label={`Adicionar ${product.name} ao carrinho`}
            onClick={() => {
              if (out) return;
              addToCart(product);
              openCart();
            }}
          >
            <ShoppingBag size={20} />
          </button>
        )}
      </div>
    </article>
  );
}
