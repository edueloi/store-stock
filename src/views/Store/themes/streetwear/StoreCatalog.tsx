import { Search } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import { useCatalog } from "../street/kit";
import { Empty, ProductCard, SortSelect } from "../street/shared";
import "./styles.css";

export default function StoreCatalog() {
  const c = useCatalog(12);
  const { tenant, sf, categories, active, hidden } = c;
  const title = sf.catalog_title || "A coleção";
  const desc = sf.catalog_description || "Streetwear, skate e peças para viver o seu ritmo.";
  const current = categories.find((x) => x.id === c.cat);
  const used = categories.filter((x) => active.some((p) => p.category_id === x.id));
  return (
    <div className="sw-page sw-catalog">
      <StoreSEO
        title={`${current ? `${current.name} | ` : ""}${title} | ${tenant.name}`}
        description={desc}
        image={tenant.banner_url || tenant.logo_url}
        url={typeof window !== "undefined" ? window.location.href : ""}
        siteName={tenant.name}
      />
      <header className="sw-cat-head">
        <div>
          <span className="sw-mono">{String(c.list.length).padStart(2, "0")} itens</span>
          <h1>{current ? current.name : title}</h1>
          <p>{desc}</p>
        </div>
        <div className="sw-tools">
          <label className="sw-find">
            <Search size={18} aria-hidden="true" />
            <input type="search" value={c.q} onChange={(e) => c.setParam("q", e.target.value)} placeholder="Buscar no catálogo" aria-label="Buscar no catálogo" />
          </label>
          <SortSelect t="sw" sort={c.sort} hidden={hidden} onChange={(v) => c.setParam("sort", v)} />
        </div>
      </header>

      <div className="sw-catalog-filters">
        <label className="sw-category-filter"><span>Categoria</span><select aria-label="Filtrar por categoria" value={c.cat || ""} onChange={e => c.setParam("categoria", e.target.value || null)}><option value="">Todas as peças</option>{used.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}</select></label>
        <span>{c.list.length} {c.list.length === 1 ? "peça" : "peças"}</span>
        {(c.q || c.cat || c.sort !== "destaques") && <button type="button" onClick={c.clear}>Limpar filtros</button>}
      </div>

      {c.list.length ? (
        <>
          <div className="sw-grid" role="status" aria-live="polite">
            {c.shown.map((p) => (
              <ProductCard key={p.id} product={p} t="sw" />
            ))}
          </div>
          {c.hasMore && (
            <div className="sw-more">
              <button type="button" className="sw-btn sw-btn-solid sw-btn-lg" onClick={c.more}>
                Carregar mais
              </button>
              <span>
                {c.shown.length} de {c.list.length}
              </span>
            </div>
          )}
        </>
      ) : (
        <Empty t="sw" title={active.length ? "Nada encontrado" : "Em breve"} text={active.length ? "Tente outro termo ou outra categoria." : "Estamos montando o catálogo."} onClear={active.length ? c.clear : undefined} />
      )}
    </div>
  );
}
