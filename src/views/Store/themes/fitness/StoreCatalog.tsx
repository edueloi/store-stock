import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { LayoutGrid, List as ListIcon, Plus, ArrowRight } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import SearchBar from "../../../../components/layout/SearchBar";
import Card, { Price } from "./Card";
import { groups, imageOf, norm, priceOf, useKit } from "./lib";
import { availableUnits } from "../../../../utils/storeStock";
import "./styles.css";

const PAGE = 12;

export default function StoreCatalog() {
  const { tenant, active, categories, sf, hidden, countIn, catName, productPath, soldOut, addToCart, openCart, tracks, cart } = useKit();
  const [params, setParams] = useSearchParams();
  const q = params.get("q") || "";
  const cat = params.get("cat") || params.get("categoria") || "";
  const sort = params.get("sort") || "featured";
  const [view, setView] = useState<"grid" | "list">("grid");
  const [limit, setLimit] = useState(PAGE);
  useEffect(() => setLimit(PAGE), [q, cat, sort]);

  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (key === "cat") next.delete("categoria");
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: key === "q" });
  };

  const visible = useMemo(() => {
    const term = norm(q.trim());
    const list = active.filter((p) => (!cat || String(p.category_id) === cat) && (!term || norm(`${p.name} ${p.sku || ""} ${p.description || ""}`).includes(term)));
    const by = (fn: (a: (typeof list)[number], b: (typeof list)[number]) => number) => [...list].sort(fn);
    if (!hidden && sort === "menor") return by((a, b) => priceOf(a).price - priceOf(b).price);
    if (!hidden && sort === "maior") return by((a, b) => priceOf(b).price - priceOf(a).price);
    if (sort === "nome") return by((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    return by((a, b) => Number(b.is_featured) - Number(a.is_featured));
  }, [active, q, cat, sort]);

  const selected = categories.find((c) => String(c.id) === cat);

  return (
    <main className="ft-root">
      <StoreSEO
        title={`${selected?.name || sf.catalog_title || "Catálogo"} | ${tenant.name}`}
        description={sf.catalog_description || tenant.about_text || `Produtos da ${tenant.name}.`}
        url={typeof window !== "undefined" ? window.location.href : ""}
        siteName={tenant.name}
      />
      <div className="ft-wrap">
        <div className="ft-cat-head">
          <span className="ft-tag">{sf.segment_label || "Fitness"} · catálogo</span>
          <h1 className="ft-h1">{selected?.name || sf.catalog_title || "Catálogo"}</h1>
          <p>{sf.catalog_description || "Filtre por categoria, busque pelo nome e monte o pedido ideal para o seu treino."}</p>
        </div>
      </div>
      <div className="ft-toolbar">
        <div className="ft-wrap">
          <div className="ft-tabs" role="group" aria-label="Categorias">
            <button className="ft-tab" aria-pressed={!cat} onClick={() => update("cat", "")}>Todos ({active.length})</button>
            {categories.filter((c) => countIn(c.id) > 0).map((c) => (
              <button key={c.id} className="ft-tab" aria-pressed={cat === String(c.id)} onClick={() => update("cat", String(c.id))}>{c.name} ({countIn(c.id)})</button>
            ))}
          </div>
          <div className="ft-controls">
            <div className="ft-s"><SearchBar value={q} onChange={(v) => update("q", v)} placeholder="Buscar por nome ou código" /></div>
            <label className="ft-sr" htmlFor="ft-sort">Ordenar</label>
            <select id="ft-sort" className="ft-select" value={sort} onChange={(e) => update("sort", e.target.value === "featured" ? "" : e.target.value)}>
              <option value="featured">Destaques</option>
              {!hidden && <option value="menor">Menor preço</option>}
              {!hidden && <option value="maior">Maior preço</option>}
              <option value="nome">Nome (A-Z)</option>
            </select>
            <div className="ft-view" role="group" aria-label="Modo de exibição">
              <button aria-pressed={view === "grid"} aria-label="Ver em grade" onClick={() => setView("grid")}><LayoutGrid size={19} /></button>
              <button aria-pressed={view === "list"} aria-label="Ver em lista" onClick={() => setView("list")}><ListIcon size={19} /></button>
            </div>
          </div>
        </div>
      </div>

      <div className="ft-wrap">
        <section className="ft-results" aria-live="polite">
          <p className="ft-count-line">{visible.length} {visible.length === 1 ? "resultado" : "resultados"}{q && ` · "${q}"`}</p>
          {visible.length === 0 ? (
            <div className="ft-empty">
              <h3>Nenhum resultado</h3>
              <p>Não encontramos produtos com esses filtros.</p>
              <button className="ft-btn" onClick={() => setParams(params.get("previewTheme") ? { previewTheme: params.get("previewTheme") as string } : {})}>Limpar filtros</button>
            </div>
          ) : view === "grid" ? (
            <div className="ft-grid">{visible.slice(0, limit).map((p) => <Card key={p.id} product={p} />)}</div>
          ) : (
            <div className="ft-list">
              {visible.slice(0, limit).map((p) => {
                const out = soldOut(p);
                const stock = tracks ? availableUnits(p) : null;
                const already = cart.filter((item) => item.id === p.id).reduce((total, item) => total + item.quantity, 0);
                const quickUnavailable = out || (stock !== null && stock <= already);
                const choices = groups(p).length > 0;
                return (
                  <article className={`ft-li${out ? " ft-out" : ""}`} key={p.id}>
                    <Link to={productPath(p)} className="ft-li-img" aria-label={p.name}>{imageOf(p) && <img src={imageOf(p)} alt="" loading="lazy" />}</Link>
                    <div className="ft-li-info">
                      <span className="ft-card-cat">{catName(p.category_id) || "Geral"}{out ? " · esgotado" : ""}</span>
                      <Link to={productPath(p)} className="ft-card-name">{p.name}</Link>
                    </div>
                    <div className="ft-li-side">
                      <Price product={p} hidden={hidden} />
                      {choices || quickUnavailable ? (
                        <Link to={productPath(p)} className="ft-add" aria-label={`Ver opções de ${p.name}`}><ArrowRight size={18} /></Link>
                      ) : (
                        <button className="ft-add" aria-label={`Adicionar ${p.name} ao carrinho`} onClick={() => { if (quickUnavailable) return; addToCart(p); openCart(); }}><Plus size={20} /></button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
          {limit < visible.length && (
            <div className="ft-more-btn">
              <button className="ft-btn ft-btn--line" onClick={() => setLimit((l) => l + PAGE)}><Plus size={16} /> Carregar mais ({visible.length - limit})</button>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
