import { useState } from "react";
import { Link } from "react-router-dom";
import { Heart, ListPlus, Package, SlidersHorizontal } from "lucide-react";
import type { Product, Tenant } from "../../../../types";
import { availableUnits, storeTracksStock } from "../../../../utils/storeStock";
import { productRouteSegment } from "../../store-routing";
import { isSoldOut, money, optionGroups, priceOf, productImage, useShop } from "./lib";

export function stockText(tenant: Tenant, p: Product): string {
  if (!storeTracksStock(tenant)) return "Disponível";
  const skus = Array.isArray(p.skus) ? p.skus : [];
  const units = skus.length ? skus.reduce((s, k) => s + Math.max(0, Number(k.stock) || 0), 0) : availableUnits(p);
  if (units === null) return "Disponível";
  return units <= 0 ? "Esgotado" : `${units} un.`;
}

export function ToolCard({ product }: { product: Product }) {
  const { tenant, categories, path, hidden, addToCart, wishlist, toggleWishlist } = useShop();
  const img = productImage(product);
  const { current, full, discounted } = priceOf(product);
  const href = path(`/produto/${productRouteSegment(product)}`);
  const out = isSoldOut(tenant, product);
  const needs = optionGroups(product).length > 0;
  const fav = wishlist.includes(product.id);
  const cat = categories.find((c) => c.id === product.category_id)?.name || "Geral";
  return (
    <article className="op-card">
      <Link to={href} className="op-card-img" aria-label={`Ver ${product.name}`}>
        {img ? <img src={img} alt="" loading="lazy" /> : <Package size={44} />}
        {discounted ? <span className="op-tag y">Oferta</span> : product.is_featured ? <span className="op-tag">Destaque</span> : null}
      </Link>
      <button className="op-fav" aria-pressed={fav} aria-label={fav ? `Remover ${product.name} dos favoritos` : `Favoritar ${product.name}`} onClick={() => toggleWishlist(product.id)}>
        <Heart size={19} fill={fav ? "currentColor" : "none"} />
      </button>
      <div className="op-card-body">
        <Link className="op-card-name" to={href}>{product.name}</Link>
        <dl className="op-ficha">
          <dt>Ref.</dt><dd>{product.sku || `#${product.id}`}</dd>
          <dt>Depto.</dt><dd title={cat}>{cat}</dd>
          <dt>Disp.</dt><dd>{stockText(tenant, product)}</dd>
        </dl>
        <div className="op-price">
          {hidden ? <em>Valor a confirmar</em> : (<>{discounted && <s>{money(full)}</s>}<b>{money(current)}</b></>)}
        </div>
        {needs ? (
          <Link className="op-btn dark sm" to={href}><SlidersHorizontal size={15} />Escolher opções</Link>
        ) : (
          <button className="op-btn sm" disabled={out} onClick={() => addToCart(product)}>
            <ListPlus size={16} />{out ? "Esgotado" : "Adicionar à lista"}
          </button>
        )}
      </div>
    </article>
  );
}

/** Coluna lateral de departamentos (fixa no desktop, acordeão no mobile). */
export function Sidebar({ selected, onSelect }: { selected: string; onSelect: (id: string) => void }) {
  const { categories, active, tenant } = useShop();
  const [open, setOpen] = useState(false);
  const depts = categories.filter((c) => active.some((p) => p.category_id === c.id));
  const current = depts.find((c) => String(c.id) === selected)?.name;
  return (
    <aside className={`op-side ${open ? "open" : ""}`} aria-label="Departamentos">
      <h2 onClick={() => setOpen((v) => !v)}>
        <span>Departamentos</span>
        <span className="op-side-toggle">{current || "Todos"} {open ? "−" : "+"}</span>
      </h2>
      <ul>
        <li><button aria-pressed={!selected} onClick={() => { onSelect(""); setOpen(false); }}>Todos os itens<small>{active.length}</small></button></li>
        {depts.map((c) => (
          <li key={c.id}>
            <button aria-pressed={selected === String(c.id)} onClick={() => { onSelect(String(c.id)); setOpen(false); }}>
              {c.name}<small>{active.filter((p) => p.category_id === c.id).length}</small>
            </button>
          </li>
        ))}
      </ul>
      <div className="op-side-box"><b>Dica:</b> monte sua lista de materiais e finalize o pedido {tenant.whatsapp ? "ou chame a loja no WhatsApp" : "online"}.</div>
    </aside>
  );
}
