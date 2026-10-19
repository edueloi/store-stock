import { useState } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import { useCatalog } from "../street/kit";
import { Empty, ProductCard, SortSelect } from "../street/shared";
import "./styles.css";

export default function StoreCatalog() {
  const c = useCatalog(12);
  const [open, setOpen] = useState(false);
  const { tenant, sf, categories, active, hidden } = c;
  const title = sf.catalog_title || "Coleção completa";
  const desc = sf.catalog_description || "";
  const current = categories.find((x) => x.id === c.cat);
  const used = categories.filter((x) => active.some((p) => p.category_id === x.id));
  const pick = (id: number | null) => {
    c.setParam("categoria", id ? String(id) : null);
    setOpen(false);
  };
  return (
    <div className="sr-page sr-catalog">
      <StoreSEO
        title={`${current ? `${current.name} | ` : ""}${title} | ${tenant.name}`}
        description={desc || title}
        image={tenant.banner_url || tenant.logo_url}
        url={typeof window !== "undefined" ? window.location.href : ""}
        siteName={tenant.name}
      />
      <header className="sr-cat-head">
        <h1>{current ? current.name : title}</h1>
        <span>{c.list.length} {c.list.length === 1 ? "peça" : "peças"}</span>
        <button type="button" className="sr-filter-btn" onClick={() => setOpen(true)}>
          <SlidersHorizontal size={18} /> Filtros
        </button>
      </header>
      {desc && <p className="sr-cat-desc">{desc}</p>}

      <div className="sr-layout">
        {open && <button type="button" className="sr-sheet-bg" aria-label="Fechar filtros" onClick={() => setOpen(false)} />}
        <aside className={`sr-filters ${open ? "is-open" : ""}`} aria-label="Filtros">
          <div className="sr-filters-top">
            <strong>Filtros</strong>
            <button type="button" aria-label="Fechar filtros" onClick={() => setOpen(false)}>
              <X size={20} />
            </button>
          </div>
          <label className="sr-find">
            <Search size={17} aria-hidden="true" />
            <input type="search" value={c.q} onChange={(e) => c.setParam("q", e.target.value)} placeholder="Buscar" aria-label="Buscar no catálogo" />
          </label>
          <div className="sr-filter-group">
            <h2>Categorias</h2>
            <button type="button" aria-pressed={!c.cat} onClick={() => pick(null)}>
              Todas <small>{active.length}</small>
            </button>
            {used.map((cat) => (
              <button key={cat.id} type="button" aria-pressed={c.cat === cat.id} onClick={() => pick(cat.id)}>
                {cat.name} <small>{active.filter((p) => p.category_id === cat.id).length}</small>
              </button>
            ))}
          </div>
          <div className="sr-filter-group">
            <h2>Ordenar</h2>
            <SortSelect t="sr" sort={c.sort} hidden={hidden} onChange={(v) => c.setParam("sort", v)} />
          </div>
        </aside>

        <div className="sr-results" role="status" aria-live="polite">
          {c.list.length ? (
            <>
              <div className="sr-grid">
                {c.shown.map((p) => (
                  <ProductCard key={p.id} product={p} t="sr" fab />
                ))}
              </div>
              {c.hasMore && (
                <div className="sr-more">
                  <button type="button" className="sr-btn sr-btn-solid sr-btn-lg" onClick={c.more}>
                    Ver mais peças
                  </button>
                  <span>
                    {c.shown.length} de {c.list.length}
                  </span>
                </div>
              )}
            </>
          ) : (
            <Empty t="sr" title={active.length ? "Nenhuma peça encontrada" : "Coleção em breve"} text={active.length ? "Tente outro termo ou limpe os filtros." : "Estamos preparando as peças."} onClear={active.length ? c.clear : undefined} />
          )}
        </div>
      </div>
    </div>
  );
}
