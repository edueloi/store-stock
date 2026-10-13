import { Fragment, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Heart, MessageCircle, Minus, Package, Plus, ShieldCheck, ShoppingCart } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import StockAvailability from "../../../../components/store/StockAvailability";
import { getVariationImages } from "../../../../utils/variationImages";
import { parseProductIdFromRoute } from "../../store-routing";
import { money, priceOf, productImage, useBuy, useShop, waLink } from "./lib";
import { SkuRow, TableHead, stockInfo } from "./parts";

export default function StoreProduct() {
  const { productId } = useParams();
  const { tenant, categories, active, products, hidden, path, vars, wishlist, toggleWishlist, openCart } = useShop();
  const product = products.find((p) => p.id === parseProductIdFromRoute(productId));
  const buy = useBuy(product);
  const [photo, setPhoto] = useState(0);
  const [added, setAdded] = useState(false);
  useEffect(() => setPhoto(0), [product?.id, buy.selected]);

  if (!product) {
    return (
      <main className="tg-scope tg-page" style={vars}>
        <div className="tg-wrap" style={{ padding: "64px 16px" }}>
          <div className="tg-empty">
            <Package size={40} />
            <h1 className="tg-h" style={{ fontSize: 34, margin: "14px 0 8px" }}>Peça não encontrada</h1>
            <p>O item pode ter saído do catálogo.</p>
            <Link className="tg-btn" to={path("/catalogo")}>Voltar ao catálogo</Link>
          </div>
        </div>
      </main>
    );
  }

  const variantImages = getVariationImages(product, buy.selected);
  const base = product.images?.length ? product.images : productImage(product) ? [productImage(product)] : [];
  const gallery = variantImages.length ? variantImages : base;
  const { current, full, discounted } = priceOf(product);
  const category = categories.find((c) => c.id === product.category_id);
  const fav = wishlist.includes(product.id);
  const stock = stockInfo(tenant, product);
  const related = active.filter((p) => p.id !== product.id && p.category_id === product.category_id).slice(0, 4);
  const wa = waLink(tenant, `Olá! Quero confirmar a compatibilidade da peça ${product.sku ? `${product.sku} - ` : ""}${product.name}.`);
  const submit = () => {
    if (buy.add()) setAdded(true);
  };
  return (
    <main className="tg-scope tg-page" style={vars}>
      <StoreSEO title={`${product.name} | ${tenant.name}`} description={product.description || `${product.name} na ${tenant.name}.`} image={gallery[0]} type="product" price={String(current)} url={typeof window !== "undefined" ? window.location.href : ""} siteName={tenant.name} />
      <div className="tg-wrap">
        <nav className="tg-crumbs" aria-label="Você está em">
          <Link to={path()}>Início</Link>/<Link to={path("/catalogo")}>Catálogo</Link>
          {category && (<>/<Link to={path(`/catalogo?cat=${category.id}`)}>{category.name}</Link></>)}
        </nav>
        <div className="tg-prod">
          <section>
            <div className="tg-panel tg-gallery">
              <div className="tg-stage">
                {gallery.length ? <img src={gallery[photo] || gallery[0]} alt={product.name} /> : <Package size={72} color="#94a3b8" />}
                {discounted && <span className="tg-tag">Oferta</span>}
              </div>
              {gallery.length > 1 && (
                <div className="tg-thumbs">
                  {gallery.map((src, i) => (
                    <button key={`${src}-${i}`} aria-label={`Ver foto ${i + 1}`} aria-pressed={photo === i} onClick={() => setPhoto(i)}>
                      <img src={src} alt="" />
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="tg-spec">
              <h2 className="tg-h">Ficha técnica</h2>
              <dl>
                <dt>Código / SKU</dt><dd className="tg-mono">{product.sku || `ID-${String(product.id).padStart(5, "0")}`}</dd>
                {product.barcode && (<><dt>Cód. de barras</dt><dd className="tg-mono">{product.barcode}</dd></>)}
                <dt>Setor</dt><dd>{category?.name || "Seleção da garagem"}</dd>
                <dt>Disponibilidade</dt><dd>{stock.text}</dd>
                {buy.choices.map((c) => (<Fragment key={c.name}><dt>{c.name}</dt><dd>{c.values.join(", ")}</dd></Fragment>))}
                {product.description && (<><dt>Descrição</dt><dd className="tg-desc">{product.description}</dd></>)}
              </dl>
            </div>
          </section>
          <section className="tg-panel tg-buy" aria-label="Comprar">
            <span className="tg-kicker">{category?.name || "Peça"}</span>
            <h1 className="tg-h">{product.name}</h1>
            <span className="tg-partno"><span>COD</span>{product.sku || `ID-${String(product.id).padStart(5, "0")}`}</span>
            <div className="tg-bigprice">
              {hidden ? <b style={{ fontSize: 34 }}>Sob consulta</b> : (<><b>{money(current)}</b>{discounted && <s>{money(full)}</s>}</>)}
            </div>
            {buy.choices.map((g) => (
              <fieldset key={g.name} className="tg-fieldset">
                <legend>{g.name}<small>obrigatório</small></legend>
                <div className="tg-opts">
                  {g.values.map((v) => (
                    <button key={v} aria-pressed={buy.selected[g.name] === v} onClick={() => buy.choose(g.name, v)}>{v}</button>
                  ))}
                </div>
              </fieldset>
            ))}
            <div className="tg-fieldset">
              <label htmlFor="tg-note" style={{ display: "block", font: "600 12px 'JetBrains Mono', monospace", textTransform: "uppercase", letterSpacing: ".1em", color: "var(--tg-mute)", marginBottom: 8 }}>Observação (modelo, ano, versão)</label>
              <textarea id="tg-note" className="tg-note" maxLength={250} value={buy.note} onChange={(e) => buy.setNote(e.target.value)} placeholder="Ex.: Gol 1.6 2014 - lado direito" />
            </div>
            <StockAvailability product={product} tenant={tenant} selected={buy.ready && buy.choices.length ? buy.selected : undefined} />
            <div className="tg-buyrow">
              <div className="tg-qty">
                <button aria-label="Diminuir quantidade" disabled={buy.qty <= 1} onClick={() => buy.setQty(buy.qty - 1)}><Minus size={16} /></button>
                <output aria-label="Quantidade">{buy.qty}</output>
                <button aria-label="Aumentar quantidade" disabled={buy.qty >= buy.max} onClick={() => buy.setQty(buy.qty + 1)}><Plus size={16} /></button>
              </div>
              <button className="tg-btn" disabled={!buy.canAdd} onClick={submit}>
                <ShoppingCart size={19} />
                {buy.soldOut ? "Indisponível" : "Adicionar ao pedido"}
              </button>
              <button className="tg-fav" style={{ height: 52, width: 52 }} aria-label={fav ? "Remover dos favoritos" : "Favoritar"} aria-pressed={fav} onClick={() => toggleWishlist(product.id)}>
                <Heart size={20} fill={fav ? "currentColor" : "none"} />
              </button>
            </div>
            {!buy.ready && <p className="tg-msg" role="status">Selecione todas as opções para adicionar ao pedido.</p>}
            {added && (
              <p className="tg-msg" role="status" style={{ color: "#3ddc84" }}>
                Peça adicionada. <button style={{ background: "none", border: 0, color: "inherit", textDecoration: "underline", minHeight: 44 }} onClick={openCart}>Ver pedido</button>
              </p>
            )}
            <div className="tg-compat-box">
              <div>
                <h2 className="tg-h" style={{ fontSize: 24, display: "flex", gap: 8, alignItems: "center" }}><ShieldCheck size={20} color="var(--tg-accent)" />Compatibilidade</h2>
                <p>Confirme com a equipe se esta peça serve no seu veículo antes de finalizar.</p>
              </div>
              {wa && <a className="tg-btn tg-btn-ghost" href={wa} target="_blank" rel="noreferrer"><MessageCircle size={17} />Confirmar</a>}
            </div>
          </section>
        </div>
        {related.length > 0 && (
          <section className="tg-related">
            <h2 className="tg-h">Mesmo setor</h2>
            <div className="tg-table" role="table" aria-label="Peças relacionadas">
              <TableHead />
              {related.map((p) => <SkuRow key={p.id} product={p} />)}
            </div>
          </section>
        )}
        {related.length === 0 && <div style={{ height: 64 }} />}
      </div>
    </main>
  );
}
