import { Link, useParams } from "react-router-dom";
import { Check, ChevronLeft, ChevronRight, Minus, Plus, ShieldCheck, ShoppingBag, Truck, Zap } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import StockAvailability from "../../../../components/store/StockAvailability";
import { parseProductIdFromRoute } from "../../store-routing";
import Card from "./Card";
import { money, priceOf, useKit, useProductForm } from "./lib";
import "./styles.css";

const colors: Record<string, string> = { preto: "#1a1a1a", branco: "#f8f8f4", vermelho: "#df3131", azul: "#2d5da8", verde: "#4a8051", amarelo: "#e5bd3c", rosa: "#df809f", cinza: "#89909a", laranja: "#f08a24" };

export default function StoreProduct() {
  const { productId } = useParams();
  const { tenant, products, path, hidden, catName, active } = useKit();
  const product = products.find((p) => p.id === parseProductIdFromRoute(productId));
  const f = useProductForm(product);

  if (!product || !product.is_active)
    return (
      <main className="sp-root">
        <div className="sp-wrap">
          <div className="sp-empty" style={{ margin: "56px 0" }}>
            <h3 className="sp-h">Produto não encontrado</h3>
            <Link to={path("/catalogo")} className="sp-btn" style={{ marginTop: 16 }}>Voltar ao catálogo</Link>
          </div>
        </div>
      </main>
    );

  const { price, full, off } = priceOf(product);
  const category = catName(product.category_id);
  const related = active.filter((p) => p.id !== product.id && p.category_id === product.category_id).slice(0, 4);
  const missing = f.choices.filter((g) => !f.selected[g.name]);
  const noStock = f.units !== null && f.max === 0 && f.ready;
  const img = f.images[f.active] || f.images[0];

  return (
    <main className="sp-root">
      <StoreSEO
        title={`${product.name} | ${tenant.name}`}
        description={product.description || product.name}
        image={f.images[0]}
        url={typeof window !== "undefined" ? window.location.href : ""}
        type="product"
        price={hidden ? undefined : String(price)}
        siteName={tenant.name}
      />
      <div className="sp-wrap">
        <nav className="sp-crumbs" aria-label="Você está em">
          <Link to={path()}>Início</Link> /<Link to={path("/catalogo")}>Catálogo</Link>
          {category && <> /<Link to={path(`/catalogo?cat=${product.category_id}`)}>{category}</Link></>}
        </nav>
        <div className="sp-pdp">
          <div className="sp-gallery">
            <div className="sp-stage">
              {img ? <img src={img} alt={product.name} /> : <span className="sp-h" style={{ fontSize: 120, opacity: 0.12 }}>{product.name.slice(0, 2)}</span>}
              {off && !hidden && <span className="sp-badge">Oferta</span>}
              {f.images.length > 1 && (
                <>
                  <button className="sp-stage-nav" style={{ left: 0 }} aria-label="Foto anterior" onClick={() => f.setActive((f.active - 1 + f.images.length) % f.images.length)}><ChevronLeft size={22} /></button>
                  <button className="sp-stage-nav" style={{ right: 0 }} aria-label="Próxima foto" onClick={() => f.setActive((f.active + 1) % f.images.length)}><ChevronRight size={22} /></button>
                </>
              )}
            </div>
            {f.images.length > 1 && (
              <div className="sp-thumbs">
                {f.images.map((src, i) => (
                  <button key={src + i} aria-pressed={i === f.active} aria-label={`Ver foto ${i + 1}`} onClick={() => f.setActive(i)}>
                    <img src={src} alt="" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="sp-info">
            {category && <span className="sp-kicker">{category}</span>}
            <h1 className="sp-h">{product.name}</h1>
            {product.sku && <p className="sp-ref">Ref. {product.sku}</p>}
            <div className="sp-bigprice">
              {hidden ? (
                <strong style={{ fontSize: 40 }}>Sob consulta</strong>
              ) : (
                <>
                  <strong>{money(price)}</strong>
                  {off && <s>{money(full)}</s>}
                  {off && <span className="sp-save">Economize {money(full - price)}</span>}
                </>
              )}
            </div>
            {product.description && <p className="sp-desc">{product.description}</p>}

            {f.choices.map((g) => (
              <div className="sp-opt" key={g.name} role="group" aria-label={g.name}>
                <div className="sp-opt-label"><span>{g.name}</span><span>{f.selected[g.name] || "Escolha uma opção"}</span></div>
                <div className="sp-opt-values">
                  {g.values.map((v) => {
                    const hex = g.colors?.[v] || colors[v.toLowerCase()];
                    const isColor = /cor|color/i.test(g.name);
                    return (
                      <button key={v} className="sp-chip" aria-pressed={f.selected[g.name] === v} onClick={() => f.pick(g.name, v)}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                          {isColor && hex && <i className="sp-dot" style={{ background: hex }} />}
                          {v}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            {missing.length > 0 && <p className="sp-hint" role="status">Escolha {missing.map((m) => m.name.toLowerCase()).join(" e ")} para continuar.</p>}

            <StockAvailability product={product} tenant={tenant} selected={f.choices.length ? f.selected : undefined} className="mb-3" />

            <div className="sp-opt" style={{ marginTop: 14 }}>
              <label className="sp-opt-label" htmlFor="sp-note"><span>Observação</span><span>opcional</span></label>
              <textarea id="sp-note" className="sp-note" value={f.note} onChange={(e) => f.setNote(e.target.value)} placeholder="Ex.: nome para personalização, preferência de cor..." maxLength={240} />
            </div>

            <div className="sp-buy">
              <div className="sp-qty" role="group" aria-label="Quantidade">
                <button aria-label="Diminuir quantidade" disabled={f.qty <= 1} onClick={() => f.setQty(f.qty - 1)}><Minus size={18} /></button>
                <span aria-live="polite">{f.qty}</span>
                <button aria-label="Aumentar quantidade" disabled={f.qty >= f.max} onClick={() => f.setQty(f.qty + 1)}><Plus size={18} /></button>
              </div>
              <button className="sp-btn" disabled={!f.canAdd} onClick={f.add}>
                <ShoppingBag size={20} />
                {noStock ? "Indisponível" : hidden ? "Solicitar" : "Adicionar ao carrinho"}
              </button>
            </div>
            {f.inCart > 0 && <p className="sp-hint" style={{ color: "#111", marginTop: 10 }}><Check size={14} style={{ display: "inline" }} /> {f.inCart} no carrinho</p>}

            <div className="sp-perks">
              <div className="sp-perk"><Zap size={22} />Pedido rápido</div>
              <div className="sp-perk"><ShieldCheck size={22} />Compra segura</div>
              <div className="sp-perk"><Truck size={22} />Entrega ou retirada</div>
            </div>
          </div>
        </div>

        {related.length > 0 && (
          <section style={{ paddingBottom: 72 }}>
            <div className="sp-section-head">
              <div>
                <span className="sp-kicker">Complete o kit</span>
                <h2 className="sp-h">Você também vai querer</h2>
              </div>
            </div>
            <div className="sp-grid">{related.map((p) => <Card key={p.id} product={p} />)}</div>
          </section>
        )}
      </div>
    </main>
  );
}
