import { Link, useParams } from "react-router-dom";
import { Check, Heart, Minus, Plus, ShoppingBag } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import StockAvailability from "../../../../components/store/StockAvailability";
import { parseProductIdFromRoute } from "../../store-routing";
import { priceInfo, useBuy, useKit, whatsappLink } from "./kit";
import { Balloon, Bow, Cloud, GiftCard } from "./parts";
import "./styles.css";

export default function StoreProduct() {
  const { productId } = useParams();
  const { tenant, products, categories, path, hidden, wishlist, toggleWishlist, active } = useKit();
  const product = products.find((p) => p.id === parseProductIdFromRoute(productId) && p.is_active);
  const buy = useBuy(product);

  if (!product)
    return (
      <main className="bb-root">
        <div className="bb-empty bb-empty-page">
          <Cloud className="bb-empty-cloud" />
          <h1 className="bb-script">Esse mimo não está por aqui</h1>
          <Link to={path("/catalogo")} className="bb-btn bb-btn-main">
            Voltar ao catálogo
          </Link>
        </div>
      </main>
    );

  const p = priceInfo(product, hidden);
  const category = categories.find((c) => c.id === product.category_id);
  const liked = wishlist.includes(product.id);
  const related = active.filter((x) => x.id !== product.id && x.category_id === product.category_id).slice(0, 4);
  const more = related.length ? related : active.filter((x) => x.id !== product.id).slice(0, 4);
  const wa = whatsappLink(tenant.whatsapp, `Olá! Tenho interesse em ${product.name}.`);
  const missing = buy.groups.filter((g) => !buy.selected[g.name]).map((g) => g.name);

  return (
    <main className="bb-root">
      <StoreSEO
        title={`${product.name} — ${tenant.name}`}
        description={product.description || product.name}
        image={buy.gallery[0]}
        type="product"
        price={hidden ? undefined : String(product.discount_price ?? product.price)}
        url={typeof window !== "undefined" ? window.location.href : ""}
        siteName={tenant.name}
      />
      <nav className="bb-crumbs" aria-label="Você está em">
        <Link to={path()}>Início</Link>
        <span aria-hidden="true">•</span>
        <Link to={path("/catalogo")}>Catálogo</Link>
        {category && (
          <>
            <span aria-hidden="true">•</span>
            <Link to={path(`/catalogo?cat=${category.id}`)}>{category.name}</Link>
          </>
        )}
      </nav>

      <div className="bb-product">
        <section className="bb-gallery" aria-label="Fotos do produto">
          <div className="bb-frame">
            <Balloon className="bb-frame-balloon" color="var(--bb-accent)" />
            <div className="bb-frame-arch">
              {buy.gallery.length ? <img src={buy.gallery[buy.photo] || buy.gallery[0]} alt={product.name} /> : <Cloud className="bb-hero-fallback" />}
            </div>
            {p.off && <span className="bb-badge bb-badge-lg">Oferta</span>}
          </div>
          {buy.gallery.length > 1 && (
            <div className="bb-thumbs">
              {buy.gallery.map((src, i) => (
                <button key={`${src}-${i}`} aria-label={`Ver foto ${i + 1}`} aria-pressed={buy.photo === i} onClick={() => buy.setPhoto(i)}>
                  <img src={src} alt="" />
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="bb-buy">
          <Bow className="bb-buy-bow" />
          {category && <p className="bb-kicker">{category.name}</p>}
          <h1 className="bb-script">{product.name}</h1>
          {product.sku && <p className="bb-ref">Ref. {product.sku}</p>}
          <p className="bb-price bb-price-lg">
            <strong>{p.now}</strong>
            {p.old && <s>{p.old}</s>}
          </p>
          {product.description && <p className="bb-desc">{product.description}</p>}

          {buy.groups.map((g) => (
            <fieldset key={g.name} className="bb-opts">
              <legend>
                {g.name} <small>{buy.selected[g.name] || "escolha uma opção"}</small>
              </legend>
              <div className="bb-opt-row">
                {g.values.map((v) => {
                  const on = buy.selected[g.name] === v;
                  return (
                    <button key={v} className={`bb-opt ${on ? "is-on" : ""}`} aria-pressed={on} onClick={() => buy.setSelected((s) => ({ ...s, [g.name]: v }))}>
                      {on && <Check size={14} />} {v}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          ))}

          <StockAvailability product={product} tenant={tenant} selected={buy.ready ? buy.selected : undefined} className="bb-stock" />
          {missing.length > 0 && <p className="bb-hint">Escolha {missing.join(" e ")} para colocar na sacola.</p>}

          <div className="bb-buy-row">
            <div className="bb-qty" role="group" aria-label="Quantidade">
              <button aria-label="Diminuir quantidade" onClick={() => buy.setQty((q) => Math.max(1, q - 1))} disabled={buy.qty <= 1}>
                <Minus size={16} />
              </button>
              <output aria-live="polite">{buy.qty}</output>
              <button aria-label="Aumentar quantidade" onClick={() => buy.setQty((q) => Math.min(buy.maxQty || 1, q + 1))} disabled={buy.qty >= buy.maxQty}>
                <Plus size={16} />
              </button>
            </div>
            <button className="bb-btn bb-btn-main bb-add" onClick={buy.add} disabled={!buy.canAdd}>
              <ShoppingBag size={18} /> {buy.soldOut ? "Esgotado" : "Colocar na sacola"}
            </button>
            <button className="bb-heart bb-heart-inline" aria-pressed={liked} aria-label={liked ? "Remover dos favoritos" : "Favoritar"} onClick={() => toggleWishlist(product.id)}>
              <Heart size={20} fill={liked ? "currentColor" : "none"} />
            </button>
          </div>
          {wa && (
            <a className="bb-link" href={wa} target="_blank" rel="noreferrer">
              Tirar uma dúvida pelo WhatsApp
            </a>
          )}
        </section>
      </div>

      {more.length > 0 && (
        <section className="bb-section">
          <header className="bb-head">
            <h2 className="bb-script">Combina com esse carinho</h2>
          </header>
          <div className="bb-grid">
            {more.map((x, i) => (
              <GiftCard key={x.id} product={x} index={i + 1} />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
