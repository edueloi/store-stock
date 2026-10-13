import { Link, useParams } from "react-router-dom";
import { Check, Coffee, Heart, Minus, Plus, ShoppingBag } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import StockAvailability from "../../../../components/store/StockAvailability";
import { parseProductIdFromRoute } from "../../store-routing";
import { priceInfo, useBuy, useKit, whatsappLink } from "./kit";
import { Bean, MenuRow, Steam } from "./parts";
import "./styles.css";

export default function StoreProduct() {
  const { productId } = useParams();
  const { tenant, products, categories, path, hidden, wishlist, toggleWishlist, active } = useKit();
  const product = products.find((p) => p.id === parseProductIdFromRoute(productId) && p.is_active);
  const buy = useBuy(product);

  if (!product)
    return (
      <main className="cf-root">
        <div className="cf-emptybox cf-notfound">
          <Coffee size={44} aria-hidden="true" />
          <h1>Item fora do cardápio</h1>
          <Link to={path("/catalogo")} className="cf-btn">
            Voltar ao cardápio
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
    <main className="cf-root">
      <StoreSEO
        title={`${product.name} — ${tenant.name}`}
        description={product.description || product.name}
        image={buy.gallery[0]}
        type="product"
        price={hidden ? undefined : String(product.discount_price ?? product.price)}
        url={typeof window !== "undefined" ? window.location.href : ""}
        siteName={tenant.name}
      />
      <nav className="cf-crumbs" aria-label="Você está em">
        <Link to={path()}>Início</Link>
        <span aria-hidden="true">·</span>
        <Link to={path("/catalogo")}>Cardápio</Link>
        {category && (
          <>
            <span aria-hidden="true">·</span>
            <Link to={path(`/catalogo?cat=${category.id}`)}>{category.name}</Link>
          </>
        )}
      </nav>

      <div className="cf-product">
        <section className="cf-gallery" aria-label="Fotos do produto">
          <div className="cf-bigarch">
            <Steam className="cf-steam" />
            {buy.gallery.length ? <img src={buy.gallery[buy.photo] || buy.gallery[0]} alt={product.name} /> : <Bean className="cf-arch-bean" />}
            {p.off && <em className="cf-tag cf-tag-lg">Oferta</em>}
          </div>
          {buy.gallery.length > 1 && (
            <div className="cf-dots">
              {buy.gallery.map((src, i) => (
                <button key={`${src}-${i}`} aria-label={`Ver foto ${i + 1}`} aria-pressed={buy.photo === i} onClick={() => buy.setPhoto(i)}>
                  <img src={src} alt="" />
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="cf-card">
          {category && <p className="cf-eyebrow">{category.name}</p>}
          <h1>{product.name}</h1>
          {product.sku && <p className="cf-ref">Ref. {product.sku}</p>}
          <p className="cf-priceline">
            <span>Preço</span>
            <span className="cf-leader" aria-hidden="true" />
            <span className="cf-priceval">
              {p.old && <s>{p.old}</s>}
              <strong>{p.now}</strong>
            </span>
          </p>
          {product.description && <p className="cf-desc">{product.description}</p>}

          {buy.groups.map((g) => (
            <fieldset key={g.name} className="cf-opts">
              <legend>
                {g.name} <small>{buy.selected[g.name] || "escolha uma opção"}</small>
              </legend>
              <div className="cf-opt-row">
                {g.values.map((v) => {
                  const on = buy.selected[g.name] === v;
                  return (
                    <button key={v} className={`cf-opt ${on ? "is-on" : ""}`} aria-pressed={on} onClick={() => buy.setSelected((s) => ({ ...s, [g.name]: v }))}>
                      {on && <Check size={14} />} {v}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          ))}

          <StockAvailability product={product} tenant={tenant} selected={buy.ready ? buy.selected : undefined} className="cf-stock" />
          {missing.length > 0 && <p className="cf-hint">Escolha {missing.join(" e ")} para pedir.</p>}

          <div className="cf-buyrow">
            <div className="cf-qty" role="group" aria-label="Quantidade">
              <button aria-label="Diminuir quantidade" onClick={() => buy.setQty((q) => Math.max(1, q - 1))} disabled={buy.qty <= 1}>
                <Minus size={16} />
              </button>
              <output aria-live="polite">{buy.qty}</output>
              <button aria-label="Aumentar quantidade" onClick={() => buy.setQty((q) => Math.min(buy.maxQty || 1, q + 1))} disabled={buy.qty >= buy.maxQty}>
                <Plus size={16} />
              </button>
            </div>
            <button className="cf-btn cf-grow" onClick={buy.add} disabled={!buy.canAdd}>
              <ShoppingBag size={18} /> {buy.soldOut ? "Esgotado" : "Adicionar à comanda"}
            </button>
            <button className="cf-ico" aria-pressed={liked} aria-label={liked ? "Remover dos favoritos" : "Favoritar"} onClick={() => toggleWishlist(product.id)}>
              <Heart size={20} fill={liked ? "currentColor" : "none"} />
            </button>
          </div>
          {wa && (
            <a className="cf-link" href={wa} target="_blank" rel="noreferrer">
              Tirar uma dúvida pelo WhatsApp
            </a>
          )}
        </section>
      </div>

      {more.length > 0 && (
        <section className="cf-block">
          <header className="cf-head">
            <p className="cf-eyebrow">Para acompanhar</p>
            <h2>Também no cardápio</h2>
          </header>
          <div className="cf-menu">
            {more.map((x) => (
              <MenuRow key={x.id} product={x} />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
