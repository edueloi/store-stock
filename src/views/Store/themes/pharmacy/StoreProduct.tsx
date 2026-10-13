import { Link, useParams } from "react-router-dom";
import { ChevronRight, Heart, MessageCircle, Minus, Package, Plus, Share2, ShoppingBag } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import StockAvailability from "../../../../components/store/StockAvailability";
import { parseProductIdFromRoute } from "../../store-routing";
import { pageUrl, priceOf, useBuy, useShop, whatsappLink } from "./core";
import { Cross, ProductCard } from "./parts";

export default function StoreProduct() {
  const { productId } = useParams();
  const { tenant, categories, active, hidden, path, wishlist, toggleWishlist } = useShop();
  const product = active.find((p) => p.id === parseProductIdFromRoute(productId));
  const buy = useBuy(product);

  if (!product)
    return (
      <div className="ph ph-page">
        <div className="ph-wrap ph-emptybox">
          <Package size={42} aria-hidden="true" />
          <h1>Produto não encontrado</h1>
          <Link className="ph-btn" to={path("/catalogo")}>Voltar ao catálogo</Link>
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

  return (
    <div className="ph ph-page">
      <StoreSEO title={`${product.name} | ${tenant.name}`} description={product.description || product.name} image={buy.gallery[0]} type="product" price={String(product.discount_price ?? product.price)} siteName={tenant.name} url={pageUrl()} />
      <div className="ph-wrap">
        <nav className="ph-crumbs" aria-label="Você está em">
          <Link to={path()}>Início</Link><ChevronRight size={14} aria-hidden="true" />
          <Link to={path("/catalogo")}>Catálogo</Link>
          {category && (<><ChevronRight size={14} aria-hidden="true" /><Link to={path(`/catalogo?cat=${category.id}`)}>{category.name}</Link></>)}
        </nav>

        <div className="ph-pdp">
          <div className="ph-gallery">
            {buy.gallery.length > 1 && (
              <div className="ph-thumbs">
                {buy.gallery.map((src, i) => (
                  <button key={`${src}-${i}`} type="button" aria-label={`Ver imagem ${i + 1}`} aria-pressed={buy.photo === i} onClick={() => buy.setPhoto(i)}>
                    <img src={src} alt="" />
                  </button>
                ))}
              </div>
            )}
            <div className="ph-stage">
              {buy.gallery.length ? <img src={buy.gallery[buy.photo] || buy.gallery[0]} alt={product.name} /> : <Package size={64} aria-hidden="true" />}
              {price.old && <span className="ph-flag">Oferta</span>}
            </div>
          </div>

          <div className="ph-buybox">
            {category && <span className="ph-kicker"><Cross size={13} /> {category.name}</span>}
            <h1>{product.name}</h1>
            {product.sku && <p className="ph-sku">Código {product.sku}</p>}
            <div className="ph-pricebox">
              <strong className={hidden ? "is-hidden" : ""}>{price.now}</strong>
              {price.old && <s>{price.old}</s>}
              {price.saving && <em>Economize {price.saving}</em>}
            </div>
            <span className="ph-pickup">Retirada na loja</span>
            <StockAvailability product={product} tenant={tenant} selected={buy.ready ? buy.selected : undefined} className="ph-stock" />

            {buy.choices.map((c) => (
              <fieldset key={c.name} className="ph-opt">
                <legend>{c.name} <small>obrigatório</small></legend>
                <div>
                  {c.values.map((v) => (
                    <button key={v} type="button" aria-pressed={buy.selected[c.name] === v} onClick={() => buy.pick(c.name, v)}>{v}</button>
                  ))}
                </div>
              </fieldset>
            ))}
            {!buy.ready && <p className="ph-hint" role="status">Selecione todas as opções para adicionar ao carrinho.</p>}

            <div className="ph-buyrow">
              <div className="ph-qty">
                <button type="button" aria-label="Diminuir quantidade" disabled={buy.qty <= 1} onClick={() => buy.setQty((n) => Math.max(1, n - 1))}><Minus size={16} /></button>
                <output aria-label="Quantidade">{buy.qty}</output>
                <button type="button" aria-label="Aumentar quantidade" disabled={buy.qty >= buy.maximum} onClick={() => buy.setQty((n) => Math.min(buy.maximum, n + 1))}><Plus size={16} /></button>
              </div>
              <button type="button" className="ph-btn ph-btn-lg" disabled={!buy.canAdd} onClick={buy.add}>
                <ShoppingBag size={20} aria-hidden="true" /> {buy.soldOut ? "Indisponível" : hidden ? "Adicionar ao pedido" : "Adicionar ao carrinho"}
              </button>
            </div>
            <div className="ph-tools">
              <button type="button" aria-pressed={liked} onClick={() => toggleWishlist(product.id)}><Heart size={17} fill={liked ? "currentColor" : "none"} /> Favoritar</button>
              <button type="button" onClick={share}><Share2 size={17} /> Compartilhar</button>
              {tenant.whatsapp && (
                <a href={whatsappLink(tenant, `Olá! Tenho uma dúvida sobre ${product.name}.`)} target="_blank" rel="noreferrer"><MessageCircle size={17} /> Tirar dúvida</a>
              )}
            </div>
          </div>
        </div>

        <section className="ph-info">
          <div>
            <h2>Sobre o produto</h2>
            <p>{product.description || "Consulte a equipe da loja para mais informações sobre este produto."}</p>
          </div>
          <dl>
            <div><dt>Departamento</dt><dd>{category?.name || "Seleção da loja"}</dd></div>
            {product.sku && <div><dt>Código</dt><dd>{product.sku}</dd></div>}
            <div><dt>Retirada</dt><dd>Na loja{tenant.show_address && tenant.address ? `, ${tenant.address}` : ""}</dd></div>
            {tenant.policies?.returns && <div><dt>Trocas</dt><dd>{tenant.policies.returns}</dd></div>}
          </dl>
        </section>

        {related.length > 0 && (
          <section className="ph-related">
            <h2 className="ph-title">Quem compra também leva</h2>
            <div className="ph-grid">{related.map((p) => <ProductCard key={p.id} product={p} />)}</div>
          </section>
        )}
      </div>
    </div>
  );
}
