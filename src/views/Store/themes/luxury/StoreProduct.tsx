import { Link, useParams } from "react-router-dom";
import { ChevronLeft, ChevronRight, Minus, Plus } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import StockAvailability from "../../../../components/store/StockAvailability";
import { parseProductIdFromRoute } from "../../store-routing";
import { priceOf, usePurchase, useShop, whatsappHref } from "./kit";
import { Piece, Price } from "./parts";
import "./styles.css";

const COLORS: Record<string, string> = { preto: "#111", branco: "#f5f5f5", vermelho: "#b3262e", azul: "#2d5da8", verde: "#3f7d52", amarelo: "#d9b73c", rosa: "#d98aa8", cinza: "#8a919a", dourado: "#d5b777", prata: "#c4c7cc" };

export default function StoreProduct() {
  const { productId } = useParams();
  const { tenant, products, categories, hidden, path } = useShop();
  const product = products.find((p) => p.id === parseProductIdFromRoute(productId) && p.is_active);
  const buy = usePurchase(product);

  if (!product)
    return (
      <div className="lx-scope lx-page">
        <div className="lx-wrap" style={{ padding: "90px 0" }}>
          <div className="lx-empty" role="status">
            <h2>Peça não encontrada</h2>
            <p>Ela pode ter sido retirada da coleção.</p>
            <Link className="lx-btn" style={{ marginTop: 24 }} to={path("/catalogo")}>Voltar à coleção</Link>
          </div>
        </div>
      </div>
    );

  const cat = categories.find((c) => c.id === product.category_id);
  const { gallery, photo, setPhoto, choices, selected, ready } = buy;
  const related = products.filter((p) => p.is_active && p.id !== product.id && p.category_id === product.category_id).slice(0, 3);
  const label = buy.soldOut ? "Indisponível" : !ready ? "Escolha as opções" : "Adicionar à sacola";
  const total = Math.max(gallery.length, 1);

  return (
    <div className="lx-scope lx-page">
      <StoreSEO title={`${product.name} | ${tenant.name}`} description={product.description || product.name} image={gallery[0]} type="product" price={hidden ? undefined : String(priceOf(product))} siteName={tenant.name} url={typeof window !== "undefined" ? window.location.href : ""} />
      <div className="lx-split">
        <div className="lx-stage">
          <div className="lx-stage-in">
            <div className="lx-stage-img">
              {gallery.length ? <img src={gallery[photo] || gallery[0]} alt={product.name} /> : <span className="ph">Sem imagem</span>}
            </div>
            <div>
              {gallery.length > 1 && (
                <div className="lx-thumbs">
                  {gallery.map((src, i) => (
                    <button key={`${src}-${i}`} type="button" aria-label={`Ver imagem ${i + 1}`} aria-pressed={photo === i} onClick={() => setPhoto(i)}><img src={src} alt="" /></button>
                  ))}
                </div>
              )}
              <div className="lx-stage-bar">
                <button type="button" className="lx-nav-btn" aria-label="Imagem anterior" disabled={gallery.length < 2} onClick={() => setPhoto((photo - 1 + total) % total)}><ChevronLeft size={18} strokeWidth={1.4} /></button>
                <span className="count">{String(photo + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}</span>
                <button type="button" className="lx-nav-btn" aria-label="Próxima imagem" disabled={gallery.length < 2} onClick={() => setPhoto((photo + 1) % total)}><ChevronRight size={18} strokeWidth={1.4} /></button>
              </div>
            </div>
          </div>
        </div>

        <section className="lx-info">
          <nav className="lx-crumbs" aria-label="Você está em">
            <Link to={path()}>Início</Link><span>·</span><Link to={path("/catalogo")}>A coleção</Link>
            {cat && <><span>·</span><Link to={path("/catalogo", { categoria: String(cat.id) })}>{cat.name}</Link></>}
          </nav>
          <span className="lx-eyebrow">Peça exclusiva{product.sku ? ` · Nº ${product.sku}` : ""}</span>
          <h1>{product.name}</h1>
          <Price product={product} big />
          {product.description && <p className="lx-desc">{product.description}</p>}
          <div className="lx-stock"><StockAvailability product={product} tenant={tenant} selected={ready && choices.length ? selected : undefined} /></div>

          {choices.map((c) => (
            <fieldset className="lx-fieldset" key={c.name}>
              <legend>{c.name}<small>{selected[c.name] || "escolha uma opção"}</small></legend>
              <div className="lx-opts">
                {c.values.map((v) => {
                  const hex = c.colors?.[v] || COLORS[v.toLowerCase()];
                  return (
                    <button key={v} type="button" className="lx-opt" aria-pressed={selected[c.name] === v} onClick={() => buy.choose(c.name, v)}>
                      {/cor|color/i.test(c.name) && hex && <i style={{ background: hex }} aria-hidden="true" />}
                      {v}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          ))}

          <div className="lx-buyrow">
            <div className="lx-qty" role="group" aria-label="Quantidade">
              <button type="button" aria-label="Diminuir quantidade" disabled={buy.qty <= 1} onClick={() => buy.setQty(buy.qty - 1)}><Minus size={16} /></button>
              <output aria-live="polite">{buy.qty}</output>
              <button type="button" aria-label="Aumentar quantidade" disabled={buy.qty >= buy.maximum} onClick={() => buy.setQty(buy.qty + 1)}><Plus size={16} /></button>
            </div>
            <button type="button" className="lx-btn is-solid" disabled={!buy.canAdd} onClick={buy.add}>{label}</button>
          </div>
          {!ready && choices.length > 0 && <p className="lx-note warn" role="status">Escolha todas as opções para continuar.</p>}
          {buy.units !== null && buy.maximum > 0 && buy.maximum < 99 && buy.qty >= buy.maximum && <p className="lx-note">Quantidade máxima disponível: {buy.maximum}.</p>}

          <div className="lx-ritual-box">
            <span className="lx-eyebrow">Peça exclusiva</span>
            <p>Reservada com cuidado para quem valoriza os detalhes.</p>
          </div>

          <div className="lx-details">
            <details>
              <summary>Atendimento</summary>
              <div>
                {tenant.whatsapp ? <>Fale com a loja sobre esta peça: <a className="lx-text-link" href={whatsappHref(tenant, `Olá! Tenho interesse em ${product.name}.`)} target="_blank" rel="noreferrer">WhatsApp</a></> : "Entre em contato com a loja para mais detalhes sobre esta peça."}
              </div>
            </details>
            <details>
              <summary>Entrega e pagamento</summary>
              <div>Entrega e formas de pagamento conforme as opções da loja no fechamento do pedido.{tenant.show_address && tenant.address ? ` Retirada: ${tenant.address}.` : ""}</div>
            </details>
          </div>
        </section>
      </div>

      {related.length > 0 && (
        <section className="lx-section lx-wrap">
          <div className="lx-sec-head"><span className="lx-eyebrow">Para completar</span><h2>Também selecionadas</h2></div>
          <div className="lx-grid is-3">{related.map((p) => <Piece key={p.id} product={p} />)}</div>
        </section>
      )}
    </div>
  );
}
