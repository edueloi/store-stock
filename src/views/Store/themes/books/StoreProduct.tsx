import { Link, useParams } from "react-router-dom";
import { BookOpen, Check, Heart, Minus, Plus, ShoppingBag } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import StockAvailability from "../../../../components/store/StockAvailability";
import { parseProductIdFromRoute } from "../../store-routing";
import { priceInfo, useBuy, useKit, whatsappLink } from "./kit";
import { Cover, Ornament } from "./parts";
import "./styles.css";

export default function StoreProduct() {
  const { productId } = useParams();
  const { tenant, products, categories, path, hidden, wishlist, toggleWishlist, active } = useKit();
  const product = products.find((p) => p.id === parseProductIdFromRoute(productId) && p.is_active);
  const buy = useBuy(product);

  if (!product)
    return (
      <main className="bk-root">
        <div className="bk-empty-box bk-notfound">
          <BookOpen size={44} aria-hidden="true" />
          <h1>Título não encontrado</h1>
          <p>Esta página não está na estante.</p>
          <Link to={path("/catalogo")} className="bk-btn">
            Voltar ao catálogo
          </Link>
        </div>
      </main>
    );

  const p = priceInfo(product, hidden);
  const category = categories.find((c) => c.id === product.category_id);
  const liked = wishlist.includes(product.id);
  const related = active.filter((x) => x.id !== product.id && x.category_id === product.category_id).slice(0, 5);
  const wa = whatsappLink(tenant.whatsapp, `Olá! Tenho interesse em ${product.name}.`);
  const missing = buy.groups.filter((g) => !buy.selected[g.name]).map((g) => g.name);

  return (
    <main className="bk-root">
      <StoreSEO
        title={`${product.name} — ${tenant.name}`}
        description={product.description || product.name}
        image={buy.gallery[0]}
        type="product"
        price={hidden ? undefined : String(product.discount_price ?? product.price)}
        url={typeof window !== "undefined" ? window.location.href : ""}
        siteName={tenant.name}
      />
      <nav className="bk-crumbs" aria-label="Você está em">
        <Link to={path()}>Início</Link>
        <span aria-hidden="true">/</span>
        <Link to={path("/catalogo")}>Catálogo</Link>
        {category && (
          <>
            <span aria-hidden="true">/</span>
            <Link to={path(`/catalogo?cat=${category.id}`)}>{category.name}</Link>
          </>
        )}
      </nav>

      <div className="bk-product">
        <section className="bk-pcover" aria-label="Capa e fotos">
          <div className="bk-pcover-main">
            {buy.gallery.length ? <img src={buy.gallery[buy.photo] || buy.gallery[0]} alt={product.name} /> : <span className="bk-cover-blank bk-cover-blank-lg">{product.name}</span>}
            <span className="bk-cover-hinge" aria-hidden="true" />
            {p.off && <span className="bk-seal">Oferta</span>}
          </div>
          {buy.gallery.length > 1 && (
            <div className="bk-pthumbs">
              {buy.gallery.map((src, i) => (
                <button key={`${src}-${i}`} aria-label={`Ver imagem ${i + 1}`} aria-pressed={buy.photo === i} onClick={() => buy.setPhoto(i)}>
                  <img src={src} alt="" />
                </button>
              ))}
            </div>
          )}
        </section>

        <article className="bk-flap">
          {category && <p className="bk-eyebrow">{category.name}</p>}
          <h1>{product.name}</h1>
          {product.sku && <p className="bk-ref">Código {product.sku}</p>}
          <Ornament className="bk-orn bk-orn-left" />
          <h2 className="bk-flap-title">Sobre esta leitura</h2>
          {product.description ? (
            <div className="bk-prose">
              {product.description.split(/\n{1,}/).filter(Boolean).map((para, i) => (
                <p key={i}>{para}</p>
              ))}
            </div>
          ) : (
            <p className="bk-prose bk-muted">Esta edição ainda não tem sinopse cadastrada. Fale com a livraria para saber mais.</p>
          )}
        </article>

        <aside className="bk-ticket" aria-label="Comprar">
          <p className="bk-ticket-label">Ficha de compra</p>
          <p className="bk-book-price bk-price-xl">
            <strong>{p.now}</strong>
            {p.old && <s>{p.old}</s>}
          </p>
          {buy.groups.map((g) => (
            <fieldset key={g.name} className="bk-opts">
              <legend>
                {g.name} <small>{buy.selected[g.name] || "escolha uma opção"}</small>
              </legend>
              <div className="bk-opt-row">
                {g.values.map((v) => {
                  const on = buy.selected[g.name] === v;
                  return (
                    <button key={v} className={`bk-opt ${on ? "is-on" : ""}`} aria-pressed={on} onClick={() => buy.setSelected((s) => ({ ...s, [g.name]: v }))}>
                      {on && <Check size={14} />} {v}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          ))}
          <StockAvailability product={product} tenant={tenant} selected={buy.ready ? buy.selected : undefined} className="bk-stock" />
          {missing.length > 0 && <p className="bk-hint">Escolha {missing.join(" e ")} para continuar.</p>}
          <div className="bk-buyrow">
            <div className="bk-qty" role="group" aria-label="Quantidade">
              <button aria-label="Diminuir quantidade" onClick={() => buy.setQty((q) => Math.max(1, q - 1))} disabled={buy.qty <= 1}>
                <Minus size={16} />
              </button>
              <output aria-live="polite">{buy.qty}</output>
              <button aria-label="Aumentar quantidade" onClick={() => buy.setQty((q) => Math.min(buy.maxQty || 1, q + 1))} disabled={buy.qty >= buy.maxQty}>
                <Plus size={16} />
              </button>
            </div>
            <button className="bk-icon-line" aria-pressed={liked} aria-label={liked ? "Remover da lista de desejos" : "Adicionar à lista de desejos"} onClick={() => toggleWishlist(product.id)}>
              <Heart size={20} fill={liked ? "currentColor" : "none"} />
            </button>
          </div>
          <button className="bk-btn bk-btn-block" onClick={buy.add} disabled={!buy.canAdd}>
            <ShoppingBag size={18} /> {buy.soldOut ? "Esgotado" : "Colocar na pilha"}
          </button>
          {wa && (
            <a className="bk-link" href={wa} target="_blank" rel="noreferrer">
              Perguntar sobre este título
            </a>
          )}
        </aside>
      </div>

      {related.length > 0 && (
        <section className="bk-block">
          <header className="bk-head">
            <p className="bk-eyebrow">Para continuar</p>
            <h2>Na mesma estante</h2>
            <Ornament className="bk-orn" />
          </header>
          <div className="bk-shelf-books">
            {related.map((x, i) => (
              <Cover key={x.id} product={x} index={i + 2} />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
