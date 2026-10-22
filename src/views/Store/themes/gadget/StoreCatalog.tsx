import { useEffect, useMemo, useState } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import StoreSEO from "../../../../components/store/StoreSEO";
import Card from "./Card";
import { hasDiscount, isSoldOut, priceOf, useCatalogList, useGadgetMotion, useUsedCategories, type SortKey } from "./kit";
import "./styles.css";

const PAGE = 16;

export default function StoreCatalog() {
  const c = useCatalogList(PAGE);
  const motion = useGadgetMotion();
  const [params, setParams] = useSearchParams();
  const cats = useUsedCategories();
  const { tenant, sf, hidden } = c;
  const [text, setText] = useState(c.q);
  const [min, setMin] = useState("");
  const [max, setMax] = useState("");
  const onlyOffers = !hidden && params.get("ofertas") === "1";
  const setOnlyOffers = (value: boolean) => { const next = new URLSearchParams(params); if (value) next.set("ofertas", "1"); else next.delete("ofertas"); setParams(next, { replace: true }); };
  const [onlyStock, setOnlyStock] = useState(false);
  const [panel, setPanel] = useState(false);
  const [visible, setVisible] = useState(PAGE);
  useEffect(() => setText(c.q), [c.q]);

  const title = sf.catalog_title || "Catálogo";
  const desc = sf.catalog_description || "";
  const current = cats.find((x) => x.id === c.category);

  const list = useMemo(() => {
    const lo = Number(min.replace(",", "."));
    const hi = Number(max.replace(",", "."));
    return c.list.filter((p) => {
      if (onlyOffers && !hasDiscount(p)) return false;
      if (onlyStock && isSoldOut(p, tenant)) return false;
      if (!hidden && min && Number.isFinite(lo) && priceOf(p) < lo) return false;
      if (!hidden && max && Number.isFinite(hi) && hi > 0 && priceOf(p) > hi) return false;
      return true;
    });
  }, [c.list, min, max, onlyOffers, onlyStock, hidden, tenant]);

  useEffect(() => setVisible(PAGE), [c.q, c.category, c.sort, min, max, onlyOffers, onlyStock]);

  const filtered = Boolean(min || max || onlyOffers || onlyStock);
  const clearAll = () => {
    setText("");
    setMin("");
    setMax("");
    setOnlyStock(false);
    c.update({ q: null, categoria: null, ofertas: null });
  };

  const filters = (
    <div className="gd-filters">
      <div className="gd-fgroup">
        <h3>Categorias</h3>
        <button type="button" className={!c.category ? "is-on" : ""} onClick={() => c.update({ categoria: null })}>
          Todas <small>{c.active.length}</small>
        </button>
        {cats.map((x) => (
          <button key={x.id} type="button" className={c.category === x.id ? "is-on" : ""} onClick={() => c.update({ categoria: String(x.id) })}>
            {x.name} <small>{x.count}</small>
          </button>
        ))}
      </div>
      {!hidden && (
        <div className="gd-fgroup">
          <h3>Preço</h3>
          <div className="gd-range">
            <input inputMode="decimal" placeholder="Mín." value={min} onChange={(e) => setMin(e.target.value)} aria-label="Preço mínimo" />
            <span>—</span>
            <input inputMode="decimal" placeholder="Máx." value={max} onChange={(e) => setMax(e.target.value)} aria-label="Preço máximo" />
          </div>
        </div>
      )}
      <div className="gd-fgroup">
        <h3>Exibir</h3>
        {!hidden && (
          <label className="gd-check">
            <input type="checkbox" checked={onlyOffers} onChange={(e) => setOnlyOffers(e.target.checked)} /> Só ofertas
          </label>
        )}
        <label className="gd-check">
          <input type="checkbox" checked={onlyStock} onChange={(e) => setOnlyStock(e.target.checked)} /> Só disponíveis
        </label>
      </div>
      {(filtered || c.category || c.q) && (
        <button type="button" className="gd-clear" onClick={clearAll}>
          Limpar filtros
        </button>
      )}
    </div>
  );

  return (
    <main className="gd-page" ref={motion}>
      <StoreSEO
        title={`${current ? `${current.name} — ` : ""}${title} — ${tenant.name}`}
        description={desc || `Catálogo de ${tenant.name}`}
        url={typeof window !== "undefined" ? window.location.href : ""}
        siteName={tenant.name}
      />
      <section className="gd-wrap gd-cat-head">
        <span className="gd-kicker">{current ? title : tenant.name}</span>
        <h1>{current?.name || title}</h1>
        {desc && !current && <p className="gd-muted">{desc}</p>}
      </section>

      <div className="gd-wrap gd-cat-layout">
        <aside className="gd-side" aria-label="Filtros">
          {filters}
        </aside>

        <div className="gd-cat-main">
          <div className="gd-toolbar">
            <form
              className="gd-search gd-search-wide"
              role="search"
              onSubmit={(e) => {
                e.preventDefault();
                c.update({ q: text.trim() || null });
              }}
            >
              <Search size={15} aria-hidden="true" />
              <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Buscar produto ou código" aria-label="Buscar produto" />
            </form>
            <button type="button" className="gd-filter-btn" onClick={() => setPanel(true)}>
              <SlidersHorizontal size={15} /> Filtros{filtered ? " •" : ""}
            </button>
            <label className="gd-select">
              <span className="gd-sr">Ordenar por</span>
              <select value={c.sort} onChange={(e) => c.setSort(e.target.value as SortKey)}>
                <option value="destaques">Destaques</option>
                <option value="nome">Nome (A–Z)</option>
                {!hidden && <option value="menor">Menor preço</option>}
                {!hidden && <option value="maior">Maior preço</option>}
              </select>
            </label>
          </div>
          <p className="gd-muted gd-count-line" aria-live="polite">
            {list.length} {list.length === 1 ? "produto" : "produtos"}
            {c.q ? ` para “${c.q}”` : ""}
          </p>
          {list.length ? (
            <>
              <div className="gd-grid gd-grid-3">
                {list.slice(0, visible).map((p) => (
                  <Card key={p.id} product={p} />
                ))}
              </div>
              {list.length > visible && (
                <div className="gd-more">
                  <button type="button" className="gd-btn gd-btn-line" onClick={() => setVisible((v) => v + PAGE)}>
                    Mostrar mais
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="gd-none">
              <p>Nenhum produto encontrado.</p>
              <button type="button" className="gd-btn gd-btn-accent" onClick={clearAll}>
                Limpar filtros
              </button>
            </div>
          )}
        </div>
      </div>

      {panel && (
        <div className="gd-sheet" role="dialog" aria-label="Filtros">
          <button type="button" className="gd-sheet-bg" aria-label="Fechar" onClick={() => setPanel(false)} />
          <div className="gd-sheet-box">
            <header>
              <strong>Filtros</strong>
              <button type="button" className="gd-icon" aria-label="Fechar filtros" onClick={() => setPanel(false)}>
                <X size={18} />
              </button>
            </header>
            {filters}
            <button type="button" className="gd-btn gd-btn-accent gd-btn-full" onClick={() => setPanel(false)}>
              Ver {list.length} {list.length === 1 ? "produto" : "produtos"}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
