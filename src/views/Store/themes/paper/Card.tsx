import { Link } from "react-router-dom";
import { Heart, ImageOff, Plus } from "lucide-react";
import type { Product } from "../../../../types";
import { hasDiscount, isSoldOut, money, optionGroups, priceOf, productImage, useKit } from "./kit";

const NOTES = ["yellow", "pink", "mint", "blue", "white", "peach"];

export default function Card({ product, index = 0 }: { product: Product; index?: number }) {
  const { tenant, hidden, productPath, addToCart, openCart, wishlist, toggleWishlist } = useKit();
  const img = productImage(product);
  const opts = optionGroups(product).length > 0;
  const out = isSoldOut(product, tenant);
  const liked = wishlist.includes(product.id);
  return (
    <article className={`pp-card pp-note-${NOTES[index % NOTES.length]} pp-tilt-${index % 4}`}>
      <span className="pp-tape" aria-hidden="true" />
      <Link to={productPath(product)} className="pp-card-photo" aria-label={product.name}>
        {img ? <img src={img} alt={product.name} loading="lazy" /> : <ImageOff size={34} aria-hidden="true" />}
        {hasDiscount(product) && !hidden && <span className="pp-sticker">promo!</span>}
        {out && <span className="pp-sticker pp-sticker-out">esgotado</span>}
      </Link>
      <button className="pp-heart" aria-pressed={liked} aria-label={liked ? "Remover dos favoritos" : "Adicionar aos favoritos"} onClick={() => toggleWishlist(product.id)}>
        <Heart size={18} fill={liked ? "currentColor" : "none"} />
      </button>
      <Link to={productPath(product)} className="pp-card-name">{product.name}</Link>
      <div className="pp-card-foot">
        {hidden ? (
          <span className="pp-price-ask">Sob consulta</span>
        ) : (
          <span className="pp-price">
            {hasDiscount(product) && <s>{money(Number(product.price))}</s>}
            {money(priceOf(product))}
          </span>
        )}
        {out ? null : opts ? (
          <Link className="pp-mini" to={productPath(product)}>Ver opções</Link>
        ) : (
          <button className="pp-mini" aria-label={`${hidden ? "Incluir no pedido" : "Adicionar ao carrinho"}: ${product.name}`} onClick={() => { addToCart(product); openCart(); }}>
            <Plus size={16} aria-hidden="true" /> {hidden ? "Pedir" : "Levar"}
          </button>
        )}
      </div>
    </article>
  );
}
