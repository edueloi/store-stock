import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ListFilter, Search, X } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import { VarietyEmpty, VarietyProductCard, useVariety } from "./ThemeParts";
import "./styles.css";

type Sort = "relevance" | "price-asc" | "price-desc" | "name";

const unitPrice = (p: { price: number; discount_price?: number | null }) => Number(p.discount_price || p.price);

export default function StoreCatalog() {
  const { tenant, active, usedCategories } = useVariety();
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState(params.get("q") || "");
  const [sort, setSort] = useState<Sort>("relevance");
  const rawCategory = params.get("cat") ?? params.get("categoria");
  const categoryId = rawCategory && /^\d+$/.test(rawCategory) ? Number(rawCategory) : null;
  const activeCategory = usedCategories.find((c) => c.id === categoryId);

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    const list = active.filter(
      (p) => (!categoryId || p.category_id === categoryId) && (!term || `${p.name} ${p.description || ""}`.toLowerCase().includes(term)),
    );
    if (sort === "price-asc") return [...list].sort((a, b) => unitPrice(a) - unitPrice(b));
    if (sort === "price-desc") return [...list].sort((a, b) => unitPrice(b) - unitPrice(a));
    if (sort === "name") return [...list].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    return list;
  }, [active, categoryId, query, sort]);

  const select = (id: number | null) => {
    const next = new URLSearchParams(params);
    if (id) next.set("cat", String(id));
    else next.delete("cat");
    setParams(next);
  };

  const countOf = (id: number) => active.filter((p) => p.category_id === id).length;

  const categoryList = (
    <ul className="variety-filter-list">
      <li>
        <button type="button" aria-pressed={!categoryId} onClick={() => select(null)}>
          Todos os produtos <small>{active.length}</small>
        </button>
      </li>
      {usedCategories.map((c) => (
        <li key={c.id}>
          <button type="button" aria-pressed={categoryId === c.id} onClick={() => select(c.id)}>
            {c.name} <small>{countOf(c.id)}</small>
          </button>
        </li>
      ))}
    </ul>
  );

  return (
    <main className="variety-page">
      <StoreSEO
        title={`Catálogo | ${tenant.name}`}
        description={`Produtos e ofertas da ${tenant.name}.`}
        image={tenant.banner_url || tenant.logo_url}
        url={typeof window !== "undefined" ? window.location.href : ""}
        siteName={tenant.name}
      />
      <div className="variety-wrap variety-block">
        <header className="variety-page-head">
          <span className="variety-eyebrow">Catálogo completo</span>
          <h1>{activeCategory?.name || "Encontre de tudo em um só lugar"}</h1>
        </header>

        <div className="variety-catalog">
          <aside className="variety-sidebar" aria-label="Filtros">
            <details className="variety-filter-box" open>
              <summary><ListFilter size={16} /> Departamentos</summary>
              {categoryList}
            </details>
          </aside>

          <div className="variety-results">
            <div className="variety-toolbar">
              <label className="variety-field variety-field-search">
                <Search size={16} aria-hidden="true" />
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="O que você procura?" aria-label="Buscar no catálogo" />
                {query && (
                  <button type="button" onClick={() => setQuery("")} aria-label="Limpar busca"><X size={15} /></button>
                )}
              </label>
              <label className="variety-field variety-field-sort">
                <span className="variety-sr">Ordenar</span>
                <select value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
                  <option value="relevance">Mais relevantes</option>
                  <option value="price-asc">Menor preço</option>
                  <option value="price-desc">Maior preço</option>
                  <option value="name">Nome (A-Z)</option>
                </select>
              </label>
            </div>
            <p className="variety-count">{visible.length} {visible.length === 1 ? "produto encontrado" : "produtos encontrados"}</p>
            {visible.length ? (
              <div className="variety-grid variety-grid-3">
                {visible.map((p) => <VarietyProductCard key={p.id} product={p} />)}
              </div>
            ) : (
              <VarietyEmpty onClear={() => { select(null); setQuery(""); }} />
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
