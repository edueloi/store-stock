import { Link, useParams } from "react-router-dom";
import { ArrowLeft, BookOpen, Check, Minus, Plus, ShoppingBag } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import StockAvailability from "../../../../components/store/StockAvailability";
import { parseProductIdFromRoute } from "../../store-routing";
import { priceInfo, useBuy, useKit, whatsappLink } from "./kit";
import { BookCard } from "./parts";
import type { Product } from "../../../../types";
import "./styles.css";

export default function StoreProduct() {
  const { productId } = useParams();
  const { active, path } = useKit();
  const product = active.find((p) => p.id === parseProductIdFromRoute(productId));
  if (!product)
    return (
      <div className="bk-page bk-notfound">
        <BookOpen size={56} aria-hidden="true" />
        <h1>Livro não encontrado</h1>
        <p>Ele pode ter saído da estante. Veja o que mais temos.</p>
        <Link className="bk-btn bk-btn-lg" to={path("/catalogo")}>
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
  const related = active.filter((p) => p.id !== product.id && p.category_id === product.category_id).slice(0, 5);
  const wa = whatsappLink(tenant.whatsapp, `Olá! Tenho uma dúvida sobre: ${product.name}`);
  const missing = b.groups.filter((g) => !b.selected[g.name]).map((g) => g.name);
  return (
    <div className="bk-page bk-product">
      <StoreSEO
        title={`${product.name} | ${tenant.name}`}
        description={product.description || product.name}
        image={b.gallery[0]}
        url={typeof window !== "undefined" ? window.location.href : ""}
        siteName={tenant.name}
      />
      <nav className="bk-crumbs" aria-label="Você está em">
        <Link to={path("/catalogo")}>
          <ArrowLeft size={16} /> Livros
        </Link>
        {catName(product) && (
          <>
            <span aria-hidden="true">/</span>
            <Link to={path(`/catalogo?categoria=${product.category_id}`)}>{catName(product)}</Link>
          </>
        )}
      </nav>

      <div className="bk-pd">
        <section className="bk-gallery" aria-label="Capa do livro">
          <div className="bk-gallery-stage">
            <div className="bk-gallery-cover">
              {b.gallery.length ? <img src={b.gallery[b.photo] || b.gallery[0]} alt={product.name} /> : <BookOpen size={80} aria-label="Sem capa" />}
            </div>
          </div>
          {b.gallery.length > 1 && (
            <div className="bk-thumbs">
              {b.gallery.map((src, i) => (
                <button key={`${src}-${i}`} type="button" aria-label={`Ver imagem ${i + 1}`} aria-pressed={b.photo === i} onClick={() => b.setPhoto(i)}>
                  <img src={src} alt="" />
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="bk-buy">
          {catName(product) && <span className="bk-kicker">{catName(product)}</span>}
          <h1>{product.name}</h1>
          <div className="bk-price bk-price-lg">
            <strong>{hidden ? "Valor sob consulta" : price.now}</strong>
            {price.old && <s>{price.old}</s>}
            {price.off && <span className="bk-badge bk-badge-inline">Oferta</span>}
          </div>

          <StockAvailability product={product} tenant={tenant} selected={b.ready ? b.selected : undefined} />

          {b.groups.map((g) => (
            <fieldset key={g.name} className="bk-fieldset">
              <legend>
                {g.name} <small>obrigatório</small>
              </legend>
              <div className="bk-opts">
                {g.values.map((v) => (
                  <button key={v} type="button" className="bk-opt" aria-pressed={b.selected[g.name] === v} onClick={() => b.setSelected((prev) => ({ ...prev, [g.name]: v }))}>
                    {b.selected[g.name] === v && <Check size={15} aria-hidden="true" />} {v}
                  </button>
                ))}
              </div>
            </fieldset>
          ))}

          <div className="bk-buy-row">
            <div className="bk-qty" role="group" aria-label="Quantidade">
              <button type="button" aria-label="Diminuir quantidade" disabled={b.qty <= 1} onClick={() => b.setQty((v) => Math.max(1, v - 1))}>
                <Minus size={18} />
              </button>
              <output aria-live="polite">{b.qty}</output>
              <button type="button" aria-label="Aumentar quantidade" disabled={b.qty >= b.maxQty} onClick={() => b.setQty((v) => Math.min(b.maxQty, v + 1))}>
                <Plus size={18} />
              </button>
            </div>
            <button type="button" className="bk-btn bk-btn-lg bk-add-main" disabled={!b.canAdd} onClick={b.add}>
              <ShoppingBag size={19} /> {b.soldOut ? "Indisponível" : sf.checkout_mode === "order_request" ? "Incluir no pedido" : "Adicionar à sacola"}
            </button>
          </div>
          {!b.ready && (
            <p className="bk-hint" role="status">
              Escolha {missing.join(" e ")} para continuar.
            </p>
          )}
          {b.added && (
            <div className="bk-added" role="status">
              <span>
                <Check size={18} aria-hidden="true" /> Adicionado à sacola!
              </span>
              <button type="button" className="bk-btn bk-btn-sm" onClick={b.openCart}>
                Ver sacola
              </button>
            </div>
          )}

          {product.description && (
            <div className="bk-synopsis">
              <h2>Sinopse</h2>
              <p>{product.description}</p>
            </div>
          )}

          <dl className="bk-spec">
            <div>
              <dt>Gênero</dt>
              <dd>{catName(product) || "Geral"}</dd>
            </div>
            {product.sku && (
              <div>
                <dt>Código</dt>
                <dd>{product.sku}</dd>
              </div>
            )}
          </dl>

          {wa && (
            <a className="bk-link" href={wa} target="_blank" rel="noreferrer">
              Tirar dúvida pelo WhatsApp
            </a>
          )}
          {tenant.show_address && tenant.address && <p className="bk-small">Retirada: {tenant.address}</p>}
        </section>
      </div>

      {related.length > 0 && (
        <section className="bk-section">
          <header className="bk-head">
            <span className="bk-kicker">Na mesma estante</span>
            <h2>Quem leu também gostou</h2>
          </header>
          <div className="bk-grid">
            {related.map((p) => (
              <BookCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
