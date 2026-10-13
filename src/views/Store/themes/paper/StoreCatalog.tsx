import { useEffect, useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import Card from "./Card";
import { useCatalogQuery, useKit } from "./kit";
import "./styles.css";

const PAGE = 12;

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

  const title = sf.catalog_title || "Todas as páginas do caderno";
  const desc = sf.catalog_description || "Folheie os produtos, filtre por divisória e escolha o que combina com você.";
  const count = (id: number) => active.filter((p) => p.category_id === id).length;

  return (
    <main className="pp-page">
      <StoreSEO title={`${title} — ${tenant.name}`} description={desc} url={typeof window !== "undefined" ? window.location.href : ""} siteName={tenant.name} />
      <section className="pp-section pp-cat-head">
        <h1 className="pp-h1">{title}</h1>
        <p>{desc}</p>
        <form className="pp-find" role="search" onSubmit={(e) => { e.preventDefault(); update({ q: text.trim() || null }); }}>
          <label className="pp-sr" htmlFor="pp-q">Buscar produto</label>
          <Search size={18} aria-hidden="true" />
          <input id="pp-q" value={text} onChange={(e) => setText(e.target.value)} placeholder="O que você quer encontrar?" />
          {text && <button type="button" aria-label="Limpar busca" className="pp-x" onClick={() => { setText(""); update({ q: null }); }}><X size={18} /></button>}
          <button className="pp-btn pp-btn-sm" type="submit">Buscar</button>
        </form>
        <div className="pp-chips" role="group" aria-label="Filtrar por categoria">
          <button className={!category ? "is-on" : ""} aria-pressed={!category} onClick={() => update({ categoria: null })}>Tudo <i>{active.length}</i></button>
          {categories.map((c, i) => (
            <button key={c.id} className={`${category === c.id ? "is-on" : ""} pp-rot-${i % 3}`} aria-pressed={category === c.id} onClick={() => update({ categoria: String(c.id) })}>{c.name} <i>{count(c.id)}</i></button>
          ))}
        </div>
      </section>

      <section className="pp-section">
        <p className="pp-count" aria-live="polite">{list.length} {list.length === 1 ? "item" : "itens"} nesta página</p>
        {list.length ? (
          <>
            <div className="pp-grid">{list.slice(0, shown).map((p, i) => <Card key={p.id} product={p} index={i} />)}</div>
            {shown < list.length && <p className="pp-center"><button className="pp-btn" onClick={() => setShown((n) => n + PAGE)}>Virar a página (+{Math.min(PAGE, list.length - shown)})</button></p>}
          </>
        ) : (
          <div className="pp-blank">
            <p className="pp-hand">Nada anotado por aqui...</p>
            <p>Não encontramos produtos para essa busca. Tente outro termo ou outra divisória.</p>
            <button className="pp-btn" onClick={() => { setText(""); update({ q: null, categoria: null }); }}>Limpar filtros</button>
          </div>
        )}
      </section>
    </main>
  );
}
