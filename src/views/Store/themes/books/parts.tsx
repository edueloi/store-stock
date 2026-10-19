import { Link } from "react-router-dom";
import { BookOpen, Heart, Plus, Search } from "lucide-react";
import { productRouteSegment } from "../../store-routing";
import type { Product } from "../../../../types";
import { priceInfo, productImage, useKit, useQuickAdd } from "./kit";

/** Livro: capa em proporção 2:3 fixa, título, gênero, preço e botão compacto. */
export function BookCard({ product }: { product: Product }) {
  const { path, hidden, wishlist, toggleWishlist, catName } = useKit();
  const quick = useQuickAdd()(product);
  const price = priceInfo(product, hidden);
  const image = productImage(product);
  const saved = wishlist.includes(product.id);
  const href = path(`/produto/${productRouteSegment(product)}`);
  return (
    <article className="bk-book">
      <div className="bk-cover-wrap">
        <Link to={href} className="bk-cover" aria-label={product.name}>
          {image ? <img src={image} alt={product.name} loading="lazy" /> : <BookOpen size={44} aria-label="Livro sem capa" />}
        </Link>
        {quick.soldOut ? <span className="bk-badge bk-badge-off">Esgotado</span> : price.off ? <span className="bk-badge">Oferta</span> : null}
        <button type="button" className="bk-fav" aria-label={saved ? `Remover ${product.name} dos favoritos` : `Favoritar ${product.name}`} aria-pressed={saved} onClick={() => toggleWishlist(product.id)}>
          <Heart size={17} fill={saved ? "currentColor" : "none"} />
        </button>
      </div>
      <div className="bk-book-body">
        {catName(product) && <span className="bk-genre">{catName(product)}</span>}
        <Link className="bk-title" to={href}>
          {product.name}
        </Link>
        <div className="bk-book-foot">
          <div className="bk-price">
            <strong>{price.now}</strong>
            {price.old && <s>{price.old}</s>}
          </div>
          {quick.hasOptions || quick.soldOut ? (
            <Link className="bk-add bk-add-text" to={href}>
              {quick.soldOut ? "Ver" : "Escolher"}
            </Link>
          ) : (
            <button type="button" className="bk-add" aria-label={`${hidden ? "Incluir no pedido" : "Adicionar"} ${product.name}`} onClick={quick.add}>
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
    <div className="bk-empty">
      <Search size={38} aria-hidden="true" />
      <h2>{title}</h2>
      <p>{text}</p>
      {onClear && (
        <button type="button" className="bk-btn" onClick={onClear}>
          Ver todos os livros
        </button>
      )}
    </div>
  );
}
