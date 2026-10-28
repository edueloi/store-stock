import StoreSEO from "../../../../components/store/StoreSEO";
import { useCatalog } from "./kit";
import { Empty, ProductCard, SearchField } from "./parts";
import { ADEGA_HERO } from "./Hero";
import "./styles.css";

export default function StoreCatalog() {
  const c = useCatalog(16);
  const { tenant, sf, categories, active, hidden } = c;
  const title = sf.catalog_title || "Cardápio da adega";
  const desc = sf.catalog_description || "Bebidas, gelo, carvão e conveniência. Escolha, adicione e peça.";
  const current = categories.find((x) => x.id === c.cat);
  return (
    <div className="adg-page">
      <StoreSEO title={`${current ? `${current.name} | ` : ""}${title} | ${tenant.name}`} description={desc} image={tenant.banner_url || tenant.logo_url} url={typeof window !== "undefined" ? window.location.href : ""} siteName={tenant.name} />
      <header className="adg-cat-banner">
        <img src={tenant.banner_url || sf.hero_slides?.[0]?.image || ADEGA_HERO} alt="" />
        <div className="adg-wrap adg-cat-hero">
        <span className="adg-kicker">Cardápio</span>
        <h1>{current ? current.name : title}</h1>
        <p>{desc}</p>
        </div>
      </header>
      <div className="adg-wrap">
        <div className="adg-filter">
          <div className="adg-filter-tools">
            <SearchField value={c.q} onChange={(v) => c.setParam("q", v)} placeholder="Buscar produto" label="Buscar produtos" />
            <label className="adg-select">
              <span className="adg-sr">Ordenar por</span>
              <select value={c.sort} onChange={(e) => c.setParam("sort", e.target.value === "destaques" ? null : e.target.value)}>
                <option value="destaques">Destaques</option>
                <option value="nome">Nome (A a Z)</option>
                {!hidden && <option value="menor">Menor preço</option>}
                {!hidden && <option value="maior">Maior preço</option>}
              </select>
            </label>
          </div>
          <div className="adg-pills" role="group" aria-label="Categorias">
            <button type="button" aria-pressed={!c.cat} onClick={() => c.setParam("categoria", null)}>Tudo</button>
            {categories.map((cat) => (
              <button key={cat.id} type="button" aria-pressed={c.cat === cat.id} onClick={() => c.setParam("categoria", String(cat.id))}>{cat.name}</button>
            ))}
          </div>
        </div>
        <p className="adg-count" role="status">{c.list.length} {c.list.length === 1 ? "produto" : "produtos"}</p>
        {c.list.length ? (
          <>
            <div className="adg-grid adg-grid-cat">{c.shown.map((p) => <ProductCard key={p.id} product={p} />)}</div>
            {c.hasMore && (
              <div className="adg-more">
                <button type="button" className="adg-btn adg-btn-ghost adg-btn-lg" onClick={c.more}>Ver mais produtos</button>
                <span>Mostrando {c.shown.length} de {c.list.length}</span>
              </div>
            )}
          </>
        ) : (
          <Empty title={active.length ? "Nada encontrado" : "Em breve por aqui"} text={active.length ? "Tente outro termo ou outra categoria." : "Estamos abastecendo a geladeira."} onClear={active.length ? c.clear : undefined} />
        )}
      </div>
    </div>
  );
}
