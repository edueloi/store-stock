import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Check, Heart, MessageCircle, Minus, Plus, Share2 } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import StockAvailability from "../../../../components/store/StockAvailability";
import { parseProductIdFromRoute } from "../../store-routing";
import { getVariationImages } from "../../../../utils/variationImages";
import { Empty, Piece } from "./parts";
import { imageOf, inStock, maxQuantity, money, priceInfo, shareLink, useKit, variationGroups, whatsappLink } from "./kit";
import "./styles.css";

export default function StoreProduct() {
  const { productId } = useParams();
  const { tenant, products, categories, active, addToCart, openCart, path, hidePrices, tracks, wishlist, toggleWishlist } = useKit();
  const product = products.find((p) => p.id === parseProductIdFromRoute(productId));
  const groups = useMemo(() => (product ? variationGroups(product) : []), [product]);
  const [picked, setPicked] = useState<Record<string, string>>({});
  const [qty, setQty] = useState(1);
  const [warn, setWarn] = useState(false);
  const [note, setNote] = useState("");

  if (!product || !product.is_active) {
    return <div className="atl-page"><Empty title="Peça não encontrada" text="Ela pode ter saído da coleção ou estar indisponível." to={path("/catalogo")} action="Voltar à coleção" /></div>;
  }

  const info = priceInfo(product);
  const ready = groups.every((g) => picked[g.name]);
  const max = maxQuantity(product, tenant, picked, ready);
  const soldOut = !inStock(product, tenant) || (ready && max === 0);
  const qtyNow = Math.min(qty, Math.max(1, max));
  const base = Array.isArray(product.images) && product.images.length ? product.images : imageOf(product) ? [imageOf(product)] : [];
  const variant = getVariationImages(product, picked);
  const gallery = variant.length ? variant : base;
  const category = categories.find((c) => c.id === product.category_id);
  const related = active.filter((p) => p.category_id === product.category_id && p.id !== product.id).slice(0, 4);
  const fav = wishlist.includes(product.id);
  const url = typeof window !== "undefined" ? window.location.href : "";
  const wa = whatsappLink(tenant, `Olá! Gostaria de saber mais sobre: ${product.name} ${url}`);
  const priceText = info.price.toFixed(2);
  const pol = tenant.policies;
  const delivery = [pol?.shipping, pol?.returns, pol?.exchange].filter(Boolean) as string[];

  const choose = (name: string, value: string) => {
    setPicked((s) => ({ ...s, [name]: s[name] === value ? "" : value }));
    setWarn(false); setQty(1);
  };
  const add = () => {
    if (!ready) { setWarn(true); return; }
    if (soldOut) return;
    for (let i = 0; i < qtyNow; i++) addToCart(product, groups.length ? picked : undefined);
    openCart();
  };
  const share = async () => { const r = await shareLink(product.name); if (r) { setNote(r); setTimeout(() => setNote(""), 2500); } };

  return (
    <div className="atl-page">
      <StoreSEO
        title={`${product.name} — ${tenant.name}`}
        description={product.description || `Conheça ${product.name} na ${tenant.name}.`}
        image={gallery[0]}
        url={url}
        type="product"
        price={hidePrices ? undefined : priceText}
        siteName={tenant.name}
        keywords={`${product.name}, ${category?.name || ""}, ${tenant.name}`}
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "Product",
          name: product.name,
          description: product.description || product.name,
          image: gallery,
          sku: product.sku || String(product.id),
          brand: { "@type": "Brand", name: tenant.name },
          ...(hidePrices ? {} : {
            offers: {
              "@type": "Offer", url, priceCurrency: "BRL", price: priceText,
              itemCondition: "https://schema.org/NewCondition",
              availability: inStock(product, tenant) ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
              seller: { "@type": "Organization", name: tenant.name },
            },
          }),
        }}
      />
      <nav className="atl-crumbs" aria-label="Você está em">
        <Link to={path()}>Início</Link><span>/</span>
        <Link to={path("/catalogo")}>Coleção</Link>
        {category && <><span>/</span><Link to={path(`/catalogo?cat=${category.id}`)}>{category.name}</Link></>}
      </nav>

      <div className="atl-pdp">
        <div className="atl-scroll" aria-label="Fotos da peça">
          {gallery.length === 0 && <div className="atl-scroll-blank" aria-hidden="true">{product.name.slice(0, 1)}</div>}
          {gallery.map((src, i) => (
            <figure key={src + i}><img src={src} alt={i === 0 ? product.name : `${product.name} — foto ${i + 1}`} loading={i < 2 ? "eager" : "lazy"} /></figure>
          ))}
        </div>

        <aside className="atl-panel">
          {category && <Link to={path(`/catalogo?cat=${category.id}`)} className="atl-panel-cat">{category.name}</Link>}
          <h1>{product.name}</h1>
          <p className="atl-panel-price">
            {hidePrices ? <span>Sob consulta</span> : (
              <>
                {info.hasDiscount && <s>{money(info.full)}</s>}
                <span>{money(info.price)}</span>
                {info.hasDiscount && <em>-{info.pct}%</em>}
              </>
            )}
          </p>
          <StockAvailability product={product} tenant={tenant} selected={ready ? picked : undefined} />

          {groups.map((g) => (
            <fieldset key={g.name} className="atl-opt">
              <legend>{g.name}{picked[g.name] ? <b>{picked[g.name]}</b> : null}</legend>
              <div>
                {g.options.map((o) => {
                  const off = tracks && o.stock === 0;
                  return (
                    <button key={o.value} type="button" disabled={off} aria-pressed={picked[g.name] === o.value} aria-label={`${g.name}: ${o.value}${off ? " (esgotado)" : ""}`} className={`${picked[g.name] === o.value ? "is-on" : ""}${o.color ? " has-color" : ""}`} onClick={() => choose(g.name, o.value)}>
                      {o.color ? <i style={{ background: o.color }} /> : o.value}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          ))}
          {warn && <p className="atl-warn" role="alert">Escolha todas as opções para continuar.</p>}

          <div className="atl-buy">
            <div className="atl-qty" role="group" aria-label="Quantidade">
              <button type="button" aria-label="Diminuir quantidade" disabled={qtyNow <= 1} onClick={() => setQty(qtyNow - 1)}><Minus size={16} /></button>
              <output aria-live="polite">{qtyNow}</output>
              <button type="button" aria-label="Aumentar quantidade" disabled={qtyNow >= max} onClick={() => setQty(qtyNow + 1)}><Plus size={16} /></button>
            </div>
            <button type="button" className="atl-btn atl-btn-full" disabled={soldOut} onClick={add}>{soldOut ? "Indisponível" : hidePrices ? "Incluir no pedido" : "Adicionar à sacola"}</button>
          </div>
          <div className="atl-aux">
            <button type="button" aria-pressed={fav} onClick={() => toggleWishlist(product.id)}><Heart size={17} strokeWidth={1.5} fill={fav ? "currentColor" : "none"} /> {fav ? "Nos favoritos" : "Favoritar"}</button>
            <button type="button" onClick={share}><Share2 size={17} strokeWidth={1.5} /> Compartilhar</button>
            {wa && <a href={wa} target="_blank" rel="noreferrer"><MessageCircle size={17} strokeWidth={1.5} /> Falar com o ateliê</a>}
          </div>
          {note && <p className="atl-ok" role="status"><Check size={14} /> {note}</p>}

          <div className="atl-details">
            <details open>
              <summary>Sobre a peça</summary>
              <p>{product.description || "Fale com o ateliê para saber mais sobre esta peça."}</p>
              {product.sku && <p className="atl-sku">Ref. {product.sku}</p>}
            </details>
            <details>
              <summary>Entrega e trocas</summary>
              {delivery.length ? delivery.map((t, i) => <p key={i}>{t}</p>) : <p>Combine entrega ou retirada diretamente com a loja{wa ? " pelo WhatsApp" : ""}.</p>}
            </details>
          </div>
        </aside>
      </div>

      {related.length > 0 && (
        <section className="atl-section">
          <header className="atl-sec-head"><p className="atl-eyebrow">Para combinar</p><h2>Você também pode gostar</h2></header>
          <div className="atl-row">{related.map((p) => <Piece key={p.id} product={p} />)}</div>
        </section>
      )}
    </div>
  );
}
