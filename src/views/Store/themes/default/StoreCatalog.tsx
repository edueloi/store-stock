import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { SlidersHorizontal, X } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import { Card, Empty } from "./parts";
import { categoryFromParams, money, priceInfo, useKit, withCategory } from "./kit";
import "./styles.css";

const PAGE = 12;
const SORTS = [
  { id: "relevance", label: "Mais relevantes" },
  { id: "recent", label: "Mais recentes" },
  { id: "low", label: "Menor preço" },
  { id: "high", label: "Maior preço" },
  { id: "name", label: "Nome (A–Z)" },
];

export default function StoreCatalog() {
  const { tenant, categories, active, path, sf, hidePrices } = useKit();
  const [params, setParams] = useSearchParams();
  const q = (params.get("q") || "").trim();
  const selected = categoryFromParams(params, categories);
  const [sort, setSort] = useState("relevance");
  const [min, setMin] = useState("");
  const [max, setMax] = useState("");
  const [shown, setShown] = useState(PAGE);
  const [filters, setFilters] = useState(false);
  const title = sf.catalog_title || "Todos os produtos";
  const description = sf.catalog_description || "Escolha seus produtos, confira os detalhes e monte seu pedido.";

  useEffect(() => { setShown(PAGE); }, [q, selected, sort, min, max]);

  const counts = useMemo(() => {
    const map = new Map<number, number>();
    active.forEach((p) => p.category_id && map.set(p.category_id, (map.get(p.category_id) || 0) + 1));
    return map;
  }, [active]);

  const list = useMemo(() => {
    const term = q.toLowerCase();
    const lo = min ? Number(min) : null;
    const hi = max ? Number(max) : null;
    const out = active.filter((p) => {
      if (selected && p.category_id !== selected) return false;
      if (term && !`${p.name} ${p.sku || ""} ${p.description || ""}`.toLowerCase().includes(term)) return false;
      const price = priceInfo(p).price;
      if (lo !== null && price < lo) return false;
      if (hi !== null && price > hi) return false;
      return true;
    });
    if (sort === "recent") out.sort((a, b) => b.id - a.id);
    if (sort === "low") out.sort((a, b) => priceInfo(a).price - priceInfo(b).price);
    if (sort === "high") out.sort((a, b) => priceInfo(b).price - priceInfo(a).price);
    if (sort === "name") out.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    if (sort === "relevance") out.sort((a, b) => Number(b.is_featured) - Number(a.is_featured));
    return out;
  }, [active, q, selected, sort, min, max]);

  const setCat = (id: number | null) => setParams(withCategory(params, id));
  const clearAll = () => {
    const next = new URLSearchParams(params);
    ["q", "cat", "categoria"].forEach((k) => next.delete(k));
    setParams(next);
    setMin(""); setMax("");
  };
  const currentCat = categories.find((c) => c.id === selected);
  const hasFilter = Boolean(q || selected || min || max);

  return (
    <div className="dfl-page">
      <StoreSEO title={`${currentCat ? currentCat.name : title} — ${tenant.name}`} description={description} url={typeof window !== "undefined" ? window.location.href : ""} siteName={tenant.name} />
      <div className="dfl-wrap">
        <nav className="dfl-crumbs" aria-label="Você está em">
          <Link to={path()}>Início</Link><span>/</span>
          <span aria-current="page">{currentCat ? currentCat.name : "Catálogo"}</span>
        </nav>
        <div className="dfl-cat-layout">
          <aside className={`dfl-side${filters ? " is-open" : ""}`} aria-label="Filtros">
            <div className="dfl-side-head">
              <h2>Filtros</h2>
              <button type="button" className="dfl-icon-btn dfl-side-close" aria-label="Fechar filtros" onClick={() => setFilters(false)}><X size={20} /></button>
            </div>
            <div className="dfl-side-block">
              <h3>Categorias</h3>
              <ul>
                <li><button type="button" className={!selected ? "is-on" : ""} aria-pressed={!selected} onClick={() => setCat(null)}>Todas <span>{active.length}</span></button></li>
                {categories.filter((c) => counts.get(c.id)).map((c) => (
                  <li key={c.id}><button type="button" className={selected === c.id ? "is-on" : ""} aria-pressed={selected === c.id} onClick={() => setCat(c.id)}>{c.name} <span>{counts.get(c.id)}</span></button></li>
                ))}
              </ul>
            </div>
            {!hidePrices && (
              <div className="dfl-side-block">
                <h3>Faixa de preço</h3>
                <div className="dfl-range">
                  <label><span>De (R$)</span><input inputMode="decimal" type="number" min="0" value={min} onChange={(e) => setMin(e.target.value)} placeholder="0" /></label>
                  <label><span>Até (R$)</span><input inputMode="decimal" type="number" min="0" value={max} onChange={(e) => setMax(e.target.value)} placeholder="Sem limite" /></label>
                </div>
              </div>
            )}
            <button type="button" className="dfl-btn dfl-btn-line" onClick={clearAll} disabled={!hasFilter}>Limpar filtros</button>
            <button type="button" className="dfl-btn dfl-side-apply" onClick={() => setFilters(false)}>Ver {list.length} {list.length === 1 ? "produto" : "produtos"}</button>
          </aside>
          {filters && <button type="button" className="dfl-side-scrim" aria-label="Fechar filtros" onClick={() => setFilters(false)} />}

          <section className="dfl-results">
            <header className="dfl-results-head">
              <div>
                <h1>{currentCat ? currentCat.name : title}</h1>
                <p>{q ? <>Resultados para <b>“{q}”</b> · </> : null}{list.length} {list.length === 1 ? "produto" : "produtos"}</p>
              </div>
              <div className="dfl-toolbar">
                <button type="button" className="dfl-btn dfl-btn-line dfl-filter-btn" onClick={() => setFilters(true)}><SlidersHorizontal size={16} /> Filtros</button>
                <label className="dfl-sort"><span>Ordenar por</span>
                  <select value={sort} onChange={(e) => setSort(e.target.value)}>
                    {SORTS.filter((s) => !(hidePrices && (s.id === "low" || s.id === "high"))).map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                  </select>
                </label>
              </div>
            </header>
            {(q || selected || min || max) && (
              <div className="dfl-chips">
                {q && <button type="button" onClick={() => { const n = new URLSearchParams(params); n.delete("q"); setParams(n); }}>Busca: {q} <X size={13} /></button>}
                {currentCat && <button type="button" onClick={() => setCat(null)}>{currentCat.name} <X size={13} /></button>}
                {(min || max) && <button type="button" onClick={() => { setMin(""); setMax(""); }}>{min ? money(Number(min)) : "R$ 0"} – {max ? money(Number(max)) : "sem limite"} <X size={13} /></button>}
              </div>
            )}
            {list.length === 0 ? (
              <Empty title="Nenhum produto encontrado" text="Tente outro termo ou remova alguns filtros." />
            ) : (
              <>
                <div className="dfl-grid dfl-grid-cat">{list.slice(0, shown).map((p) => <Card key={p.id} product={p} />)}</div>
                {shown < list.length && (
                  <div className="dfl-more">
                    <p>Mostrando {Math.min(shown, list.length)} de {list.length}</p>
                    <button type="button" className="dfl-btn dfl-btn-inline" onClick={() => setShown((n) => n + PAGE)}>Ver mais produtos</button>
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
