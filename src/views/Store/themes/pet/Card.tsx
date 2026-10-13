import { Link } from "react-router-dom";
import { ArrowRight, Heart, Plus } from "lucide-react";
import type { Product } from "../../../../types";
import { detectAnimal, tint } from "./animals";
import { groups, imageOf, money, priceOf, useKit } from "./lib";

export function Price({ product, hidden }: { product: Product; hidden: boolean }) {
  if (hidden) return <span className="pet-price pet-price--ask">Valor a confirmar</span>;
  const { price, full, off } = priceOf(product);
  return (
    <span className="pet-price">
      {off && <s>{money(full)}</s>}
      {money(price)}
    </span>
  );
}

export default function Card({ product, index = 0 }: { product: Product; index?: number }) {
  const { wishlist, toggleWishlist, addToCart, openCart, productPath, hidden, soldOut, catName } = useKit();
  const img = imageOf(product);
  const { off, price, full } = priceOf(product);
  const out = soldOut(product);
  const cat = catName(product.category_id);
  const { Icon } = detectAnimal(cat, product.name);
  const choices = groups(product).length > 0;
  const saved = wishlist.includes(product.id);
  const pct = off && full > 0 ? Math.round((1 - price / full) * 100) : 0;
  return (
    <article className={`pet-card${out ? " pet-out" : ""}`}>
      <div className="pet-card-media" style={{ ["--c" as string]: tint(index + 1) }}>
        <Link to={productPath(product)} aria-label={product.name} style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>
          {img ? <img src={img} alt="" loading="lazy" /> : <Icon size={56} />}
        </Link>
        {out ? <span className="pet-seal pet-seal--out" style={{ color: "#fff" }}>Esgotado</span> : off && !hidden ? <span className="pet-seal">Oferta -{pct}%</span> : null}
        <button className="pet-heart" aria-pressed={saved} aria-label={saved ? "Remover dos favoritos" : "Favoritar"} onClick={() => toggleWishlist(product.id)}>
          <Heart size={19} fill={saved ? "currentColor" : "none"} />
        </button>
      </div>
      <div className="pet-card-body">
        {cat && <span className="pet-card-cat"><Icon size={15} />{cat}</span>}
        <Link to={productPath(product)} className="pet-card-name">{product.name}</Link>
        <div className="pet-card-foot">
          <Price product={product} hidden={hidden} />
          {choices || out ? (
            <Link to={productPath(product)} className="pet-add" aria-label={`Ver opções de ${product.name}`}><ArrowRight size={20} /></Link>
          ) : (
            <button className="pet-add" aria-label={`Adicionar ${product.name} ao carrinho`} onClick={() => { addToCart(product); openCart(); }}>
              <Plus size={22} />
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
