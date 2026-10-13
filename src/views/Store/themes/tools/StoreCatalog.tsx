import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Hammer, Search } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import { useCatalogFilters, useShop } from "./lib";
import { Sidebar, ToolCard } from "./parts";

const hiddenLabel = { position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" } as const;

export default function StoreCatalog() {
  const { tenant, categories, active, hidden, sf, path, vars } = useShop();
  const f = useCatalogFilters(active, 20);
  const [term, setTerm] = useState(f.q);
  const title = sf.catalog_title || "Materiais para seu projeto";
  const description = sf.catalog_description || "Escolha por departamento, confira a ficha técnica e monte sua lista de materiais.";
  const dept = categories.find((c) => String(c.id) === f.cat)?.name;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    f.update("q", term.trim());
  };
  const reset = () => {
    setTerm("");
    f.clear();
  };
  return (
    <main className="op-scope op-page" style={vars}>
      <StoreSEO title={`${dept ? `${dept} | ` : ""}${title} | ${tenant.name}`} description={description} url={typeof window !== "undefined" ? window.location.href : ""} siteName={tenant.name} />
      <div className="op-wrap">
        <nav className="op-crumbs" aria-label="Você está em">
          <Link to={path()}>Início</Link>/<Link to={path("/catalogo")}>Catálogo</Link>{dept && <>/<span>{dept}</span></>}
        </nav>
        <div className="op-shell" style={{ paddingTop: 12 }}>
          <Sidebar selected={f.cat} onSelect={(id) => f.update("cat", id)} />
          <section style={{ minWidth: 0 }}>
            <div className="op-title">
              <div>
                <h1 className="op-h">{dept || title}</h1>
                <p>{description}</p>
              </div>
              <span className="op-tag y">{f.filtered.length} {f.filtered.length === 1 ? "item" : "itens"}</span>
            </div>
            <div className="op-bar">
              <form role="search" onSubmit={submit}>
                <label htmlFor="op-q" style={hiddenLabel}>Buscar no catálogo</label>
                <input id="op-q" className="op-input" value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Nome, referência ou descrição" autoComplete="off" />
                <button type="submit" className="op-btn dark" style={{ minHeight: 46, boxShadow: "none" }} aria-label="Buscar"><Search size={18} /></button>
              </form>
              <label htmlFor="op-sort" style={hiddenLabel}>Ordenar</label>
              <select id="op-sort" className="op-select" value={f.sort} onChange={(e) => f.update("sort", e.target.value === "destaque" ? "" : e.target.value)}>
                <option value="destaque">Destaques</option>
                <option value="nome">Nome (A-Z)</option>
                {!hidden && <option value="menor">Menor preço</option>}
                {!hidden && <option value="maior">Maior preço</option>}
              </select>
              {(f.q || f.cat) && <button className="op-link" style={{ background: "none", border: 0, borderBottom: "2px solid var(--op-ink)" }} onClick={reset}>Limpar filtros</button>}
            </div>
            {f.visible.length ? (
              <>
                <div className="op-grid cols4">{f.visible.map((p) => <ToolCard key={p.id} product={p} />)}</div>
                {f.hasMore && <div className="op-more"><button className="op-btn" onClick={f.more}>Ver mais itens ({f.filtered.length - f.visible.length})</button></div>}
              </>
            ) : (
              <div className="op-empty">
                <Hammer size={40} />
                <h2 className="op-h">{active.length ? "Nada encontrado" : "Catálogo em atualização"}</h2>
                <p>{active.length ? "Tente outro termo ou escolha outro departamento." : "Ainda não há itens publicados nesta loja."}</p>
                {active.length > 0 && <button className="op-btn" onClick={reset}>Limpar filtros</button>}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
