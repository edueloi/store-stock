import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Package, Search, SlidersHorizontal, X } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import { StoreButton } from "../../../../components/store/StoreButton";
import { normalize, pageUrl, useShop } from "./core";
import { ProductCard, T, Wave } from "./parts";

const STEP = 12;

export default function StoreCatalog() {
  const { tenant, categories, active, config, hidden } = useShop();
  const [params, setParams] = useSearchParams();
  const q = params.get("q") || "";
  const cat = params.get("cat") || "";
  const sort = params.get("sort") || "";
  const [shown, setShown] = useState(STEP);
  const [open, setOpen] = useState(false);
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
  const chips = categories.slice(0, 6);
  const pickCat = (value: string) => {
    update("cat", value);
    setOpen(false);
  };
  return (
    <div className="or or-page">
      <StoreSEO title={`${config.catalog_title || T.catalog} | ${tenant.name}`} description={config.catalog_description || T.sub} siteName={tenant.name} url={pageUrl()} />
      <header className="or-cathead">
        <div className="or-wrap or-cathead-in">
          <span className="or-over">{config.segment_label || T.tag}</span>
          <h1>{current ? current.name : config.catalog_title || T.catalog}</h1>
          <p>{config.catalog_description || T.sub}</p>
        </div>
        <Wave fill="var(--or-bg)" />
      </header>

      <div className="or-wrap">
        <div className="or-toolbar">
          <div className="or-find">
            <label className="or-sr" htmlFor="or-q">Buscar no catálogo</label>
            <Search size={18} aria-hidden="true" />
            <input id="or-q" value={q} onChange={(e) => update("q", e.target.value)} placeholder="Procure por nome ou código" />
            {q && <button type="button" aria-label="Limpar busca" onClick={() => update("q", "")}><X size={16} /></button>}
          </div>
          <StoreButton type="button" variant="outline" className="or-line" aria-expanded={open} onClick={() => setOpen(true)}>
            <SlidersHorizontal size={17} aria-hidden="true" /> Filtros
          </StoreButton>
        </div>

        <div className="or-chips" role="group" aria-label="Coleções">
          <button type="button" aria-pressed={!cat} onClick={() => update("cat", "")}>Tudo</button>
          {chips.map((c) => (
            <button key={c.id} type="button" aria-pressed={cat === String(c.id)} onClick={() => update("cat", String(c.id))}>{c.name}</button>
          ))}
          {current && !chips.some((c) => c.id === current.id) && <button type="button" aria-pressed="true" onClick={() => update("cat", "")}>{current.name} <X size={14} aria-hidden="true" /></button>}
          {categories.length > chips.length && <button type="button" className="or-chip-more" onClick={() => setOpen(true)}>+{categories.length - chips.length} mais</button>}
        </div>
        <p className="or-count" role="status">{list.length} {list.length === 1 ? "escolha" : "escolhas"}</p>

        {list.length ? (
          <>
            <div className="or-grid">{list.slice(0, shown).map((p, i) => <ProductCard key={p.id} product={p} index={i} />)}</div>
            {shown < list.length && (
              <div className="or-center">
                <StoreButton type="button" variant="outline" className="or-line" onClick={() => setShown((n) => n + STEP)}>Mostrar mais ({list.length - shown})</StoreButton>
              </div>
            )}
          </>
        ) : (
          <div className="or-emptybox">
            <Package size={40} aria-hidden="true" />
            <h2>{active.length ? "Nada por aqui ainda" : "Estamos colhendo novidades"}</h2>
            <p>{active.length ? "Tente outro termo ou explore outra coleção." : "Volte em breve para conhecer a seleção."}</p>
            {(q || cat) && <StoreButton type="button" className="or-cta" onClick={() => setParams(new URLSearchParams())}>Limpar filtros</StoreButton>}
          </div>
        )}
      </div>

      {open && (
        <div className="or-drawer-wrap or-filter-wrap">
          <button type="button" className="or-scrim" aria-label="Fechar filtros" onClick={() => setOpen(false)} />
          <aside className="or-drawer or-filter" aria-label="Filtros">
            <div className="or-drawer-head">
              <b>Filtros</b>
              <button type="button" className="or-iconbtn" aria-label="Fechar filtros" onClick={() => setOpen(false)}><X size={22} /></button>
            </div>
            <p className="or-drawer-title">Coleções</p>
            <div className="or-chips or-chips-col">
              <button type="button" aria-pressed={!cat} onClick={() => pickCat("")}>Tudo</button>
              {categories.map((c) => (
                <button key={c.id} type="button" aria-pressed={cat === String(c.id)} onClick={() => pickCat(String(c.id))}>{c.name}</button>
              ))}
            </div>
            <label className="or-drawer-title" htmlFor="or-sort">Ordenar por</label>
            <select id="or-sort" className="or-select" value={sort} onChange={(e) => update("sort", e.target.value)}>
              <option value="">Em destaque</option>
              <option value="name">Nome (A-Z)</option>
              {!hidden && <option value="price_up">Menor preço</option>}
              {!hidden && <option value="price_down">Maior preço</option>}
            </select>
            <StoreButton type="button" className="or-cta or-drawer-done" onClick={() => setOpen(false)}>Ver {list.length} {list.length === 1 ? "escolha" : "escolhas"}</StoreButton>
          </aside>
        </div>
      )}
    </div>
  );
}
