import { Link } from "react-router-dom";
import { Check, Heart, ImageOff, Minus, Plus, Share2, ShoppingBag } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import StockAvailability from "../../../../components/store/StockAvailability";
import Card from "./Card";
import { hasDiscount, money, priceOf, useProductState } from "./kit";
import "./styles.css";

export default function StoreProduct() {
  const s = useProductState();
  const { product, tenant, categories, path, hidden, wishlist, toggleWishlist, waLink } = s;

  if (!product)
    return (
      <main className="pp-page">
        <div className="pp-blank">
          <p className="pp-hand">Página arrancada!</p>
          <p>Não encontramos esse produto.</p>
          <Link className="pp-btn" to={path("/catalogo")}>Voltar ao catálogo</Link>
        </div>
      </main>
    );

  const category = categories.find((c) => c.id === product.category_id);
  const liked = wishlist.includes(product.id);
  const related = s.active.filter((p) => p.id !== product.id && p.category_id === product.category_id).slice(0, 4);
  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ title: product.name, url: window.location.href });
      else await navigator.clipboard.writeText(window.location.href);
    } catch {
      /* cancelado */
    }
  };

  return (
    <main className="pp-page">
      <StoreSEO title={`${product.name} — ${tenant.name}`} description={product.description || product.name} image={s.images[0]} url={typeof window !== "undefined" ? window.location.href : ""} type="product" price={hidden ? undefined : String(priceOf(product))} siteName={tenant.name} />
      <div className="pp-section pp-prod">
        <nav className="pp-crumbs" aria-label="Você está em">
          <Link to={path()}>Início</Link> › <Link to={path("/catalogo")}>Catálogo</Link>
          {category && <> › <Link to={path(`/catalogo?categoria=${category.id}`)}>{category.name}</Link></>}
        </nav>
        <div className="pp-prod-grid">
          <section aria-label="Fotos do produto" className="pp-prod-photos">
            <div className="pp-polaroid pp-polaroid-lg">
              <span className="pp-tape" aria-hidden="true" />
              <div className="pp-polaroid-img">{s.images.length ? <img src={s.images[s.activeImage] || s.images[0]} alt={product.name} /> : <ImageOff size={56} aria-hidden="true" />}</div>
              {hasDiscount(product) && !hidden && <span className="pp-sticker pp-sticker-big">promo!</span>}
            </div>
            {s.images.length > 1 && (
              <div className="pp-thumbs">
                {s.images.map((im, i) => (
                  <button key={im + i} className={i === s.activeImage ? "is-on" : ""} aria-label={`Ver foto ${i + 1}`} aria-current={i === s.activeImage} onClick={() => s.setActiveImage(i)}><img src={im} alt="" /></button>
                ))}
              </div>
            )}
          </section>

          <section className="pp-sheet">
            {category && <span className="pp-label">{category.name}</span>}
            <h1 className="pp-h1 pp-h1-sm">{product.name}</h1>
            {product.sku && <p className="pp-ref">ref. {product.sku}</p>}
            {hidden ? (
              <p className="pp-price-big pp-price-ask">Sob consulta</p>
            ) : (
              <p className="pp-price-big">{hasDiscount(product) && <s>{money(Number(product.price))}</s>}{money(priceOf(product))}</p>
            )}
            {product.description && <p className="pp-desc">{product.description}</p>}

            {s.groups.map((g) => (
              <fieldset key={g.name} className="pp-opt">
                <legend>{g.name}: <b>{s.selected[g.name] || "escolha uma"}</b></legend>
                <div>
                  {g.values.map((v) => {
                    const on = s.selected[g.name] === v;
                    return <button key={v} type="button" aria-pressed={on} className={on ? "is-on" : ""} onClick={() => s.choose(g.name, v)}>{on && <Check size={14} aria-hidden="true" />}{v}</button>;
                  })}
                </div>
              </fieldset>
            ))}
            {s.groups.length > 0 && !s.ready && <p className="pp-hint">Escolha todas as opções para levar.</p>}
            <StockAvailability product={product} tenant={tenant} selected={s.selected} className="pp-stock" />

            <div className="pp-buyrow">
              <div className="pp-qty" role="group" aria-label="Quantidade">
                <button aria-label="Diminuir quantidade" onClick={() => s.setQuantity(Math.max(1, s.qty - 1))}><Minus size={16} /></button>
                <span aria-live="polite">{s.qty}</span>
                <button aria-label="Aumentar quantidade" disabled={s.qty >= s.maxQty} onClick={() => s.setQuantity(Math.min(s.maxQty, s.qty + 1))}><Plus size={16} /></button>
              </div>
              <button className="pp-btn pp-btn-lg" disabled={!s.canAdd} onClick={s.add}>
                <ShoppingBag size={18} aria-hidden="true" /> {s.soldOut ? "Esgotado" : hidden ? "Incluir no pedido" : "Adicionar ao carrinho"}
              </button>
            </div>
            <div className="pp-links">
              <button aria-pressed={liked} onClick={() => toggleWishlist(product.id)}><Heart size={16} fill={liked ? "currentColor" : "none"} aria-hidden="true" /> {liked ? "Favoritado" : "Favoritar"}</button>
              <button onClick={share}><Share2 size={16} aria-hidden="true" /> Compartilhar</button>
              {tenant.whatsapp && <a href={waLink(`Olá! Tenho dúvidas sobre ${product.name}.`)} target="_blank" rel="noreferrer">Perguntar no WhatsApp</a>}
            </div>
          </section>
        </div>

        {related.length > 0 && (
          <section className="pp-related">
            <h2 className="pp-title"><span>Tem a ver com este</span></h2>
            <div className="pp-grid">{related.map((p, i) => <Card key={p.id} product={p} index={i + 1} />)}</div>
          </section>
        )}
      </div>
    </main>
  );
}
