import { useEffect, useMemo, useState } from "react";
import StoreSEO from "../../../../components/store/StoreSEO";
import Card from "./Card";
import { useCatalogQuery, useKit } from "./kit";
import "./styles.css";

const PAGE = 16;

export default function StoreCatalog() {
  const { tenant, categories, active, sf } = useKit();
  const { category, q, update } = useCatalogQuery();
  const [text, setText] = useState(q);
  const [shown, setShown] = useState(PAGE);

  useEffect(() => setText(q), [q]);
  useEffect(() => setShown(PAGE), [q, category]);

  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    return active.filter(
      (p) => (!category || p.category_id === category) && (!term || `${p.name} ${p.sku || ""} ${p.description || ""}`.toLowerCase().includes(term)),
    );
  }, [active, category, q]);

  const title = sf.catalog_title || "Catálogo";
  const desc = sf.catalog_description || "";

  return (
    <main className="mn-page">
      <StoreSEO title={`${title} — ${tenant.name}`} description={desc || `Catálogo de ${tenant.name}`} url={typeof window !== "undefined" ? window.location.href : ""} siteName={tenant.name} />
      <section className="mn-section mn-cat-head">
        <h1>{title}</h1>
        {desc && <p className="mn-muted">{desc}</p>}
        <form className="mn-inline-search" role="search" onSubmit={(e) => { e.preventDefault(); update({ q: text.trim() || null }); }}>
          <label className="mn-sr" htmlFor="mn-q">Buscar produto</label>
          <input id="mn-q" value={text} onChange={(e) => setText(e.target.value)} placeholder="Buscar" />
          {text && <button type="button" className="mn-link" aria-label="Limpar busca" onClick={() => { setText(""); update({ q: null }); }}>Limpar</button>}
        </form>
        <nav className="mn-filter" aria-label="Categorias">
          <button className={!category ? "is-on" : ""} aria-pressed={!category} onClick={() => update({ categoria: null })}>Tudo</button>
          {categories.map((c) => (
            <button key={c.id} className={category === c.id ? "is-on" : ""} aria-pressed={category === c.id} onClick={() => update({ categoria: String(c.id) })}>{c.name}</button>
          ))}
        </nav>
      </section>

      <section className="mn-section mn-tight">
        <p className="mn-muted mn-count-line" aria-live="polite">{list.length} {list.length === 1 ? "produto" : "produtos"}</p>
        {list.length ? (
          <>
            <div className="mn-grid">{list.slice(0, shown).map((p) => <Card key={p.id} product={p} />)}</div>
            {shown < list.length && <div className="mn-more"><button className="mn-btn mn-btn-line" onClick={() => setShown((n) => n + PAGE)}>Mostrar mais</button></div>}
          </>
        ) : (
          <div className="mn-none">
            <p>Nenhum produto encontrado.</p>
            <button className="mn-btn" onClick={() => { setText(""); update({ q: null, categoria: null }); }}>Limpar filtros</button>
          </div>
        )}
      </section>
    </main>
  );
}
