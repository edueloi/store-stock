import { Link, useParams } from "react-router-dom";
import { Check, Leaf, Minus, Plus, Repeat, ShieldCheck, ShoppingBasket, Sprout, Truck } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import StockAvailability from "../../../../components/store/StockAvailability";
import { StoreButton } from "../../../../components/store/StoreButton";
import { parseProductIdFromRoute } from "../../store-routing";
import { money, onSale, priceOf, useBuy, useKit } from "./kit";
import { Card, Empty, Price, SectionTitle } from "./parts";

export default function StoreProduct() {
  const { productId } = useParams();
  const { tenant, categories, active, path, openCart, hidden } = useKit();
  const product = active.find((p) => p.id === parseProductIdFromRoute(productId));
  const buy = useBuy(product);
  if (!product)
    return (
      <div className="garden-page">
        <div className="garden-wrap garden-section">
          <Empty title="Produto não encontrado" text="Ele pode ter saído do catálogo." action={<StoreButton asChild className="garden-cta"><Link to={path("/catalogo")}>Voltar ao catálogo</Link></StoreButton>} />
        </div>
      </div>
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
          <Link to={path()}>Início</Link> <span aria-hidden="true">/</span> <Link to={path("/catalogo")}>Catálogo</Link>
          {cat && <> <span aria-hidden="true">/</span> <Link to={path("/catalogo", { cat: String(cat.id) })}>{cat.name}</Link></>}
        </nav>
        <div className="garden-prod">
          <div className="garden-gallery">
            <div className="garden-stage">
              {onSale(product) && !hidden && <span className="garden-badge">Oferta</span>}
              {img ? <img src={img} alt={product.name} /> : <Sprout size={72} aria-hidden="true" />}
            </div>
            {buy.gallery.length > 1 && (
              <div className="garden-thumbs">
                {buy.gallery.map((g, i) => (
                  <button key={g + i} type="button" aria-label={`Ver foto ${i + 1}`} aria-current={i === buy.photo} onClick={() => buy.setPhoto(i)}><img src={g} alt="" /></button>
                ))}
              </div>
            )}
          </div>
          <section className="garden-panel" aria-labelledby="garden-ptitle">
            {cat && <span className="garden-eyebrow"><Leaf size={14} aria-hidden="true" /> {cat.name}</span>}
            <h1 id="garden-ptitle">{product.name}</h1>
            {product.sku && <small className="garden-sku">Cód. {product.sku}</small>}
            <div className="garden-panel-price">
              <Price product={product} big />
              {onSale(product) && !hidden && <span className="garden-save">Economia de {money(Number(product.price) - priceOf(product))}</span>}
            </div>
            <StockAvailability product={product} tenant={tenant} selected={buy.selected} />
            {buy.choices.map((c) => (
              <fieldset key={c.name} className="garden-opt">
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
            <div className="garden-note">
              <label htmlFor="garden-note">Observação (opcional)</label>
              <textarea id="garden-note" rows={2} value={buy.note} onChange={(e) => buy.setNote(e.target.value)} placeholder="Ex.: embalagem para presente" />
            </div>
            {missing.length > 0 && <p className="garden-hint">Escolha {missing.join(", ")} para continuar.</p>}
            <div className="garden-buyrow">
              <div className="garden-qty">
                <button type="button" aria-label="Diminuir quantidade" onClick={buy.dec} disabled={buy.qty <= 1}><Minus size={16} /></button>
                <output aria-live="polite">{buy.qty}</output>
                <button type="button" aria-label="Aumentar quantidade" onClick={buy.inc} disabled={buy.qty >= buy.max}><Plus size={16} /></button>
              </div>
              <StoreButton type="button" className="garden-cta garden-buy" disabled={!buy.canAdd} onClick={buy.add}>
                <ShoppingBasket size={18} aria-hidden="true" /> {buy.soldOut ? "Indisponível" : hidden ? "Incluir no pedido" : "Adicionar à sacola"}
              </StoreButton>
            </div>
            {buy.added && (
              <div className="garden-added" role="status">
                <span>Adicionado à sacola.</span>
                <StoreButton type="button" size="sm" variant="outline" className="garden-ghost" onClick={openCart}>Ver sacola</StoreButton>
              </div>
            )}
            <ul className="garden-seals" aria-label="Garantias">
              <li><ShieldCheck size={17} aria-hidden="true" /> Compra segura</li>
              <li><Truck size={17} aria-hidden="true" /> Embalagem cuidadosa</li>
              <li><Repeat size={17} aria-hidden="true" /> Troca facilitada</li>
            </ul>
          </section>
        </div>
        {product.description && (
          <section className="garden-spec" aria-labelledby="garden-spec-t">
            <h2 id="garden-spec-t">Sobre este item</h2>
            <div>{product.description}</div>
          </section>
        )}
        {related.length > 0 && (
          <section className="garden-section">
            <SectionTitle eyebrow="Combina com" title="Do mesmo canto do jardim" />
            <div className="garden-grid">{related.map((p) => <Card key={p.id} product={p} />)}</div>
          </section>
        )}
      </div>
    </div>
  );
}
