import { Link, useParams } from "react-router-dom";
import { Heart, MessageCircle, Minus, Package, Plus, Share2, ShoppingBasket } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import StockAvailability from "../../../../components/store/StockAvailability";
import { StoreButton } from "../../../../components/store/StoreButton";
import { parseProductIdFromRoute } from "../../store-routing";
import { pageUrl, priceOf, useBuy, useShop, whatsappLink } from "./core";
import { ProductCard, Seal } from "./parts";

export default function StoreProduct() {
  const { productId } = useParams();
  const { tenant, categories, active, hidden, path, wishlist, toggleWishlist } = useShop();
  const product = active.find((p) => p.id === parseProductIdFromRoute(productId));
  const buy = useBuy(product);

  if (!product)
    return (
      <div className="or or-page">
        <div className="or-emptybox">
          <Package size={40} aria-hidden="true" />
          <h1>Produto não encontrado</h1>
          <StoreButton asChild className="or-cta"><Link to={path("/catalogo")}>Voltar ao catálogo</Link></StoreButton>
        </div>
      </div>
    );

  const price = priceOf(product, hidden);
  const category = categories.find((c) => c.id === product.category_id);
  const liked = wishlist.includes(product.id);
  const related = active.filter((p) => p.id !== product.id && p.category_id === product.category_id).slice(0, 4);
  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ title: product.name, url: pageUrl() });
      else await navigator.clipboard.writeText(pageUrl());
    } catch { /* cancelado */ }
  };
  const policies = tenant.policies;

  return (
    <div className="or or-page">
      <StoreSEO title={`${product.name} | ${tenant.name}`} description={product.description || product.name} image={buy.gallery[0]} type="product" price={String(product.discount_price ?? product.price)} siteName={tenant.name} url={pageUrl()} />
      <nav className="or-crumbs or-wrap" aria-label="Você está em">
        <Link to={path()}>Início</Link><span aria-hidden="true">/</span>
        <Link to={path("/catalogo")}>Catálogo</Link>
        {category && (<><span aria-hidden="true">/</span><Link to={path(`/catalogo?cat=${category.id}`)}>{category.name}</Link></>)}
      </nav>

      <div className="or-pdp or-wrap">
        <div className="or-pdp-photo">
          <div className="or-pdp-frame">
            {buy.gallery.length ? <img src={buy.gallery[buy.photo] || buy.gallery[0]} alt={product.name} /> : <Package size={60} aria-hidden="true" />}
            <Seal className="or-seal-float" />
          </div>
          {buy.gallery.length > 1 && (
            <div className="or-dots">
              {buy.gallery.map((src, i) => (
                <button key={`${src}-${i}`} type="button" aria-label={`Ver imagem ${i + 1}`} aria-pressed={buy.photo === i} onClick={() => buy.setPhoto(i)}><img src={src} alt="" /></button>
              ))}
            </div>
          )}
        </div>

        <div className="or-pdp-info">
          {category && <span className="or-over">{category.name}</span>}
          <h1>{product.name}</h1>
          <p className="or-pdp-price">
            <strong className={hidden ? "is-hidden" : ""}>{price.now}</strong>
            {price.old && <s>{price.old}</s>}
            {price.saving && <em>você economiza {price.saving}</em>}
          </p>
          {product.description && <p className="or-desc">{product.description}</p>}
          <StockAvailability product={product} tenant={tenant} selected={buy.ready ? buy.selected : undefined} className="or-stock" />

          {buy.choices.map((c) => (
            <fieldset key={c.name} className="or-opt">
              <legend>{c.name} <small>(obrigatório)</small></legend>
              <div>
                {c.values.map((v) => (
                  <button key={v} type="button" aria-pressed={buy.selected[c.name] === v} onClick={() => buy.pick(c.name, v)}>{v}</button>
                ))}
              </div>
            </fieldset>
          ))}
          {!buy.ready && <p className="or-hint" role="status">Escolha todas as opções para adicionar à cesta.</p>}

          <div className="or-buy">
            <div className="or-qty">
              <button type="button" aria-label="Diminuir quantidade" disabled={buy.qty <= 1} onClick={() => buy.setQty((n) => Math.max(1, n - 1))}><Minus size={16} /></button>
              <output aria-label="Quantidade">{buy.qty}</output>
              <button type="button" aria-label="Aumentar quantidade" disabled={buy.qty >= buy.maximum} onClick={() => buy.setQty((n) => Math.min(buy.maximum, n + 1))}><Plus size={16} /></button>
            </div>
            <StoreButton type="button" size="lg" className="or-cta or-grow" disabled={!buy.canAdd} onClick={buy.add}>
              <ShoppingBasket size={19} aria-hidden="true" /> {buy.soldOut ? "Indisponível" : hidden ? "Adicionar ao pedido" : "Adicionar à cesta"}
            </StoreButton>
          </div>
          <div className="or-tools">
            <button type="button" aria-pressed={liked} onClick={() => toggleWishlist(product.id)}><Heart size={17} fill={liked ? "currentColor" : "none"} /> Favoritar</button>
            <button type="button" onClick={share}><Share2 size={17} /> Compartilhar</button>
            {tenant.whatsapp && <a href={whatsappLink(tenant, `Olá! Tenho uma dúvida sobre ${product.name}.`)} target="_blank" rel="noreferrer"><MessageCircle size={17} /> Dúvidas</a>}
          </div>

          <dl className="or-details">
            <div><dt>Coleção</dt><i /><dd>{category?.name || "Seleção da loja"}</dd></div>
            {product.sku && <div><dt>Código</dt><i /><dd>{product.sku}</dd></div>}
            <div><dt>Entrega</dt><i /><dd>{policies?.shipping || "Combinada no pedido"}</dd></div>
            {policies?.returns && <div><dt>Trocas</dt><i /><dd>{policies.returns}</dd></div>}
            {tenant.show_address && tenant.address && <div><dt>Retirada</dt><i /><dd>{tenant.address}</dd></div>}
          </dl>
        </div>
      </div>

      {related.length > 0 && (
        <section className="or-wrap or-block">
          <header className="or-sechead"><h2>Combina com esta escolha</h2></header>
          <div className="or-grid">{related.map((p, i) => <ProductCard key={p.id} product={p} index={i} />)}</div>
        </section>
      )}
    </div>
  );
}
