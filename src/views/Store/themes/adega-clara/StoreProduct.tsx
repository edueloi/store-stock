import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Check, ChevronDown, MessageCircle, Minus, Plus, ShoppingBag, Snowflake, Wine } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import StockAvailability from "../../../../components/store/StockAvailability";
import { parseProductIdFromRoute } from "../../store-routing";
import { isCold, priceInfo, useBuy, useKit, whatsappLink } from "./kit";
import { ProductCard } from "./parts";
import type { Product } from "../../../../types";
import "./styles.css";

export default function StoreProduct() {
  const { productId } = useParams();
  const { active, path } = useKit();
  const product = active.find((p) => p.id === parseProductIdFromRoute(productId));
  if (!product)
    return (
      <div className="brs-page brs-notfound">
        <Wine size={44} aria-hidden="true" />
        <h1>Produto não encontrado</h1>
        <p>Ele pode ter saído do cardápio. Veja os demais.</p>
        <Link className="brs-btn brs-btn-lg" to={path("/catalogo")}>Voltar ao cardápio</Link>
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
  const orderMode = sf.checkout_mode === "order_request";
  return (
    <div className="brs-page">
      <StoreSEO title={`${product.name} | ${tenant.name}`} description={product.description || product.name} image={b.gallery[0]} url={typeof window !== "undefined" ? window.location.href : ""} siteName={tenant.name} />
      <nav className="brs-wrap brs-crumbs" aria-label="Você está em">
        <Link to={path("/catalogo")}><ArrowLeft size={15} /> Cardápio</Link>
        {catName(product) && (<><span aria-hidden="true">/</span><Link to={path(`/catalogo?categoria=${product.category_id}`)}>{catName(product)}</Link></>)}
      </nav>
      <div className="brs-wrap brs-pd">
        <section className="brs-gallery" aria-label="Fotos">
          <div className="brs-gallery-main">
            {b.gallery.length ? <img src={b.gallery[b.photo] || b.gallery[0]} alt={product.name} /> : <Wine size={64} aria-label="Sem imagem" />}
            <div className="brs-badges">
              {price.off && <span className="brs-badge is-sale">Oferta</span>}
              {isCold(product) && <span className="brs-badge is-cold"><Snowflake size={11} aria-hidden="true" /> Gelada</span>}
            </div>
          </div>
          {b.gallery.length > 1 && (
            <div className="brs-thumbs">
              {b.gallery.map((src, i) => (
                <button key={`${src}-${i}`} type="button" aria-label={`Ver foto ${i + 1}`} aria-pressed={b.photo === i} onClick={() => b.setPhoto(i)}><img src={src} alt="" /></button>
              ))}
            </div>
          )}
        </section>
        <section className="brs-buy">
          {catName(product) && <span className="brs-kicker">{catName(product)}</span>}
          <h1>{product.name}</h1>
          {product.sku && <small className="brs-sku">Ref. {product.sku}</small>}
          <div className="brs-price brs-price-lg">
            {price.old && <s>{price.old}</s>}
            <strong>{hidden ? "Valor sob consulta" : price.now}</strong>
            {!hidden && <small>por unidade</small>}
          </div>
          <StockAvailability product={product} tenant={tenant} selected={b.ready ? b.selected : undefined} />
          {b.groups.map((g) => (
            <fieldset key={g.name} className="brs-fieldset">
              <legend>{g.name} <small>obrigatório</small></legend>
              <div className="brs-opts">
                {g.values.map((v) => (
                  <button key={v} type="button" aria-pressed={b.selected[g.name] === v} onClick={() => b.setSelected((prev) => ({ ...prev, [g.name]: v }))}>
                    {b.selected[g.name] === v && <Check size={14} aria-hidden="true" />} {v}
                  </button>
                ))}
              </div>
            </fieldset>
          ))}
          <div className="brs-buy-row">
            <div className="brs-qty" role="group" aria-label="Quantidade">
              <button type="button" aria-label="Diminuir quantidade" disabled={b.qty <= 1} onClick={() => b.setQty((v) => Math.max(1, v - 1))}><Minus size={16} /></button>
              <output aria-live="polite">{b.qty}</output>
              <button type="button" aria-label="Aumentar quantidade" disabled={b.qty >= b.maxQty} onClick={() => b.setQty((v) => Math.min(b.maxQty, v + 1))}><Plus size={16} /></button>
            </div>
            <button type="button" className="brs-btn brs-btn-lg brs-add-main" disabled={!b.canAdd} onClick={b.add}>
              <ShoppingBag size={18} /> {b.soldOut ? "Indisponível" : orderMode ? "Incluir no pedido" : "Adicionar à sacola"}
            </button>
          </div>
          {!b.ready && <p className="brs-hint" role="status">Escolha {missing.join(" e ")} para continuar.</p>}
          {b.added && (
            <div className="brs-added" role="status">
              <span><Check size={17} aria-hidden="true" /> Adicionado à sacola</span>
              <button type="button" className="brs-btn brs-btn-ghost" onClick={b.openCart}>Ver sacola</button>
            </div>
          )}
          {wa && <a className="brs-btn brs-btn-ghost brs-wa" href={wa} target="_blank" rel="noreferrer"><MessageCircle size={17} /> Perguntar no WhatsApp</a>}
          <div className="brs-acc">
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
        </section>
      </div>
      <div className="brs-sticky-buy">
        <div><strong>{hidden ? "Sob consulta" : price.now}</strong><span>{product.name}</span></div>
        <button type="button" className="brs-btn" disabled={!b.canAdd} onClick={b.add}><ShoppingBag size={17} /> {b.ready ? "Adicionar" : "Escolher opções"}</button>
      </div>
      {related.length > 0 && (
        <section className="brs-wrap brs-section">
          <header className="brs-head"><div><span className="brs-kicker">Combina com</span><h2>Veja também</h2></div></header>
          <div className="brs-grid">{related.map((p) => <ProductCard key={p.id} product={p} />)}</div>
        </section>
      )}
    </div>
  );
}
