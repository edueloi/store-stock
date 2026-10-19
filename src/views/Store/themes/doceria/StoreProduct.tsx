import { Link, useParams } from "react-router-dom";
import { ArrowLeft, CakeSlice, Check, Minus, Plus, ShoppingBag } from "lucide-react";
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
      <div className="dc-page dc-notfound">
        <CakeSlice size={56} aria-hidden="true" />
        <h1>Doce não encontrado</h1>
        <p>Pode ser que ele já tenha saído do forno. Veja os outros!</p>
        <Link className="dc-btn dc-btn-lg" to={path("/catalogo")}>
          Voltar ao cardápio
        </Link>
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
    <div className="dc-page dc-product">
      <StoreSEO
        title={`${product.name} | ${tenant.name}`}
        description={product.description || product.name}
        image={b.gallery[0]}
        url={typeof window !== "undefined" ? window.location.href : ""}
        siteName={tenant.name}
      />
      <nav className="dc-crumbs" aria-label="Você está em">
        <Link to={path("/catalogo")}>
          <ArrowLeft size={16} /> Cardápio
        </Link>
        {catName(product) && (
          <>
            <span aria-hidden="true">/</span>
            <Link to={path(`/catalogo?categoria=${product.category_id}`)}>{catName(product)}</Link>
          </>
        )}
      </nav>

      <div className="dc-pd">
        <section className="dc-gallery" aria-label="Fotos do doce">
          <div className="dc-gallery-main">
            {b.gallery.length ? <img src={b.gallery[b.photo] || b.gallery[0]} alt={product.name} /> : <CakeSlice size={90} aria-label="Sem imagem" />}
            {price.off && <span className="dc-tag">Oferta</span>}
          </div>
          {b.gallery.length > 1 && (
            <div className="dc-thumbs">
              {b.gallery.map((src, i) => (
                <button key={`${src}-${i}`} type="button" aria-label={`Ver foto ${i + 1}`} aria-pressed={b.photo === i} onClick={() => b.setPhoto(i)}>
                  <img src={src} alt="" />
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="dc-buy">
          {catName(product) && <span className="dc-kicker">{catName(product)}</span>}
          <h1>{product.name}</h1>
          {product.sku && <small className="dc-sku">Código: {product.sku}</small>}
          <div className="dc-price dc-price-lg">
            <strong>{hidden ? "Valor sob consulta" : price.now}</strong>
            {price.old && <s>{price.old}</s>}
          </div>
          {product.description && <p className="dc-desc">{product.description}</p>}

          <StockAvailability product={product} tenant={tenant} selected={b.ready ? b.selected : undefined} />

          {b.groups.map((g) => (
            <fieldset key={g.name} className="dc-fieldset">
              <legend>
                {g.name} <small>obrigatório</small>
              </legend>
              <div className="dc-opts">
                {g.values.map((v) => (
                  <button key={v} type="button" className="dc-opt" aria-pressed={b.selected[g.name] === v} onClick={() => b.setSelected((prev) => ({ ...prev, [g.name]: v }))}>
                    {b.selected[g.name] === v && <Check size={15} aria-hidden="true" />} {v}
                  </button>
                ))}
              </div>
            </fieldset>
          ))}

          <label className="dc-note-field">
            <span>Recado para a confeitaria (opcional)</span>
            <textarea value={b.note} maxLength={250} onChange={(e) => b.setNote(e.target.value)} placeholder="Ex.: escrever Parabéns no topo, sem nozes..." rows={3} />
          </label>

          <div className="dc-buy-row">
            <div className="dc-qty" role="group" aria-label="Quantidade">
              <button type="button" aria-label="Diminuir quantidade" disabled={b.qty <= 1} onClick={() => b.setQty((v) => Math.max(1, v - 1))}>
                <Minus size={18} />
              </button>
              <output aria-live="polite">{b.qty}</output>
              <button type="button" aria-label="Aumentar quantidade" disabled={b.qty >= b.maxQty} onClick={() => b.setQty((v) => Math.min(b.maxQty, v + 1))}>
                <Plus size={18} />
              </button>
            </div>
            <button type="button" className="dc-btn dc-btn-lg dc-add-main" disabled={!b.canAdd} onClick={b.add}>
              <ShoppingBag size={20} /> {b.soldOut ? "Indisponível" : sf.checkout_mode === "order_request" ? "Incluir no pedido" : "Adicionar à sacola"}
            </button>
          </div>
          {!b.ready && (
            <p className="dc-hint" role="status">
              Escolha {missing.join(" e ")} para continuar.
            </p>
          )}
          {b.added && (
            <div className="dc-added" role="status">
              <span>
                <Check size={18} aria-hidden="true" /> Adicionado à sacola!
              </span>
              <button type="button" className="dc-btn dc-btn-soft" onClick={b.openCart}>
                Ver sacola
              </button>
            </div>
          )}
          {wa && (
            <a className="dc-link" href={wa} target="_blank" rel="noreferrer">
              Tirar dúvida pelo WhatsApp
            </a>
          )}
          {tenant.show_address && tenant.address && <p className="dc-small">Retirada: {tenant.address}</p>}
        </section>
      </div>

      {related.length > 0 && (
        <section className="dc-section">
          <header className="dc-head">
            <span className="dc-kicker">Combina com</span>
            <h2>Peça também</h2>
          </header>
          <div className="dc-grid">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
