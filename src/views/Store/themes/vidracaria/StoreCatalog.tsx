import { useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { ArrowRight, Search, X } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import { useStore } from "../../StoreLayout";
import { buildStorePath, resolveStoreSlug } from "../../store-routing";
import { VitraProductCard, VitraEmpty, vitraHidePrices } from "./ThemeParts";

export default function StoreCatalog() {
  const { slug: routeSlug } = useParams();
  const { tenant, products, categories } = useStore();
  const path = (suffix = "") => buildStorePath(resolveStoreSlug(routeSlug), suffix);
  const [params, setParams] = useSearchParams(), [sort, setSort] = useState("featured");
  const query = params.get("q") || "", category = Number(params.get("cat")) || null;
  const sf = tenant.policies?.storefront || {};
  const setFilter = (key: string, value: string) => { const next = new URLSearchParams(params); if (value) next.set(key, value); else next.delete(key); setParams(next, { replace: true }); };
  const lines = categories.filter(c => products.some(p => p.is_active && p.category_id === c.id));
  const visible = useMemo(() => products.filter(p => p.is_active && (!category || p.category_id === category) && `${p.name} ${p.description || ""}`.toLocaleLowerCase("pt-BR").includes(query.toLocaleLowerCase("pt-BR"))).sort((a,b) => sort === "name" ? a.name.localeCompare(b.name, "pt-BR") : sort === "recent" ? b.id - a.id : Number(b.is_featured) - Number(a.is_featured)), [products, category, query, sort]);
  return <main className="vitra-root vitra-catalog-page">
    <StoreSEO title={`Catálogo | ${tenant.name}`} description={sf.catalog_description || `Conheça os produtos e as soluções de ${tenant.name}.`} siteName={tenant.name}/>
    <section className="vitra-catalog-intro vitra-container"><span className="vitra-eyebrow">Selecione. Conheça. Imagine.</span><h1>{sf.catalog_title || "Soluções para o seu espaço."}</h1>{sf.catalog_description && <p>{sf.catalog_description}</p>}<div className="vitra-catalog-intro-bottom"><p>Fotos, detalhes e opções de cada produto.<br/>Encontre aqui o que faz parte do seu projeto.</p>{sf.glass_quote_enabled === true && <Link className="vitra-btn-primary" to={path("/orcamento")}>Montar meu orçamento <ArrowRight size={16}/></Link>}</div></section>
    <div className="vitra-container vitra-catalog-layout"><aside className="vitra-catalog-filters"><h2>Categorias</h2><button type="button" className={!category ? "active" : ""} onClick={() => setFilter("cat", "")}>Todos os produtos <span>{products.filter(p => p.is_active).length}</span></button>{lines.map(c => <button type="button" key={c.id} className={category === c.id ? "active" : ""} onClick={() => setFilter("cat", String(c.id))}>{c.name}<span>{products.filter(p => p.is_active && p.category_id === c.id).length}</span></button>)}{(category || query) && <button type="button" className="vitra-clear-filter" onClick={() => setParams({})}><X size={13}/>Limpar filtros</button>}</aside><section className="vitra-catalog-results"><div className="vitra-catalog-toolbar"><label className="vitra-project-search"><Search size={17}/><input aria-label="Buscar produtos" value={query} onChange={e => setFilter("q", e.target.value)} placeholder="O que você procura?"/></label><label className="vitra-catalog-sort">Ordenar<select value={sort} onChange={e => setSort(e.target.value)}><option value="featured">Destaques</option><option value="name">Nome A–Z</option><option value="recent">Mais recentes</option></select></label></div><p className="vitra-result-count">{visible.length} {visible.length === 1 ? "produto encontrado" : "produtos encontrados"}{category ? ` em ${categories.find(c => c.id === category)?.name || "categoria"}` : ""}</p>{visible.length ? <div className="vitra-catalog-products">{visible.map(p => <VitraProductCard key={p.id} product={p} category={categories.find(c => c.id === p.category_id)?.name} path={path} hidePrices={vitraHidePrices(tenant)} quoteEnabled={sf.glass_quote_enabled === true}/>)}</div> : <VitraEmpty onClear={() => setParams({})}/>}</section></div>
  </main>;
}
