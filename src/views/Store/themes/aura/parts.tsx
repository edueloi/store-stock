import { Link } from "react-router-dom";
import { ArrowUpRight, Heart, Image as ImageIcon, ShoppingBag } from "lucide-react";
import { productRouteSegment } from "../../store-routing";
import type { Product } from "../../../../types";
import { hasDiscount, imageOf, money, priceOf, useQuickAdd, useShop } from "./kit";
import "./styles.css";

export function Price({ product, big = false }: { product: Product; big?: boolean }) {
  const { hidden } = useShop();
  const cls = big ? "au-big-price" : "au-price";
  if (hidden)
    return (
      <div className={cls}>
        <em>Sob consulta</em>
      </div>
    );
  return (
    <div className={cls}>
      <strong>{money(priceOf(product))}</strong>
      {hasDiscount(product) && <s>{money(Number(product.price))}</s>}
    </div>
  );
}

export function Empty({ title, text }: { title: string; text: string }) {
  return (
    <div className="au-empty" role="status">
      <ImageIcon size={34} aria-hidden="true" />
      <h2>{title}</h2>
      <p>{text}</p>
    </div>
  );
}

/** Cartão suave: imagem em retângulo fixo 4:5 e botão redondo que sobe no hover. */
export function SoftCard({ product, feature = false }: { product: Product; feature?: boolean }) {
  const { path, categories, wishlist, toggleWishlist, hidden } = useShop();
  const quick = useQuickAdd()(product);
  const faved = wishlist.includes(product.id);
  const img = imageOf(product);
  const cat = categories.find((c) => c.id === product.category_id)?.name;
  const href = path(`/produto/${productRouteSegment(product)}`);
  return (
    <article className={`au-card${feature ? " is-feature" : ""}`}>
      <div className="au-card-media">
        {img ? <img src={img} alt={product.name} loading="lazy" /> : <ImageIcon className="ph" size={42} aria-label="Produto sem imagem" />}
        {quick.soldOut ? (
          <span className="au-tag off">Esgotado</span>
        ) : hasDiscount(product) ? (
          <span className="au-tag sale">Oferta</span>
        ) : product.is_featured ? (
          <span className="au-tag">Favorito</span>
        ) : null}
        {quick.hasOptions || quick.soldOut ? (
          <Link className="au-go" to={href} aria-label={`Ver ${product.name}`}>
            <ArrowUpRight size={20} />
          </Link>
        ) : (
          <button type="button" className="au-go" aria-label={hidden ? `Incluir ${product.name} no pedido` : `Adicionar ${product.name} à sacola`} onClick={quick.add}>
            <ShoppingBag size={19} />
          </button>
        )}
      </div>
      <button
        type="button"
        className="au-fav"
        aria-pressed={faved}
        aria-label={faved ? `Remover ${product.name} dos favoritos` : `Favoritar ${product.name}`}
        onClick={() => toggleWishlist(product.id)}
      >
        <Heart size={18} fill={faved ? "currentColor" : "none"} />
      </button>
      <div className="au-card-body">
        {cat && <span className="au-card-cat">{cat}</span>}
        <Link className="au-card-name" to={href}>{product.name}</Link>
        {feature && product.description && <p className="au-card-desc">{product.description}</p>}
        <Price product={product} />
      </div>
    </article>
  );
}
