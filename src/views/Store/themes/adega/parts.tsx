import { Link } from "react-router-dom";
import { Heart, Plus, Search, Snowflake, Wine } from "lucide-react";
import { productRouteSegment } from "../../store-routing";
import type { Product } from "../../../../types";
import { isCold, priceInfo, productImage, useKit, useQuickAdd } from "./kit";

export function SearchField({ value, onChange, placeholder, label = "Buscar", autoFocus = false }: { value: string; onChange: (v: string) => void; placeholder: string; label?: string; autoFocus?: boolean }) {
  return (
    <label className="adg-field">
      <Search size={17} aria-hidden="true" />
      <span className="adg-sr">{label}</span>
      <input type="search" value={value} autoFocus={autoFocus} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </label>
  );
}

export function ProductCard({ product }: { product: Product }) {
  const { path, hidden, wishlist, toggleWishlist, catName } = useKit();
  const quick = useQuickAdd()(product);
  const price = priceInfo(product, hidden);
  const image = productImage(product);
  const saved = wishlist.includes(product.id);
  const href = path(`/produto/${productRouteSegment(product)}`);
  const cold = isCold(product) && !quick.soldOut;
  return (
    <article className={`adg-card ${quick.soldOut ? "is-out" : ""}`}>
      <div className="adg-card-media">
        <Link to={href} aria-label={product.name} className="adg-card-img">
          {image ? <img src={image} alt={product.name} loading="lazy" /> : <Wine size={36} aria-label="Produto sem imagem" />}
        </Link>
        <div className="adg-badges">
          {quick.soldOut && <span className="adg-badge is-out">Esgotado</span>}
          {!quick.soldOut && price.off && <span className="adg-badge is-sale">Oferta</span>}
          {cold && <span className="adg-badge is-cold"><Snowflake size={11} aria-hidden="true" /> Gelada</span>}
        </div>
        <button type="button" className="adg-heart" aria-pressed={saved} aria-label={saved ? `Remover ${product.name} dos favoritos` : `Favoritar ${product.name}`} onClick={() => toggleWishlist(product.id)}>
          <Heart size={17} fill={saved ? "currentColor" : "none"} />
        </button>
      </div>
      <div className="adg-card-body">
        {catName(product) && <span className="adg-kicker">{catName(product)}</span>}
        <Link className="adg-card-name" to={href}>{product.name}</Link>
        <div className="adg-card-foot">
          <div className="adg-price">
            {price.old && <s>{price.old}</s>}
            <strong>{price.now}</strong>
            {!hidden && <small>por unidade</small>}
          </div>
          {quick.hasOptions || quick.soldOut ? (
            <Link className="adg-add adg-add-text" to={href}>{quick.soldOut ? "Ver" : "Opções"}</Link>
          ) : (
            <button type="button" className="adg-add" onClick={quick.add} aria-label={`${hidden ? "Incluir no pedido" : "Adicionar"} ${product.name}`}>
              <Plus size={20} />
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

export function Empty({ title, text, onClear }: { title: string; text: string; onClear?: () => void }) {
  return (
    <div className="adg-empty">
      <Wine size={36} aria-hidden="true" />
      <h2>{title}</h2>
      <p>{text}</p>
      {onClear && <button type="button" className="adg-btn" onClick={onClear}>Ver todos os produtos</button>}
    </div>
  );
}
