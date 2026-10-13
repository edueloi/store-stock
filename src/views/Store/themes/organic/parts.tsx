import { Link } from "react-router-dom";
import { Package } from "lucide-react";
import { productRouteSegment } from "../../store-routing";
import { availableUnits } from "../../../../utils/storeStock";
import type { Product } from "../../../../types";
import { optionGroups, priceOf, productImage, useShop } from "./core";
import "./styles.css";

export const T = {
  name: "Natural",
  tag: "Natural & Artesanal",
  hero: "Escolhas simples. Uma vida mais natural.",
  sub: "Produtos e detalhes selecionados para fazer parte do seu cotidiano.",
  catalog: "Escolhas com essência",
  categories: "Explore nossas coleções",
  featured: "Da nossa seleção",
  cart: "Sua cesta natural",
};

export function Leaf({ size = 24, className = "" }: { size?: number; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" width={size} height={size} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 26C6 13 14 6 27 5c0 13-7 21-19 21z" />
      <path d="M6 26C11 19 16 14 22 10" />
    </svg>
  );
}

export function Sprig({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 120 24" width="120" height="24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
      <path d="M4 12h112" />
      <path d="M30 12c-3-7-8-8-12-8 0 5 4 8 12 8zM30 12c-3 7-8 8-12 8 0-5 4-8 12-8zM60 12c-3-7-8-8-12-8 0 5 4 8 12 8zM60 12c-3 7-8 8-12 8 0-5 4-8 12-8zM90 12c3-7 8-8 12-8 0 5-4 8-12 8zM90 12c3 7 8 8 12 8 0-5-4-8-12-8z" />
    </svg>
  );
}

export function Seal({ className = "" }: { className?: string }) {
  return (
    <span className={`or-seal ${className}`} aria-label="Selo 100% natural">
      <Leaf size={14} />
      <b>100%</b>
      <i>natural</i>
    </span>
  );
}

const ratios = ["4 / 5", "1 / 1", "3 / 4", "5 / 6"];

export function ProductCard({ product, index = 0 }: { product: Product; index?: number }) {
  const { path, hidden, categories, wishlist, toggleWishlist, addToCart, tracks } = useShop();
  const to = path(`/produto/${productRouteSegment(product)}`);
  const price = priceOf(product, hidden);
  const img = productImage(product);
  const liked = wishlist.includes(product.id);
  const units = tracks ? availableUnits(product) : null;
  const out = units !== null && units <= 0;
  const needsOptions = optionGroups(product).length > 0;
  const category = categories.find((c) => c.id === product.category_id)?.name;
  return (
    <article className="or-card">
      <Link to={to} className="or-card-img" style={{ aspectRatio: ratios[index % ratios.length] }} aria-label={product.name}>
        {img ? <img src={img} alt="" loading="lazy" /> : <Package size={40} aria-hidden="true" />}
        {index % 3 === 0 && <Seal />}
      </Link>
      <div className="or-card-body">
        {category && <small>{category}</small>}
        <Link to={to} className="or-card-name">{product.name}</Link>
        <p className="or-price">
          <strong className={hidden ? "is-hidden" : ""}>{price.now}</strong>
          {price.old && <s>{price.old}</s>}
        </p>
        <div className="or-card-act">
          {needsOptions || out ? (
            <Link to={to} className="or-textbtn">{out ? "Indisponível" : "Escolher opções"}</Link>
          ) : (
            <button type="button" className="or-textbtn" onClick={() => addToCart(product)}>{hidden ? "Adicionar ao pedido" : "Adicionar à cesta"}</button>
          )}
          <button type="button" className="or-fav" aria-label={liked ? "Remover dos favoritos" : "Favoritar produto"} aria-pressed={liked} onClick={() => toggleWishlist(product.id)}>
            <Leaf size={20} className={liked ? "is-on" : ""} />
          </button>
        </div>
      </div>
    </article>
  );
}
