import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Check, ChevronLeft, ChevronRight, Heart, MessageCircle, Minus, Plus, ShieldCheck, Share2, Truck, X } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import StockAvailability from "../../../../components/store/StockAvailability";
import Card from "./Card";
import { discountPct, hasDiscount, money, parseSpecs, priceOf, useGadgetMotion, useProductState } from "./kit";
import "./styles.css";

type Tab = "desc" | "specs" | "delivery";

export default function StoreProduct() {
  const s = useProductState();
  const motion = useGadgetMotion();
  const { product, tenant, categories, path, hidden, wishlist, toggleWishlist, waLink } = s;
  const [tab, setTab] = useState<Tab>("desc");
  const [zoom, setZoom] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setTab("desc");
    setZoom(false);
  }, [product?.id]);
  useEffect(() => {
    if (!zoom) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setZoom(false);
      if (e.key === "ArrowRight") s.setActiveImage((s.activeImage + 1) % Math.max(1, s.images.length));
      if (e.key === "ArrowLeft") s.setActiveImage((s.activeImage - 1 + s.images.length) % Math.max(1, s.images.length));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [zoom, s.activeImage, s.images.length]);

  if (!product)
    return (
      <main className="gd-page">
        <div className="gd-none">
          <p>Produto não encontrado.</p>
          <Link className="gd-btn gd-btn-accent" to={path("/catalogo")}>Voltar ao catálogo</Link>
        </div>
      </main>
    );

  const category = categories.find((c) => c.id === product.category_id);
  const liked = wishlist.includes(product.id);
  const off = hidden ? 0 : discountPct(product);
  const specs = parseSpecs(product.storefront_details?.specifications);
  const delivery = product.storefront_details?.delivery_installation;
  const hasSpecs = specs.rows.length > 0 || specs.notes.length > 0;
  const related = s.active.filter((p) => p.id !== product.id && p.category_id === product.category_id).slice(0, 4);
  const more = related.length ? related : s.active.filter((p) => p.id !== product.id).slice(0, 4);
  const img = s.images[s.activeImage] || s.images[0];

  const share = async () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    try {
      if (navigator.share) await navigator.share({ title: product.name, url });
      else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      /* compartilhamento cancelado */
    }
  };

  const tabs: { id: Tab; label: string; show: boolean }[] = [
    { id: "desc", label: "Descrição", show: Boolean(product.description) },
    { id: "specs", label: "Ficha técnica", show: hasSpecs },
    { id: "delivery", label: "Entrega e garantia", show: true },
  ];
  const visibleTabs = tabs.filter((t) => t.show);
  const activeTab = visibleTabs.some((t) => t.id === tab) ? tab : visibleTabs[0]?.id;

  return (
    <main className="gd-page gd-prod-page" ref={motion}>
      <StoreSEO title={`${product.name} — ${tenant.name}`} description={product.description || product.name} image={s.images[0]} url={typeof window !== "undefined" ? window.location.href : ""} type="product" price={hidden ? undefined : String(priceOf(product))} siteName={tenant.name} />

      <div className="gd-wrap">
        <nav className="gd-crumbs" aria-label="Você está em">
          <Link to={path()}>Início</Link> <ChevronRight size={12} />
          <Link to={path("/catalogo")}>Catálogo</Link>
          {category && (
            <>
              {" "}<ChevronRight size={12} /> <Link to={path(`/catalogo?categoria=${category.id}`)}>{category.name}</Link>
            </>
          )}
        </nav>
      </div>

      <div className="gd-wrap gd-prod">
        <div className="gd-prod-media">
          {s.images.length > 1 && (
            <div className="gd-thumbs" role="tablist" aria-label="Fotos do produto">
              {s.images.map((im, i) => (
                <button key={im + i} type="button" className={i === s.activeImage ? "is-on" : ""} aria-label={`Ver foto ${i + 1}`} aria-current={i === s.activeImage} onClick={() => s.setActiveImage(i)}>
                  <img src={im} alt="" />
                </button>
              ))}
            </div>
          )}
          <button type="button" className="gd-prod-main" onClick={() => img && setZoom(true)} aria-label="Ampliar foto" disabled={!img}>
            {img ? <img src={img} alt={product.name} /> : <span>Sem foto</span>}
            {off > 0 && <span className="gd-badge gd-badge-off gd-prod-off">-{off}%</span>}
          </button>
        </div>

        <div className="gd-prod-buy">
          {category && <span className="gd-kicker">{category.name}</span>}
          <h1>{product.name}</h1>
          <div className="gd-prod-meta">
            {product.sku && <span>Cód. {product.sku}</span>}
            {(product.sold_count || 0) > 0 && <span>{product.sold_count} vendidos</span>}
          </div>

          <div className="gd-buybox">
            {hidden ? (
              <p className="gd-prod-price gd-muted">Sob consulta</p>
            ) : (
              <div className="gd-prod-pricing">
                {hasDiscount(product) && <s>{money(Number(product.price))}</s>}
                <p className="gd-prod-price">{money(priceOf(product))}</p>
                {off > 0 && <span className="gd-save">Você economiza {money(Number(product.price) - priceOf(product))}</span>}
              </div>
            )}

            {s.groups.map((g) => (
              <fieldset key={g.name} className="gd-opt">
                <legend>
                  {g.name}
                  {s.selected[g.name] ? <span> · {s.selected[g.name]}</span> : null}
                </legend>
                <div>
                  {g.values.map((v) => {
                    const color = g.colors?.[v];
                    return (
                      <button key={v} type="button" aria-pressed={s.selected[g.name] === v} className={`${s.selected[g.name] === v ? "is-on" : ""}${color ? " has-color" : ""}`} onClick={() => s.choose(g.name, v)}>
                        {color && <i style={{ background: color }} aria-hidden="true" />}
                        {v}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            ))}
            {s.groups.length > 0 && !s.ready && <p className="gd-hint">Selecione todas as opções para continuar.</p>}
            <StockAvailability product={product} tenant={tenant} selected={s.selected} className="gd-stock" />

            <div className="gd-buyrow">
              <div className="gd-qty" role="group" aria-label="Quantidade">
                <button type="button" aria-label="Diminuir quantidade" onClick={() => s.setQuantity(Math.max(1, s.qty - 1))}>
                  <Minus size={14} />
                </button>
                <span aria-live="polite">{s.qty}</span>
                <button type="button" aria-label="Aumentar quantidade" disabled={s.qty >= s.maxQty} onClick={() => s.setQuantity(Math.min(s.maxQty, s.qty + 1))}>
                  <Plus size={14} />
                </button>
              </div>
              <button type="button" className="gd-btn gd-btn-accent gd-btn-full" disabled={!s.canAdd} onClick={s.add}>
                {s.soldOut ? "Esgotado" : hidden ? "Incluir no pedido" : "Adicionar ao carrinho"}
              </button>
            </div>
            {tenant.whatsapp && (
              <a className="gd-btn gd-btn-line gd-btn-full" href={waLink(`Olá! Tenho interesse em ${product.name}.`)} target="_blank" rel="noreferrer">
                <MessageCircle size={15} /> Tirar dúvidas no WhatsApp
              </a>
            )}
            <div className="gd-prod-tools">
              <button type="button" aria-pressed={liked} onClick={() => toggleWishlist(product.id)}>
                <Heart size={14} fill={liked ? "currentColor" : "none"} /> {liked ? "Nos favoritos" : "Favoritar"}
              </button>
              <button type="button" onClick={share}>
                {copied ? <Check size={14} /> : <Share2 size={14} />} {copied ? "Link copiado" : "Compartilhar"}
              </button>
            </div>
          </div>

          <ul className="gd-assure">
            <li><Truck size={16} strokeWidth={1.5} /> Entrega ou retirada combinada com a loja</li>
            <li><ShieldCheck size={16} strokeWidth={1.5} /> Produto conferido antes do envio</li>
          </ul>
        </div>
      </div>

      <section className="gd-wrap gd-detail" aria-label="Detalhes do produto">
        <div className="gd-tabs" role="tablist">
          {visibleTabs.map((t) => (
            <button key={t.id} type="button" role="tab" aria-selected={activeTab === t.id} className={activeTab === t.id ? "is-on" : ""} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="gd-tab-body" role="tabpanel">
          {activeTab === "desc" && <p className="gd-desc">{product.description}</p>}
          {activeTab === "specs" && (
            <>
              {specs.rows.length > 0 && (
                <dl className="gd-specs">
                  {specs.rows.map((r, i) => (
                    <div key={r.key + i}>
                      <dt>{r.key}</dt>
                      <dd>{r.value}</dd>
                    </div>
                  ))}
                </dl>
              )}
              {specs.notes.map((n, i) => (
                <p key={i} className="gd-desc">{n}</p>
              ))}
            </>
          )}
          {activeTab === "delivery" && (
            <div className="gd-desc">
              {delivery ? <p>{delivery}</p> : <p>Entrega e retirada são combinadas diretamente com a loja. Fale pelo WhatsApp para saber prazo, frete e garantia deste produto.</p>}
            </div>
          )}
        </div>
      </section>

      {more.length > 0 && (
        <section className="gd-wrap gd-section">
          <header className="gd-sec-head">
            <div>
              <span className="gd-kicker">Continue explorando</span>
              <h2>{related.length ? "Veja também" : "Outros produtos"}</h2>
            </div>
          </header>
          <div className="gd-grid">{more.map((p) => <Card key={p.id} product={p} />)}</div>
        </section>
      )}

      {!hidden && (
        <div className="gd-stickybuy" aria-hidden={false}>
          <div>
            <small>{product.name}</small>
            <strong>{money(priceOf(product))}</strong>
          </div>
          <button type="button" className="gd-btn gd-btn-accent" disabled={!s.canAdd} onClick={s.add}>
            {s.soldOut ? "Esgotado" : s.groups.length > 0 && !s.ready ? "Escolha as opções" : "Comprar"}
          </button>
        </div>
      )}

      {zoom && img && (
        <div className="gd-zoom" role="dialog" aria-label="Foto ampliada" onClick={() => setZoom(false)}>
          <button type="button" className="gd-zoom-close" aria-label="Fechar" onClick={() => setZoom(false)}>
            <X size={22} />
          </button>
          {s.images.length > 1 && (
            <button type="button" className="gd-zoom-nav gd-zoom-prev" aria-label="Foto anterior" onClick={(e) => { e.stopPropagation(); s.setActiveImage((s.activeImage - 1 + s.images.length) % s.images.length); }}>
              <ChevronLeft size={24} />
            </button>
          )}
          <img src={img} alt={product.name} onClick={(e) => e.stopPropagation()} />
          {s.images.length > 1 && (
            <button type="button" className="gd-zoom-nav gd-zoom-next" aria-label="Próxima foto" onClick={(e) => { e.stopPropagation(); s.setActiveImage((s.activeImage + 1) % s.images.length); }}>
              <ChevronRight size={24} />
            </button>
          )}
        </div>
      )}
    </main>
  );
}
