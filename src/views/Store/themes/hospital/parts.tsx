import { Link } from "react-router-dom";
import { Heart, Package, Plus, SlidersHorizontal } from "lucide-react";
import type { Product, Tenant } from "../../../../types";
import { availableUnits, storeTracksStock } from "../../../../utils/storeStock";
import { productRouteSegment } from "../../store-routing";
import { isSoldOut, money, optionGroups, priceOf, productImage, useShop } from "./lib";

export function stockText(tenant: Tenant, p: Product): string {
  if (!storeTracksStock(tenant)) return "Disponível para pedido";
  const skus = Array.isArray(p.skus) ? p.skus : [];
  const units = skus.length ? skus.reduce((s, k) => s + Math.max(0, Number(k.stock) || 0), 0) : availableUnits(p);
  if (units === null) return "Disponível para pedido";
  return units <= 0 ? "Indisponível no momento" : `${units} ${units === 1 ? "unidade" : "unidades"} em estoque`;
}

export function SupplyCard({ product }: { product: Product }) {
  const { tenant, categories, path, hidden, addToCart, wishlist, toggleWishlist } = useShop();
  const img = productImage(product);
  const { current, full, discounted } = priceOf(product);
  const href = path(`/produto/${productRouteSegment(product)}`);
  const out = isSoldOut(tenant, product);
  const needs = optionGroups(product).length > 0;
  const fav = wishlist.includes(product.id);
  const cat = categories.find((c) => c.id === product.category_id)?.name;
  return (
    <article className="ms-card">
      <Link to={href} className="ms-card-img" aria-label={`Ver ${product.name}`}>
        {img ? <img src={img} alt="" loading="lazy" /> : <Package size={44} />}
        {discounted && <span className="ms-chip">Oferta</span>}
      </Link>
      <button className="ms-fav" aria-pressed={fav} aria-label={fav ? `Remover ${product.name} dos favoritos` : `Favoritar ${product.name}`} onClick={() => toggleWishlist(product.id)}>
        <Heart size={19} fill={fav ? "currentColor" : "none"} />
      </button>
      <div className="ms-card-body">
        {cat && <span className="ms-card-cat">{cat}</span>}
        <Link className="ms-card-name" to={href}>{product.name}</Link>
        {product.sku && <span className="ms-code">Cód. {product.sku}</span>}
        <div className="ms-price">
          {hidden ? <em>Valor a confirmar</em> : (<>{discounted && <s>{money(full)}</s>}<b>{money(current)}</b></>)}
        </div>
        {needs ? (
          <Link className="ms-btn ghost sm" to={href}><SlidersHorizontal size={16} />Ver opções</Link>
        ) : (
          <button className="ms-btn sm" disabled={out} onClick={() => addToCart(product)}>
            <Plus size={17} />{out ? "Indisponível" : "Adicionar ao pedido"}
          </button>
        )}
      </div>
    </article>
  );
}
