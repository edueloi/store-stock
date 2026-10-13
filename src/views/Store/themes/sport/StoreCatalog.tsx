import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ChevronDown, Plus } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import SearchBar from "../../../../components/layout/SearchBar";
import Card from "./Card";
import { norm, priceOf, useKit } from "./lib";
import "./styles.css";

const PAGE = 12;

export default function StoreCatalog() {
  const { tenant, active, categories, sf, countIn } = useKit();
  const [params, setParams] = useSearchParams();
  const q = params.get("q") || "";
  const cat = params.get("cat") || params.get("categoria") || "";
  const sort = params.get("sort") || "featured";
  const [limit, setLimit] = useState(PAGE);
  const [filters, setFilters] = useState(false);
  useEffect(() => setLimit(PAGE), [q, cat, sort]);

  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (key === "cat") next.delete("categoria");
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: key === "q" });
  };

  const visible = useMemo(() => {
    const term = norm(q.trim());
    const list = active.filter(
      (p) => (!cat || String(p.category_id) === cat) && (!term || norm(`${p.name} ${p.sku || ""} ${p.description || ""}`).includes(term)),
    );
    const by = (fn: (a: (typeof list)[number], b: (typeof list)[number]) => number) => [...list].sort(fn);
    if (sort === "menor") return by((a, b) => priceOf(a).price - priceOf(b).price);
    if (sort === "maior") return by((a, b) => priceOf(b).price - priceOf(a).price);
    if (sort === "nome") return by((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    if (sort === "ofertas") return by((a, b) => Number(priceOf(b).off) - Number(priceOf(a).off));
    return by((a, b) => Number(b.is_featured) - Number(a.is_featured));
  }, [active, q, cat, sort]);

  const catName = categories.find((c) => String(c.id) === cat)?.name;
  const hidden = sf.hide_prices === true || sf.checkout_mode === "order_request";
  const title = sf.catalog_title || "Catálogo";

  return (
    <main className="sport-root">
      <StoreSEO
        title={`${catName || title} | ${tenant.name}`}
        description={sf.catalog_description || tenant.about_text || `Produtos da ${tenant.name}.`}
        url={typeof window !== "undefined" ? window.location.href : ""}
        siteName={tenant.name}
      />
      <section className="sport-cat-hero">
        <div className="sport-wrap">
          <span className="sport-kicker">{sf.segment_label || "Todos os produtos"}</span>
          <h1 className="sport-h">{catName || title}</h1>
          <p>{sf.catalog_description || "Filtre por categoria, ordene por preço e encontre o equipamento certo."}</p>
        </div>
      </section>

      <div className="sport-wrap">
        <div className="sport-layout">
          <aside className="sport-side" aria-label="Filtros">
            <button className="sport-filter-toggle" aria-expanded={filters} onClick={() => setFilters((v) => !v)}>
              <span>Categorias{catName ? `: ${catName}` : ""}</span>
              <ChevronDown size={20} style={{ transform: filters ? "rotate(180deg)" : undefined }} />
            </button>
            <h3>Categorias</h3>
            <ul className={`sport-filter-list${filters ? " is-open" : ""}`}>
              <li>
                <button aria-pressed={!cat} onClick={() => { update("cat", ""); setFilters(false); }}>
                  Todos <em>{active.length}</em>
                </button>
              </li>
              {categories.filter((c) => countIn(c.id) > 0).map((c) => (
                <li key={c.id}>
                  <button aria-pressed={cat === String(c.id)} onClick={() => { update("cat", String(c.id)); setFilters(false); }}>
                    {c.name} <em>{countIn(c.id)}</em>
                  </button>
                </li>
              ))}
            </ul>
          </aside>

          <section aria-live="polite">
            <div className="sport-tools">
              <div className="sport-tsearch">
                <SearchBar value={q} onChange={(v) => update("q", v)} placeholder="Buscar por nome ou código" />
              </div>
              <label className="sport-sr" htmlFor="sport-sort">Ordenar</label>
              <select id="sport-sort" className="sport-select" value={sort} onChange={(e) => update("sort", e.target.value === "featured" ? "" : e.target.value)}>
                <option value="featured">Destaques</option>
                {!hidden && <option value="menor">Menor preço</option>}
                {!hidden && <option value="maior">Maior preço</option>}
                <option value="ofertas">Ofertas primeiro</option>
                <option value="nome">Nome (A-Z)</option>
              </select>
            </div>
            <p className="sport-count">
              {visible.length} {visible.length === 1 ? "produto" : "produtos"}
              {q && ` para "${q}"`}
            </p>
            {visible.length ? (
              <>
                <div className="sport-grid sport-grid--3">
                  {visible.slice(0, limit).map((p) => (
                    <Card key={p.id} product={p} />
                  ))}
                </div>
                {limit < visible.length && (
                  <div className="sport-more">
                    <button className="sport-btn sport-btn--dark" onClick={() => setLimit((l) => l + PAGE)}>
                      <Plus size={18} /> Ver mais ({visible.length - limit})
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="sport-empty">
                <h3 className="sport-h">Nada em campo</h3>
                <p>Nenhum produto encontrado. Tente outro termo ou limpe os filtros.</p>
                <button className="sport-btn" style={{ marginTop: 16 }} onClick={() => setParams(params.get("previewTheme") ? { previewTheme: params.get("previewTheme") as string } : {})}>
                  Limpar filtros
                </button>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
