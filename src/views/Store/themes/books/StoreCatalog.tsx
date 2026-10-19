import { BookOpen } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import SearchBar from "../../../../components/layout/SearchBar";
import { useCatalog } from "./kit";
import { BookCard, Empty } from "./parts";
import "./styles.css";

export default function StoreCatalog() {
  const c = useCatalog(15);
  const { tenant, sf, categories, active, hidden } = c;
  const title = sf.catalog_title || "Todos os livros";
  const desc = sf.catalog_description || "Navegue pelos gêneros e encontre a próxima leitura.";
  const current = categories.find((x) => x.id === c.cat);
  const used = categories.filter((cat) => active.some((p) => p.category_id === cat.id));
  return (
    <div className="bk-page bk-catalog">
      <StoreSEO
        title={`${current ? `${current.name} | ` : ""}${title} | ${tenant.name}`}
        description={desc}
        image={tenant.banner_url || tenant.logo_url}
        url={typeof window !== "undefined" ? window.location.href : ""}
        siteName={tenant.name}
      />
      <header className="bk-cat-head">
        <span className="bk-kicker">
          <BookOpen size={15} aria-hidden="true" /> Catálogo
        </span>
        <h1>{current ? current.name : title}</h1>
        <p>{desc}</p>
      </header>

      <div className="bk-filterbar">
        <div className="bk-filter-search" role="search">
          <SearchBar value={c.q} onChange={(v) => c.setParam("q", v)} placeholder="Título, autor ou código" />
        </div>
        <label className="bk-select">
          <span>Ordenar</span>
          <select value={c.sort} onChange={(e) => c.setParam("sort", e.target.value === "destaques" ? null : e.target.value)}>
            <option value="destaques">Destaques primeiro</option>
            <option value="nome">Título (A a Z)</option>
            {!hidden && <option value="menor">Menor preço</option>}
            {!hidden && <option value="maior">Maior preço</option>}
          </select>
        </label>
      </div>

      <div className="bk-tabs" role="group" aria-label="Gêneros" data-no-fx>
        <button type="button" aria-pressed={!c.cat} onClick={() => c.setParam("categoria", null)}>
          Todos <small>{active.length}</small>
        </button>
        {used.map((cat) => (
          <button key={cat.id} type="button" aria-pressed={c.cat === cat.id} onClick={() => c.setParam("categoria", String(cat.id))}>
            {cat.name} <small>{active.filter((p) => p.category_id === cat.id).length}</small>
          </button>
        ))}
      </div>

      <p className="bk-count" role="status">
        {c.list.length} {c.list.length === 1 ? "livro encontrado" : "livros encontrados"}
        {current ? ` em ${current.name}` : ""}
      </p>

      {c.list.length ? (
        <>
          <div className="bk-grid">
            {c.shown.map((p) => (
              <BookCard key={p.id} product={p} />
            ))}
          </div>
          {c.hasMore && (
            <div className="bk-more">
              <button type="button" className="bk-btn bk-btn-lg" onClick={c.more}>
                Ver mais livros
              </button>
              <span>
                Mostrando {c.shown.length} de {c.list.length}
              </span>
            </div>
          )}
        </>
      ) : (
        <Empty
          title={active.length ? "Nenhum livro com essa busca" : "A estante ainda está vazia"}
          text={active.length ? "Tente outro título ou escolha outro gênero." : "Volte em breve, estamos recebendo novidades."}
          onClear={active.length ? c.clear : undefined}
        />
      )}
    </div>
  );
}
