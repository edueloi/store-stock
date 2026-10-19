import { Search } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import { useEditorialCatalog as useCatalog } from "./kit";
import { Empty, TechCard } from "./parts";

import "./styles.css";

export default function StoreCatalog() {
  const c = useCatalog(12);
  const { tenant, sf, categories, active, hidden } = c;
  const title = sf.catalog_title || "Dispositivos";
  const desc = sf.catalog_description || "Dispositivos e acessórios para conectar trabalho, casa e os seus momentos.";
  const current = categories.find((x) => x.id === c.cat);
  const used = categories.filter((x) => active.some((p) => p.category_id === x.id));
  return (
    <div className="tp-page tp-catalog">
      <StoreSEO
        title={`${current ? `${current.name} | ` : ""}${title} | ${tenant.name}`}
        description={desc}
        image={tenant.banner_url || tenant.logo_url}
        url={typeof window !== "undefined" ? window.location.href : ""}
        siteName={tenant.name}
      />
      <header className="tp-cat-head">
        <div>
          <span className="tp-mono">{String(c.list.length).padStart(2, "0")} itens</span>
          <h1>{current ? current.name : title}</h1>
          <p>{desc}</p>
        </div>
        <div className="tp-tools">
          <label className="tp-find">
            <Search size={18} aria-hidden="true" />
            <input type="search" value={c.q} onChange={(e) => c.setParam("q", e.target.value)} placeholder="Buscar no catálogo" aria-label="Buscar no catálogo" />
          </label>
          <label className="tp-select"><span className="tp-sr">Ordenar por</span><select value={c.sort} onChange={e => c.setParam("sort", e.target.value === "featured" ? null : e.target.value)}><option value="featured">Destaques</option><option value="name">Nome (A a Z)</option>{!hidden && <><option value="price_up">Menor preço</option><option value="price_down">Maior preço</option></>}</select></label>
        </div>
      </header>

      <div className="tp-catalog-filters">
        <label className="tp-category-filter"><span>Categoria</span><select aria-label="Filtrar por categoria" value={c.cat || ""} onChange={e => c.setParam("categoria", e.target.value || null)}><option value="">Todos os produtos</option>{used.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}</select></label>
        <span>{c.list.length} {c.list.length === 1 ? "produto" : "produtos"}</span>
        {(c.q || c.cat || c.sort !== "featured") && <button type="button" onClick={c.clear}>Limpar filtros</button>}
      </div>

      {c.list.length ? (
        <>
          <div className="tp-grid" role="status" aria-live="polite">
            {c.shown.map((p) => (
              <TechCard key={p.id} product={p} />
            ))}
          </div>
          {c.hasMore && (
            <div className="tp-more">
              <button type="button" className="tp-btn tp-btn-solid tp-btn-lg" onClick={c.more}>
                Carregar mais
              </button>
              <span>
                {c.shown.length} de {c.list.length}
              </span>
            </div>
          )}
        </>
      ) : (
        <Empty title={active.length ? "Nada encontrado" : "Em breve"} text={active.length ? "Tente outro termo ou outra categoria." : "Estamos montando o catálogo."}  />
      )}
    </div>
  );
}
