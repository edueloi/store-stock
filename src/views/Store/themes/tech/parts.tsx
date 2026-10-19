import { Link } from "react-router-dom";
import { Heart, Package, ShoppingBag } from "lucide-react";
import { StoreButton } from "../../../../components/store/StoreButton";
import { productRouteSegment } from "../../store-routing";
import type { Product } from "../../../../types";
import { groupsOf, hasDiscount, imageOf, money, priceOf, useQuickAdd, useShop } from "./kit";
import "./styles.css";

export function Price({ product, big = false }: { product: Product; big?: boolean }) {
  const { hidden } = useShop();
  const cls = big ? "tp-big-price" : "tp-price";
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
    <div className="tp-empty" role="status">
      <h2>{title}</h2>
      <p>{text}</p>
    </div>
  );
}

/** Cartão com imagem em quadrado fixo, preço claro e botão de tamanho moderado. */
export function TechCard({ product }: { product: Product }) {
  const { path, categories, wishlist, toggleWishlist, hidden } = useShop();
  const quick = useQuickAdd()(product);
  const faved = wishlist.includes(product.id);
  const img = imageOf(product);
  const cat = categories.find((c) => c.id === product.category_id)?.name;
  const href = path(`/produto/${productRouteSegment(product)}`);
  const options = groupsOf(product).flatMap((g) => g.values).length;
  return (
    <article className="tp-card">
      <div className="tp-card-media">
        {img ? <img src={img} alt={product.name} loading="lazy" /> : <Package className="ph" size={44} aria-label="Produto sem imagem" />}
        {quick.soldOut ? (
          <span className="tp-badge off">Esgotado</span>
        ) : hasDiscount(product) ? (
          <span className="tp-badge sale">Oferta</span>
        ) : product.is_featured ? (
          <span className="tp-badge">Destaque</span>
        ) : null}
      </div>
      <button
        type="button"
        className="tp-fav"
        aria-pressed={faved}
        aria-label={faved ? `Remover ${product.name} dos favoritos` : `Favoritar ${product.name}`}
        onClick={() => toggleWishlist(product.id)}
      >
        <Heart size={18} fill={faved ? "currentColor" : "none"} />
      </button>
      <div className="tp-card-body">
        {cat && <span className="tp-card-cat">{cat}</span>}
        <Link className="tp-card-name" to={href}>
          {product.name}
        </Link>
        {options > 0 && (
          <span className="tp-card-opts">
            {options} {options === 1 ? "opção" : "opções"} disponíveis
          </span>
        )}
        <Price product={product} />
        {quick.hasOptions || quick.soldOut ? (
          <StoreButton asChild variant="secondary" size="sm" className="tp-card-btn">
            <Link to={href}>{quick.soldOut ? "Ver produto" : "Escolher opções"}</Link>
          </StoreButton>
        ) : (
          <StoreButton size="sm" className="tp-card-btn is-main" onClick={quick.add}>
            <ShoppingBag size={16} /> {hidden ? "Incluir no pedido" : "Adicionar"}
          </StoreButton>
        )}
      </div>
    </article>
  );
}
