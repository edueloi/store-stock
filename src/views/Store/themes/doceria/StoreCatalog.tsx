import { useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { CakeSlice, Heart, Search, SlidersHorizontal, X } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import { useStore } from "../../StoreLayout";
import { buildStorePath, productRouteSegment, resolveStoreSlug } from "../../store-routing";

const imageOf = (product: { image_url?: string | null; images?: unknown }) =>
  (Array.isArray(product.images) && typeof product.images[0] === "string" ? product.images[0] : product.image_url) || null;
const money = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function StoreCatalog() {
  const { slug: routeSlug } = useParams();
  const [params, setParams] = useSearchParams();
  const { tenant, products, categories, addToCart, wishlist, toggleWishlist } = useStore();
  const isMadeToOrder = tenant.policies?.storefront?.checkout_mode === "order_request";
  const hidePrices = isMadeToOrder || tenant.policies?.storefront?.hide_prices === true;
  const slug = resolveStoreSlug(routeSlug);
  const [query, setQuery] = useState(params.get("q") || "");
  const [range, setRange] = useState<[number, number] | null>(null);
  const categoryId = params.get("cat") ? Number(params.get("cat")) : null;
  const path = (suffix = "") => buildStorePath(slug, suffix);
  const setCategory = (id: number | null) => {
    const next = new URLSearchParams(params);
    if (id) next.set("cat", String(id)); else next.delete("cat");
    setParams(next);
  };
  const visible = useMemo(() => products.filter((product) => product.is_active).filter((product) =>
    (!categoryId || product.category_id === categoryId) &&
    (!query || product.name.toLowerCase().includes(query.toLowerCase())) &&
    (hidePrices || !range || (Number(product.discount_price || product.price) >= range[0] && Number(product.discount_price || product.price) < range[1]))
  ), [products, categoryId, query, range, hidePrices]);
  const selectedName = categories.find((category) => category.id === categoryId)?.name;
  const ranges: [string, number, number][] = [["Até R$ 50", 0, 50], ["R$ 50 a R$ 100", 50, 100], ["R$ 100 a R$ 200", 100, 200], ["Acima de R$ 200", 200, Infinity]];

  return <main className="min-h-screen bg-[#f7f6ed] text-[#4d371d]">
    <StoreSEO title={`Cardápio | ${tenant.name}`} description={`Cardápio de doces e encomendas da ${tenant.name}.`} image={tenant.banner_url || tenant.logo_url} url={typeof window !== "undefined" ? window.location.href : ""} siteName={tenant.name} keywords={`${tenant.name}, doceria, cardápio, doces, bolos, encomendas`} />
    <section className="border-b border-[#9e282c] bg-[#bd3437] text-white">
      <div className="mx-auto max-w-7xl px-5 py-12 md:px-8 md:py-16">
        <p className="text-[10px] font-extrabold uppercase tracking-[.22em] text-pink-200">Cardápio da casa</p>
        <div className="mt-3 flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div><h1 className="font-[Cormorant_Garamond] text-5xl font-bold tracking-[-.05em] md:text-7xl">Escolha a sua<br /><em className="font-normal text-pink-300">doçura.</em></h1><p className="mt-4 max-w-lg text-sm leading-relaxed text-pink-100">Cada pedido é preparado com cuidado. Selecione seus favoritos e envie a solicitação para confirmarmos os detalhes.</p></div>
          <div className="rounded-2xl border border-white/20 bg-white/10 px-5 py-4 text-sm"><strong className="block text-pink-200">Produção por encomenda</strong><span className="mt-1 block text-xs text-pink-100">Valores e disponibilidade confirmados no atendimento.</span></div>
        </div>
      </div>
    </section>
    <div className="mx-auto grid max-w-7xl gap-8 px-5 py-10 md:px-8 lg:grid-cols-[235px_minmax(0,1fr)]">
      <aside className="lg:sticky lg:top-24 lg:self-start"><div className="rounded-3xl border border-pink-100 bg-white p-4 shadow-sm"><p className="mb-3 flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[.18em] text-pink-500"><SlidersHorizontal size={13} /> Navegue por sabor</p><button onClick={() => setCategory(null)} className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm font-bold ${!categoryId ? "bg-pink-600 text-white" : "text-[#71485a] hover:bg-pink-50"}`}><span>Todos os doces</span><span>{products.filter((product) => product.is_active).length}</span></button>{categories.map((category) => { const count = products.filter((product) => product.is_active && product.category_id === category.id).length; return <button key={category.id} onClick={() => setCategory(category.id)} className={`mt-1 flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm font-semibold ${categoryId === category.id ? "bg-pink-600 text-white" : "text-[#71485a] hover:bg-pink-50"}`}><span className="truncate">{category.name}</span><span className="text-xs opacity-75">{count}</span></button>; })}{!hidePrices && <div className="mt-5 border-t border-pink-100 pt-4"><p className="mb-2 text-[10px] font-extrabold uppercase tracking-[.18em] text-pink-500">Faixa de valor</p>{ranges.map(([label, min, max]) => { const count = products.filter((product) => product.is_active && Number(product.discount_price || product.price) >= min && Number(product.discount_price || product.price) < max).length; if (!count) return null; const selected = range?.[0] === min && range?.[1] === max; return <button key={label} onClick={() => setRange(selected ? null : [min, max])} className={`flex w-full items-center justify-between py-2 text-left text-xs ${selected ? "font-extrabold text-pink-600" : "text-[#805d6c] hover:text-pink-600"}`}><span>{label}</span><span>{count}</span></button>; })}</div>}</div></aside>
      <section><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-[10px] font-extrabold uppercase tracking-[.18em] text-pink-500">{selectedName || "Todos os sabores"}</p><p className="mt-1 text-sm text-[#805d6c]">{visible.length} {visible.length === 1 ? "opção encontrada" : "opções encontradas"}</p></div><div className="relative w-full sm:max-w-sm"><Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-pink-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar no cardápio" className="h-12 w-full rounded-full border border-pink-100 bg-white pl-11 pr-10 text-sm outline-none transition focus:border-pink-400 focus:ring-4 focus:ring-pink-100" />{query && <button onClick={() => setQuery("")} className="absolute right-4 top-1/2 -translate-y-1/2 text-pink-400"><X size={15} /></button>}</div></div>
        {visible.length ? <div className="mt-7 grid gap-x-4 gap-y-7 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">{visible.map((product) => <ProductCard key={product.id} product={product} categoryName={categories.find((category) => category.id === product.category_id)?.name || "Doceria"} saved={wishlist.includes(product.id)} onFavorite={() => toggleWishlist(product.id)} onAdd={() => addToCart(product)} path={path} hidePrices={hidePrices} />)}</div> : <EmptyState onClear={() => { setCategory(null); setRange(null); setQuery(""); }} />}</section>
    </div>
  </main>;
}

function ProductCard({ product, categoryName, saved, onFavorite, onAdd, path, hidePrices }: { product: any; categoryName: string; saved: boolean; onFavorite: () => void; onAdd: () => void; path: (suffix: string) => string; hidePrices: boolean }) {
  const price = Number(product.discount_price || product.price);
  return (
    <article className="group flex gap-3 rounded-xl bg-white p-2.5 shadow-sm ring-1 ring-pink-100 sm:block sm:rounded-2xl sm:p-3">
      <Link to={path(`/produto/${productRouteSegment(product)}`)} className="relative grid h-[116px] w-[116px] shrink-0 place-items-center overflow-hidden rounded-lg bg-pink-50 p-2 sm:h-56 sm:w-auto sm:rounded-xl sm:p-3 2xl:h-60">
        {imageOf(product) ? <img src={imageOf(product)!} alt={product.name} className="block h-full w-full object-contain transition duration-500 group-hover:scale-[1.03]" /> : <div className="grid h-full w-full place-items-center text-pink-300"><CakeSlice size={32} /></div>}
        {product.is_featured && <span className="absolute left-2 top-2 hidden rounded-full bg-white px-2 py-1 text-[8px] font-extrabold uppercase tracking-wider text-pink-600 sm:block">Mais pedido</span>}
      </Link>
      <div className="flex min-w-0 flex-1 flex-col py-1 sm:block sm:px-1 sm:pt-3">
        <p className="text-[8px] font-extrabold uppercase tracking-[.17em] text-pink-500 sm:text-[9px]">{categoryName}</p>
        <div className="mt-1 flex items-start justify-between gap-2">
          <Link to={path(`/produto/${productRouteSegment(product)}`)} className="line-clamp-2 text-[14px] font-extrabold leading-snug text-[#4a2135] hover:text-pink-600 sm:text-[15px]">{product.name}</Link>
          <button aria-label="Favoritar" onClick={onFavorite} className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border sm:h-8 sm:w-8 ${saved ? "border-pink-500 bg-pink-500 text-white" : "border-pink-100 bg-white text-pink-400"}`}><Heart size={14} fill={saved ? "currentColor" : "none"} /></button>
        </div>
        {product.description && <p className="mt-2 hidden line-clamp-2 text-[11px] leading-relaxed text-[#805d6c] sm:block">{product.description}</p>}
        <div className="mt-auto flex items-center justify-between gap-2 pt-3 sm:mt-3 sm:pt-0">
          <strong className="text-[9px] font-extrabold uppercase tracking-wide text-pink-600 sm:text-[10px]">{hidePrices ? "Sob encomenda" : money(price)}</strong>
          <button onClick={onAdd} className="rounded-lg bg-[#bd3437] px-3 py-2 text-[8px] font-extrabold uppercase tracking-wider text-white transition hover:bg-[#9f292d] sm:text-[9px]">Adicionar</button>
        </div>
      </div>
    </article>
  );
}

function EmptyState({ onClear }: { onClear: () => void }) {
  return <div className="mt-10 grid min-h-72 place-items-center rounded-[2rem] border border-dashed border-pink-200 bg-white p-8 text-center"><div><CakeSlice size={42} className="mx-auto text-pink-300" /><h2 className="mt-4 text-xl font-extrabold">Nenhuma delícia por aqui</h2><p className="mt-2 text-sm text-[#805d6c]">Tente outro sabor, categoria ou faixa de valor.</p><button onClick={onClear} className="mt-5 rounded-full bg-pink-600 px-5 py-3 text-[10px] font-extrabold uppercase tracking-wider text-white">Limpar filtros</button></div></div>;
}
