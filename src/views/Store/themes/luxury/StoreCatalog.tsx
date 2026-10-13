import { useEffect, useMemo, useState } from "react";
import StoreSEO from "../../../../components/store/StoreSEO";
import SearchBar from "../../../../components/layout/SearchBar";
import { filterProducts, useCatalogParams, useShop } from "./kit";
import { Empty, Piece } from "./parts";
import "./styles.css";

const PAGE = 9;

export default function StoreCatalog() {
  const { tenant, categories, active, hidden, config } = useShop();
  const { q, cat, sort, set } = useCatalogParams();
  const [limit, setLimit] = useState(PAGE);
  useEffect(() => setLimit(PAGE), [q, cat, sort]);
  const list = useMemo(() => filterProducts(active, q, cat, sort, hidden), [active, q, cat, sort, hidden]);
  const title = config.catalog_title || "A coleção";
  const desc = config.catalog_description || "Descubra uma seleção para marcar seus momentos.";

  return (
    <div className="lx-scope lx-page">
      <StoreSEO title={`${title} | ${tenant.name}`} description={desc} siteName={tenant.name} url={typeof window !== "undefined" ? window.location.href : ""} />
      <div className="lx-wrap">
        <header className="lx-cat-head">
          <span className="lx-eyebrow">{config.segment_label || "Joias & Seleções Especiais"}</span>
          <h1>{title}</h1>
          <div className="lx-rule"><span /></div>
          <p>{desc}</p>
        </header>

        <div className="lx-filters" role="group" aria-label="Filtrar por categoria">
          <button type="button" className="lx-filter" aria-pressed={!cat} onClick={() => set("categoria", "")}>Todas</button>
          {categories.map((c) => (
            <button key={c.id} type="button" className="lx-filter" aria-pressed={cat === String(c.id)} onClick={() => set("categoria", String(c.id))}>{c.name}</button>
          ))}
        </div>
        <div className="lx-tools">
          <SearchBar className="lx-sbar" value={q} onChange={(v) => set("q", v)} placeholder="Nome ou código da peça" />
          <span className="lx-count" role="status">{list.length} {list.length === 1 ? "peça" : "peças"}</span>
          <label>
            <span className="lx-sr">Ordenação</span>
            <select className="lx-select" value={sort} onChange={(e) => set("sort", e.target.value)}>
              <option value="featured">Em destaque</option>
              <option value="name">Nome, A a Z</option>
              {!hidden && <option value="price_up">Menor valor</option>}
              {!hidden && <option value="price_down">Maior valor</option>}
            </select>
          </label>
        </div>

        {list.length ? (
          <>
            <div className="lx-grid is-3">{list.slice(0, limit).map((p) => <Piece key={p.id} product={p} />)}</div>
            {limit < list.length && (
              <div className="lx-more"><button type="button" className="lx-btn" onClick={() => setLimit((l) => l + PAGE)}>Ver mais peças</button></div>
            )}
          </>
        ) : (
          <Empty
            title={active.length ? "Nenhuma peça encontrada" : "Coleção em preparação"}
            text={active.length ? "Experimente outro termo ou escolha outra categoria." : "Ainda não há peças publicadas nesta loja."}
          />
        )}
      </div>
    </div>
  );
}
