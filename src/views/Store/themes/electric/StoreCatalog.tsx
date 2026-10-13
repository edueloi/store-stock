import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { PackageSearch, Search, X } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import { useStore } from "../../StoreLayout";
import { ProductRow } from "./parts";
import { groups, unitPrice, useTheme } from "./lib";
import "./styles.css";

const PAGE = 20;

export default function StoreCatalog() {
  const { tenant, products, categories } = useStore();
  const [params, setParams] = useSearchParams();
  const { path } = useTheme();
  const sf = tenant.policies?.storefront || {};
  const q = params.get("q") || "";
  const catRaw = params.get("cat") || params.get("categoria");
  const cat = catRaw ? Number(catRaw) : null;
  const sort = params.get("ordem") || "nome";
  const [text, setText] = useState(q);
  const [limit, setLimit] = useState(PAGE);

  useEffect(() => setText(q), [q]);
  useEffect(() => setLimit(PAGE), [q, cat, sort]);

  const active = useMemo(() => products.filter((p) => p.is_active && p.type !== "internal"), [products]);
  const cats = useMemo(
    () =>
      categories
        .map((c) => ({ ...c, count: active.filter((p) => p.category_id === c.id).length }))
        .filter((c) => c.count > 0),
    [categories, active],
  );

  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    const out = active.filter((p) => {
      if (cat && p.category_id !== cat) return false;
      if (!term) return true;
      const hay = [p.name, p.sku, p.barcode, p.description, ...groups(p).flatMap((g) => [g.name, ...g.values])].join(" ").toLowerCase();
      return hay.includes(term);
    });
    if (sort === "menor") out.sort((a, b) => unitPrice(a) - unitPrice(b));
    else if (sort === "maior") out.sort((a, b) => unitPrice(b) - unitPrice(a));
    else out.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    return out;
  }, [active, cat, q, sort]);

  const update = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    next.delete("categoria");
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    setParams(next, { replace: true });
  };
  const current = cats.find((c) => c.id === cat);
  const title = current ? current.name : sf.catalog_title || "Catálogo de materiais";
  const desc = sf.catalog_description || "Busque por nome ou código, confira a especificação e adicione ao pedido.";

  return (
    <main className="ep-page">
      <StoreSEO
        title={`${title} — ${tenant.name}`}
        description={desc}
        url={typeof window !== "undefined" ? window.location.href : ""}
        siteName={tenant.name}
      />
      <div className="ep-wrap ep-cat-head">
        <p className="ep-crumb">
          <Link to={path()}>Início</Link> / <span>Catálogo</span>
        </p>
        <h1>{title}</h1>
        <p>{desc}</p>
      </div>

      <div className="ep-wrap ep-cat-layout">
        <aside className="ep-side" aria-label="Filtrar por tipo">
          <p className="ep-side-h">Tipo de material</p>
          <button type="button" className={!cat ? "is-on" : ""} onClick={() => update({ cat: null })}>
            <span>Todos</span>
            <b>{active.length}</b>
          </button>
          {cats.map((c) => (
            <button key={c.id} type="button" className={cat === c.id ? "is-on" : ""} onClick={() => update({ cat: String(c.id) })}>
              <span>{c.name}</span>
              <b>{c.count}</b>
            </button>
          ))}
        </aside>

        <section className="ep-cat-main">
          <div className="ep-toolbar">
            <form
              role="search"
              onSubmit={(e) => {
                e.preventDefault();
                update({ q: text.trim() || null });
              }}
            >
              <Search size={18} aria-hidden="true" />
              <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Nome, código, bitola, voltagem..." aria-label="Buscar no catálogo" />
              <button type="submit">Buscar</button>
            </form>
            <label className="ep-sort">
              <span>Ordenar</span>
              <select value={sort} onChange={(e) => update({ ordem: e.target.value === "nome" ? null : e.target.value })}>
                <option value="nome">Nome (A–Z)</option>
                <option value="menor">Menor preço</option>
                <option value="maior">Maior preço</option>
              </select>
            </label>
          </div>

          <div className="ep-cat-meta">
            <span>
              {list.length} {list.length === 1 ? "material encontrado" : "materiais encontrados"}
            </span>
            {(q || cat) && (
              <button type="button" onClick={() => update({ q: null, cat: null })}>
                <X size={14} aria-hidden="true" /> Limpar filtros
              </button>
            )}
          </div>

          {list.length ? (
            <>
              <div className="ep-table">
                <div className="ep-table-head" aria-hidden="true">
                  <span /><span>Código</span><span>Material</span><span>Preço</span><span />
                </div>
                {list.slice(0, limit).map((p) => <ProductRow key={p.id} product={p} />)}
              </div>
              {limit < list.length && (
                <button type="button" className="ep-more" onClick={() => setLimit((l) => l + PAGE)}>
                  Ver mais materiais ({list.length - limit} restantes)
                </button>
              )}
            </>
          ) : (
            <div className="ep-emptybox">
              <PackageSearch size={36} aria-hidden="true" />
              <p>Nenhum material encontrado.</p>
              <span>Tente outro nome, código ou tipo de material.</span>
              <button type="button" className="ep-btn" onClick={() => update({ q: null, cat: null })}>Limpar filtros</button>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
