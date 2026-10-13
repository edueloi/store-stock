import { Link } from "react-router-dom";
import { Search, SlidersHorizontal, X } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import { useCatalog } from "./kit";
import { Cloud, GiftCard, tintOf } from "./parts";
import "./styles.css";

export default function StoreCatalog() {
  const { tenant, categories, active, sf, q, cat, sort, setParam, list, shown, more, hasMore, path } = useCatalog(12);
  const title = sf.catalog_title || "Pequenas descobertas";
  const description = sf.catalog_description || "Explore nossa coleção e encontre seus favoritos.";
  const catList = categories.filter(c => active.some(p => p.category_id === c.id));
  return <main className="bb-root bb-v2">
    <StoreSEO title={`${title} — ${tenant.name}`} description={description}
      url={typeof window !== "undefined" ? window.location.href : ""} siteName={tenant.name} />
    <section className="bb-page-head bb-v2-page-head">
      <p className="bb-kicker">Nosso catálogo</p>
      <h1 className="bb-script">{title}</h1>
      <p className="bb-lead">{description}</p>
    </section>
    <section className="bb-toolbar bb-v2-toolbar" aria-label="Buscar e filtrar produtos">
      <div className="bb-v2-filters-heading"><SlidersHorizontal size={18} aria-hidden="true" /><strong>Encontre seu favorito</strong></div>
      <div className="bb-tools">
        <label className="bb-field">
          <Search size={17} aria-hidden="true" /><span className="bb-sr">Buscar produto</span>
          <input type="search" value={q} placeholder="Nome, descrição ou referência" onChange={e => setParam("q", e.target.value || null)} />
          {q && <button type="button" aria-label="Limpar busca" onClick={() => setParam("q", null)}><X size={16} /></button>}
        </label>
        <label className="bb-field bb-select"><span className="bb-sr">Ordenar por</span>
          <select value={sort} onChange={e => setParam("sort", e.target.value === "featured" ? null : e.target.value)}>
            <option value="featured">Destaques primeiro</option><option value="menor">Menor preço</option>
            <option value="maior">Maior preço</option><option value="nome">Nome (A–Z)</option>
          </select>
        </label>
      </div>
      <div className="bb-chips" role="group" aria-label="Filtrar categoria">
        <button type="button" className={`bb-chip bb-t4 ${!cat ? "is-on" : ""}`} aria-pressed={!cat} onClick={() => setParam("cat", null)}>Todos</button>
        {catList.map((c,i) => <button type="button" key={c.id} className={`bb-chip ${tintOf(i)} ${cat === c.id ? "is-on" : ""}`} aria-pressed={cat === c.id} onClick={() => setParam("cat", String(c.id))}>{c.name}</button>)}
      </div>
    </section>
    <p className="bb-count" role="status">{list.length} {list.length === 1 ? "produto encontrado" : "produtos encontrados"}</p>
    {list.length === 0 ? <div className="bb-empty"><Cloud className="bb-empty-cloud" />
      <p>{active.length === 0 ? "Ainda não há produtos disponíveis." : "Nenhum produto corresponde à sua busca."}</p>
      {active.length > 0 && <Link to={path("/catalogo")} className="bb-btn bb-btn-soft">Ver todo o catálogo</Link>}
    </div> : <div className="bb-grid bb-v2-catalog-grid">{shown.map((p,i) => <GiftCard key={p.id} product={p} index={i} />)}</div>}
    {hasMore && <div className="bb-center"><button type="button" className="bb-btn bb-btn-main" onClick={more}>Carregar mais produtos</button></div>}
  </main>;
}
