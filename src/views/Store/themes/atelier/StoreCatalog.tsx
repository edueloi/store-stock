import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import Card from "./Card";
import { useCatalogList, useUsedCategories, type SortKey } from "./kit";
import "./styles.css";

export default function StoreCatalog() {
  const c = useCatalogList(12);
  const cats = useUsedCategories();
  const { tenant, sf, hidden, active } = c;
  const [text, setText] = useState(c.q);
  useEffect(() => setText(c.q), [c.q]);

  const title = sf.catalog_title || "A coleção";
  const desc = sf.catalog_description || "";
  const current = cats.find((x) => x.id === c.category);

  return (
    <main className="atl-page">
      <StoreSEO
        title={`${current ? `${current.name} — ` : ""}${title} — ${tenant.name}`}
        description={desc || `Coleção ${tenant.name}`}
        url={typeof window !== "undefined" ? window.location.href : ""}
        siteName={tenant.name}
      />
      <header className="atl-wrap atl-cat-hero">
        <span className="atl-kicker">Coleção</span>
        <h1>{current?.name || title}</h1>
        {desc && !current && <p>{desc}</p>}
      </header>

      <div className="atl-wrap">
        <div className="atl-filterbar">
          {cats.length > 0 && (
            <div className="atl-chips" role="group" aria-label="Categorias">
              <button type="button" className={!c.category ? "is-on" : ""} aria-pressed={!c.category} onClick={() => c.update({ categoria: null })}>Tudo <small>{active.length}</small></button>
              {cats.map((x) => (
                <button key={x.id} type="button" className={c.category === x.id ? "is-on" : ""} aria-pressed={c.category === x.id} onClick={() => c.update({ categoria: String(x.id) })}>
                  {x.name} <small>{x.count}</small>
                </button>
              ))}
            </div>
          )}
          <div className="atl-tools">
            <form className="atl-find" role="search" onSubmit={(e) => { e.preventDefault(); c.update({ q: text.trim() || null }); }}>
              <Search size={17} strokeWidth={1.5} aria-hidden="true" />
              <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Buscar peça" aria-label="Buscar peça" />
            </form>
            <label className="atl-select">
              <span className="atl-sr">Ordenar por</span>
              <select value={c.sort} onChange={(e) => c.setSort(e.target.value as SortKey)}>
                <option value="destaques">Destaques</option>
                <option value="nome">Nome (A–Z)</option>
                {!hidden && <option value="menor">Menor preço</option>}
                {!hidden && <option value="maior">Maior preço</option>}
              </select>
            </label>
          </div>
        </div>
      </div>

      <section className="atl-wrap atl-results">
        <p className="atl-count" aria-live="polite">{c.list.length} {c.list.length === 1 ? "peça" : "peças"}</p>
        {c.list.length ? (
          <>
            <div className="atl-grid">{c.shown.map((p) => <Card key={p.id} product={p} />)}</div>
            {c.hasMore && <div className="atl-center"><button type="button" className="atl-btn atl-btn-ghost" onClick={c.more}>Ver mais peças</button></div>}
          </>
        ) : (
          <div className="atl-none">
            <h2>Nada por aqui</h2>
            <p>Nenhuma peça corresponde à busca.</p>
            <button type="button" className="atl-btn" onClick={() => { setText(""); c.update({ q: null, categoria: null }); }}>Limpar filtros</button>
          </div>
        )}
      </section>
    </main>
  );
}
