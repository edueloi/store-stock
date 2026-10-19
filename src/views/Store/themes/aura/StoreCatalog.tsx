import { useEffect, useMemo, useState } from "react";
import StoreSEO from "../../../../components/store/StoreSEO";
import SearchBar from "../../../../components/layout/SearchBar";
import { StoreButton } from "../../../../components/store/StoreButton";
import { filterProducts, useCatalogParams, useShop } from "./kit";
import { Empty, SoftCard } from "./parts";
import "./styles.css";

const PAGE = 12;

export default function StoreCatalog() {
  const { tenant, categories, active, hidden, config } = useShop();
  const { q, cat, sort, set } = useCatalogParams();
  const [limit, setLimit] = useState(PAGE);
  useEffect(() => setLimit(PAGE), [q, cat, sort]);
  const list = useMemo(() => filterProducts(active, q, cat, sort, hidden), [active, q, cat, sort, hidden]);
  const title = config.catalog_title || "Toda a coleção";
  const desc = config.catalog_description || "Peças escolhidas com carinho para o seu dia a dia.";
  const withProducts = categories.filter((c) => active.some((p) => p.category_id === c.id));
  const sorts: [string, string][] = [
    ["featured", "Destaques"],
    ["name", "A–Z"],
    ...(!hidden ? ([["price_up", "Menor preço"], ["price_down", "Maior preço"]] as [string, string][]) : []),
  ];

  return (
    <div className="au-scope au-page">
      <StoreSEO title={`${title} | ${tenant.name}`} description={desc} siteName={tenant.name} url={typeof window !== "undefined" ? window.location.href : ""} />
      <div className="au-wrap">
        <header className="au-cat-top">
          <span className="au-kicker">Catálogo</span>
          <h1>{title}</h1>
          <p>{desc}</p>
        </header>

        <div className="au-filter">
          <SearchBar className="au-sbar" value={q} onChange={(v) => set("q", v)} placeholder="Buscar por nome ou código" />
          <div className="au-filter-block">
            <p className="au-filter-title">Categorias</p>
            <div className="au-chips" role="group" aria-label="Filtrar por categoria">
              <button type="button" aria-pressed={!cat} onClick={() => set("categoria", "")}>Tudo</button>
              {withProducts.map((c) => (
                <button key={c.id} type="button" aria-pressed={cat === String(c.id)} onClick={() => set("categoria", String(c.id))}>{c.name}</button>
              ))}
            </div>
          </div>
          <div className="au-filter-block">
            <p className="au-filter-title">Ordenar</p>
            <div className="au-chips" role="group" aria-label="Ordenar por">
              {sorts.map(([v, label]) => (
                <button key={v} type="button" aria-pressed={sort === v} onClick={() => set("sort", v === "featured" ? "" : v)}>{label}</button>
              ))}
            </div>
          </div>
        </div>

        <p className="au-count" role="status">{list.length} {list.length === 1 ? "peça" : "peças"}{q ? ` para “${q}”` : ""}</p>

        {list.length ? (
          <>
            <div className="au-grid">{list.slice(0, limit).map((p) => <SoftCard key={p.id} product={p} />)}</div>
            {limit < list.length && (
              <div className="au-more">
                <StoreButton variant="outline" className="au-cta-line" onClick={() => setLimit((l) => l + PAGE)}>Ver mais ({list.length - limit})</StoreButton>
              </div>
            )}
          </>
        ) : (
          <Empty
            title={active.length ? "Nada por aqui" : "Catálogo vazio"}
            text={active.length ? "Tente outro termo ou limpe os filtros." : "Ainda não há produtos publicados nesta loja."}
          />
        )}
      </div>
    </div>
  );
}
