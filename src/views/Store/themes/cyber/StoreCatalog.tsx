import { useEffect, useMemo, useState } from "react";
import StoreSEO from "../../../../components/store/StoreSEO";
import SearchBar from "../../../../components/layout/SearchBar";
import { StoreButton } from "../../../../components/store/StoreButton";
import { filterProducts, useCatalogParams, useShop } from "./kit";
import { Empty, NeonCard } from "./parts";
import "./styles.css";

const PAGE = 12;

export default function StoreCatalog() {
  const { tenant, categories, active, hidden, config } = useShop();
  const { q, cat, sort, set } = useCatalogParams();
  const [limit, setLimit] = useState(PAGE);
  useEffect(() => setLimit(PAGE), [q, cat, sort]);
  const list = useMemo(() => filterProducts(active, q, cat, sort, hidden), [active, q, cat, sort, hidden]);
  const title = config.catalog_title || "Catálogo";
  const desc = config.catalog_description || "Produtos, acessórios e novidades para montar seu espaço.";
  const withProducts = categories.filter((c) => active.some((p) => p.category_id === c.id));

  return (
    <div className="cy-scope cy-page">
      <StoreSEO title={`${title} | ${tenant.name}`} description={desc} siteName={tenant.name} url={typeof window !== "undefined" ? window.location.href : ""} />
      <div className="cy-wrap">
        <header className="cy-cat-top">
          <span className="cy-tag">Catálogo</span>
          <h1>{title}</h1>
          <p>{desc}</p>
        </header>

        <div className="cy-console">
          <div className="cy-console-row">
            <SearchBar className="cy-sbar" value={q} onChange={(v) => set("q", v)} placeholder="Nome ou código do produto" />
            <label>
              <span className="cy-sr">Ordenação</span>
              <select className="cy-select" value={sort} onChange={(e) => set("sort", e.target.value)}>
                <option value="featured">Destaques</option>
                <option value="name">Nome A–Z</option>
                {!hidden && <option value="price_up">Menor preço</option>}
                {!hidden && <option value="price_down">Maior preço</option>}
              </select>
            </label>
          </div>
          <div className="cy-flags" role="group" aria-label="Filtrar por categoria">
            <button type="button" className="cy-flag-btn" aria-pressed={!cat} onClick={() => set("categoria", "")}>Todos <small>{active.length}</small></button>
            {withProducts.map((c) => (
              <button key={c.id} type="button" className="cy-flag-btn" aria-pressed={cat === String(c.id)} onClick={() => set("categoria", String(c.id))}>
                {c.name} <small>{active.filter((p) => p.category_id === c.id).length}</small>
              </button>
            ))}
          </div>
        </div>

        <p className="cy-count" role="status"><b>{list.length}</b> {list.length === 1 ? "resultado" : "resultados"}{q ? <> para “{q}”</> : null}</p>

        {list.length ? (
          <>
            <div className="cy-grid is-4">{list.slice(0, limit).map((p) => <NeonCard key={p.id} product={p} />)}</div>
            {limit < list.length && (
              <div className="cy-more">
                <StoreButton variant="outline" className="cy-cta-line" onClick={() => setLimit((l) => l + PAGE)}>Carregar mais ({list.length - limit})</StoreButton>
              </div>
            )}
          </>
        ) : (
          <Empty
            title={active.length ? "Nenhum resultado" : "Catálogo vazio"}
            text={active.length ? "Tente outro termo ou limpe o filtro de categoria." : "Ainda não há produtos publicados nesta loja."}
          />
        )}
      </div>
    </div>
  );
}
