import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowRight,
  Heart,
  LayoutGrid,
  List,
  Minus,
  Package,
  Plus,
  Search,
  ShoppingBag,
  SlidersHorizontal,
} from "lucide-react";
import { useStore } from "../../StoreLayout";
import {
  buildStorePath,
  parseProductIdFromRoute,
  productRouteSegment,
  resolveStoreSlug,
} from "../../store-routing";
import StoreSEO from "../../../../components/store/StoreSEO";
import SearchBar from "../../../../components/layout/SearchBar";
import { getVariationImages } from "../../../../utils/variationImages";
import type { Product as ProductType } from "../../../../types";
import { segmentThemes, type SegmentId } from "./registry";

const image = (p?: ProductType) => p?.images?.[0] || p?.image_url;
const money = (v: number) =>
  Number(v || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
const groups = (p: ProductType) =>
  p.attributes?.length
    ? p.attributes.map((a) => ({ name: a.name, values: a.values }))
    : (p.variations || []).map((a) => ({
        name: a.name,
        values: a.options.map((o) => o.value),
      }));
function useSegment() {
  const store = useStore();
  const { slug } = useParams();
  const [params] = useSearchParams();
  const preview = params.get("previewTheme");
  const baseTheme = segmentThemes[store.templateId as SegmentId];
  const path = (part = "") => {
    const base = buildStorePath(resolveStoreSlug(slug), part);
    return preview
      ? `${base}${base.includes("?") ? "&" : "?"}previewTheme=${encodeURIComponent(preview)}`
      : base;
  };
  const config = store.tenant.policies?.storefront || {};
  const theme = { ...baseTheme, tag: config.segment_label || baseTheme.tag };
  const hidden =
    config.hide_prices === true || config.checkout_mode === "order_request";
  return {
    ...store,
    theme,
    path,
    config,
    hidden,
    active: store.products.filter((p) => p.is_active && p.type !== "internal"),
  };
}
function Picture({
  product,
  alt = "",
}: {
  product?: ProductType;
  alt?: string;
}) {
  return image(product) ? (
    <img src={image(product)} alt={alt || product?.name} loading="lazy" />
  ) : (
    <Package size={52} aria-label="Produto sem imagem" />
  );
}
function ProductCard({ product }: { product: ProductType }) {
  const {
    path,
    hidden,
    categories,
    wishlist,
    toggleWishlist,
    addToCart,
    tenant,
    config,
  } = useSegment();
  const selected = wishlist.includes(product.id);
  const stock =
    !tenant.sell_without_stock_control &&
    config.checkout_mode !== "order_request" &&
    Number(product.stock_quantity) <= 0;
  return (
    <article className="seg-card">
      <Link
        className="seg-card-media"
        to={path(`/produto/${productRouteSegment(product)}`)}
      >
        <Picture product={product} />
        {product.is_featured && <span className="seg-badge">Destaque</span>}
      </Link>
      <button
        type="button"
        className="seg-favorite"
        aria-label={selected ? "Remover dos favoritos" : "Favoritar produto"}
        aria-pressed={selected}
        onClick={() => toggleWishlist(product.id)}
      >
        <Heart size={18} fill={selected ? "currentColor" : "none"} />
      </button>
      <div className="seg-card-copy">
        <small>
          {categories.find((c) => c.id === product.category_id)?.name ||
            "Seleção da loja"}
        </small>
        <Link
          className="seg-card-name"
          to={path(`/produto/${productRouteSegment(product)}`)}
        >
          {product.name}
        </Link>
        <p>
          {hidden
            ? "Sob consulta"
            : money(Number(product.discount_price ?? product.price))}
        </p>
        {groups(product).length || stock ? (
          <Link
            className="seg-button"
            to={path(`/produto/${productRouteSegment(product)}`)}
          >
            {stock ? "Consultar produto" : "Escolher opções"}
            <ArrowRight size={15} />
          </Link>
        ) : (
          <button
            type="button"
            className="seg-button"
            onClick={() => addToCart(product)}
          >
            <ShoppingBag size={15} />
            {hidden ? "Incluir no pedido" : "Adicionar"}
          </button>
        )}
      </div>
    </article>
  );
}
function CategoryLinks({ compact = false }: { compact?: boolean }) {
  const { categories, active, path } = useSegment();
  return (
    <div className={compact ? "seg-departments" : "seg-categories"}>
      {categories
        .filter((c) => active.some((p) => p.category_id === c.id))
        .map((c) => (
          <Link key={c.id} to={path(`/catalogo?cat=${c.id}`)}>
            {!compact && (
              <div>
                {c.cover_url ? (
                  <img src={c.cover_url} alt="" loading="lazy" />
                ) : (
                  <Picture
                    product={active.find((p) => p.category_id === c.id)}
                  />
                )}
              </div>
            )}
            <span>{c.name}</span>
            <ArrowRight size={15} />
          </Link>
        ))}
    </div>
  );
}
function SearchForm() {
  const { path } = useSegment();
  return (
    <form action={path("/catalogo")} className="seg-search-form">
      {new URLSearchParams(location.search).get("previewTheme") && (
        <input
          type="hidden"
          name="previewTheme"
          value={new URLSearchParams(location.search).get("previewTheme") || ""}
        />
      )}
      <Search size={20} />
      <input
        name="q"
        placeholder="O que você procura?"
        aria-label="Buscar produtos"
      />
      <button className="seg-button" type="submit">
        Buscar
      </button>
    </form>
  );
}
function Hero() {
  const { theme, tenant, active, path, config } = useSegment();
  const media = (
    <div className="seg-hero-media">
      {tenant.banner_url ? (
        <img src={tenant.banner_url} alt={tenant.name} />
      ) : (
        <Picture product={active.find((p) => p.is_featured) || active[0]} />
      )}
    </div>
  );
  const copy = (
    <div className="seg-hero-copy">
      <span className="seg-kicker">{theme.tag}</span>
      <h1>{tenant.hero_tagline || theme.hero}</h1>
      <p>{tenant.about_text || theme.sub}</p>
      <Link className="seg-button" to={path("/catalogo")}>
        {config.hero_button_label || "Explorar catálogo"}
        <ArrowRight size={18} />
      </Link>
    </div>
  );
  if (theme.layout === "departments")
    return (
      <section className="seg-hero seg-hero-departments">
        <aside>
          <span className="seg-kicker">Departamentos</span>
          <CategoryLinks compact />
        </aside>
        {copy}
        {media}
      </section>
    );
  if (theme.layout === "technical")
    return (
      <section className="seg-hero seg-hero-technical">
        <div>
          {copy}
          <SearchForm />
        </div>
        {media}
        <div className="seg-tech-strip">
          <span>Catálogo da loja</span>
          <span>{active.length} produtos</span>
          <Link to={path("/sobre")}>Fale com a equipe →</Link>
        </div>
      </section>
    );
  if (theme.layout === "shelves")
    return (
      <section className="seg-hero seg-hero-shelves">
        {copy}
        <div className="seg-shelf-showcase">
          {active.slice(0, 3).map((p) => (
            <Link key={p.id} to={path(`/produto/${productRouteSegment(p)}`)}>
              <Picture product={p} />
              <span>{p.name}</span>
            </Link>
          ))}
          {!active.length && media}
        </div>
      </section>
    );
  if (theme.layout === "clinical")
    return (
      <section className="seg-hero seg-hero-clinical">
        <SearchForm />
        <div className="seg-clinical-banner">
          {copy}
          {media}
        </div>
        <CategoryLinks compact />
      </section>
    );
  if (theme.layout === "mosaic")
    return (
      <section className="seg-hero seg-hero-mosaic">
        {copy}
        <div className="seg-mosaic">
          {media}
          {active.slice(1, 3).map((p) => (
            <Link key={p.id} to={path(`/produto/${productRouteSegment(p)}`)}>
              <Picture product={p} />
              <span>{p.name}</span>
            </Link>
          ))}
        </div>
      </section>
    );
  if (theme.layout === "botanical")
    return (
      <section className="seg-hero seg-hero-botanical">
        {media}
        {copy}
        <span className="seg-botanical-note">
          {tenant.name} · {theme.tag}
        </span>
      </section>
    );
  if (theme.layout === "atelier")
    return (
      <section className="seg-hero seg-hero-atelier">
        {copy}
        {media}
        <Link className="seg-atelier-stamp" to={path("/sobre")}>
          Conheça
          <br />a nossa loja ↗
        </Link>
      </section>
    );
  return (
    <section className="seg-hero seg-hero-editorial">
      {media}
      {copy}
      <Link className="seg-editorial-caption" to={path("/catalogo")}>
        Descubra a coleção ↓
      </Link>
    </section>
  );
}
export function Front() {
  const { tenant, theme, config, active, path } = useSegment();
  const featured = [
    ...active.filter((p) => p.is_featured),
    ...active.filter((p) => !p.is_featured),
  ].slice(0, tenant.featured_limit || 8);
  return (
    <div className="seg-page">
      <StoreSEO
        title={`${tenant.name} | ${theme.tag}`}
        description={tenant.about_text || theme.sub}
        image={tenant.banner_url}
        siteName={tenant.name}
        url={location.href}
      />
      <Hero />
      <section className="seg-section">
        <div className="seg-section-heading">
          <span className="seg-kicker">Explore</span>
          <h2>{config.home_categories_title || theme.categories}</h2>
        </div>
        <CategoryLinks />
      </section>
      <section className="seg-section">
        <div className="seg-section-heading">
          <h2>{config.home_featured_title || theme.featured}</h2>
          <Link to={path("/catalogo")}>
            Ver todos <ArrowRight size={16} />
          </Link>
        </div>
        <div className="seg-grid">
          {featured.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
        {!featured.length && (
          <p className="seg-empty">
            O catálogo está sendo preparado. Volte em breve.
          </p>
        )}
      </section>
      <section className="seg-story">
        <span className="seg-kicker">{tenant.name}</span>
        <h2>{tenant.hero_tagline || theme.hero}</h2>
        <p>{tenant.about_text || theme.sub}</p>
        <Link className="seg-button" to={path("/sobre")}>
          Conheça nossa história
          <ArrowRight size={16} />
        </Link>
      </section>
    </div>
  );
}
export function Catalog() {
  const { tenant, theme, config, active, categories, hidden } = useSegment();
  const [params, setParams] = useSearchParams();
  const q = params.get("q") || "";
  const cat = params.get("cat") || "";
  const [view, setView] = useState(
    theme.layout === "technical" ? "list" : "grid",
  );
  const sort = params.get("sort") || "featured";
  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    value ? next.set(key, value) : next.delete(key);
    setParams(next, { replace: key === "q" });
  };
  const normalized = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  const visible = active
    .filter(
      (p) =>
        (!cat || String(p.category_id) === cat) &&
        normalized(`${p.name} ${p.sku || ""}`).includes(normalized(q)),
    )
    .sort((a, b) =>
      sort === "name"
        ? a.name.localeCompare(b.name, "pt-BR")
        : !hidden && sort === "price_up"
          ? Number(a.discount_price ?? a.price) -
            Number(b.discount_price ?? b.price)
          : !hidden && sort === "price_down"
            ? Number(b.discount_price ?? b.price) -
              Number(a.discount_price ?? a.price)
            : Number(b.is_featured) - Number(a.is_featured),
    );
  return (
    <div className="seg-page seg-catalog">
      <StoreSEO
        title={`${config.catalog_title || theme.catalog} | ${tenant.name}`}
        description={config.catalog_description || theme.sub}
        siteName={tenant.name}
        url={location.href}
      />
      <div className="seg-catalog-heading">
        <span className="seg-kicker">{theme.tag}</span>
        <h1>{config.catalog_title || theme.catalog}</h1>
        <p>{config.catalog_description || theme.sub}</p>
      </div>
      <div className="seg-catalog-layout">
        <aside className="seg-filter">
          <h2>
            <SlidersHorizontal size={17} />
            Categorias
          </h2>
          <button aria-pressed={!cat} onClick={() => update("cat", "")}>
            Todos os produtos<span>{active.length}</span>
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              aria-pressed={cat === String(c.id)}
              onClick={() => update("cat", String(c.id))}
            >
              {c.name}
              <span>{active.filter((p) => p.category_id === c.id).length}</span>
            </button>
          ))}
        </aside>
        <section className="seg-results">
          <div className="seg-toolbar">
            <SearchBar
              value={q}
              onChange={(value) => update("q", value)}
              placeholder="Nome ou código do produto"
            />
            <label>
              <span className="sr-only">Ordenação</span>
              <select
                value={sort}
                onChange={(e) => update("sort", e.target.value)}
              >
                <option value="featured">Destaques</option>
                <option value="name">Nome A–Z</option>
                {!hidden && (
                  <>
                    <option value="price_up">Menor preço</option>
                    <option value="price_down">Maior preço</option>
                  </>
                )}
              </select>
            </label>
            <div className="seg-view">
              <button
                aria-label="Exibir em grade"
                aria-pressed={view === "grid"}
                onClick={() => setView("grid")}
              >
                <LayoutGrid size={19} />
              </button>
              <button
                aria-label="Exibir em lista"
                aria-pressed={view === "list"}
                onClick={() => setView("list")}
              >
                <List size={19} />
              </button>
            </div>
          </div>
          <p className="seg-count">{visible.length} produtos encontrados</p>
          <div className={`seg-grid ${view === "list" ? "seg-list" : ""}`}>
            {visible.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
          {!visible.length && (
            <div className="seg-empty">
              <Search size={30} />
              <h2>Nenhum produto encontrado</h2>
              <p>Tente outro termo ou categoria.</p>
              <button className="seg-button" onClick={() => setParams({})}>
                Limpar filtros
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
export function Product() {
  const { productId } = useParams();
  const { active } = useSegment();
  const product = active.find(
    (p) => p.id === parseProductIdFromRoute(productId),
  );
  return product ? (
    <ProductDetails key={product.id} product={product} />
  ) : (
    <NotFound />
  );
}
function NotFound() {
  const { path } = useSegment();
  return (
    <div className="seg-page seg-empty">
      <h1>Produto não encontrado</h1>
      <Link className="seg-button" to={path("/catalogo")}>
        Voltar ao catálogo
      </Link>
    </div>
  );
}
function ProductDetails({ product }: { product: ProductType }) {
  const { tenant, categories, active, hidden, config, path, addToCart, cart } =
    useSegment();
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [qty, setQty] = useState(1);
  const [photo, setPhoto] = useState(0);
  const choices = groups(product);
  const ready = choices.every((a) => selected[a.name]);
  const variantPhotos = getVariationImages(product, selected);
  const gallery = variantPhotos.length
    ? variantPhotos
    : product.images?.length
      ? product.images
      : product.image_url
        ? [product.image_url]
        : [];
  const sku = product.skus?.find((s) =>
    choices.every((a) => s.combo[a.name] === selected[a.name]),
  );
  const limited =
    !tenant.sell_without_stock_control &&
    config.checkout_mode !== "order_request";
  const available =
    choices.length && product.skus?.length
      ? ready && sku
        ? Number(sku.stock)
        : 0
      : Number(product.stock_quantity);
  const already = cart
    .filter(
      (i) =>
        i.id === product.id &&
        choices.every((a) => i.selectedOptions?.[a.name] === selected[a.name]),
    )
    .reduce((sum, i) => sum + i.quantity, 0);
  const soldOut = limited && ready && available <= already;
  const maximum = limited ? Math.max(0, Math.floor(available - already)) : 999;
  const canAdd = ready && !soldOut && qty <= maximum;
  const add = () => {
    if (!canAdd) return;
    for (let i = 0; i < qty; i++)
      addToCart(product, choices.length ? selected : undefined);
  };
  useEffect(() => {
    setPhoto(0);
    setQty(1);
  }, [selected]);
  return (
    <div className="seg-page seg-product">
      <StoreSEO
        title={`${product.name} | ${tenant.name}`}
        description={product.description || product.name}
        image={gallery[0]}
        siteName={tenant.name}
        url={location.href}
      />
      <nav className="seg-breadcrumb">
        <Link to={path("/catalogo")}>Catálogo</Link>
        <span>/</span>
        <span>{product.name}</span>
      </nav>
      <div className="seg-product-layout">
        <section className="seg-gallery">
          <div className="seg-main-photo">
            {gallery.length ? (
              <img src={gallery[photo] || gallery[0]} alt={product.name} />
            ) : (
              <Package size={70} />
            )}
          </div>
          {gallery.length > 1 && (
            <div className="seg-thumbs">
              {gallery.map((src, i) => (
                <button
                  key={`${src}-${i}`}
                  aria-label={`Ver imagem ${i + 1}`}
                  aria-pressed={photo === i}
                  onClick={() => setPhoto(i)}
                >
                  <img src={src} alt="" />
                </button>
              ))}
            </div>
          )}
        </section>
        <section className="seg-purchase">
          <span className="seg-kicker">
            {categories.find((c) => c.id === product.category_id)?.name ||
              "Seleção da loja"}
          </span>
          <h1>{product.name}</h1>
          {product.sku && <small>Código: {product.sku}</small>}
          <p className="seg-price">
            {hidden
              ? "Valor sob consulta"
              : money(Number(product.discount_price ?? product.price))}
          </p>
          {product.description && (
            <p className="seg-description">{product.description}</p>
          )}
          {choices.map((a) => (
            <fieldset key={a.name}>
              <legend>
                {a.name} <small>obrigatório</small>
              </legend>
              <div className="seg-options">
                {a.values.map((value) => (
                  <button
                    key={value}
                    aria-pressed={selected[a.name] === value}
                    onClick={() =>
                      setSelected((prev) => ({ ...prev, [a.name]: value }))
                    }
                  >
                    {value}
                  </button>
                ))}
              </div>
            </fieldset>
          ))}
          <div className="seg-buy-row">
            <div className="seg-quantity">
              <button
                aria-label="Diminuir quantidade"
                onClick={() => setQty((v) => Math.max(1, v - 1))}
                disabled={qty <= 1}
              >
                <Minus size={16} />
              </button>
              <output aria-label="Quantidade">{qty}</output>
              <button
                aria-label="Aumentar quantidade"
                disabled={qty >= maximum}
                onClick={() => setQty((v) => Math.min(maximum, v + 1))}
              >
                <Plus size={16} />
              </button>
            </div>
            <button className="seg-button" disabled={!canAdd} onClick={add}>
              <ShoppingBag size={18} />
              {soldOut ? "Indisponível" : "Adicionar ao pedido"}
            </button>
          </div>
          {!ready && <p role="status">Selecione as opções para continuar.</p>}
          <p className="seg-purchase-note">
            Entrega e pagamento conforme as opções da loja no fechamento do
            pedido.
          </p>
          {tenant.show_address && tenant.address && (
            <p className="seg-purchase-note">{tenant.address}</p>
          )}
        </section>
      </div>
      {active.some(
        (p) => p.id !== product.id && p.category_id === product.category_id,
      ) && (
        <section className="seg-section">
          <h2>Veja também</h2>
          <div className="seg-grid">
            {active
              .filter(
                (p) =>
                  p.id !== product.id && p.category_id === product.category_id,
              )
              .slice(0, 4)
              .map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
          </div>
        </section>
      )}
    </div>
  );
}
export function About() {
  const { tenant, theme, path, config } = useSegment();
  return (
    <div className="seg-page seg-about">
      <StoreSEO
        title={`Sobre | ${tenant.name}`}
        description={tenant.about_text || theme.sub}
        siteName={tenant.name}
        url={location.href}
      />
      <div className="seg-about-intro">
        <span className="seg-kicker">Nossa loja</span>
        <h1>{tenant.name}</h1>
        <p>{tenant.hero_tagline || theme.hero}</p>
      </div>
      {tenant.banner_url && (
        <img
          className="seg-about-image"
          src={tenant.banner_url}
          alt={tenant.name}
        />
      )}
      <section className="seg-about-copy">
        <h2>{config.about_title || "Conheça a nossa história"}</h2>
        <p>{tenant.about_text || theme.sub}</p>
        <Link className="seg-button" to={path("/catalogo")}>
          Explore os produtos
          <ArrowRight size={17} />
        </Link>
        {tenant.show_address && tenant.address && (
          <div>
            <h3>Onde estamos</h3>
            <p>{tenant.address}</p>
          </div>
        )}
        {tenant.policies?.shipping && (
          <div>
            <h3>Entrega</h3>
            <p>{tenant.policies.shipping}</p>
          </div>
        )}
        {tenant.policies?.returns && (
          <div>
            <h3>Trocas e devoluções</h3>
            <p>{tenant.policies.returns}</p>
          </div>
        )}
      </section>
    </div>
  );
}
