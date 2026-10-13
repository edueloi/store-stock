import { Search, X } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import { useCatalog, useKit } from "./kit";
import { Card, Empty, Grain, Shelf } from "./parts";

export default function StoreCatalog() {
  const { tenant, categories, active, config, hidden, path } = useKit();
  const { q, cat, sort, setParam, list, shown, hasMore, more, clear } = useCatalog(12);
  const current = categories.find((c) => String(c.id) === cat);
  const browsing = !q && !cat && sort === "featured";
  const byShelf = categories.map((c) => ({ c, items: active.filter((p) => p.category_id === c.id) })).filter((s) => s.items.length);
  const loose = active.filter((p) => !categories.some((c) => c.id === p.category_id));
  return (
    <div className="feed-page feed-page-pad">
      <StoreSEO title={`${config.catalog_title || "Catálogo"} - ${tenant.name}`} description={config.catalog_description || "Alimentação e cuidado para os seus animais."} image={tenant.banner_url || tenant.logo_url} url={typeof window !== "undefined" ? window.location.href : ""} siteName={tenant.name} />
      <div className="feed-wrap">
        <header className="feed-cat-head">
          <span className="feed-sign">{current ? current.name : "Corredor geral"}</span>
          <h1>{config.catalog_title || "Alimentação e cuidado"}</h1>
          <p>{config.catalog_description || "Passeie pelas prateleiras e encontre o que seu bichinho precisa."}</p>
        </header>
        <div className="feed-aisle-tabs" role="group" aria-label="Categorias">
          <button aria-pressed={!cat} onClick={() => setParam("cat", "")}>Todas as prateleiras</button>
          {categories.map((c) => <button key={c.id} aria-pressed={cat === String(c.id)} onClick={() => setParam("cat", String(c.id))}><Grain size={14} /> {c.name}</button>)}
        </div>
        <div className="feed-finder" role="search">
          <div className="feed-f">
            <Search size={18} aria-hidden />
            <label className="feed-sr" htmlFor="feed-q">Buscar no catálogo</label>
            <input id="feed-q" type="search" value={q} onChange={(e) => setParam("q", e.target.value)} placeholder="Buscar produto" />
            {q && <button className="feed-x" aria-label="Limpar busca" onClick={() => setParam("q", "")}><X size={18} /></button>}
          </div>
          <label className="feed-sr" htmlFor="feed-sort">Ordenar</label>
          <select id="feed-sort" value={sort} onChange={(e) => setParam("sort", e.target.value === "featured" ? "" : e.target.value)}>
            <option value="featured">Destaques primeiro</option>
            <option value="name">Nome (A-Z)</option>
            {!hidden && <option value="price_up">Menor preço</option>}
            {!hidden && <option value="price_down">Maior preço</option>}
          </select>
        </div>

        {browsing && active.length > 0 ? (
          <div style={{ paddingTop: 20 }}>
            {byShelf.map(({ c, items }) => <Shelf key={c.id} title={c.name} kicker="Prateleira" to={path("/catalogo", { cat: String(c.id) })} products={items.slice(0, 10)} />)}
            {loose.length > 0 && <Shelf title="Outros produtos" products={loose.slice(0, 10)} />}
          </div>
        ) : (
          <>
            <p className="feed-count" role="status">{list.length} {list.length === 1 ? "produto na prateleira" : "produtos nas prateleiras"}</p>
            {list.length ? (
              <>
                <div className="feed-grid">{shown.map((p) => <Card key={p.id} product={p} />)}</div>
                {hasMore && <div className="feed-more"><button className="feed-btn is-dark" onClick={more}>Ver mais produtos</button></div>}
              </>
            ) : (
              <Empty
                title={active.length ? "Nada por aqui" : "Prateleiras vazias"}
                text={active.length ? "Tente outro termo ou escolha outra categoria." : "Os produtos da loja aparecerão aqui em breve."}
                action={active.length ? <button className="feed-btn" style={{ marginTop: 14 }} onClick={clear}>Limpar filtros</button> : undefined}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
