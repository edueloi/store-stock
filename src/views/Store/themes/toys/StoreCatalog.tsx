import { Puzzle } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import SearchBar from "../../../../components/layout/SearchBar";
import { useCatalog } from "./kit";
import { Empty, ProductCard, Shapes } from "./parts";
import "./styles.css";

export default function StoreCatalog() {
  const c = useCatalog(12);
  const { tenant, sf, categories, active, hidden } = c;
  const title = sf.catalog_title || "Escolha o próximo sorriso";
  const desc = sf.catalog_description || "Brinquedos para todas as idades e todas as brincadeiras.";
  const current = categories.find((x) => x.id === c.cat);
  return (
    <div className="toys-page toys-catalog">
      <StoreSEO
        title={`${current ? `${current.name} | ` : ""}${title} | ${tenant.name}`}
        description={desc}
        image={tenant.banner_url || tenant.logo_url}
        url={typeof window !== "undefined" ? window.location.href : ""}
        siteName={tenant.name}
      />
      <header className="toys-cat-hero">
        <Shapes />
        <span className="toys-pill">
          <Puzzle size={15} /> Catálogo
        </span>
        <h1>{title}</h1>
        <p>{desc}</p>
      </header>

      <div className="toys-cat-body">
        <div className="toys-toolbar">
          <div className="toys-search toys-search-wide" role="search">
            <SearchBar value={c.q} onChange={(v) => c.setParam("q", v)} placeholder="Buscar por nome ou código" />
          </div>
          <label className="toys-select">
            <span className="toys-sr">Ordenar por</span>
            <select value={c.sort} onChange={(e) => c.setParam("sort", e.target.value === "destaques" ? null : e.target.value)}>
              <option value="destaques">Destaques primeiro</option>
              <option value="nome">Nome (A a Z)</option>
              {!hidden && <option value="menor">Menor preço</option>}
              {!hidden && <option value="maior">Maior preço</option>}
            </select>
          </label>
        </div>

        <div className="toys-filters" role="group" aria-label="Categorias">
          <button type="button" className="toys-filter toys-tint-0" aria-pressed={!c.cat} onClick={() => c.setParam("categoria", null)}>
            Todos <small>{active.length}</small>
          </button>
          {categories.map((cat, i) => (
            <button
              key={cat.id}
              type="button"
              className={`toys-filter toys-tint-${(i + 1) % 4}`}
              aria-pressed={c.cat === cat.id}
              onClick={() => c.setParam("categoria", String(cat.id))}
            >
              {cat.name} <small>{active.filter((p) => p.category_id === cat.id).length}</small>
            </button>
          ))}
        </div>

        <p className="toys-count" role="status">
          {c.list.length} {c.list.length === 1 ? "brinquedo encontrado" : "brinquedos encontrados"}
          {current ? ` em ${current.name}` : ""}
        </p>

        {c.list.length ? (
          <>
            <div className="toys-grid">
              {c.shown.map((p, i) => (
                <ProductCard key={p.id} product={p} index={i} />
              ))}
            </div>
            {c.hasMore && (
              <div className="toys-more">
                <button type="button" className="toys-btn toys-btn-solid toys-btn-lg" onClick={c.more}>
                  Ver mais brinquedos
                </button>
                <span>
                  Mostrando {c.shown.length} de {c.list.length}
                </span>
              </div>
            )}
          </>
        ) : (
          <Empty
            title={active.length ? "Esse brinquedo não apareceu" : "Ainda não há brinquedos por aqui"}
            text={active.length ? "Tente outro nome ou veja outra categoria." : "Volte em breve, estamos preparando novidades."}
            onClear={active.length ? c.clear : undefined}
          />
        )}
      </div>
    </div>
  );
}
