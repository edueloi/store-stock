import { Fragment, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Heart, MessageCircle, Minus, Package, Plus, ShieldCheck, ShoppingBag } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import StockAvailability from "../../../../components/store/StockAvailability";
import { StoreButton } from "../../../../components/store/StoreButton";
import { getVariationImages } from "../../../../utils/variationImages";
import { parseProductIdFromRoute } from "../../store-routing";
import { money, priceOf, productImage, useBuy, useShop, waLink } from "./lib";
import { SupplyCard, stockText } from "./parts";

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
      <main className="ms-scope ms-page" style={vars}>
        <div className="ms-wrap" style={{ padding: "56px 20px" }}>
          <div className="ms-empty">
            <Package size={40} color="var(--ms-accent)" />
            <h1 className="ms-serif" style={{ fontSize: 26, margin: "12px 0 6px" }}>Material não encontrado</h1>
            <p>Ele pode ter saído do catálogo.</p>
            <StoreButton asChild shape="soft" size="md" className="ms-fbtn"><Link to={path("/catalogo")}>Voltar ao catálogo</Link></StoreButton>
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
  const wa = waLink(tenant, `Olá! Preciso de orientação sobre ${product.name}${product.sku ? ` (cód. ${product.sku})` : ""}.`);
  return (
    <main className="ms-scope ms-page" style={vars}>
      <StoreSEO title={`${product.name} | ${tenant.name}`} description={product.description || `${product.name} na ${tenant.name}.`} image={gallery[0]} type="product" price={String(current)} url={typeof window !== "undefined" ? window.location.href : ""} siteName={tenant.name} />
      <div className="ms-wrap">
        <nav className="ms-crumbs" aria-label="Você está em">
          <Link to={path()}>Início</Link>/<Link to={path("/catalogo")}>Catálogo</Link>
          {category && <>/<Link to={path(`/catalogo?cat=${category.id}`)}>{category.name}</Link></>}
        </nav>
        <div className="ms-prod">
          <section aria-label="Fotos do produto">
            <div className="ms-stage">
              {gallery.length ? <img src={gallery[photo] || gallery[0]} alt={product.name} /> : <Package size={80} color="#b4c4d4" />}
              {discounted && <span className="ms-chip">Oferta</span>}
            </div>
            {gallery.length > 1 && (
              <div className="ms-thumbs">
                {gallery.map((src, i) => <button key={`${src}-${i}`} aria-label={`Ver foto ${i + 1}`} aria-pressed={photo === i} onClick={() => setPhoto(i)}><img src={src} alt="" /></button>)}
              </div>
            )}
          </section>
          <section className="ms-buy" aria-label="Comprar">
            <span className="ms-eyebrow">{category?.name || "Materiais hospitalares"}</span>
            <h1 className="ms-serif">{product.name}</h1>
            {product.sku && <span className="ms-code ms-code-lg">SKU {product.sku}</span>}
            <div className="ms-bigprice">
              {hidden ? <b style={{ fontSize: 26 }}>Valor a confirmar</b> : (<><b>{money(current)}</b>{discounted && <s>{money(full)}</s>}</>)}
            </div>
            {buy.choices.map((g) => (
              <fieldset key={g.name} className="ms-fs">
                <legend>{g.name}<small>obrigatório</small></legend>
                <div className="ms-opts">
                  {g.values.map((v) => <button key={v} aria-pressed={buy.selected[g.name] === v} onClick={() => buy.choose(g.name, v)}>{v}</button>)}
                </div>
              </fieldset>
            ))}
            <div className="ms-fs">
              <label htmlFor="ms-note" style={{ display: "block", fontSize: 13, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--ms-mute)", marginBottom: 8 }}>Observação (opcional)</label>
              <textarea id="ms-note" className="ms-note" maxLength={250} value={buy.note} onChange={(e) => buy.setNote(e.target.value)} placeholder="Ex.: tamanho, apresentação ou prazo desejado" />
            </div>
            <StockAvailability product={product} tenant={tenant} selected={buy.ready && buy.choices.length ? buy.selected : undefined} />
            <div className="ms-buyrow">
              <div className="ms-qty">
                <button aria-label="Diminuir quantidade" disabled={buy.qty <= 1} onClick={() => buy.setQty(buy.qty - 1)}><Minus size={17} /></button>
                <output aria-label="Quantidade">{buy.qty}</output>
                <button aria-label="Aumentar quantidade" disabled={buy.qty >= buy.max} onClick={() => buy.setQty(buy.qty + 1)}><Plus size={17} /></button>
              </div>
              <StoreButton shape="soft" size="lg" className="ms-fbtn ms-buybtn" disabled={!buy.canAdd} onClick={() => buy.add() && setAdded(true)}>
                <ShoppingBag size={19} />{buy.soldOut ? "Indisponível" : hidden ? "Solicitar orçamento" : "Adicionar ao pedido"}
              </StoreButton>
              <button className="ms-qty" style={{ width: 50, justifyContent: "center", color: fav ? "#c0392b" : "var(--ms-ink)", cursor: "pointer" }} aria-label={fav ? "Remover dos favoritos" : "Favoritar"} aria-pressed={fav} onClick={() => toggleWishlist(product.id)}>
                <Heart size={20} fill={fav ? "currentColor" : "none"} />
              </button>
            </div>
            {!buy.ready && <p className="ms-msg" role="status">Escolha todas as opções para adicionar ao pedido.</p>}
            {added && <p className="ms-msg" role="status" style={{ color: "var(--ms-ok)" }}>Material adicionado. <button onClick={openCart} style={{ background: "none", border: 0, textDecoration: "underline", color: "inherit", fontWeight: 700, minHeight: 44 }}>Ver pedido</button></p>}
            <div className="ms-guarantee">
              <ShieldCheck size={22} />
              <div><strong>Atendimento profissional.</strong> Nossa equipe confirma disponibilidade e orienta sobre o uso adequado.{wa && <> <a href={wa} target="_blank" rel="noreferrer"><MessageCircle size={14} style={{ verticalAlign: "-2px" }} /> Falar com a equipe</a></>}</div>
            </div>
          </section>
        </div>
        <section className="ms-detail" aria-label="Detalhes do produto">
          <div className="ms-detail-card">
            <h2 className="ms-serif">Descrição</h2>
            <p className="desc">{product.description || "Este material ainda não possui descrição detalhada. Fale com a equipe para mais informações."}</p>
          </div>
          <div className="ms-detail-card">
            <h2 className="ms-serif">Ficha técnica</h2>
            <dl className="ms-info">
              <dt>Código (SKU)</dt><dd>{product.sku || `#${product.id}`}</dd>
              {product.barcode && <><dt>Código de barras</dt><dd>{product.barcode}</dd></>}
              <dt>Especialidade</dt><dd>{category?.name || "Materiais hospitalares"}</dd>
              <dt>Disponibilidade</dt><dd>{stockText(tenant, product)}</dd>
              {buy.choices.map((c) => <Fragment key={c.name}><dt>{c.name}</dt><dd>{c.values.join(", ")}</dd></Fragment>)}
              <dt>Atendimento</dt><dd>Profissional, com apoio da equipe</dd>
            </dl>
          </div>
        </section>
        {related.length > 0 ? (
          <section className="ms-related">
            <h2 className="ms-serif">Materiais da mesma especialidade</h2>
            <div className="ms-grid">{related.map((p) => <SupplyCard key={p.id} product={p} />)}</div>
          </section>
        ) : <div style={{ height: 64 }} />}
      </div>
    </main>
  );
}
