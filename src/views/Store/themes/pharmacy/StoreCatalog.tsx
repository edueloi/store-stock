import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Package, Search, X } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import { normalize, pageUrl, useShop } from "./core";
import { ProductCard, T } from "./parts";

const STEP = 12;

export default function StoreCatalog() {
  const { tenant, categories, active, config, hidden } = useShop();
  const [params, setParams] = useSearchParams();
  const q = params.get("q") || "";
  const cat = params.get("cat") || "";
  const sort = params.get("sort") || "featured";
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
  const currentCat = categories.find((c) => String(c.id) === cat);

  return (
    <div className="ph ph-page">
      <StoreSEO title={`${config.catalog_title || T.catalog} | ${tenant.name}`} description={config.catalog_description || T.sub} siteName={tenant.name} url={pageUrl()} />
      <div className="ph-wrap ph-cat-head">
        <h1>{currentCat ? currentCat.name : config.catalog_title || T.catalog}</h1>
        <p>{config.catalog_description || T.sub}</p>
      </div>

      <div className="ph-wrap ph-toolbar">
        <div className="ph-find">
          <label className="ph-sr" htmlFor="ph-q">Buscar no catálogo</label>
          <Search size={18} aria-hidden="true" />
          <input id="ph-q" value={q} onChange={(e) => update("q", e.target.value)} placeholder="Nome ou código do produto" />
          {q && <button type="button" aria-label="Limpar busca" onClick={() => update("q", "")}><X size={16} /></button>}
        </div>
        <label className="ph-sort">
          <span>Ordenar</span>
          <select value={sort} onChange={(e) => update("sort", e.target.value === "featured" ? "" : e.target.value)}>
            <option value="featured">Destaques</option>
            <option value="name">Nome (A-Z)</option>
            {!hidden && <option value="price_up">Menor preço</option>}
            {!hidden && <option value="price_down">Maior preço</option>}
          </select>
        </label>
      </div>

      <div className="ph-wrap">
        <div className="ph-filter-chips" role="group" aria-label="Filtrar por categoria">
          <button type="button" aria-pressed={!cat} onClick={() => update("cat", "")}>Todos</button>
          {categories.map((c) => (
            <button key={c.id} type="button" aria-pressed={cat === String(c.id)} onClick={() => update("cat", String(c.id))}>{c.name}</button>
          ))}
        </div>
        <p className="ph-count" role="status">{list.length} {list.length === 1 ? "produto encontrado" : "produtos encontrados"}</p>

        {list.length ? (
          <>
            <div className="ph-grid">{list.slice(0, shown).map((p) => <ProductCard key={p.id} product={p} />)}</div>
            {shown < list.length && (
              <div className="ph-loadmore">
                <button type="button" className="ph-btn ph-btn-soft" onClick={() => setShown((n) => n + STEP)}>
                  Ver mais produtos ({list.length - shown})
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="ph-emptybox">
            <Package size={42} aria-hidden="true" />
            <h2>{active.length ? "Nada encontrado" : "Catálogo em preparação"}</h2>
            <p>{active.length ? "Tente outro termo ou escolha outro departamento." : "Em breve, novos produtos por aqui."}</p>
            {(q || cat) && (
              <button type="button" className="ph-btn" onClick={() => setParams(new URLSearchParams())}>Limpar filtros</button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
