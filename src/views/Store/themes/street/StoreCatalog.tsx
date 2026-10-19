import { Search } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import { useCatalog } from "./kit";
import { Empty, ProductCard, SortSelect } from "./shared";
import "./styles.css";

export default function StoreCatalog() {
  const c = useCatalog(12);
  const { tenant, sf, categories, active, hidden } = c;
  const title = sf.catalog_title || "Todos os drops";
  const desc = sf.catalog_description || "Peças novas, edições limitadas e os básicos que não saem de moda.";
  const current = categories.find((x) => x.id === c.cat);
  const used = categories.filter((x) => active.some((p) => p.category_id === x.id));
  return (
    <div className="sd-page sd-catalog">
      <StoreSEO
        title={`${current ? `${current.name} | ` : ""}${title} | ${tenant.name}`}
        description={desc}
        image={tenant.banner_url || tenant.logo_url}
        url={typeof window !== "undefined" ? window.location.href : ""}
        siteName={tenant.name}
      />
      <header className="sd-cat-hero">
        <div>
          <span className="sd-tag">Catálogo</span>
          <h1>{current ? current.name : title}</h1>
          <p>{desc}</p>
        </div>
        <span className="sd-count-big" aria-hidden="true">
          {c.list.length}
          <small>peças</small>
        </span>
      </header>

      <div className="sd-toolbar">
        <div className="sd-tabs" role="group" aria-label="Categorias">
          <button type="button" aria-pressed={!c.cat} onClick={() => c.setParam("categoria", null)}>
            Todas <small>{active.length}</small>
          </button>
          {used.map((cat) => (
            <button key={cat.id} type="button" aria-pressed={c.cat === cat.id} onClick={() => c.setParam("categoria", String(cat.id))}>
              {cat.name} <small>{active.filter((p) => p.category_id === cat.id).length}</small>
            </button>
          ))}
        </div>
        <div className="sd-tools">
          <label className="sd-find">
            <Search size={17} aria-hidden="true" />
            <input type="search" value={c.q} onChange={(e) => c.setParam("q", e.target.value)} placeholder="Buscar no catálogo" aria-label="Buscar no catálogo" />
          </label>
          <SortSelect t="sd" sort={c.sort} hidden={hidden} onChange={(v) => c.setParam("sort", v)} />
        </div>
      </div>

      <p className="sd-results" role="status">
        {c.list.length} {c.list.length === 1 ? "peça encontrada" : "peças encontradas"}
      </p>

      {c.list.length ? (
        <>
          <div className="sd-grid">
            {c.shown.map((p) => (
              <ProductCard key={p.id} product={p} t="sd" />
            ))}
          </div>
          {c.hasMore && (
            <div className="sd-more">
              <button type="button" className="sd-btn sd-btn-solid sd-btn-lg" onClick={c.more}>
                Carregar mais peças
              </button>
              <span>
                Mostrando {c.shown.length} de {c.list.length}
              </span>
            </div>
          )}
        </>
      ) : (
        <Empty t="sd" title={active.length ? "Nada por aqui" : "O próximo drop já vem"} text={active.length ? "Tente outro termo ou outra categoria." : "Estamos preparando as peças."} onClear={active.length ? c.clear : undefined} />
      )}
    </div>
  );
}
