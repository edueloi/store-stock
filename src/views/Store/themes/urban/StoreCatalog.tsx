import { useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { Heart, Search, ShoppingBag, SlidersHorizontal, X } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import { useStore } from "../../StoreLayout";
import {
  buildStorePath,
  productRouteSegment,
  resolveStoreSlug,
} from "../../store-routing";
import { productHasStock } from "../../../../utils/productStock";

const money = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    value,
  );

export default function StoreCatalog() {
  const { slug: routeSlug } = useParams();
  const [params, setParams] = useSearchParams();
  const { tenant, categories, products, addToCart, wishlist, toggleWishlist } =
    useStore();
  const slug = resolveStoreSlug(routeSlug);
  const [query, setQuery] = useState(params.get("q") || "");
  const [minimumPrice, setMinimumPrice] = useState("");
  const [maximumPrice, setMaximumPrice] = useState("");
  const selectedCategory = params.get("cat") ? Number(params.get("cat")) : null;
  const accent = tenant.primary_color || "#2563eb";
  const storefront = tenant.policies?.storefront || {};
  const catalogTitle = storefront.catalog_title || "Todos os produtos";
  const catalogDescription =
    storefront.catalog_description ||
    "Escolha suas peças, confira os detalhes e monte seu pedido.";
  const availableProducts = useMemo(
    () =>
      products.filter(
        (product) => product.is_active && productHasStock(product),
      ),
    [products],
  );
  const availablePrices = useMemo(
    () =>
      availableProducts
        .map((product) => Number(product.discount_price || product.price))
        .filter((price) => Number.isFinite(price)),
    [availableProducts],
  );
  const lowestPrice = availablePrices.length ? Math.min(...availablePrices) : 0;
  const highestPrice = availablePrices.length
    ? Math.max(...availablePrices)
    : 0;
  const activeProducts = useMemo(
    () =>
      availableProducts
        .filter(
          (product) =>
            (!selectedCategory || product.category_id === selectedCategory) &&
            (!query ||
              product.name.toLowerCase().includes(query.toLowerCase())),
        )
        .filter((product) => {
          const price = Number(product.discount_price || product.price);
          return (
            (!minimumPrice || price >= Number(minimumPrice)) &&
            (!maximumPrice || price <= Number(maximumPrice))
          );
        }),
    [availableProducts, selectedCategory, query, minimumPrice, maximumPrice],
  );
  const setCategory = (id: number | null) => {
    const next = new URLSearchParams(params);
    if (id) next.set("cat", String(id));
    else next.delete("cat");
    setParams(next);
  };
  const path = (suffix = "") => buildStorePath(slug, suffix);
  const hasPriceFilter = Boolean(minimumPrice || maximumPrice);
  const quickRanges = [
    {
      label: `Até ${money(Math.max(50, lowestPrice))}`,
      min: "",
      max: String(Math.max(50, lowestPrice)),
    },
    {
      label: `${money(Math.max(50, lowestPrice))} a ${money(Math.max(150, lowestPrice))}`,
      min: String(Math.max(50, lowestPrice)),
      max: String(Math.max(150, lowestPrice)),
    },
    {
      label: `Acima de ${money(Math.max(150, lowestPrice))}`,
      min: String(Math.max(150, lowestPrice)),
      max: "",
    },
  ].filter(
    (range, index) =>
      highestPrice > 0 &&
      (index < 2 ? Number(range.min || 0) < highestPrice : true),
  );

  const applyQuickRange = (min: string, max: string) => {
    setMinimumPrice(min);
    setMaximumPrice(max);
  };

  return (
    <div className="min-h-[70vh] bg-[#f6f7f9] px-4 py-8 text-slate-900 md:px-8 md:py-12">
      <StoreSEO
        title={`${catalogTitle} — ${tenant.name}`}
        description={catalogDescription}
        url={typeof window !== "undefined" ? window.location.href : ""}
        siteName={tenant.name}
      />
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-col justify-between gap-6 border-b border-slate-200 pb-7 md:flex-row md:items-end">
          <div>
            <p
              className="text-[10px] font-bold uppercase tracking-[.2em]"
              style={{ color: accent }}
            >
              Loja online
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-[-.055em] md:text-5xl">
              {catalogTitle}
            </h1>
            <p className="mt-2 text-sm text-slate-500">{catalogDescription}</p>
            <p className="mt-2 text-xs font-medium text-slate-400">
              {activeProducts.length}{" "}
              {activeProducts.length === 1
                ? "produto disponível"
                : "produtos disponíveis"}
            </p>
          </div>
          <div className="relative w-full md:w-80">
            <Search
              className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
              size={17}
            />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar na loja"
              className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-4 text-sm outline-none focus:border-slate-400"
            />
          </div>
        </header>
        <div className="mt-6 flex items-center gap-2 overflow-x-auto pb-1">
          <SlidersHorizontal size={15} className="shrink-0 text-slate-500" />
          <button
            onClick={() => setCategory(null)}
            className="h-9 shrink-0 rounded-full border px-4 text-xs font-semibold"
            style={
              selectedCategory === null
                ? {
                    backgroundColor: accent,
                    borderColor: accent,
                    color: "white",
                  }
                : { borderColor: "#e2e8f0" }
            }
          >
            Todos
          </button>
          {categories
            .filter((category) =>
              products.some(
                (product) =>
                  product.category_id === category.id && product.is_active,
              ),
            )
            .map((category) => (
              <button
                key={category.id}
                onClick={() => setCategory(category.id)}
                className="h-9 shrink-0 rounded-full border px-4 text-xs font-semibold"
                style={
                  selectedCategory === category.id
                    ? {
                        backgroundColor: accent,
                        borderColor: accent,
                        color: "white",
                      }
                    : { borderColor: "#e2e8f0" }
                }
              >
                {category.name}
              </button>
            ))}
        </div>
        <div className="mt-5 grid gap-3 border-y border-slate-200 py-5 lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:items-center">
          <p className="text-[10px] font-black uppercase tracking-[.16em] text-slate-500">
            Faixa de preço
          </p>
          <div className="flex flex-wrap gap-2">
            {quickRanges.map((range) => {
              const active =
                minimumPrice === range.min && maximumPrice === range.max;
              return (
                <button
                  key={range.label}
                  onClick={() => applyQuickRange(range.min, range.max)}
                  className="h-9 rounded-full border px-3 text-[10px] font-bold transition-colors"
                  style={
                    active
                      ? {
                          backgroundColor: accent,
                          borderColor: accent,
                          color: "white",
                        }
                      : { borderColor: "#e2e8f0", color: "#475569" }
                  }
                >
                  {range.label}
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-2">
            <label className="sr-only" htmlFor="price-from">
              Valor mínimo
            </label>
            <input
              id="price-from"
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              value={minimumPrice}
              onChange={(event) => setMinimumPrice(event.target.value)}
              placeholder={`De ${money(lowestPrice)}`}
              className="h-10 min-w-0 w-28 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium outline-none focus:border-slate-400"
            />
            <span className="text-xs text-slate-400">até</span>
            <label className="sr-only" htmlFor="price-to">
              Valor máximo
            </label>
            <input
              id="price-to"
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              value={maximumPrice}
              onChange={(event) => setMaximumPrice(event.target.value)}
              placeholder={`Até ${money(highestPrice)}`}
              className="h-10 min-w-0 w-28 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium outline-none focus:border-slate-400"
            />
          </div>
        </div>
        {(selectedCategory || hasPriceFilter) && (
          <div className="mt-5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            {selectedCategory && (
              <span>
                Categoria:{" "}
                {
                  categories.find(
                    (category) => category.id === selectedCategory,
                  )?.name
                }
              </span>
            )}
            {hasPriceFilter && (
              <span>
                Preço:{" "}
                {minimumPrice
                  ? money(Number(minimumPrice))
                  : money(lowestPrice)}{" "}
                até {maximumPrice ? money(Number(maximumPrice)) : "sem limite"}
              </span>
            )}
            <button
              onClick={() => {
                setCategory(null);
                setMinimumPrice("");
                setMaximumPrice("");
              }}
              className="inline-flex items-center gap-1 font-semibold"
              style={{ color: accent }}
            >
              <X size={13} /> Limpar filtros
            </button>
          </div>
        )}
        <section className="mt-8 grid grid-cols-2 gap-x-3 gap-y-8 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {activeProducts.map((product) => {
            const image =
              (Array.isArray(product.images) && product.images[0]) ||
              product.image_url;
            const currentPrice = Number(
              product.discount_price || product.price,
            );
            return (
              <article key={product.id} className="group min-w-0">
                <div className="relative aspect-[4/5] overflow-hidden rounded-xl border border-slate-200 bg-white">
                  {image ? (
                    <Link to={path(`/produto/${productRouteSegment(product)}`)}>
                      <img
                        src={image}
                        alt={product.name}
                        className="h-full w-full object-contain p-3 transition-transform duration-300 group-hover:scale-105"
                      />
                    </Link>
                  ) : (
                    <div className="grid h-full place-items-center text-slate-300">
                      <ShoppingBag />
                    </div>
                  )}
                  {product.discount_price && (
                    <span
                      className="absolute left-3 top-3 rounded-md px-2 py-1 text-[9px] font-bold text-white"
                      style={{ backgroundColor: accent }}
                    >
                      Oferta
                    </span>
                  )}
                  <button
                    onClick={() => toggleWishlist(product.id)}
                    className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full bg-white shadow-sm"
                  >
                    <Heart
                      size={15}
                      fill={wishlist.includes(product.id) ? accent : "none"}
                      style={{ color: accent }}
                    />
                  </button>
                  <button
                    onClick={() => addToCart(product)}
                    className="absolute bottom-3 left-3 right-3 h-10 rounded-lg text-[10px] font-bold uppercase tracking-[.12em] text-white opacity-0 transition-opacity group-hover:opacity-100"
                    style={{ backgroundColor: accent }}
                  >
                    Adicionar
                  </button>
                </div>
                <Link
                  to={path(`/produto/${productRouteSegment(product)}`)}
                  className="mt-3 block"
                >
                  <p className="line-clamp-2 text-xs font-semibold leading-relaxed">
                    {product.name}
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <strong className="text-sm" style={{ color: accent }}>
                      {money(currentPrice)}
                    </strong>
                    {product.discount_price && (
                      <span className="text-[10px] text-slate-400 line-through">
                        {money(Number(product.price))}
                      </span>
                    )}
                  </div>
                </Link>
              </article>
            );
          })}
        </section>
        {activeProducts.length === 0 && (
          <div className="grid min-h-72 place-items-center text-center">
            <div>
              <ShoppingBag className="mx-auto mb-3 text-slate-300" size={34} />
              <p className="font-semibold">Nenhum produto encontrado</p>
              <button
                onClick={() => {
                  setQuery("");
                  setCategory(null);
                }}
                className="mt-3 text-sm font-semibold"
                style={{ color: accent }}
              >
                Limpar filtros
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
