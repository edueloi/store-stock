import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import { productRouteSegment } from "../../store-routing";
import { initials, optionGroups, priceInfo, productImage, useKit } from "./kit";
import type { Product } from "../../../../types";
import "./styles.css";

export function Steam({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 60 80" aria-hidden="true" focusable="false">
      <path d="M14 76c-8-14 8-18 0-34s8-22 0-36M30 76c-8-14 8-18 0-34s8-22 0-36M46 76c-8-14 8-18 0-34s8-22 0-36" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function Bean({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 40 56" aria-hidden="true" focusable="false">
      <ellipse cx="20" cy="28" rx="16" ry="25" fill="currentColor" />
      <path d="M20 5c-8 12 8 18 0 28s6 14 0 18" fill="none" stroke="#211a16" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

/** Linha de cardápio: foto em arco, nome, descrição, pontilhado e preço à direita. */
export function MenuRow({ product }: { product: Product }) {
  const { path, hidden, addToCart, openCart } = useKit();
  const img = productImage(product);
  const p = priceInfo(product, hidden);
  const simple = optionGroups(product).length === 0;
  const to = path(`/produto/${productRouteSegment(product)}`);
  return (
    <article className="cf-row">
      <Link to={to} className="cf-row-thumb" aria-label={product.name}>
        {img ? <img src={img} alt="" loading="lazy" /> : <span>{initials(product.name)}</span>}
      </Link>
      <div className="cf-row-main">
        <div className="cf-row-line">
          <Link to={to} className="cf-row-name">
            {product.name}
          </Link>
          <span className="cf-leader" aria-hidden="true" />
          <span className="cf-row-price">
            {p.old && <s>{p.old}</s>}
            <strong>{p.now}</strong>
          </span>
        </div>
        {product.description && <p className="cf-row-desc">{product.description}</p>}
      </div>
      {simple ? (
        <button
          className="cf-add"
          aria-label={`Adicionar ${product.name} à comanda`}
          onClick={() => {
            addToCart(product);
            openCart();
          }}
        >
          <Plus size={18} />
        </button>
      ) : (
        <Link to={to} className="cf-add cf-add-text">
          Opções
        </Link>
      )}
    </article>
  );
}

/** Cartão com foto grande em arco. */
export function ArchCard({ product, tall = false }: { product: Product; tall?: boolean }) {
  const { path, hidden } = useKit();
  const img = productImage(product);
  const p = priceInfo(product, hidden);
  const to = path(`/produto/${productRouteSegment(product)}`);
  return (
    <Link to={to} className={`cf-arch-card ${tall ? "is-tall" : ""}`}>
      <span className="cf-arch-photo">
        {img ? <img src={img} alt={product.name} loading="lazy" /> : <span className="cf-arch-initial">{initials(product.name)}</span>}
        {p.off && <em className="cf-tag">Oferta</em>}
      </span>
      <span className="cf-arch-line">
        <span className="cf-arch-name">{product.name}</span>
        <span className="cf-leader" aria-hidden="true" />
        <strong>{p.now}</strong>
      </span>
    </Link>
  );
}
