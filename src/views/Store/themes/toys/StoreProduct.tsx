import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Check, Minus, Plus, Puzzle, ShoppingBag } from "lucide-react";
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
      <div className="toys-page toys-notfound">
        <Puzzle size={56} aria-hidden="true" />
        <h1>Brinquedo não encontrado</h1>
        <p>Ele pode ter saído da prateleira. Que tal ver os outros?</p>
        <Link className="toys-btn toys-btn-solid toys-btn-lg" to={path("/catalogo")}>
          Voltar ao catálogo
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
    <div className="toys-page toys-product">
      <StoreSEO
        title={`${product.name} | ${tenant.name}`}
        description={product.description || product.name}
        image={b.gallery[0]}
        url={typeof window !== "undefined" ? window.location.href : ""}
        siteName={tenant.name}
      />
      <nav className="toys-crumbs" aria-label="Você está em">
        <Link to={path("/catalogo")}>
          <ArrowLeft size={16} /> Brinquedos
        </Link>
        {catName(product) && (
          <>
            <span aria-hidden="true">/</span>
            <Link to={path(`/catalogo?categoria=${product.category_id}`)}>{catName(product)}</Link>
          </>
        )}
      </nav>

      <div className="toys-pd">
        <section className="toys-gallery" aria-label="Fotos do brinquedo">
          <div className="toys-gallery-main">
            {b.gallery.length ? <img src={b.gallery[b.photo] || b.gallery[0]} alt={product.name} /> : <Puzzle size={90} aria-label="Sem imagem" />}
            {price.off && <span className="toys-sticker toys-sticker-sale">Oferta</span>}
          </div>
          {b.gallery.length > 1 && (
            <div className="toys-thumbs">
              {b.gallery.map((src, i) => (
                <button key={`${src}-${i}`} type="button" aria-label={`Ver foto ${i + 1}`} aria-pressed={b.photo === i} onClick={() => b.setPhoto(i)}>
                  <img src={src} alt="" />
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="toys-buy">
          {catName(product) && <span className="toys-chip">{catName(product)}</span>}
          <h1>{product.name}</h1>
          {product.sku && <small className="toys-sku">Código: {product.sku}</small>}
          <div className="toys-price toys-price-lg">
            <strong>{hidden ? "Valor sob consulta" : price.now}</strong>
            {price.old && <s>{price.old}</s>}
          </div>
          {product.description && <p className="toys-desc">{product.description}</p>}

          <StockAvailability product={product} tenant={tenant} selected={b.ready ? b.selected : undefined} />

          {b.groups.map((g, gi) => (
            <fieldset key={g.name} className="toys-fieldset">
              <legend>
                {g.name} <small>obrigatório</small>
              </legend>
              <div className="toys-opts">
                {g.values.map((v) => (
                  <button
                    key={v}
                    type="button"
                    className={`toys-opt toys-tint-${(gi + 1) % 4}`}
                    aria-pressed={b.selected[g.name] === v}
                    onClick={() => b.setSelected((prev) => ({ ...prev, [g.name]: v }))}
                  >
                    {b.selected[g.name] === v && <Check size={15} aria-hidden="true" />} {v}
                  </button>
                ))}
              </div>
            </fieldset>
          ))}

          <label className="toys-note-field">
            <span>Observação (opcional)</span>
            <textarea value={b.note} maxLength={250} onChange={(e) => b.setNote(e.target.value)} placeholder="Ex.: é presente, quero embalagem especial..." rows={3} />
          </label>

          <div className="toys-buy-row">
            <div className="toys-qty" role="group" aria-label="Quantidade">
              <button type="button" aria-label="Diminuir quantidade" disabled={b.qty <= 1} onClick={() => b.setQty((v) => Math.max(1, v - 1))}>
                <Minus size={18} />
              </button>
              <output aria-live="polite">{b.qty}</output>
              <button type="button" aria-label="Aumentar quantidade" disabled={b.qty >= b.maxQty} onClick={() => b.setQty((v) => Math.min(b.maxQty, v + 1))}>
                <Plus size={18} />
              </button>
            </div>
            <button type="button" className="toys-btn toys-btn-solid toys-btn-lg toys-add" disabled={!b.canAdd} onClick={b.add}>
              <ShoppingBag size={20} /> {b.soldOut ? "Indisponível" : sf.checkout_mode === "order_request" ? "Incluir no pedido" : "Adicionar à sacola"}
            </button>
          </div>
          {!b.ready && (
            <p className="toys-hint" role="status">
              Escolha {missing.join(" e ")} para continuar.
            </p>
          )}
          {b.added && (
            <div className="toys-added" role="status">
              <span>
                <Check size={18} aria-hidden="true" /> Adicionado à sacola!
              </span>
              <button type="button" className="toys-btn toys-btn-yellow" onClick={b.openCart}>
                Ver sacola
              </button>
            </div>
          )}
          {wa && (
            <a className="toys-link" href={wa} target="_blank" rel="noreferrer">
              Tirar dúvida pelo WhatsApp
            </a>
          )}
          {tenant.show_address && tenant.address && <p className="toys-small">Retirada: {tenant.address}</p>}
        </section>
      </div>

      {related.length > 0 && (
        <section className="toys-section">
          <header className="toys-head">
            <span className="toys-pill toys-pill-mint">Para brincar junto</span>
            <h2>Veja também</h2>
          </header>
          <div className="toys-grid">
            {related.map((p, i) => (
              <ProductCard key={p.id} product={p} index={i} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
