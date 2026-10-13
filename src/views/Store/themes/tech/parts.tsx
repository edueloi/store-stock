import { Link } from "react-router-dom";
import { Heart, Package } from "lucide-react";
import { productRouteSegment } from "../../store-routing";
import type { Product } from "../../../../types";
import { groupsOf, hasDiscount, imageOf, money, priceOf, useShop } from "./kit";
import "./styles.css";

export function Price({ product, big = false }: { product: Product; big?: boolean }) {
  const { hidden } = useShop();
  const cls = big ? "tp-big-price" : "tp-price";
  if (hidden) return <div className={cls}><em>Sob consulta</em></div>;
  return (
    <div className={cls}>
      <strong>{money(priceOf(product))}</strong>
      {hasDiscount(product) && <s>{money(Number(product.price))}</s>}
    </div>
  );
}

export function Empty({ title, text }: { title: string; text: string }) {
  return (
    <div className="tp-empty" role="status">
      <h2>{title}</h2>
      <p>{text}</p>
    </div>
  );
}

/** Cartão com "especificações rápidas": descrição curta e opções disponíveis. */
export function TechCard({ product, wide = false }: { product: Product; wide?: boolean }) {
  const { path, categories, wishlist, toggleWishlist } = useShop();
  const faved = wishlist.includes(product.id);
  const img = imageOf(product);
  const cat = categories.find((c) => c.id === product.category_id)?.name || "Geral";
  const groups = groupsOf(product);
  const chips = groups.flatMap((g) => g.values).slice(0, 4);
  const hasSpec = Boolean(product.description) || chips.length > 0;
  return (
    <article className={`tp-card${wide ? " is-wide" : ""}`}>
      <div className="tp-card-media">
        {img ? <img src={img} alt={product.name} loading="lazy" /> : <Package className="ph" size={48} aria-label="Produto sem imagem" />}
        {hasDiscount(product) ? <span className="tp-badge off">Oferta</span> : product.is_featured ? <span className="tp-badge">Destaque</span> : null}
      </div>
      <button type="button" className="tp-fav" aria-pressed={faved} aria-label={faved ? `Remover ${product.name} dos favoritos` : `Favoritar ${product.name}`} onClick={() => toggleWishlist(product.id)}>
        <Heart size={18} fill={faved ? "currentColor" : "none"} />
      </button>
      <div className="tp-card-body">
        <span className="tp-card-cat">{cat}</span>
        <Link className="tp-card-name" to={path(`/produto/${productRouteSegment(product)}`)}>{product.name}</Link>
        {hasSpec && (
          <div className="tp-spec">
            <b>Especificações rápidas</b>
            {product.description && <p>{product.description}</p>}
            {chips.length > 0 && <div className="tp-chipset">{chips.map((c) => <span key={c}>{c}</span>)}</div>}
          </div>
        )}
        <Price product={product} />
      </div>
    </article>
  );
}
