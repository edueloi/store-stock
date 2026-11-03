import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Search, SlidersHorizontal, X } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import StoreSEO from "../../../../components/store/StoreSEO";
import Card from "./Card";
import { hasDiscount, isSoldOut, priceOf, useCatalogList, useGadgetMotion, useUsedCategories, type SortKey } from "./kit";
import "./styles.css";

const PAGE = 12;

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
  const updateFilters = (patch: Record<string, string | null>) => c.update({ categoria: c.category ? String(c.category) : null, ...patch, pagina: null });
  const resetPage = () => updateFilters({});
  const setOnlyOffers = (value: boolean) => updateFilters({ ofertas: value ? "1" : null });
  const [onlyStock, setOnlyStock] = useState(false);
  const [panel, setPanel] = useState(false);
  const [pageSize, setPageSize] = useState(PAGE);
  const results = useRef<HTMLDivElement>(null);
  const sidebar = useRef<HTMLElement>(null);
  const filterButton = useRef<HTMLButtonElement>(null);
  const sheet = useRef<HTMLDivElement>(null);
  useEffect(() => setText(c.q), [c.q]);

  useEffect(() => {
    const side = sidebar.current;
    const root = motion.current;
    const header = root?.closest(".store-theme-gadget")?.querySelector<HTMLElement>(".gd-header");
    if (!side || !root) return;
    let frame = 0;
    const measure = () => {
      const top = (header?.getBoundingClientRect().height || 119) + 16;
      root.style.setProperty("--gd-catalog-top", `${top}px`);
      side.style.setProperty("--gd-side-height", `${Math.max(120, window.innerHeight - Math.max(top, side.getBoundingClientRect().top) - 16)}px`);
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    measure();
    const observer = new ResizeObserver(schedule);
    if (header) observer.observe(header);
    window.addEventListener("resize", schedule);
    window.addEventListener("scroll", schedule, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule);
    };
  }, [motion]);

  useEffect(() => {
    if (!panel) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    sheet.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPanel(false);
      if (event.key !== "Tab") return;
      const controls = sheet.current?.querySelectorAll<HTMLElement>("button, input, select, [tabindex='0']");
      const first = controls?.[0];
      const last = controls?.[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKey);
      filterButton.current?.focus({ preventScroll: true });
    };
  }, [panel]);

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

  const totalPages = Math.max(1, Math.ceil(list.length / pageSize));
  const rawPage = Number(params.get("pagina") || 1);
  const page = Number.isSafeInteger(rawPage) && rawPage > 0 ? Math.min(rawPage, totalPages) : 1;
  const start = (page - 1) * pageSize;
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1)
    .filter((n) => n === 1 || n === totalPages || Math.abs(n - page) <= 1);
  const changePage = (value: number) => {
    if (value === page) return;
    const next = new URLSearchParams(params);
    if (value <= 1) next.delete("pagina");
    else next.set("pagina", String(value));
    setParams(next);
    results.current?.focus({ preventScroll: true });
    results.current?.scrollIntoView({ block: "start", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  };

  const filtered = Boolean(min || max || onlyOffers || onlyStock);
  const clearAll = () => {
    setText("");
    setMin("");
    setMax("");
    setOnlyStock(false);
    updateFilters({ q: null, categoria: null, ofertas: null });
  };

  const filters = (
    <div className="gd-filters">
      <div className="gd-fgroup">
        <h3>Categorias</h3>
        <button type="button" aria-pressed={!c.category} className={!c.category ? "is-on" : ""} onClick={() => updateFilters({ categoria: null })}>
          Todas <small>{c.active.length}</small>
        </button>
        {cats.map((x) => (
          <button key={x.id} type="button" aria-pressed={c.category === x.id} className={c.category === x.id ? "is-on" : ""} onClick={() => updateFilters({ categoria: String(x.id) })}>
            <span>{x.name}</span> <small>{x.count}</small>
          </button>
        ))}
      </div>
      {!hidden && (
        <div className="gd-fgroup">
          <h3>Preço</h3>
          <div className="gd-range">
            <input inputMode="decimal" placeholder="Mín." value={min} onChange={(e) => { setMin(e.target.value); resetPage(); }} aria-label="Preço mínimo" />
            <span>—</span>
            <input inputMode="decimal" placeholder="Máx." value={max} onChange={(e) => { setMax(e.target.value); resetPage(); }} aria-label="Preço máximo" />
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
          <input type="checkbox" checked={onlyStock} onChange={(e) => { setOnlyStock(e.target.checked); resetPage(); }} /> Só disponíveis
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
        <aside className="gd-side" aria-label="Categorias e filtros" ref={sidebar} tabIndex={0}>
          {filters}
        </aside>

        <div className="gd-cat-main" ref={results} tabIndex={-1} aria-label="Produtos do catálogo">
          <div className="gd-toolbar">
            <form
              className="gd-search gd-search-wide"
              role="search"
              onSubmit={(e) => {
                e.preventDefault();
                updateFilters({ q: text.trim() || null });
              }}
            >
              <Search size={15} aria-hidden="true" />
              <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Buscar produto ou código" aria-label="Buscar produto" />
            </form>
            <button type="button" className="gd-filter-btn" ref={filterButton} aria-haspopup="dialog" aria-expanded={panel} onClick={() => setPanel(true)}>
              <SlidersHorizontal size={15} /> Filtros{filtered ? " •" : ""}
            </button>
            <label className="gd-select">
              <span className="gd-sr">Ordenar por</span>
              <select aria-label="Ordenar por" value={c.sort} onChange={(e) => updateFilters({ sort: e.target.value === "destaques" ? null : e.target.value as SortKey })}>
                <option value="destaques">Destaques</option>
                <option value="nome">Nome (A–Z)</option>
                {!hidden && <option value="menor">Menor preço</option>}
                {!hidden && <option value="maior">Maior preço</option>}
              </select>
            </label>
          </div>
          <div className="gd-results-bar">
            <p className="gd-muted gd-count-line" role="status">
              {list.length > 0 ? `${start + 1}–${Math.min(start + pageSize, list.length)} de ` : ""}
              {list.length} {list.length === 1 ? "produto" : "produtos"}
              {c.q ? ` para “${c.q}”` : ""}
              {totalPages > 1 && <span className="gd-page-summary">Página {page} de {totalPages}</span>}
            </p>
            <label className="gd-page-size">
              Por página
              <select aria-label="Produtos por página" value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); resetPage(); }}>
                {[12, 24, 48].map((size) => <option key={size} value={size}>{size}</option>)}
              </select>
            </label>
          </div>
          {list.length ? (
            <>
              <div className="gd-grid gd-grid-3">
                {list.slice(start, start + pageSize).map((p) => (
                  <Card key={p.id} product={p} />
                ))}
              </div>
              {totalPages > 1 && (
                <nav className="gd-pagination" aria-label="Paginação do catálogo">
                  <button type="button" disabled={page === 1} onClick={() => changePage(page - 1)} aria-label="Página anterior">
                    <ChevronLeft size={16} aria-hidden="true" /><span>Anterior</span>
                  </button>
                  <div className="gd-page-numbers">
                    {pages.map((n, i) => (
                      <span key={n}>
                        {i > 0 && n - pages[i - 1] > 1 && <span className="gd-page-gap" aria-hidden="true">…</span>}
                        <button type="button" aria-label={`Página ${n}`} aria-current={n === page ? "page" : undefined} onClick={() => changePage(n)}>{n}</button>
                      </span>
                    ))}
                  </div>
                  <button type="button" disabled={page === totalPages} onClick={() => changePage(page + 1)} aria-label="Próxima página">
                    <span>Próxima</span><ChevronRight size={16} aria-hidden="true" />
                  </button>
                </nav>
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
        <div className="gd-sheet" role="dialog" aria-modal="true" aria-label="Filtros">
          <button type="button" className="gd-sheet-bg" tabIndex={-1} aria-label="Fechar" onClick={() => setPanel(false)} />
          <div className="gd-sheet-box" ref={sheet}>
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
