import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowRight, LayoutGrid, List, Search, SlidersHorizontal, X } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import Card, { Price } from "./Card";
import { groups, imageOf, norm, priceOf, totalUnits, useKit } from "./lib";
import "./styles.css";

const SIZE = 12;

export default function StoreCatalog() {
  const { tenant, active, path, sf, hidden, usedCategories, countIn, catName, productPath, soldOut, addToCart, openCart, cart, tracks } = useKit();
  const [params, setParams] = useSearchParams();
  const q = params.get("q") || "";
  const cat = params.get("cat") || params.get("categoria") || "";
  const sort = params.get("sort") || "featured";
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [view, setView] = useState<"grid" | "list">("grid");
  const [limit, setLimit] = useState(SIZE);
  const [availableOnly, setAvailableOnly] = useState(false);
  const [saleOnly, setSaleOnly] = useState(false);
  const [min, setMin] = useState("");
  const [max, setMax] = useState("");

  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (key === "cat") next.delete("categoria");
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: key === "q" });
  };
  useEffect(() => setLimit(SIZE), [q, cat, sort, availableOnly, saleOnly, min, max]);

  const results = useMemo(() => {
    const term = norm(q.trim());
    const low = min.trim() !== "" ? Number(min) : null;
    const high = max.trim() !== "" ? Number(max) : null;
    const items = active.filter((p) => {
      const price = priceOf(p);
      return (
        (!cat || String(p.category_id) === cat) &&
        (!term || norm(`${p.name} ${p.sku || ""} ${p.description || ""}`).includes(term)) &&
        (!availableOnly || !soldOut(p)) &&
        (!saleOnly || price.off) &&
        (hidden || ((low === null || price.price >= low) && (high === null || price.price <= high)))
      );
    });
    const by = (fn: (a: (typeof items)[number], b: (typeof items)[number]) => number) => [...items].sort(fn);
    if (!hidden && sort === "menor") return by((a, b) => priceOf(a).price - priceOf(b).price);
    if (!hidden && sort === "maior") return by((a, b) => priceOf(b).price - priceOf(a).price);
    if (sort === "nome") return by((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    if (!hidden && sort === "ofertas") return by((a, b) => Number(priceOf(b).off) - Number(priceOf(a).off));
    return by((a, b) => Number(b.is_featured) - Number(a.is_featured));
  }, [active, q, cat, sort, availableOnly, saleOnly, min, max, hidden, soldOut]);

  const selected = usedCategories.find((c) => String(c.id) === cat);
  const reset = () => {
    const next = new URLSearchParams(params);
    ["q", "cat", "categoria", "sort"].forEach((k) => next.delete(k));
    setParams(next);
    setAvailableOnly(false);
    setSaleOnly(false);
    setMin("");
    setMax("");
  };
  const quickAdd = (p: (typeof active)[number]) => {
    if (soldOut(p) || groups(p).length) return;
    const inCart = tracks ? cart.filter((i) => i.id === p.id).reduce((s, i) => s + i.quantity, 0) : 0;
    if (tracks && inCart >= (totalUnits(p) ?? Infinity)) return;
    addToCart(p);
    openCart();
  };
  const pickCat = (id: string) => {
    update("cat", id);
    setFiltersOpen(false);
  };
  const filtered = !!(q || cat || saleOnly || availableOnly || min || max);

  return (
    <main className="sp-root">
      <StoreSEO title={`${selected?.name || sf.catalog_title || "Catálogo"} | ${tenant.name}`} description={sf.catalog_description || tenant.about_text || `Produtos da ${tenant.name}.`} image={tenant.banner_url || tenant.logo_url} url={typeof window !== "undefined" ? window.location.href : ""} siteName={tenant.name} />
      <div className="sp-wrap">
        <section className="sp-cathead">
          <nav className="sp-crumbs" aria-label="Você está em"><Link to={path()}>Início</Link><span>/</span><span>Catálogo</span>{selected && <><span>/</span><span>{selected.name}</span></>}</nav>
          <h1>{selected?.name || sf.catalog_title || "Explore o catálogo"}</h1>
          <p>{sf.catalog_description || "Tudo para acompanhar seu esporte e seu estilo."}</p>
        </section>

        <div className="sp-catalog">
          {filtersOpen && <button className="sp-scrim" aria-label="Fechar filtros" onClick={() => setFiltersOpen(false)} />}
          <aside className={`sp-filters${filtersOpen ? " is-open" : ""}`} aria-label="Filtros do catálogo">
            <div className="sp-filters-head"><strong>Filtros</strong><button className="sp-icon" onClick={() => setFiltersOpen(false)} aria-label="Fechar filtros"><X size={20} /></button></div>
            <div className="sp-fgroup">
              <h3>Categorias</h3>
              <div className="sp-catlist">
                <button aria-pressed={!cat} onClick={() => pickCat("")}><span>Todas</span><small>{active.length}</small></button>
                {usedCategories.map((c) => (
                  <button key={c.id} aria-pressed={cat === String(c.id)} onClick={() => pickCat(String(c.id))}><span>{c.name}</span><small>{countIn(c.id)}</small></button>
                ))}
              </div>
            </div>
            <div className="sp-fgroup">
              <h3>Disponibilidade</h3>
              <label className="sp-check"><input type="checkbox" checked={availableOnly} onChange={(e) => setAvailableOnly(e.target.checked)} /> Somente disponíveis</label>
            </div>
            {!hidden && (
              <div className="sp-fgroup">
                <h3>Preço e ofertas</h3>
                <label className="sp-check"><input type="checkbox" checked={saleOnly} onChange={(e) => setSaleOnly(e.target.checked)} /> Somente ofertas</label>
                <div className="sp-range">
                  <label>De R$<input type="number" min="0" value={min} onChange={(e) => setMin(e.target.value)} placeholder="0" /></label>
                  <label>Até R$<input type="number" min="0" value={max} onChange={(e) => setMax(e.target.value)} placeholder="Máx." /></label>
                </div>
              </div>
            )}
            <button onClick={reset} className="sp-btn sp-btn--soft sp-btn--block">Limpar filtros</button>
          </aside>

          <section className="sp-results">
            <div className="sp-tools">
              <button className="sp-filter-btn" onClick={() => setFiltersOpen(true)}><SlidersHorizontal size={18} /> Filtros</button>
              <label className="sp-toolsearch"><Search size={18} /><input aria-label="Buscar produtos" value={q} onChange={(e) => update("q", e.target.value)} placeholder="Buscar produto ou código" />{q && <button onClick={() => update("q", "")} aria-label="Limpar busca"><X size={16} /></button>}</label>
              <label className="sp-sort"><span className="sp-sr">Ordenar</span>
                <select value={sort} onChange={(e) => update("sort", e.target.value === "featured" ? "" : e.target.value)}>
                  <option value="featured">Destaques</option>
                  {!hidden && <><option value="menor">Menor preço</option><option value="maior">Maior preço</option><option value="ofertas">Ofertas primeiro</option></>}
                  <option value="nome">Nome A–Z</option>
                </select>
              </label>
              <div className="sp-viewsw" role="group" aria-label="Modo de exibição">
                <button aria-label="Grade" aria-pressed={view === "grid"} onClick={() => setView("grid")}><LayoutGrid size={19} /></button>
                <button aria-label="Lista" aria-pressed={view === "list"} onClick={() => setView("list")}><List size={19} /></button>
              </div>
            </div>
            <div className="sp-count" aria-live="polite"><span><b>{results.length}</b> {results.length === 1 ? "produto encontrado" : "produtos encontrados"}</span>{filtered && <button onClick={reset}>Limpar seleção <X size={14} /></button>}</div>

            {results.length === 0 ? (
              <div className="sp-empty"><Search size={40} /><h2>Nenhum produto encontrado</h2><p>Tente outra busca ou remova alguns filtros.</p><button onClick={reset} className="sp-btn">Limpar filtros <ArrowRight size={17} /></button></div>
            ) : view === "grid" ? (
              <div className="sp-grid sp-grid--cat">{results.slice(0, limit).map((p) => <Card key={p.id} product={p} />)}</div>
            ) : (
              <div className="sp-rows">
                {results.slice(0, limit).map((p) => (
                  <article className="sp-row" key={p.id}>
                    <Link to={productPath(p)} className="sp-row-photo" aria-label={p.name}>{imageOf(p) && <img src={imageOf(p)} alt="" loading="lazy" />}</Link>
                    <div className="sp-row-info"><span>{catName(p.category_id)}</span><Link to={productPath(p)}><strong>{p.name}</strong></Link>{p.sku && <small>Ref. {p.sku}</small>}</div>
                    <Price product={p} hidden={hidden} />
                    {groups(p).length || soldOut(p)
                      ? <Link className="sp-add sp-add--row" to={productPath(p)}>Ver opções</Link>
                      : <button className="sp-add sp-add--row" onClick={() => quickAdd(p)}>Adicionar</button>}
                  </article>
                ))}
              </div>
            )}
            {limit < results.length && <div className="sp-more"><button className="sp-btn sp-btn--soft" onClick={() => setLimit((n) => n + SIZE)}>Carregar mais produtos</button></div>}
          </section>
        </div>
      </div>
    </main>
  );
}
