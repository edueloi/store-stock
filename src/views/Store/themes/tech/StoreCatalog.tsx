import { useEffect, useMemo, useState } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import SearchBar from "../../../../components/layout/SearchBar";
import { StoreButton } from "../../../../components/store/StoreButton";
import { filterProducts, useCatalogParams, useShop } from "./kit";
import { Empty, TechCard } from "./parts";
import "./styles.css";

const PAGE = 12;

export default function StoreCatalog() {
  const { tenant, categories, active, hidden, config } = useShop();
  const { q, cat, sort, set } = useCatalogParams();
  const [limit, setLimit] = useState(PAGE);
  const [panel, setPanel] = useState(false);
  useEffect(() => setLimit(PAGE), [q, cat, sort]);
  const list = useMemo(() => filterProducts(active, q, cat, sort, hidden), [active, q, cat, sort, hidden]);
  const title = config.catalog_title || "Catálogo";
  const desc = config.catalog_description || "Encontre eletrônicos e acessórios para conectar trabalho, casa e diversão.";
  const sorts: [string, string][] = [
    ["featured", "Destaques"],
    ["name", "Nome A–Z"],
    ...(!hidden ? ([["price_up", "Menor preço"], ["price_down", "Maior preço"]] as [string, string][]) : []),
  ];
  const withProducts = categories.filter((c) => active.some((p) => p.category_id === c.id));
  const current = withProducts.find((c) => String(c.id) === cat);

  const filters = (
    <>
      <h2 className="tp-side-title">Categorias</h2>
      <div className="tp-side-list" role="group" aria-label="Filtrar por categoria">
        <button type="button" aria-pressed={!cat} onClick={() => { set("categoria", ""); setPanel(false); }}>
          Todos <small>{active.length}</small>
        </button>
        {withProducts.map((c) => (
          <button key={c.id} type="button" aria-pressed={cat === String(c.id)} onClick={() => { set("categoria", String(c.id)); setPanel(false); }}>
            {c.name} <small>{active.filter((p) => p.category_id === c.id).length}</small>
          </button>
        ))}
      </div>
    </>
  );

  return (
    <div className="tp-scope tp-page">
      <StoreSEO title={`${title} | ${tenant.name}`} description={desc} siteName={tenant.name} url={typeof window !== "undefined" ? window.location.href : ""} />
      <div className="tp-wrap">
        <header className="tp-cat-top">
          <span className="tp-kicker">Catálogo</span>
          <h1>{current ? current.name : title}</h1>
          <p>{desc}</p>
        </header>

        <div className="tp-catalog">
          <aside className="tp-side" aria-label="Filtros">{filters}</aside>

          <div className="tp-main">
            <div className="tp-toolbar">
              <SearchBar className="tp-sbar" value={q} onChange={(v) => set("q", v)} placeholder="Nome ou código do produto" />
              <button type="button" className="tp-filter-btn" onClick={() => setPanel(true)}>
                <SlidersHorizontal size={17} /> Categorias
              </button>
              <label className="tp-sort">
                <span className="tp-sr">Ordenar por</span>
                <select value={sort} onChange={(e) => set("sort", e.target.value === "featured" ? "" : e.target.value)}>
                  {sorts.map(([v, label]) => (
                    <option key={v} value={v}>{label}</option>
                  ))}
                </select>
              </label>
            </div>

            <p className="tp-count" role="status">
              {list.length} {list.length === 1 ? "produto" : "produtos"}
              {q ? ` para “${q}”` : ""}
            </p>

            {list.length ? (
              <>
                <div className="tp-grid">
                  {list.slice(0, limit).map((p) => (
                    <TechCard key={p.id} product={p} />
                  ))}
                </div>
                {limit < list.length && (
                  <div className="tp-more">
                    <StoreButton variant="outline" onClick={() => setLimit((l) => l + PAGE)}>
                      Mostrar mais ({list.length - limit})
                    </StoreButton>
                  </div>
                )}
              </>
            ) : (
              <Empty
                title={active.length ? "Nenhum resultado" : "Catálogo vazio"}
                text={active.length ? "Tente outro termo ou remova os filtros." : "Ainda não há produtos publicados nesta loja."}
              />
            )}
          </div>
        </div>
      </div>

      {panel && (
        <div className="tp-sheet-wrap" role="dialog" aria-modal="true" aria-label="Categorias">
          <button type="button" className="tp-scrim" aria-label="Fechar" onClick={() => setPanel(false)} />
          <div className="tp-sheet-panel">
            <button type="button" className="tp-sheet-close" aria-label="Fechar" onClick={() => setPanel(false)}>
              <X size={20} />
            </button>
            {filters}
          </div>
        </div>
      )}
    </div>
  );
}
