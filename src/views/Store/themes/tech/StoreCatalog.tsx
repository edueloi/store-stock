import { useEffect, useMemo, useState } from "react";
import { LayoutGrid, List } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import SearchBar from "../../../../components/layout/SearchBar";
import { filterProducts, useCatalogParams, useShop } from "./kit";
import { Empty, TechCard } from "./parts";
import "./styles.css";

const PAGE = 12;

export default function StoreCatalog() {
  const { tenant, categories, active, hidden, config } = useShop();
  const { q, cat, sort, set } = useCatalogParams();
  const [limit, setLimit] = useState(PAGE);
  const [view, setView] = useState<"grid" | "list">("grid");
  useEffect(() => setLimit(PAGE), [q, cat, sort]);
  const list = useMemo(() => filterProducts(active, q, cat, sort, hidden), [active, q, cat, sort, hidden]);
  const title = config.catalog_title || "Seu próximo dispositivo";
  const desc = config.catalog_description || "Encontre eletrônicos e acessórios para conectar trabalho, casa e diversão.";
  const sorts: [string, string][] = [["featured", "Destaques"], ["name", "A–Z"], ...(!hidden ? ([["price_up", "Menor preço"], ["price_down", "Maior preço"]] as [string, string][]) : [])];

  return (
    <div className="tp-scope tp-page">
      <StoreSEO title={`${title} | ${tenant.name}`} description={desc} siteName={tenant.name} url={typeof window !== "undefined" ? window.location.href : ""} />
      <div className="tp-wrap">
        <header className="tp-cat-top">
          <div><span className="tp-kicker">Catálogo</span><h1>{title}</h1><p>{desc}</p></div>
        </header>

        <div className="tp-panel">
          <div className="tp-panel-row">
            <SearchBar className="tp-sbar" value={q} onChange={(v) => set("q", v)} placeholder="Nome ou código do produto" />
            <div className="tp-viewtoggle" role="group" aria-label="Modo de exibição">
              <button type="button" aria-label="Exibir em grade" aria-pressed={view === "grid"} onClick={() => setView("grid")}><LayoutGrid size={18} /></button>
              <button type="button" aria-label="Exibir em lista" aria-pressed={view === "list"} onClick={() => setView("list")}><List size={18} /></button>
            </div>
          </div>
          <div className="tp-chips" role="group" aria-label="Filtrar por categoria">
            <span className="lbl">Filtrar</span>
            <button type="button" className="tp-chip" aria-pressed={!cat} onClick={() => set("categoria", "")}>Tudo <small>{active.length}</small></button>
            {categories.map((c) => (
              <button key={c.id} type="button" className="tp-chip" aria-pressed={cat === String(c.id)} onClick={() => set("categoria", String(c.id))}>
                {c.name} <small>{active.filter((p) => p.category_id === c.id).length}</small>
              </button>
            ))}
          </div>
          <div className="tp-chips" role="group" aria-label="Ordenar por">
            <span className="lbl">Ordenar</span>
            {sorts.map(([v, label]) => <button key={v} type="button" className="tp-chip" aria-pressed={sort === v} onClick={() => set("sort", v === "featured" ? "" : v)}>{label}</button>)}
          </div>
        </div>

        <p className="tp-count" role="status">{list.length} {list.length === 1 ? "produto" : "produtos"}{q ? ` para “${q}”` : ""}</p>

        {list.length ? (
          <>
            <div className={view === "list" ? "tp-list" : "tp-grid is-4"}>
              {list.slice(0, limit).map((p) => <TechCard key={p.id} product={p} />)}
            </div>
            {limit < list.length && (
              <div className="tp-more"><button type="button" className="tp-btn is-ghost" onClick={() => setLimit((l) => l + PAGE)}>Mostrar mais ({list.length - limit})</button></div>
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
  );
}
