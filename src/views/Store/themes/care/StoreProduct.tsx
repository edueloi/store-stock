import { useState, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { ChevronDown, ChevronLeft, ChevronRight, Heart, MessageCircle, Minus, Package, Plus, Share2, ShoppingBag } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import StockAvailability from "../../../../components/store/StockAvailability";
import { parseProductIdFromRoute } from "../../store-routing";
import { pageUrl, priceOf, useBuy, useShop, whatsappLink } from "./core";
import { ProductCard } from "./parts";

function Accordion({ id, title, open, onToggle, children }: { id: string; title: string; open: boolean; onToggle: () => void; children: ReactNode }) {
  return (
    <div className={`ca-acc ${open ? "is-open" : ""}`}>
      <h3>
        <button type="button" aria-expanded={open} aria-controls={`ca-acc-${id}`} id={`ca-acc-btn-${id}`} onClick={onToggle}>
          {title} <ChevronDown size={20} aria-hidden="true" />
        </button>
      </h3>
      <div id={`ca-acc-${id}`} role="region" aria-labelledby={`ca-acc-btn-${id}`} hidden={!open}>{children}</div>
    </div>
  );
}

export default function StoreProduct() {
  const { productId } = useParams();
  const { tenant, categories, active, hidden, path, wishlist, toggleWishlist } = useShop();
  const product = active.find((p) => p.id === parseProductIdFromRoute(productId));
  const buy = useBuy(product);
  const [open, setOpen] = useState<string>("uso");
  const toggle = (id: string) => setOpen((cur) => (cur === id ? "" : id));

  if (!product)
    return (
      <div className="ca ca-page">
        <div className="ca-emptybox">
          <Package size={40} aria-hidden="true" />
          <h1>Produto não encontrado</h1>
          <Link className="ca-btn" to={path("/catalogo")}>Voltar ao catálogo</Link>
        </div>
      </div>
    );

  const price = priceOf(product, hidden);
  const category = categories.find((c) => c.id === product.category_id);
  const liked = wishlist.includes(product.id);
  const related = active.filter((p) => p.id !== product.id && p.category_id === product.category_id).slice(0, 4);
  const total = buy.gallery.length;
  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ title: product.name, url: pageUrl() });
      else await navigator.clipboard.writeText(pageUrl());
    } catch { /* cancelado */ }
  };
  const policies = tenant.policies;

  return (
    <div className="ca ca-page">
      <StoreSEO title={`${product.name} | ${tenant.name}`} description={product.description || product.name} image={buy.gallery[0]} type="product" price={String(product.discount_price ?? product.price)} siteName={tenant.name} url={pageUrl()} />
      <nav className="ca-crumbs" aria-label="Você está em">
        <Link to={path("/catalogo")}><ChevronLeft size={16} aria-hidden="true" /> Voltar ao catálogo</Link>
        {category && <Link to={path(`/catalogo?cat=${category.id}`)}>{category.name}</Link>}
      </nav>

      <div className="ca-pdp">
        <div className="ca-gallery">
          <div className="ca-stage">
            {total ? <img src={buy.gallery[buy.photo] || buy.gallery[0]} alt={product.name} /> : <Package size={60} aria-hidden="true" />}
            {price.old && <span className="ca-tag">Oferta</span>}
            {total > 1 && (
              <>
                <button type="button" className="ca-arrow ca-arrow-l" aria-label="Imagem anterior" onClick={() => buy.setPhoto((buy.photo - 1 + total) % total)}><ChevronLeft size={22} /></button>
                <button type="button" className="ca-arrow ca-arrow-r" aria-label="Próxima imagem" onClick={() => buy.setPhoto((buy.photo + 1) % total)}><ChevronRight size={22} /></button>
              </>
            )}
          </div>
          {total > 1 && (
            <div className="ca-thumbs">
              {buy.gallery.map((src, i) => (
                <button key={`${src}-${i}`} type="button" aria-label={`Ver imagem ${i + 1}`} aria-pressed={buy.photo === i} onClick={() => buy.setPhoto(i)}><img src={src} alt="" /></button>
              ))}
            </div>
          )}
        </div>

        <div className="ca-info">
          {category && <span className="ca-eyebrow">{category.name}</span>}
          <h1>{product.name}</h1>
          <div className="ca-pricing">
            <strong className={hidden ? "is-hidden" : ""}>{price.now}</strong>
            {price.old && <s>{price.old}</s>}
            {price.saving && <em>Economia de {price.saving}</em>}
          </div>
          <StockAvailability product={product} tenant={tenant} selected={buy.ready ? buy.selected : undefined} className="ca-stock" />

          {buy.choices.map((c) => (
            <fieldset key={c.name} className="ca-opt">
              <legend>{c.name} <small>escolha uma opção</small></legend>
              <div>
                {c.values.map((v) => (
                  <button key={v} type="button" aria-pressed={buy.selected[c.name] === v} onClick={() => buy.pick(c.name, v)}>{v}</button>
                ))}
              </div>
            </fieldset>
          ))}
          {!buy.ready && <p className="ca-hint" role="status">Escolha todas as opções para continuar.</p>}

          <div className="ca-buy">
            <div className="ca-qty">
              <button type="button" aria-label="Diminuir quantidade" disabled={buy.qty <= 1} onClick={() => buy.setQty((n) => Math.max(1, n - 1))}><Minus size={16} /></button>
              <output aria-label="Quantidade">{buy.qty}</output>
              <button type="button" aria-label="Aumentar quantidade" disabled={buy.qty >= buy.maximum} onClick={() => buy.setQty((n) => Math.min(buy.maximum, n + 1))}><Plus size={16} /></button>
            </div>
            <button type="button" className="ca-btn ca-btn-grow" disabled={!buy.canAdd} onClick={buy.add}>
              <ShoppingBag size={19} aria-hidden="true" /> {buy.soldOut ? "Indisponível" : hidden ? "Adicionar ao pedido" : "Adicionar à rotina"}
            </button>
          </div>
          <div className="ca-quick">
            <button type="button" aria-pressed={liked} onClick={() => toggleWishlist(product.id)}><Heart size={17} fill={liked ? "currentColor" : "none"} /> Favoritar</button>
            <button type="button" onClick={share}><Share2 size={17} /> Compartilhar</button>
            {tenant.whatsapp && <a href={whatsappLink(tenant, `Olá! Tenho uma dúvida sobre ${product.name}.`)} target="_blank" rel="noreferrer"><MessageCircle size={17} /> Dúvidas</a>}
          </div>

          <div className="ca-accs">
            <Accordion id="uso" title="Modo de uso e informações" open={open === "uso"} onToggle={() => toggle("uso")}>
              <p>{product.description || "Siga as orientações da embalagem e, em caso de dúvida, consulte um profissional de saúde."}</p>
              <dl>
                <div><dt>Categoria</dt><dd>{category?.name || "Seleção da loja"}</dd></div>
                {product.sku && <div><dt>Código</dt><dd>{product.sku}</dd></div>}
              </dl>
            </Accordion>
            <Accordion id="entrega" title="Entrega e trocas" open={open === "entrega"} onToggle={() => toggle("entrega")}>
              <p>{policies?.shipping || "As condições de entrega e retirada são combinadas no fechamento do pedido."}</p>
              {policies?.returns && <p>{policies.returns}</p>}
              {tenant.show_address && tenant.address && <p>Endereço da loja: {tenant.address}</p>}
            </Accordion>
          </div>
        </div>
      </div>

      {related.length > 0 && (
        <section className="ca-block">
          <h2 className="ca-h2">Combina com sua rotina</h2>
          <div className="ca-grid">{related.map((p) => <ProductCard key={p.id} product={p} />)}</div>
        </section>
      )}
    </div>
  );
}
