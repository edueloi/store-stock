import { useState, type FormEvent } from "react";
import { Cog, Search } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import { useCatalogFilters, useShop } from "./lib";
import { SkuRow, TableHead } from "./parts";

const hiddenLabel = { position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" } as const;

export default function StoreCatalog() {
  const { tenant, categories, active, hidden, sf, vars } = useShop();
  const f = useCatalogFilters(active, 25);
  const [term, setTerm] = useState(f.q);
  const title = sf.catalog_title || "Encontre sua peça";
  const description = sf.catalog_description || "Busque por nome, código ou SKU e confira disponibilidade e preço em uma lista técnica.";
  const withProducts = categories.filter((c) => active.some((p) => p.category_id === c.id));
  const submit = (e: FormEvent) => {
    e.preventDefault();
    f.update("q", term.trim());
  };
  const reset = () => {
    setTerm("");
    f.clear();
  };
  return (
    <main className="tg-scope tg-page" style={vars}>
      <StoreSEO title={`${title} | ${tenant.name}`} description={description} url={typeof window !== "undefined" ? window.location.href : ""} siteName={tenant.name} />
      <section className="tg-cat-head">
        <div className="tg-wrap">
          <span className="tg-kicker">Catálogo técnico</span>
          <h1 className="tg-h">{title}</h1>
          <p>{description}</p>
          <form className="tg-bigfind" role="search" onSubmit={submit}>
            <label htmlFor="tg-cat-q" style={hiddenLabel}>Buscar por peça, código ou SKU</label>
            <input id="tg-cat-q" value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Nome, código ou SKU da peça" autoComplete="off" />
            <button className="tg-btn" type="submit"><Search size={18} />Buscar</button>
          </form>
        </div>
      </section>
      <div className="tg-wrap">
        <div className="tg-toolbar">
          <div className="tg-cats" role="group" aria-label="Setores">
            <button aria-pressed={!f.cat} onClick={() => f.update("cat", "")}>Todos</button>
            {withProducts.map((c) => (
              <button key={c.id} aria-pressed={f.cat === String(c.id)} onClick={() => f.update("cat", String(c.id))}>{c.name}</button>
            ))}
          </div>
          <label htmlFor="tg-sort" style={hiddenLabel}>Ordenar</label>
          <select id="tg-sort" className="tg-select" value={f.sort} onChange={(e) => f.update("sort", e.target.value === "destaque" ? "" : e.target.value)}>
            <option value="destaque">Destaques primeiro</option>
            <option value="nome">Nome (A-Z)</option>
            {!hidden && <option value="menor">Menor preço</option>}
            {!hidden && <option value="maior">Maior preço</option>}
          </select>
        </div>
        <div className="tg-count-line">
          <span>
            {f.filtered.length} {f.filtered.length === 1 ? "peça encontrada" : "peças encontradas"}
            {f.q && <> para &ldquo;{f.q}&rdquo;</>}
          </span>
          {(f.q || f.cat) && (
            <button className="tg-link" style={{ background: "none", border: 0, minHeight: 32 }} onClick={reset}>Limpar filtros</button>
          )}
        </div>
        {f.visible.length ? (
          <>
            <div className="tg-table" role="table" aria-label="Lista técnica de peças">
              <TableHead />
              {f.visible.map((p) => <SkuRow key={p.id} product={p} />)}
            </div>
            {f.hasMore ? (
              <div className="tg-more">
                <button className="tg-btn tg-btn-ghost" onClick={f.more}>Carregar mais peças ({f.filtered.length - f.visible.length})</button>
              </div>
            ) : (
              <div style={{ height: 64 }} />
            )}
          </>
        ) : (
          <div className="tg-empty" style={{ marginBottom: 64 }}>
            <Cog size={40} />
            <h2 className="tg-h">{active.length ? "Nenhuma peça encontrada" : "Catálogo em atualização"}</h2>
            <p>{active.length ? "Confira o código digitado ou tente outro termo ou setor." : "Ainda não há peças publicadas nesta loja."}</p>
            {active.length > 0 && <button className="tg-btn" onClick={reset}>Limpar busca</button>}
          </div>
        )}
      </div>
    </main>
  );
}
