import { Search } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import { useCatalog, useKit } from "./kit";
import { Empty, Card } from "./parts";

import "./styles.css";

export default function StoreCatalog() {
  const c = { ...useKit(), ...useCatalog(12) };
  const { tenant, config: sf, categories, active, hidden } = c;
  const title = sf.catalog_title || "Produtos";
  const desc = sf.catalog_description || "Insumos, ferramentas e cuidados para acompanhar o trabalho na sua propriedade.";
  const current = categories.find((x) => String(x.id) === c.cat);
  const used = categories.filter((x) => active.some((p) => p.category_id === x.id));
  return (
    <div className="agro-page agro-catalog">
      <StoreSEO
        title={`${current ? `${current.name} | ` : ""}${title} | ${tenant.name}`}
        description={desc}
        image={tenant.banner_url || tenant.logo_url}
        url={typeof window !== "undefined" ? window.location.href : ""}
        siteName={tenant.name}
      />
      <header className="agro-cat-head">
        <div>
          <span className="agro-mono">{String(c.list.length).padStart(2, "0")} itens</span>
          <h1>{current ? current.name : title}</h1>
          <p>{desc}</p>
        </div>
        <div className="agro-tools">
          <label className="agro-find">
            <Search size={18} aria-hidden="true" />
            <input type="search" value={c.q} onChange={(e) => c.setParam("q", e.target.value)} placeholder="Buscar no catálogo" aria-label="Buscar no catálogo" />
          </label>
          <label className="agro-select"><span className="agro-sr">Ordenar por</span><select value={c.sort} onChange={e => c.setParam("sort", e.target.value)}><option value="featured">Destaques</option><option value="name">Nome (A a Z)</option>{!hidden && <><option value="price_up">Menor preço</option><option value="price_down">Maior preço</option></>}</select></label>
        </div>
      </header>

      <div className="agro-catalog-filters">
        <label className="agro-category-filter"><span>Categoria</span><select aria-label="Filtrar por categoria" value={c.cat || ""} onChange={e => c.setParam("cat", e.target.value)}><option value="">Todos os produtos</option>{used.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}</select></label>
        <span>{c.list.length} {c.list.length === 1 ? "produto" : "produtos"}</span>
        {(c.q || c.cat || c.sort !== "featured") && <button type="button" onClick={c.clear}>Limpar filtros</button>}
      </div>

      {c.list.length ? (
        <>
          <div className="agro-grid" role="status" aria-live="polite">
            {c.shown.map((p) => (
              <Card key={p.id} product={p} />
            ))}
          </div>
          {c.hasMore && (
            <div className="agro-more">
              <button type="button" className="agro-btn agro-btn-solid agro-btn-lg" onClick={c.more}>
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
