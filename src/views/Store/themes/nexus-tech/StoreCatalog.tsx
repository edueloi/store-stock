import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { PackageSearch, Search, SlidersHorizontal, X } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import { useStore } from "../../StoreLayout";
import { Card } from "./parts";
import { groups, hasOffer, unitPrice, useTheme } from "./lib";
import "./styles.css";

const PAGE = 12;

export default function StoreCatalog() {
  const { tenant, products, categories } = useStore();
  const [params, setParams] = useSearchParams();
  const { path } = useTheme();
  const sf = tenant.policies?.storefront || {};
  const q = params.get("q") || "";
  const catRaw = params.get("cat") || params.get("categoria");
  const cat = catRaw ? Number(catRaw) : null;
  const sort = params.get("ordem") || "destaque";
  const onlyOffers = params.get("ofertas") === "1";
  const [text, setText] = useState(q);
  const [limit, setLimit] = useState(PAGE);
  const [drawer, setDrawer] = useState(false);

  useEffect(() => setText(q), [q]);
  useEffect(() => setLimit(PAGE), [q, cat, sort, onlyOffers]);

  const active = useMemo(() => products.filter((p) => p.is_active && p.type !== "internal"), [products]);
  const cats = useMemo(
    () => categories.filter((c) => active.some((p) => p.category_id === c.id)),
    [categories, active],
  );

  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    const out = active.filter((p) => {
      if (cat && p.category_id !== cat) return false;
      if (onlyOffers && !hasOffer(p)) return false;
      if (!term) return true;
      const hay = [p.name, p.sku, p.description, ...groups(p).flatMap((g) => g.values)].join(" ").toLowerCase();
      return hay.includes(term);
    });
    if (sort === "menor") out.sort((a, b) => unitPrice(a) - unitPrice(b));
    else if (sort === "maior") out.sort((a, b) => unitPrice(b) - unitPrice(a));
    else if (sort === "nome") out.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    else out.sort((a, b) => Number(b.is_featured) - Number(a.is_featured));
    return out;
  }, [active, cat, q, sort, onlyOffers]);

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
  const title = current ? current.name : sf.catalog_title || "Todos os produtos";
  const desc = sf.catalog_description || "Uma seleção pensada para quem escolhe com critério.";
  const filtered = Boolean(q || cat || onlyOffers);

  return (
    <main className="nx-page">
      <StoreSEO
        title={`${title} — ${tenant.name}`}
        description={desc}
        url={typeof window !== "undefined" ? window.location.href : ""}
        siteName={tenant.name}
      />
      <section className="nx-cat-hero">
        <div className="nx-wrap">
          <p className="nx-crumb"><Link to={path()}>Início</Link> / <span>Catálogo</span></p>
          <h1>{title}</h1>
          <p>{desc}</p>
        </div>
      </section>

      <div className="nx-filterbar">
        <div className="nx-wrap nx-filter-in">
          <form
            role="search"
            className="nx-find"
            onSubmit={(e) => {
              e.preventDefault();
              update({ q: text.trim() || null });
            }}
          >
            <Search size={18} aria-hidden="true" />
            <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Buscar no catálogo" aria-label="Buscar no catálogo" />
          </form>
          <button type="button" className="nx-filter-btn" aria-haspopup="dialog" aria-expanded={drawer} onClick={() => setDrawer(true)}>
            <SlidersHorizontal size={17} aria-hidden="true" /> Filtros{filtered ? <b>{Number(Boolean(q)) + Number(Boolean(cat)) + Number(onlyOffers)}</b> : null}
          </button>
          <label className="nx-select">
            <span className="nx-sr">Ordenar por</span>
            <select value={sort} onChange={(e) => update({ ordem: e.target.value === "destaque" ? null : e.target.value })}>
              <option value="destaque">Destaques</option>
              <option value="menor">Menor preço</option>
              <option value="maior">Maior preço</option>
              <option value="nome">Nome (A–Z)</option>
            </select>
          </label>
        </div>
        {filtered && (
          <div className="nx-wrap nx-active">
            {q && <button type="button" onClick={() => update({ q: null })}>“{q}” <X size={13} aria-hidden="true" /></button>}
            {current && <button type="button" onClick={() => update({ cat: null })}>{current.name} <X size={13} aria-hidden="true" /></button>}
            {onlyOffers && <button type="button" onClick={() => update({ ofertas: null })}>Em oferta <X size={13} aria-hidden="true" /></button>}
          </div>
        )}
      </div>

      {drawer && (
        <div className="nx-drawer" role="dialog" aria-modal="true" aria-label="Filtros">
          <button type="button" className="nx-drawer-bg" aria-label="Fechar filtros" onClick={() => setDrawer(false)} />
          <div className="nx-drawer-panel">
            <header>
              <h2>Filtros</h2>
              <button type="button" className="nx-ico" aria-label="Fechar filtros" onClick={() => setDrawer(false)}><X size={22} /></button>
            </header>
            <div className="nx-drawer-body">
              <p className="nx-drawer-h">Categoria</p>
              <div className="nx-pills" role="group" aria-label="Categorias">
                <button type="button" aria-pressed={!cat} className={!cat ? "is-on" : ""} onClick={() => update({ cat: null })}>Todos</button>
                {cats.map((c) => (
                  <button key={c.id} type="button" aria-pressed={cat === c.id} className={cat === c.id ? "is-on" : ""} onClick={() => update({ cat: String(c.id) })}>
                    {c.name}
                  </button>
                ))}
              </div>
              <p className="nx-drawer-h">Condição</p>
              <button type="button" aria-pressed={onlyOffers} className={`nx-toggle ${onlyOffers ? "is-on" : ""}`} onClick={() => update({ ofertas: onlyOffers ? null : "1" })}>
                Somente produtos em oferta
              </button>
            </div>
            <footer>
              <button type="button" className="nx-btn nx-btn-ghost" onClick={() => update({ q: null, cat: null, ofertas: null })}>Limpar</button>
              <button type="button" className="nx-btn" onClick={() => setDrawer(false)}>Ver {list.length} {list.length === 1 ? "produto" : "produtos"}</button>
            </footer>
          </div>
        </div>
      )}

      <section className="nx-wrap nx-cat-body">
        <div className="nx-cat-meta">
          <span>{list.length} {list.length === 1 ? "produto" : "produtos"}</span>
          {filtered && (
            <button type="button" onClick={() => update({ q: null, cat: null, ofertas: null })}>
              <X size={14} aria-hidden="true" /> Limpar filtros
            </button>
          )}
        </div>
        {list.length ? (
          <>
            <div className="nx-grid">
              {list.slice(0, limit).map((p) => <Card key={p.id} product={p} />)}
            </div>
            {limit < list.length && (
              <div className="nx-more">
                <button type="button" className="nx-btn nx-btn-ghost nx-btn-lg" onClick={() => setLimit((l) => l + PAGE)}>
                  Ver mais produtos
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="nx-emptybox">
            <PackageSearch size={40} aria-hidden="true" />
            <h2>Nenhum produto encontrado</h2>
            <p>Ajuste a busca ou os filtros para ver mais opções.</p>
            <button type="button" className="nx-btn" onClick={() => update({ q: null, cat: null, ofertas: null })}>Limpar filtros</button>
          </div>
        )}
      </section>
    </main>
  );
}
