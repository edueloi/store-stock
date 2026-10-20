import { Link } from "react-router-dom";
import { Check, Heart, Package, ShoppingCart } from "lucide-react";
import { useState } from "react";
import { useStore } from "../../StoreLayout";
import { productRouteSegment } from "../../store-routing";
import type { Product } from "../../../../types";
import { availableUnits, storeTracksStock } from "../../../../utils/storeStock";
import { StoreButton } from "../../../../components/store/StoreButton";
import { groups, imageOf, isTech, money, pricesHidden, unitPrice, useTheme } from "./lib";

export function PriceBlock({ product, big = false }: { product: Product; big?: boolean }) {
  const { tenant } = useStore();
  if (pricesHidden(tenant)) return <div className={`ep-price ${big ? "ep-price-big" : ""}`}><strong className="ep-consult">Sob consulta</strong></div>;
  return (
    <div className={`ep-price ${big ? "ep-price-big" : ""}`}>
      {Number(product.discount_price) > 0 && <s>{money(Number(product.price))}</s>}
      <strong>{money(unitPrice(product))}</strong>
    </div>
  );
}

export function SpecChips({ product, max = 3 }: { product: Product; max?: number }) {
  const gs = groups(product);
  if (!gs.length) return null;
  const sorted = [...gs].sort((a, b) => Number(isTech(b.name)) - Number(isTech(a.name))).slice(0, max);
  return (
    <ul className="ep-specs">
      {sorted.map((g) => (
        <li key={g.name} className={isTech(g.name) ? "ep-spec-tech" : ""}>
          <span>{g.name}</span>
          <b>{g.values.slice(0, 4).join(" · ")}{g.values.length > 4 ? ` +${g.values.length - 4}` : ""}</b>
        </li>
      ))}
    </ul>
  );
}

export function useProductState(product: Product) {
  const { tenant } = useStore();
  const options = groups(product).length > 0;
  const units = storeTracksStock(tenant) ? availableUnits(product) : null;
  return { options, soldOut: units === 0 };
}

export function ProductRow({ product }: { product: Product }) {
  const { categories, addToCart, wishlist, toggleWishlist } = useStore();
  const { path } = useTheme();
  const { options, soldOut } = useProductState(product);
  const [done, setDone] = useState(false);
  const img = imageOf(product);
  const to = path(`/produto/${productRouteSegment(product)}`);
  const cat = categories.find((c) => c.id === product.category_id);
  const fav = wishlist.includes(product.id);
  const add = () => {
    addToCart(product);
    setDone(true);
    window.setTimeout(() => setDone(false), 1400);
  };
  return (
    <article className="ep-row">
      <Link to={to} className="ep-row-img" aria-label={product.name}>
        {img ? <img src={img} alt="" loading="lazy" /> : <Package size={28} aria-hidden="true" />}
        {product.discount_price != null && <span className="ep-tag">Oferta</span>}
      </Link>
      <div className="ep-row-code">
        <small>Código</small>
        <span>{product.sku || `#${product.id}`}</span>
      </div>
      <div className="ep-row-info">
        {cat && <small>{cat.name}</small>}
        <Link to={to} className="ep-row-name">{product.name}</Link>
        <SpecChips product={product} />
      </div>
      <PriceBlock product={product} />
      <div className="ep-row-act">
        <button type="button" className={`ep-fav-btn ${fav ? "is-on" : ""}`} aria-label={fav ? "Remover dos favoritos" : "Adicionar aos favoritos"} aria-pressed={fav} onClick={() => toggleWishlist(product.id)}>
          <Heart size={18} fill={fav ? "currentColor" : "none"} />
        </button>
        {soldOut ? (
          <span className="ep-btn ep-btn-off">Esgotado</span>
        ) : options ? (
          <Link to={to} className="ep-btn ep-btn-line">Escolher opções</Link>
        ) : (
          <StoreButton size="sm" className="ep-btn" onClick={add}>
            {done ? <Check size={16} aria-hidden="true" /> : <ShoppingCart size={16} aria-hidden="true" />}
            {done ? "Adicionado" : "Adicionar"}
          </StoreButton>
        )}
      </div>
    </article>
  );
}
