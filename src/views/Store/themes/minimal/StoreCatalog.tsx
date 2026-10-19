import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import Card from "./Card";
import { useCatalogList, useUsedCategories, type SortKey } from "./kit";
import "./styles.css";

export default function StoreCatalog() {
  const c = useCatalogList(16);
  const cats = useUsedCategories();
  const { tenant, sf, hidden } = c;
  const [text, setText] = useState(c.q);
  useEffect(() => setText(c.q), [c.q]);

  const title = sf.catalog_title || "Catálogo";
  const desc = sf.catalog_description || "";
  const current = cats.find((x) => x.id === c.category);

  return (
    <main className="mn-page">
      <StoreSEO
        title={`${current ? `${current.name} — ` : ""}${title} — ${tenant.name}`}
        description={desc || `Catálogo de ${tenant.name}`}
        url={typeof window !== "undefined" ? window.location.href : ""}
        siteName={tenant.name}
      />
      <section className="mn-wrap mn-cat-head">
        <h1>{current?.name || title}</h1>
        {desc && !current && <p className="mn-muted">{desc}</p>}
      </section>

      <div className="mn-wrap">
        <div className="mn-toolbar">
          <form
            className="mn-search mn-search-wide"
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              c.update({ q: text.trim() || null });
            }}
          >
            <Search size={16} aria-hidden="true" />
            <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Buscar produto" aria-label="Buscar produto" />
          </form>
          <label className="mn-select">
            <span className="mn-sr">Ordenar por</span>
            <select value={c.sort} onChange={(e) => c.setSort(e.target.value as SortKey)}>
              <option value="destaques">Destaques</option>
              <option value="nome">Nome (A–Z)</option>
              {!hidden && <option value="menor">Menor preço</option>}
              {!hidden && <option value="maior">Maior preço</option>}
            </select>
          </label>
        </div>
        {cats.length > 0 && (
          <nav className="mn-tabs" aria-label="Categorias">
            <button type="button" className={!c.category ? "is-on" : ""} aria-pressed={!c.category} onClick={() => c.update({ categoria: null })}>
              Tudo
            </button>
            {cats.map((x) => (
              <button key={x.id} type="button" className={c.category === x.id ? "is-on" : ""} aria-pressed={c.category === x.id} onClick={() => c.update({ categoria: String(x.id) })}>
                {x.name}
              </button>
            ))}
          </nav>
        )}
      </div>

      <section className="mn-wrap mn-section mn-tight">
        <p className="mn-muted mn-count-line" aria-live="polite">
          {c.list.length} {c.list.length === 1 ? "produto" : "produtos"}
        </p>
        {c.list.length ? (
          <>
            <div className="mn-grid">
              {c.shown.map((p) => (
                <Card key={p.id} product={p} />
              ))}
            </div>
            {c.hasMore && (
              <div className="mn-more">
                <button type="button" className="mn-btn mn-btn-line" onClick={c.more}>
                  Mostrar mais
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="mn-none">
            <p>Nenhum produto encontrado.</p>
            <button
              type="button"
              className="mn-btn"
              onClick={() => {
                setText("");
                c.update({ q: null, categoria: null });
              }}
            >
              Limpar filtros
            </button>
          </div>
        )}
      </section>
    </main>
  );
}
