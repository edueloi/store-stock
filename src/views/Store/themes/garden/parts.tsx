import { Link } from "react-router-dom";
import { Heart, Leaf, Sprout } from "lucide-react";
import { StoreButton } from "../../../../components/store/StoreButton";
import { productRouteSegment } from "../../store-routing";
import type { Product } from "../../../../types";
import { money, onSale, priceOf, productImage, useKit } from "./kit";
import { useQuickAdd } from "./extras";
import "./styles.css";

/** Folha decorativa em SVG (puramente visual). */
export function LeafArt({ className = "" }: { className?: string }) {
  return (
    <svg className={`garden-leaf ${className}`} viewBox="0 0 80 80" aria-hidden="true">
      <path d="M8 72C6 34 30 8 72 8c0 40-26 64-60 64z" fill="currentColor" />
      <path d="M10 70C28 50 46 32 66 14" stroke="#fff" strokeOpacity=".55" strokeWidth="2.4" fill="none" strokeLinecap="round" />
    </svg>
  );
}

export function Price({ product, big = false }: { product: Product; big?: boolean }) {
  const { hidden } = useKit();
  return (
    <div className={big ? "garden-price garden-price-big" : "garden-price"}>
      {hidden ? (
        <em>Sob consulta</em>
      ) : (
        <>
          <strong>{money(priceOf(product))}</strong>
          {onSale(product) && <s>{money(Number(product.price))}</s>}
        </>
      )}
    </div>
  );
}

/** Card em arco: foto num retângulo 4:5 fixo (contain), botão pílula de 42px. */
export function Card({ product }: { product: Product }) {
  const { path, categories, wishlist, toggleWishlist, hidden } = useKit();
  const quick = useQuickAdd()(product);
  const img = productImage(product);
  const cat = categories.find((c) => c.id === product.category_id);
  const fav = wishlist.includes(product.id);
  const href = path(`/produto/${productRouteSegment(product)}`);
  return (
    <article className="garden-card">
      <Link className="garden-card-media" to={href} aria-label={product.name}>
        {img ? <img src={img} alt="" loading="lazy" /> : <Sprout size={46} aria-hidden="true" />}
      </Link>
      {quick.soldOut ? <span className="garden-badge is-off">Esgotado</span> : onSale(product) && !hidden ? <span className="garden-badge">Oferta</span> : product.is_featured ? <span className="garden-badge is-new">Novidade</span> : null}
      <button type="button" className="garden-heart" aria-pressed={fav} aria-label={fav ? `Remover ${product.name} dos favoritos` : `Favoritar ${product.name}`} onClick={() => toggleWishlist(product.id)}>
        <Heart size={18} fill={fav ? "currentColor" : "none"} />
      </button>
      <div className="garden-card-body">
        {cat && <span className="garden-card-cat"><Leaf size={12} aria-hidden="true" /> {cat.name}</span>}
        <h3><Link to={href}>{product.name}</Link></h3>
        <Price product={product} />
        {quick.hasOptions || quick.soldOut ? (
          <StoreButton asChild variant="outline" className="garden-card-btn">
            <Link to={href}>{quick.soldOut ? "Ver planta" : "Escolher opções"}</Link>
          </StoreButton>
        ) : (
          <StoreButton type="button" variant="outline" className="garden-card-btn is-add" onClick={quick.add}>
            {hidden ? "Incluir no pedido" : "Adicionar"}
          </StoreButton>
        )}
      </div>
    </article>
  );
}

export function SectionTitle({ eyebrow, title, text }: { eyebrow?: string; title: string; text?: string }) {
  return (
    <div className="garden-title">
      {eyebrow && <span className="garden-eyebrow"><Leaf size={14} aria-hidden="true" /> {eyebrow}</span>}
      <h2>{title}</h2>
      {text && <p>{text}</p>}
    </div>
  );
}

export function Empty({ title, text, action }: { title: string; text: string; action?: React.ReactNode }) {
  return (
    <div className="garden-empty">
      <Sprout size={44} aria-hidden="true" />
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  );
}
