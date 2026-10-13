import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import { productRouteSegment } from "../../store-routing";
import { initials, optionGroups, priceInfo, productImage, useKit } from "./kit";
import type { Product } from "../../../../types";
import "./styles.css";

/** Cores de lombada: fundo e tinta com contraste AA. */
export const SPINES: { bg: string; ink: string }[] = [
  { bg: "#9b3e2c", ink: "#fff7ec" },
  { bg: "#2f4a3d", ink: "#f4efe0" },
  { bg: "#1f3a5f", ink: "#f4efe0" },
  { bg: "#d1a23d", ink: "#2a2118" },
  { bg: "#5b3a4e", ink: "#f8eef2" },
  { bg: "#3d5a5a", ink: "#eef6f4" },
  { bg: "#c9b48a", ink: "#2a2118" },
];
export const spineOf = (i: number) => SPINES[i % SPINES.length];
export const spineHeight = (i: number) => [124, 112, 132, 104, 120, 98, 128][i % 7];

export function Ornament({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 160 16" aria-hidden="true" focusable="false">
      <path d="M2 8h58M100 8h58" stroke="currentColor" strokeWidth="1" />
      <path d="M80 1l5 7-5 7-5-7z" fill="currentColor" />
      <circle cx="66" cy="8" r="2" fill="currentColor" />
      <circle cx="94" cy="8" r="2" fill="currentColor" />
    </svg>
  );
}

export function Spine({ to, name, index, count, active }: { to: string; name: string; index: number; count?: number; active?: boolean }) {
  const c = spineOf(index);
  return (
    <Link
      to={to}
      className={`bk-spine ${active ? "is-on" : ""}`}
      aria-current={active ? "true" : undefined}
      style={{ background: c.bg, color: c.ink, height: spineHeight(index) }}
      title={count != null ? `${name} (${count})` : name}
    >
      <span className="bk-spine-band" aria-hidden="true" />
      <span className="bk-spine-text">{name}</span>
    </Link>
  );
}

/** Capa em proporção 2:3 com lombada sombreada. */
export function Cover({ product, index = 0 }: { product: Product; index?: number }) {
  const { path, hidden, addToCart, openCart } = useKit();
  const img = productImage(product);
  const p = priceInfo(product, hidden);
  const simple = optionGroups(product).length === 0;
  const to = path(`/produto/${productRouteSegment(product)}`);
  const c = spineOf(index);
  return (
    <article className="bk-book">
      <Link to={to} className="bk-cover" aria-label={product.name} style={{ background: c.bg, color: c.ink }}>
        {img ? (
          <img src={img} alt={product.name} loading="lazy" />
        ) : (
          <span className="bk-cover-blank">
            <span className="bk-cover-initial">{initials(product.name)}</span>
            <span className="bk-cover-title">{product.name}</span>
          </span>
        )}
        <span className="bk-cover-hinge" aria-hidden="true" />
        {p.off && <span className="bk-seal">Oferta</span>}
      </Link>
      <div className="bk-caption">
        <Link to={to} className="bk-book-title">
          {product.name}
        </Link>
        <p className="bk-book-price">
          <strong>{p.now}</strong>
          {p.old && <s>{p.old}</s>}
        </p>
        {simple ? (
          <button
            className="bk-mini"
            onClick={() => {
              addToCart(product);
              openCart();
            }}
          >
            <Plus size={15} /> Na pilha
          </button>
        ) : (
          <Link to={to} className="bk-mini">
            Ver edições
          </Link>
        )}
      </div>
    </article>
  );
}
