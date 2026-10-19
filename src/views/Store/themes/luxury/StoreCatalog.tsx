import StoreSEO from "../../../../components/store/StoreSEO";
import { StoreButton } from "../../../../components/store/StoreButton";
import { useCatalog } from "./kit";
import { Empty, ProductCard, SearchField } from "./parts";
import "./styles.css";

export default function StoreCatalog() {
  const c = useCatalog(12);
  const { tenant, sf, categories, active, hidden } = c;
  const title = sf.catalog_title || "A coleção";
  const desc = sf.catalog_description || "Peças selecionadas, reunidas com critério.";
  const current = categories.find((x) => x.id === c.cat);
  return (
    <div className="lux-page">
      <StoreSEO title={`${current ? `${current.name} | ` : ""}${title} | ${tenant.name}`} description={desc} image={tenant.banner_url || tenant.logo_url} url={typeof window !== "undefined" ? window.location.href : ""} siteName={tenant.name} />
      <header className="lux-wrap lux-cat-hero">
        <span className="lux-eyebrow">Coleção</span>
        <h1>{current ? current.name : title}</h1>
        <p>{desc}</p>
      </header>
      <div className="lux-wrap">
        <div className="lux-bar">
          <div className="lux-tabs" role="group" aria-label="Coleções">
            <button type="button" aria-pressed={!c.cat} onClick={() => c.setParam("categoria", null)}>Todas</button>
            {categories.map((cat) => (
              <button key={cat.id} type="button" aria-pressed={c.cat === cat.id} onClick={() => c.setParam("categoria", String(cat.id))}>{cat.name}</button>
            ))}
          </div>
          <div className="lux-bar-tools">
            <SearchField value={c.q} onChange={(v) => c.setParam("q", v)} placeholder="Buscar peça" label="Buscar na coleção" />
            <label className="lux-select">
              <span className="lux-sr">Ordenar por</span>
              <select value={c.sort} onChange={(e) => c.setParam("sort", e.target.value === "destaques" ? null : e.target.value)}>
                <option value="destaques">Destaques</option>
                <option value="nome">Nome (A a Z)</option>
                {!hidden && <option value="menor">Menor preço</option>}
                {!hidden && <option value="maior">Maior preço</option>}
              </select>
            </label>
          </div>
        </div>
        <p className="lux-count" role="status">{c.list.length} {c.list.length === 1 ? "peça" : "peças"}</p>
        {c.list.length ? (
          <>
            <div className="lux-grid lux-grid-cat">{c.shown.map((p) => <ProductCard key={p.id} product={p} />)}</div>
            {c.hasMore && (
              <div className="lux-more">
                <StoreButton variant="outline" size="lg" className="lux-btn lux-btn-line lux-btn-lg" onClick={c.more}>Ver mais peças</StoreButton>
                <span>Mostrando {c.shown.length} de {c.list.length}</span>
              </div>
            )}
          </>
        ) : (
          <Empty title={active.length ? "Nada encontrado" : "Em breve por aqui"} text={active.length ? "Tente outro termo ou outra coleção." : "Estamos preparando a coleção."} onClear={active.length ? c.clear : undefined} />
        )}
      </div>
    </div>
  );
}
