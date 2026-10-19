import { useState, type FormEvent } from "react";
import { LayoutGrid, List, SlidersHorizontal, Stethoscope, X } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import { StoreButton } from "../../../../components/store/StoreButton";
import { isSoldOut, useCatalogFilters, useShop } from "./lib";
import { SupplyCard } from "./parts";

export default function StoreCatalog() {
  const { tenant, categories, active, hidden, sf, vars } = useShop();
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [view, setView] = useState<"grid" | "list">("grid");
  const [drawer, setDrawer] = useState(false);
  const pool = onlyAvailable ? active.filter((p) => !isSoldOut(tenant, p)) : active;
  const f = useCatalogFilters(pool, 24);
  const [term, setTerm] = useState(f.q);
  const title = sf.catalog_title || "Catálogo de materiais";
  const description = sf.catalog_description || "Filtre por especialidade, confira códigos e disponibilidade e monte seu pedido de suprimentos.";
  const specs = categories
    .map((c) => ({ ...c, count: pool.filter((p) => p.category_id === c.id).length }))
    .filter((c) => active.some((p) => p.category_id === c.id));
  const currentCat = categories.find((c) => String(c.id) === f.cat);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    f.update("q", term.trim());
  };
  const reset = () => {
    setTerm("");
    setOnlyAvailable(false);
    f.clear();
  };
  const pick = (id: string) => {
    f.update("cat", id);
    setDrawer(false);
  };
  const sideList = (
    <>
      <h2>Especialidades</h2>
      <button aria-pressed={f.cat === ""} onClick={() => pick("")}>Todas<em>{pool.length}</em></button>
      {specs.map((c) => (
        <button key={c.id} aria-pressed={f.cat === String(c.id)} onClick={() => pick(String(c.id))}>{c.name}<em>{c.count}</em></button>
      ))}
    </>
  );
  return (
    <main className="ms-scope ms-page" style={vars}>
      <StoreSEO title={`${title} | ${tenant.name}`} description={description} url={typeof window !== "undefined" ? window.location.href : ""} siteName={tenant.name} />
      <section className="ms-pagehead">
        <div className="ms-wrap">
          <span className="ms-eyebrow">Suprimentos profissionais</span>
          <h1 className="ms-serif">{title}</h1>
          <p>{description}</p>
        </div>
      </section>
      <div className="ms-wrap ms-cat-layout">
        <aside className="ms-sidebar" aria-label="Filtrar por especialidade">{sideList}</aside>
        <div className="ms-cat-main">
          <form className="ms-filters" role="search" onSubmit={submit}>
            <div className="ms-field ms-field-q">
              <label htmlFor="ms-q">Buscar</label>
              <input id="ms-q" type="search" value={term} onChange={(e) => setTerm(e.target.value)} onBlur={() => term.trim() !== f.q && f.update("q", term.trim())} placeholder="Nome, código ou descrição" autoComplete="off" />
            </div>
            <div className="ms-field">
              <label htmlFor="ms-sort">Ordenar por</label>
              <select id="ms-sort" value={f.sort} onChange={(e) => f.update("sort", e.target.value === "destaque" ? "" : e.target.value)}>
                <option value="destaque">Destaques</option>
                <option value="nome">Nome (A-Z)</option>
                {!hidden && <option value="menor">Menor preço</option>}
                {!hidden && <option value="maior">Maior preço</option>}
              </select>
            </div>
            <label className="ms-check"><input type="checkbox" checked={onlyAvailable} onChange={(e) => setOnlyAvailable(e.target.checked)} />Só disponíveis</label>
            <button type="button" className="ms-filterbtn" onClick={() => setDrawer(true)}><SlidersHorizontal size={18} />Especialidades</button>
            <div className="ms-viewtoggle" role="group" aria-label="Modo de exibição">
              <button type="button" aria-label="Exibir em grade" aria-pressed={view === "grid"} onClick={() => setView("grid")}><LayoutGrid size={19} /></button>
              <button type="button" aria-label="Exibir em lista" aria-pressed={view === "list"} onClick={() => setView("list")}><List size={19} /></button>
            </div>
          </form>
          <div className="ms-activebar">
            <span><strong>{f.filtered.length}</strong> {f.filtered.length === 1 ? "material encontrado" : "materiais encontrados"}</span>
            {f.q && <button className="ms-pill" onClick={() => { setTerm(""); f.update("q", ""); }}>&ldquo;{f.q}&rdquo; <X size={14} aria-hidden /><span className="sr-only">remover busca</span></button>}
            {currentCat && <button className="ms-pill" onClick={() => f.update("cat", "")}>{currentCat.name} <X size={14} aria-hidden /><span className="sr-only">remover filtro</span></button>}
          </div>
          {f.visible.length ? (
            <>
              <div className={view === "grid" ? "ms-grid" : "ms-list"}>{f.visible.map((p) => <SupplyCard key={p.id} product={p} />)}</div>
              {f.hasMore ? (
                <div className="ms-more">
                  <StoreButton variant="outline" shape="soft" size="md" className="ms-obtn" onClick={f.more}>Mostrar mais ({f.filtered.length - f.visible.length})</StoreButton>
                </div>
              ) : <div style={{ height: 64 }} />}
            </>
          ) : (
            <div className="ms-empty" style={{ marginBottom: 64 }}>
              <Stethoscope size={40} color="var(--ms-accent)" />
              <h2 className="ms-serif">{active.length ? "Nenhum material encontrado" : "Catálogo em atualização"}</h2>
              <p>{active.length ? "Revise a busca ou escolha outra especialidade." : "Ainda não há materiais publicados nesta loja."}</p>
              {active.length > 0 && <StoreButton shape="soft" size="md" className="ms-fbtn" onClick={reset}>Limpar filtros</StoreButton>}
            </div>
          )}
        </div>
      </div>
      {drawer && (
        <div className="ms-overlay" onClick={() => setDrawer(false)}>
          <div className="ms-drawer ms-drawer-filter" role="dialog" aria-label="Especialidades" onClick={(e) => e.stopPropagation()}>
            <div className="ms-drawer-head"><b>Especialidades</b><button aria-label="Fechar" onClick={() => setDrawer(false)}><X size={21} /></button></div>
            <div className="ms-sidelist">{sideList}</div>
          </div>
        </div>
      )}
    </main>
  );
}
