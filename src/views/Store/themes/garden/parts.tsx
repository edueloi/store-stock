import { Link } from "react-router-dom";
import { Heart, Sprout } from "lucide-react";
import type { Product } from "../../../../types";
import { productRouteSegment } from "../../store-routing";
import { money, onSale, priceOf, productImage, useKit } from "./kit";
import "./styles.css";

export function Leaf({ size = 40, className = "" }: { size?: number; className?: string }) {
  return (
    <svg className={`garden-leaf ${className}`} width={size} height={size} viewBox="0 0 64 64" aria-hidden fill="currentColor">
      <path d="M8 56C8 30 24 10 56 8c0 30-18 48-42 48z" />
      <path d="M10 54C24 40 36 28 48 16" stroke="rgba(255,255,255,.55)" strokeWidth="2.5" fill="none" strokeLinecap="round" />
    </svg>
  );
}

export function Tile({ product }: { product: Product }) {
  const { path, categories, hidden, wishlist, toggleWishlist } = useKit();
  const img = productImage(product);
  const cat = categories.find((c) => c.id === product.category_id);
  const fav = wishlist.includes(product.id);
  return (
    <article className="garden-tile">
      <div className="garden-tile-img">
        {onSale(product) && <span className="garden-sale"><Leaf size={13} /> Oferta</span>}
        {img ? <img src={img} alt="" loading="lazy" /> : <Sprout size={64} aria-hidden />}
      </div>
      <button className="garden-fav" aria-pressed={fav} aria-label={fav ? `Remover ${product.name} dos favoritos` : `Favoritar ${product.name}`} onClick={() => toggleWishlist(product.id)}>
        <Heart size={19} fill={fav ? "currentColor" : "none"} />
      </button>
      <div className="garden-tile-info">
        {cat && <small>{cat.name}</small>}
        <h3><Link to={path(`/produto/${productRouteSegment(product)}`)}>{product.name}</Link></h3>
        <div className="garden-tile-price">
          {hidden ? <em>Sob consulta</em> : (
            <>
              <span>{money(priceOf(product))}</span>
              {onSale(product) && <s>{money(Number(product.price))}</s>}
            </>
          )}
        </div>
      </div>
    </article>
  );
}

export function Masonry({ products, three = false }: { products: Product[]; three?: boolean }) {
  return <div className={`garden-masonry${three ? " is-3" : ""}`}>{products.map((p) => <Tile key={p.id} product={p} />)}</div>;
}

export function Empty({ title, text, action }: { title: string; text: string; action?: React.ReactNode }) {
  return (
    <div className="garden-empty">
      <Sprout size={46} aria-hidden />
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  );
}
