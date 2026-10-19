import { Search, Shirt } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import { useCatalog } from "../street/kit";
import { Empty, ProductCard, SortSelect, categoryImage } from "../street/shared";
import "./styles.css";

export default function StoreCatalog() {
  const c = useCatalog(12);
  const { tenant, sf, categories, active, hidden } = c;
  const title = sf.catalog_title || "Catálogo";
  const desc = sf.catalog_description || "Todas as peças, em um só lugar.";
  const current = categories.find((x) => x.id === c.cat);
  const used = categories.filter((x) => active.some((p) => p.category_id === x.id));
  return (
    <div className="ur-page ur-catalog">
      <StoreSEO
        title={`${current ? `${current.name} | ` : ""}${title} | ${tenant.name}`}
        description={desc}
        image={tenant.banner_url || tenant.logo_url}
        url={typeof window !== "undefined" ? window.location.href : ""}
        siteName={tenant.name}
      />
      <header className="ur-cat-head">
        <div>
          <span className="ur-mono">{String(c.list.length).padStart(2, "0")} itens</span>
          <h1>{current ? current.name : title}</h1>
          <p>{desc}</p>
        </div>
        <div className="ur-tools">
          <label className="ur-find">
            <Search size={18} aria-hidden="true" />
            <input type="search" value={c.q} onChange={(e) => c.setParam("q", e.target.value)} placeholder="Buscar no catálogo" aria-label="Buscar no catálogo" />
          </label>
          <SortSelect t="ur" sort={c.sort} hidden={hidden} onChange={(v) => c.setParam("sort", v)} />
        </div>
      </header>

      <div className="ur-stories" role="group" aria-label="Categorias">
        <button type="button" aria-pressed={!c.cat} onClick={() => c.setParam("categoria", null)}>
          <span className="ur-ring ur-ring-all">
            <Shirt size={24} />
          </span>
          <b>Tudo</b>
        </button>
        {used.map((cat) => (
          <button key={cat.id} type="button" aria-pressed={c.cat === cat.id} onClick={() => c.setParam("categoria", String(cat.id))}>
            <span className="ur-ring">{categoryImage(cat, active) ? <img src={categoryImage(cat, active)} alt="" loading="lazy" /> : <Shirt size={24} />}</span>
            <b>{cat.name}</b>
          </button>
        ))}
      </div>

      {c.list.length ? (
        <>
          <div className="ur-grid" role="status" aria-live="polite">
            {c.shown.map((p) => (
              <ProductCard key={p.id} product={p} t="ur" />
            ))}
          </div>
          {c.hasMore && (
            <div className="ur-more">
              <button type="button" className="ur-btn ur-btn-solid ur-btn-lg" onClick={c.more}>
                Carregar mais
              </button>
              <span>
                {c.shown.length} de {c.list.length}
              </span>
            </div>
          )}
        </>
      ) : (
        <Empty t="ur" title={active.length ? "Nada encontrado" : "Em breve"} text={active.length ? "Tente outro termo ou outra categoria." : "Estamos montando o catálogo."} onClear={active.length ? c.clear : undefined} />
      )}
    </div>
  );
}
