import { useState, type FormEvent } from "react";
import { LayoutGrid, List, Stethoscope, X } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import { isSoldOut, useCatalogFilters, useShop } from "./lib";
import { SupplyCard } from "./parts";

export default function StoreCatalog() {
  const { tenant, categories, active, hidden, sf, vars } = useShop();
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [view, setView] = useState<"grid" | "list">("grid");
  const pool = onlyAvailable ? active.filter((p) => !isSoldOut(tenant, p)) : active;
  const f = useCatalogFilters(pool, 24);
  const [term, setTerm] = useState(f.q);
  const title = sf.catalog_title || "Catálogo de materiais";
  const description = sf.catalog_description || "Filtre por especialidade, confira códigos e disponibilidade e monte seu pedido de suprimentos.";
  const specs = categories.filter((c) => active.some((p) => p.category_id === c.id));
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
      <div className="ms-wrap">
        <form className="ms-filters" role="search" onSubmit={submit}>
          <div className="ms-field">
            <label htmlFor="ms-q">Buscar</label>
            <input id="ms-q" type="search" value={term} onChange={(e) => setTerm(e.target.value)} onBlur={() => term.trim() !== f.q && f.update("q", term.trim())} placeholder="Nome, código ou descrição" autoComplete="off" />
          </div>
          <div className="ms-field">
            <label htmlFor="ms-cat">Especialidade</label>
            <select id="ms-cat" value={f.cat} onChange={(e) => f.update("cat", e.target.value)}>
              <option value="">Todas</option>
              {specs.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
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
          <div className="ms-viewtoggle" role="group" aria-label="Modo de exibição">
            <button type="button" aria-label="Exibir em grade" aria-pressed={view === "grid"} onClick={() => setView("grid")}><LayoutGrid size={19} /></button>
            <button type="button" aria-label="Exibir em lista" aria-pressed={view === "list"} onClick={() => setView("list")}><List size={19} /></button>
          </div>
        </form>
        <div className="ms-activebar">
          <span><strong>{f.filtered.length}</strong> {f.filtered.length === 1 ? "material encontrado" : "materiais encontrados"}</span>
          {f.q && <button className="ms-pill" onClick={() => { setTerm(""); f.update("q", ""); }}>&ldquo;{f.q}&rdquo; <X size={14} aria-hidden /><span className="sr-only" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>remover busca</span></button>}
          {currentCat && <button className="ms-pill" onClick={() => f.update("cat", "")}>{currentCat.name} <X size={14} aria-hidden /><span style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>remover filtro</span></button>}
        </div>
        {f.visible.length ? (
          <>
            <div className={view === "grid" ? "ms-grid" : "ms-list"}>{f.visible.map((p) => <SupplyCard key={p.id} product={p} />)}</div>
            {f.hasMore ? <div className="ms-more"><button className="ms-btn ghost" onClick={f.more}>Mostrar mais ({f.filtered.length - f.visible.length})</button></div> : <div style={{ height: 64 }} />}
          </>
        ) : (
          <div className="ms-empty" style={{ marginBottom: 64 }}>
            <Stethoscope size={40} color="var(--ms-accent)" />
            <h2 className="ms-serif">{active.length ? "Nenhum material encontrado" : "Catálogo em atualização"}</h2>
            <p>{active.length ? "Revise a busca ou escolha outra especialidade." : "Ainda não há materiais publicados nesta loja."}</p>
            {active.length > 0 && <button className="ms-btn" onClick={reset}>Limpar filtros</button>}
          </div>
        )}
      </div>
    </main>
  );
}
