import { Link } from "react-router-dom";
import { Heart, Package, Plus, SlidersHorizontal } from "lucide-react";
import type { Product, Tenant } from "../../../../types";
import { availableUnits, storeTracksStock } from "../../../../utils/storeStock";
import { productRouteSegment } from "../../store-routing";
import { isSoldOut, money, optionGroups, priceOf, productImage, useShop } from "./lib";

export function stockInfo(tenant: Tenant, p: Product): { text: string; out: boolean } {
  if (!storeTracksStock(tenant)) return { text: "Disponível", out: false };
  const skus = Array.isArray(p.skus) ? p.skus : [];
  const units = skus.length ? skus.reduce((s, k) => s + Math.max(0, Number(k.stock) || 0), 0) : availableUnits(p);
  if (units === null) return { text: "Disponível", out: false };
  if (units <= 0) return { text: "Esgotado", out: true };
  return { text: `${units} em estoque`, out: false };
}

export function TableHead() {
  return (
    <div className="tg-row tg-row-head" role="row">
      <span>Foto</span>
      <span>Código</span>
      <span>Peça</span>
      <span className="tg-stock-col">Disponib.</span>
      <span style={{ textAlign: "right" }}>Preço</span>
      <span />
    </div>
  );
}

export function SkuRow({ product }: { product: Product }) {
  const { tenant, categories, path, hidden, addToCart, wishlist, toggleWishlist } = useShop();
  const img = productImage(product);
  const { current, full, discounted } = priceOf(product);
  const href = path(`/produto/${productRouteSegment(product)}`);
  const stock = stockInfo(tenant, product);
  const out = isSoldOut(tenant, product);
  const needsOptions = optionGroups(product).length > 0;
  const fav = wishlist.includes(product.id);
  const cat = categories.find((c) => c.id === product.category_id)?.name;
  return (
    <div className="tg-row" role="row">
      <Link to={href} className="tg-thumb" aria-label={`Ver ${product.name}`}>
        {img ? <img src={img} alt="" loading="lazy" /> : <Package size={28} />}
      </Link>
      <span className="tg-sku tg-sku-col">{product.sku || `ID-${String(product.id).padStart(5, "0")}`}</span>
      <div className="tg-row-name">
        <Link to={href}>{product.name}</Link>
        {cat && <small>{cat}</small>}
      </div>
      <span className="tg-stock-col">
        <span className={`tg-stock ${stock.out ? "out" : ""}`}>{stock.text}</span>
      </span>
      <div className="tg-price">
        {hidden ? (
          <em>Sob consulta</em>
        ) : (
          <>
            {discounted && <s>{money(full)}</s>}
            {money(current)}
          </>
        )}
      </div>
      <div className="tg-row-act">
        <button className="tg-fav" aria-label={fav ? `Remover ${product.name} dos favoritos` : `Favoritar ${product.name}`} aria-pressed={fav} onClick={() => toggleWishlist(product.id)}>
          <Heart size={18} fill={fav ? "currentColor" : "none"} />
        </button>
        {needsOptions ? (
          <Link className="tg-btn" to={href}>
            <SlidersHorizontal size={16} />
            Opções
          </Link>
        ) : (
          <button className="tg-btn" disabled={out} onClick={() => addToCart(product)} aria-label={`Adicionar ${product.name} ao pedido`}>
            <Plus size={16} />
            {out ? "Esgotado" : "Adicionar"}
          </button>
        )}
      </div>
    </div>
  );
}
