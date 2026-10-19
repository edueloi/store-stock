import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Check, ChevronDown, Gem, Minus, Plus, ShoppingBag } from "lucide-react";
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
      <div className="lux-page lux-notfound">
        <Gem size={44} aria-hidden="true" />
        <h1>Peça não encontrada</h1>
        <p>Ela pode ter deixado a coleção. Veja as demais.</p>
        <StoreButton asChild size="lg" className="lux-btn lux-btn-lg"><Link to={path("/catalogo")}>Voltar à coleção</Link></StoreButton>
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
  const policies = tenant.policies;
  return (
    <div className="lux-page">
      <StoreSEO title={`${product.name} | ${tenant.name}`} description={product.description || product.name} image={b.gallery[0]} url={typeof window !== "undefined" ? window.location.href : ""} siteName={tenant.name} />
      <nav className="lux-wrap lux-crumbs" aria-label="Você está em">
        <Link to={path("/catalogo")}><ArrowLeft size={15} /> Coleção</Link>
        {catName(product) && (<><span aria-hidden="true">/</span><Link to={path(`/catalogo?categoria=${product.category_id}`)}>{catName(product)}</Link></>)}
      </nav>
      <div className="lux-wrap lux-pd">
        <section className="lux-gallery" aria-label="Fotos">
          <div className="lux-gallery-main">
            {b.gallery.length ? <img src={b.gallery[b.photo] || b.gallery[0]} alt={product.name} /> : <Gem size={60} aria-label="Sem imagem" />}
            {price.off && <span className="lux-tag">Oferta</span>}
          </div>
          {b.gallery.length > 1 && (
            <div className="lux-thumbs">
              {b.gallery.map((src, i) => (
                <button key={`${src}-${i}`} type="button" aria-label={`Ver foto ${i + 1}`} aria-pressed={b.photo === i} onClick={() => b.setPhoto(i)}><img src={src} alt="" /></button>
              ))}
            </div>
          )}
        </section>
        <section className="lux-buy">
          {catName(product) && <span className="lux-eyebrow">{catName(product)}</span>}
          <h1>{product.name}</h1>
          {product.sku && <small className="lux-sku">Ref. {product.sku}</small>}
          <div className="lux-price lux-price-lg">
            <strong>{hidden ? "Valor sob consulta" : price.now}</strong>
            {price.old && <s>{price.old}</s>}
          </div>
          <StockAvailability product={product} tenant={tenant} selected={b.ready ? b.selected : undefined} />
          {b.groups.map((g) => (
            <fieldset key={g.name} className="lux-fieldset">
              <legend>{g.name} <small>obrigatório</small></legend>
              <div className="lux-opts">
                {g.values.map((v) => (
                  <button key={v} type="button" aria-pressed={b.selected[g.name] === v} onClick={() => b.setSelected((prev) => ({ ...prev, [g.name]: v }))}>
                    {b.selected[g.name] === v && <Check size={14} aria-hidden="true" />} {v}
                  </button>
                ))}
              </div>
            </fieldset>
          ))}
          <div className="lux-buy-row">
            <div className="lux-qty" role="group" aria-label="Quantidade">
              <button type="button" aria-label="Diminuir quantidade" disabled={b.qty <= 1} onClick={() => b.setQty((v) => Math.max(1, v - 1))}><Minus size={16} /></button>
              <output aria-live="polite">{b.qty}</output>
              <button type="button" aria-label="Aumentar quantidade" disabled={b.qty >= b.maxQty} onClick={() => b.setQty((v) => Math.min(b.maxQty, v + 1))}><Plus size={16} /></button>
            </div>
            <StoreButton size="lg" className="lux-btn lux-add" disabled={!b.canAdd} onClick={b.add}>
              <ShoppingBag size={18} /> {b.soldOut ? "Indisponível" : sf.checkout_mode === "order_request" ? "Incluir no pedido" : "Adicionar à sacola"}
            </StoreButton>
          </div>
          {!b.ready && <p className="lux-hint" role="status">Escolha {missing.join(" e ")} para continuar.</p>}
          {b.added && (
            <div className="lux-added" role="status">
              <span><Check size={17} aria-hidden="true" /> Adicionado à sacola</span>
              <StoreButton variant="outline" size="sm" className="lux-btn lux-btn-line" onClick={b.openCart}>Ver sacola</StoreButton>
            </div>
          )}
          <div className="lux-acc">
            {product.description && (
              <details open>
                <summary>Descrição <ChevronDown size={16} aria-hidden="true" /></summary>
                <p>{product.description}</p>
              </details>
            )}
            {(policies?.shipping || policies?.returns || tenant.address) && (
              <details>
                <summary>Entrega e trocas <ChevronDown size={16} aria-hidden="true" /></summary>
                {policies?.shipping && <p>{policies.shipping}</p>}
                {policies?.returns && <p>{policies.returns}</p>}
                {tenant.show_address && tenant.address && <p>Retirada: {tenant.address}</p>}
              </details>
            )}
          </div>
          {wa && <a className="lux-link" href={wa} target="_blank" rel="noreferrer">Tirar dúvida pelo WhatsApp</a>}
        </section>
      </div>
      <div className="lux-sticky-buy">
        <div><strong>{hidden ? "Sob consulta" : price.now}</strong><span>{product.name}</span></div>
        <StoreButton className="lux-btn" disabled={!b.canAdd} onClick={b.add}><ShoppingBag size={17} /> {b.ready ? "Adicionar" : "Escolher opções"}</StoreButton>
      </div>
      {related.length > 0 && (
        <section className="lux-wrap lux-section">
          <header className="lux-head"><span className="lux-eyebrow">Da mesma coleção</span><h2>Veja também</h2></header>
          <div className="lux-grid">{related.map((p) => <ProductCard key={p.id} product={p} />)}</div>
        </section>
      )}
    </div>
  );
}
