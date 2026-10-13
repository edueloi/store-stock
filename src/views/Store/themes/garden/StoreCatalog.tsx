import { Search, X } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import { useCatalog, useKit } from "./kit";
import { Empty, Leaf, Masonry } from "./parts";

export default function StoreCatalog() {
  const { tenant, categories, active, config, hidden } = useKit();
  const { q, cat, sort, setParam, list, shown, hasMore, more, clear } = useCatalog(16);
  const current = categories.find((c) => String(c.id) === cat);
  return (
    <div className="garden-page garden-page-pad">
      <StoreSEO title={`${config.catalog_title || "Catálogo"} - ${tenant.name}`} description={config.catalog_description || "Seu próximo cultivo"} image={tenant.banner_url || tenant.logo_url} url={typeof window !== "undefined" ? window.location.href : ""} siteName={tenant.name} />
      <div className="garden-wrap">
        <header className="garden-cat-head">
          <div>
            <span className="garden-eyebrow"><Leaf size={18} /> {current ? "Coleção" : "Todas as coleções"}</span>
            <h1 className="garden-title">{current ? current.name : config.catalog_title || "Seu próximo cultivo"}</h1>
          </div>
          <p>{config.catalog_description || "Sementes, ferramentas e detalhes para cultivar seus espaços."}</p>
        </header>
        <div className="garden-toolbar" role="search">
          <div className="garden-f">
            <Search size={18} aria-hidden />
            <label className="garden-sr" htmlFor="garden-q">Buscar no catálogo</label>
            <input id="garden-q" type="search" value={q} onChange={(e) => setParam("q", e.target.value)} placeholder="Buscar no jardim" />
            {q && <button className="garden-x" aria-label="Limpar busca" onClick={() => setParam("q", "")}><X size={18} /></button>}
          </div>
          <label className="garden-sr" htmlFor="garden-sort">Ordenar</label>
          <select id="garden-sort" value={sort} onChange={(e) => setParam("sort", e.target.value === "featured" ? "" : e.target.value)}>
            <option value="featured">Destaques primeiro</option>
            <option value="name">Nome (A-Z)</option>
            {!hidden && <option value="price_up">Menor preço</option>}
            {!hidden && <option value="price_down">Maior preço</option>}
          </select>
          <div className="garden-leafchips" role="group" aria-label="Coleções">
            <button aria-pressed={!cat} onClick={() => setParam("cat", "")}>Tudo</button>
            {categories.map((c) => <button key={c.id} aria-pressed={cat === String(c.id)} onClick={() => setParam("cat", String(c.id))}>{c.name}</button>)}
          </div>
        </div>
        <p className="garden-count" role="status">{list.length} {list.length === 1 ? "produto encontrado" : "produtos encontrados"}</p>
        {list.length ? (
          <>
            <Masonry products={shown} three />
            {hasMore && <div className="garden-more"><button className="garden-btn is-ink" onClick={more}>Ver mais</button></div>}
          </>
        ) : (
          <Empty
            title={active.length ? "Nada brotou por aqui" : "O jardim está sendo preparado"}
            text={active.length ? "Tente outro termo ou escolha outra coleção." : "Os produtos da loja aparecerão aqui em breve."}
            action={active.length ? <button className="garden-btn" style={{ marginTop: 14 }} onClick={clear}>Limpar filtros</button> : undefined}
          />
        )}
      </div>
    </div>
  );
}
