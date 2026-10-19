import { useMemo, useState } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import { Search, X } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import { useStore } from "../../StoreLayout";
import { buildStorePath, resolveStoreSlug } from "../../store-routing";
import { VitraProductCard, VitraEmpty, vitraHidePrices } from "./ThemeParts";

export default function StoreCatalog() {
  const { slug: routeSlug } = useParams();
  const [params, setParams] = useSearchParams();
  const { tenant, products, categories, addToCart } = useStore();
  const slug = resolveStoreSlug(routeSlug);
  const path = (suffix = "") => buildStorePath(slug, suffix);

  const [query, setQuery] = useState(params.get("q") || "");
  const [priceRange, setPriceRange] = useState<string>("all");
  const [sort, setSort] = useState<string>("featured");

  const categoryId = params.get("cat") ? Number(params.get("cat")) : null;

  const chooseCategory = (id: number | null) => {
    const next = new URLSearchParams(params);
    if (id) next.set("cat", String(id));
    else next.delete("cat");
    setParams(next);
  };

  const clearAll = () => {
    chooseCategory(null);
    setQuery("");
    setPriceRange("all");
    setSort("featured");
  };

  const visible = useMemo(() => {
    let list = products.filter(
      (p) =>
        p.is_active &&
        (!categoryId || p.category_id === categoryId) &&
        (!query ||
          `${p.name} ${p.description || ""}`.toLowerCase().includes(query.toLowerCase())),
    );

    // Price range filter
    if (priceRange === "0-300") {
      list = list.filter((p) => Number(p.discount_price || p.price) <= 300);
    } else if (priceRange === "300-800") {
      list = list.filter((p) => {
        const val = Number(p.discount_price || p.price);
        return val > 300 && val <= 800;
      });
    } else if (priceRange === "800+") {
      list = list.filter((p) => Number(p.discount_price || p.price) > 800);
    }

    // Sort
    if (sort === "asc") {
      list = [...list].sort((a, b) => Number(a.discount_price || a.price) - Number(b.discount_price || b.price));
    } else if (sort === "desc") {
      list = [...list].sort((a, b) => Number(b.discount_price || b.price) - Number(a.discount_price || a.price));
    } else if (sort === "name") {
      list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    }

    return list;
  }, [products, categoryId, query, priceRange, sort]);

  const activeCategory = categories.find((c) => c.id === categoryId);

  return (
    <main className="vitra-root" style={{ minHeight: "100vh", paddingBottom: "80px" }}>
      <StoreSEO
        title={`Catálogo | ${tenant.name}`}
        description={`Confira todos os produtos, espelhos, boxes e esquadrias de vidro da ${tenant.name}.`}
        image={tenant.banner_url || tenant.logo_url}
        url={typeof window !== "undefined" ? window.location.href : ""}
        siteName={tenant.name}
        keywords={`${tenant.name}, vidros, catálogo, box, espelhos, esquadrias`}
      />

      {/* ── PAGE TITLE / HERO ── */}
      <section style={{ background: "var(--vitra-bg)", borderBottom: "1px solid var(--vitra-line)", padding: "48px 1.5rem" }}>
        <div style={{ maxWidth: 1250, margin: "0 auto" }}>
          <div style={{ color: "var(--vitra-muted)", fontSize: 12, marginBottom: 12 }}>
            <Link to={path()} style={{ textDecoration: "none", color: "inherit" }}>Início</Link>
            {" / "}
            <b style={{ color: "var(--vitra-ink)" }}>Catálogo</b>
            {activeCategory && ` / ${activeCategory.name}`}
          </div>
          <h1
            style={{
              fontFamily: "'Manrope', sans-serif",
              fontWeight: 800,
              fontSize: "clamp(2rem, 3.5vw, 2.75rem)",
              letterSpacing: "-1.5px",
              margin: 0,
              color: "var(--vitra-ink)",
            }}
          >
            Nosso catálogo
          </h1>
        </div>
      </section>

      {/* ── CATALOG BODY (SIDEBAR + GRID) ── */}
      <div style={{ maxWidth: 1250, margin: "0 auto", padding: "45px 1.5rem 0" }}>
        <style>{`
          @media (min-width: 900px) {
            .vitra-catalog-grid { grid-template-columns: 240px 1fr !important; }
            .vitra-product-columns { grid-template-columns: repeat(3, 1fr) !important; }
          }
        `}</style>
        <div
          className="vitra-catalog-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "1fr",
            gap: "36px",
            alignItems: "flex-start",
          }}
        >
          {/* ── SIDEBAR FILTERS ── */}
          <aside
            style={{
              border: "1px solid var(--vitra-line)",
              borderRadius: 24,
              background: "#ffffff",
              padding: "24px",
            }}
          >
            <h3
              style={{
                fontFamily: "'Manrope', sans-serif",
                fontWeight: 800,
                fontSize: 16,
                margin: "0 0 20px",
                color: "var(--vitra-ink)",
              }}
            >
              Filtrar produtos
            </h3>

            {/* Categories */}
            <div style={{ borderTop: "1px solid var(--vitra-line)", padding: "18px 0" }}>
              <h4 style={{ fontSize: 11, margin: "0 0 14px", textTransform: "uppercase", letterSpacing: 1, color: "var(--vitra-muted)" }}>
                Categorias
              </h4>
              <div style={{ display: "grid", gap: "10px" }}>
                <label style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 13, color: "#42585d", cursor: "pointer" }}>
                  <input
                    type="radio"
                    name="category"
                    checked={categoryId === null}
                    onChange={() => chooseCategory(null)}
                    style={{ accentColor: "var(--vitra-accent)" }}
                  />
                  <span>Todas as categorias</span>
                </label>
                {categories.map((c) => (
                  <label key={c.id} style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 13, color: "#42585d", cursor: "pointer" }}>
                    <input
                      type="radio"
                      name="category"
                      checked={categoryId === c.id}
                      onChange={() => chooseCategory(c.id)}
                      style={{ accentColor: "var(--vitra-accent)" }}
                    />
                    <span>{c.name}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Price Ranges */}
            <div style={{ borderTop: "1px solid var(--vitra-line)", padding: "18px 0" }}>
              <h4 style={{ fontSize: 11, margin: "0 0 14px", textTransform: "uppercase", letterSpacing: 1, color: "var(--vitra-muted)" }}>
                Faixa de preço
              </h4>
              <div style={{ display: "grid", gap: "10px" }}>
                {[
                  { id: "all", label: "Todos os preços" },
                  { id: "0-300", label: "Até R$ 300" },
                  { id: "300-800", label: "R$ 300 – R$ 800" },
                  { id: "800+", label: "Acima de R$ 800" },
                ].map((range) => (
                  <label key={range.id} style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 13, color: "#42585d", cursor: "pointer" }}>
                    <input
                      type="radio"
                      name="price"
                      checked={priceRange === range.id}
                      onChange={() => setPriceRange(range.id)}
                      style={{ accentColor: "var(--vitra-accent)" }}
                    />
                    <span>{range.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <button
              onClick={clearAll}
              style={{
                border: 0,
                background: "transparent",
                color: "var(--vitra-accent-dark)",
                fontWeight: 800,
                fontSize: 12,
                borderBottom: "1px solid var(--vitra-accent)",
                padding: "8px 0",
                cursor: "pointer",
                marginTop: 6,
              }}
            >
              Limpar filtros
            </button>
          </aside>

          {/* ── MAIN PRODUCTS VIEW ── */}
          <div>
            {/* Toolbar */}
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "16px",
                marginBottom: "24px",
                color: "var(--vitra-muted)",
                fontSize: 13,
              }}
            >
              {/* Search in Catalog */}
              <div style={{ position: "relative", minWidth: 260, flex: 1, maxWidth: 420 }}>
                <Search
                  size={16}
                  style={{
                    position: "absolute",
                    left: 12,
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "var(--vitra-muted)",
                    pointerEvents: "none",
                  }}
                />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar peças, espelhos, boxes..."
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    border: "1px solid var(--vitra-line)",
                    borderRadius: 14,
                    padding: "10px 36px 10px 36px",
                    fontSize: 13,
                    outline: "none",
                    fontFamily: "inherit",
                  }}
                />
                {query && (
                  <button
                    onClick={() => setQuery("")}
                    style={{
                      position: "absolute",
                      right: 10,
                      top: "50%",
                      transform: "translateY(-50%)",
                      background: "none",
                      border: "none",
                      color: "var(--vitra-muted)",
                      cursor: "pointer",
                    }}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Count & Sort */}
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <span>
                  {visible.length} {visible.length === 1 ? "produto" : "produtos"}
                </span>
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value)}
                  aria-label="Ordenar produtos"
                  style={{
                    padding: "9px 12px",
                    border: "1px solid var(--vitra-line)",
                    background: "#ffffff",
                    color: "var(--vitra-ink)",
                    fontSize: 13,
                    borderRadius: 14,
                    outline: "none",
                    cursor: "pointer",
                  }}
                >
                  <option value="featured">Mais relevantes</option>
                  <option value="asc">Menor preço</option>
                  <option value="desc">Maior preço</option>
                  <option value="name">Nome A–Z</option>
                </select>
              </div>
            </div>

            {/* Products Grid */}
            {visible.length > 0 ? (
              <div
                className="vitra-product-columns"
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
                  gap: "20px",
                }}
              >
                {visible.map((p) => (
                  <VitraProductCard
                    key={p.id}
                    product={p}
                    category={categories.find((c) => c.id === p.category_id)?.name}
                    path={path}
                    onAdd={() => addToCart(p)}
                    hidePrices={vitraHidePrices(tenant)}
                  />
                ))}
              </div>
            ) : (
              <VitraEmpty onClear={clearAll} />
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
