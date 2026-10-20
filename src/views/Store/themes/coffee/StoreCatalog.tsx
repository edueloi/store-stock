import { Coffee } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import SearchBar from "../../../../components/layout/SearchBar";
import { useCatalog } from "./kit";
import { Empty, ProductCard } from "./parts";
import "./styles.css";

export default function StoreCatalog() {
  const c = useCatalog(12);
  const { tenant, sf, categories, active, hidden } = c;
  const title = sf.catalog_title || "Cardápio";
  const desc = sf.catalog_description || "Cafés, doces, salgados e tudo o que a casa prepara.";
  const current = categories.find((x) => x.id === c.cat);
  const used = categories.filter((cat) => active.some((p) => p.category_id === cat.id));
  return (
    <div className="cf-page cf-catalog">
      <StoreSEO
        title={`${current ? `${current.name} | ` : ""}${title} | ${tenant.name}`}
        description={desc}
        image={tenant.banner_url || tenant.logo_url}
        url={typeof window !== "undefined" ? window.location.href : ""}
        siteName={tenant.name}
      />
      <header className="cf-cat-head">
        <span className="cf-hand">
          <Coffee size={16} aria-hidden="true" /> o que servimos
        </span>
        <h1>{current ? current.name : title}</h1>
        <p>{desc}</p>
      </header>

      <div className="cf-cat-layout">
        <aside className="cf-side" aria-label="Filtros">
          <div className="cf-side-search" role="search">
            <SearchBar value={c.q} onChange={(v) => c.setParam("q", v)} placeholder="Buscar no cardápio" />
          </div>
          <label className="cf-select">
            <span>Ordenar por</span>
            <select value={c.sort} onChange={(e) => c.setParam("sort", e.target.value === "destaques" ? null : e.target.value)}>
              <option value="destaques">Favoritos primeiro</option>
              <option value="nome">Nome (A a Z)</option>
              {!hidden && <option value="menor">Menor preço</option>}
              {!hidden && <option value="maior">Maior preço</option>}
            </select>
          </label>
          <label className="cf-select cf-select-mobile">
            <span>Seção</span>
            <select value={c.cat ? String(c.cat) : ""} onChange={(e) => c.setParam("categoria", e.target.value || null)}>
              <option value="">Todas ({active.length})</option>
              {used.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </label>
          <nav className="cf-side-menu" aria-label="Seções">
            <p>Seções</p>
            <button type="button" aria-pressed={!c.cat} onClick={() => c.setParam("categoria", null)}>
              <span>Tudo</span>
              <small>{active.length}</small>
            </button>
            {used.map((cat) => (
              <button key={cat.id} type="button" aria-pressed={c.cat === cat.id} onClick={() => c.setParam("categoria", String(cat.id))}>
                <span>{cat.name}</span>
                <small>{active.filter((p) => p.category_id === cat.id).length}</small>
              </button>
            ))}
          </nav>
        </aside>

        <div className="cf-results">
          <div className="cf-catalog-summary"><p className="cf-count" role="status">
            {c.list.length} {c.list.length === 1 ? "item encontrado" : "itens encontrados"}
            {current ? ` em ${current.name}` : ""}
          </p>{(c.q || c.cat || c.sort !== "destaques") && <button type="button" onClick={c.clear}>Limpar filtros</button>}</div>
          {c.list.length ? (
            <>
              <div className="cf-list cf-list-one">
                {c.shown.map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>
              {c.hasMore && (
                <div className="cf-more">
                  <button type="button" className="cf-btn cf-btn-lg" onClick={c.more}>
                    Ver mais itens
                  </button>
                  <span>
                    Mostrando {c.shown.length} de {c.list.length}
                  </span>
                </div>
              )}
            </>
          ) : (
            <Empty
              title={active.length ? "Não achamos esse item" : "O cardápio ainda está vazio"}
              text={active.length ? "Tente outro nome ou veja outra seção." : "Volte em breve, estamos preparando novidades."}
              onClear={active.length ? c.clear : undefined}
            />
          )}
        </div>
      </div>
    </div>
  );
}
