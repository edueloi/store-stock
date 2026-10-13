import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AlertCircle, Check, Heart, Minus, MessageCircle, Package, Plus, RefreshCcw, Share2, ShieldCheck, ShoppingCart, Truck } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import StockAvailability from "../../../../components/store/StockAvailability";
import { parseProductIdFromRoute } from "../../store-routing";
import { getVariationImages } from "../../../../utils/variationImages";
import { Card, Empty, installmentText } from "./parts";
import { imageOf, inStock, maxQuantity, money, priceInfo, shareLink, useKit, variationGroups, whatsappLink } from "./kit";
import "./styles.css";

export default function StoreProduct() {
  const { productId } = useParams();
  const { tenant, products, categories, active, addToCart, openCart, path, hidePrices, tracks, wishlist, toggleWishlist } = useKit();
  const product = products.find((p) => p.id === parseProductIdFromRoute(productId));
  const groups = useMemo(() => (product ? variationGroups(product) : []), [product]);
  const [picked, setPicked] = useState<Record<string, string>>({});
  const [qty, setQty] = useState(1);
  const [photo, setPhoto] = useState(0);
  const [warn, setWarn] = useState(false);
  const [note, setNote] = useState("");

  if (!product || !product.is_active) {
    return <div className="elx-page"><div className="elx-wrap"><Empty title="Produto não encontrado" text="Ele pode ter sido removido ou estar indisponível." to={path("/catalogo")} action="Voltar ao catálogo" /></div></div>;
  }

  const info = priceInfo(product);
  const ready = groups.every((g) => picked[g.name]);
  const max = maxQuantity(product, tenant, picked, ready);
  const soldOut = !inStock(product, tenant) || (ready && max === 0);
  const qtyNow = Math.min(qty, Math.max(1, max));
  const base = Array.isArray(product.images) && product.images.length ? product.images : imageOf(product) ? [imageOf(product)] : [];
  const variant = getVariationImages(product, picked);
  const gallery = variant.length ? variant : base;
  const current = Math.min(photo, Math.max(0, gallery.length - 1));
  const category = categories.find((c) => c.id === product.category_id);
  const related = active.filter((p) => p.category_id === product.category_id && p.id !== product.id).slice(0, 5);
  const fav = wishlist.includes(product.id);
  const url = typeof window !== "undefined" ? window.location.href : "";
  const wa = whatsappLink(tenant, `Olá! Tenho uma dúvida sobre: ${product.name} ${url}`);
  const priceText = info.price.toFixed(2);
  const inst = hidePrices ? null : installmentText(tenant, info.price);
  const pol = tenant.policies;
  const specs: [string, string][] = [
    ["Produto", product.name],
    ...(product.sku ? [["Código", product.sku] as [string, string]] : []),
    ...(category ? [["Departamento", category.name] as [string, string]] : []),
    ...groups.map((g) => [g.name, g.options.map((o) => o.value).join(", ")] as [string, string]),
    ...(product.sale_unit && product.sale_unit !== "unidade" ? [["Venda por", product.sale_unit] as [string, string]] : []),
  ];

  const choose = (name: string, value: string) => {
    setPicked((s) => ({ ...s, [name]: s[name] === value ? "" : value }));
    setPhoto(0); setWarn(false); setQty(1);
  };
  const add = () => {
    if (!ready) { setWarn(true); return; }
    if (soldOut) return;
    for (let i = 0; i < qtyNow; i++) addToCart(product, groups.length ? picked : undefined);
    openCart();
  };
  const share = async () => { const r = await shareLink(product.name); if (r) { setNote(r); setTimeout(() => setNote(""), 2500); } };

  return (
    <div className="elx-page">
      <StoreSEO
        title={`${product.name} — ${tenant.name}`}
        description={product.description || `Compre ${product.name} na ${tenant.name}.`}
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
      <div className="elx-wrap">
        <nav className="elx-crumbs" aria-label="Você está em">
          <Link to={path()}>Início</Link><span>›</span>
          <Link to={path("/catalogo")}>Catálogo</Link>
          {category && <><span>›</span><Link to={path(`/catalogo?cat=${category.id}`)}>{category.name}</Link></>}
        </nav>

        <div className="elx-pdp">
          <div className="elx-pdp-left">
            <div className="elx-gallery">
              <div className="elx-stage">
                {gallery[current] ? <img src={gallery[current]} alt={product.name} /> : <Package size={64} strokeWidth={1} />}
                {info.hasDiscount && !hidePrices && <span className="elx-off">-{info.pct}%</span>}
              </div>
              {gallery.length > 1 && (
                <ul className="elx-thumbs" aria-label="Fotos do produto">
                  {gallery.map((src, i) => (
                    <li key={src + i}><button type="button" className={i === current ? "is-on" : ""} aria-label={`Ver foto ${i + 1}`} aria-current={i === current} onClick={() => setPhoto(i)}><img src={src} alt="" loading="lazy" /></button></li>
                  ))}
                </ul>
              )}
            </div>
            <section className="elx-panel">
              <h2>Descrição</h2>
              <p className="elx-desc">{product.description || "Este produto ainda não tem descrição. Fale com a loja para saber mais."}</p>
            </section>
            <section className="elx-panel">
              <h2>Especificações</h2>
              <table className="elx-specs"><tbody>{specs.map(([k, v]) => <tr key={k}><th scope="row">{k}</th><td>{v}</td></tr>)}</tbody></table>
            </section>
          </div>

          <aside className="elx-buybox">
            <div className="elx-panel elx-buy">
              {category && <Link to={path(`/catalogo?cat=${category.id}`)} className="elx-buy-cat">{category.name}</Link>}
              <h1>{product.name}</h1>
              {product.sku && <p className="elx-sku">Cód. {product.sku}</p>}
              <div className="elx-buy-price">
                {hidePrices ? <p className="elx-price-ask is-big">Sob consulta</p> : (
                  <>
                    {info.hasDiscount && <p className="elx-was"><s>{money(info.full)}</s> <span className="elx-off elx-off-inline">-{info.pct}%</span></p>}
                    <p className="elx-now">{money(info.price)} <small>à vista</small></p>
                    {inst && <p className="elx-inst-big">{inst}</p>}
                  </>
                )}
                <StockAvailability product={product} tenant={tenant} selected={ready ? picked : undefined} />
              </div>

              {groups.map((g) => (
                <fieldset key={g.name} className="elx-opt">
                  <legend>{g.name}{picked[g.name] ? <b>: {picked[g.name]}</b> : null}</legend>
                  <div>
                    {g.options.map((o) => {
                      const off = tracks && o.stock === 0;
                      return (
                        <button key={o.value} type="button" disabled={off} aria-pressed={picked[g.name] === o.value} className={picked[g.name] === o.value ? "is-on" : ""} onClick={() => choose(g.name, o.value)}>
                          {o.color && <i style={{ background: o.color }} aria-hidden="true" />}
                          {o.value}{off && <small> (esgotado)</small>}
                        </button>
                      );
                    })}
                  </div>
                </fieldset>
              ))}
              {warn && <p className="elx-warn" role="alert"><AlertCircle size={16} /> Escolha todas as opções para continuar.</p>}

              <div className="elx-buy-row">
                <div className="elx-qty" role="group" aria-label="Quantidade">
                  <button type="button" aria-label="Diminuir quantidade" disabled={qtyNow <= 1} onClick={() => setQty(qtyNow - 1)}><Minus size={16} /></button>
                  <output aria-live="polite">{qtyNow}</output>
                  <button type="button" aria-label="Aumentar quantidade" disabled={qtyNow >= max} onClick={() => setQty(qtyNow + 1)}><Plus size={16} /></button>
                </div>
                <button type="button" className="elx-btn elx-btn-buy" disabled={soldOut} onClick={add}><ShoppingCart size={18} /> {soldOut ? "Indisponível" : hidePrices ? "Incluir no pedido" : "Comprar"}</button>
              </div>
              <div className="elx-buy-aux">
                <button type="button" aria-pressed={fav} onClick={() => toggleWishlist(product.id)}><Heart size={16} fill={fav ? "currentColor" : "none"} /> {fav ? "Nos favoritos" : "Favoritar"}</button>
                <button type="button" onClick={share}><Share2 size={16} /> Compartilhar</button>
                {wa && <a href={wa} target="_blank" rel="noreferrer"><MessageCircle size={16} /> Tirar dúvida</a>}
              </div>
              {note && <p className="elx-ok" role="status"><Check size={14} /> {note}</p>}
            </div>

            <div className="elx-panel elx-assure">
              <h2>Garantia e entrega</h2>
              <ul>
                <li><ShieldCheck size={22} strokeWidth={1.6} /><div><b>Garantia</b><span>{pol?.warranty_days ? `${pol.warranty_days} dias de garantia${pol.warranty_resolution_days ? `, com solução em até ${pol.warranty_resolution_days} dias` : ""}.` : "Consulte a loja sobre a garantia deste produto."}</span></div></li>
                <li><Truck size={22} strokeWidth={1.6} /><div><b>Entrega ou retirada</b><span>{pol?.shipping || "Combine prazo e forma de receber com a loja."}</span></div></li>
                <li><RefreshCcw size={22} strokeWidth={1.6} /><div><b>Trocas e devoluções</b><span>{[pol?.returns, pol?.exchange].filter(Boolean).join(" ") || "Veja as condições com o atendimento."}</span></div></li>
              </ul>
            </div>
          </aside>
        </div>

        {related.length > 0 && (
          <section className="elx-block">
            <div className="elx-head"><h2>Veja também</h2>{category && <Link to={path(`/catalogo?cat=${category.id}`)}>Ver departamento</Link>}</div>
            <div className="elx-grid">{related.map((p) => <Card key={p.id} product={p} />)}</div>
          </section>
        )}
      </div>
    </div>
  );
}
