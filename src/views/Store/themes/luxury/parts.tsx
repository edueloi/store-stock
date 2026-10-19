import { Link } from "react-router-dom";
import { Gem, Heart, Search, ShoppingBag } from "lucide-react";
import { StoreButton } from "../../../../components/store/StoreButton";
import { productRouteSegment } from "../../store-routing";
import type { Product } from "../../../../types";
import { priceInfo, productImage, useKit, useQuickAdd } from "./kit";

export function SearchField({ value, onChange, placeholder, label = "Buscar", autoFocus = false }: { value: string; onChange: (v: string) => void; placeholder: string; label?: string; autoFocus?: boolean }) {
  return (
    <label className="lux-field">
      <Search size={17} aria-hidden="true" />
      <span className="lux-sr">{label}</span>
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
  return (
    <article className="lux-card">
      <div className="lux-card-frame">
        <Link className="lux-card-media" to={href} aria-label={product.name}>
          {image ? <img src={image} alt={product.name} loading="lazy" /> : <Gem size={34} aria-label="Produto sem imagem" />}
          {(quick.soldOut || price.off || product.is_featured) && <span className="lux-tag">{quick.soldOut ? "Esgotado" : price.off ? "Oferta" : "Destaque"}</span>}
        </Link>
        <button type="button" className="lux-heart" aria-pressed={saved} aria-label={saved ? `Remover ${product.name} dos favoritos` : `Favoritar ${product.name}`} onClick={() => toggleWishlist(product.id)}>
          <Heart size={18} fill={saved ? "currentColor" : "none"} />
        </button>
      </div>
      <div className="lux-card-body">
        {catName(product) && <span className="lux-eyebrow">{catName(product)}</span>}
        <Link className="lux-card-name" to={href}>{product.name}</Link>
        <div className="lux-price">
          <strong>{price.now}</strong>
          {price.old && <s>{price.old}</s>}
        </div>
        {quick.hasOptions || quick.soldOut ? (
          <StoreButton asChild variant="outline" size="sm" className="lux-btn lux-btn-line">
            <Link to={href}>{quick.soldOut ? "Ver peça" : "Escolher opções"}</Link>
          </StoreButton>
        ) : (
          <StoreButton size="sm" className="lux-btn lux-btn-line" onClick={quick.add}>
            <ShoppingBag size={16} /> {hidden ? "Incluir no pedido" : "Adicionar"}
          </StoreButton>
        )}
      </div>
    </article>
  );
}

export function Empty({ title, text, onClear }: { title: string; text: string; onClear?: () => void }) {
  return (
    <div className="lux-empty">
      <Gem size={34} aria-hidden="true" />
      <h2>{title}</h2>
      <p>{text}</p>
      {onClear && <StoreButton className="lux-btn" onClick={onClear}>Ver toda a coleção</StoreButton>}
    </div>
  );
}
