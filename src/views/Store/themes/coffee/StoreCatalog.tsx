import { useState } from "react";
import { Link } from "react-router-dom";
import { LayoutGrid, List, Search, X } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import { useCatalog } from "./kit";
import { ArchCard, MenuRow } from "./parts";
import "./styles.css";

export default function StoreCatalog() {
  const { tenant, categories, active, sf, q, cat, sort, setParam, list, shown, more, hasMore, path } = useCatalog(14);
  const [view, setView] = useState<"menu" | "fotos">("menu");
  const title = sf.catalog_title || "Sabores e rituais";
  const description = sf.catalog_description || "Escolha seus cafés e acompanhamentos e monte sua comanda.";
  const cats = categories.filter((c) => active.some((p) => p.category_id === c.id));
  const groups = !cat && !q ? cats.map((c) => ({ c, items: shown.filter((p) => p.category_id === c.id) })).filter((g) => g.items.length) : [];
  const grouped = view === "menu" && groups.length > 0 && sort === "featured";
  const leftovers = grouped ? shown.filter((p) => !cats.some((c) => c.id === p.category_id)) : [];
  return (
    <main className="cf-root">
      <StoreSEO title={`${title} — ${tenant.name}`} description={description} url={typeof window !== "undefined" ? window.location.href : ""} siteName={tenant.name} />
      <header className="cf-pagehead">
        <p className="cf-eyebrow">Cardápio</p>
        <h1>{title}</h1>
        <p className="cf-lead">{description}</p>
      </header>

      <div className="cf-filterbar">
        <div className="cf-tabs" role="group" aria-label="Seções do cardápio">
          <button aria-pressed={!cat} onClick={() => setParam("cat", null)}>
            Tudo
          </button>
          {cats.map((c) => (
            <button key={c.id} aria-pressed={cat === c.id} onClick={() => setParam("cat", String(c.id))}>
              {c.name}
            </button>
          ))}
        </div>
        <div className="cf-tools">
          <label className="cf-field">
            <Search size={16} aria-hidden="true" />
            <span className="cf-sr">Buscar no cardápio</span>
            <input type="search" value={q} placeholder="Buscar no cardápio" onChange={(e) => setParam("q", e.target.value || null)} />
            {q && (
              <button type="button" aria-label="Limpar busca" onClick={() => setParam("q", null)}>
                <X size={16} />
              </button>
            )}
          </label>
          <label className="cf-field cf-select">
            <span className="cf-sr">Ordenar por</span>
            <select value={sort} onChange={(e) => setParam("sort", e.target.value === "featured" ? null : e.target.value)}>
              <option value="featured">Destaques primeiro</option>
              <option value="menor">Menor preço</option>
              <option value="maior">Maior preço</option>
              <option value="nome">Nome (A–Z)</option>
            </select>
          </label>
          <div className="cf-view" role="group" aria-label="Modo de exibição">
            <button aria-pressed={view === "menu"} aria-label="Ver como cardápio" onClick={() => setView("menu")}>
              <List size={18} />
            </button>
            <button aria-pressed={view === "fotos"} aria-label="Ver em fotos" onClick={() => setView("fotos")}>
              <LayoutGrid size={18} />
            </button>
          </div>
        </div>
      </div>

      <section className="cf-list" aria-label="Produtos">
        <p className="cf-count" role="status">
          {list.length} {list.length === 1 ? "item" : "itens"}
          {q ? ` para “${q}”` : ""}
        </p>
        {list.length === 0 ? (
          <div className="cf-emptybox">
            <p>{active.length === 0 ? "O cardápio ainda está vazio." : "Nada encontrado para essa busca."}</p>
            {active.length > 0 && (
              <Link to={path("/catalogo")} className="cf-btn cf-btn-line">
                Ver tudo
              </Link>
            )}
          </div>
        ) : view === "fotos" ? (
          <div className="cf-photos">
            {shown.map((p, i) => (
              <ArchCard key={p.id} product={p} tall={i % 3 === 0} />
            ))}
          </div>
        ) : grouped ? (
          <>
            {groups.map(({ c, items }, i) => (
              <div key={c.id} className="cf-group">
                <h2>
                  <span>{String(i + 1).padStart(2, "0")}</span> {c.name}
                </h2>
                {items.map((p) => (
                  <MenuRow key={p.id} product={p} />
                ))}
              </div>
            ))}
            {leftovers.length > 0 && (
              <div className="cf-group">
                <h2>Outros</h2>
                {leftovers.map((p) => (
                  <MenuRow key={p.id} product={p} />
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="cf-group">
            {shown.map((p) => (
              <MenuRow key={p.id} product={p} />
            ))}
          </div>
        )}
        {hasMore && (
          <div className="cf-center">
            <button className="cf-btn" onClick={more}>
              Ver mais itens
            </button>
          </div>
        )}
      </section>
    </main>
  );
}
