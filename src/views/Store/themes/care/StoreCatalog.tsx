import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Package, Search, X } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import { StoreButton } from "../../../../components/store/StoreButton";
import { normalize, pageUrl, useShop } from "./core";
import { categoryIcon, ProductCard, T } from "./parts";

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
  const filtering = Boolean(q.trim() || cat);
  const current = categories.find((c) => String(c.id) === cat);

  return (
    <div className="ca ca-page">
      <StoreSEO title={`${config.catalog_title || T.catalog} | ${tenant.name}`} description={config.catalog_description || T.sub} siteName={tenant.name} url={pageUrl()} />
      <header className="ca-cat-head">
        <span className="ca-eyebrow">{config.segment_label || T.tag}</span>
        <h1>{current ? current.name : config.catalog_title || T.catalog}</h1>
        <p>{config.catalog_description || T.sub}</p>
      </header>

      <div className="ca-filter">
        <div className="ca-finder">
          <label className="ca-sr" htmlFor="ca-q">Buscar no catálogo</label>
          <Search size={19} aria-hidden="true" />
          <input id="ca-q" value={q} onChange={(e) => update("q", e.target.value)} placeholder="Buscar produtos" />
          {q && <button type="button" aria-label="Limpar busca" onClick={() => update("q", "")}><X size={17} /></button>}
        </div>
        <label className="ca-sort">
          <span className="ca-sr">Ordenar por</span>
          <select value={sort} onChange={(e) => update("sort", e.target.value)} aria-label="Ordenar por">
            <option value="">Destaques</option>
            <option value="name">Nome (A-Z)</option>
            {!hidden && <option value="price_up">Menor preço</option>}
            {!hidden && <option value="price_down">Maior preço</option>}
          </select>
        </label>
        <div className="ca-chips" role="group" aria-label="Categorias">
          <button type="button" aria-pressed={!cat} onClick={() => update("cat", "")}>Tudo</button>
          {categories.map((c, i) => {
            const Icon = categoryIcon(i);
            return (
              <button key={c.id} type="button" aria-pressed={cat === String(c.id)} onClick={() => update("cat", String(c.id))}>
                <Icon size={16} aria-hidden="true" /> {c.name}
              </button>
            );
          })}
        </div>
      </div>

      <section className="ca-block ca-all">
        <h2 className="ca-h2">{filtering ? "Resultados" : "Todos os produtos"} <small>({list.length})</small></h2>
        {list.length ? (
          <>
            <div className="ca-grid">{list.slice(0, shown).map((p) => <ProductCard key={p.id} product={p} />)}</div>
            {shown < list.length && (
              <div className="ca-more">
                <StoreButton type="button" size="lg" className="ca-b ca-b-line" onClick={() => setShown((n) => n + STEP)}>Ver mais</StoreButton>
              </div>
            )}
          </>
        ) : (
          <div className="ca-emptybox">
            <Package size={40} aria-hidden="true" />
            <h3>{active.length ? "Não encontramos nada por aqui" : "Estamos preparando o catálogo"}</h3>
            <p>{active.length ? "Experimente outro termo ou volte para todas as categorias." : "Volte em breve para conhecer nossa seleção."}</p>
            {filtering && <StoreButton type="button" className="ca-b ca-b-solid" onClick={() => setParams(new URLSearchParams())}>Limpar filtros</StoreButton>}
          </div>
        )}
      </section>
    </div>
  );
}
