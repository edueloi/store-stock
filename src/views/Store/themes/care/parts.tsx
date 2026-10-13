import { useRef, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight, Heart, Package, Plus } from "lucide-react";
import { productRouteSegment } from "../../store-routing";
import { availableUnits } from "../../../../utils/storeStock";
import type { Product } from "../../../../types";
import { optionGroups, priceOf, productImage, useShop } from "./core";
import "./styles.css";

export const T = {
  name: "Farma Essencial",
  tag: "Farmácia & Dermocosméticos",
  hero: "Seu momento de cuidado.",
  sub: "Uma seleção para sua rotina de higiene, beleza e bem-estar.",
  catalog: "Sua rotina essencial",
  categories: "Explore os cuidados",
  featured: "Para o seu dia a dia",
  cart: "Sua rotina selecionada",
};

/** Folha/gota decorativa usada como marca quando a loja não tem logo. */
export function Drop({ size = 22 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path d="M12 2.5c4 5 7 8.4 7 12a7 7 0 0 1-14 0c0-3.600 3-7 7-12z" fill="currentColor" />
      <path d="M9 15a3 3 0 0 0 3 3" stroke="#fff" strokeWidth="1.600" strokeLinecap="round" fill="none" opacity=".8" />
    </svg>
  );
}

export function Blob({ className = "" }: { className?: string }) {
  return (
    <svg className={`ca-blob ${className}`} viewBox="0 0 200 200" aria-hidden="true">
      <path d="M44 -52c15 9 27 25 28 42s-9 35-24 47-35 17-53 9S-35 20-40 2s4-37 18-49 48-13 66-5z" transform="translate(100 100) scale(1.5)" fill="currentColor" />
    </svg>
  );
}

export function ProductCard({ product }: { product: Product }) {
  const { path, hidden, categories, wishlist, toggleWishlist, addToCart, tracks } = useShop();
  const to = path(`/produto/${productRouteSegment(product)}`);
  const price = priceOf(product, hidden);
  const img = productImage(product);
  const liked = wishlist.includes(product.id);
  const units = tracks ? availableUnits(product) : null;
  const out = units !== null && units <= 0;
  const needsOptions = optionGroups(product).length > 0;
  const category = categories.find((c) => c.id === product.category_id)?.name;
  return (
    <article className="ca-card">
      <div className="ca-card-media">
        <Link to={to} aria-label={product.name} className="ca-card-img">
          {img ? <img src={img} alt="" loading="lazy" /> : <Package size={42} aria-hidden="true" />}
        </Link>
        <button type="button" className="ca-like" aria-label={liked ? "Remover dos favoritos" : "Favoritar produto"} aria-pressed={liked} onClick={() => toggleWishlist(product.id)}>
          <Heart size={18} fill={liked ? "currentColor" : "none"} />
        </button>
        {price.old && <span className="ca-tag">Oferta</span>}
      </div>
      <div className="ca-card-body">
        {category && <small>{category}</small>}
        <Link to={to} className="ca-card-name">{product.name}</Link>
        <div className="ca-card-foot">
          <div className="ca-price">
            <strong className={hidden ? "is-hidden" : ""}>{price.now}</strong>
            {price.old && <s>{price.old}</s>}
          </div>
          {needsOptions || out ? (
            <Link to={to} className="ca-round" aria-label={out ? `${product.name}: indisponível` : `Escolher opções de ${product.name}`}>
              <ChevronRight size={20} />
            </Link>
          ) : (
            <button type="button" className="ca-round" aria-label={`Adicionar ${product.name} ao carrinho`} onClick={() => addToCart(product)}>
              <Plus size={20} />
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

/** Carrossel horizontal com setas e rolagem por encaixe (scroll-snap). */
export function Rail({ title, to, children }: { title: string; to?: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const go = (dir: number) => ref.current?.scrollBy({ left: dir * Math.max(240, ref.current.clientWidth * 0.8), behavior: "smooth" });
  return (
    <section className="ca-rail">
      <div className="ca-rail-head">
        <h2>{title}</h2>
        <div className="ca-rail-ctl">
          {to && <Link to={to} className="ca-link">Ver todos</Link>}
          <button type="button" aria-label="Rolar para a esquerda" onClick={() => go(-1)}><ChevronLeft size={20} /></button>
          <button type="button" aria-label="Rolar para a direita" onClick={() => go(1)}><ChevronRight size={20} /></button>
        </div>
      </div>
      <div className="ca-rail-track" ref={ref} tabIndex={0} role="group" aria-label={title}>{children}</div>
    </section>
  );
}
