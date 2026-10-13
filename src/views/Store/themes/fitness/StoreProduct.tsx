import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Check, ChevronLeft, ChevronRight, Minus, Plus, ShoppingBag } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import StockAvailability from "../../../../components/store/StockAvailability";
import { parseProductIdFromRoute } from "../../store-routing";
import Card from "./Card";
import { money, priceOf, useKit, useProductForm } from "./lib";
import "./styles.css";

const colors: Record<string, string> = { preto: "#1a1a1a", branco: "#f8f8f4", vermelho: "#df3131", azul: "#2d5da8", verde: "#4a8051", amarelo: "#e5bd3c", rosa: "#df809f", cinza: "#89909a" };

export default function StoreProduct() {
  const { productId } = useParams();
  const { tenant, products, path, hidden, catName, active, tracks } = useKit();
  const product = products.find((p) => p.id === parseProductIdFromRoute(productId));
  const f = useProductForm(product);
  const [tab, setTab] = useState<"desc" | "uso" | "ben">("desc");

  if (!product || !product.is_active)
    return (
      <main className="ft-root">
        <div className="ft-wrap" style={{ padding: "56px 20px" }}>
          <div className="ft-empty"><h3>Produto não encontrado</h3><p>Ele pode ter sido removido do catálogo.</p><Link to={path("/catalogo")} className="ft-btn">Voltar ao catálogo</Link></div>
        </div>
      </main>
    );

  const { price, full, off } = priceOf(product);
  const category = catName(product.category_id);
  const related = active.filter((p) => p.id !== product.id && p.category_id === product.category_id).slice(0, 4);
  const missing = f.choices.filter((g) => !f.selected[g.name]);
  const noStock = f.units !== null && f.ready && f.max === 0;
  const img = f.images[f.active] || f.images[0];
  const pct = off && full > 0 ? Math.round((1 - price / full) * 100) : 0;
  const lines = (product.description || "").split(/\n+/).map((l) => l.trim()).filter(Boolean);
  const bullets = lines.filter((l) => /^[-•*]\s*/.test(l)).map((l) => l.replace(/^[-•*]\s*/, ""));
  const benefits = bullets.length
    ? bullets
    : [
        category ? `Categoria: ${category}` : "Item selecionado pela loja",
        product.sku ? `Referência ${product.sku}` : "Atendimento direto com a loja",
        f.choices.length ? `Opções disponíveis: ${f.choices.map((g) => g.name.toLowerCase()).join(", ")}` : "Pronto para adicionar ao carrinho",
        hidden ? "Valores confirmados no atendimento" : off ? `Oferta com ${pct}% de desconto` : "Preço transparente, sem surpresas",
      ];
  const segs = f.units === null ? 0 : Math.min(10, Math.ceil((Math.min(f.units, 20) / 20) * 10));

  return (
    <main className="ft-root">
      <StoreSEO
        title={`${product.name} | ${tenant.name}`}
        description={product.description || product.name}
        image={f.images[0]}
        url={typeof window !== "undefined" ? window.location.href : ""}
        type="product"
        price={hidden ? undefined : String(price)}
        siteName={tenant.name}
      />
      <div className="ft-wrap">
        <nav className="ft-crumbs" aria-label="Você está em">
          <Link to={path()}>Início</Link>/<Link to={path("/catalogo")}>Catálogo</Link>
          {category && <>/<Link to={path(`/catalogo?cat=${product.category_id}`)}>{category}</Link></>}
        </nav>
        <div className="ft-pdp">
          <div>
            <div className="ft-stage ft-bracket">
              {img ? <img src={img} alt={product.name} /> : <span className="ft-mono" style={{ color: "#8b9885" }}>SEM FOTO</span>}
              {f.images.length > 1 && (
                <>
                  <button className="ft-snav" style={{ left: 8 }} aria-label="Foto anterior" onClick={() => f.setActive((f.active - 1 + f.images.length) % f.images.length)}><ChevronLeft size={20} /></button>
                  <button className="ft-snav" style={{ right: 8 }} aria-label="Próxima foto" onClick={() => f.setActive((f.active + 1) % f.images.length)}><ChevronRight size={20} /></button>
                </>
              )}
            </div>
            {f.images.length > 1 && (
              <div className="ft-thumbs">
                {f.images.map((s, i) => (
                  <button key={s + i} aria-pressed={i === f.active} aria-label={`Ver foto ${i + 1}`} onClick={() => f.setActive(i)}><img src={s} alt="" /></button>
                ))}
              </div>
            )}
          </div>

          <div className="ft-box">
            {category && <span className="ft-tag">{category}</span>}
            <h1 className="ft-title">{product.name}</h1>
            {product.sku && <p className="ft-ref">REF {product.sku}</p>}
            <div className="ft-priceblock">
              {hidden ? (
                <strong style={{ fontSize: 26, color: "var(--ft-text)" }}>Valor a confirmar</strong>
              ) : (
                <>
                  <strong>{money(price)}</strong>
                  {off && <s>{money(full)}</s>}
                  {off && <span className="ft-chip">-{pct}%</span>}
                </>
              )}
            </div>

            {f.choices.map((g) => (
              <div className="ft-opt" key={g.name} role="group" aria-label={g.name}>
                <div className="ft-opt-label"><span>{g.name}</span><b>{f.selected[g.name] || "selecione"}</b></div>
                <div className="ft-vals">
                  {g.values.map((v) => {
                    const hex = g.colors?.[v] || colors[v.toLowerCase()];
                    return (
                      <button key={v} className="ft-val" aria-pressed={f.selected[g.name] === v} onClick={() => f.pick(g.name, v)}>
                        {/cor|color/i.test(g.name) && hex && <i className="ft-dot" style={{ background: hex }} />}
                        {v}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            {missing.length > 0 && <p className="ft-hint" role="status">Selecione {missing.map((m) => m.name.toLowerCase()).join(" e ")} para continuar.</p>}

            <div className="ft-units">
              <StockAvailability product={product} tenant={tenant} selected={f.choices.length ? f.selected : undefined} />
              {tracks && f.units !== null && f.units > 0 && (
                <div className="ft-seg" aria-hidden="true">{Array.from({ length: 10 }, (_, i) => <i key={i} className={i < segs ? "on" : ""} />)}</div>
              )}
            </div>

            <div className="ft-opt">
              <label className="ft-opt-label" htmlFor="ft-note"><span>Observação</span><b>opcional</b></label>
              <textarea id="ft-note" className="ft-note" value={f.note} onChange={(e) => f.setNote(e.target.value)} maxLength={240} placeholder="Ex.: sabor de preferência, tamanho para presente..." />
            </div>

            <div className="ft-buy">
              <div className="ft-qty" role="group" aria-label="Quantidade">
                <button aria-label="Diminuir quantidade" disabled={f.qty <= 1} onClick={() => f.setQty(f.qty - 1)}><Minus size={17} /></button>
                <span aria-live="polite">{f.qty}</span>
                <button aria-label="Aumentar quantidade" disabled={f.qty >= f.max} onClick={() => f.setQty(f.qty + 1)}><Plus size={17} /></button>
              </div>
              <button className="ft-btn" disabled={!f.canAdd} onClick={f.add}>
                <ShoppingBag size={18} /> {noStock ? "Indisponível" : hidden ? "Solicitar este item" : "Adicionar ao carrinho"}
              </button>
            </div>
            {f.inCart > 0 && <p className="ft-ref" style={{ marginTop: 10 }}>{f.inCart} un. já no carrinho</p>}
          </div>
        </div>

        <section className="ft-tabs2" aria-label="Detalhes do produto">
          <div className="ft-tabs2-nav" role="tablist">
            {([["desc", "Descrição"], ["uso", "Como usar"], ["ben", "Benefícios"]] as const).map(([id, label]) => (
              <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}>{label}</button>
            ))}
          </div>
          <div className="ft-tabs2-body" role="tabpanel">
            {tab === "desc" && (lines.length ? lines.filter((l) => !/^[-•*]\s*/.test(l)).map((l, i) => <p key={i}>{l}</p>) : <p>Esta ficha ainda não tem descrição. Fale com a loja para mais detalhes sobre {product.name}.</p>)}
            {tab === "uso" && (
              <>
                <p>Siga sempre as orientações do rótulo e do fabricante. Em caso de dúvidas sobre a rotina de uso, consulte um profissional de saúde ou de educação física.</p>
                <p>Precisa de ajuda para escolher? Chame a loja pelo atendimento e informe seu objetivo de treino.</p>
              </>
            )}
            {tab === "ben" && <ul className="ft-checks">{benefits.map((b, i) => <li key={i}><Check size={16} />{b}</li>)}</ul>}
          </div>
        </section>

        {related.length > 0 && (
          <section style={{ paddingBottom: 64 }}>
            <div className="ft-section-head"><div><span className="ft-tag">Combina com</span><h2 className="ft-title" style={{ fontSize: 30, marginTop: 10, textTransform: "uppercase" }}>Mais da categoria</h2></div></div>
            <div className="ft-grid">{related.map((p) => <Card key={p.id} product={p} />)}</div>
          </section>
        )}
      </div>
    </main>
  );
}
