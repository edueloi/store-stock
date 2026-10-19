import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Check, Minus, Plus, ShoppingBag, Sparkles } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import StockAvailability from "../../../../components/store/StockAvailability";
import { StoreButton } from "../../../../components/store/StoreButton";
import { parseProductIdFromRoute } from "../../store-routing";
import { priceInfo, useBuy, useKit, whatsappLink } from "./kit";
import { ProductCard } from "./ThemeParts";
import type { Product } from "../../../../types";
import "./styles.css";

export default function StoreProduct() {
  const { productId } = useParams();
  const { active, path } = useKit();
  const product = active.find((p) => p.id === parseProductIdFromRoute(productId));
  if (!product)
    return (
      <div className="bty-page bty-notfound">
        <Sparkles size={44} aria-hidden="true" />
        <h1>Produto não encontrado</h1>
        <p>Ele pode ter saído da seleção. Veja os outros produtos.</p>
        <StoreButton asChild size="lg" className="bty-btn bty-btn-lg"><Link to={path("/catalogo")}>Voltar ao catálogo</Link></StoreButton>
      </div>
    );
  return <Details key={product.id} product={product} />;
}

function Details({ product }: { product: Product }) {
  const { tenant, active, hidden, path, catName, sf } = useKit();
  const b = useBuy(product);
  const price = priceInfo(product, hidden);
  const related = active.filter((p) => p.id !== product.id && p.category_id === product.category_id).slice(0, 4);
  const wa = whatsappLink(tenant.whatsapp, `Olá! Tenho uma dúvida sobre: ${product.name}`);
  const missing = b.groups.filter((g) => !b.selected[g.name]).map((g) => g.name);
  return (
    <div className="bty-page bty-product">
      <StoreSEO title={`${product.name} | ${tenant.name}`} description={product.description || product.name} image={b.gallery[0]} url={typeof window !== "undefined" ? window.location.href : ""} siteName={tenant.name} />
      <nav className="bty-wrap bty-crumbs" aria-label="Você está em">
        <Link to={path("/catalogo")}><ArrowLeft size={15} /> Produtos</Link>
        {catName(product) && (<><span aria-hidden="true">/</span><Link to={path(`/catalogo?categoria=${product.category_id}`)}>{catName(product)}</Link></>)}
      </nav>
      <div className="bty-wrap bty-pd">
        <section className="bty-gallery" aria-label="Fotos do produto">
          <div className="bty-gallery-main">
            {b.gallery.length ? <img src={b.gallery[b.photo] || b.gallery[0]} alt={product.name} /> : <Sparkles size={56} aria-label="Sem imagem" />}
          </div>
          {b.gallery.length > 1 && (
            <div className="bty-thumbs">
              {b.gallery.map((src, i) => (
                <button key={`${src}-${i}`} type="button" aria-label={`Ver foto ${i + 1}`} aria-pressed={b.photo === i} onClick={() => b.setPhoto(i)}><img src={src} alt="" /></button>
              ))}
            </div>
          )}
        </section>
        <section className="bty-buy">
          {catName(product) && <span className="bty-eyebrow">{catName(product)}</span>}
          <h1>{product.name}</h1>
          {product.sku && <small className="bty-sku">Código: {product.sku}</small>}
          <div className="bty-price bty-price-lg">
            <strong>{hidden ? "Valor sob consulta" : price.now}</strong>
            {price.old && <s>{price.old}</s>}
          </div>
          {product.description && <p className="bty-desc">{product.description}</p>}
          <StockAvailability product={product} tenant={tenant} selected={b.ready ? b.selected : undefined} />
          {b.groups.map((g) => (
            <fieldset key={g.name} className="bty-fieldset">
              <legend>{g.name} <small>obrigatório</small></legend>
              <div className="bty-opts">
                {g.values.map((v) => (
                  <button key={v} type="button" aria-pressed={b.selected[g.name] === v} onClick={() => b.setSelected((prev) => ({ ...prev, [g.name]: v }))}>
                    {b.selected[g.name] === v && <Check size={14} aria-hidden="true" />} {v}
                  </button>
                ))}
              </div>
            </fieldset>
          ))}
          <label className="bty-note-field">
            <span>Observação (opcional)</span>
            <textarea value={b.note} maxLength={250} rows={3} onChange={(e) => b.setNote(e.target.value)} placeholder="Ex.: é presente, quero embalagem especial" />
          </label>
          <div className="bty-buy-row">
            <div className="bty-qty" role="group" aria-label="Quantidade">
              <button type="button" aria-label="Diminuir quantidade" disabled={b.qty <= 1} onClick={() => b.setQty((v) => Math.max(1, v - 1))}><Minus size={16} /></button>
              <output aria-live="polite">{b.qty}</output>
              <button type="button" aria-label="Aumentar quantidade" disabled={b.qty >= b.maxQty} onClick={() => b.setQty((v) => Math.min(b.maxQty, v + 1))}><Plus size={16} /></button>
            </div>
            <StoreButton size="lg" className="bty-btn bty-add" disabled={!b.canAdd} onClick={b.add}>
              <ShoppingBag size={18} /> {b.soldOut ? "Indisponível" : sf.checkout_mode === "order_request" ? "Incluir no pedido" : "Adicionar à sacola"}
            </StoreButton>
          </div>
          {!b.ready && <p className="bty-hint" role="status">Escolha {missing.join(" e ")} para continuar.</p>}
          {b.added && (
            <div className="bty-added" role="status">
              <span><Check size={17} aria-hidden="true" /> Adicionado à sacola</span>
              <StoreButton variant="outline" size="sm" className="bty-btn bty-btn-line" onClick={b.openCart}>Ver sacola</StoreButton>
            </div>
          )}
          {wa && <a className="bty-link" href={wa} target="_blank" rel="noreferrer">Tirar dúvida pelo WhatsApp</a>}
          {tenant.show_address && tenant.address && <p className="bty-small">Retirada: {tenant.address}</p>}
        </section>
      </div>
      <div className="bty-sticky-buy">
        <div><strong>{hidden ? "Sob consulta" : price.now}</strong><span>{product.name}</span></div>
        <StoreButton className="bty-btn" disabled={!b.canAdd} onClick={b.add}><ShoppingBag size={17} /> {b.ready ? "Adicionar" : "Escolher opções"}</StoreButton>
      </div>
      {related.length > 0 && (
        <section className="bty-wrap bty-section">
          <header className="bty-head"><span className="bty-eyebrow">Combina com</span><h2>Veja também</h2></header>
          <div className="bty-grid">{related.map((p) => <ProductCard key={p.id} product={p} />)}</div>
        </section>
      )}
    </div>
  );
}
