import { useEffect, useMemo, useState } from "react";
import StoreSEO from "../../../../components/store/StoreSEO";
import SearchBar from "../../../../components/layout/SearchBar";
import { filterProducts, useCatalogParams, useShop } from "./kit";
import { CircuitCard, Empty } from "./parts";
import "./styles.css";

const PAGE = 12;

export default function StoreCatalog() {
  const { tenant, categories, active, hidden, config } = useShop();
  const { q, cat, sort, set } = useCatalogParams();
  const [limit, setLimit] = useState(PAGE);
  useEffect(() => setLimit(PAGE), [q, cat, sort]);
  const list = useMemo(() => filterProducts(active, q, cat, sort, hidden), [active, q, cat, sort, hidden]);
  const title = config.catalog_title || "Explore seu próximo upgrade";
  const desc = config.catalog_description || "Produtos, acessórios e novidades para montar seu espaço.";

  return (
    <div className="cy-scope cy-page">
      <StoreSEO title={`${title} | ${tenant.name}`} description={desc} siteName={tenant.name} url={typeof window !== "undefined" ? window.location.href : ""} />
      <div className="cy-wrap" style={{ paddingTop: 34 }}>
        <span className="cy-tag">catálogo</span>
        <h1 style={{ fontSize: "clamp(28px,5vw,48px)", color: "#fff", marginTop: 6 }}>{title}</h1>
        <p style={{ color: "var(--cy-dim)", maxWidth: 620, margin: "8px 0 0" }}>{desc}</p>

        <div className="cy-console">
          <div className="cy-console-row">
            <SearchBar className="cy-sbar" value={q} onChange={(v) => set("q", v)} placeholder="> nome ou código do produto" />
            <label>
              <span className="cy-sr">Ordenação</span>
              <select className="cy-select" value={sort} onChange={(e) => set("sort", e.target.value)}>
                <option value="featured">sort: destaques</option>
                <option value="name">sort: nome A–Z</option>
                {!hidden && <option value="price_up">sort: menor preço</option>}
                {!hidden && <option value="price_down">sort: maior preço</option>}
              </select>
            </label>
          </div>
          <div className="cy-flags" role="group" aria-label="Filtrar por categoria">
            <button type="button" className="cy-flag-btn" aria-pressed={!cat} onClick={() => set("categoria", "")}>todos<small>{active.length}</small></button>
            {categories.map((c) => (
              <button key={c.id} type="button" className="cy-flag-btn" aria-pressed={cat === String(c.id)} onClick={() => set("categoria", String(c.id))}>
                {c.name.toLowerCase()}<small>{active.filter((p) => p.category_id === c.id).length}</small>
              </button>
            ))}
          </div>
        </div>

        <p className="cy-count" role="status"><b>{list.length}</b> {list.length === 1 ? "resultado" : "resultados"}{q ? <> para “{q}”</> : null}</p>

        {list.length ? (
          <>
            <div className="cy-grid is-4">
              {list.slice(0, limit).map((p, i) => <CircuitCard key={p.id} product={p} index={i} />)}
            </div>
            {limit < list.length && (
              <div className="cy-more">
                <button type="button" className="cy-btn" onClick={() => setLimit((l) => l + PAGE)}>carregar mais ({list.length - limit})</button>
              </div>
            )}
          </>
        ) : (
          <Empty
            title={active.length ? "nenhum resultado" : "catálogo vazio"}
            text={active.length ? "Tente outro termo ou limpe os filtros de categoria." : "Ainda não há produtos publicados nesta loja."}
          />
        )}
      </div>
    </div>
  );
}
