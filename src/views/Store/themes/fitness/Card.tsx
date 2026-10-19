import { Link } from "react-router-dom";
import { Heart, Plus, ArrowRight } from "lucide-react";
import type { Product } from "../../../../types";
import { availableUnits } from "../../../../utils/storeStock";
import { groups, imageOf, money, priceOf, useKit } from "./lib";

export function Price({ product, hidden }: { product: Product; hidden: boolean }) {
  if (hidden) return <span className="ft-price ft-price--ask">Valor a confirmar</span>;
  const { price, full, off } = priceOf(product);
  return (
    <span className="ft-price">
      {off && <s>{money(full)}</s>}
      {money(price)}
    </span>
  );
}

export default function Card({ product }: { product: Product }) {
  const { wishlist, toggleWishlist, addToCart, openCart, productPath, hidden, soldOut, catName, tracks, cart } = useKit();
  const img = imageOf(product);
  const { off, price, full } = priceOf(product);
  const out = soldOut(product);
  const units = tracks ? availableUnits(product) : null;
  const inCart = cart.filter((item) => item.id === product.id).reduce((sum, item) => sum + item.quantity, 0);
  const quickUnavailable = out || (units !== null && units <= inCart);
  const choices = groups(product).length > 0;
  const saved = wishlist.includes(product.id);
  const pct = off && full > 0 ? Math.round((1 - price / full) * 100) : 0;
  return (
    <article className={`ft-card${out ? " ft-out" : ""}`}>
      <Link to={productPath(product)} className="ft-card-media" aria-label={product.name}>
        {img ? <img src={img} alt="" loading="lazy" /> : <span className="ft-nophoto">Sem foto</span>}
        {out ? <span className="ft-chip ft-chip--out">Esgotado</span> : off && !hidden ? <span className="ft-chip">-{pct}%</span> : null}
      </Link>
      <button className="ft-fav" aria-pressed={saved} aria-label={saved ? "Remover dos favoritos" : "Favoritar"} onClick={() => toggleWishlist(product.id)}>
        <Heart size={19} fill={saved ? "currentColor" : "none"} />
      </button>
      <div className="ft-card-body">
        <span className="ft-card-cat">{catName(product.category_id) || "Geral"}</span>
        <Link to={productPath(product)} className="ft-card-name">{product.name}</Link>
        <div className="ft-card-foot">
          <Price product={product} hidden={hidden} />
          {choices || quickUnavailable ? (
            <Link to={productPath(product)} className="ft-add" aria-label={`Ver opções de ${product.name}`}><ArrowRight size={18} /></Link>
          ) : (
            <button className="ft-add" aria-label={`Adicionar ${product.name} ao carrinho`} onClick={() => { if (quickUnavailable) return; addToCart(product); openCart(); }}>
              <Plus size={20} />
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
