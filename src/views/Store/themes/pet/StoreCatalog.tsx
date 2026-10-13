import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { PawPrint, Plus } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import SearchBar from "../../../../components/layout/SearchBar";
import { detectAnimal } from "./animals";
import Card from "./Card";
import { norm, priceOf, useKit } from "./lib";
import "./styles.css";

const PAGE = 12;

export default function StoreCatalog() {
  const { tenant, active, categories, sf, hidden, countIn } = useKit();
  const [params, setParams] = useSearchParams();
  const q = params.get("q") || "";
  const cat = params.get("cat") || params.get("categoria") || "";
  const sort = params.get("sort") || "featured";
  const [limit, setLimit] = useState(PAGE);
  useEffect(() => setLimit(PAGE), [q, cat, sort]);

  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (key === "cat") next.delete("categoria");
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: key === "q" });
  };

  const visible = useMemo(() => {
    const term = norm(q.trim());
    const list = active.filter((p) => (!cat || String(p.category_id) === cat) && (!term || norm(`${p.name} ${p.sku || ""} ${p.description || ""}`).includes(term)));
    const by = (fn: (a: (typeof list)[number], b: (typeof list)[number]) => number) => [...list].sort(fn);
    if (sort === "menor") return by((a, b) => priceOf(a).price - priceOf(b).price);
    if (sort === "maior") return by((a, b) => priceOf(b).price - priceOf(a).price);
    if (sort === "nome") return by((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    if (sort === "ofertas") return by((a, b) => Number(priceOf(b).off) - Number(priceOf(a).off));
    return by((a, b) => Number(b.is_featured) - Number(a.is_featured));
  }, [active, q, cat, sort]);

  const selected = categories.find((c) => String(c.id) === cat);

  return (
    <main className="pet-root">
      <StoreSEO
        title={`${selected?.name || sf.catalog_title || "Catálogo"} | ${tenant.name}`}
        description={sf.catalog_description || tenant.about_text || `Produtos da ${tenant.name}.`}
        url={typeof window !== "undefined" ? window.location.href : ""}
        siteName={tenant.name}
      />
      <div className="pet-wrap">
        <div className="pet-chead">
          <span className="pet-pill-tag"><PawPrint size={16} /> {sf.segment_label || "Pet shop"}</span>
          <h1 className="pet-h">{selected?.name || sf.catalog_title || "Tudo para o seu pet"}</h1>
          <p>{sf.catalog_description || "Escolha o bichinho, busque pelo nome e encontre o item perfeito."}</p>
        </div>

        <div className="pet-filters" role="group" aria-label="Categorias">
          <button className="pet-fbtn" aria-pressed={!cat} onClick={() => update("cat", "")}><PawPrint size={20} /> Todos</button>
          {categories.filter((c) => countIn(c.id) > 0).map((c) => {
            const { Icon } = detectAnimal(c.name);
            return (
              <button key={c.id} className="pet-fbtn" aria-pressed={cat === String(c.id)} onClick={() => update("cat", String(c.id))}>
                <Icon size={20} /> {c.name}
              </button>
            );
          })}
        </div>

        <div className="pet-tools">
          <div className="pet-ts"><SearchBar value={q} onChange={(v) => update("q", v)} placeholder="Buscar produto" /></div>
          <label className="pet-sr" htmlFor="pet-sort">Ordenar</label>
          <select id="pet-sort" className="pet-select" value={sort} onChange={(e) => update("sort", e.target.value === "featured" ? "" : e.target.value)}>
            <option value="featured">Queridinhos</option>
            {!hidden && <option value="menor">Menor preço</option>}
            {!hidden && <option value="maior">Maior preço</option>}
            <option value="ofertas">Ofertas primeiro</option>
            <option value="nome">Nome (A-Z)</option>
          </select>
        </div>

        <p className="pet-count" aria-live="polite">{visible.length} {visible.length === 1 ? "produto encontrado" : "produtos encontrados"}{q && ` para "${q}"`}</p>

        {visible.length === 0 ? (
          <div className="pet-empty" style={{ marginBottom: 56 }}>
            <PawPrint size={44} />
            <h3>Nenhum produto por aqui</h3>
            <p>Que tal tentar outra busca ou outra categoria?</p>
            <button className="pet-btn" onClick={() => setParams(params.get("previewTheme") ? { previewTheme: params.get("previewTheme") as string } : {})}>Limpar filtros</button>
          </div>
        ) : (
          <>
            <div className="pet-grid">{visible.slice(0, limit).map((p, i) => <Card key={p.id} product={p} index={i} />)}</div>
            {limit < visible.length && (
              <div className="pet-more">
                <button className="pet-btn pet-btn--sun" onClick={() => setLimit((l) => l + PAGE)}><Plus size={20} /> Ver mais ({visible.length - limit})</button>
              </div>
            )}
          </>
        )}
        <div style={{ height: 64 }} />
      </div>
    </main>
  );
}
