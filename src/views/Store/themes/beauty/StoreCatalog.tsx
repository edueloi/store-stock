import StoreSEO from "../../../../components/store/StoreSEO";
import { StoreButton } from "../../../../components/store/StoreButton";
import { useCatalog } from "./kit";
import { Empty, ProductCard, SearchField } from "./ThemeParts";
import "./styles.css";

export default function StoreCatalog() {
  const c = useCatalog(12);
  const { tenant, sf, categories, active, hidden } = c;
  const title = sf.catalog_title || "Cuidado em cada escolha";
  const desc = sf.catalog_description || "Encontre produtos para transformar a sua rotina em um ritual de bem-estar.";
  const current = categories.find((x) => x.id === c.cat);
  return (
    <div className="bty-page">
      <StoreSEO title={`${current ? `${current.name} | ` : ""}${title} | ${tenant.name}`} description={desc} image={tenant.banner_url || tenant.logo_url} url={typeof window !== "undefined" ? window.location.href : ""} siteName={tenant.name} />
      <header className="bty-wrap bty-cat-hero">
        <span className="bty-eyebrow">Catálogo</span>
        <h1>{current ? current.name : title}</h1>
        <p>{desc}</p>
      </header>
      <div className="bty-wrap">
        <div className="bty-filterbar">
          <SearchField value={c.q} onChange={(v) => c.setParam("q", v)} placeholder="Buscar por nome ou código" label="Buscar produtos" />
          <label className="bty-select">
            <span className="bty-sr">Ordenar por</span>
            <select value={c.sort} onChange={(e) => c.setParam("sort", e.target.value === "destaques" ? null : e.target.value)}>
              <option value="destaques">Destaques primeiro</option>
              <option value="nome">Nome (A a Z)</option>
              {!hidden && <option value="menor">Menor preço</option>}
              {!hidden && <option value="maior">Maior preço</option>}
            </select>
          </label>
          <div className="bty-chips" role="group" aria-label="Categorias">
            <button type="button" aria-pressed={!c.cat} onClick={() => c.setParam("categoria", null)}>Todos</button>
            {categories.map((cat) => (
              <button key={cat.id} type="button" aria-pressed={c.cat === cat.id} onClick={() => c.setParam("categoria", String(cat.id))}>{cat.name}</button>
            ))}
          </div>
        </div>
        <p className="bty-count" role="status">
          {c.list.length} {c.list.length === 1 ? "produto encontrado" : "produtos encontrados"}
        </p>
        {c.list.length ? (
          <>
            <div className="bty-grid">{c.shown.map((p) => <ProductCard key={p.id} product={p} />)}</div>
            {c.hasMore && (
              <div className="bty-more">
                <StoreButton variant="outline" size="lg" className="bty-btn bty-btn-line" onClick={c.more}>Ver mais produtos</StoreButton>
                <span>Mostrando {c.shown.length} de {c.list.length}</span>
              </div>
            )}
          </>
        ) : (
          <Empty title={active.length ? "Nada encontrado" : "Em breve por aqui"} text={active.length ? "Tente outro nome ou outra categoria." : "Estamos preparando a seleção."} onClear={active.length ? c.clear : undefined} />
        )}
      </div>
    </div>
  );
}
