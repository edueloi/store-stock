import { Link, useParams } from "react-router-dom";
import { Check, Minus, PawPrint, Plus, Repeat, ShieldCheck, ShoppingBag, Truck } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import StockAvailability from "../../../../components/store/StockAvailability";
import { StoreButton } from "../../../../components/store/StoreButton";
import { parseProductIdFromRoute } from "../../store-routing";
import { money, onSale, priceOf, useBuy, useKit } from "./kit";
import { Card, Empty, Price } from "./parts";

export default function StoreProduct() {
  const { productId } = useParams();
  const { tenant, categories, active, path, openCart, hidden } = useKit();
  const product = active.find((p) => p.id === parseProductIdFromRoute(productId));
  const buy = useBuy(product);
  if (!product)
    return (
      <div className="feed-page">
        <div className="feed-wrap feed-pad">
          <Empty title="Produto não encontrado" text="Ele pode ter saído do catálogo." action={<StoreButton asChild className="feed-cta"><Link to={path("/catalogo")}>Voltar aos produtos</Link></StoreButton>} />
        </div>
      </div>
    );
  const cat = categories.find((c) => c.id === product.category_id);
  const img = buy.gallery[buy.photo] || buy.gallery[0];
  const related = active.filter((p) => p.id !== product.id && p.category_id === product.category_id).slice(0, 4);
  const missing = buy.choices.filter((c) => !buy.selected[c.name]).map((c) => c.name);
  return (
    <div className="feed-page">
      <StoreSEO title={`${product.name} - ${tenant.name}`} description={product.description || product.name} image={buy.gallery[0]} url={typeof window !== "undefined" ? window.location.href : ""} type="product" price={hidden ? undefined : String(priceOf(product))} siteName={tenant.name} />
      <div className="feed-wrap">
        <nav className="feed-crumbs" aria-label="Você está em">
          <Link to={path()}>Início</Link> <span aria-hidden="true">›</span> <Link to={path("/catalogo")}>Produtos</Link>
          {cat && <> <span aria-hidden="true">›</span> <Link to={path("/catalogo", { cat: String(cat.id) })}>{cat.name}</Link></>}
        </nav>
        <div className="feed-prod">
          <div className="feed-gallery">
            {buy.gallery.length > 1 && (
              <div className="feed-thumbs">
                {buy.gallery.map((g, i) => (
                  <button key={g + i} type="button" aria-label={`Ver foto ${i + 1}`} aria-current={i === buy.photo} onClick={() => buy.setPhoto(i)}><img src={g} alt="" /></button>
                ))}
              </div>
            )}
            <div className="feed-stage">
              {onSale(product) && !hidden && <span className="feed-tag">Oferta</span>}
              {img ? <img src={img} alt={product.name} /> : <PawPrint size={72} aria-hidden="true" />}
            </div>
          </div>
          <section className="feed-panel" aria-labelledby="feed-ptitle">
            {cat && <span className="feed-eyebrow"><PawPrint size={14} aria-hidden="true" /> {cat.name}</span>}
            <h1 id="feed-ptitle">{product.name}</h1>
            {product.sku && <small className="feed-sku">Cód. {product.sku}</small>}
            <div className="feed-panel-price">
              <Price product={product} big />
              {onSale(product) && !hidden && <span className="feed-save">Economia de {money(Number(product.price) - priceOf(product))}</span>}
            </div>
            <StockAvailability product={product} tenant={tenant} selected={buy.selected} />
            {buy.choices.map((c) => (
              <fieldset key={c.name} className="feed-opt">
                <legend>{c.name}</legend>
                <div>
                  {c.values.map((v) => (
                    <button key={v} type="button" aria-pressed={buy.selected[c.name] === v} onClick={() => buy.choose(c.name, v)}>
                      {buy.selected[c.name] === v && <Check size={15} aria-hidden="true" />} {v}
                    </button>
                  ))}
                </div>
              </fieldset>
            ))}
            <div className="feed-note">
              <label htmlFor="feed-note">Observação (opcional)</label>
              <textarea id="feed-note" rows={2} value={buy.note} onChange={(e) => buy.setNote(e.target.value)} placeholder="Ex.: porte do animal, idade" />
            </div>
            {missing.length > 0 && <p className="feed-hint">Escolha {missing.join(", ")} para continuar.</p>}
            <div className="feed-buyrow">
              <div className="feed-qty">
                <button type="button" aria-label="Diminuir quantidade" onClick={buy.dec} disabled={buy.qty <= 1}><Minus size={16} /></button>
                <output aria-live="polite">{buy.qty}</output>
                <button type="button" aria-label="Aumentar quantidade" onClick={buy.inc} disabled={buy.qty >= buy.max}><Plus size={16} /></button>
              </div>
              <StoreButton type="button" className="feed-cta feed-buy" disabled={!buy.canAdd} onClick={buy.add}>
                <ShoppingBag size={18} aria-hidden="true" /> {buy.soldOut ? "Indisponível" : hidden ? "Incluir no pedido" : "Adicionar à sacola"}
              </StoreButton>
            </div>
            {buy.added && (
              <div className="feed-added" role="status">
                <span>Adicionado à sacola.</span>
                <StoreButton type="button" size="sm" variant="outline" className="feed-ghost" onClick={openCart}>Ver sacola</StoreButton>
              </div>
            )}
            <ul className="feed-seals" aria-label="Garantias">
              <li><ShieldCheck size={18} aria-hidden="true" /> Compra segura</li>
              <li><Truck size={18} aria-hidden="true" /> Entrega combinada</li>
              <li><Repeat size={18} aria-hidden="true" /> Troca facilitada</li>
            </ul>
          </section>
        </div>
        {product.description && (
          <section className="feed-spec" aria-labelledby="feed-spec-t">
            <h2 id="feed-spec-t">Sobre este produto</h2>
            <div>{product.description}</div>
          </section>
        )}
        {related.length > 0 && (
          <section className="feed-related">
            <h2>Quem compra também leva</h2>
            <div className="feed-grid">{related.map((p) => <Card key={p.id} product={p} />)}</div>
          </section>
        )}
      </div>
    </div>
  );
}
