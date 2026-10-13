import { Link, useParams } from "react-router-dom";
import { Check, Minus, Plus, ShoppingBasket, Sprout } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import StockAvailability from "../../../../components/store/StockAvailability";
import { parseProductIdFromRoute } from "../../store-routing";
import { money, onSale, priceOf, useBuy, useKit } from "./kit";
import { Empty, Leaf, Masonry } from "./parts";

export default function StoreProduct() {
  const { productId } = useParams();
  const { tenant, categories, active, path, openCart, hidden } = useKit();
  const product = active.find((p) => p.id === parseProductIdFromRoute(productId));
  const buy = useBuy(product);
  if (!product)
    return (
      <div className="garden-page"><div className="garden-wrap" style={{ padding: "56px 22px" }}>
        <Empty title="Produto não encontrado" text="Ele pode ter saído do catálogo." action={<Link className="garden-btn" style={{ marginTop: 14 }} to={path("/catalogo")}>Voltar ao catálogo</Link>} />
      </div></div>
    );
  const cat = categories.find((c) => c.id === product.category_id);
  const img = buy.gallery[buy.photo] || buy.gallery[0];
  const related = active.filter((p) => p.id !== product.id && p.category_id === product.category_id).slice(0, 4);
  const missing = buy.choices.filter((c) => !buy.selected[c.name]).map((c) => c.name);
  return (
    <div className="garden-page">
      <StoreSEO title={`${product.name} - ${tenant.name}`} description={product.description || product.name} image={buy.gallery[0]} url={typeof window !== "undefined" ? window.location.href : ""} type="product" price={hidden ? undefined : String(priceOf(product))} siteName={tenant.name} />
      <div className="garden-wrap">
        <nav className="garden-crumbs" aria-label="Você está em">
          <Link to={path()}>Início</Link> / <Link to={path("/catalogo")}>Catálogo</Link>
          {cat && <> / <Link to={path("/catalogo", { cat: String(cat.id) })}>{cat.name}</Link></>}
        </nav>
        <div className="garden-prod">
          <div>
            <div className="garden-arch">
              {onSale(product) && <span className="garden-sale" style={{ top: "auto", bottom: 18, left: "50%", transform: "translateX(-50%)" }}><Leaf size={13} /> Oferta</span>}
              {img ? <img src={img} alt={product.name} /> : <Sprout size={96} aria-hidden />}
            </div>
            {buy.gallery.length > 1 && (
              <div className="garden-thumbs">
                {buy.gallery.map((g, i) => <button key={g + i} aria-label={`Ver foto ${i + 1}`} aria-current={i === buy.photo} onClick={() => buy.setPhoto(i)}><img src={g} alt="" /></button>)}
              </div>
            )}
          </div>
          <section className="garden-buy" aria-labelledby="garden-ptitle">
            <span className="garden-eyebrow"><Leaf size={18} /> {cat ? cat.name : "Horta Viva"}</span>
            <h1 id="garden-ptitle">{product.name}</h1>
            <div className="garden-bigprice">
              {hidden ? <em>Valor a confirmar</em> : (
                <>
                  <span>{money(priceOf(product))}</span>
                  {onSale(product) && <s>{money(Number(product.price))}</s>}
                </>
              )}
            </div>
            <div className="garden-buy-form">
              <StockAvailability product={product} tenant={tenant} selected={buy.selected} />
              {buy.choices.map((c) => (
                <fieldset key={c.name} className="garden-opt">
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
              <div className="garden-note">
                <label htmlFor="garden-note">Observação (opcional)</label>
                <textarea id="garden-note" value={buy.note} onChange={(e) => buy.setNote(e.target.value)} placeholder="Ex.: preferência de variedade, retirada na loja" />
              </div>
              {missing.length > 0 && <p className="garden-hint">Escolha {missing.join(", ")} para adicionar à seleção.</p>}
              <div className="garden-qty-row">
                <div className="garden-qty">
                  <button aria-label="Diminuir quantidade" onClick={buy.dec} disabled={buy.qty <= 1}><Minus size={16} /></button>
                  <output aria-live="polite">{buy.qty}</output>
                  <button aria-label="Aumentar quantidade" onClick={buy.inc} disabled={buy.qty >= buy.max}><Plus size={16} /></button>
                </div>
                <button className="garden-btn" disabled={!buy.canAdd} onClick={buy.add}>
                  <ShoppingBasket size={19} aria-hidden /> {buy.soldOut ? "Indisponível" : "Adicionar à seleção"}
                </button>
              </div>
              {buy.added && (
                <div className="garden-added" role="status">
                  <span>Adicionado à sua seleção verde.</span>
                  <button className="garden-btn" onClick={openCart}>Ver seleção</button>
                </div>
              )}
            </div>
          </section>
        </div>

        {(product.description || product.sku) && (
          <section className="garden-grow" aria-labelledby="garden-grow-t">
            <div className="garden-grow-main">
              <Leaf size={90} className="" />
              <span className="garden-eyebrow"><Sprout size={18} aria-hidden /> Guia de cultivo</span>
              <h2 id="garden-grow-t">Sobre {product.name}</h2>
              <p>{product.description || "Consulte a loja para saber mais sobre este produto."}</p>
            </div>
            <div className="garden-grow-side">
              {cat && <div className="garden-fact"><small>Coleção</small><b>{cat.name}</b></div>}
              {product.sku && <div className="garden-fact"><small>Código</small><b>{product.sku}</b></div>}
            </div>
          </section>
        )}
        {related.length > 0 && (
          <section style={{ paddingBottom: 60 }}>
            <div className="garden-head"><h2 className="garden-title">Combina <em>com</em></h2></div>
            <Masonry products={related} />
          </section>
        )}
      </div>
    </div>
  );
}
