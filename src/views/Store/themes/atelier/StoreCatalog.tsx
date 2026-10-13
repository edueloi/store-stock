import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { X } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import { Piece, Empty } from "./parts";
import { categoryFromParams, priceInfo, useKit, withCategory } from "./kit";
import "./styles.css";

const PAGE = 12;

export default function StoreCatalog() {
  const { tenant, categories, active, sf, hidePrices } = useKit();
  const [params, setParams] = useSearchParams();
  const q = (params.get("q") || "").trim();
  const selected = categoryFromParams(params, categories);
  const [sort, setSort] = useState("curated");
  const [shown, setShown] = useState(PAGE);
  const title = sf.catalog_title || "A coleção";
  const description = sf.catalog_description || "Peças escolhidas com carinho. Explore por categoria ou busque por nome.";

  useEffect(() => { setShown(PAGE); }, [q, selected, sort]);

  const list = useMemo(() => {
    const term = q.toLowerCase();
    const out = active.filter((p) => (!selected || p.category_id === selected) && (!term || `${p.name} ${p.sku || ""} ${p.description || ""}`.toLowerCase().includes(term)));
    if (sort === "recent") out.sort((a, b) => b.id - a.id);
    if (sort === "low") out.sort((a, b) => priceInfo(a).price - priceInfo(b).price);
    if (sort === "high") out.sort((a, b) => priceInfo(b).price - priceInfo(a).price);
    if (sort === "name") out.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    if (sort === "curated") out.sort((a, b) => Number(b.is_featured) - Number(a.is_featured));
    return out;
  }, [active, q, selected, sort]);

  const withProducts = categories.filter((c) => active.some((p) => p.category_id === c.id));
  const current = categories.find((c) => c.id === selected);
  const setCat = (id: number | null) => setParams(withCategory(params, id));
  const clearQ = () => { const n = new URLSearchParams(params); n.delete("q"); setParams(n); };

  return (
    <div className="atl-page">
      <StoreSEO title={`${current ? current.name : title} — ${tenant.name}`} description={description} url={typeof window !== "undefined" ? window.location.href : ""} siteName={tenant.name} />
      <header className="atl-cat-head">
        <p className="atl-eyebrow">{tenant.name}</p>
        <h1>{current ? current.name : title}</h1>
        <p>{description}</p>
      </header>

      <div className="atl-filterbar">
        <div className="atl-tabs" role="group" aria-label="Categorias">
          <button type="button" aria-pressed={!selected} className={!selected ? "is-on" : ""} onClick={() => setCat(null)}>Tudo</button>
          {withProducts.map((c) => <button key={c.id} type="button" aria-pressed={selected === c.id} className={selected === c.id ? "is-on" : ""} onClick={() => setCat(c.id)}>{c.name}</button>)}
        </div>
        <label className="atl-sort"><span>Ordenar</span>
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="curated">Seleção do ateliê</option>
            <option value="recent">Mais recentes</option>
            {!hidePrices && <option value="low">Menor preço</option>}
            {!hidePrices && <option value="high">Maior preço</option>}
            <option value="name">Nome (A–Z)</option>
          </select>
        </label>
      </div>

      <p className="atl-count">
        {list.length} {list.length === 1 ? "peça" : "peças"}
        {q && <button type="button" className="atl-term" onClick={clearQ}>“{q}” <X size={14} /></button>}
      </p>

      {list.length === 0 ? (
        <Empty title="Nada por aqui" text="Não encontramos peças com esses filtros. Tente outra busca ou volte para a coleção completa." />
      ) : (
        <>
          <div className="atl-stagger">
            {list.slice(0, shown).map((p, i) => <Piece key={p.id} product={p} tall={i % 5 === 0} />)}
          </div>
          {shown < list.length && (
            <div className="atl-center atl-more">
              <p>Você viu {Math.min(shown, list.length)} de {list.length}</p>
              <button type="button" className="atl-btn atl-btn-line" onClick={() => setShown((n) => n + PAGE)}>Ver mais peças</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
