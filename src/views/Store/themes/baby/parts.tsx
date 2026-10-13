import { Link } from "react-router-dom";
import { Heart, ShoppingBag } from "lucide-react";
import { productRouteSegment } from "../../store-routing";
import { initials, optionGroups, priceInfo, productImage, useKit } from "./kit";
import type { Product } from "../../../../types";
import "./styles.css";

export function Cloud({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 200 110" aria-hidden="true" focusable="false">
      <path
        d="M50 100c-26 0-42-14-42-32 0-16 12-28 30-30C42 18 58 6 80 6c18 0 32 8 40 22 6-5 14-8 22-8 20 0 34 14 34 32v2c14 3 24 14 24 28 0 14-12 18-26 18H50z"
        fill="currentColor"
      />
    </svg>
  );
}

export function Balloon({ className = "", color = "currentColor" }: { className?: string; color?: string }) {
  return (
    <svg className={className} viewBox="0 0 60 120" aria-hidden="true" focusable="false">
      <path d="M30 4C14 4 4 18 4 34c0 20 16 36 26 44 10-8 26-24 26-44C56 18 46 4 30 4z" fill={color} />
      <path d="M26 80h8l-4 8z" fill={color} />
      <path d="M30 88c-6 10 6 16 0 30" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
      <ellipse cx="20" cy="26" rx="5" ry="9" fill="#fff" opacity=".35" transform="rotate(20 20 26)" />
    </svg>
  );
}

export function Star({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M12 2.5l2.7 6 6.3.6-4.8 4.3 1.4 6.4L12 16.5l-5.6 3.3 1.4-6.4L3 9.1l6.3-.6z" fill="currentColor" strokeLinejoin="round" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

export function Bow({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 80 50" aria-hidden="true" focusable="false">
      <path d="M40 26C28 6 6 2 4 14c-2 12 20 14 36 12zM40 26c12-20 34-24 36-12 2 12-20 14-36 12z" fill="currentColor" />
      <path d="M40 26c-8 8-14 18-18 24M40 26c8 8 14 18 18 24" stroke="currentColor" strokeWidth="5" fill="none" strokeLinecap="round" />
      <circle cx="40" cy="26" r="6.5" fill="#fff" opacity=".45" />
    </svg>
  );
}

export function Wave({ className = "", flip = false }: { className?: string; flip?: boolean }) {
  return (
    <svg className={className} viewBox="0 0 1200 40" preserveAspectRatio="none" aria-hidden="true" focusable="false" style={flip ? { transform: "scaleY(-1)" } : undefined}>
      <path d="M0 40V20c25 0 25-20 50-20s25 20 50 20 25-20 50-20 25 20 50 20 25-20 50-20 25 20 50 20 25-20 50-20 25 20 50 20 25-20 50-20 25 20 50 20 25-20 50-20 25 20 50 20 25-20 50-20 25 20 50 20 25-20 50-20 25 20 50 20 25-20 50-20 25 20 50 20 25-20 50-20 25 20 50 20 25-20 50-20 25 20 50 20 25-20 50-20 25 20 50 20 25-20 50-20 25 20 50 20 25-20 50-20 25 20 50 20 25-20 50-20 25 20 50 20V40z" fill="currentColor" />
    </svg>
  );
}

const TINTS = ["bb-t1", "bb-t2", "bb-t3", "bb-t4"];
export const tintOf = (i: number) => TINTS[i % TINTS.length];

/** Cartão-presente: fita no topo, foto em arco e botão de sacola. */
export function GiftCard({ product, index = 0 }: { product: Product; index?: number }) {
  const { path, hidden, wishlist, toggleWishlist, addToCart, openCart } = useKit();
  const img = productImage(product);
  const p = priceInfo(product, hidden);
  const simple = optionGroups(product).length === 0;
  const to = path(`/produto/${productRouteSegment(product)}`);
  const liked = wishlist.includes(product.id);
  return (
    <article className={`bb-card ${tintOf(index)}`}>
      <span className="bb-card-ribbon" aria-hidden="true">
        <Bow />
      </span>
      <button className="bb-heart" aria-label={liked ? `Remover ${product.name} dos favoritos` : `Favoritar ${product.name}`} aria-pressed={liked} onClick={() => toggleWishlist(product.id)}>
        <Heart size={18} fill={liked ? "currentColor" : "none"} />
      </button>
      <Link to={to} className="bb-card-photo" aria-label={product.name}>
        {img ? <img src={img} alt={product.name} loading="lazy" /> : <span className="bb-card-initial">{initials(product.name)}</span>}
        {p.off && <span className="bb-badge">Oferta</span>}
      </Link>
      <div className="bb-card-body">
        <Link to={to} className="bb-card-name">
          {product.name}
        </Link>
        <p className="bb-price">
          <strong>{p.now}</strong>
          {p.old && <s>{p.old}</s>}
        </p>
        {simple ? (
          <button
            className="bb-btn bb-btn-soft"
            onClick={() => {
              addToCart(product);
              openCart();
            }}
          >
            <ShoppingBag size={16} /> Pôr na sacola
          </button>
        ) : (
          <Link to={to} className="bb-btn bb-btn-soft">
            Escolher opções
          </Link>
        )}
      </div>
    </article>
  );
}
