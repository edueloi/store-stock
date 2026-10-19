import { useEffect, useState, type FormEvent, type RefObject } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { ArrowUpRight, Check, CreditCard, Heart, Minus, Plus, RefreshCw, Search, ShoppingBag, Shirt, Truck } from "lucide-react";
import { gsap } from "gsap";
import StoreSEO from "../../../../components/store/StoreSEO";
import StockAvailability from "../../../../components/store/StockAvailability";
import { StoreButton } from "../../../../components/store/StoreButton";
import { availableUnits } from "../../../../utils/storeStock";
import { parseProductIdFromRoute, productRouteSegment } from "../../store-routing";
import { priceInfo, productImage, useBuy, useKit, useQuickAdd, whatsappLink } from "./kit";
import type { Product } from "../../../../types";

/**
 * Peças compartilhadas pelos temas street (sd), streetwear (sw) e urban (ur).
 * A estrutura é a mesma, mas cada tema tem CSS, marcação de cabeçalho/hero/categorias
 * e catálogo próprios; o prefixo (`t`) escolhe o visual.
 */
export type Prefix = "sd" | "sw" | "ur";

/** Estado comum dos cabeçalhos: menu mobile, busca e fechamento ao navegar. */
export function useHeaderState() {
  const kit = useKit();
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  const [menu, setMenu] = useState(false);
  const [term, setTerm] = useState("");
  useEffect(() => setMenu(false), [pathname, search]);
  useEffect(() => {
    document.body.style.overflow = menu ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menu]);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    setMenu(false);
    navigate(kit.path(`/catalogo${term.trim() ? `?q=${encodeURIComponent(term.trim())}` : ""}`));
  };
  const used = kit.categories.filter((c) => kit.active.some((p) => p.category_id === c.id));
  return { ...kit, pathname, menu, setMenu, term, setTerm, submit, used };
}

/** Imagem de categoria: capa cadastrada ou foto do primeiro produto. */
export function categoryImage(cat: { id: number; cover_url?: string | null }, active: Product[]) {
  return cat.cover_url || productImage(active.find((p) => p.category_id === cat.id));
}

const percentOff = (p: Product) => {
  const base = Number(p.price);
  const sale = Number(p.discount_price);
  return sale > 0 && sale < base ? Math.round((1 - sale / base) * 100) : 0;
};

export function ProductCard({ product, t, fab = false }: { product: Product; t: Prefix; fab?: boolean }) {
  const { path, hidden, wishlist, toggleWishlist, catName, tracks } = useKit();
  const quick = useQuickAdd()(product);
  const price = priceInfo(product, hidden);
  const off = percentOff(product);
  const left = tracks ? availableUnits(product) : null;
  const image = productImage(product);
  const saved = wishlist.includes(product.id);
  const href = path(`/produto/${productRouteSegment(product)}`);
  const label = quick.hasOptions || quick.soldOut ? (quick.soldOut ? "Ver peça" : "Escolher opções") : hidden ? "Incluir no pedido" : "Adicionar";
  return (
    <article className={`${t}-card`}>
      <div className={`${t}-card-media`}>
        <Link to={href} aria-label={product.name} className={`${t}-card-link`}>
          {image ? <img src={image} alt={product.name} loading="lazy" /> : <Shirt size={44} aria-label="Sem imagem" />}
        </Link>
        <div className={`${t}-badges`}>
          {quick.soldOut ? (
            <span className={`${t}-badge ${t}-badge-off`}>Esgotado</span>
          ) : (
            <>
              {product.is_featured && <span className={`${t}-badge ${t}-badge-hot`}>Drop</span>}
              {off > 0 && !hidden && <span className={`${t}-badge ${t}-badge-sale`}>-{off}%</span>}
              {left !== null && left > 0 && left <= 3 && <span className={`${t}-badge ${t}-badge-last`}>Últimas {left}</span>}
            </>
          )}
        </div>
        <button
          type="button"
          className={`${t}-heart`}
          aria-label={saved ? `Remover ${product.name} dos favoritos` : `Favoritar ${product.name}`}
          aria-pressed={saved}
          onClick={() => toggleWishlist(product.id)}
        >
          <Heart size={17} fill={saved ? "currentColor" : "none"} />
        </button>
        {fab &&
          (quick.hasOptions || quick.soldOut ? (
            <Link className={`${t}-fab`} to={href} aria-label={`${label}: ${product.name}`}>
              <ArrowUpRight size={20} />
            </Link>
          ) : (
            <button type="button" className={`${t}-fab`} onClick={quick.add} aria-label={`${label}: ${product.name}`}>
              <Plus size={20} />
            </button>
          ))}
      </div>
      <div className={`${t}-card-body`}>
        {catName(product) && <span className={`${t}-card-cat`}>{catName(product)}</span>}
        <Link className={`${t}-card-name`} to={href}>
          {product.name}
        </Link>
        <div className={`${t}-price`}>
          <strong>{price.now}</strong>
          {price.old && <s>{price.old}</s>}
        </div>
        {!fab &&
          (quick.hasOptions || quick.soldOut ? (
            <Link className={`${t}-btn ${t}-btn-line`} to={href}>
              {label}
            </Link>
          ) : (
            <button type="button" className={`${t}-btn ${t}-btn-solid`} onClick={quick.add}>
              <ShoppingBag size={16} /> {label}
            </button>
          ))}
      </div>
    </article>
  );
}

