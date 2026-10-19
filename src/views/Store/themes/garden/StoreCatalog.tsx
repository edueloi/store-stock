import { useEffect, useState } from "react";
import { Leaf, Search, SlidersHorizontal, X } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import { StoreButton } from "../../../../components/store/StoreButton";
import { useCatalog, useKit } from "./kit";
import { useShelves } from "./extras";
import { Card, Empty } from "./parts";

export default function StoreCatalog() {
  const { tenant, active, config, hidden } = useKit();
  const shelves = useShelves();
  const { q, cat, sort, setParam, list, shown, hasMore, more, clear } = useCatalog(12);
  const [open, setOpen] = useState(false);
  const current = shelves.find((c) => String(c.id) === cat);
  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [open]);
  const pick = (value: string) => {
    setParam("cat", value);
    setOpen(false);
  };
  return (
    <div className="garden-page">
      <StoreSEO title={`${config.catalog_title || "Catálogo"} - ${tenant.name}`} description={config.catalog_description || "Plantas e jardinagem"} image={tenant.banner_url || tenant.logo_url} url={typeof window !== "undefined" ? window.location.href : ""} siteName={tenant.name} />
      <div className="garden-wrap">
        <header className="garden-cat-head">
          <span className="garden-eyebrow"><Leaf size={14} aria-hidden="true" /> {current ? "Categoria" : "Todo o jardim"}</span>
          <h1>{current ? current.name : config.catalog_title || "Nosso catálogo"}</h1>
          <p>{config.catalog_description || "Plantas, vasos, substratos e ferramentas para cultivar."}</p>
        </header>
        <div className="garden-bar">
          <label className="garden-field">
            <Search size={17} aria-hidden="true" />
            <input value={q} onChange={(e) => setParam("q", e.target.value)} placeholder="Buscar planta ou produto" aria-label="Buscar no catálogo" />
            {q && <button type="button" aria-label="Limpar busca" onClick={() => setParam("q", "")}><X size={15} /></button>}
          </label>
          <StoreButton type="button" variant="outline" className="garden-ghost" onClick={() => setOpen(true)} aria-haspopup="dialog">
            <SlidersHorizontal size={17} aria-hidden="true" /> Filtrar e ordenar
          </StoreButton>
          {current && (
            <button type="button" className="garden-active" onClick={() => setParam("cat", "")} aria-label={`Remover filtro ${current.name}`}>
              {current.name} <X size={14} aria-hidden="true" />
            </button>
          )}
          <span className="garden-count" role="status">{list.length} {list.length === 1 ? "resultado" : "resultados"}</span>
        </div>
        {shown.length ? (
          <>
            <div className="garden-grid">{shown.map((p) => <Card key={p.id} product={p} />)}</div>
            {hasMore && <div className="garden-center"><StoreButton variant="outline" className="garden-ghost" onClick={more}>Mostrar mais</StoreButton></div>}
          </>
        ) : (
          <Empty title="Nada brotou por aqui" text="Tente outra palavra ou outra categoria." action={<StoreButton className="garden-cta" onClick={clear}>Limpar filtros</StoreButton>} />
        )}
      </div>
      {open && (
        <div className="garden-sheet-back" onClick={() => setOpen(false)}>
          <aside className="garden-sheet" role="dialog" aria-modal="true" aria-label="Filtros" onClick={(e) => e.stopPropagation()}>
            <header>
              <h2>Filtros</h2>
              <button type="button" aria-label="Fechar filtros" onClick={() => setOpen(false)}><X size={20} /></button>
            </header>
            <h3>Categoria</h3>
            <div className="garden-sheet-list">
              <button type="button" aria-pressed={!cat} onClick={() => pick("")}>Todas <b>{active.length}</b></button>
              {shelves.map((c) => (
                <button key={c.id} type="button" aria-pressed={String(c.id) === cat} onClick={() => pick(String(c.id))}>{c.name} <b>{c.count}</b></button>
              ))}
            </div>
            <h3>Ordenar por</h3>
            <div className="garden-sheet-list">
              {[["featured", "Destaques"], ["name", "Nome (A-Z)"], ...(hidden ? [] : [["price_up", "Menor preço"], ["price_down", "Maior preço"]])].map(([v, l]) => (
                <button key={v} type="button" aria-pressed={sort === v} onClick={() => { setParam("sort", v); setOpen(false); }}>{l}</button>
              ))}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
