import { useState } from "react";
import { Link } from "react-router-dom";
import { Check, Heart, MessageCircle, Minus, Plus, Share2 } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import StockAvailability from "../../../../components/store/StockAvailability";
import Card from "./Card";
import { hasDiscount, money, priceOf, useProductState } from "./kit";
import "./styles.css";

export default function StoreProduct() {
  const s = useProductState();
  const { product, tenant, categories, path, hidden, wishlist, toggleWishlist, waLink } = s;
  const [note, setNote] = useState("");

  if (!product)
    return (
      <main className="atl-page">
        <div className="atl-wrap atl-none">
          <h2>Peça não encontrada</h2>
          <p>Ela pode ter saído da coleção ou estar indisponível.</p>
          <Link className="atl-btn" to={path("/catalogo")}>Voltar à coleção</Link>
        </div>
      </main>
    );

  const category = categories.find((c) => c.id === product.category_id);
  const liked = wishlist.includes(product.id);
  const related = s.active.filter((p) => p.id !== product.id && p.category_id === product.category_id).slice(0, 4);
  const pol = tenant.policies;
  const policies = [
    { t: "Entrega", v: pol?.shipping },
    { t: "Trocas", v: pol?.exchange },
    { t: "Devoluções", v: pol?.returns },
  ].filter((x) => x.v) as { t: string; v: string }[];
  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ title: product.name, url: window.location.href });
      else {
        await navigator.clipboard.writeText(window.location.href);
        setNote("Link copiado");
        window.setTimeout(() => setNote(""), 2500);
      }
    } catch {
      /* cancelado */
    }
  };

  return (
    <main className="atl-page">
      <StoreSEO title={`${product.name} — ${tenant.name}`} description={product.description || product.name} image={s.images[0]} url={typeof window !== "undefined" ? window.location.href : ""} type="product" price={hidden ? undefined : String(priceOf(product))} siteName={tenant.name} />
      <div className="atl-wrap atl-prod">
        <nav className="atl-crumbs" aria-label="Você está em">
          <Link to={path("/catalogo")}>Coleção</Link>
          {category && <> / <Link to={path(`/catalogo?categoria=${category.id}`)}>{category.name}</Link></>}
        </nav>
        <div className="atl-prod-grid">
          <section className="atl-gallery" aria-label="Fotos da peça">
            <div className="atl-gallery-main">
              {s.images.length ? <img src={s.images[s.activeImage] || s.images[0]} alt={product.name} /> : <span aria-hidden="true">{product.name.slice(0, 1)}</span>}
            </div>
            {s.images.length > 1 && (
              <div className="atl-thumbs">
                {s.images.map((im, i) => (
                  <button key={im + i} type="button" aria-label={`Ver foto ${i + 1}`} aria-current={i === s.activeImage} className={i === s.activeImage ? "is-on" : ""} onClick={() => s.setActiveImage(i)}>
                    <img src={im} alt="" />
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="atl-buy">
            {category && <span className="atl-kicker">{category.name}</span>}
            <h1>{product.name}</h1>
            {hidden ? (
              <p className="atl-prod-price atl-muted">Sob consulta</p>
            ) : (
              <p className="atl-prod-price">
                <strong>{money(priceOf(product))}</strong>
                {hasDiscount(product) && <s>{money(Number(product.price))}</s>}
              </p>
            )}
            {product.description && <p className="atl-desc">{product.description}</p>}

            {s.groups.map((g) => (
              <fieldset key={g.name} className="atl-opt">
                <legend>{g.name}{s.selected[g.name] ? <span> — {s.selected[g.name]}</span> : null}</legend>
                <div>
                  {g.values.map((v) => {
                    const on = s.selected[g.name] === v;
                    return (
                      <button key={v} type="button" aria-pressed={on} className={on ? "is-on" : ""} onClick={() => s.choose(g.name, v)}>
                        {on && <Check size={14} aria-hidden="true" />}{v}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            ))}
            {s.groups.length > 0 && !s.ready && <p className="atl-hint">Escolha todas as opções para continuar.</p>}
            <StockAvailability product={product} tenant={tenant} selected={s.selected} className="atl-stock" />

            <div className="atl-buyrow">
              <div className="atl-qty" role="group" aria-label="Quantidade">
                <button type="button" aria-label="Diminuir quantidade" onClick={() => s.setQuantity(Math.max(1, s.qty - 1))}><Minus size={16} /></button>
                <span aria-live="polite">{s.qty}</span>
                <button type="button" aria-label="Aumentar quantidade" disabled={s.qty >= s.maxQty} onClick={() => s.setQuantity(Math.min(s.maxQty, s.qty + 1))}><Plus size={16} /></button>
              </div>
              <button type="button" className="atl-btn atl-btn-grow" disabled={!s.canAdd} onClick={s.add}>
                {s.soldOut ? "Esgotado" : hidden ? "Incluir no pedido" : "Adicionar à sacola"}
              </button>
            </div>
            <div className="atl-links">
              <button type="button" aria-pressed={liked} onClick={() => toggleWishlist(product.id)}><Heart size={16} strokeWidth={1.5} fill={liked ? "currentColor" : "none"} /> {liked ? "Nos favoritos" : "Favoritar"}</button>
              <button type="button" onClick={share}><Share2 size={16} strokeWidth={1.5} /> {note || "Compartilhar"}</button>
              {tenant.whatsapp && <a href={waLink(`Olá! Tenho dúvidas sobre ${product.name}.`)} target="_blank" rel="noreferrer"><MessageCircle size={16} strokeWidth={1.5} /> Falar com a loja</a>}
            </div>
            {product.sku && <p className="atl-ref">Ref. {product.sku}</p>}
            {policies.length > 0 && (
              <div className="atl-acc">
                {policies.map((x) => (
                  <details key={x.t}>
                    <summary>{x.t}</summary>
                    <p>{x.v}</p>
                  </details>
                ))}
              </div>
            )}
          </section>
        </div>

        {related.length > 0 && (
          <section className="atl-related">
            <header className="atl-head"><span className="atl-kicker">Combina com</span><h2>Você também pode gostar</h2></header>
            <div className="atl-grid">{related.map((p) => <Card key={p.id} product={p} />)}</div>
          </section>
        )}
      </div>
    </main>
  );
}
