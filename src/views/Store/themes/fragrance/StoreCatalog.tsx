import { Link } from "react-router-dom";
import { ArrowRight, Search, SlidersHorizontal, X } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import { useCatalog, useQuickAdd } from "./kit";
import { FragranceEmpty, FragranceProductCard } from "./parts";
import "./styles.css";

export default function StoreCatalog() {
  const { tenant, categories, active, sf, path, q, cat, sort, setParam, clear, list, shown, more, hasMore, wishlist, toggleWishlist, hidden, openCart } = useCatalog(12);
  const quickAdd = useQuickAdd();
  const cats = categories.filter(c => active.some(p => p.category_id === c.id));
  const heading = sf.catalog_title || "Descubra nossa coleção";
  const description = sf.catalog_description || tenant.about_text || "Explore as escolhas da nossa loja e encontre seu próximo favorito.";
  const onAdd = (product: typeof list[number]) => { const action = quickAdd(product); if (!action.soldOut && !action.hasOptions) { action.add(); openCart(); } };
  return <main className="fragrance-page fr-modern">
    <StoreSEO title={`${heading} | ${tenant.name}`} description={description} image={tenant.banner_url || tenant.logo_url} url={typeof window !== "undefined" ? window.location.href : ""} siteName={tenant.name} />
    <section className="fr-catalog-hero"><div className="fr-container">
      <p className="fr-overline">Coleção • {tenant.name}</p><h1>{heading}</h1><p>{description}</p>
    </div></section>
    <div className="fr-container fr-catalog-layout">
      <aside className="fr-filters" aria-label="Categorias"><h2><SlidersHorizontal size={17}/> Categorias</h2>
        <button className={!cat ? "selected" : ""} onClick={() => setParam("categoria", null)}>Todos os produtos <span>{active.length}</span></button>
        {cats.map(c => <button key={c.id} className={cat === c.id ? "selected" : ""} onClick={() => setParam("categoria", String(c.id))}>{c.name}<span>{active.filter(p => p.category_id === c.id).length}</span></button>)}
      </aside>
      <section className="fr-catalog-results">
        <div className="fr-results-heading"><div><p className="fr-overline">Sua seleção</p><h2>{cats.find(c => c.id === cat)?.name || "Todos os produtos"}</h2><p>{list.length} {list.length === 1 ? "produto encontrado" : "produtos encontrados"}</p></div>
          <div className="fr-search-filter"><label><Search size={17}/><input type="search" aria-label="Pesquisar produtos" placeholder="Buscar produto..." value={q} onChange={e=>setParam("q", e.target.value || null)}/>{q && <button aria-label="Limpar busca" onClick={() => setParam("q", null)}><X size={17}/></button>}</label>
          <select aria-label="Ordenar produtos" value={sort} onChange={e=>setParam("sort",e.target.value === "destaques" ? null : e.target.value)}><option value="destaques">Destaques</option>{!hidden && <><option value="menor">Menor preço</option><option value="maior">Maior preço</option></>}<option value="nome">Nome A–Z</option></select></div></div>
        <div className="fr-mobile-cats" aria-label="Filtrar por categoria"><button className={!cat?"selected":""} onClick={()=>setParam("categoria",null)}>Todos</button>{cats.map(c=><button key={c.id} className={cat===c.id?"selected":""} onClick={()=>setParam("categoria",String(c.id))}>{c.name}</button>)}</div>
        {shown.length ? <div className="fr-product-grid">{shown.map((product,index)=><FragranceProductCard key={product.id} product={product} index={index} category={cats.find(c=>c.id===product.category_id)?.name} path={path} saved={wishlist.includes(product.id)} onFavorite={()=>toggleWishlist(product.id)} onAdd={()=>onAdd(product)} hidePrices={hidden}/>)}</div> : <FragranceEmpty onClear={clear}/>}
        {hasMore && <div className="fr-load-more"><button onClick={more}>Carregar mais produtos <ArrowRight size={16}/></button></div>}
        <Link className="fr-text-link" to={path("/sobre")}>Conheça nossa loja <ArrowRight size={15}/></Link>
      </section>
    </div>
  </main>;
}
