import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Package, Search, X } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import { normalize, pageUrl, useShop } from "./core";
import { ProductCard, Sprig, T } from "./parts";

const STEP = 12;

export default function StoreCatalog() {
  const { tenant, categories, active, config, hidden } = useShop();
  const [params, setParams] = useSearchParams();
  const q = params.get("q") || "";
  const cat = params.get("cat") || "";
  const sort = params.get("sort") || "";
  const [shown, setShown] = useState(STEP);
  useEffect(() => setShown(STEP), [q, cat, sort]);
  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: key === "q" });
  };
  const price = (p: (typeof active)[number]) => Number(p.discount_price ?? p.price);
  const list = active
    .filter((p) => (!cat || String(p.category_id) === cat) && normalize(`${p.name} ${p.sku || ""}`).includes(normalize(q.trim())))
    .sort((a, b) =>
      sort === "name" ? a.name.localeCompare(b.name, "pt-BR")
        : !hidden && sort === "price_up" ? price(a) - price(b)
        : !hidden && sort === "price_down" ? price(b) - price(a)
        : Number(b.is_featured) - Number(a.is_featured),
    );
  const current = categories.find((c) => String(c.id) === cat);
  return (
    <div className="or or-page">
      <StoreSEO title={`${config.catalog_title || T.catalog} | ${tenant.name}`} description={config.catalog_description || T.sub} siteName={tenant.name} url={pageUrl()} />
      <header className="or-cathead">
        <span className="or-over">{config.segment_label || T.tag}</span>
        <h1>{current ? current.name : config.catalog_title || T.catalog}</h1>
        <p>{config.catalog_description || T.sub}</p>
        <Sprig className="or-sprig" />
      </header>

      <div className="or-filters">
        <div className="or-find">
          <label className="or-sr" htmlFor="or-q">Buscar no catálogo</label>
          <Search size={18} aria-hidden="true" />
          <input id="or-q" value={q} onChange={(e) => update("q", e.target.value)} placeholder="Procure por nome ou código" />
          {q && <button type="button" aria-label="Limpar busca" onClick={() => update("q", "")}><X size={16} /></button>}
        </div>
        <div className="or-tabs" role="group" aria-label="Coleções">
          <button type="button" aria-pressed={!cat} onClick={() => update("cat", "")}>Tudo</button>
          {categories.map((c) => (
            <button key={c.id} type="button" aria-pressed={cat === String(c.id)} onClick={() => update("cat", String(c.id))}>{c.name}</button>
          ))}
        </div>
        <div className="or-meta">
          <span role="status">{list.length} {list.length === 1 ? "escolha" : "escolhas"}</span>
          <label>
            <span className="or-sr">Ordenar por</span>
            <select value={sort} onChange={(e) => update("sort", e.target.value)} aria-label="Ordenar por">
              <option value="">Em destaque</option>
              <option value="name">Nome (A-Z)</option>
              {!hidden && <option value="price_up">Menor preço</option>}
              {!hidden && <option value="price_down">Maior preço</option>}
            </select>
          </label>
        </div>
      </div>

      {list.length ? (
        <>
          <div className="or-masonry">{list.slice(0, shown).map((p, i) => <ProductCard key={p.id} product={p} index={i} />)}</div>
          {shown < list.length && (
            <div className="or-center"><button type="button" className="or-btn or-btn-line" onClick={() => setShown((n) => n + STEP)}>Mostrar mais ({list.length - shown})</button></div>
          )}
        </>
      ) : (
        <div className="or-emptybox">
          <Package size={40} aria-hidden="true" />
          <h2>{active.length ? "Nada por aqui ainda" : "Estamos colhendo novidades"}</h2>
          <p>{active.length ? "Tente outro termo ou explore outra coleção." : "Volte em breve para conhecer a seleção."}</p>
          {(q || cat) && <button type="button" className="or-btn" onClick={() => setParams(new URLSearchParams())}>Limpar filtros</button>}
        </div>
      )}
    </div>
  );
}
