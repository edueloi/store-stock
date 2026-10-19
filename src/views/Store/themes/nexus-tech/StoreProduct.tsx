import { useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Check, ChevronLeft, ChevronRight, Heart, MessageCircle, Minus, Package, Plus, Share2, ShoppingBag } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import StockAvailability from "../../../../components/store/StockAvailability";
import { useStore } from "../../StoreLayout";
import { parseProductIdFromRoute } from "../../store-routing";
import { getVariationImages } from "../../../../utils/variationImages";
import { availableUnits, storeTracksStock } from "../../../../utils/storeStock";
import { groups, money, optionDisabled, pricesHidden, unitPrice, useTheme, waLink } from "./lib";
import { Card, PERKS, Price } from "./parts";
import "./styles.css";

export default function StoreProduct() {
  const { productId } = useParams();
  const { products, categories, tenant, addToCart, openCart, wishlist, toggleWishlist } = useStore();
  const { path } = useTheme();
  const product = products.find((p) => p.id === parseProductIdFromRoute(productId));
  const [active, setActive] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [added, setAdded] = useState(false);
  const optsRef = useRef<HTMLDivElement>(null);
  const gs = useMemo(() => (product ? groups(product) : []), [product]);

  if (!product || !product.is_active) {
    return (
      <main className="nx-page">
        <div className="nx-wrap nx-emptybox">
          <Package size={44} aria-hidden="true" />
          <h2>Produto não encontrado</h2>
          <Link to={path("/catalogo")} className="nx-btn">Voltar ao catálogo</Link>
        </div>
      </main>
    );
  }

  const hidden = pricesHidden(tenant);
  const baseImages = Array.isArray(product.images) && product.images.length ? product.images : product.image_url ? [product.image_url] : [];
  const varImages = getVariationImages(product, selected);
  const images = varImages.length ? varImages : baseImages;
  const cat = categories.find((c) => c.id === product.category_id);
  const ready = gs.every((g) => selected[g.name]);
  const units = storeTracksStock(tenant) ? availableUnits(product, selected) : null;
  const soldOut = units === 0;
  const max = units === null ? 99 : Math.max(1, units);
  const qty = Math.min(Math.max(1, quantity), max);
  const price = unitPrice(product);
  const url = typeof window !== "undefined" ? window.location.href : "";
  const related = products.filter((p) => p.is_active && p.type !== "internal" && p.id !== product.id && p.category_id === product.category_id).slice(0, 3);

  const pick = (name: string, value: string) => {
    setSelected((s) => ({ ...s, [name]: s[name] === value ? "" : value }));
    setActive(0);
  };
  const add = () => {
    if (!ready) {
      optsRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    if (soldOut) return;
    for (let i = 0; i < qty; i += 1) addToCart(product, gs.length ? selected : undefined);
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1600);
    openCart();
  };
  const share = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: product.name, url });
        return;
      }
      await navigator.clipboard.writeText(url);
    } catch {
      /* cancelado */
    }
  };

  return (
    <main className="nx-page nx-prod-page">
      <StoreSEO
        title={`${product.name} — ${tenant.name}`}
        description={product.description || `${product.name} na ${tenant.name}.`}
        image={images[0]}
        url={url}
        type="product"
        price={hidden ? undefined : String(price)}
        siteName={tenant.name}
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "Product",
          name: product.name,
          description: product.description || product.name,
          image: baseImages,
          sku: product.sku || String(product.id),
          ...(cat ? { category: cat.name } : {}),
          ...(hidden
            ? {}
            : {
                offers: {
                  "@type": "Offer",
                  url,
                  priceCurrency: "BRL",
                  price: String(price),
                  itemCondition: "https://schema.org/NewCondition",
                  availability: soldOut ? "https://schema.org/OutOfStock" : "https://schema.org/InStock",
                  seller: { "@type": "Organization", name: tenant.name },
                },
              }),
        }}
      />
      <div className="nx-wrap">
        <p className="nx-crumb nx-crumb-p">
          <Link to={path()}>Início</Link> / <Link to={path("/catalogo")}>Catálogo</Link>
          {cat && (
            <>
              {" "}/ <Link to={path(`/catalogo?cat=${cat.id}`)}>{cat.name}</Link>
            </>
          )}
        </p>

        <div className="nx-prod">
          <section className="nx-gallery" aria-label="Fotos do produto">
            <div className="nx-stage">
              {images.length ? <img src={images[Math.min(active, images.length - 1)]} alt={product.name} /> : <Package size={72} aria-hidden="true" />}
              {product.discount_price != null && <span className="nx-badge">Oferta</span>}
              {images.length > 1 && (
                <>
                  <button type="button" className="nx-arrow nx-prev" aria-label="Foto anterior" onClick={() => setActive((i) => (i - 1 + images.length) % images.length)}>
                    <ChevronLeft size={20} />
                  </button>
                  <button type="button" className="nx-arrow nx-next" aria-label="Próxima foto" onClick={() => setActive((i) => (i + 1) % images.length)}>
                    <ChevronRight size={20} />
                  </button>
                </>
              )}
            </div>
            {images.length > 1 && (
              <div className="nx-thumbs">
                {images.map((img, i) => (
                  <button key={img + i} type="button" className={i === active ? "is-on" : ""} aria-label={`Ver foto ${i + 1}`} onClick={() => setActive(i)}>
                    <img src={img} alt="" />
                  </button>
                ))}
              </div>
            )}
          </section>

          <aside className="nx-buy">
            {cat && <p className="nx-kicker nx-kicker-dark">{cat.name}</p>}
            <h1>{product.name}</h1>
            {product.sku && <p className="nx-ref">Ref. {product.sku}</p>}
            <Price product={product} large />
            {!hidden && product.discount_price != null && <p className="nx-save">Você economiza {money(Number(product.price) - price)}</p>}

            <div ref={optsRef} className="nx-opts">
              {gs.map((g) => (
                <fieldset key={g.name}>
                  <legend>{g.name} <b>{selected[g.name] || ""}</b></legend>
                  <div>
                    {g.values.map((v) => {
                      const off = optionDisabled(tenant, product, selected, g.name, v);
                      const on = selected[g.name] === v;
                      const hex = g.colors?.[v];
                      return (
                        <button key={v} type="button" disabled={off} aria-pressed={on} className={`nx-opt ${on ? "is-on" : ""}`} onClick={() => pick(g.name, v)}>
                          {hex && <i style={{ background: hex }} aria-hidden="true" />}
                          {on && <Check size={14} aria-hidden="true" />} {v}
                        </button>
                      );
                    })}
                  </div>
                </fieldset>
              ))}
              {gs.length > 0 && !ready && <p className="nx-hint">Selecione as opções para adicionar ao carrinho.</p>}
            </div>

            <StockAvailability product={product} tenant={tenant} selected={selected} className="nx-stock" />

            <div className="nx-buy-row">
              <div className="nx-qty" role="group" aria-label="Quantidade">
                <button type="button" aria-label="Diminuir quantidade" onClick={() => setQuantity(Math.max(1, qty - 1))}><Minus size={16} /></button>
                <output>{qty}</output>
                <button type="button" aria-label="Aumentar quantidade" disabled={qty >= max} onClick={() => setQuantity(Math.min(max, qty + 1))}><Plus size={16} /></button>
              </div>
              <button type="button" className="nx-btn nx-btn-lg nx-buy-btn" disabled={soldOut} onClick={add}>
                {added ? <Check size={18} aria-hidden="true" /> : <ShoppingBag size={18} aria-hidden="true" />}
                {soldOut ? "Esgotado" : added ? "Adicionado" : "Adicionar ao carrinho"}
              </button>
            </div>
            <div className="nx-buy-links">
              <button type="button" aria-pressed={wishlist.includes(product.id)} onClick={() => toggleWishlist(product.id)}>
                <Heart size={16} fill={wishlist.includes(product.id) ? "currentColor" : "none"} aria-hidden="true" /> Favoritar
              </button>
              <button type="button" onClick={share}><Share2 size={16} aria-hidden="true" /> Compartilhar</button>
              {tenant.whatsapp && (
                <a href={waLink(tenant, `Olá! Tenho interesse em ${product.name}.`)} target="_blank" rel="noreferrer">
                  <MessageCircle size={16} aria-hidden="true" /> Tirar dúvida
                </a>
              )}
            </div>
            <ul className="nx-mini-perks">
              {PERKS.map(({ icon: Icon, title }) => (
                <li key={title}><Icon size={16} aria-hidden="true" /> {title}</li>
              ))}
            </ul>
          </aside>
        </div>

        <section className="nx-detail">
          <div>
            <p className="nx-kicker nx-kicker-dark">Detalhes</p>
            <h2>Sobre este produto</h2>
            <p className="nx-desc">{product.description || "Fale com a loja para conhecer todos os detalhes deste produto."}</p>
          </div>
          <div className="nx-perks-col">
            {PERKS.map(({ icon: Icon, title, text }) => (
              <div key={title} className="nx-perk nx-perk-sm">
                <span className="nx-perk-ico"><Icon size={20} aria-hidden="true" /></span>
                <div><h3>{title}</h3><p>{text}</p></div>
              </div>
            ))}
          </div>
        </section>

        {related.length > 0 && (
          <section className="nx-sec">
            <header className="nx-sec-h"><p className="nx-kicker nx-kicker-dark">Continue explorando</p><h2>Você também pode gostar</h2></header>
            <div className="nx-grid">{related.map((p) => <Card key={p.id} product={p} />)}</div>
          </section>
        )}
      </div>
      <div className="nx-sticky" role="region" aria-label="Compra rápida">
        <div>
          <small>{product.name}</small>
          <strong>{hidden ? "Sob consulta" : money(price)}</strong>
        </div>
        <button type="button" className="nx-btn" disabled={soldOut} onClick={add}>
          <ShoppingBag size={17} aria-hidden="true" /> {soldOut ? "Esgotado" : !ready ? "Escolher opções" : "Comprar"}
        </button>
      </div>
    </main>
  );
}
