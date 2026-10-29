import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Check, ChevronDown, MessageCircle, Minus, Plus, ShoppingBag, Shirt } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import StockAvailability from "../../../../components/store/StockAvailability";
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
      <div className="els-page els-notfound">
        <Shirt size={44} aria-hidden="true" />
        <h1>Produto não encontrado</h1>
        <p>Esta peça pode ter saído da coleção. Conheça as outras escolhas.</p>
        <Link className="els-btn els-btn-lg" to={path("/catalogo")}>Explorar a coleção</Link>
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
    <div className="els-page">
      <StoreSEO title={`${product.name} | ${tenant.name}`} description={product.description || product.name} image={b.gallery[0]} url={typeof window !== "undefined" ? window.location.href : ""} siteName={tenant.name} />
      <nav className="els-wrap els-crumbs" aria-label="Você está em">
        <Link to={path("/catalogo")}><ArrowLeft size={15} /> Coleção</Link>
        {catName(product) && (<><span aria-hidden="true">/</span><Link to={path(`/catalogo?categoria=${product.category_id}`)}>{catName(product)}</Link></>)}
      </nav>
      <div className="els-wrap els-pd">
        <section className="els-gallery" aria-label="Fotos">
          <div className="els-gallery-main">
            {b.gallery.length ? <img src={b.gallery[b.photo] || b.gallery[0]} alt={product.name} /> : <Shirt size={64} aria-label="Sem imagem" />}
            <div className="els-badges">
              {price.off && <span className="els-badge is-sale">Oferta</span>}
            </div>
          </div>
          {b.gallery.length > 1 && (
            <div className="els-thumbs">
              {b.gallery.map((src, i) => (
                <button key={`${src}-${i}`} type="button" aria-label={`Ver foto ${i + 1}`} aria-pressed={b.photo === i} onClick={() => b.setPhoto(i)}><img src={src} alt="" /></button>
              ))}
            </div>
          )}
        </section>
        <section className="els-buy">
          {catName(product) && <span className="els-kicker">{catName(product)}</span>}
          <h1>{product.name}</h1>
          {product.sku && <small className="els-sku">Ref. {product.sku}</small>}
          <div className="els-price els-price-lg">
            {price.old && <s>{price.old}</s>}
            <strong>{hidden ? "Valor sob consulta" : price.now}</strong>
            {!hidden && <small>por unidade</small>}
          </div>
          <StockAvailability product={product} tenant={tenant} selected={b.ready ? b.selected : undefined} />
          {b.groups.map((g) => (
            <fieldset key={g.name} className="els-fieldset">
              <legend>{g.name} <small>obrigatório</small></legend>
              <div className="els-opts">
                {g.values.map((v) => (
                  <button key={v} type="button" aria-pressed={b.selected[g.name] === v} onClick={() => b.setSelected((prev) => ({ ...prev, [g.name]: v }))}>
                    {b.selected[g.name] === v && <Check size={14} aria-hidden="true" />} {v}
                  </button>
                ))}
              </div>
            </fieldset>
          ))}
          <div className="els-buy-row">
            <div className="els-qty" role="group" aria-label="Quantidade">
              <button type="button" aria-label="Diminuir quantidade" disabled={b.qty <= 1} onClick={() => b.setQty((v) => Math.max(1, v - 1))}><Minus size={16} /></button>
              <output aria-live="polite">{b.qty}</output>
              <button type="button" aria-label="Aumentar quantidade" disabled={b.qty >= b.maxQty} onClick={() => b.setQty((v) => Math.min(b.maxQty, v + 1))}><Plus size={16} /></button>
            </div>
            <button type="button" className="els-btn els-btn-lg els-add-main" disabled={!b.canAdd} onClick={b.add}>
              <ShoppingBag size={18} /> {b.soldOut ? "Indisponível" : orderMode ? "Incluir no pedido" : "Adicionar à sacola"}
            </button>
          </div>
          {!b.ready && <p className="els-hint" role="status">Escolha {missing.join(" e ")} para continuar.</p>}
          {b.added && (
            <div className="els-added" role="status">
              <span><Check size={17} aria-hidden="true" /> Adicionado à sacola</span>
              <button type="button" className="els-btn els-btn-ghost" onClick={b.openCart}>Ver sacola</button>
            </div>
          )}
          {wa && <a className="els-btn els-btn-ghost els-wa" href={wa} target="_blank" rel="noreferrer"><MessageCircle size={17} /> Perguntar no WhatsApp</a>}
          <div className="els-acc">
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
      <div className="els-sticky-buy">
        <div><strong>{hidden ? "Sob consulta" : price.now}</strong><span>{product.name}</span></div>
        <button type="button" className="els-btn" disabled={b.ready && !b.canAdd} onClick={() => {
          if (b.ready) { b.add(); return; }
          const options = document.querySelector<HTMLElement>(".els-fieldset");
          options?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" });
          options?.querySelector<HTMLButtonElement>("button")?.focus({ preventScroll: true });
        }}><ShoppingBag size={17} /> {b.soldOut ? "Indisponível" : b.ready ? "Adicionar" : "Escolher opções"}</button>
      </div>
      {related.length > 0 && (
        <section className="els-wrap els-section">
          <header className="els-head"><div><span className="els-kicker">Continue se inspirando</span><h2>Outras peças, novas possibilidades.</h2></div></header>
          <div className="els-grid">{related.map((p) => <ProductCard key={p.id} product={p} />)}</div>
        </section>
      )}
    </div>
  );
}
