import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { LayoutGrid, Search, X } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import Card from "./Card";
import { priceOf, useCatalogQuery, useKit } from "./kit";
import "./styles.css";

const PAGE = 12;

export default function StoreCatalog() {
  const { tenant, categories, active, path, sf } = useKit();
  const { category, q, update } = useCatalogQuery();
  const [text, setText] = useState(q);
  const [sort, setSort] = useState("relevance");
  const [shown, setShown] = useState(PAGE);

  useEffect(() => setText(q), [q]);
  useEffect(() => setShown(PAGE), [q, category, sort]);

  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    const out = active.filter(
      (p) =>
        (!category || p.category_id === category) &&
        (!term || `${p.name} ${p.sku || ""} ${p.description || ""}`.toLowerCase().includes(term)),
    );
    if (sort === "low") out.sort((a, b) => priceOf(a) - priceOf(b));
    if (sort === "high") out.sort((a, b) => priceOf(b) - priceOf(a));
    if (sort === "name") out.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    return out;
  }, [active, category, q, sort]);

  const title = sf.catalog_title || "Catálogo de departamentos";
  const desc = sf.catalog_description || "Navegue por departamento, busque por produto ou medida e escolha as opções.";
  const current = categories.find((c) => c.id === category);
  const count = (id: number) => active.filter((p) => p.category_id === id).length;

  return (
    <main className="hm-page">
      <StoreSEO title={`${title} — ${tenant.name}`} description={desc} url={typeof window !== "undefined" ? window.location.href : ""} siteName={tenant.name} />
      <section className="hm-pagehead">
        <div className="hm-wrap">
          <nav className="hm-crumbs" aria-label="Você está em">
            <Link to={path()}>Início</Link> / <Link to={path("/catalogo")}>Catálogo</Link>
            {current && <> / <span>{current.name}</span></>}
          </nav>
          <h1>{current ? current.name : title}</h1>
          <p>{desc}</p>
          <form className="hm-bigsearch" role="search" onSubmit={(e) => { e.preventDefault(); update({ q: text.trim() || null }); }}>
            <label className="hm-sr" htmlFor="hm-cat-q">Buscar por produto ou medida</label>
            <Search size={18} aria-hidden="true" />
            <input id="hm-cat-q" value={text} onChange={(e) => setText(e.target.value)} placeholder="Busque por produto ou medida (ex.: 60x60, 3/4)" />
            {text && <button type="button" className="hm-iconbtn" aria-label="Limpar busca" onClick={() => { setText(""); update({ q: null }); }}><X size={18} /></button>}
            <button className="hm-btn hm-btn-accent" type="submit">Buscar</button>
          </form>
        </div>
      </section>

      <div className="hm-wrap hm-catalog">
        <aside className="hm-side" aria-label="Departamentos">
          <p className="hm-side-title"><LayoutGrid size={15} aria-hidden="true" /> Departamentos</p>
          <button className={!category ? "is-on" : ""} onClick={() => update({ categoria: null })}>Todos <i>{active.length}</i></button>
          {categories.map((c) => (
            <button key={c.id} className={category === c.id ? "is-on" : ""} onClick={() => update({ categoria: String(c.id) })}>{c.name} <i>{count(c.id)}</i></button>
          ))}
        </aside>
        <section>
          <div className="hm-toolbar">
            <p aria-live="polite">{list.length} {list.length === 1 ? "produto encontrado" : "produtos encontrados"}</p>
            <label>
              <span>Ordenar</span>
              <select value={sort} onChange={(e) => setSort(e.target.value)}>
                <option value="relevance">Relevância</option>
                <option value="name">Nome (A-Z)</option>
                {!(sf.hide_prices === true || sf.checkout_mode === "order_request") && <option value="low">Menor preço</option>}
                {!(sf.hide_prices === true || sf.checkout_mode === "order_request") && <option value="high">Maior preço</option>}
              </select>
            </label>
          </div>
          {list.length ? (
            <>
              <div className="hm-grid hm-grid-3">{list.slice(0, shown).map((p) => <Card key={p.id} product={p} />)}</div>
              {shown < list.length && (
                <div className="hm-more"><button className="hm-btn hm-btn-dark" onClick={() => setShown((n) => n + PAGE)}>Ver mais produtos ({list.length - shown})</button></div>
              )}
            </>
          ) : (
            <div className="hm-empty-box">
              <p><b>Nenhum produto encontrado.</b></p>
              <p>Tente outro termo, outra medida ou veja todos os departamentos.</p>
              <button className="hm-btn hm-btn-accent" onClick={() => { setText(""); update({ q: null, categoria: null }); }}>Limpar filtros</button>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
