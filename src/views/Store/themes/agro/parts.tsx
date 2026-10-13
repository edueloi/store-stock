import { Link } from "react-router-dom";
import { ArrowRight, Heart, Package, Wheat } from "lucide-react";
import type { Product } from "../../../../types";
import { money, onSale, priceOf, productImage, useKit } from "./kit";
import "./styles.css";

/** Selo circular "Oferta do campo". */
export function Seal({ text = "OFERTA DO CAMPO", className = "" }: { text?: string; className?: string }) {
  return (
    <svg className={`agro-seal ${className}`} viewBox="0 0 120 120" role="img" aria-label={text}>
      <defs><path id="agro-seal-arc" d="M60 60 m-44 0 a44 44 0 1 1 88 0 a44 44 0 1 1 -88 0" /></defs>
      <circle cx="60" cy="60" r="57" fill="var(--agro-gold)" stroke="var(--agro-ink)" strokeWidth="4" />
      <circle cx="60" cy="60" r="36" fill="none" stroke="var(--agro-ink)" strokeWidth="2" strokeDasharray="3 4" />
      <text fontSize="12" fill="var(--agro-ink-2)"><textPath href="#agro-seal-arc" startOffset="0">{`${text} * ${text} *`}</textPath></text>
      <g transform="translate(60 60)" stroke="var(--agro-ink-2)" strokeWidth="3" strokeLinecap="round" fill="none">
        <path d="M0 18 V-14" />
        <path d="M0 -4 C-12 -6 -14 -16 -14 -16 C-4 -16 0 -10 0 -4Z M0 -4 C12 -6 14 -16 14 -16 C4 -16 0 -10 0 -4Z M0 8 C-12 6 -14 -4 -14 -4 C-4 -4 0 2 0 8Z M0 8 C12 6 14 -4 14 -4 C4 -4 0 2 0 8Z" fill="var(--agro-ink-2)" />
      </g>
    </svg>
  );
}

export function Price({ product, big = false }: { product: Product; big?: boolean }) {
  const { hidden } = useKit();
  if (hidden) return <div className={big ? "agro-bigprice" : "agro-price"}><em>Sob consulta</em></div>;
  return (
    <div className={big ? "agro-bigprice" : "agro-price"}>
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
  return (
    <article className="agro-card">
      <div className="agro-card-img">
        {onSale(product) && <span className="agro-ribbon">Oferta do campo</span>}
        {img ? <img src={img} alt="" loading="lazy" /> : <Package size={52} aria-hidden />}
      </div>
      <button className="agro-heart" aria-pressed={fav} aria-label={fav ? `Remover ${product.name} dos favoritos` : `Favoritar ${product.name}`} onClick={() => toggleWishlist(product.id)}>
        <Heart size={18} fill={fav ? "currentColor" : "none"} />
      </button>
      <div className="agro-card-body">
        {cat && <span className="agro-tag" style={{ alignSelf: "flex-start" }}>{cat.name}</span>}
        <h3><Link className="agro-card-link" to={path(`/produto/${productRouteSegmentSafe(product)}`)}>{product.name}</Link></h3>
        <Price product={product} />
      </div>
      <div className="agro-card-cta" aria-hidden>Ver produto <ArrowRight size={16} /></div>
    </article>
  );
}

import { productRouteSegment } from "../../store-routing";
const productRouteSegmentSafe = (p: Product) => productRouteSegment(p);

export function Empty({ title, text, action }: { title: string; text: string; action?: React.ReactNode }) {
  return (
    <div className="agro-empty">
      <Wheat size={44} aria-hidden />
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  );
}
