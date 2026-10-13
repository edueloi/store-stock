import { Link } from "react-router-dom";
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
      <main className="mn-page">
        <div className="mn-none">
          <p>Produto não encontrado.</p>
          <Link className="mn-btn" to={path("/catalogo")}>Voltar ao catálogo</Link>
        </div>
      </main>
    );

  const category = categories.find((c) => c.id === product.category_id);
  const liked = wishlist.includes(product.id);
  const related = s.active.filter((p) => p.id !== product.id && p.category_id === product.category_id).slice(0, 4);

  return (
    <main className="mn-page">
      <StoreSEO title={`${product.name} — ${tenant.name}`} description={product.description || product.name} image={s.images[0]} url={typeof window !== "undefined" ? window.location.href : ""} type="product" price={hidden ? undefined : String(priceOf(product))} siteName={tenant.name} />
      <div className="mn-section mn-prod">
        <div className="mn-prod-media">
          <div className="mn-prod-main">
            {s.images.length ? <img src={s.images[s.activeImage] || s.images[0]} alt={product.name} /> : <span>Sem foto</span>}
          </div>
          {s.images.length > 1 && (
            <div className="mn-thumbs">
              {s.images.map((im, i) => (
                <button key={im + i} className={i === s.activeImage ? "is-on" : ""} aria-label={`Ver foto ${i + 1}`} aria-current={i === s.activeImage} onClick={() => s.setActiveImage(i)}><img src={im} alt="" /></button>
              ))}
            </div>
          )}
        </div>

        <div className="mn-prod-buy">
          <nav className="mn-crumbs" aria-label="Você está em">
            <Link to={path("/catalogo")}>Catálogo</Link>
            {category && <> / <Link to={path(`/catalogo?categoria=${category.id}`)}>{category.name}</Link></>}
          </nav>
          <h1>{product.name}</h1>
          {hidden ? (
            <p className="mn-prod-price mn-muted">Sob consulta</p>
          ) : (
            <p className="mn-prod-price">{money(priceOf(product))}{hasDiscount(product) && <s>{money(Number(product.price))}</s>}</p>
          )}
          {product.description && <p className="mn-desc">{product.description}</p>}

          {s.groups.map((g) => (
            <fieldset key={g.name} className="mn-opt">
              <legend>{g.name}{s.selected[g.name] ? <span> — {s.selected[g.name]}</span> : null}</legend>
              <div>
                {g.values.map((v) => (
                  <button key={v} type="button" aria-pressed={s.selected[g.name] === v} className={s.selected[g.name] === v ? "is-on" : ""} onClick={() => s.choose(g.name, v)}>{v}</button>
                ))}
              </div>
            </fieldset>
          ))}
          {s.groups.length > 0 && !s.ready && <p className="mn-hint">Selecione todas as opções.</p>}
          <StockAvailability product={product} tenant={tenant} selected={s.selected} className="mn-stock" />

          <div className="mn-buyrow">
            <div className="mn-qty" role="group" aria-label="Quantidade">
              <button aria-label="Diminuir quantidade" onClick={() => s.setQuantity(Math.max(1, s.qty - 1))}>−</button>
              <span aria-live="polite">{s.qty}</span>
              <button aria-label="Aumentar quantidade" disabled={s.qty >= s.maxQty} onClick={() => s.setQuantity(Math.min(s.maxQty, s.qty + 1))}>+</button>
            </div>
            <button className="mn-btn mn-btn-full" disabled={!s.canAdd} onClick={s.add}>
              {s.soldOut ? "Esgotado" : hidden ? "Incluir no pedido" : "Adicionar ao carrinho"}
            </button>
          </div>
          <div className="mn-prod-links">
            <button aria-pressed={liked} onClick={() => toggleWishlist(product.id)}>{liked ? "Nos favoritos" : "Favoritar"}</button>
            {tenant.whatsapp && <a href={waLink(`Olá! Tenho dúvidas sobre ${product.name}.`)} target="_blank" rel="noreferrer">Dúvidas pelo WhatsApp</a>}
            {product.sku && <span>Ref. {product.sku}</span>}
          </div>
        </div>
      </div>
      {related.length > 0 && (
        <section className="mn-section">
          <header className="mn-sec-head"><h2>Veja também</h2></header>
          <div className="mn-grid">{related.map((p) => <Card key={p.id} product={p} />)}</div>
        </section>
      )}
    </main>
  );
}
