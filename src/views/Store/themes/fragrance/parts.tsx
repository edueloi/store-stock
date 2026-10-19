import { Link } from "react-router-dom";
import { Droplets, Heart, Search, ShoppingBag } from "lucide-react";
import { StoreButton } from "../../../../components/store/StoreButton";
import { productRouteSegment } from "../../store-routing";
import type { Product } from "../../../../types";
import { priceInfo, productImage, useKit, useQuickAdd } from "./kit";

export function SearchField({ value, onChange, placeholder, label = "Buscar" }: { value: string; onChange: (v: string) => void; placeholder: string; label?: string }) {
  return (
    <label className="frg-field">
      <Search size={18} aria-hidden="true" />
      <span className="frg-sr">{label}</span>
      <input type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </label>
  );
}

/** Frasco sobre palco circular, usado no hero, cards e galeria. */
export function Stage({ src, alt, className = "" }: { src?: string; alt: string; className?: string }) {
  return (
    <div className={`frg-stage ${className}`}>
      <span className="frg-stage-disc" aria-hidden="true" />
      {src ? <img src={src} alt={alt} loading="lazy" /> : <Droplets size={44} aria-label="Sem imagem" />}
      <span className="frg-stage-shadow" aria-hidden="true" />
    </div>
  );
}

export function ProductCard({ product }: { product: Product }) {
  const { path, hidden, wishlist, toggleWishlist, catName } = useKit();
  const quick = useQuickAdd()(product);
  const price = priceInfo(product, hidden);
  const saved = wishlist.includes(product.id);
  const href = path(`/produto/${productRouteSegment(product)}`);
  return (
    <article className="frg-card">
      <div className="frg-card-frame">
        <Link className="frg-card-media" to={href} aria-label={product.name}>
          <Stage src={productImage(product)} alt={product.name} />
          {(quick.soldOut || price.off || product.is_featured) && <span className="frg-badge">{quick.soldOut ? "Esgotado" : price.off ? "Oferta" : "Destaque"}</span>}
        </Link>
        <button type="button" className="frg-heart" aria-pressed={saved} aria-label={saved ? `Remover ${product.name} dos favoritos` : `Favoritar ${product.name}`} onClick={() => toggleWishlist(product.id)}>
          <Heart size={18} fill={saved ? "currentColor" : "none"} />
        </button>
      </div>
      <div className="frg-card-body">
        {catName(product) && <span className="frg-note">{catName(product)}</span>}
        <Link className="frg-card-name" to={href}>{product.name}</Link>
        <div className="frg-price">
          <strong>{price.now}</strong>
          {price.old && <s>{price.old}</s>}
        </div>
        {quick.hasOptions || quick.soldOut ? (
          <StoreButton asChild variant="outline" size="sm" className="frg-btn frg-btn-line">
            <Link to={href}>{quick.soldOut ? "Ver fragrância" : "Escolher opções"}</Link>
          </StoreButton>
        ) : (
          <StoreButton size="sm" className="frg-btn" onClick={quick.add}>
            <ShoppingBag size={16} /> {hidden ? "Incluir no pedido" : "Adicionar"}
          </StoreButton>
        )}
      </div>
    </article>
  );
}

export function Empty({ title, text, onClear }: { title: string; text: string; onClear?: () => void }) {
  return (
    <div className="frg-empty">
      <Droplets size={36} aria-hidden="true" />
      <h2>{title}</h2>
      <p>{text}</p>
      {onClear && <StoreButton className="frg-btn" onClick={onClear}>Ver todas as fragrâncias</StoreButton>}
    </div>
  );
}
