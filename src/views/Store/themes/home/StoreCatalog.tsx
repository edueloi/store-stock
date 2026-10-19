import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import Card from "./Card";
import { useCatalogList, useUsedCategories, type SortKey } from "./kit";
import "./styles.css";

export default function StoreCatalog() {
  const c = useCatalogList(12);
  const rooms = useUsedCategories();
  const { tenant, sf, hidden, active } = c;
  const [text, setText] = useState(c.q);
  useEffect(() => setText(c.q), [c.q]);

  const title = sf.catalog_title || "Tudo para a sua casa";
  const desc = sf.catalog_description || "Navegue pelos cômodos e encontre a peça certa.";
  const current = rooms.find((x) => x.id === c.category);

  return (
    <main className="hm-page">
      <StoreSEO
        title={`${current ? `${current.name} — ` : ""}${title} — ${tenant.name}`}
        description={desc}
        url={typeof window !== "undefined" ? window.location.href : ""}
        siteName={tenant.name}
      />
      <header className="hm-wrap hm-cat-hero">
        <span className="hm-eyebrow">Catálogo</span>
        <h1>{current?.name || title}</h1>
        <p>{desc}</p>
      </header>

      <div className="hm-wrap hm-cat-layout">
        {rooms.length > 0 && (
          <aside className="hm-side" aria-label="Cômodos">
            <details className="hm-side-box" open>
              <summary>Cômodos</summary>
              <nav>
                <button type="button" className={!c.category ? "is-on" : ""} aria-pressed={!c.category} onClick={() => c.update({ categoria: null })}>
                  <span>Todos</span> <small>{active.length}</small>
                </button>
                {rooms.map((x) => (
                  <button key={x.id} type="button" className={c.category === x.id ? "is-on" : ""} aria-pressed={c.category === x.id} onClick={() => c.update({ categoria: String(x.id) })}>
                    <span>{x.name}</span> <small>{x.count}</small>
                  </button>
                ))}
              </nav>
            </details>
          </aside>
        )}

        <section className="hm-results">
          <div className="hm-toolbar">
            <form className="hm-search hm-search-wide" role="search" onSubmit={(e) => { e.preventDefault(); c.update({ q: text.trim() || null }); }}>
              <Search size={17} aria-hidden="true" />
              <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Buscar produto" aria-label="Buscar produto" />
            </form>
            <label className="hm-select">
              <span className="hm-sr">Ordenar por</span>
              <select value={c.sort} onChange={(e) => c.setSort(e.target.value as SortKey)}>
                <option value="destaques">Destaques</option>
                <option value="nome">Nome (A–Z)</option>
                {!hidden && <option value="menor">Menor preço</option>}
                {!hidden && <option value="maior">Maior preço</option>}
              </select>
            </label>
          </div>
          <p className="hm-count" aria-live="polite">{c.list.length} {c.list.length === 1 ? "peça" : "peças"}</p>
          {c.list.length ? (
            <>
              <div className="hm-grid">{c.shown.map((p) => <Card key={p.id} product={p} />)}</div>
              {c.hasMore && (
                <div className="hm-center">
                  <button type="button" className="hm-btn hm-btn-soft" onClick={c.more}>Mostrar mais</button>
                </div>
              )}
            </>
          ) : (
            <div className="hm-none">
              <p>Nenhuma peça encontrada por aqui.</p>
              <button type="button" className="hm-btn" onClick={() => { setText(""); c.update({ q: null, categoria: null }); }}>Limpar filtros</button>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
