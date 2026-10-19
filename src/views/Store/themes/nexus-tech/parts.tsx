import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Check, Headset, Heart, Package, ShieldCheck, ShoppingBag, Truck } from "lucide-react";
import { useStore } from "../../StoreLayout";
import { productRouteSegment } from "../../store-routing";
import type { Product } from "../../../../types";
import { availableUnits, storeTracksStock } from "../../../../utils/storeStock";
import { StoreButton } from "../../../../components/store/StoreButton";
import { groups, imageOf, money, pricesHidden, unitPrice, useTheme } from "./lib";

export const PERKS = [
  { icon: ShieldCheck, title: "Garantia", text: "Compre com a segurança de produtos conferidos e garantia conforme a política da loja." },
  { icon: Headset, title: "Suporte", text: "Atendimento próximo para tirar dúvidas antes e depois da compra." },
  { icon: Truck, title: "Entrega", text: "Receba em casa ou combine a retirada, de acordo com as opções da loja." },
];

export function Price({ product, large = false }: { product: Product; large?: boolean }) {
  const { tenant } = useStore();
  if (pricesHidden(tenant)) return <div className={`nx-price ${large ? "nx-price-lg" : ""}`}><strong className="nx-consult">Sob consulta</strong></div>;
  return (
    <div className={`nx-price ${large ? "nx-price-lg" : ""}`}>
      <strong>{money(unitPrice(product))}</strong>
      {product.discount_price != null && <s>{money(Number(product.price))}</s>}
    </div>
  );
}

export function Card({ product }: { product: Product }) {
  const { categories, tenant, addToCart, wishlist, toggleWishlist } = useStore();
  const { path } = useTheme();
  const [done, setDone] = useState(false);
  const img = imageOf(product);
  const to = path(`/produto/${productRouteSegment(product)}`);
  const cat = categories.find((c) => c.id === product.category_id);
  const options = groups(product).length > 0;
  const soldOut = storeTracksStock(tenant) && availableUnits(product) === 0;
  const fav = wishlist.includes(product.id);
  const add = () => {
    addToCart(product);
    setDone(true);
    window.setTimeout(() => setDone(false), 1400);
  };
  return (
    <article className="nx-card">
      <div className="nx-card-media">
        <Link to={to} aria-label={product.name} tabIndex={-1}>
          {img ? <img src={img} alt="" loading="lazy" /> : <Package size={48} aria-hidden="true" />}
        </Link>
        {product.discount_price != null && <span className="nx-badge">Oferta</span>}
        {soldOut && <span className="nx-badge nx-badge-off">Esgotado</span>}
        <button type="button" className={`nx-heart ${fav ? "is-on" : ""}`} aria-label={fav ? "Remover dos favoritos" : "Adicionar aos favoritos"} aria-pressed={fav} onClick={() => toggleWishlist(product.id)}>
          <Heart size={18} fill={fav ? "currentColor" : "none"} />
        </button>
      </div>
      <div className="nx-card-body">
        {cat && <small>{cat.name}</small>}
        <Link to={to} className="nx-card-name">{product.name}</Link>
        <div className="nx-card-foot">
          <Price product={product} />
          {soldOut ? (
            <Link to={to} className="nx-btn nx-btn-ghost nx-btn-sm">Ver produto</Link>
          ) : options ? (
            <Link to={to} className="nx-btn nx-btn-sm">Escolher <ArrowUpRight size={15} aria-hidden="true" /></Link>
          ) : (
            <StoreButton size="sm" className="nx-btn nx-btn-sm" onClick={add}>
              {done ? <Check size={15} aria-hidden="true" /> : <ShoppingBag size={15} aria-hidden="true" />}
              {done ? "Adicionado" : "Comprar"}
            </StoreButton>
          )}
        </div>
      </div>
    </article>
  );
}
