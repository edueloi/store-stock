import { Link } from "react-router-dom";
import { Cpu, Heart } from "lucide-react";
import { productRouteSegment } from "../../store-routing";
import type { Product } from "../../../../types";
import { hasDiscount, imageOf, money, pad, priceOf, useShop } from "./kit";
import "./styles.css";

export function PriceTag({ product, big = false }: { product: Product; big?: boolean }) {
  const { hidden } = useShop();
  if (hidden)
    return big ? (
      <div className="cy-big-price"><strong>Sob consulta</strong></div>
    ) : (
      <div className="cy-price"><em>Sob consulta</em></div>
    );
  const old = hasDiscount(product) ? <s>{money(Number(product.price))}</s> : null;
  return big ? (
    <div className="cy-big-price"><strong>{money(priceOf(product))}</strong>{old}</div>
  ) : (
    <div className="cy-price"><strong>{money(priceOf(product))}</strong>{old}</div>
  );
}

export function Empty({ title, text }: { title: string; text: string }) {
  return (
    <div className="cy-empty" role="status">
      <strong>{`> ${title}`}</strong>
      <span>{text}</span>
    </div>
  );
}

/** Cartão de circuito: pinos no topo, imagem, nome e preço. */
export function CircuitCard({ product, index }: { product: Product; index: number }) {
  const { path, categories, wishlist, toggleWishlist } = useShop();
  const faved = wishlist.includes(product.id);
  const cat = categories.find((c) => c.id === product.category_id)?.name || "Módulo geral";
  const img = imageOf(product);
  return (
    <article className="cy-card">
      <div className="cy-card-pins" aria-hidden="true">
        <span>ID·{pad(index + 1)}</span>
        <b>{product.sku ? `REF ${product.sku}` : "●●●"}</b>
      </div>
      <div className="cy-card-media">
        {img ? <img src={img} alt={product.name} loading="lazy" /> : <Cpu className="ph" size={54} aria-label="Produto sem imagem" />}
        {hasDiscount(product) ? <span className="cy-flag">Oferta</span> : product.is_featured ? <span className="cy-flag">Destaque</span> : null}
      </div>
      <button
        type="button"
        className="cy-fav"
        aria-label={faved ? `Remover ${product.name} dos favoritos` : `Favoritar ${product.name}`}
        aria-pressed={faved}
        onClick={() => toggleWishlist(product.id)}
      >
        <Heart size={18} fill={faved ? "currentColor" : "none"} />
      </button>
      <div className="cy-card-body">
        <span className="cy-card-cat">{cat}</span>
        <Link className="cy-card-name" to={path(`/produto/${productRouteSegment(product)}`)}>
          {product.name}
        </Link>
        <PriceTag product={product} />
      </div>
    </article>
  );
}
