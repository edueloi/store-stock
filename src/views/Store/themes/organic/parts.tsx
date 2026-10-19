import { Link } from "react-router-dom";
import { Heart, Package } from "lucide-react";
import { productRouteSegment } from "../../store-routing";
import { availableUnits } from "../../../../utils/storeStock";
import { StoreButton } from "../../../../components/store/StoreButton";
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
  seal: "100% natural",
};

export function Leaf({ size = 24, className = "" }: { size?: number; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" width={size} height={size} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 26C6 13 14 6 27 5c0 13-7 21-19 21z" />
      <path d="M6 26C11 19 16 14 22 10" />
    </svg>
  );
}

/** Divisor ondulado em SVG; `flip` inverte verticalmente e `fill` define a cor da onda. */
export function Wave({ fill = "var(--or-sand)", flip = false, className = "" }: { fill?: string; flip?: boolean; className?: string }) {
  return (
    <svg className={`or-wave ${className}`} style={flip ? { transform: "scaleY(-1)" } : undefined} viewBox="0 0 1440 80" preserveAspectRatio="none" aria-hidden="true">
      <path fill={fill} d="M0 40C120 10 240 6 360 28s240 46 360 30 240-52 360-48 240 30 360 48v22H0z" />
    </svg>
  );
}

export function Seal({ className = "", label = T.seal }: { className?: string; label?: string }) {
  return (
    <span className={`or-seal ${className}`}>
      <Leaf size={16} />
      <b>{label}</b>
    </span>
  );
}

export function ProductCard({ product }: { product: Product; index?: number }) {
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
      <div className="or-card-frame">
        <Link to={to} className="or-card-img" aria-label={product.name}>
          {img ? <img src={img} alt="" loading="lazy" /> : <Package size={40} aria-hidden="true" />}
        </Link>
        <button type="button" className="or-fav" aria-label={liked ? "Remover dos favoritos" : "Favoritar produto"} aria-pressed={liked} onClick={() => toggleWishlist(product.id)}>
          <Heart size={18} className={liked ? "is-on" : ""} />
        </button>
      </div>
      <div className="or-card-body">
        {category && <small>{category}</small>}
        <Link to={to} className="or-card-name">{product.name}</Link>
        <p className="or-price">
          <strong className={hidden ? "is-hidden" : ""}>{price.now}</strong>
          {price.old && <s>{price.old}</s>}
        </p>
        {needsOptions || out ? (
          <StoreButton asChild variant="outline" size="sm" className="or-cardbtn or-line">
            <Link to={to}>{out ? "Indisponível" : "Escolher opções"}</Link>
          </StoreButton>
        ) : (
          <StoreButton type="button" size="sm" className="or-cardbtn or-cta" onClick={() => addToCart(product)}>
            {hidden ? "Adicionar ao pedido" : "Adicionar à cesta"}
          </StoreButton>
        )}
      </div>
    </article>
  );
}
