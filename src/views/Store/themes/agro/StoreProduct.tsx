import { Link, useParams } from "react-router-dom";
import { Check, Minus, Package, Plus, ShoppingCart } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import StockAvailability from "../../../../components/store/StockAvailability";
import { parseProductIdFromRoute } from "../../store-routing";
import { onSale, priceOf, useBuy, useKit } from "./kit";
import { Card, Empty, Price, Seal } from "./parts";

export default function StoreProduct() {
  const { productId } = useParams();
  const { tenant, categories, active, path, openCart, hidden } = useKit();
  const product = active.find((p) => p.id === parseProductIdFromRoute(productId));
  const buy = useBuy(product);
  if (!product)
    return (
      <div className="agro-page"><div className="agro-wrap" style={{ padding: "56px 20px" }}>
        <Empty title="Produto não encontrado" text="Ele pode ter saído do catálogo." action={<Link className="agro-btn" style={{ marginTop: 14 }} to={path("/catalogo")}>Voltar ao catálogo</Link>} />
      </div></div>
    );
  const cat = categories.find((c) => c.id === product.category_id);
  const img = buy.gallery[buy.photo] || buy.gallery[0];
  const related = active.filter((p) => p.id !== product.id && p.category_id === product.category_id).slice(0, 4);
  const missing = buy.choices.filter((c) => !buy.selected[c.name]).map((c) => c.name);
  return (
    <div className="agro-page">
      <StoreSEO title={`${product.name} - ${tenant.name}`} description={product.description || product.name} image={buy.gallery[0]} url={typeof window !== "undefined" ? window.location.href : ""} type="product" price={hidden ? undefined : String(priceOf(product))} siteName={tenant.name} />
      <div className="agro-wrap">
        <nav className="agro-crumbs" aria-label="Você está em">
          <Link to={path()}>Início</Link> / <Link to={path("/catalogo")}>Catálogo</Link>
          {cat && <> / <Link to={path("/catalogo", { cat: String(cat.id) })}>{cat.name}</Link></>}
        </nav>
        <div className="agro-prod">
          <div className="agro-gallery">
            {buy.gallery.length > 1 && (
              <div className="agro-thumbs">
                {buy.gallery.map((g, i) => (
                  <button key={g + i} aria-label={`Ver foto ${i + 1}`} aria-current={i === buy.photo} onClick={() => buy.setPhoto(i)}><img src={g} alt="" /></button>
                ))}
              </div>
            )}
            <div className="agro-stage">
              {onSale(product) && <span className="agro-ribbon">Oferta do campo</span>}
              {img ? <img src={img} alt={product.name} /> : <Package size={80} aria-hidden />}
            </div>
          </div>
          <section className="agro-panel" aria-labelledby="agro-ptitle">
            <div className="agro-panel-head">
              {cat && <span className="agro-tag is-gold">{cat.name}</span>}
              <h1 id="agro-ptitle">{product.name}</h1>
              {product.sku && <small style={{ opacity: .8 }}>Cód. {product.sku}</small>}
            </div>
            <div className="agro-panel-body">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                <div>
                  <Price product={product} big />
                  {onSale(product) && !hidden && <p style={{ margin: "6px 0 0", fontWeight: 700 }}>Economia de {(Number(product.price) - priceOf(product)).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</p>}
                  {hidden && <p style={{ margin: "6px 0 0" }}>Valor a confirmar com a loja.</p>}
                </div>
                {onSale(product) && <Seal className="" text="OFERTA DO CAMPO" />}
              </div>
              <StockAvailability product={product} tenant={tenant} selected={buy.selected} />
              {buy.choices.map((c) => (
                <fieldset key={c.name} className="agro-opt">
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
              <div className="agro-note">
                <label htmlFor="agro-note">Observação (opcional)</label>
                <textarea id="agro-note" value={buy.note} onChange={(e) => buy.setNote(e.target.value)} placeholder="Ex.: retirada na loja, combinar entrega" />
              </div>
              {missing.length > 0 && <p className="agro-hint">Escolha: {missing.join(", ")} para adicionar ao pedido.</p>}
              <div className="agro-buyrow">
                <div className="agro-qty">
                  <button aria-label="Diminuir quantidade" onClick={buy.dec} disabled={buy.qty <= 1}><Minus size={16} /></button>
                  <output aria-live="polite">{buy.qty}</output>
                  <button aria-label="Aumentar quantidade" onClick={buy.inc} disabled={buy.qty >= buy.max}><Plus size={16} /></button>
                </div>
                <button className="agro-btn" disabled={!buy.canAdd} onClick={buy.add}>
                  <ShoppingCart size={18} aria-hidden /> {buy.soldOut ? "Indisponível" : "Adicionar ao pedido"}
                </button>
              </div>
              {buy.added && (
                <div className="agro-added" role="status">
                  <span>Item adicionado ao pedido.</span>
                  <button className="agro-btn" onClick={openCart}>Ver pedido</button>
                </div>
              )}
            </div>
          </section>
        </div>

        {product.description && (
          <section className="agro-spec" aria-labelledby="agro-spec-t">
            <h2 id="agro-spec-t">Ficha do produto</h2>
            <div className="agro-spec-body">{product.description}</div>
          </section>
        )}
        {related.length > 0 && (
          <section style={{ paddingBottom: 64 }}>
            <div className="agro-section-title"><h2>Mais do mesmo departamento</h2></div>
            <div className="agro-grid">{related.map((p) => <Card key={p.id} product={p} />)}</div>
          </section>
        )}
      </div>
    </div>
  );
}
