import { Link } from "react-router-dom";
import { Heart, Package, ShoppingBasket, Wheat } from "lucide-react";
import { StoreButton } from "../../../../components/store/StoreButton";
import { productRouteSegment } from "../../store-routing";
import type { Product } from "../../../../types";
import { money, onSale, priceOf, productImage, useKit } from "./kit";
import { useQuickAdd } from "./extras";
import "./styles.css";

export function Price({ product, big = false }: { product: Product; big?: boolean }) {
  const { hidden } = useKit();
  const cls = big ? "agro-price agro-price-big" : "agro-price";
  if (hidden)
    return (
      <div className={cls}>
        <em>Sob consulta</em>
      </div>
    );
  return (
    <div className={cls}>
      <strong>{money(priceOf(product))}</strong>
      {onSale(product) && <s>{money(Number(product.price))}</s>}
    </div>
  );
}

/** Card de produto: foto sempre num quadrado fixo (contain), botão de 40px. */
export function Card({ product }: { product: Product }) {
  const { path, categories, wishlist, toggleWishlist, hidden } = useKit();
  const quick = useQuickAdd()(product);
  const img = productImage(product);
  const cat = categories.find((c) => c.id === product.category_id);
  const fav = wishlist.includes(product.id);
  const href = path(`/produto/${productRouteSegment(product)}`);
  return (
    <article className="agro-card">
      <Link className="agro-card-media" to={href} aria-label={product.name}>
        {img ? <img src={img} alt="" loading="lazy" /> : <Package size={48} aria-hidden="true" />}
        {quick.soldOut ? (
          <span className="agro-badge is-off">Esgotado</span>
        ) : onSale(product) ? (
          <span className="agro-badge">Oferta</span>
        ) : null}
      </Link>
      <button
        type="button"
        className="agro-heart"
        aria-pressed={fav}
        aria-label={fav ? `Remover ${product.name} dos favoritos` : `Favoritar ${product.name}`}
        onClick={() => toggleWishlist(product.id)}
      >
        <Heart size={18} fill={fav ? "currentColor" : "none"} />
      </button>
      <div className="agro-card-body">
        {cat && <span className="agro-card-cat">{cat.name}</span>}
        <h3>
          <Link to={href}>{product.name}</Link>
        </h3>
        <Price product={product} />
        {quick.hasOptions || quick.soldOut ? (
          <StoreButton asChild variant="outline" shape="soft" className="agro-card-btn">
            <Link to={href}>{quick.soldOut ? "Ver produto" : "Escolher opções"}</Link>
          </StoreButton>
        ) : (
          <StoreButton type="button" shape="soft" className="agro-card-btn" onClick={quick.add}>
            <ShoppingBasket size={17} aria-hidden="true" /> {hidden ? "Incluir no pedido" : "Adicionar"}
          </StoreButton>
        )}
      </div>
    </article>
  );
}

export function SectionTitle({ eyebrow, title, action }: { eyebrow?: string; title: string; action?: React.ReactNode }) {
  return (
    <div className="agro-title">
      <div>
        {eyebrow && <span className="agro-eyebrow">{eyebrow}</span>}
        <h2>{title}</h2>
      </div>
      {action}
    </div>
  );
}

export function Empty({ title, text, action }: { title: string; text: string; action?: React.ReactNode }) {
  return (
    <div className="agro-empty">
      <Wheat size={42} aria-hidden="true" />
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  );
}
