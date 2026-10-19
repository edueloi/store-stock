import { Link } from "react-router-dom";
import { Heart, ShoppingBag } from "lucide-react";
import type { Product } from "../../../../types";
import { groups, imageOf, money, priceOf, totalUnits, useKit } from "./lib";

export function Price({ product, hidden }: { product: Product; hidden: boolean }) {
  if (hidden) return <span className="sp-price sp-price--ask">Sob consulta</span>;
  const { price, full, off } = priceOf(product);
  return (
    <span className="sp-price">
      {off && <s>{money(full)}</s>}
      <b>{money(price)}</b>
    </span>
  );
}

export default function Card({ product }: { product: Product }) {
  const { wishlist, toggleWishlist, addToCart, openCart, productPath, hidden, soldOut, catName, cart, tracks } = useKit();
  const inCart = cart.filter((i) => i.id === product.id).reduce((s, i) => s + i.quantity, 0);
  const stock = totalUnits(product);
  const limitReached = tracks && stock !== null && inCart >= stock;
  const img = imageOf(product);
  const { off, price, full } = priceOf(product);
  const out = soldOut(product) || !!limitReached;
  const low = tracks && !out && stock !== null && stock > 0 && stock <= 3;
  const hasChoices = groups(product).length > 0;
  const saved = wishlist.includes(product.id);
  const pct = off && full > 0 ? Math.round((1 - price / full) * 100) : 0;
  return (
    <article className={`sp-card${out ? " sp-out" : ""}`}>
      <Link to={productPath(product)} className="sp-card-media" aria-label={product.name}>
        {img ? <img src={img} alt="" loading="lazy" /> : <span className="sp-nophoto">{product.name.slice(0, 2)}</span>}
        {out ? <span className="sp-badge sp-badge--dark">Esgotado</span> : off && !hidden ? <span className="sp-badge">-{pct}%</span> : low ? <span className="sp-badge sp-badge--warn">Últimas unidades</span> : null}
      </Link>
      <button className="sp-fav" aria-pressed={saved} aria-label={saved ? "Remover dos favoritos" : "Favoritar"} onClick={() => toggleWishlist(product.id)}>
        <Heart size={19} fill={saved ? "currentColor" : "none"} />
      </button>
      <div className="sp-card-body">
        <p className="sp-card-cat">{catName(product.category_id) || "Esporte"}</p>
        <Link to={productPath(product)} className="sp-card-name">{product.name}</Link>
        <Price product={product} hidden={hidden} />
        {hasChoices || out ? (
          <Link to={productPath(product)} className="sp-add">{out ? "Ver produto" : "Ver opções"}</Link>
        ) : (
          <button className="sp-add" aria-label={`Adicionar ${product.name} ao carrinho`} onClick={() => { addToCart(product); openCart(); }}>
            <ShoppingBag size={17} /> Adicionar
          </button>
        )}
      </div>
    </article>
  );
}
