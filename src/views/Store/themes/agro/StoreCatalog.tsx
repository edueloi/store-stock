import { Link } from "react-router-dom";
import { Search, X } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import { StoreButton } from "../../../../components/store/StoreButton";
import { useCatalog, useKit } from "./kit";
import { useShelves } from "./extras";
import { Card, Empty } from "./parts";

export default function StoreCatalog() {
  const { tenant, active, config, hidden, path } = useKit();
  const shelves = useShelves();
  const { q, cat, sort, setParam, list, shown, hasMore, more, clear } = useCatalog(12);
  const current = shelves.find((c) => String(c.id) === cat);
  return (
    <div className="agro-page">
      <StoreSEO title={`${config.catalog_title || "Catálogo"} - ${tenant.name}`} description={config.catalog_description || "Tudo para sua propriedade"} image={tenant.banner_url || tenant.logo_url} url={typeof window !== "undefined" ? window.location.href : ""} siteName={tenant.name} />
      <div className="agro-wrap">
        <header className="agro-cat-head">
          <span className="agro-eyebrow">{current ? "Departamento" : "Todos os departamentos"}</span>
          <h1>{current ? current.name : config.catalog_title || "Tudo para sua propriedade"}</h1>
          <p>{config.catalog_description || "Insumos, ferramentas e produtos para o trabalho no campo."}</p>
        </header>
        <div className="agro-cat-layout">
          <aside className="agro-side" aria-label="Departamentos">
            <h2>Departamentos</h2>
            <ul>
              <li>
                <Link to={path("/catalogo")} aria-current={!cat ? "true" : undefined}>
                  Todos <b>{active.length}</b>
                </Link>
              </li>
              {shelves.map((c) => (
                <li key={c.id}>
                  <Link to={path("/catalogo", { cat: String(c.id) })} aria-current={String(c.id) === cat ? "true" : undefined}>
                    {c.name} <b>{c.count}</b>
                  </Link>
                </li>
              ))}
            </ul>
          </aside>
          <div className="agro-cat-main">
            <div className="agro-toolbar">
              <label className="agro-field agro-field-search">
                <Search size={17} aria-hidden="true" />
                <input value={q} onChange={(e) => setParam("q", e.target.value)} placeholder="Buscar neste catálogo" aria-label="Buscar no catálogo" />
                {q && (
                  <button type="button" aria-label="Limpar busca" onClick={() => setParam("q", "")}>
                    <X size={15} />
                  </button>
                )}
              </label>
              <label className="agro-field agro-field-dept">
                <span className="agro-sr">Departamento</span>
                <select value={cat} onChange={(e) => setParam("cat", e.target.value)}>
                  <option value="">Todos os departamentos</option>
                  {shelves.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </label>
              <label className="agro-field">
                <span className="agro-sr">Ordenar por</span>
                <select value={sort} onChange={(e) => setParam("sort", e.target.value)}>
                  <option value="featured">Destaques</option>
                  <option value="name">Nome (A-Z)</option>
                  {!hidden && <option value="price_up">Menor preço</option>}
                  {!hidden && <option value="price_down">Maior preço</option>}
                </select>
              </label>
            </div>
            <p className="agro-count" role="status">{list.length} {list.length === 1 ? "produto encontrado" : "produtos encontrados"}</p>
            {shown.length ? (
              <>
                <div className="agro-grid agro-grid-cat">{shown.map((p) => <Card key={p.id} product={p} />)}</div>
                {hasMore && (
                  <div className="agro-center">
                    <StoreButton variant="outline" className="agro-ghost" onClick={more}>Mostrar mais produtos</StoreButton>
                  </div>
                )}
              </>
            ) : (
              <Empty
                title="Nada por aqui"
                text="Tente outra palavra ou outro departamento."
                action={<StoreButton className="agro-cta" onClick={clear}>Limpar filtros</StoreButton>}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
