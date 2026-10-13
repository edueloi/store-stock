import { Link, useParams } from "react-router-dom";
import { Check, Minus, Plus, ShoppingBasket } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import StockAvailability from "../../../../components/store/StockAvailability";
import { parseProductIdFromRoute } from "../../store-routing";
import { money, onSale, priceOf, useBuy, useKit } from "./kit";
import { Empty, Grain, Paw, Shelf } from "./parts";

export default function StoreProduct() {
  const { productId } = useParams();
  const { tenant, categories, active, path, openCart, hidden } = useKit();
  const product = active.find((p) => p.id === parseProductIdFromRoute(productId));
  const buy = useBuy(product);
  if (!product)
    return (
      <div className="feed-page"><div className="feed-wrap" style={{ padding: "56px 20px" }}>
        <Empty title="Produto não encontrado" text="Ele pode ter saído da prateleira." action={<Link className="feed-btn" style={{ marginTop: 14 }} to={path("/catalogo")}>Voltar ao catálogo</Link>} />
      </div></div>
    );
  const cat = categories.find((c) => c.id === product.category_id);
  const img = buy.gallery[buy.photo] || buy.gallery[0];
  const related = active.filter((p) => p.id !== product.id && p.category_id === product.category_id).slice(0, 8);
  const missing = buy.choices.filter((c) => !buy.selected[c.name]).map((c) => c.name);
  return (
    <div className="feed-page">
      <StoreSEO title={`${product.name} - ${tenant.name}`} description={product.description || product.name} image={buy.gallery[0]} url={typeof window !== "undefined" ? window.location.href : ""} type="product" price={hidden ? undefined : String(priceOf(product))} siteName={tenant.name} />
      <div className="feed-wrap">
        <nav className="feed-crumbs" aria-label="Você está em">
          <Link to={path()}>Início</Link> › <Link to={path("/catalogo")}>Catálogo</Link>
          {cat && <> › <Link to={path("/catalogo", { cat: String(cat.id) })}>{cat.name}</Link></>}
        </nav>
        <div className="feed-prod">
          <div className="feed-display">
            <div className="feed-display-stage">
              {img ? <img src={img} alt={product.name} /> : <Grain size={96} />}
            </div>
            <div className="feed-plank" aria-hidden />
            {buy.gallery.length > 1 && (
              <div className="feed-thumbs">
                {buy.gallery.map((g, i) => <button key={g + i} aria-label={`Ver foto ${i + 1}`} aria-current={i === buy.photo} onClick={() => buy.setPhoto(i)}><img src={g} alt="" /></button>)}
              </div>
            )}
          </div>
          <section className="feed-buybox" aria-labelledby="feed-ptitle">
            <div className="feed-buy-top">
              <span className="feed-kicker"><Paw size={14} /> {cat ? cat.name : "Na prateleira"}</span>
              <h1 id="feed-ptitle">{product.name}</h1>
              {product.sku && <small style={{ color: "var(--feed-muted)" }}>Cód. {product.sku}</small>}
            </div>
            <div className="feed-tag-price">
              {hidden ? <strong style={{ fontSize: 28 }}>Valor a confirmar</strong> : (
                <div><strong>{money(priceOf(product))}</strong>{onSale(product) && <s>{money(Number(product.price))}</s>}</div>
              )}
              {onSale(product) && !hidden && <span>Oferta</span>}
            </div>
            <div className="feed-buy-body">
              <StockAvailability product={product} tenant={tenant} selected={buy.selected} />
              {buy.choices.map((c) => (
                <fieldset key={c.name} className="feed-opt">
                  <legend>{c.name}</legend>
                  <div>
                    {c.values.map((v) => (
                      <button key={v} type="button" aria-pressed={buy.selected[c.name] === v} onClick={() => buy.choose(c.name, v)}>
                        {buy.selected[c.name] === v && <Check size={14} aria-hidden style={{ marginRight: 4, verticalAlign: "-2px" }} />}{v}
                      </button>
                    ))}
                  </div>
                </fieldset>
              ))}
              <div className="feed-note">
                <label htmlFor="feed-note">Observação (opcional)</label>
                <textarea id="feed-note" value={buy.note} onChange={(e) => buy.setNote(e.target.value)} placeholder="Ex.: porte do animal, retirada na loja" />
              </div>
              {missing.length > 0 && <p className="feed-hint">Escolha {missing.join(", ")} para colocar na cesta.</p>}
              <div className="feed-qty-row">
                <div className="feed-qty">
                  <button aria-label="Diminuir quantidade" onClick={buy.dec} disabled={buy.qty <= 1}><Minus size={16} /></button>
                  <output aria-live="polite">{buy.qty}</output>
                  <button aria-label="Aumentar quantidade" onClick={buy.inc} disabled={buy.qty >= buy.max}><Plus size={16} /></button>
                </div>
                <button className="feed-btn" disabled={!buy.canAdd} onClick={buy.add}>
                  <ShoppingBasket size={19} aria-hidden /> {buy.soldOut ? "Indisponível" : "Colocar na cesta"}
                </button>
              </div>
              {buy.added && (
                <div className="feed-added" role="status">
                  <span>Item na cesta!</span>
                  <button className="feed-btn" onClick={openCart}>Ver cesta</button>
                </div>
              )}
            </div>
          </section>
        </div>
        {product.description && (
          <section className="feed-care" aria-labelledby="feed-care-t">
            <h2 id="feed-care-t"><Grain size={28} /> Nutrição e cuidados</h2>
            <div className="feed-care-text">{product.description}</div>
          </section>
        )}
        {related.length > 0 && <div style={{ paddingBottom: 60 }}><Shelf title="Na mesma prateleira" kicker="Veja também" to={cat ? path("/catalogo", { cat: String(cat.id) }) : undefined} products={related} /></div>}
      </div>
    </div>
  );
}
