import { Link } from "react-router-dom";
import { Cloud, GiftCard, tintOf } from "./parts";
import { Search, X } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import { useCatalog } from "./kit";
import "./styles.css";

export default function StoreCatalog() {
  const { tenant, categories, active, sf, q, cat, sort, setParam, list, shown, more, hasMore, path } = useCatalog(12);
  const title = sf.catalog_title || "Pequenas descobertas";
  const description = sf.catalog_description || "Escolha seus mimos, confira os detalhes e monte sua sacola de carinho.";
  const catList = categories.filter((c) => active.some((p) => p.category_id === c.id));
  return (
    <main className="bb-root">
      <StoreSEO title={`${title} — ${tenant.name}`} description={description} url={typeof window !== "undefined" ? window.location.href : ""} siteName={tenant.name} />
      <section className="bb-page-head">
        <p className="bb-kicker">Catálogo</p>
        <h1 className="bb-script">{title}</h1>
        <p className="bb-lead">{description}</p>
      </section>

      <section className="bb-toolbar" aria-label="Filtros">
        <div className="bb-chips" role="group" aria-label="Faixa ou ocasião">
          <button className={`bb-chip bb-t4 ${!cat ? "is-on" : ""}`} aria-pressed={!cat} onClick={() => setParam("cat", null)}>
            Tudo
          </button>
          {catList.map((c, i) => (
            <button key={c.id} className={`bb-chip ${tintOf(i)} ${cat === c.id ? "is-on" : ""}`} aria-pressed={cat === c.id} onClick={() => setParam("cat", String(c.id))}>
              {c.name}
            </button>
          ))}
        </div>
        <div className="bb-tools">
          <label className="bb-field">
            <Search size={16} aria-hidden="true" />
            <span className="bb-sr">Buscar produto</span>
            <input type="search" value={q} placeholder="Buscar mimos" onChange={(e) => setParam("q", e.target.value || null)} />
            {q && (
              <button type="button" aria-label="Limpar busca" onClick={() => setParam("q", null)}>
                <X size={16} />
              </button>
            )}
          </label>
          <label className="bb-field bb-select">
            <span className="bb-sr">Ordenar por</span>
            <select value={sort} onChange={(e) => setParam("sort", e.target.value === "featured" ? null : e.target.value)}>
              <option value="featured">Destaques primeiro</option>
              <option value="menor">Menor preço</option>
              <option value="maior">Maior preço</option>
              <option value="nome">Nome (A–Z)</option>
            </select>
          </label>
        </div>
      </section>

      <p className="bb-count" role="status">
        {list.length} {list.length === 1 ? "mimo encontrado" : "mimos encontrados"}
      </p>

      {list.length === 0 ? (
        <div className="bb-empty">
          <Cloud className="bb-empty-cloud" />
          <p>{active.length === 0 ? "Ainda não há produtos por aqui." : "Nenhum mimo encontrado para essa busca."}</p>
          {active.length > 0 && (
            <Link to={path("/catalogo")} className="bb-btn bb-btn-soft">
              Ver tudo
            </Link>
          )}
        </div>
      ) : (
        <div className="bb-grid bb-grid-stagger">
          {shown.map((p, i) => (
            <GiftCard key={p.id} product={p} index={i} />
          ))}
        </div>
      )}
      {hasMore && (
        <div className="bb-center">
          <button className="bb-btn bb-btn-main" onClick={more}>
            Ver mais mimos
          </button>
        </div>
      )}
    </main>
  );
}
