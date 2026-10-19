import { CakeSlice } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import SearchBar from "../../../../components/layout/SearchBar";
import { productImage, useCatalog } from "./kit";
import { CategoryImage, Empty, ProductCard } from "./parts";
import "./styles.css";

export default function StoreCatalog() {
  const c = useCatalog(12);
  const { tenant, sf, categories, active, hidden } = c;
  const title = sf.catalog_title || "O cardápio da doceria";
  const desc = sf.catalog_description || "Doces, bolos e delícias feitos com carinho. Escolha o seu favorito.";
  const current = categories.find((x) => x.id === c.cat);
  const used = categories.filter((cat) => active.some((p) => p.category_id === cat.id));
  return (
    <div className="dc-page dc-catalog">
      <StoreSEO
        title={`${current ? `${current.name} | ` : ""}${title} | ${tenant.name}`}
        description={desc}
        image={tenant.banner_url || tenant.logo_url}
        url={typeof window !== "undefined" ? window.location.href : ""}
        siteName={tenant.name}
      />
      <header className="dc-cat-hero">
        <span className="dc-kicker">
          <CakeSlice size={15} aria-hidden="true" /> Cardápio
        </span>
        <h1>{title}</h1>
        <p>{desc}</p>
        <div className="dc-toolbar">
          <div className="dc-toolbar-search" role="search">
            <SearchBar value={c.q} onChange={(v) => c.setParam("q", v)} placeholder="Buscar por nome ou código" />
          </div>
          <label className="dc-select">
            <span className="dc-sr">Ordenar por</span>
            <select value={c.sort} onChange={(e) => c.setParam("sort", e.target.value === "destaques" ? null : e.target.value)}>
              <option value="destaques">Queridinhos primeiro</option>
              <option value="nome">Nome (A a Z)</option>
              {!hidden && <option value="menor">Menor preço</option>}
              {!hidden && <option value="maior">Maior preço</option>}
            </select>
          </label>
        </div>
      </header>

      <div className="dc-body">
        <div className="dc-bubbles" role="group" aria-label="Categorias" data-no-fx>
          <button type="button" className="dc-bubble" aria-pressed={!c.cat} onClick={() => c.setParam("categoria", null)}>
            <span className="dc-cat-photo">
              <CakeSlice size={30} aria-hidden="true" />
            </span>
            <strong>Todos</strong>
          </button>
          {used.map((cat) => (
            <button key={cat.id} type="button" className="dc-bubble" aria-pressed={c.cat === cat.id} onClick={() => c.setParam("categoria", String(cat.id))}>
              <CategoryImage src={cat.cover_url || productImage(active.find((p) => p.category_id === cat.id))} />
              <strong>{cat.name}</strong>
            </button>
          ))}
        </div>

        <p className="dc-count" role="status">
          {c.list.length} {c.list.length === 1 ? "doce encontrado" : "doces encontrados"}
          {current ? ` em ${current.name}` : ""}
        </p>

        {c.list.length ? (
          <>
            <div className="dc-grid">
              {c.shown.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
            {c.hasMore && (
              <div className="dc-more">
                <button type="button" className="dc-btn dc-btn-lg" onClick={c.more}>
                  Ver mais doces
                </button>
                <span>
                  Mostrando {c.shown.length} de {c.list.length}
                </span>
              </div>
            )}
          </>
        ) : (
          <Empty
            title={active.length ? "Esse doce não apareceu" : "A vitrine ainda está vazia"}
            text={active.length ? "Tente outro nome ou veja outro sabor." : "Volte em breve, estamos preparando novidades."}
            onClear={active.length ? c.clear : undefined}
          />
        )}
      </div>
    </div>
  );
}
