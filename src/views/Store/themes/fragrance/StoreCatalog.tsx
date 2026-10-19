import { useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import { StoreButton } from "../../../../components/store/StoreButton";
import { useCatalog } from "./kit";
import { Empty, ProductCard, SearchField } from "./parts";
import "./styles.css";

export default function StoreCatalog() {
  const c = useCatalog(12);
  const { tenant, sf, categories, active, hidden } = c;
  const [open, setOpen] = useState(false);
  const title = sf.catalog_title || "Todas as fragrâncias";
  const desc = sf.catalog_description || "Explore por família olfativa e encontre a sua assinatura.";
  const current = categories.find((x) => x.id === c.cat);
  const countOf = (id: number) => active.filter((p) => p.category_id === id).length;
  return (
    <div className="frg-page">
      <StoreSEO title={`${current ? `${current.name} | ` : ""}${title} | ${tenant.name}`} description={desc} image={tenant.banner_url || tenant.logo_url} url={typeof window !== "undefined" ? window.location.href : ""} siteName={tenant.name} />
      <header className="frg-wrap frg-cat-hero">
        <span className="frg-eyebrow">Coleção</span>
        <h1>{current ? current.name : title}</h1>
        <p>{desc}</p>
      </header>
      <div className="frg-wrap frg-cat-layout">
        <button type="button" className="frg-filter-toggle" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
          <SlidersHorizontal size={18} /> Filtros e famílias
        </button>
        <aside className={`frg-side ${open ? "is-open" : ""}`} aria-label="Filtros">
          <SearchField value={c.q} onChange={(v) => c.setParam("q", v)} placeholder="Buscar fragrância" label="Buscar fragrâncias" />
          <h2>Famílias</h2>
          <div className="frg-side-list" role="group" aria-label="Categorias">
            <button type="button" aria-pressed={!c.cat} onClick={() => c.setParam("categoria", null)}>Todas <small>{active.length}</small></button>
            {categories.map((cat) => (
              <button key={cat.id} type="button" aria-pressed={c.cat === cat.id} onClick={() => c.setParam("categoria", String(cat.id))}>{cat.name} <small>{countOf(cat.id)}</small></button>
            ))}
          </div>
          <h2>Ordenar</h2>
          <label className="frg-select">
            <span className="frg-sr">Ordenar por</span>
            <select value={c.sort} onChange={(e) => c.setParam("sort", e.target.value === "destaques" ? null : e.target.value)}>
              <option value="destaques">Destaques primeiro</option>
              <option value="nome">Nome (A a Z)</option>
              {!hidden && <option value="menor">Menor preço</option>}
              {!hidden && <option value="maior">Maior preço</option>}
            </select>
          </label>
        </aside>
        <div className="frg-results">
          <p className="frg-count" role="status">{c.list.length} {c.list.length === 1 ? "fragrância encontrada" : "fragrâncias encontradas"}</p>
          {c.list.length ? (
            <>
              <div className="frg-grid frg-grid-cat">{c.shown.map((p) => <ProductCard key={p.id} product={p} />)}</div>
              {c.hasMore && (
                <div className="frg-more">
                  <StoreButton variant="outline" size="lg" className="frg-btn frg-btn-line frg-btn-lg" onClick={c.more}>Ver mais fragrâncias</StoreButton>
                  <span>Mostrando {c.shown.length} de {c.list.length}</span>
                </div>
              )}
            </>
          ) : (
            <Empty title={active.length ? "Nada encontrado" : "Em breve por aqui"} text={active.length ? "Tente outro nome ou outra família." : "Estamos preparando a coleção."} onClear={active.length ? c.clear : undefined} />
          )}
        </div>
      </div>
    </div>
  );
}
