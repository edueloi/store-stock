import { Fragment, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Heart, ListPlus, MessageCircle, Minus, Package, Plus } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import StockAvailability from "../../../../components/store/StockAvailability";
import { getVariationImages } from "../../../../utils/variationImages";
import { parseProductIdFromRoute } from "../../store-routing";
import { money, priceOf, productImage, useBuy, useShop, waLink } from "./lib";
import { ToolCard, stockText } from "./parts";

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
      <main className="op-scope op-page" style={vars}>
        <div className="op-wrap" style={{ padding: "48px 16px" }}>
          <div className="op-empty">
            <Package size={40} />
            <h1 className="op-h" style={{ fontSize: 26, margin: "12px 0 6px" }}>Item não encontrado</h1>
            <p>Ele pode ter saído do catálogo.</p>
            <Link className="op-btn" to={path("/catalogo")}>Voltar ao catálogo</Link>
          </div>
        </div>
      </main>
    );
  }

  const variantImages = getVariationImages(product, buy.selected);
  const baseImages = product.images?.length ? product.images : productImage(product) ? [productImage(product)] : [];
  const gallery = variantImages.length ? variantImages : baseImages;
  const { current, full, discounted } = priceOf(product);
  const category = categories.find((c) => c.id === product.category_id);
  const fav = wishlist.includes(product.id);
  const related = active.filter((p) => p.id !== product.id && p.category_id === product.category_id).slice(0, 4);
  const wa = waLink(tenant, `Olá! Tenho uma dúvida sobre ${product.name}${product.sku ? ` (ref. ${product.sku})` : ""}.`);
  const ref = product.sku || `#${product.id}`;
  return (
    <main className="op-scope op-page" style={vars}>
      <StoreSEO title={`${product.name} | ${tenant.name}`} description={product.description || `${product.name} na ${tenant.name}.`} image={gallery[0]} type="product" price={String(current)} url={typeof window !== "undefined" ? window.location.href : ""} siteName={tenant.name} />
      <div className="op-wrap">
        <nav className="op-crumbs" aria-label="Você está em">
          <Link to={path()}>Início</Link>/<Link to={path("/catalogo")}>Catálogo</Link>
          {category && <>/<Link to={path(`/catalogo?cat=${category.id}`)}>{category.name}</Link></>}
        </nav>
        <div className="op-prod">
          <div className={`op-gal ${gallery.length > 1 ? "" : "single"}`}>
            {gallery.length > 1 && (
              <div className="op-gal-th">
                {gallery.map((src, i) => (
                  <button key={`${src}-${i}`} aria-label={`Ver foto ${i + 1}`} aria-pressed={photo === i} onClick={() => setPhoto(i)}><img src={src} alt="" /></button>
                ))}
              </div>
            )}
            <div className="op-stage">
              {gallery.length ? <img src={gallery[photo] || gallery[0]} alt={product.name} /> : <Package size={72} color="#aab6bf" />}
              {discounted && <span className="op-tag y">Oferta</span>}
            </div>
          </div>
          <section className="op-buy" aria-label="Comprar">
            <div className="op-buy-in">
              <span className="op-tag">{category?.name || "Ferramentas"}</span>
              <h1 className="op-h">{product.name}</h1>
              <span className="op-ref">REF. {ref}</span>
              <div className="op-bigprice">
                {hidden ? <b style={{ fontSize: 26 }}>Valor a confirmar</b> : (<><b>{money(current)}</b>{discounted && <s>{money(full)}</s>}</>)}
              </div>
              {buy.choices.map((g) => (
                <fieldset key={g.name} className="op-fs">
                  <legend>{g.name}<small>obrigatório</small></legend>
                  <div className="op-opts">
                    {g.values.map((v) => <button key={v} aria-pressed={buy.selected[g.name] === v} onClick={() => buy.choose(g.name, v)}>{v}</button>)}
                  </div>
                </fieldset>
              ))}
              <div className="op-fs">
                <label className="op-mono" htmlFor="op-note" style={{ display: "block", fontSize: 12, fontWeight: 700, textTransform: "uppercase", marginBottom: 8 }}>Observação (medida, aplicação)</label>
                <textarea id="op-note" className="op-note" maxLength={250} value={buy.note} onChange={(e) => buy.setNote(e.target.value)} placeholder="Opcional" />
              </div>
              <StockAvailability product={product} tenant={tenant} selected={buy.ready && buy.choices.length ? buy.selected : undefined} />
              <div className="op-buyrow">
                <div className="op-qty">
                  <button aria-label="Diminuir quantidade" disabled={buy.qty <= 1} onClick={() => buy.setQty(buy.qty - 1)}><Minus size={16} /></button>
                  <output aria-label="Quantidade">{buy.qty}</output>
                  <button aria-label="Aumentar quantidade" disabled={buy.qty >= buy.max} onClick={() => buy.setQty(buy.qty + 1)}><Plus size={16} /></button>
                </div>
                <button className="op-btn" disabled={!buy.canAdd} onClick={() => buy.add() && setAdded(true)}>
                  <ListPlus size={18} />{buy.soldOut ? "Indisponível" : "Adicionar à lista"}
                </button>
                <button className="op-qty" style={{ width: 48, height: 52, placeItems: "center", display: "grid", cursor: "pointer", color: fav ? "#c0392b" : "var(--op-ink)" }} aria-label={fav ? "Remover dos favoritos" : "Favoritar"} aria-pressed={fav} onClick={() => toggleWishlist(product.id)}>
                  <Heart size={20} fill={fav ? "currentColor" : "none"} />
                </button>
              </div>
              {!buy.ready && <p className="op-msg" role="status">Escolha todas as opções para adicionar à lista.</p>}
              {added && <p className="op-msg" role="status" style={{ color: "#1d6b35" }}>Item na lista. <button onClick={openCart} style={{ background: "none", border: 0, textDecoration: "underline", color: "inherit", minHeight: 44, fontWeight: 700 }}>Abrir lista de materiais</button></p>}
              {wa && <a className="op-wa" href={wa} target="_blank" rel="noreferrer"><MessageCircle size={18} />Tirar dúvida com a equipe</a>}
            </div>
          </section>
        </div>
        <section className="op-sheet" aria-labelledby="op-sheet-t">
          <h2 className="op-h" id="op-sheet-t">Ficha técnica <span>REF. {ref}</span></h2>
          <div className="op-sheet-body">
            <dl>
              <dt>Referência</dt><dd className="op-mono">{ref}</dd>
              {product.barcode && <><dt>Cód. de barras</dt><dd className="op-mono">{product.barcode}</dd></>}
              <dt>Departamento</dt><dd>{category?.name || "Geral"}</dd>
              <dt>Disponibilidade</dt><dd>{stockText(tenant, product)}</dd>
              {buy.choices.map((c) => <Fragment key={c.name}><dt>{c.name}</dt><dd>{c.values.join(", ")}</dd></Fragment>)}
            </dl>
            <div className="op-sheet-desc">
              <h3>Descrição</h3>
              {product.description || "Sem descrição cadastrada. Consulte a equipe para detalhes de aplicação."}
            </div>
          </div>
        </section>
        {related.length > 0 && (
          <section style={{ paddingBottom: 56 }}>
            <div className="op-sec-head" style={{ marginTop: 0 }}><h2 className="op-h">Mesmo departamento</h2></div>
            <div className="op-grid cols4">{related.map((p) => <ToolCard key={p.id} product={p} />)}</div>
          </section>
        )}
      </div>
    </main>
  );
}
