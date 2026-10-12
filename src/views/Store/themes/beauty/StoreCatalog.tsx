import { useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Search, X } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import { useStore } from "../../StoreLayout";
import { buildStorePath, resolveStoreSlug } from "../../store-routing";
import { BeautyCard, beautyHide } from "./ThemeParts";

export default function StoreCatalog() {
  const { slug: routeSlug } = useParams();
  const [params, setParams] = useSearchParams();
  const { tenant, products, categories, addToCart, wishlist, toggleWishlist } = useStore();
  const slug = resolveStoreSlug(routeSlug);
  const path = (suffix = "") => buildStorePath(slug, suffix);
  const [query, setQuery] = useState(params.get("q") || "");
  const categoryId = params.get("cat") ? Number(params.get("cat")) : null;
  const visible = useMemo(() => products.filter((product) => product.is_active && (!categoryId || product.category_id === categoryId) && (!query || `${product.name} ${product.description || ""}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()))), [products, categoryId, query]);
  const selectCategory = (id: number | null) => { const next = new URLSearchParams(params); if (id) next.set("cat", String(id)); else next.delete("cat"); setParams(next); };
  const title = categories.find((category) => category.id === categoryId)?.name || "Todos os produtos";

  return <main className="min-h-screen bg-white pb-16 text-[#393532]">
    <StoreSEO title={`Produtos | ${tenant.name}`} description={`Cosméticos e cuidados disponíveis na ${tenant.name}.`} image={tenant.banner_url || tenant.logo_url} url={typeof window !== "undefined" ? window.location.href : ""} siteName={tenant.name}/>
    <section className="border-b border-[#e7ded8] bg-[#f5f3f1]"><div className="mx-auto max-w-6xl px-5 py-12 sm:px-8"><p className="text-[10px] font-semibold uppercase tracking-[.22em] text-[#9a674a]">Beauty Studio</p><h1 className="mt-3 text-4xl font-light tracking-[-.05em] sm:text-5xl">Cuidado em cada escolha.</h1><p className="mt-3 max-w-xl text-sm leading-relaxed text-[#716963]">Encontre produtos para transformar sua rotina em um ritual de bem-estar.</p></div></section>
    <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8"><div className="flex gap-2 overflow-x-auto pb-2">{[{ id: null, name: "Todos" }, ...categories].map((category) => <button key={category.id ?? "all"} onClick={() => selectCategory(category.id)} className={`shrink-0 border px-4 py-2 text-xs transition ${categoryId === category.id ? "border-[#a96845] bg-[#a96845] text-white" : "border-[#ded7d2] bg-white text-[#514c48] hover:border-[#b98261]"}`}>{category.name}</button>)}</div><div className="mt-7 flex flex-col justify-between gap-5 border-b border-[#d7cbc3] pb-4 sm:flex-row sm:items-end"><div><p className="text-[10px] uppercase tracking-[.18em] text-[#9a674a]">Coleção</p><h2 className="mt-2 text-2xl font-light">{title}</h2></div><div className="relative w-full sm:w-72"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9a8f88]"/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar na coleção" className="h-11 w-full border border-[#ded7d2] bg-white pl-10 pr-9 text-sm outline-none focus:border-[#a96845]"/>{query && <button onClick={() => setQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9a8f88]"><X size={16}/></button>}</div></div><p className="mt-4 text-xs text-[#81766f]">{visible.length} {visible.length === 1 ? "produto encontrado" : "produtos encontrados"}</p><div className="mt-6 grid gap-x-4 gap-y-9 sm:grid-cols-2 lg:grid-cols-4">{visible.map((product) => <BeautyCard key={product.id} product={product} path={path} category={categories.find((category) => category.id === product.category_id)?.name} saved={wishlist.includes(product.id)} onFavorite={() => toggleWishlist(product.id)} onAdd={() => addToCart(product)} hidePrices={beautyHide(tenant)}/>)}</div>{!visible.length && <div className="py-20 text-center text-sm text-[#716963]">Nenhum produto encontrado com esses filtros.</div>}</div>
  </main>;
}
