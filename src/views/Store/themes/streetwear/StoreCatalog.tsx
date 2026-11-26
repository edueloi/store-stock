import { useState, useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import StoreSEO from "../../../../components/store/StoreSEO";
import { useKit, priceInfo, productImage } from "../street/kit";
import type { Product } from "../../../../types";
import "./styles.css";

export default function StoreCatalog() {
  const { tenant, active, categories, path, hidden, catName } = useKit();
  const [params, setParams] = useSearchParams();

  const queryParam = params.get("q") || "";
  const catParam = params.get("categoria") ? Number(params.get("categoria")) : null;

  const [search, setSearch] = useState(queryParam);
  const [selectedCat, setSelectedCat] = useState<number | null>(catParam);
  const [priceRange, setPriceRange] = useState<string>("todos");
  const [sort, setSort] = useState<string>("featured");

  const filtered = useMemo(() => {
    let list = [...active];

    // Categoria
    if (selectedCat) {
      list = list.filter((p) => p.category_id === selectedCat);
    }

    // Busca textual
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((p) => {
        const name = p.name.toLowerCase();
        const brand = (p.attributes?.find((a) => a.name.toLowerCase() === "marca")?.values?.[0] || "").toLowerCase();
        const cat = catName(p).toLowerCase();
        return name.includes(q) || brand.includes(q) || cat.includes(q);
      });
    }

    // Faixa de preço
    if (priceRange === "under150") {
      list = list.filter((p) => Number(p.discount_price || p.price) <= 150);
    } else if (priceRange === "150to350") {
      list = list.filter((p) => {
        const val = Number(p.discount_price || p.price);
        return val > 150 && val <= 350;
      });
    } else if (priceRange === "above350") {
      list = list.filter((p) => Number(p.discount_price || p.price) > 350);
    }

    // Ordenação
    if (sort === "low") {
      list.sort((a, b) => Number(a.discount_price || a.price) - Number(b.discount_price || b.price));
    } else if (sort === "high") {
      list.sort((a, b) => Number(b.discount_price || b.price) - Number(a.discount_price || a.price));
    } else if (sort === "az") {
      list.sort((a, b) => a.name.localeCompare(b.name));
    }

    return list;
  }, [active, selectedCat, search, priceRange, sort, catName]);

  const handleCategorySelect = (id: number | null) => {
    setSelectedCat(id);
    if (id) {
      setParams({ categoria: String(id) });
    } else {
      setParams({});
    }
  };

  const renderProductCard = (p: Product) => {
    const prices = priceInfo(p, hidden);
    const img = productImage(p) || "https://images.unsplash.com/photo-1525966222134-fcfa99b8ae77?w=600&q=85";
    const brand = p.attributes?.find((a) => a.name.toLowerCase() === "marca")?.values?.[0] || catName(p) || "STREET";
    const tag = p.is_featured ? "BEST SELLER" : prices.off ? "SALE" : null;

    return (
      <Link key={p.id} to={path(`/produto/${p.id}`)} className="rua-product">
        <div className="rua-product-image">
          <img loading="lazy" src={img} alt={p.name} />
          {tag && <span className="rua-product-tag">{tag}</span>}
          <div className="rua-product-quick">Ver detalhes ↗</div>
        </div>
        <div className="rua-product-brand">{brand}</div>
        <div className="rua-product-name">{p.name}</div>
        <div className="rua-price">
          {prices.now}
          {prices.old && <span className="rua-old-price">{prices.old}</span>}
        </div>
      </Link>
    );
  };

  return (
    <div className="rua-root">
      <StoreSEO
        title={`Shop / Catálogo | ${tenant.name || "RUA013"}`}
        description="Todas as peças. Todas as vibes. Encontre seu próximo drop no corre streetwear e skate."
        url={typeof window !== "undefined" ? window.location.href : ""}
        siteName={tenant.name}
      />

      {/* PAGE BANNER */}
      <div className="rua-page-banner">
        <div className="rua-container">
          <span className="rua-eyebrow light">Escolha o seu próximo drop</span>
          <h1 className="rua-headline">SHOP / {(tenant.name || "RUA013").toUpperCase()}.</h1>
          <p>Todas as peças. Todas as vibes. Do seu jeito.</p>
        </div>
      </div>

      {/* CATALOG MAIN LAYOUT */}
      <div className="rua-container rua-catalog-layout">
        {/* SIDEBAR */}
        <aside className="rua-sidebar">
          <div className="rua-filter-group">
            <h3>Buscar</h3>
            <input
              type="search"
              placeholder="Produto ou marca..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="rua-search-input"
            />
          </div>

          <div className="rua-filter-group">
            <h3>Categorias</h3>
            <button
              type="button"
              className={selectedCat === null ? "selected" : ""}
              onClick={() => handleCategorySelect(null)}
            >
              Todos os produtos
            </button>
            {categories.map((c) => (
              <button
                key={c.id}
                type="button"
                className={selectedCat === c.id ? "selected" : ""}
                onClick={() => handleCategorySelect(c.id)}
              >
                {c.name}
              </button>
            ))}
          </div>

          <div className="rua-filter-group">
            <h3>Preço</h3>
            <button
              type="button"
              className={priceRange === "todos" ? "selected" : ""}
              onClick={() => setPriceRange("todos")}
            >
              Todos
            </button>
            <button
              type="button"
              className={priceRange === "under150" ? "selected" : ""}
              onClick={() => setPriceRange("under150")}
            >
              Até R$ 150
            </button>
            <button
              type="button"
              className={priceRange === "150to350" ? "selected" : ""}
              onClick={() => setPriceRange("150to350")}
            >
              R$ 150 a R$ 350
            </button>
            <button
              type="button"
              className={priceRange === "above350" ? "selected" : ""}
              onClick={() => setPriceRange("above350")}
            >
              Acima de R$ 350
            </button>
          </div>
        </aside>

        {/* PRODUCTS AREA */}
        <div>
          <div className="rua-catalog-toolbar">
            <span>
              {filtered.length} {filtered.length === 1 ? "produto encontrado" : "produtos encontrados"}
            </span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              aria-label="Ordenar produtos"
            >
              <option value="featured">Destaques</option>
              <option value="low">Menor preço</option>
              <option value="high">Maior preço</option>
              <option value="az">Nome A–Z</option>
            </select>
          </div>

          {filtered.length > 0 ? (
            <div className="rua-product-grid rua-catalog-products">
              {filtered.map(renderProductCard)}
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: "80px 20px", color: "var(--rua-muted)" }}>
              <p style={{ fontSize: 16, fontWeight: 700, color: "var(--rua-ink)" }}>Nenhum produto encontrado.</p>
              <p style={{ fontSize: 13, marginTop: 6 }}>Tente remover filtros ou pesquisar com outros termos.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
