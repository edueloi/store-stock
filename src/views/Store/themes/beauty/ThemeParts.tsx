import { Link } from "react-router-dom";
import { Heart, Search, ShoppingBag, Sparkles } from "lucide-react";
import { StoreButton } from "../../../../components/store/StoreButton";
import { productRouteSegment } from "../../store-routing";
import type { Product } from "../../../../types";
import { priceInfo, productImage, useKit, useQuickAdd } from "./kit";

/** Campo de busca do tema (pílula com ícone). */
export function SearchField({ value, onChange, placeholder, label = "Buscar" }: { value: string; onChange: (v: string) => void; placeholder: string; label?: string }) {
  return (
    <label className="bty-field">
      <Search size={17} aria-hidden="true" />
      <span className="bty-sr">{label}</span>
      <input type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
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
    <article className="bty-card">
      <div className="bty-card-frame">
        <Link className="bty-card-media" to={href} aria-label={product.name}>
          {image ? <img src={image} alt={product.name} loading="lazy" /> : <Sparkles size={34} aria-label="Produto sem imagem" />}
          {(quick.soldOut || price.off || product.is_featured) && <span className="bty-tag">{quick.soldOut ? "Esgotado" : price.off ? "Oferta" : "Destaque"}</span>}
        </Link>
        <button type="button" className="bty-heart" aria-pressed={saved} aria-label={saved ? `Remover ${product.name} dos favoritos` : `Favoritar ${product.name}`} onClick={() => toggleWishlist(product.id)}>
          <Heart size={18} fill={saved ? "currentColor" : "none"} />
        </button>
      </div>
      <div className="bty-card-body">
        {catName(product) && <span className="bty-eyebrow">{catName(product)}</span>}
        <Link className="bty-card-name" to={href}>{product.name}</Link>
        <div className="bty-price">
          <strong>{price.now}</strong>
          {price.old && <s>{price.old}</s>}
        </div>
        {quick.hasOptions || quick.soldOut ? (
          <StoreButton asChild variant="outline" size="sm" className="bty-btn bty-btn-line">
            <Link to={href}>{quick.soldOut ? "Ver produto" : "Escolher opções"}</Link>
          </StoreButton>
        ) : (
          <StoreButton size="sm" className="bty-btn" onClick={quick.add}>
            <ShoppingBag size={16} /> {hidden ? "Incluir no pedido" : "Adicionar"}
          </StoreButton>
        )}
      </div>
    </article>
  );
}

export function Empty({ title, text, onClear }: { title: string; text: string; onClear?: () => void }) {
  return (
    <div className="bty-empty">
      <Sparkles size={34} aria-hidden="true" />
      <h2>{title}</h2>
      <p>{text}</p>
      {onClear && (
        <StoreButton className="bty-btn" onClick={onClear}>Ver todos os produtos</StoreButton>
      )}
    </div>
  );
}