export function Empty({ t, title, text, onClear }: { t: Prefix; title: string; text: string; onClear?: () => void }) {
  return (
    <div className={`${t}-empty`}>
      <Search size={36} aria-hidden="true" />
      <h2>{title}</h2>
      <p>{text}</p>
      {onClear && (
        <button type="button" className={`${t}-btn ${t}-btn-solid`} onClick={onClear}>
          Ver tudo
        </button>
      )}
    </div>
  );
}

/** Opções de ordenação do catálogo. */
export function SortSelect({ t, sort, hidden, onChange }: { t: Prefix; sort: string; hidden: boolean; onChange: (v: string | null) => void }) {
  return (
    <label className={`${t}-select`}>
      <span className={`${t}-sr`}>Ordenar por</span>
      <select value={sort} onChange={(e) => onChange(e.target.value === "destaques" ? null : e.target.value)}>
        <option value="destaques">Destaques</option>
        <option value="nome">Nome (A a Z)</option>
        {!hidden && <option value="menor">Menor preço</option>}
        {!hidden && <option value="maior">Maior preço</option>}
      </select>
    </label>
  );
}

/** Página de produto compartilhada: galeria, opções, quantidade e compra. */
export function ProductPage({ t }: { t: Prefix }) {
  const { productId } = useParams();
  const { active, path } = useKit();
  const product = active.find((p) => p.id === parseProductIdFromRoute(productId));
  if (!product)
    return (
      <div className={`${t}-page ${t}-notfound`}>
        <Shirt size={52} aria-hidden="true" />
        <h1>Peça não encontrada</h1>
        <p>Ela pode ter esgotado ou saído do catálogo.</p>
        <Link className={`${t}-btn ${t}-btn-solid`} to={path("/catalogo")}>
          Voltar ao catálogo
        </Link>
      </div>
    );
  return <Details key={product.id} product={product} t={t} />;
}

