import { Link, useParams } from "react-router-dom";
import { Check, Minus, Package, Plus, Repeat, ShieldCheck, ShoppingBasket, Truck } from "lucide-react";
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
      <div className="agro-page">
        <div className="agro-wrap agro-section">
          <Empty
            title="Produto não encontrado"
            text="Ele pode ter saído do catálogo."
            action={<StoreButton asChild className="agro-cta"><Link to={path("/catalogo")}>Voltar ao catálogo</Link></StoreButton>}
          />
        </div>
      </div>
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
          <Link to={path()}>Início</Link> <span aria-hidden="true">/</span> <Link to={path("/catalogo")}>Catálogo</Link>
          {cat && (
            <>
              {" "}<span aria-hidden="true">/</span> <Link to={path("/catalogo", { cat: String(cat.id) })}>{cat.name}</Link>
            </>
          )}
        </nav>
        <div className="agro-prod">
          <div className="agro-gallery">
            <div className="agro-stage">
              {onSale(product) && <span className="agro-badge">Oferta</span>}
              {img ? <img src={img} alt={product.name} /> : <Package size={72} aria-hidden="true" />}
            </div>
            {buy.gallery.length > 1 && (
              <div className="agro-thumbs">
                {buy.gallery.map((g, i) => (
                  <button key={g + i} type="button" aria-label={`Ver foto ${i + 1}`} aria-current={i === buy.photo} onClick={() => buy.setPhoto(i)}>
                    <img src={g} alt="" />
                  </button>
                ))}
              </div>
            )}
          </div>
          <section className="agro-panel" aria-labelledby="agro-ptitle">
            {cat && <span className="agro-eyebrow">{cat.name}</span>}
            <h1 id="agro-ptitle">{product.name}</h1>
            {product.sku && <small className="agro-sku">Cód. {product.sku}</small>}
            <div className="agro-panel-price">
              <Price product={product} big />
              {onSale(product) && !hidden && <span className="agro-save">Economize {money(Number(product.price) - priceOf(product))}</span>}
              {hidden && <p>Valor a confirmar com a loja.</p>}
            </div>
            <StockAvailability product={product} tenant={tenant} selected={buy.selected} />
            {buy.choices.map((c) => (
              <fieldset key={c.name} className="agro-opt">
                <legend>{c.name}</legend>
                <div>
                  {c.values.map((v) => (
                    <button key={v} type="button" aria-pressed={buy.selected[c.name] === v} onClick={() => buy.choose(c.name, v)}>
                      {buy.selected[c.name] === v && <Check size={14} aria-hidden="true" />} {v}
                    </button>
                  ))}
                </div>
              </fieldset>
            ))}
            <div className="agro-note">
              <label htmlFor="agro-note">Observação (opcional)</label>
              <textarea id="agro-note" value={buy.note} onChange={(e) => buy.setNote(e.target.value)} placeholder="Ex.: combinar retirada ou entrega" rows={2} />
            </div>
            {missing.length > 0 && <p className="agro-hint">Escolha {missing.join(", ")} para continuar.</p>}
            <div className="agro-buyrow">
              <div className="agro-qty">
                <button type="button" aria-label="Diminuir quantidade" onClick={buy.dec} disabled={buy.qty <= 1}><Minus size={16} /></button>
                <output aria-live="polite">{buy.qty}</output>
                <button type="button" aria-label="Aumentar quantidade" onClick={buy.inc} disabled={buy.qty >= buy.max}><Plus size={16} /></button>
              </div>
              <StoreButton type="button" shape="soft" className="agro-cta agro-buy" disabled={!buy.canAdd} onClick={buy.add}>
                <ShoppingBasket size={18} aria-hidden="true" /> {buy.soldOut ? "Indisponível" : hidden ? "Incluir no pedido" : "Adicionar ao pedido"}
              </StoreButton>
            </div>
            <ul className="agro-trust" aria-label="Garantias da loja">
              <li><ShieldCheck size={16} aria-hidden="true" /> Compra segura</li>
              <li><Truck size={16} aria-hidden="true" /> Entrega combinada</li>
              <li><Repeat size={16} aria-hidden="true" /> Troca facilitada</li>
            </ul>
            {buy.added && (
              <div className="agro-added" role="status">
                <span>Item adicionado ao pedido.</span>
                <StoreButton type="button" size="sm" variant="outline" className="agro-ghost" onClick={openCart}>Ver pedido</StoreButton>
              </div>
            )}
          </section>
        </div>
        {product.description && (
          <section className="agro-spec" aria-labelledby="agro-spec-t">
            <h2 id="agro-spec-t">Ficha do produto</h2>
            <div>{product.description}</div>
          </section>
        )}
        {related.length > 0 && (
          <section className="agro-section">
            <SectionTitle eyebrow="No mesmo departamento" title="Você também pode precisar" />
            <div className="agro-grid">{related.map((p) => <Card key={p.id} product={p} />)}</div>
          </section>
        )}
      </div>
    </div>
  );
}
