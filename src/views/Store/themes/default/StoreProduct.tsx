import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AlertCircle, Check, ChevronLeft, ChevronRight, Heart, Minus, MessageCircle, Package, Plus, Share2, ShoppingCart } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import StockAvailability from "../../../../components/store/StockAvailability";
import { parseProductIdFromRoute } from "../../store-routing";
import { getVariationImages } from "../../../../utils/variationImages";
import { Card, Empty } from "./parts";
import { imageOf, inStock, maxQuantity, money, priceInfo, shareLink, useKit, variationGroups, whatsappLink } from "./kit";
import "./styles.css";

type Tab = "desc" | "info" | "ship";

export default function StoreProduct() {
  const { productId } = useParams();
  const { tenant, products, categories, active, addToCart, openCart, path, hidePrices, tracks, wishlist, toggleWishlist } = useKit();
  const product = products.find((p) => p.id === parseProductIdFromRoute(productId));
  const groups = useMemo(() => (product ? variationGroups(product) : []), [product]);
  const [picked, setPicked] = useState<Record<string, string>>({});
  const [qty, setQty] = useState(1);
  const [photo, setPhoto] = useState(0);
  const [tab, setTab] = useState<Tab>("desc");
  const [warn, setWarn] = useState(false);
  const [note, setNote] = useState("");

  if (!product || !product.is_active) {
    return (
      <div className="dfl-page"><div className="dfl-wrap">
        <Empty title="Produto não encontrado" text="Ele pode ter sido removido ou estar indisponível." to={path("/catalogo")} action="Voltar ao catálogo" />
      </div></div>
    );
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
  const related = active.filter((p) => p.category_id === product.category_id && p.id !== product.id).slice(0, 4);
  const fav = wishlist.includes(product.id);
  const wa = whatsappLink(tenant, `Olá! Tenho interesse em: ${product.name}${typeof window !== "undefined" ? ` ${window.location.href}` : ""}`);
  const url = typeof window !== "undefined" ? window.location.href : "";
  const priceText = info.price.toFixed(2);
  const policies = tenant.policies;
  const shipTexts = [policies?.shipping, policies?.returns, policies?.exchange].filter(Boolean) as string[];

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
    <div className="dfl-page">
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
      <div className="dfl-wrap">
        <nav className="dfl-crumbs" aria-label="Você está em">
          <Link to={path()}>Início</Link><span>/</span>
          <Link to={path("/catalogo")}>Catálogo</Link>
          {category && <><span>/</span><Link to={path(`/catalogo?cat=${category.id}`)}>{category.name}</Link></>}
          <span>/</span><span aria-current="page">{product.name}</span>
        </nav>

        <div className="dfl-pdp">
          <div className="dfl-gallery">
            {gallery.length > 1 && (
              <ul className="dfl-thumbs" aria-label="Fotos do produto">
                {gallery.map((src, i) => (
                  <li key={src + i}><button type="button" className={i === current ? "is-on" : ""} aria-label={`Ver foto ${i + 1}`} aria-current={i === current} onClick={() => setPhoto(i)}><img src={src} alt="" loading="lazy" /></button></li>
                ))}
              </ul>
            )}
            <div className="dfl-stage">
              {gallery[current] ? <img src={gallery[current]} alt={product.name} /> : <Package size={64} strokeWidth={1} />}
              {info.hasDiscount && !hidePrices && <span className="dfl-badge">-{info.pct}%</span>}
              {gallery.length > 1 && (
                <>
                  <button type="button" className="dfl-nav dfl-nav-prev" aria-label="Foto anterior" onClick={() => setPhoto((current - 1 + gallery.length) % gallery.length)}><ChevronLeft size={22} /></button>
                  <button type="button" className="dfl-nav dfl-nav-next" aria-label="Próxima foto" onClick={() => setPhoto((current + 1) % gallery.length)}><ChevronRight size={22} /></button>
                </>
              )}
            </div>
          </div>

          <div className="dfl-buy dfl-box">
            {category && <Link to={path(`/catalogo?cat=${category.id}`)} className="dfl-buy-cat">{category.name}</Link>}
            <h1>{product.name}</h1>
            {product.sku && <p className="dfl-sku">Cód. {product.sku}</p>}
            <div className="dfl-buy-price">
              {hidePrices ? <p className="dfl-price dfl-price-ask is-big">Sob consulta</p> : (
                <p className="dfl-price is-big">
                  {info.hasDiscount && <s>{money(info.full)}</s>}
                  <strong>{money(info.price)}</strong>
                  {info.hasDiscount && <em>{info.pct}% OFF</em>}
                </p>
              )}
              <StockAvailability product={product} tenant={tenant} selected={ready ? picked : undefined} />
            </div>

            {groups.map((g) => (
              <fieldset key={g.name} className="dfl-opt">
                <legend>{g.name}{picked[g.name] ? <b>: {picked[g.name]}</b> : null}</legend>
                <div>
                  {g.options.map((o) => {
                    const off = tracks && o.stock === 0;
                    return (
                      <button key={o.value} type="button" disabled={off} aria-pressed={picked[g.name] === o.value} className={picked[g.name] === o.value ? "is-on" : ""} onClick={() => choose(g.name, o.value)}>
                        {o.color && <i style={{ background: o.color }} aria-hidden="true" />}
                        {o.value}
                        {off && <small> (esgotado)</small>}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            ))}
            {warn && <p className="dfl-warn" role="alert"><AlertCircle size={16} /> Escolha todas as opções para continuar.</p>}

            <div className="dfl-buy-row">
              <div className="dfl-qty" role="group" aria-label="Quantidade">
                <button type="button" aria-label="Diminuir quantidade" disabled={qtyNow <= 1} onClick={() => setQty(qtyNow - 1)}><Minus size={16} /></button>
                <output aria-live="polite">{qtyNow}</output>
                <button type="button" aria-label="Aumentar quantidade" disabled={qtyNow >= max} onClick={() => setQty(qtyNow + 1)}><Plus size={16} /></button>
              </div>
              <button type="button" className="dfl-btn dfl-btn-buy" disabled={soldOut} onClick={add}>
                <ShoppingCart size={18} /> {soldOut ? "Indisponível" : hidePrices ? "Incluir no pedido" : "Adicionar ao carrinho"}
              </button>
            </div>
            <div className="dfl-buy-aux">
              <button type="button" aria-pressed={fav} onClick={() => toggleWishlist(product.id)}><Heart size={16} fill={fav ? "currentColor" : "none"} /> {fav ? "Nos favoritos" : "Favoritar"}</button>
              <button type="button" onClick={share}><Share2 size={16} /> Compartilhar</button>
              {wa && <a href={wa} target="_blank" rel="noreferrer"><MessageCircle size={16} /> Tirar dúvida</a>}
            </div>
            {note && <p className="dfl-ok" role="status"><Check size={14} /> {note}</p>}
          </div>
        </div>

        <section className="dfl-tabs dfl-box">
          <div role="tablist" aria-label="Detalhes do produto">
            {([["desc", "Descrição"], ["info", "Informações"], ["ship", "Entrega e trocas"]] as [Tab, string][]).map(([id, label]) => (
              <button key={id} role="tab" type="button" id={`dfl-tab-${id}`} aria-selected={tab === id} aria-controls="dfl-panel" className={tab === id ? "is-on" : ""} onClick={() => setTab(id)}>{label}</button>
            ))}
          </div>
          <div id="dfl-panel" role="tabpanel" aria-labelledby={`dfl-tab-${tab}`} className="dfl-panel">
            {tab === "desc" && <p>{product.description || "Este produto ainda não tem descrição. Fale com a loja para saber mais."}</p>}
            {tab === "info" && (
              <table className="dfl-table"><tbody>
                <tr><th>Produto</th><td>{product.name}</td></tr>
                {product.sku && <tr><th>Código</th><td>{product.sku}</td></tr>}
                {category && <tr><th>Categoria</th><td>{category.name}</td></tr>}
                {groups.map((g) => <tr key={g.name}><th>{g.name}</th><td>{g.options.map((o) => o.value).join(", ")}</td></tr>)}
                {product.sale_unit && product.sale_unit !== "unidade" && <tr><th>Venda por</th><td>{product.sale_unit}</td></tr>}
              </tbody></table>
            )}
            {tab === "ship" && (shipTexts.length ? shipTexts.map((t, i) => <p key={i}>{t}</p>) : <p>Combine entrega ou retirada diretamente com a loja{wa ? " pelo WhatsApp" : ""}.</p>)}
          </div>
        </section>

        {related.length > 0 && (
          <section className="dfl-section">
            <div className="dfl-section-head"><h2>Quem viu, também gostou</h2>{category && <Link to={path(`/catalogo?cat=${category.id}`)}>Ver categoria</Link>}</div>
            <div className="dfl-grid">{related.map((p) => <Card key={p.id} product={p} />)}</div>
          </section>
        )}
      </div>
    </div>
  );
}
