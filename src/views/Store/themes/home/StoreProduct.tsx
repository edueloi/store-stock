import { useState } from "react";
import { Link } from "react-router-dom";
import { Check, Heart, Minus, Package, Plus, Share2, ShoppingCart, Store, Truck } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import StockAvailability from "../../../../components/store/StockAvailability";
import Card from "./Card";
import { hasDiscount, money, priceOf, useProductState } from "./kit";
import "./styles.css";

export default function StoreProduct() {
  const s = useProductState();
  const { product, tenant, categories, path, hidden, sf, wishlist, toggleWishlist, waLink } = s;
  const [tab, setTab] = useState<"desc" | "med">("desc");

  if (!product)
    return (
      <main className="hm-page">
        <div className="hm-wrap hm-empty-box">
          <Package size={44} aria-hidden="true" />
          <p><b>Produto não encontrado.</b></p>
          <Link className="hm-btn hm-btn-accent" to={path("/catalogo")}>Voltar ao catálogo</Link>
        </div>
      </main>
    );

  const category = categories.find((c) => c.id === product.category_id);
  const liked = wishlist.includes(product.id);
  const price = priceOf(product);
  const related = s.active.filter((p) => p.id !== product.id && p.category_id === product.category_id).slice(0, 4);
  const medidas: { k: string; v: string }[] = [];
  if (product.sku) medidas.push({ k: "Código", v: product.sku });
  if (product.sale_unit && product.sale_unit !== "unidade") {
    const unit = { m2: "Metro quadrado (m²)", linear: "Metro linear", peso: "Peso", volume: "Volume" }[product.sale_unit];
    medidas.push({ k: "Vendido por", v: unit || product.sale_unit });
    if (product.measure_unit) medidas.push({ k: "Unidade de medida", v: product.measure_unit });
    if (product.min_billable_quantity) medidas.push({ k: "Quantidade mínima", v: String(product.min_billable_quantity) });
  }
  s.groups.forEach((g) => medidas.push({ k: g.name, v: g.values.join(", ") }));
  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ title: product.name, url: window.location.href });
      else await navigator.clipboard.writeText(window.location.href);
    } catch {
      /* cancelado */
    }
  };

  return (
    <main className="hm-page">
      <StoreSEO title={`${product.name} — ${tenant.name}`} description={product.description || product.name} image={s.images[0]} url={typeof window !== "undefined" ? window.location.href : ""} type="product" price={hidden ? undefined : String(price)} siteName={tenant.name} />
      <div className="hm-wrap hm-prod">
        <nav className="hm-crumbs" aria-label="Você está em">
          <Link to={path()}>Início</Link> / <Link to={path("/catalogo")}>Catálogo</Link>
          {category && <> / <Link to={path(`/catalogo?categoria=${category.id}`)}>{category.name}</Link></>}
        </nav>
        <div className="hm-prod-grid">
          <section className="hm-gallery" aria-label="Fotos do produto">
            <div className="hm-gallery-main">
              {s.images.length ? <img src={s.images[s.activeImage] || s.images[0]} alt={product.name} /> : <Package size={64} aria-hidden="true" />}
              {hasDiscount(product) && !hidden && <span className="hm-tag-sale">Oferta</span>}
            </div>
            {s.images.length > 1 && (
              <div className="hm-thumbs">
                {s.images.map((im, i) => (
                  <button key={im + i} aria-label={`Ver foto ${i + 1}`} aria-current={i === s.activeImage} className={i === s.activeImage ? "is-on" : ""} onClick={() => s.setActiveImage(i)}>
                    <img src={im} alt="" />
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="hm-buy">
            {category && <p className="hm-kicker">{category.name}</p>}
            <h1>{product.name}</h1>
            {product.sku && <p className="hm-ref">Cód. {product.sku}</p>}
            {hidden ? (
              <p className="hm-price-big hm-price-ask">Sob consulta</p>
            ) : (
              <div className="hm-price-big">
                {hasDiscount(product) && <s>{money(Number(product.price))}</s>}
                <strong>{money(price)}</strong>
              </div>
            )}
            <p className="hm-deliv">
              <span><Store size={14} aria-hidden="true" /> Retirada na loja</span>
              <span><Truck size={14} aria-hidden="true" /> {sf.shipping_status === "enabled" ? "Entrega disponível" : "Entrega sob consulta"}</span>
            </p>

            {s.groups.map((g) => (
              <fieldset key={g.name} className="hm-opt">
                <legend>{g.name}: <b>{s.selected[g.name] || "escolha"}</b></legend>
                <div>
                  {g.values.map((v) => {
                    const on = s.selected[g.name] === v;
                    return (
                      <button key={v} type="button" aria-pressed={on} className={on ? "is-on" : ""} onClick={() => s.choose(g.name, v)}>
                        {on && <Check size={14} aria-hidden="true" />} {v}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            ))}
            {s.groups.length > 0 && !s.ready && <p className="hm-hint">Escolha todas as opções para continuar.</p>}
            <StockAvailability product={product} tenant={tenant} selected={s.selected} className="hm-stock" />

            <div className="hm-buyrow">
              <div className="hm-qty" role="group" aria-label="Quantidade">
                <button aria-label="Diminuir quantidade" onClick={() => s.setQuantity(Math.max(1, s.qty - 1))}><Minus size={16} /></button>
                <span aria-live="polite">{s.qty}</span>
                <button aria-label="Aumentar quantidade" disabled={s.qty >= s.maxQty} onClick={() => s.setQuantity(Math.min(s.maxQty, s.qty + 1))}><Plus size={16} /></button>
              </div>
              <button className="hm-btn hm-btn-accent hm-btn-lg" disabled={!s.canAdd} onClick={s.add}>
                <ShoppingCart size={18} aria-hidden="true" />
                {s.soldOut ? "Esgotado" : hidden ? "Incluir no pedido" : "Adicionar ao carrinho"}
              </button>
            </div>
            <div className="hm-links">
              <button onClick={() => toggleWishlist(product.id)} aria-pressed={liked}><Heart size={16} fill={liked ? "currentColor" : "none"} aria-hidden="true" /> {liked ? "Nos favoritos" : "Favoritar"}</button>
              <button onClick={share}><Share2 size={16} aria-hidden="true" /> Compartilhar</button>
              {tenant.whatsapp && <a href={waLink(`Olá! Tenho dúvidas sobre ${product.name}.`)} target="_blank" rel="noreferrer">Tirar dúvida no WhatsApp</a>}
            </div>
          </section>
        </div>

        <section className="hm-tabs">
          <div role="tablist" aria-label="Detalhes do produto">
            <button role="tab" id="hm-t1" aria-selected={tab === "desc"} aria-controls="hm-p1" onClick={() => setTab("desc")}>Descrição</button>
            <button role="tab" id="hm-t2" aria-selected={tab === "med"} aria-controls="hm-p2" onClick={() => setTab("med")}>Medidas</button>
          </div>
          {tab === "desc" ? (
            <div role="tabpanel" id="hm-p1" aria-labelledby="hm-t1" className="hm-panel">
              <p>{product.description || "Este produto ainda não tem descrição. Fale com a loja para saber mais."}</p>
            </div>
          ) : (
            <div role="tabpanel" id="hm-p2" aria-labelledby="hm-t2" className="hm-panel">
              {medidas.length ? (
                <dl className="hm-specs">{medidas.map((m) => <div key={m.k}><dt>{m.k}</dt><dd>{m.v}</dd></div>)}</dl>
              ) : (
                <p>Medidas não informadas. Consulte a loja para confirmar dimensões antes de comprar.</p>
              )}
            </div>
          )}
        </section>

        {related.length > 0 && (
          <section className="hm-related">
            <h2>Veja também neste departamento</h2>
            <div className="hm-grid">{related.map((p) => <Card key={p.id} product={p} />)}</div>
          </section>
        )}
      </div>
    </main>
  );
}
