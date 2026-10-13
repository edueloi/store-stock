import { Link, useParams } from "react-router-dom";
import { Check, Heart, Minus, Plus, ShoppingBag, MessageCircle } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import StockAvailability from "../../../../components/store/StockAvailability";
import { parseProductIdFromRoute } from "../../store-routing";
import { priceInfo, useBuy, useKit, whatsappLink } from "./kit";
import { Cloud, GiftCard } from "./parts";
import "./styles.css";

export default function StoreProduct() {
  const { productId } = useParams();
  const { tenant, products, categories, path, hidden, wishlist, toggleWishlist, active } = useKit();
  const product = products.find(p => p.id === parseProductIdFromRoute(productId) && p.is_active);
  const buy = useBuy(product);
  if (!product) return <main className="bb-root bb-v2"><div className="bb-empty bb-empty-page">
    <Cloud className="bb-empty-cloud" /><h1 className="bb-script">Produto não encontrado</h1>
    <Link to={path("/catalogo")} className="bb-btn bb-btn-main">Voltar ao catálogo</Link>
  </div></main>;

  const price = priceInfo(product, hidden);
  const category = categories.find(c => c.id === product.category_id);
  const liked = wishlist.includes(product.id);
  const related = active.filter(x => x.id !== product.id && x.category_id === product.category_id).slice(0, 4);
  const more = related.length ? related : active.filter(x => x.id !== product.id).slice(0, 4);
  const wa = whatsappLink(tenant.whatsapp, `Olá! Tenho interesse em ${product.name}.`);
  const missing = buy.groups.filter(g => !buy.selected[g.name]).map(g => g.name);

  return <main className="bb-root bb-v2">
    <StoreSEO title={`${product.name} — ${tenant.name}`} description={product.description || product.name}
      image={buy.gallery[0]} type="product"
      price={hidden ? undefined : String(product.discount_price ?? product.price)}
      url={typeof window !== "undefined" ? window.location.href : ""} siteName={tenant.name} />
    <nav className="bb-crumbs" aria-label="Navegação estrutural">
      <Link to={path()}>Início</Link><span aria-hidden="true">/</span>
      <Link to={path("/catalogo")}>Catálogo</Link>
      {category && <><span aria-hidden="true">/</span><Link to={path(`/catalogo?cat=${category.id}`)}>{category.name}</Link></>}
      <span aria-hidden="true">/</span><span aria-current="page">{product.name}</span>
    </nav>
    <div className="bb-product bb-v2-product">
      <section className="bb-gallery bb-v2-gallery" aria-label="Galeria do produto">
        <div className="bb-frame"><div className="bb-frame-arch">
          {buy.gallery.length ? <img src={buy.gallery[buy.photo] || buy.gallery[0]} alt={product.name} /> : <Cloud className="bb-hero-fallback" />}
        </div>{price.off && <span className="bb-badge bb-badge-lg">Oferta</span>}</div>
        {buy.gallery.length > 1 && <div className="bb-thumbs">{buy.gallery.map((src,i) => <button type="button" key={`${src}-${i}`} aria-label={`Ver foto ${i+1}`} aria-pressed={buy.photo === i} onClick={() => buy.setPhoto(i)}><img src={src} alt="" loading="lazy" /></button>)}</div>}
      </section>
      <section className="bb-buy bb-v2-buy" aria-labelledby="bb-v2-product-title">
        {category && <p className="bb-kicker">{category.name}</p>}
        <h1 id="bb-v2-product-title" className="bb-script">{product.name}</h1>
        {product.sku && <p className="bb-ref">Referência: {product.sku}</p>}
        <p className="bb-price bb-price-lg"><strong>{price.now}</strong>{price.old && <s>{price.old}</s>}</p>
        {product.description && <p className="bb-desc">{product.description}</p>}
        {buy.groups.map(g => <fieldset key={g.name} className="bb-opts"><legend>{g.name} <small>{buy.selected[g.name] || "Selecione uma opção"}</small></legend>
          <div className="bb-opt-row">{g.values.map(v => <button type="button" key={v} className={`bb-opt ${buy.selected[g.name] === v ? "is-on" : ""}`} aria-pressed={buy.selected[g.name] === v} onClick={() => buy.setSelected(s => ({...s, [g.name]:v}))}>
            {buy.selected[g.name] === v && <Check size={14} aria-hidden="true" />}{v}
          </button>)}</div></fieldset>)}
        <StockAvailability product={product} tenant={tenant} selected={buy.ready ? buy.selected : undefined} className="bb-stock" />
        {missing.length > 0 && <p className="bb-hint">Selecione {missing.join(" e ")} para continuar.</p>}
        <div className="bb-buy-row">
          <div className="bb-qty" role="group" aria-label="Quantidade">
            <button type="button" aria-label="Diminuir quantidade" onClick={() => buy.setQty(q => Math.max(1, q - 1))} disabled={buy.qty <= 1}><Minus size={16} /></button>
            <output aria-live="polite">{buy.qty}</output>
            <button type="button" aria-label="Aumentar quantidade" onClick={() => buy.setQty(q => Math.min(buy.maxQty || 1, q + 1))} disabled={buy.qty >= buy.maxQty}><Plus size={16} /></button>
          </div>
          <button type="button" className="bb-btn bb-btn-main bb-add" onClick={buy.add} disabled={!buy.canAdd}>
            <ShoppingBag size={17} aria-hidden="true" />{buy.soldOut ? "Esgotado" : hidden ? "Adicionar à lista" : "Adicionar à sacola"}
          </button>
          <button type="button" className="bb-heart bb-heart-inline" aria-label={liked ? "Remover dos favoritos" : "Favoritar"} aria-pressed={liked} onClick={() => toggleWishlist(product.id)}><Heart size={19} fill={liked ? "currentColor" : "none"} /></button>
        </div>
        {wa && <a className="bb-v2-whatsapp" href={wa} target="_blank" rel="noopener noreferrer"><MessageCircle size={18} /> Dúvidas? Fale com a loja</a>}
      </section>
    </div>
    {more.length > 0 && <section className="bb-section bb-related" aria-labelledby="bb-v2-related-title">
      <header className="bb-head"><h2 id="bb-v2-related-title" className="bb-script">Você também pode gostar</h2></header>
      <div className="bb-grid">{more.map((p,i) => <GiftCard key={p.id} product={p} index={i + 1} />)}</div>
    </section>}
  </main>;
}
