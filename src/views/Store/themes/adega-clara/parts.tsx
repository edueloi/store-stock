import { Link } from "react-router-dom";
import { Heart, Plus, Search, Snowflake, Wine } from "lucide-react";
import { productRouteSegment } from "../../store-routing";
import type { Product } from "../../../../types";
import { isCold, priceInfo, productImage, useKit, useQuickAdd } from "./kit";

export function SearchField({ value, onChange, placeholder, label = "Buscar", autoFocus = false }: { value: string; onChange: (v: string) => void; placeholder: string; label?: string; autoFocus?: boolean }) {
  return (
    <label className="brs-field">
      <Search size={17} aria-hidden="true" />
      <span className="brs-sr">{label}</span>
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
    <article className={`brs-card ${quick.soldOut ? "is-out" : ""}`}>
      <div className="brs-card-media">
        <Link to={href} aria-label={product.name} className="brs-card-img">
          {image ? <img src={image} alt={product.name} loading="lazy" /> : <Wine size={36} aria-label="Produto sem imagem" />}
        </Link>
        <div className="brs-badges">
          {quick.soldOut && <span className="brs-badge is-out">Esgotado</span>}
          {!quick.soldOut && price.off && <span className="brs-badge is-sale">Oferta</span>}
          {cold && <span className="brs-badge is-cold"><Snowflake size={11} aria-hidden="true" /> Gelada</span>}
        </div>
        <button type="button" className="brs-heart" aria-pressed={saved} aria-label={saved ? `Remover ${product.name} dos favoritos` : `Favoritar ${product.name}`} onClick={() => toggleWishlist(product.id)}>
          <Heart size={17} fill={saved ? "currentColor" : "none"} />
        </button>
      </div>
      <div className="brs-card-body">
        {catName(product) && <span className="brs-kicker">{catName(product)}</span>}
        <Link className="brs-card-name" to={href}>{product.name}</Link>
        <div className="brs-card-foot">
          <div className="brs-price">
            {price.old && <s>{price.old}</s>}
            <strong>{price.now}</strong>
            {!hidden && <small>por unidade</small>}
          </div>
          {quick.hasOptions || quick.soldOut ? (
            <Link className="brs-add brs-add-text" to={href}>{quick.soldOut ? "Ver" : "Opções"}</Link>
          ) : (
            <button type="button" className="brs-add" onClick={quick.add} aria-label={`${hidden ? "Incluir no pedido" : "Adicionar"} ${product.name}`}>
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
    <div className="brs-empty">
      <Wine size={36} aria-hidden="true" />
      <h2>{title}</h2>
      <p>{text}</p>
      {onClear && <button type="button" className="brs-btn" onClick={onClear}>Ver todos os produtos</button>}
    </div>
  );
}
