import { Link } from "react-router-dom";
import { Heart, Package } from "lucide-react";
import { productRouteSegment } from "../../store-routing";
import { availableUnits } from "../../../../utils/storeStock";
import type { Product } from "../../../../types";
import { optionGroups, priceOf, productImage, useShop } from "./core";
import "./styles.css";

export const T = {
  name: "Farma Clara",
  tag: "Farmácia & Cuidados",
  hero: "Cuidado próximo, todos os dias.",
  sub: "Higiene, bem-estar e cuidados pessoais em um catálogo fácil de consultar.",
  catalog: "Encontre seu cuidado",
  categories: "Cuidados por categoria",
  featured: "Seleção da farmácia",
  cart: "Seu pedido de cuidados",
};

/** Ícones de departamento: cruz, gota, cápsula e coração, alternados. */
export function CatIcon({ index }: { index: number }) {
  const n = index % 4;
  return (
    <svg viewBox="0 0 48 48" width="40" height="40" aria-hidden="true" className="ph-caticon">
      {n === 0 && <path d="M19 6h10v13h13v10H29v13H19V29H6V19h13z" fill="currentColor" />}
      {n === 1 && (
        <>
          <path d="M24 5c7 9 12 15 12 22a12 12 0 0 1-24 0c0-7 5-13 12-22z" fill="currentColor" />
          <path d="M18 29a6 6 0 0 0 5 6" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" fill="none" />
        </>
      )}
      {n === 2 && (
        <>
          <rect x="4" y="16" width="40" height="16" rx="8" transform="rotate(-35 24 24)" fill="currentColor" />
          <path d="M18 14l12 20" stroke="#fff" strokeWidth="2.5" />
        </>
      )}
      {n === 3 && <path d="M24 42S6 31 6 18a9 9 0 0 1 18-3 9 9 0 0 1 18 3c0 13-18 24-18 24z" fill="currentColor" />}
    </svg>
  );
}

export function Cross({ size = 18 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path d="M9 2h6v7h7v6h-7v7H9v-7H2V9h7z" fill="currentColor" />
    </svg>
  );
}

export function ProductCard({ product }: { product: Product }) {
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
    <article className="ph-card">
      <button
        type="button"
        className="ph-heart"
        aria-label={liked ? "Remover dos favoritos" : "Favoritar produto"}
        aria-pressed={liked}
        onClick={() => toggleWishlist(product.id)}
      >
        <Heart size={18} fill={liked ? "currentColor" : "none"} />
      </button>
      <Link to={to} className="ph-card-media" aria-label={product.name}>
        {img ? <img src={img} alt="" loading="lazy" /> : <Package size={44} aria-hidden="true" />}
        {price.old && <span className="ph-flag">Oferta</span>}
      </Link>
      <div className="ph-card-body">
        {category && <small>{category}</small>}
        <Link to={to} className="ph-card-name">{product.name}</Link>
        <div className="ph-card-price">
          <strong className={hidden ? "is-hidden" : ""}>{price.now}</strong>
          {price.old && <s>{price.old}</s>}
        </div>
        <span className="ph-pickup">Retirada na loja</span>
        {needsOptions || out ? (
          <Link to={to} className="ph-btn ph-btn-soft">{out ? "Indisponível" : "Escolher opções"}</Link>
        ) : (
          <button type="button" className="ph-btn" onClick={() => addToCart(product)}>
            {hidden ? "Adicionar ao pedido" : "Adicionar"}
          </button>
        )}
      </div>
    </article>
  );
}
