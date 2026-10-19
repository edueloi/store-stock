import { Link } from "react-router-dom";
import { Heart, Package, ShoppingCart } from "lucide-react";
import { StoreButton } from "../../../../components/store/StoreButton";
import { productRouteSegment } from "../../store-routing";
import type { Product } from "../../../../types";
import { hasDiscount, imageOf, money, priceOf, useQuickAdd, useShop } from "./kit";
import "./styles.css";

export function PriceTag({ product, big = false }: { product: Product; big?: boolean }) {
  const { hidden } = useShop();
  const cls = big ? "cy-big-price" : "cy-price";
  if (hidden)
    return (
      <div className={cls}>
        {big ? <strong>Sob consulta</strong> : <em>Sob consulta</em>}
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
    <div className="cy-empty" role="status">
      <strong>{title}</strong>
      <span>{text}</span>
    </div>
  );
}

/** Cartão escuro e arredondado: imagem em quadrado fixo, brilho neon no hover. */
export function NeonCard({ product }: { product: Product }) {
  const { path, categories, wishlist, toggleWishlist, hidden } = useShop();
  const quick = useQuickAdd()(product);
  const faved = wishlist.includes(product.id);
  const cat = categories.find((c) => c.id === product.category_id)?.name;
  const img = imageOf(product);
  const href = path(`/produto/${productRouteSegment(product)}`);
  return (
    <article className="cy-card">
      <div className="cy-card-media">
        {img ? <img src={img} alt={product.name} loading="lazy" /> : <Package className="ph" size={46} aria-label="Produto sem imagem" />}
        {quick.soldOut ? (
          <span className="cy-flag off">Esgotado</span>
        ) : hasDiscount(product) ? (
          <span className="cy-flag hot">Oferta</span>
        ) : product.is_featured ? (
          <span className="cy-flag">Destaque</span>
        ) : null}
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
        {cat && <span className="cy-card-cat">{cat}</span>}
        <Link className="cy-card-name" to={href}>{product.name}</Link>
        <PriceTag product={product} />
        {quick.hasOptions || quick.soldOut ? (
          <StoreButton asChild variant="outline" size="sm" className="cy-card-btn">
            <Link to={href}>{quick.soldOut ? "Ver produto" : "Escolher opções"}</Link>
          </StoreButton>
        ) : (
          <StoreButton size="sm" className="cy-card-btn is-main" onClick={quick.add}>
            <ShoppingCart size={16} /> {hidden ? "Incluir no pedido" : "Adicionar"}
          </StoreButton>
        )}
      </div>
    </article>
  );
}
