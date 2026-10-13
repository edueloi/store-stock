import { useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Check, ChevronLeft, ChevronRight, Heart, MessageCircle, Minus, Package, Plus, Share2, ShoppingCart } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import StockAvailability from "../../../../components/store/StockAvailability";
import { useStore } from "../../StoreLayout";
import { parseProductIdFromRoute } from "../../store-routing";
import { getVariationImages } from "../../../../utils/variationImages";
import { availableUnits, storeTracksStock } from "../../../../utils/storeStock";
import { groups, isTech, money, optionDisabled, pricesHidden, unitPrice, useTheme, waLink } from "./lib";
import { PriceBlock, ProductRow } from "./parts";
import "./styles.css";

const UNIT_LABEL: Record<string, string> = { unidade: "Unidade", m2: "Metro quadrado (m²)", linear: "Metro linear", peso: "Peso", volume: "Volume" };

export default function StoreProduct() {
  const { productId } = useParams();
  const { products, categories, tenant, addToCart, openCart, wishlist, toggleWishlist } = useStore();
  const { path } = useTheme();
  const product = products.find((p) => p.id === parseProductIdFromRoute(productId));
  const [active, setActive] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [added, setAdded] = useState(false);
  const optionsRef = useRef<HTMLDivElement>(null);

  const gs = useMemo(() => (product ? groups(product) : []), [product]);

  if (!product || !product.is_active) {
    return (
      <main className="ep-page">
        <div className="ep-wrap ep-emptybox">
          <Package size={40} aria-hidden="true" />
          <p>Produto não encontrado.</p>
          <Link to={path("/catalogo")} className="ep-btn">Voltar ao catálogo</Link>
        </div>
      </main>
    );
  }

  const hidden = pricesHidden(tenant);
  const baseImages = Array.isArray(product.images) && product.images.length ? product.images : product.image_url ? [product.image_url] : [];
  const varImages = getVariationImages(product, selected);
  const images = varImages.length ? varImages : baseImages;
  const cat = categories.find((c) => c.id === product.category_id);
  const ready = gs.every((g) => selected[g.name]);
  const tracks = storeTracksStock(tenant);
  const units = tracks ? availableUnits(product, selected) : null;
  const soldOut = units === 0;
  const max = units === null ? 99 : Math.max(1, units);
  const qty = Math.min(Math.max(1, quantity), max);
  const price = unitPrice(product);
  const url = typeof window !== "undefined" ? window.location.href : "";
  const nameUnit = UNIT_LABEL[product.sale_unit || "unidade"] || "Unidade";

  const pick = (name: string, value: string) => {
    setSelected((s) => ({ ...s, [name]: s[name] === value ? "" : value }));
    setActive(0);
  };
  const add = () => {
    if (!ready) {
      optionsRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    if (soldOut) return;
    for (let i = 0; i < qty; i += 1) addToCart(product, gs.length ? selected : undefined);
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1600);
    openCart();
  };
  const share = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: product.name, url });
        return;
      }
      await navigator.clipboard.writeText(url);
    } catch {
      /* cancelado */
    }
  };

  const spec: [string, string][] = [];
  if (product.sku) spec.push(["Código", product.sku]);
  if (product.barcode) spec.push(["Código de barras", product.barcode]);
  if (cat) spec.push(["Categoria", cat.name]);
  gs.forEach((g) => spec.push([g.name, g.values.join(", ")]));
  spec.push(["Unidade de venda", product.unidade_comercial || nameUnit]);
  if (product.ncm) spec.push(["NCM", product.ncm]);
  const techFirst = [...spec.filter(([k]) => isTech(k)), ...spec.filter(([k]) => !isTech(k))];

  const related = products
    .filter((p) => p.is_active && p.type !== "internal" && p.id !== product.id && p.category_id === product.category_id)
    .slice(0, 4);

  return (
    <main className="ep-page ep-prod-page">
      <StoreSEO
        title={`${product.name} — ${tenant.name}`}
        description={product.description || `${product.name} na ${tenant.name}.`}
        image={images[0]}
        url={url}
        type="product"
        price={hidden ? undefined : String(price)}
        siteName={tenant.name}
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "Product",
          name: product.name,
          description: product.description || product.name,
          image: baseImages,
          sku: product.sku || String(product.id),
          ...(cat ? { category: cat.name } : {}),
          ...(hidden
            ? {}
            : {
                offers: {
                  "@type": "Offer",
                  url,
                  priceCurrency: "BRL",
                  price: String(price),
                  itemCondition: "https://schema.org/NewCondition",
                  availability: soldOut ? "https://schema.org/OutOfStock" : "https://schema.org/InStock",
                  seller: { "@type": "Organization", name: tenant.name },
                },
              }),
        }}
      />
      <div className="ep-wrap">
        <p className="ep-crumb">
          <Link to={path()}>Início</Link> / <Link to={path("/catalogo")}>Catálogo</Link>
          {cat && (
            <>
              {" "}/ <Link to={path(`/catalogo?cat=${cat.id}`)}>{cat.name}</Link>
            </>
          )}
        </p>

        <div className="ep-prod">
          <section className="ep-gallery" aria-label="Fotos do produto">
            {images.length > 1 && (
              <div className="ep-thumbs">
                {images.map((img, i) => (
                  <button key={img + i} type="button" className={i === active ? "is-on" : ""} onClick={() => setActive(i)} aria-label={`Ver foto ${i + 1}`}>
                    <img src={img} alt="" />
                  </button>
                ))}
              </div>
            )}
            <div className="ep-stage">
              {images.length ? <img src={images[Math.min(active, images.length - 1)]} alt={product.name} /> : <Package size={64} aria-hidden="true" />}
              {images.length > 1 && (
                <>
                  <button type="button" className="ep-nav ep-prev" aria-label="Foto anterior" onClick={() => setActive((i) => (i - 1 + images.length) % images.length)}>
                    <ChevronLeft size={20} />
                  </button>
                  <button type="button" className="ep-nav ep-next" aria-label="Próxima foto" onClick={() => setActive((i) => (i + 1) % images.length)}>
                    <ChevronRight size={20} />
                  </button>
                </>
              )}
            </div>
          </section>

          <section className="ep-buy">
            <p className="ep-buy-code">Código <b>{product.sku || `#${product.id}`}</b></p>
            <h1>{product.name}</h1>
            <PriceBlock product={product} big />
            {!hidden && product.discount_price != null && <p className="ep-save">Economia de {money(Number(product.price) - price)}</p>}

            <div ref={optionsRef} className="ep-opts">
              {gs.map((g) => (
                <fieldset key={g.name}>
                  <legend className={isTech(g.name) ? "ep-tech-l" : ""}>
                    {g.name}: <b>{selected[g.name] || "selecione"}</b>
                  </legend>
                  <div>
                    {g.values.map((v) => {
                      const off = optionDisabled(tenant, product, selected, g.name, v);
                      const on = selected[g.name] === v;
                      return (
                        <button key={v} type="button" disabled={off} aria-pressed={on} className={`ep-opt ${on ? "is-on" : ""}`} onClick={() => pick(g.name, v)}>
                          {on && <Check size={14} aria-hidden="true" />} {v}
                        </button>
                      );
                    })}
                  </div>
                </fieldset>
              ))}
              {gs.length > 0 && !ready && <p className="ep-hint">Escolha todas as opções para adicionar ao carrinho.</p>}
            </div>

            <StockAvailability product={product} tenant={tenant} selected={selected} className="ep-stock" />

            <div className="ep-buy-row">
              <div className="ep-qty" role="group" aria-label="Quantidade">
                <button type="button" aria-label="Diminuir quantidade" onClick={() => setQuantity(Math.max(1, qty - 1))}>
                  <Minus size={16} />
                </button>
                <output>{qty}</output>
                <button type="button" aria-label="Aumentar quantidade" disabled={qty >= max} onClick={() => setQuantity(Math.min(max, qty + 1))}>
                  <Plus size={16} />
                </button>
              </div>
              <button type="button" className="ep-btn ep-btn-lg ep-buy-btn" disabled={soldOut} onClick={add}>
                {added ? <Check size={18} aria-hidden="true" /> : <ShoppingCart size={18} aria-hidden="true" />}
                {soldOut ? "Esgotado" : added ? "Adicionado" : "Adicionar ao carrinho"}
              </button>
            </div>
            <div className="ep-buy-links">
              <button type="button" onClick={() => toggleWishlist(product.id)} aria-pressed={wishlist.includes(product.id)}>
                <Heart size={16} fill={wishlist.includes(product.id) ? "currentColor" : "none"} aria-hidden="true" /> Favoritar
              </button>
              <button type="button" onClick={share}>
                <Share2 size={16} aria-hidden="true" /> Compartilhar
              </button>
              {tenant.whatsapp && (
                <a href={waLink(tenant, `Olá! Tenho dúvida sobre ${product.name}${product.sku ? ` (cód. ${product.sku})` : ""}.`)} target="_blank" rel="noreferrer">
                  <MessageCircle size={16} aria-hidden="true" /> Tirar dúvida
                </a>
              )}
            </div>
          </section>
        </div>

        <section className="ep-sheet">
          <div>
            <h2>Ficha técnica</h2>
            <table>
              <tbody>
                {techFirst.map(([k, v]) => (
                  <tr key={k} className={isTech(k) ? "is-tech" : ""}>
                    <th scope="row">{k}</th>
                    <td>{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div>
            <h2>Descrição</h2>
            <p className="ep-desc">{product.description || "Este produto ainda não tem descrição. Fale com a loja para mais detalhes técnicos."}</p>
          </div>
        </section>

        {related.length > 0 && (
          <section className="ep-section">
            <header className="ep-sec-h"><h2>Materiais da mesma categoria</h2></header>
            <div className="ep-table">
              {related.map((p) => <ProductRow key={p.id} product={p} />)}
            </div>
          </section>
        )}
      </div>

      <div className="ep-sticky" role="region" aria-label="Compra rápida">
        <div>
          <small>{hidden ? "Preço" : "Total unitário"}</small>
          <strong>{hidden ? "Sob consulta" : money(price)}</strong>
        </div>
        <button type="button" className="ep-btn" disabled={soldOut} onClick={add}>
          <ShoppingCart size={18} aria-hidden="true" />
          {soldOut ? "Esgotado" : !ready ? "Escolher opções" : "Adicionar"}
        </button>
      </div>
    </main>
  );
}
