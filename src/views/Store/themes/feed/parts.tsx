import { Link } from "react-router-dom";
import { ArrowRight, Heart } from "lucide-react";
import type { Product } from "../../../../types";
import { productRouteSegment } from "../../store-routing";
import { money, onSale, priceOf, productImage, useKit } from "./kit";
import "./styles.css";

export function Paw({ size = 24, className = "" }: { size?: number; className?: string }) {
  return (
    <svg className={`feed-paw ${className}`} width={size} height={size} viewBox="0 0 64 64" fill="currentColor" aria-hidden>
      <ellipse cx="14" cy="28" rx="7" ry="9" transform="rotate(-20 14 28)" />
      <ellipse cx="26" cy="15" rx="7" ry="10" transform="rotate(-6 26 15)" />
      <ellipse cx="40" cy="15" rx="7" ry="10" transform="rotate(6 40 15)" />
      <ellipse cx="52" cy="28" rx="7" ry="9" transform="rotate(20 52 28)" />
      <path d="M32 31c-9 0-17 10-17 18 0 6 5 8 10 7 4-1 5-2 7-2s3 1 7 2c5 1 10-1 10-7 0-8-8-18-17-18z" />
    </svg>
  );
}

export function Grain({ size = 24, className = "" }: { size?: number; className?: string }) {
  return (
    <svg className={`feed-grain ${className}`} width={size} height={size} viewBox="0 0 64 64" fill="currentColor" aria-hidden>
      <path d="M32 60V22" stroke="currentColor" strokeWidth="3" strokeLinecap="round" fill="none" />
      <path d="M32 24c-8-1-12-7-12-14 8 0 12 6 12 14zM32 24c8-1 12-7 12-14-8 0-12 6-12 14zM32 38c-8-1-12-7-12-14 8 0 12 6 12 14zM32 38c8-1 12-7 12-14-8 0-12 6-12 14zM32 52c-8-1-12-7-12-14 8 0 12 6 12 14zM32 52c8-1 12-7 12-14-8 0-12 6-12 14zM32 4c4 4 4 10 0 14-4-4-4-10 0-14z" />
    </svg>
  );
}

export function PriceTag({ product }: { product: Product }) {
  const { hidden } = useKit();
  if (hidden) return <div className="feed-pricetag"><em>Sob consulta</em></div>;
  return (
    <div className="feed-pricetag">
      <strong>{money(priceOf(product))}</strong>
      {onSale(product) && <s>{money(Number(product.price))}</s>}
    </div>
  );
}

export function Card({ product }: { product: Product }) {
  const { path, categories, wishlist, toggleWishlist } = useKit();
  const img = productImage(product);
  const cat = categories.find((c) => c.id === product.category_id);
  const fav = wishlist.includes(product.id);
  const to = path(`/produto/${productRouteSegment(product)}`);
  return (
    <article className="feed-card">
      <Link className="feed-cover" to={to} tabIndex={-1} aria-hidden />
      <div className="feed-card-img">
        {onSale(product) && <span className="feed-card-badge"><Paw size={12} /> Oferta</span>}
        {img ? <img src={img} alt="" loading="lazy" /> : <Grain size={60} className="" />}
      </div>
      <button className="feed-fav" aria-pressed={fav} aria-label={fav ? `Remover ${product.name} dos favoritos` : `Favoritar ${product.name}`} onClick={() => toggleWishlist(product.id)}>
        <Heart size={20} fill={fav ? "currentColor" : "none"} />
      </button>
      <div className="feed-label">
        {cat && <small>{cat.name}</small>}
        <h3><Link to={to}>{product.name}</Link></h3>
        <PriceTag product={product} />
      </div>
    </article>
  );
}

/** Prateleira horizontal com tábua de madeira. */
export function Shelf({ title, kicker, to, products }: { title: string; kicker?: string; to?: string; products: Product[] }) {
  return (
    <section className="feed-shelf" aria-label={title}>
      <div className="feed-shelf-head">
        <div>
          {kicker && <span className="feed-kicker"><Paw size={14} /> {kicker}</span>}
          <h2 style={{ margin: "4px 0 0", fontSize: "clamp(24px,3.4vw,34px)" }}>{title}</h2>
        </div>
        {to && <Link to={to}>Ver prateleira completa <ArrowRight size={16} aria-hidden /></Link>}
      </div>
      <div className="feed-shelf-row" tabIndex={0}>
        {products.map((p) => <Card key={p.id} product={p} />)}
      </div>
      <div className="feed-plank" aria-hidden />
    </section>
  );
}

export function Empty({ title, text, action }: { title: string; text: string; action?: React.ReactNode }) {
  return (
    <div className="feed-empty">
      <Paw size={44} />
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  );
}
