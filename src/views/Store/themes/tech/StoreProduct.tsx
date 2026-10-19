import { Link, useParams } from "react-router-dom";
import { MessageCircle, Minus, Package, Plus, ShieldCheck, ShoppingCart } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import StockAvailability from "../../../../components/store/StockAvailability";
import { productRouteSegment, parseProductIdFromRoute } from "../../store-routing";
import { groupsOf, money, priceOf, usePurchase, useShop, whatsappHref } from "./kit";
import { Price, TechCard } from "./parts";
import "./styles.css";

const COLORS: Record<string, string> = { preto: "#111", branco: "#f5f5f5", vermelho: "#d33a3a", azul: "#2d5da8", verde: "#3f9b57", amarelo: "#e5bd3c", rosa: "#e07aa0", cinza: "#8a919a", prata: "#c4c7cc" };

export default function StoreProduct() {
  const { productId } = useParams();
  const { tenant, products, categories, hidden, path } = useShop();
  const product = products.find((p) => p.id === parseProductIdFromRoute(productId) && p.is_active);
  const buy = usePurchase(product);

  if (!product)
    return (
      <div className="tp-scope tp-page">
        <div className="tp-wrap" style={{ padding: "60px 0" }}>
          <div className="tp-empty" role="status">
            <Package size={40} style={{ color: "#9fb3cf", margin: "0 auto 10px" }} aria-hidden="true" />
            <h2>Produto não encontrado</h2>
            <Link className="tp-btn" style={{ marginTop: 16 }} to={path("/catalogo")}>Voltar ao catálogo</Link>
          </div>
        </div>
      </div>
    );

  const cat = categories.find((c) => c.id === product.category_id);
  const { gallery, photo, setPhoto, choices, selected, ready } = buy;
  const similar = products.filter((p) => p.is_active && p.type !== "internal" && p.id !== product.id && p.category_id === product.category_id).slice(0, 3);
  const label = buy.soldOut ? "Indisponível" : !ready ? "Escolha as opções" : "Adicionar ao carrinho";
  const priceText = (p: typeof product) => (hidden ? "Sob consulta" : money(priceOf(p)));
  const optionsText = (p: typeof product) => groupsOf(p).map((g) => g.name).join(", ") || "Única";
  const more = products.filter((p) => p.is_active && p.type !== "internal" && p.id !== product.id && p.category_id === product.category_id).slice(0, 4);

  return (
    <div className="tp-scope tp-page tp-product-page">
      <StoreSEO title={`${product.name} | ${tenant.name}`} description={product.description || product.name} image={gallery[0]} type="product" price={hidden ? undefined : String(priceOf(product))} siteName={tenant.name} url={typeof window !== "undefined" ? window.location.href : ""} />
      <div className="tp-wrap">
        <nav className="tp-crumbs" aria-label="Você está em">
          <Link to={path()}>Início</Link><span>/</span><Link to={path("/catalogo")}>Catálogo</Link>
          {cat && <><span>/</span><Link to={path("/catalogo", { categoria: String(cat.id) })}>{cat.name}</Link></>}
        </nav>

        <div className="tp-pgrid">
          {gallery.length > 1 && (
            <div className="tp-rail" role="group" aria-label="Miniaturas">
              {gallery.map((src, i) => (
                <button key={`${src}-${i}`} type="button" aria-label={`Ver imagem ${i + 1}`} aria-pressed={photo === i} onClick={() => setPhoto(i)}><img src={src} alt="" /></button>
              ))}
            </div>
          )}
          <div className="tp-stage" style={gallery.length > 1 ? undefined : { gridColumn: "1 / -1" }}>
            {gallery.length ? <img src={gallery[photo] || gallery[0]} alt={product.name} /> : <Package className="ph" size={72} aria-label="Produto sem imagem" />}
            {gallery.length > 1 && <span className="tp-zoom">{photo + 1}/{gallery.length}</span>}
          </div>

          <section className="tp-buy">
            <span className="tp-kicker">{cat?.name || "Produto"}{product.sku ? ` · ${product.sku}` : ""}</span>
            <h1>{product.name}</h1>
            <Price product={product} big />
            <div className="tp-stock"><StockAvailability product={product} tenant={tenant} selected={ready && choices.length ? selected : undefined} /></div>

            {choices.map((c) => (
              <fieldset className="tp-fieldset" key={c.name}>
                <legend>{c.name}<b>{selected[c.name] || "selecione"}</b></legend>
                <div className="tp-opts">
                  {c.values.map((v) => {
                    const hex = c.colors?.[v] || COLORS[v.toLowerCase()];
                    return (
                      <button key={v} type="button" className="tp-opt" aria-pressed={selected[c.name] === v} onClick={() => buy.choose(c.name, v)}>
                        {/cor|color/i.test(c.name) && hex && <i style={{ background: hex }} aria-hidden="true" />}
                        {v}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            ))}

            <div className="tp-buyrow">
              <div className="tp-qty" role="group" aria-label="Quantidade">
                <button type="button" aria-label="Diminuir quantidade" disabled={buy.qty <= 1} onClick={() => buy.setQty(buy.qty - 1)}><Minus size={16} /></button>
                <output aria-live="polite">{buy.qty}</output>
                <button type="button" aria-label="Aumentar quantidade" disabled={buy.qty >= buy.maximum} onClick={() => buy.setQty(buy.qty + 1)}><Plus size={16} /></button>
              </div>
              <button type="button" className="tp-btn" disabled={!buy.canAdd} onClick={buy.add}><ShoppingCart size={17} /> {label}</button>
            </div>
            {!ready && choices.length > 0 && <p className="tp-note warn" role="status">Selecione todas as opções para continuar.</p>}
            {buy.units !== null && buy.maximum > 0 && buy.maximum < 99 && buy.qty >= buy.maximum && <p className="tp-note">Limite de {buy.maximum} {buy.maximum === 1 ? "unidade" : "unidades"} disponíveis.</p>}
            <div className="tp-trust">
              <div><ShieldCheck size={17} aria-hidden="true" /> Confirme compatibilidade com a equipe antes de comprar.</div>
              {tenant.whatsapp && <div><MessageCircle size={17} aria-hidden="true" /><a className="tp-link" style={{ minHeight: 32 }} href={whatsappHref(tenant, `Olá! Tenho interesse em ${product.name}.`)} target="_blank" rel="noreferrer">Tirar dúvida no WhatsApp</a></div>}
            </div>
          </section>
        </div>

        <div className="tp-sheet">
          <section className="tp-block">
            <span className="tp-kicker">Ficha técnica</span>
            <h2>Especificações</h2>
            <table className="tp-table">
              <caption className="tp-sr">Ficha técnica de {product.name}</caption>
              <tbody>
                {product.sku && <tr><th scope="row">Código</th><td>{product.sku}</td></tr>}
                <tr><th scope="row">Categoria</th><td>{cat?.name || "Geral"}</td></tr>
                {choices.map((c) => <tr key={c.name}><th scope="row">{c.name}</th><td>{c.values.join(", ")}</td></tr>)}
                <tr><th scope="row">Valor</th><td>{priceText(product)}</td></tr>
              </tbody>
            </table>
            {product.description && <p className="tp-desc">{product.description}</p>}
          </section>

          <section className="tp-block">
            <span className="tp-kicker">Comparativo</span>
            <h2>Compare com similares</h2>
            {similar.length ? (
              <div className="tp-scrollx">
                <table className="tp-table">
                  <thead>
                    <tr><th scope="col">Item</th><th scope="col" className="me">Este produto</th>{similar.map((p) => <th scope="col" key={p.id}><Link className="tp-link" style={{ minHeight: 0 }} to={path(`/produto/${productRouteSegment(p)}`)}>{p.name}</Link></th>)}</tr>
                  </thead>
                  <tbody>
                    <tr><th scope="row">Valor</th><td className="me">{priceText(product)}</td>{similar.map((p) => <td key={p.id}>{priceText(p)}</td>)}</tr>
                    <tr><th scope="row">Opções</th><td className="me">{optionsText(product)}</td>{similar.map((p) => <td key={p.id}>{optionsText(p)}</td>)}</tr>
                  </tbody>
                </table>
              </div>
            ) : <p style={{ margin: 0, color: "var(--tp-dim)" }}>Ainda não há produtos similares na mesma categoria.</p>}
          </section>
        </div>

        <div className="tp-buybar">
          <strong>{hidden ? "Sob consulta" : money(priceOf(product))}</strong>
          <button type="button" className="tp-btn" disabled={!buy.canAdd} onClick={buy.add}><ShoppingCart size={17} /> {buy.soldOut ? "Indisponível" : !ready ? "Escolha as opções" : "Adicionar"}</button>
        </div>

        {more.length > 0 && (
          <section className="tp-section">
            <div className="tp-sec-head"><div><span className="tp-kicker">Veja também</span><h2>Mais da categoria</h2></div></div>
            <div className="tp-grid is-4">{more.map((p) => <TechCard key={p.id} product={p} />)}</div>
          </section>
        )}
      </div>
    </div>
  );
}
