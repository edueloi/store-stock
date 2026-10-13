import { Search, X } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import { useCatalog, useKit } from "./kit";
import { Card, Empty } from "./parts";

export default function StoreCatalog() {
  const { tenant, categories, active, config, hidden } = useKit();
  const { q, cat, sort, setParam, list, shown, hasMore, more, clear } = useCatalog(12);
  const countBy = (id: number) => active.filter((p) => p.category_id === id).length;
  const current = categories.find((c) => String(c.id) === cat);
  return (
    <div className="agro-page">
      <StoreSEO title={`${config.catalog_title || "Catálogo"} - ${tenant.name}`} description={config.catalog_description || "Tudo para sua propriedade"} image={tenant.banner_url || tenant.logo_url} url={typeof window !== "undefined" ? window.location.href : ""} siteName={tenant.name} />
      <section className="agro-cat-head">
        <div className="agro-wrap">
          <span className="agro-tag is-gold">{current ? "Departamento" : "Todos os departamentos"}</span>
          <h1>{current ? current.name : config.catalog_title || "Tudo para sua propriedade"}</h1>
          <p>{config.catalog_description || "Ferramentas, insumos e produtos para o trabalho no campo."}</p>
        </div>
      </section>
      <div className="agro-wrap agro-cat-layout">
        <aside className="agro-side" aria-label="Departamentos">
          <h2>Departamentos</h2>
          <button aria-pressed={!cat} onClick={() => setParam("cat", "")}>Todos <small>{active.length}</small></button>
          {categories.map((c) => (
            <button key={c.id} aria-pressed={cat === String(c.id)} onClick={() => setParam("cat", String(c.id))}>{c.name} <small>{countBy(c.id)}</small></button>
          ))}
        </aside>
        <div style={{ minWidth: 0 }}>
          <div className="agro-chips" aria-label="Departamentos">
            <button aria-pressed={!cat} onClick={() => setParam("cat", "")}>Todos</button>
            {categories.map((c) => <button key={c.id} aria-pressed={cat === String(c.id)} onClick={() => setParam("cat", String(c.id))}>{c.name}</button>)}
          </div>
          <div className="agro-toolbar">
            <div className="agro-field" role="search">
              <label className="agro-sr" htmlFor="agro-q">Buscar no catálogo</label>
              <input id="agro-q" type="search" value={q} onChange={(e) => setParam("q", e.target.value)} placeholder="Buscar por nome ou código" />
              <button aria-label={q ? "Limpar busca" : "Buscar"} onClick={() => q && setParam("q", "")}>{q ? <X size={18} /> : <Search size={18} />}</button>
            </div>
            <label className="agro-sr" htmlFor="agro-sort">Ordenar</label>
            <select id="agro-sort" value={sort} onChange={(e) => setParam("sort", e.target.value === "featured" ? "" : e.target.value)}>
              <option value="featured">Destaques primeiro</option>
              <option value="name">Nome (A-Z)</option>
              {!hidden && <option value="price_up">Menor preço</option>}
              {!hidden && <option value="price_down">Maior preço</option>}
            </select>
          </div>
          <p className="agro-count" role="status">{list.length} {list.length === 1 ? "produto encontrado" : "produtos encontrados"}</p>
          {list.length ? (
            <>
              <div className="agro-grid">{shown.map((p) => <Card key={p.id} product={p} />)}</div>
              {hasMore && <div className="agro-more"><button className="agro-btn is-dark" onClick={more}>Ver mais produtos</button></div>}
            </>
          ) : (
            <Empty
              title={active.length ? "Nada encontrado" : "Catálogo em preparação"}
              text={active.length ? "Tente outro termo ou escolha outro departamento." : "Os produtos da loja aparecerão aqui em breve."}
              action={active.length ? <button className="agro-btn" style={{ marginTop: 14 }} onClick={clear}>Limpar filtros</button> : undefined}
            />
          )}
        </div>
      </div>
    </div>
  );
}
