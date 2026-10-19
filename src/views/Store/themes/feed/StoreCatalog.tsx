import { Search, X } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import { StoreButton } from "../../../../components/store/StoreButton";
import { useCatalog, useKit } from "./kit";
import { useShelves } from "./extras";
import { Card, Empty } from "./parts";

export default function StoreCatalog() {
  const { tenant, active, config, hidden } = useKit();
  const shelves = useShelves();
  const { q, cat, sort, setParam, list, shown, hasMore, more, clear } = useCatalog(12);
  const current = shelves.find((c) => String(c.id) === cat);
  return (
    <div className="feed-page">
      <StoreSEO title={`${config.catalog_title || "Produtos"} - ${tenant.name}`} description={config.catalog_description || "Rações e nutrição"} image={tenant.banner_url || tenant.logo_url} url={typeof window !== "undefined" ? window.location.href : ""} siteName={tenant.name} />
      <div className="feed-wrap">
        <header className="feed-cat-head">
          <h1>{current ? current.name : config.catalog_title || "Todos os produtos"}</h1>
          <p>{config.catalog_description || "Escolha por animal, fase ou tipo de alimento."}</p>
        </header>
        <section className="feed-filters" aria-label="Filtros">
          <div className="feed-filters-top">
            <label className="feed-input">
              <Search size={17} aria-hidden="true" />
              <input value={q} onChange={(e) => setParam("q", e.target.value)} placeholder="Buscar produto ou marca" aria-label="Buscar no catálogo" />
              {q && <button type="button" aria-label="Limpar busca" onClick={() => setParam("q", "")}><X size={15} /></button>}
            </label>
            <label className="feed-input feed-select">
              <span className="feed-sr">Ordenar por</span>
              <select value={sort} onChange={(e) => setParam("sort", e.target.value)}>
                <option value="featured">Destaques</option>
                <option value="name">Nome (A-Z)</option>
                {!hidden && <option value="price_up">Menor preço</option>}
                {!hidden && <option value="price_down">Maior preço</option>}
              </select>
            </label>
          </div>
          <div className="feed-chips" role="group" aria-label="Animal ou linha">
            <button type="button" aria-pressed={!cat} onClick={() => setParam("cat", "")}>Todos <b>{active.length}</b></button>
            {shelves.map((c) => (
              <button key={c.id} type="button" aria-pressed={String(c.id) === cat} onClick={() => setParam("cat", String(c.id))}>
                {c.name} <b>{c.count}</b>
              </button>
            ))}
          </div>
        </section>
        <p className="feed-count" role="status">{list.length} {list.length === 1 ? "produto" : "produtos"}</p>
        {shown.length ? (
          <>
            <div className="feed-grid">{shown.map((p) => <Card key={p.id} product={p} />)}</div>
            {hasMore && (
              <div className="feed-more">
                <StoreButton variant="outline" className="feed-ghost" onClick={more}>Mostrar mais</StoreButton>
              </div>
            )}
          </>
        ) : (
          <Empty title="Nenhum produto encontrado" text="Tente outra palavra ou escolha outra linha." action={<StoreButton className="feed-cta" onClick={clear}>Limpar filtros</StoreButton>} />
        )}
      </div>
    </div>
  );
}
