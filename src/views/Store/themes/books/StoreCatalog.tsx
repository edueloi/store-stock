import { Link } from "react-router-dom";
import { Search, X } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import { useCatalog } from "./kit";
import { Cover, Ornament, spineOf } from "./parts";
import "./styles.css";

export default function StoreCatalog() {
  const { tenant, categories, active, sf, q, cat, sort, setParam, list, shown, more, hasMore, path } = useCatalog(12);
  const title = sf.catalog_title || "Explore nossa estante";
  const description = sf.catalog_description || "Folheie o catálogo, escolha a próxima leitura e monte sua pilha.";
  const cats = categories
    .map((c) => ({ c, n: active.filter((p) => p.category_id === c.id).length }))
    .filter((x) => x.n);
  return (
    <main className="bk-root">
      <StoreSEO title={`${title} — ${tenant.name}`} description={description} url={typeof window !== "undefined" ? window.location.href : ""} siteName={tenant.name} />
      <header className="bk-pagehead">
        <p className="bk-eyebrow">Catálogo</p>
        <h1>{title}</h1>
        <Ornament className="bk-orn" />
        <p>{description}</p>
      </header>

      <div className="bk-cat-layout">
        <aside className="bk-sidebar" aria-label="Filtros">
          <label className="bk-field">
            <Search size={16} aria-hidden="true" />
            <span className="bk-sr">Buscar título ou código</span>
            <input type="search" value={q} placeholder="Buscar título ou código" onChange={(e) => setParam("q", e.target.value || null)} />
            {q && (
              <button type="button" aria-label="Limpar busca" onClick={() => setParam("q", null)}>
                <X size={16} />
              </button>
            )}
          </label>
          <label className="bk-field bk-select">
            <span className="bk-sr">Ordenar por</span>
            <select value={sort} onChange={(e) => setParam("sort", e.target.value === "featured" ? null : e.target.value)}>
              <option value="featured">Destaques primeiro</option>
              <option value="menor">Menor preço</option>
              <option value="maior">Maior preço</option>
              <option value="nome">Título (A–Z)</option>
            </select>
          </label>
          <h2 className="bk-side-title">Seções</h2>
          <ul className="bk-sections">
            <li>
              <button aria-pressed={!cat} className={!cat ? "is-on" : ""} onClick={() => setParam("cat", null)}>
                <span>Todos os títulos</span>
                <i aria-hidden="true" />
                <em>{active.length}</em>
              </button>
            </li>
            {cats.map(({ c, n }, i) => (
              <li key={c.id}>
                <button aria-pressed={cat === c.id} className={cat === c.id ? "is-on" : ""} onClick={() => setParam("cat", String(c.id))}>
                  <b style={{ background: spineOf(i).bg }} aria-hidden="true" />
                  <span>{c.name}</span>
                  <i aria-hidden="true" />
                  <em>{n}</em>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <section aria-label="Títulos">
          <p className="bk-count" role="status">
            {list.length} {list.length === 1 ? "título" : "títulos"}
            {q ? ` para “${q}”` : ""}
          </p>
          {list.length === 0 ? (
            <div className="bk-empty-box">
              <p>{active.length === 0 ? "O catálogo ainda está vazio." : "Nenhum título encontrado nesta busca."}</p>
              {active.length > 0 && (
                <Link to={path("/catalogo")} className="bk-btn bk-btn-line">
                  Limpar filtros
                </Link>
              )}
            </div>
          ) : (
            <div className="bk-books-grid">
              {shown.map((p, i) => (
                <Cover key={p.id} product={p} index={i} />
              ))}
            </div>
          )}
          {hasMore && (
            <div className="bk-center">
              <button className="bk-btn" onClick={more}>
                Virar a página — ver mais títulos
              </button>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
