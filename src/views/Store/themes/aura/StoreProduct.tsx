import { Link, useParams } from "react-router-dom";
import { Check, Image as ImageIcon, MessageCircle, Minus, Plus, ShieldCheck, ShoppingBag, Truck } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import StockAvailability from "../../../../components/store/StockAvailability";
import { StoreButton } from "../../../../components/store/StoreButton";
import { parseProductIdFromRoute } from "../../store-routing";
import { priceOf, usePurchase, useShop, whatsappHref } from "./kit";
import { Price, SoftCard } from "./parts";
import "./styles.css";

const COLORS: Record<string, string> = { preto: "#222", branco: "#f5f5f5", vermelho: "#d9485f", azul: "#5b83d6", verde: "#58a878", amarelo: "#e8c354", rosa: "#ef8fb1", cinza: "#9aa0aa", bege: "#d8c3a5", lilas: "#b9a4ee" };

export default function StoreProduct() {
  const { productId } = useParams();
  const { tenant, products, categories, hidden, path } = useShop();
  const product = products.find((p) => p.id === parseProductIdFromRoute(productId) && p.is_active);
  const buy = usePurchase(product);

  if (!product)
    return (
      <div className="au-scope au-page">
        <div className="au-wrap" style={{ padding: "60px 0" }}>
          <div className="au-empty" role="status">
            <ImageIcon size={34} aria-hidden="true" />
            <h2>Produto não encontrado</h2>
            <StoreButton asChild className="au-cta" style={{ marginTop: 16 }}>
              <Link to={path("/catalogo")}>Voltar ao catálogo</Link>
            </StoreButton>
          </div>
        </div>
      </div>
    );

  const cat = categories.find((c) => c.id === product.category_id);
  const { gallery, photo, setPhoto, choices, selected, ready } = buy;
  const related = products.filter((p) => p.is_active && p.type !== "internal" && p.id !== product.id && p.category_id === product.category_id).slice(0, 4);
  const label = buy.soldOut ? "Indisponível" : !ready ? "Escolha as opções" : hidden ? "Incluir no pedido" : "Adicionar à sacola";

  return (
    <div className="au-scope au-page au-product-page">
      <StoreSEO title={`${product.name} | ${tenant.name}`} description={product.description || product.name} image={gallery[0]} type="product" price={hidden ? undefined : String(priceOf(product))} siteName={tenant.name} url={typeof window !== "undefined" ? window.location.href : ""} />
      <div className="au-wrap">
        <nav className="au-crumbs" aria-label="Você está em">
          <Link to={path()}>Início</Link><span>/</span><Link to={path("/catalogo")}>Catálogo</Link>
          {cat && <><span>/</span><Link to={path("/catalogo", { categoria: String(cat.id) })}>{cat.name}</Link></>}
        </nav>

        <div className="au-pgrid">
          <div className="au-gallery">
            <div className="au-stage">
              {gallery.length ? <img src={gallery[photo] || gallery[0]} alt={product.name} /> : <ImageIcon className="ph" size={64} aria-label="Produto sem imagem" />}
            </div>
            {gallery.length > 1 && (
              <div className="au-thumbs" role="group" aria-label="Miniaturas">
                {gallery.map((src, i) => (
                  <button key={`${src}-${i}`} type="button" aria-label={`Ver imagem ${i + 1}`} aria-pressed={photo === i} onClick={() => setPhoto(i)}><img src={src} alt="" /></button>
                ))}
              </div>
            )}
          </div>

          <section className="au-buy">
            <span className="au-kicker">{cat?.name || "Produto"}{product.sku ? ` · ${product.sku}` : ""}</span>
            <h1>{product.name}</h1>
            <Price product={product} big />
            <div className="au-stock"><StockAvailability product={product} tenant={tenant} selected={ready && choices.length ? selected : undefined} /></div>
            {product.description && <p className="au-desc">{product.description}</p>}

            {choices.map((c) => (
              <fieldset className="au-fieldset" key={c.name}>
                <legend>{c.name}<b>{selected[c.name] || "escolha"}</b></legend>
                <div className="au-opts">
                  {c.values.map((v) => {
                    const hex = c.colors?.[v] || COLORS[v.toLowerCase()];
                    const colorOpt = /cor|color/i.test(c.name) && hex;
                    return (
                      <button key={v} type="button" className={`au-opt${colorOpt ? " is-color" : ""}`} aria-pressed={selected[c.name] === v} aria-label={`${c.name}: ${v}`} onClick={() => buy.choose(c.name, v)}>
                        {colorOpt && <i style={{ background: hex }} aria-hidden="true" />}
                        {v}
                        {selected[c.name] === v && <Check size={14} aria-hidden="true" />}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            ))}

            <div className="au-buyrow">
              <div className="au-qty" role="group" aria-label="Quantidade">
                <button type="button" aria-label="Diminuir quantidade" disabled={buy.qty <= 1} onClick={() => buy.setQty(buy.qty - 1)}><Minus size={16} /></button>
                <output aria-live="polite">{buy.qty}</output>
                <button type="button" aria-label="Aumentar quantidade" disabled={buy.qty >= buy.maximum} onClick={() => buy.setQty(buy.qty + 1)}><Plus size={16} /></button>
              </div>
              <StoreButton size="lg" className="au-cta au-buybtn" disabled={!buy.canAdd} onClick={buy.add}><ShoppingBag size={18} /> {label}</StoreButton>
            </div>
            {!ready && choices.length > 0 && <p className="au-note warn" role="status">Selecione todas as opções para continuar.</p>}
            {buy.units !== null && buy.maximum > 0 && buy.maximum < 99 && buy.qty >= buy.maximum && <p className="au-note">Limite de {buy.maximum} {buy.maximum === 1 ? "unidade" : "unidades"} disponíveis.</p>}

            <ul className="au-assure">
              <li><Truck size={18} aria-hidden="true" /> Entrega combinada com a loja</li>
              <li><ShieldCheck size={18} aria-hidden="true" /> Compra confirmada pela equipe</li>
              {tenant.whatsapp && <li><MessageCircle size={18} aria-hidden="true" /><a href={whatsappHref(tenant, `Olá! Tenho interesse em ${product.name}.`)} target="_blank" rel="noreferrer">Tirar dúvida no WhatsApp</a></li>}
            </ul>
          </section>
        </div>

        <div className="au-buybar">
          <Price product={product} />
          <StoreButton size="md" className="au-cta" disabled={!buy.canAdd} onClick={buy.add}><ShoppingBag size={17} /> {buy.soldOut ? "Indisponível" : !ready ? "Escolha as opções" : "Adicionar"}</StoreButton>
        </div>

        {related.length > 0 && (
          <section className="au-section">
            <div className="au-sec-head"><div><span className="au-kicker">Combina com</span><h2>Você também vai gostar</h2></div></div>
            <div className="au-grid">{related.map((p) => <SoftCard key={p.id} product={p} />)}</div>
          </section>
        )}
      </div>
    </div>
  );
}
