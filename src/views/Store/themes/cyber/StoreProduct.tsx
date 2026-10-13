import { Link, useParams } from "react-router-dom";
import { ChevronLeft, ChevronRight, Cpu, Minus, Plus, ShoppingCart } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import StockAvailability from "../../../../components/store/StockAvailability";
import { parseProductIdFromRoute } from "../../store-routing";
import { priceOf, usePurchase, useShop, whatsappHref } from "./kit";
import { CircuitCard, PriceTag } from "./parts";
import "./styles.css";

const COLORS: Record<string, string> = { preto: "#111", branco: "#f5f5f5", vermelho: "#e03131", azul: "#2d5da8", verde: "#3f9b57", amarelo: "#e5bd3c", rosa: "#e07aa0", cinza: "#8a919a" };

export default function StoreProduct() {
  const { productId } = useParams();
  const { tenant, products, categories, hidden, path } = useShop();
  const product = products.find((p) => p.id === parseProductIdFromRoute(productId) && p.is_active);
  const buy = usePurchase(product);

  if (!product)
    return (
      <div className="cy-scope cy-page">
        <div className="cy-wrap" style={{ padding: "60px 0" }}>
          <div className="cy-empty" role="status">
            <strong>&gt; erro 404: módulo não encontrado</strong>
            <Link className="cy-btn" style={{ marginTop: 14 }} to={path("/catalogo")}>Voltar ao catálogo</Link>
          </div>
        </div>
      </div>
    );

  const cat = categories.find((c) => c.id === product.category_id);
  const { gallery, photo, setPhoto, choices, selected, ready } = buy;
  const related = products.filter((p) => p.is_active && p.id !== product.id && p.category_id === product.category_id).slice(0, 4);
  const label = buy.soldOut ? "Indisponível" : !buy.ready ? "Escolha as opções" : "Adicionar ao carrinho";

  return (
    <div className="cy-scope cy-page">
      <StoreSEO title={`${product.name} | ${tenant.name}`} description={product.description || product.name} image={gallery[0]} type="product" price={hidden ? undefined : String(priceOf(product))} siteName={tenant.name} url={typeof window !== "undefined" ? window.location.href : ""} />
      <div className="cy-wrap">
        <nav className="cy-crumbs" aria-label="Você está em">
          <Link to={path()}>~</Link><span>/</span><Link to={path("/catalogo")}>catalogo</Link>
          {cat && <><span>/</span><Link to={path("/catalogo", { categoria: String(cat.id) })}>{cat.name.toLowerCase()}</Link></>}
        </nav>
        <div className="cy-pgrid">
          <div>
            <div className="cy-frame cy-corner">
              {gallery.length ? <img src={gallery[photo] || gallery[0]} alt={product.name} /> : <Cpu size={80} style={{ color: "var(--cy-a)", opacity: 0.35 }} aria-label="Produto sem imagem" />}
              {gallery.length > 1 && (
                <>
                  <button type="button" className="cy-nav-btn l" aria-label="Imagem anterior" onClick={() => setPhoto((photo - 1 + gallery.length) % gallery.length)}><ChevronLeft size={18} /></button>
                  <button type="button" className="cy-nav-btn r" aria-label="Próxima imagem" onClick={() => setPhoto((photo + 1) % gallery.length)}><ChevronRight size={18} /></button>
                </>
              )}
            </div>
            {gallery.length > 1 && (
              <div className="cy-thumbs">
                {gallery.map((src, i) => (
                  <button key={`${src}-${i}`} type="button" aria-label={`Ver imagem ${i + 1}`} aria-pressed={photo === i} onClick={() => setPhoto(i)}><img src={src} alt="" /></button>
                ))}
              </div>
            )}
          </div>

          <section className="cy-buy cy-corner">
            <span className="cy-tag">{cat?.name || "módulo geral"}</span>
            <h1>{product.name}</h1>
            <PriceTag product={product} big />
            <div className="cy-stock"><StockAvailability product={product} tenant={tenant} selected={ready && choices.length ? selected : undefined} /></div>

            <table className="cy-specs">
              <caption className="cy-sr">Especificações</caption>
              <tbody>
                {product.sku && <tr><th scope="row">Ref.</th><td>{product.sku}</td></tr>}
                <tr><th scope="row">Categoria</th><td>{cat?.name || "Geral"}</td></tr>
                {choices.map((c) => (
                  <tr key={c.name}><th scope="row">{c.name}</th><td>{selected[c.name] || c.values.join(" · ")}</td></tr>
                ))}
                <tr><th scope="row">Status</th><td>{buy.soldOut ? "Esgotado" : "Disponível"}</td></tr>
              </tbody>
            </table>

            {choices.map((c) => (
              <fieldset className="cy-fieldset" key={c.name}>
                <legend>{c.name} <b>*obrigatório</b></legend>
                <div className="cy-opts">
                  {c.values.map((v) => {
                    const hex = c.colors?.[v] || COLORS[v.toLowerCase()];
                    return (
                      <button key={v} type="button" className="cy-opt" aria-pressed={selected[c.name] === v} onClick={() => buy.choose(c.name, v)}>
                        {/cor|color/i.test(c.name) && hex && <i style={{ background: hex }} aria-hidden="true" />}
                        {v}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            ))}

            <div className="cy-buyrow">
              <div className="cy-qty" role="group" aria-label="Quantidade">
                <button type="button" aria-label="Diminuir quantidade" disabled={buy.qty <= 1} onClick={() => buy.setQty(buy.qty - 1)}><Minus size={16} /></button>
                <output aria-live="polite">{buy.qty}</output>
                <button type="button" aria-label="Aumentar quantidade" disabled={buy.qty >= buy.maximum} onClick={() => buy.setQty(buy.qty + 1)}><Plus size={16} /></button>
              </div>
              <button type="button" className="cy-btn is-solid" disabled={!buy.canAdd} onClick={buy.add}><ShoppingCart size={17} /> {label}</button>
            </div>
            {!buy.ready && choices.length > 0 && <p className="cy-note warn" role="status">Selecione todas as opções para continuar.</p>}
            {buy.units !== null && buy.maximum > 0 && buy.maximum < 99 && buy.qty >= buy.maximum && <p className="cy-note">Limite de {buy.maximum} {buy.maximum === 1 ? "unidade" : "unidades"} para este pedido.</p>}
            {tenant.whatsapp && (
              <div className="cy-cta-row">
                <a className="cy-link" href={whatsappHref(tenant, `Olá! Tenho interesse em ${product.name}.`)} target="_blank" rel="noreferrer">tirar dúvida no whatsapp →</a>
              </div>
            )}
            {product.description && (
              <div className="cy-readme"><h3>readme.txt</h3>{product.description}</div>
            )}
          </section>
        </div>

        {related.length > 0 && (
          <section className="cy-section">
            <div className="cy-sec-head"><div><span className="cy-tag">relacionados</span><h2>Mais do mesmo módulo</h2></div></div>
            <div className="cy-grid is-4">{related.map((p, i) => <CircuitCard key={p.id} product={p} index={i} />)}</div>
          </section>
        )}
      </div>
    </div>
  );
}
