import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Check, Droplets, Minus, Plus, ShoppingBag } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import StockAvailability from "../../../../components/store/StockAvailability";
import { StoreButton } from "../../../../components/store/StoreButton";
import { parseProductIdFromRoute } from "../../store-routing";
import { priceInfo, useBuy, useKit, whatsappLink } from "./kit";
import { ProductCard } from "./parts";
import type { Product } from "../../../../types";
import "./styles.css";

export default function StoreProduct() {
  const { productId } = useParams();
  const { active, path } = useKit();
  const product = active.find((p) => p.id === parseProductIdFromRoute(productId));
  if (!product)
    return (
      <div className="frg-page frg-notfound">
        <Droplets size={44} aria-hidden="true" />
        <h1>Fragrância não encontrada</h1>
        <p>Ela pode ter saído da vitrine. Veja as outras.</p>
        <StoreButton asChild size="lg" className="frg-btn frg-btn-lg"><Link to={path("/catalogo")}>Voltar à coleção</Link></StoreButton>
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
    <div className="frg-page">
      <StoreSEO title={`${product.name} | ${tenant.name}`} description={product.description || product.name} image={b.gallery[0]} url={typeof window !== "undefined" ? window.location.href : ""} siteName={tenant.name} />
      <nav className="frg-wrap frg-crumbs" aria-label="Você está em">
        <Link to={path("/catalogo")}><ArrowLeft size={15} /> Fragrâncias</Link>
        {catName(product) && (<><span aria-hidden="true">/</span><Link to={path(`/catalogo?categoria=${product.category_id}`)}>{catName(product)}</Link></>)}
      </nav>
      <div className="frg-wrap frg-pd">
        <section className="frg-gallery" aria-label="Fotos">
          {b.gallery.length > 1 && (
            <div className="frg-thumbs">
              {b.gallery.map((src, i) => (
                <button key={`${src}-${i}`} type="button" aria-label={`Ver foto ${i + 1}`} aria-pressed={b.photo === i} onClick={() => b.setPhoto(i)}><img src={src} alt="" /></button>
              ))}
            </div>
          )}
          <div className="frg-gallery-main">
            <span className="frg-stage-disc" aria-hidden="true" />
            {b.gallery.length ? <img src={b.gallery[b.photo] || b.gallery[0]} alt={product.name} /> : <Droplets size={64} aria-label="Sem imagem" />}
            <span className="frg-stage-shadow" aria-hidden="true" />
            {price.off && <span className="frg-badge">Oferta</span>}
          </div>
        </section>
        <section className="frg-buy">
          {catName(product) && <span className="frg-note">{catName(product)}</span>}
          <h1>{product.name}</h1>
          {product.sku && <small className="frg-sku">Código: {product.sku}</small>}
          <div className="frg-price frg-price-lg">
            <strong>{hidden ? "Valor sob consulta" : price.now}</strong>
            {price.old && <s>{price.old}</s>}
          </div>
          {product.description && <p className="frg-desc">{product.description}</p>}
          <StockAvailability product={product} tenant={tenant} selected={b.ready ? b.selected : undefined} />
          {b.groups.map((g) => (
            <fieldset key={g.name} className="frg-fieldset">
              <legend>{g.name} <small>obrigatório</small></legend>
              <div className="frg-opts">
                {g.values.map((v) => (
                  <button key={v} type="button" aria-pressed={b.selected[g.name] === v} onClick={() => b.setSelected((prev) => ({ ...prev, [g.name]: v }))}>
                    {b.selected[g.name] === v && <Check size={14} aria-hidden="true" />} {v}
                  </button>
                ))}
              </div>
            </fieldset>
          ))}
          <div className="frg-buy-row">
            <div className="frg-qty" role="group" aria-label="Quantidade">
              <button type="button" aria-label="Diminuir quantidade" disabled={b.qty <= 1} onClick={() => b.setQty((v) => Math.max(1, v - 1))}><Minus size={16} /></button>
              <output aria-live="polite">{b.qty}</output>
              <button type="button" aria-label="Aumentar quantidade" disabled={b.qty >= b.maxQty} onClick={() => b.setQty((v) => Math.min(b.maxQty, v + 1))}><Plus size={16} /></button>
            </div>
            <StoreButton size="lg" className="frg-btn frg-add" disabled={!b.canAdd} onClick={b.add}>
              <ShoppingBag size={18} /> {b.soldOut ? "Indisponível" : sf.checkout_mode === "order_request" ? "Incluir no pedido" : "Adicionar à sacola"}
            </StoreButton>
          </div>
          {!b.ready && <p className="frg-hint" role="status">Escolha {missing.join(" e ")} para continuar.</p>}
          {b.added && (
            <div className="frg-added" role="status">
              <span><Check size={17} aria-hidden="true" /> Adicionado à sacola</span>
              <StoreButton variant="outline" size="sm" className="frg-btn frg-btn-line" onClick={b.openCart}>Ver sacola</StoreButton>
            </div>
          )}
          <div className="frg-guide">
            <h2>Como a fragrância se desenvolve</h2>
            <ol>
              <li><b>Topo</b><span>primeiros minutos</span></li>
              <li><b>Coração</b><span>caráter central</span></li>
              <li><b>Fundo</b><span>permanência</span></li>
            </ol>
          </div>
          {wa && <a className="frg-link" href={wa} target="_blank" rel="noreferrer">Tirar dúvida pelo WhatsApp</a>}
          {tenant.show_address && tenant.address && <p className="frg-small">Retirada: {tenant.address}</p>}
        </section>
      </div>
      <div className="frg-sticky-buy">
        <div><strong>{hidden ? "Sob consulta" : price.now}</strong><span>{product.name}</span></div>
        <StoreButton className="frg-btn" disabled={!b.canAdd} onClick={b.add}><ShoppingBag size={17} /> {b.ready ? "Adicionar" : "Escolher opções"}</StoreButton>
      </div>
      {related.length > 0 && (
        <section className="frg-wrap frg-section">
          <header className="frg-head"><span className="frg-eyebrow">Da mesma família</span><h2>Veja também</h2></header>
          <div className="frg-grid">{related.map((p) => <ProductCard key={p.id} product={p} />)}</div>
        </section>
      )}
    </div>
  );
}
