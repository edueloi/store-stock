import { Link, useParams } from "react-router-dom";
import { ChevronLeft, ChevronRight, Heart, Minus, PawPrint, Plus, ShoppingBag, Sparkles } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import StockAvailability from "../../../../components/store/StockAvailability";
import { parseProductIdFromRoute } from "../../store-routing";
import { detectAnimal } from "./animals";
import Card from "./Card";
import { money, priceOf, useKit, useProductForm } from "./lib";
import "./styles.css";

const colors: Record<string, string> = { preto: "#1a1a1a", branco: "#f8f8f4", vermelho: "#df3131", azul: "#2d5da8", verde: "#4a8051", amarelo: "#e5bd3c", rosa: "#df809f", cinza: "#89909a" };

export default function StoreProduct() {
  const { productId } = useParams();
  const { tenant, products, path, hidden, catName, active } = useKit();
  const product = products.find((p) => p.id === parseProductIdFromRoute(productId));
  const f = useProductForm(product);

  if (!product || !product.is_active)
    return (
      <main className="pet-root">
        <div className="pet-wrap" style={{ padding: "48px 18px" }}>
          <div className="pet-empty"><PawPrint size={44} /><h3>Não achamos este produto</h3><p>Ele pode ter saído do catálogo.</p><Link to={path("/catalogo")} className="pet-btn">Voltar ao catálogo</Link></div>
        </div>
      </main>
    );

  const { price, full, off } = priceOf(product);
  const category = catName(product.category_id);
  const animal = detectAnimal(category, product.name);
  const related = active.filter((p) => p.id !== product.id && p.category_id === product.category_id).slice(0, 4);
  const missing = f.choices.filter((g) => !f.selected[g.name]);
  const noStock = f.units !== null && f.ready && f.max === 0;
  const img = f.images[f.active] || f.images[0];
  const pct = off && full > 0 ? Math.round((1 - price / full) * 100) : 0;
  const who = animal.key === "paw"
    ? category ? `Pensado para a categoria "${category}" e para quem cuida do seu pet com carinho.` : "Pensado para o seu pet e para quem cuida dele com carinho."
    : `Indicado para ${animal.label}${category ? ` (categoria ${category})` : ""}. Confira o porte e a idade do seu bichinho antes de escolher.`;

  return (
    <main className="pet-root">
      <StoreSEO
        title={`${product.name} | ${tenant.name}`}
        description={product.description || product.name}
        image={f.images[0]}
        url={typeof window !== "undefined" ? window.location.href : ""}
        type="product"
        price={hidden ? undefined : String(price)}
        siteName={tenant.name}
      />
      <div className="pet-wrap">
        <nav className="pet-crumbs" aria-label="Você está em">
          <Link to={path()}>Início</Link> <span>›</span> <Link to={path("/catalogo")}>Catálogo</Link>
          {category && <><span>›</span><Link to={path(`/catalogo?cat=${product.category_id}`)}>{category}</Link></>}
        </nav>
        <div className="pet-pdp">
          <div>
            <div className="pet-stage">
              {img ? <img src={img} alt={product.name} /> : <animal.Icon size={120} />}
              {off && !hidden && <span className="pet-seal" style={{ top: 18, left: 12 }}>Oferta -{pct}%</span>}
              {f.images.length > 1 && (
                <>
                  <button className="pet-snav" style={{ left: 10 }} aria-label="Foto anterior" onClick={() => f.setActive((f.active - 1 + f.images.length) % f.images.length)}><ChevronLeft size={22} /></button>
                  <button className="pet-snav" style={{ right: 10 }} aria-label="Próxima foto" onClick={() => f.setActive((f.active + 1) % f.images.length)}><ChevronRight size={22} /></button>
                </>
              )}
            </div>
            {f.images.length > 1 && (
              <div className="pet-thumbs">
                {f.images.map((s, i) => (
                  <button key={s + i} aria-pressed={i === f.active} aria-label={`Ver foto ${i + 1}`} onClick={() => f.setActive(i)}><img src={s} alt="" /></button>
                ))}
              </div>
            )}
          </div>

          <div className="pet-box">
            {category && <span className="pet-pill-tag"><animal.Icon size={16} /> {category}</span>}
            <h1 className="pet-h">{product.name}</h1>
            {product.sku && <p className="pet-ref">Ref. {product.sku}</p>}
            <div className="pet-priceline">
              {hidden ? <strong style={{ fontSize: 26, color: "var(--pt-ink)" }}>Valor a confirmar</strong> : (
                <>
                  <strong>{money(price)}</strong>
                  {off && <s>{money(full)}</s>}
                </>
              )}
            </div>
            {product.description && <p className="pet-desc">{product.description}</p>}

            {f.choices.map((g) => (
              <div className="pet-opt" key={g.name} role="group" aria-label={g.name}>
                <div className="pet-opt-label"><span>{g.name}</span><span>{f.selected[g.name] || "Escolha uma opção"}</span></div>
                <div className="pet-opts">
                  {g.values.map((v) => {
                    const hex = g.colors?.[v] || colors[v.toLowerCase()];
                    return (
                      <button key={v} className="pet-opt-pill" aria-pressed={f.selected[g.name] === v} onClick={() => f.pick(g.name, v)}>
                        {/cor|color/i.test(g.name) && hex && <i className="pet-dot" style={{ background: hex }} />}
                        {v}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            {missing.length > 0 && <p className="pet-hint" role="status">Escolha {missing.map((m) => m.name.toLowerCase()).join(" e ")} para continuar.</p>}

            <StockAvailability product={product} tenant={tenant} selected={f.choices.length ? f.selected : undefined} className="mb-3" />

            <div className="pet-opt" style={{ marginTop: 12 }}>
              <label className="pet-opt-label" htmlFor="pet-note"><span>Observação</span><span>opcional</span></label>
              <textarea id="pet-note" className="pet-note" value={f.note} onChange={(e) => f.setNote(e.target.value)} maxLength={240} placeholder="Ex.: porte do pet, sabor preferido..." />
            </div>

            <div className="pet-buy">
              <div className="pet-qty" role="group" aria-label="Quantidade">
                <button aria-label="Diminuir quantidade" disabled={f.qty <= 1} onClick={() => f.setQty(f.qty - 1)}><Minus size={18} /></button>
                <span aria-live="polite">{f.qty}</span>
                <button aria-label="Aumentar quantidade" disabled={f.qty >= f.max} onClick={() => f.setQty(f.qty + 1)}><Plus size={18} /></button>
              </div>
              <button className="pet-btn" disabled={!f.canAdd} onClick={f.add}>
                <ShoppingBag size={20} /> {noStock ? "Indisponível" : hidden ? "Solicitar" : "Adicionar ao carrinho"}
              </button>
            </div>
            {f.inCart > 0 && <p className="pet-ref" style={{ marginTop: 10 }}>{f.inCart} no carrinho</p>}

            <div className="pet-who">
              <span className="pet-bubble-ico" style={{ ["--b" as string]: animal.bg }}><animal.Icon size={30} /></span>
              <div>
                <h3>Para quem é?</h3>
                <p>{who}</p>
                <div className="pet-tips">
                  <span><Heart size={14} /> Escolha com carinho</span>
                  <span><Sparkles size={14} /> Dúvidas? Fale com a loja</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {related.length > 0 && (
          <section style={{ padding: "16px 0 64px" }}>
            <div className="pet-sec-head"><span className="pet-pill-tag"><PawPrint size={16} /> Combina com</span><h2 className="pet-h">Outros mimos</h2></div>
            <div className="pet-grid">{related.map((p, i) => <Card key={p.id} product={p} index={i} />)}</div>
          </section>
        )}
      </div>
    </main>
  );
}
