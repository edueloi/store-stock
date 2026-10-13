import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { GitCompare, LayoutGrid, List, Search, X } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import { Card, Empty, deptIcon, installmentText } from "./parts";
import { categoryFromParams, imageOf, inStock, money, priceInfo, productHref, useKit, variationGroups, withCategory } from "./kit";
import "./styles.css";

const PAGE = 15;
const MAX_COMPARE = 3;

export default function StoreCatalog() {
  const { tenant, categories, active, path, sf, hidePrices } = useKit();
  const [params, setParams] = useSearchParams();
  const urlQ = (params.get("q") || "").trim();
  const selected = categoryFromParams(params, categories);
  const [text, setText] = useState(urlQ);
  const [sort, setSort] = useState("relevance");
  const [onlyOffers, setOnlyOffers] = useState(false);
  const [onlyStock, setOnlyStock] = useState(false);
  const [min, setMin] = useState("");
  const [max, setMax] = useState("");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [shown, setShown] = useState(PAGE);
  const [picked, setPicked] = useState<number[]>([]);
  const [modal, setModal] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const title = sf.catalog_title || "Todos os produtos";
  const description = sf.catalog_description || "Compare, filtre por departamento e escolha o melhor para você.";

  useEffect(() => { setText(urlQ); }, [urlQ]);
  useEffect(() => { setShown(PAGE); }, [urlQ, selected, sort, onlyOffers, onlyStock, min, max]);
  useEffect(() => {
    if (!modal) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setModal(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modal]);

  const list = useMemo(() => {
    const term = urlQ.toLowerCase();
    const lo = min ? Number(min) : null;
    const hi = max ? Number(max) : null;
    const out = active.filter((p) => {
      if (selected && p.category_id !== selected) return false;
      if (term && !`${p.name} ${p.sku || ""} ${p.description || ""}`.toLowerCase().includes(term)) return false;
      const info = priceInfo(p);
      if (onlyOffers && !info.hasDiscount) return false;
      if (onlyStock && !inStock(p, tenant)) return false;
      if (lo !== null && info.price < lo) return false;
      if (hi !== null && info.price > hi) return false;
      return true;
    });
    if (sort === "low") out.sort((a, b) => priceInfo(a).price - priceInfo(b).price);
    if (sort === "high") out.sort((a, b) => priceInfo(b).price - priceInfo(a).price);
    if (sort === "off") out.sort((a, b) => priceInfo(b).pct - priceInfo(a).pct);
    if (sort === "name") out.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    if (sort === "recent") out.sort((a, b) => b.id - a.id);
    return out;
  }, [active, urlQ, selected, sort, onlyOffers, onlyStock, min, max, tenant]);

  const counts = useMemo(() => {
    const m = new Map<number, number>();
    active.forEach((p) => p.category_id && m.set(p.category_id, (m.get(p.category_id) || 0) + 1));
    return m;
  }, [active]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const next = new URLSearchParams(params);
    if (text.trim()) next.set("q", text.trim()); else next.delete("q");
    setParams(next);
  };
  const setCat = (id: number | null) => setParams(withCategory(params, id));
  const toggle = (id: number) => setPicked((c) => (c.includes(id) ? c.filter((x) => x !== id) : c.length < MAX_COMPARE ? [...c, id] : c));
  const chosen = picked.map((id) => active.find((p) => p.id === id)).filter(Boolean) as typeof active;
  const currentCat = categories.find((c) => c.id === selected);
  const optionNames = Array.from(new Set(chosen.flatMap((p) => variationGroups(p).map((g) => g.name))));
  const lowest = chosen.length ? Math.min(...chosen.map((p) => priceInfo(p).price)) : 0;

  return (
    <div className="elx-page">
      <StoreSEO title={`${currentCat ? currentCat.name : title} — ${tenant.name}`} description={description} url={typeof window !== "undefined" ? window.location.href : ""} siteName={tenant.name} />
      <div className="elx-wrap">
        <nav className="elx-crumbs" aria-label="Você está em"><Link to={path()}>Início</Link><span>›</span><span aria-current="page">{currentCat ? currentCat.name : "Catálogo"}</span></nav>
        <header className="elx-cat-head">
          <div>
            <h1>{currentCat ? currentCat.name : title}</h1>
            <p>{description}</p>
          </div>
          <form className="elx-cat-search" role="search" onSubmit={submit}>
            <label className="elx-sr" htmlFor="elx-q">Buscar no catálogo</label>
            <Search size={18} aria-hidden="true" />
            <input id="elx-q" value={text} onChange={(e) => setText(e.target.value)} placeholder="Buscar no catálogo" />
            <button type="submit">Buscar</button>
          </form>
        </header>

        <div className="elx-chips" role="group" aria-label="Departamentos">
          <button type="button" aria-pressed={!selected} className={!selected ? "is-on" : ""} onClick={() => setCat(null)}>Todos <span>{active.length}</span></button>
          {categories.filter((c) => counts.get(c.id)).map((c) => {
            const Icon = deptIcon(c.name);
            return <button key={c.id} type="button" aria-pressed={selected === c.id} className={selected === c.id ? "is-on" : ""} onClick={() => setCat(c.id)}><Icon size={15} /> {c.name} <span>{counts.get(c.id)}</span></button>;
          })}
        </div>

        <div className="elx-bar">
          <p className="elx-count"><b>{list.length}</b> {list.length === 1 ? "produto" : "produtos"}{urlQ ? <> para “{urlQ}”</> : null}</p>
          <div className="elx-filters">
            {!hidePrices && (
              <>
                <label className="elx-check"><input type="checkbox" checked={onlyOffers} onChange={(e) => setOnlyOffers(e.target.checked)} /> Só ofertas</label>
                <label className="elx-field"><span>De R$</span><input type="number" inputMode="decimal" min="0" value={min} onChange={(e) => setMin(e.target.value)} /></label>
                <label className="elx-field"><span>Até R$</span><input type="number" inputMode="decimal" min="0" value={max} onChange={(e) => setMax(e.target.value)} /></label>
              </>
            )}
            <label className="elx-check"><input type="checkbox" checked={onlyStock} onChange={(e) => setOnlyStock(e.target.checked)} /> Disponíveis</label>
            <label className="elx-field elx-field-sort"><span>Ordenar</span>
              <select value={sort} onChange={(e) => setSort(e.target.value)}>
                <option value="relevance">Relevância</option>
                <option value="recent">Mais recentes</option>
                {!hidePrices && <option value="low">Menor preço</option>}
                {!hidePrices && <option value="high">Maior preço</option>}
                {!hidePrices && <option value="off">Maior desconto</option>}
                <option value="name">Nome (A–Z)</option>
              </select>
            </label>
            <div className="elx-view" role="group" aria-label="Modo de exibição">
              <button type="button" aria-pressed={view === "grid"} aria-label="Ver em grade" className={view === "grid" ? "is-on" : ""} onClick={() => setView("grid")}><LayoutGrid size={18} /></button>
              <button type="button" aria-pressed={view === "list"} aria-label="Ver em lista" className={view === "list" ? "is-on" : ""} onClick={() => setView("list")}><List size={18} /></button>
            </div>
          </div>
        </div>

        {list.length === 0 ? (
          <Empty title="Nenhum produto encontrado" text="Ajuste a busca ou remova alguns filtros." />
        ) : (
          <>
            <div className={view === "grid" ? "elx-grid" : "elx-list"}>
              {list.slice(0, shown).map((p) => (
                <Card key={p.id} product={p} list={view === "list"} compare={{ on: picked.includes(p.id), disabled: picked.length >= MAX_COMPARE, toggle: () => toggle(p.id) }} />
              ))}
            </div>
            {shown < list.length && (
              <div className="elx-more">
                <span>Exibindo {Math.min(shown, list.length)} de {list.length}</span>
                <button type="button" className="elx-btn elx-btn-inline" onClick={() => setShown((n) => n + PAGE)}>Carregar mais produtos</button>
              </div>
            )}
          </>
        )}
      </div>

      {chosen.length > 0 && (
        <div className="elx-cmpbar" role="region" aria-label="Comparação de produtos">
          <div className="elx-wrap elx-cmpbar-in">
            <ul>
              {chosen.map((p) => (
                <li key={p.id}>
                  <span className="elx-cmp-thumb">{imageOf(p) && <img src={imageOf(p)} alt="" />}</span>
                  <b>{p.name}</b>
                  <button type="button" aria-label={`Remover ${p.name} da comparação`} onClick={() => toggle(p.id)}><X size={16} /></button>
                </li>
              ))}
            </ul>
            <div className="elx-cmpbar-actions">
              <button type="button" className="elx-btn elx-btn-ghost elx-btn-sm" onClick={() => setPicked([])}>Limpar</button>
              <button type="button" className="elx-btn elx-btn-sm" disabled={chosen.length < 2} onClick={() => setModal(true)}><GitCompare size={16} /> Comparar ({chosen.length})</button>
            </div>
          </div>
        </div>
      )}

      {modal && chosen.length > 1 && (
        <div className="elx-modal" role="dialog" aria-modal="true" aria-labelledby="elx-cmp-title" onClick={(e) => { if (e.target === e.currentTarget) setModal(false); }}>
          <div className="elx-modal-box">
            <header>
              <h2 id="elx-cmp-title">Comparar produtos</h2>
              <button ref={closeRef} type="button" className="elx-icon-btn" aria-label="Fechar comparação" onClick={() => setModal(false)}><X size={22} /></button>
            </header>
            <div className="elx-cmp-scroll">
              <table className="elx-cmp">
                <thead>
                  <tr><th scope="col"><span className="elx-sr">Característica</span></th>{chosen.map((p) => <th scope="col" key={p.id}><Link to={productHref(path, p)}><span className="elx-cmp-img">{imageOf(p) && <img src={imageOf(p)} alt="" />}</span>{p.name}</Link></th>)}</tr>
                </thead>
                <tbody>
                  {!hidePrices && <tr><th scope="row">Preço</th>{chosen.map((p) => { const i = priceInfo(p); return <td key={p.id} className={i.price === lowest ? "is-best" : ""}><strong>{money(i.price)}</strong>{i.hasDiscount && <s>{money(i.full)}</s>}{i.price === lowest && <em>Menor preço</em>}</td>; })}</tr>}
                  {!hidePrices && tenant.max_installments && <tr><th scope="row">Parcelamento</th>{chosen.map((p) => <td key={p.id}>{installmentText(tenant, priceInfo(p).price) || "—"}</td>)}</tr>}
                  <tr><th scope="row">Departamento</th>{chosen.map((p) => <td key={p.id}>{categories.find((c) => c.id === p.category_id)?.name || "—"}</td>)}</tr>
                  <tr><th scope="row">Código</th>{chosen.map((p) => <td key={p.id}>{p.sku || "—"}</td>)}</tr>
                  <tr><th scope="row">Disponibilidade</th>{chosen.map((p) => <td key={p.id}>{inStock(p, tenant) ? "Disponível" : "Esgotado"}</td>)}</tr>
                  {optionNames.map((n) => <tr key={n}><th scope="row">{n}</th>{chosen.map((p) => <td key={p.id}>{variationGroups(p).find((g) => g.name === n)?.options.map((o) => o.value).join(", ") || "—"}</td>)}</tr>)}
                  <tr><th scope="row">Descrição</th>{chosen.map((p) => <td key={p.id} className="elx-cmp-desc">{p.description ? p.description.slice(0, 220) + (p.description.length > 220 ? "…" : "") : "—"}</td>)}</tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
