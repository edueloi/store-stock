import { useRef } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ChevronLeft, ChevronRight, Heart, PawPrint, Plus, ShoppingBag } from "lucide-react";
import { StoreButton } from "../../../../components/store/StoreButton";
import { productRouteSegment } from "../../store-routing";
import type { Product } from "../../../../types";
import { money, onSale, priceOf, productImage, useKit } from "./kit";
import { useQuickAdd } from "./extras";
import "./styles.css";

export function Price({ product, big = false }: { product: Product; big?: boolean }) {
  const { hidden } = useKit();
  return (
    <div className={big ? "feed-price feed-price-big" : "feed-price"}>
      {hidden ? (
        <em>Sob consulta</em>
      ) : (
        <>
          <strong>{money(priceOf(product))}</strong>
          {onSale(product) && <s>{money(Number(product.price))}</s>}
        </>
      )}
    </div>
  );
}

/** Card: foto em retângulo 4:3 fixo (contain) e botão "+" redondo ao lado do preço. */
export function Card({ product }: { product: Product }) {
  const { path, categories, wishlist, toggleWishlist, hidden } = useKit();
  const quick = useQuickAdd()(product);
  const img = productImage(product);
  const cat = categories.find((c) => c.id === product.category_id);
  const fav = wishlist.includes(product.id);
  const href = path(`/produto/${productRouteSegment(product)}`);
  const off = onSale(product) ? Math.round((1 - priceOf(product) / Number(product.price)) * 100) : 0;
  return (
    <article className="feed-card">
      <Link className="feed-card-media" to={href} aria-label={product.name}>
        {img ? <img src={img} alt="" loading="lazy" /> : <PawPrint size={44} aria-hidden="true" />}
        {quick.soldOut ? <span className="feed-tag is-off">Esgotado</span> : off > 0 && !hidden ? <span className="feed-tag">-{off}%</span> : product.is_featured ? <span className="feed-tag is-new">Favorito</span> : null}
      </Link>
      <button type="button" className="feed-heart" aria-pressed={fav} aria-label={fav ? `Remover ${product.name} dos favoritos` : `Favoritar ${product.name}`} onClick={() => toggleWishlist(product.id)}>
        <Heart size={18} fill={fav ? "currentColor" : "none"} />
      </button>
      <div className="feed-card-body">
        {cat && <span className="feed-card-cat">{cat.name}</span>}
        <h3>
          <Link to={href}>{product.name}</Link>
        </h3>
        <div className="feed-card-foot">
          <Price product={product} />
          {quick.hasOptions || quick.soldOut ? (
            <StoreButton asChild variant="outline" size="sm" className="feed-optbtn">
              <Link to={href}>{quick.soldOut ? "Ver" : "Opções"}</Link>
            </StoreButton>
          ) : (
            <StoreButton type="button" size="icon" className="feed-add" onClick={quick.add} aria-label={`${hidden ? "Incluir no pedido" : "Adicionar"} ${product.name}`}>
              <Plus size={20} aria-hidden="true" />
            </StoreButton>
          )}
        </div>
      </div>
    </article>
  );
}

/** Prateleira de uma espécie: título, "ver tudo" e fileira com scroll-snap e setas. */
export function Shelf({ id, name, count, items }: { id: number; name: string; count: number; items: Product[] }) {
  const { path } = useKit();
  const row = useRef<HTMLDivElement>(null);
  const scroll = (dir: number) => {
    const el = row.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  };
  return (
    <section className="feed-shelf" aria-label={name}>
      <header>
        <div>
          <h2>{name}</h2>
          <span>{count} {count === 1 ? "produto" : "produtos"}</span>
        </div>
        <div className="feed-shelf-ctrl">
          <Link to={path("/catalogo", id ? { cat: String(id) } : undefined)}>Ver tudo <ArrowRight size={15} aria-hidden="true" /></Link>
          <button type="button" aria-label={`${name}: anterior`} onClick={() => scroll(-1)}><ChevronLeft size={20} /></button>
          <button type="button" aria-label={`${name}: próximos`} onClick={() => scroll(1)}><ChevronRight size={20} /></button>
        </div>
      </header>
      <div className="feed-row" ref={row} data-no-fx>
        {items.slice(0, 10).map((p) => (
          <div key={p.id} className="feed-row-item"><Card product={p} /></div>
        ))}
      </div>
    </section>
  );
}

export function Empty({ title, text, action }: { title: string; text: string; action?: React.ReactNode }) {
  return (
    <div className="feed-empty">
      <ShoppingBag size={40} aria-hidden="true" />
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  );
}