function Details({ product, t }: { product: Product; t: Prefix }) {
  const { tenant, active, hidden, path, catName, sf } = useKit();
  const b = useBuy(product);
  const price = priceInfo(product, hidden);
  const off = percentOff(product);
  const related = active.filter((p) => p.id !== product.id && p.category_id === product.category_id).slice(0, 4);
  const wa = whatsappLink(tenant.whatsapp, `Olá! Tenho uma dúvida sobre: ${product.name}`);
  const missing = b.groups.filter((g) => !b.selected[g.name]).map((g) => g.name);
  return (
    <div className={`${t}-page ${t}-product`}>
      <StoreSEO
        title={`${product.name} | ${tenant.name}`}
        description={product.description || product.name}
        image={b.gallery[0]}
        url={typeof window !== "undefined" ? window.location.href : ""}
        siteName={tenant.name}
      />
      <nav className={`${t}-crumbs`} aria-label="Você está em">
        <Link to={path("/catalogo")}>Catálogo</Link>
        {catName(product) && (
          <>
            <span aria-hidden="true">/</span>
            <Link to={path(`/catalogo?categoria=${product.category_id}`)}>{catName(product)}</Link>
          </>
        )}
      </nav>

      <div className={`${t}-pd`}>
        <section className={`${t}-gallery`} aria-label="Fotos do produto">
          <div className={`${t}-gallery-main`}>
            {b.gallery.length ? <img src={b.gallery[b.photo] || b.gallery[0]} alt={product.name} /> : <Shirt size={80} aria-label="Sem imagem" />}
            {off > 0 && !hidden && <span className={`${t}-badge ${t}-badge-sale`}>-{off}%</span>}
          </div>
          {b.gallery.length > 1 && (
            <div className={`${t}-thumbs`}>
              {b.gallery.map((src, i) => (
                <button key={`${src}-${i}`} type="button" aria-label={`Ver foto ${i + 1}`} aria-pressed={b.photo === i} onClick={() => b.setPhoto(i)}>
                  <img src={src} alt="" />
                </button>
              ))}
            </div>
          )}
        </section>

        <section className={`${t}-buy`}>
          {catName(product) && <span className={`${t}-card-cat`}>{catName(product)}</span>}
          <h1>{product.name}</h1>
          {product.sku && <small className={`${t}-sku`}>Ref. {product.sku}</small>}
          <div className={`${t}-price ${t}-price-lg`}>
            <strong>{hidden ? "Valor sob consulta" : price.now}</strong>
            {price.old && <s>{price.old}</s>}
          </div>
          {product.description && <p className={`${t}-desc`}>{product.description}</p>}

          <StockAvailability product={product} tenant={tenant} selected={b.ready ? b.selected : undefined} />

          {b.groups.map((g) => (
            <fieldset key={g.name} className={`${t}-fieldset`}>
              <legend>
                {g.name} <small>obrigatório</small>
              </legend>
              <div className={`${t}-opts`}>
                {g.values.map((v) => (
                  <button key={v} type="button" className={`${t}-opt`} aria-pressed={b.selected[g.name] === v} onClick={() => b.setSelected((prev) => ({ ...prev, [g.name]: v }))}>
                    {b.selected[g.name] === v && <Check size={14} aria-hidden="true" />} {v}
                  </button>
                ))}
              </div>
            </fieldset>
          ))}

          <label className={`${t}-note-field`}>
            <span>Observação (opcional)</span>
            <textarea value={b.note} maxLength={250} onChange={(e) => b.setNote(e.target.value)} placeholder="Ex.: cor alternativa, presente..." rows={2} />
          </label>

          <div className={`${t}-buy-row`}>
            <div className={`${t}-qty`} role="group" aria-label="Quantidade">
              <button type="button" aria-label="Diminuir quantidade" disabled={b.qty <= 1} onClick={() => b.setQty((v) => Math.max(1, v - 1))}>
                <Minus size={16} />
              </button>
              <output aria-live="polite">{b.qty}</output>
              <button type="button" aria-label="Aumentar quantidade" disabled={b.qty >= b.maxQty} onClick={() => b.setQty((v) => Math.min(b.maxQty, v + 1))}>
                <Plus size={16} />
              </button>
            </div>
            <StoreButton className={`${t}-add`} disabled={!b.canAdd} onClick={b.add}>
              <ShoppingBag size={18} /> {b.soldOut ? "Indisponível" : sf.checkout_mode === "order_request" ? "Incluir no pedido" : "Adicionar à sacola"}
            </StoreButton>
          </div>
          {!b.ready && (
            <p className={`${t}-hint`} role="status">
              Escolha {missing.join(" e ")} para continuar.
            </p>
          )}
          {b.added && (
            <div className={`${t}-added`} role="status">
              <span>
                <Check size={17} aria-hidden="true" /> Adicionado à sacola
              </span>
              <button type="button" onClick={b.openCart}>
                Ver sacola
              </button>
            </div>
          )}
          {wa && (
            <a className={`${t}-link`} href={wa} target="_blank" rel="noreferrer">
              Tirar dúvida pelo WhatsApp
            </a>
          )}
          {tenant.show_address && tenant.address && <p className={`${t}-small`}>Retirada: {tenant.address}</p>}
          <TrustRow t={t} />
        </section>
      </div>

      {related.length > 0 && (
        <section className={`${t}-section`}>
          <h2 className={`${t}-h2`}>Veja também</h2>
          <div className={`${t}-grid`}>
            {related.map((p) => (
              <ProductCard key={p.id} product={p} t={t} fab={t === "sw"} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

/** Entrada em cascata + parallax leve do hero (GSAP), respeitando prefers-reduced-motion. */
export function useHeroMotion<T extends HTMLElement>(ref: RefObject<T | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = gsap.context(() => {
      gsap.from("[data-hero-in]", { opacity: 0, y: 28, duration: 0.7, stagger: 0.1, ease: "power3.out" });
      gsap.from("[data-hero-img]", { opacity: 0, scale: 1.08, duration: 1.1, ease: "power2.out" });
      const onMove = (e: PointerEvent) => {
        const r = el.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5;
        const y = (e.clientY - r.top) / r.height - 0.5;
        gsap.to("[data-hero-img]", { x: x * 16, y: y * 12, duration: 0.8, ease: "power2.out" });
      };
      el.addEventListener("pointermove", onMove);
      return () => el.removeEventListener("pointermove", onMove);
    }, el);
    return () => ctx.revert();
  }, [ref]);
}

/** Mini-selos de confiança (entrega, pagamento, troca). */
export function TrustRow({ t }: { t: Prefix }) {
  const items = [
    { icon: Truck, title: "Entrega combinada", text: "Receba em casa ou retire na loja" },
    { icon: CreditCard, title: "Pague do seu jeito", text: "Pix, cartão e outras formas" },
    { icon: RefreshCw, title: "Troca facilitada", text: "Sem dor de cabeça na troca" },
  ];
  return (
    <ul className={`${t}-trust`} aria-label="Vantagens da loja">
      {items.map(({ icon: Icon, title, text }) => (
        <li key={title}>
          <Icon size={22} aria-hidden="true" />
          <span>
            <strong>{title}</strong>
            <small>{text}</small>
          </span>
        </li>
      ))}
    </ul>
  );
}
