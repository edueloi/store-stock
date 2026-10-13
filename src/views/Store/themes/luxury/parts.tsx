import { Link } from "react-router-dom";
import { Heart } from "lucide-react";
import { productRouteSegment } from "../../store-routing";
import type { Product } from "../../../../types";
import { hasDiscount, imageOf, money, priceOf, useShop } from "./kit";
import "./styles.css";

export function Price({ product, big = false }: { product: Product; big?: boolean }) {
  const { hidden } = useShop();
  const cls = big ? "lx-big-price" : "lx-price";
  if (hidden) return <div className={cls}><em>Valor a confirmar</em></div>;
  return (
    <div className={cls}>
      <span>{money(priceOf(product))}</span>
      {hasDiscount(product) && <s>{money(Number(product.price))}</s>}
    </div>
  );
}

export function Empty({ title, text }: { title: string; text: string }) {
  return (
    <div className="lx-empty" role="status">
      <h2>{title}</h2>
      <p>{text}</p>
    </div>
  );
}

export function Piece({ product }: { product: Product }) {
  const { path, categories, wishlist, toggleWishlist } = useShop();
  const faved = wishlist.includes(product.id);
  const img = imageOf(product);
  const cat = categories.find((c) => c.id === product.category_id)?.name;
  return (
    <article className="lx-card">
      <div className="lx-card-media">
        {img ? <img src={img} alt={product.name} loading="lazy" /> : <span className="ph">Sem imagem</span>}
        {hasDiscount(product) ? <span className="lx-seal">Condição especial</span> : product.is_featured ? <span className="lx-seal">Destaque</span> : null}
      </div>
      <button type="button" className="lx-fav" aria-pressed={faved} aria-label={faved ? `Remover ${product.name} dos favoritos` : `Favoritar ${product.name}`} onClick={() => toggleWishlist(product.id)}>
        <Heart size={18} strokeWidth={1.4} fill={faved ? "currentColor" : "none"} />
      </button>
      <div className="lx-card-body">
        {cat && <span className="lx-card-cat">{cat}</span>}
        <Link className="lx-card-name" to={path(`/produto/${productRouteSegment(product)}`)}>{product.name}</Link>
        <Price product={product} />
      </div>
    </article>
  );
}
