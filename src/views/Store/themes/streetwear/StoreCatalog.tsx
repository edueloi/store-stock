import { useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { ArrowUpDown, Flame, Search, X, Zap } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import { useStore } from "../../StoreLayout";
import { buildStorePath, resolveStoreSlug } from "../../store-routing";
import { SwProductCard, SwEmpty, swHidePrices } from "./ThemeParts";

export default function StoreCatalog() {
  const { slug: routeSlug } = useParams();
  const [params, setParams] = useSearchParams();
  const { tenant, products, categories, addToCart, wishlist, toggleWishlist } = useStore();
  const slug = resolveStoreSlug(routeSlug);
  const path = (suffix = "") => buildStorePath(slug, suffix);

  const [query, setQuery] = useState(params.get("q") || "");
  const [sortBy, setSortBy] = useState<"featured" | "price_asc" | "price_desc" | "name">("featured");
  const categoryId = params.get("cat") ? Number(params.get("cat")) : null;

  const visible = useMemo(() => {
    let list = products.filter(
      (p) =>
        p.is_active &&
        (!categoryId || p.category_id === categoryId) &&
        (!query ||
          `${p.name} ${p.description || ""}`.toLowerCase().includes(query.toLowerCase())),
    );

    if (sortBy === "price_asc") {
      list = [...list].sort((a, b) => Number(a.discount_price || a.price) - Number(b.discount_price || b.price));
    } else if (sortBy === "price_desc") {
      list = [...list].sort((a, b) => Number(b.discount_price || b.price) - Number(a.discount_price || a.price));
    } else if (sortBy === "name") {
      list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    }
    return list;
  }, [products, categoryId, query, sortBy]);

  const choose = (id: number | null) => {
    const next = new URLSearchParams(params);
    if (id) next.set("cat", String(id));
    else next.delete("cat");
    setParams(next);
  };

  const currentCategoryName = categories.find((c) => c.id === categoryId)?.name;

  return (
    <main
      className="sw-root"
      style={{
        minHeight: "100vh",
        background: "#09090b",
        color: "#f4f4f5",
        fontFamily: "'Inter', sans-serif",
        paddingBottom: "5rem",
      }}
    >
      <StoreSEO
        title={`Catálogo Oficial | ${tenant.name}`}
        description={`Explore todos os drops e peças exclusivas da ${tenant.name}.`}
        image={tenant.banner_url || tenant.logo_url}
        url={typeof window !== "undefined" ? window.location.href : ""}
        siteName={tenant.name}
        keywords={`${tenant.name}, streetwear, catálogo, drops, moda urbana`}
      />

      {/* ── HEADER BANNER ── */}
      <section
        style={{
          background: "linear-gradient(180deg, #18181b 0%, #09090b 100%)",
          borderBottom: "1px solid #27272a",
          padding: "4rem 1.5rem 3rem",
        }}
      >
        <div style={{ maxWidth: 1280, margin: "0 auto" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "#facc15", fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".18em", marginBottom: ".75rem" }}>
            <Zap size={14} /> CATÁLOGO & DROPS ATIVOS
          </div>
          <h1
            style={{
              fontSize: "clamp(2.25rem, 6vw, 4.25rem)",
              fontWeight: 900,
              textTransform: "uppercase",
              lineHeight: 0.9,
              letterSpacing: "-0.05em",
              margin: "0 0 1rem",
            }}
          >
            ESCOLHA SUA<br />
            <span style={{ color: "#facc15" }}>PRÓXIMA PEÇA.</span>
          </h1>
          <p style={{ color: "#a1a1aa", fontSize: ".95rem", maxWidth: 540, margin: 0 }}>
            {tenant.about_text || "Toda a coleção autêntica disponível para entrega rápida e pronta retirada."}
          </p>
        </div>
      </section>

      {/* ── FILTER & SEARCH TOOLBAR ── */}
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "2.5rem 1.5rem 0" }}>
        <div
          style={{
            background: "#18181b",
            border: "1px solid #27272a",
            borderRadius: "1.25rem",
            padding: "1.25rem",
            display: "flex",
            flexDirection: "column",
            gap: "1.25rem",
          }}
        >
          {/* Top row: Search and Sort */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem", alignItems: "center", justifyContent: "space-between" }}>
            {/* Search input */}
            <div style={{ position: "relative", flex: "1 1 280px", maxWidth: 460 }}>
              <Search
                size={16}
                style={{
                  position: "absolute",
                  left: 14,
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "#facc15",
                  pointerEvents: "none",
                }}
              />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar por nome, estampa, peça..."
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  background: "#09090b",
                  border: "1px solid #3f3f46",
                  borderRadius: "12px",
                  padding: "12px 40px 12px 42px",
                  fontSize: ".875rem",
                  color: "#f4f4f5",
                  outline: "none",
                  fontFamily: "'Inter', sans-serif",
                  transition: "border-color .2s",
                }}
                onFocus={(e) => ((e.currentTarget as HTMLInputElement).style.borderColor = "#facc15")}
                onBlur={(e) => ((e.currentTarget as HTMLInputElement).style.borderColor = "#3f3f46")}
              />
              {query && (
                <button
                  onClick={() => setQuery("")}
                  style={{
                    position: "absolute",
                    right: 12,
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    color: "#71717a",
                    cursor: "pointer",
                  }}
                >
                  <X size={15} />
                </button>
              )}
            </div>

            {/* Sort Dropdown */}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <ArrowUpDown size={14} style={{ color: "#facc15" }} />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                style={{
                  background: "#09090b",
                  border: "1px solid #3f3f46",
                  borderRadius: "12px",
                  color: "#f4f4f5",
                  padding: "11px 16px",
                  fontSize: ".8rem",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: ".05em",
                  outline: "none",
                  cursor: "pointer",
                }}
              >
                <option value="featured">Relevância / Destaques</option>
                <option value="price_asc">Menor Preço</option>
                <option value="price_desc">Maior Preço</option>
                <option value="name">Nome (A - Z)</option>
              </select>
            </div>
          </div>

          {/* Category Filter Pills */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: ".5rem",
              borderTop: "1px solid rgba(255, 255, 255, 0.06)",
              paddingTop: "1rem",
            }}
          >
            <button
              onClick={() => choose(null)}
              style={{
                flexShrink: 0,
                border: `1px solid ${!categoryId ? "#facc15" : "#3f3f46"}`,
                background: !categoryId ? "#facc15" : "#09090b",
                color: !categoryId ? "#000" : "#a1a1aa",
                padding: "8px 16px",
                fontSize: 11,
                fontWeight: 800,
                textTransform: "uppercase",
                letterSpacing: ".08em",
                borderRadius: 10,
                cursor: "pointer",
                transition: "all .2s",
              }}
            >
              Todos ({products.filter((p) => p.is_active).length})
            </button>
            {categories.map((cat) => {
              const isSelected = categoryId === cat.id;
              const count = products.filter((p) => p.is_active && p.category_id === cat.id).length;
              if (count === 0) return null;
              return (
                <button
                  key={cat.id}
                  onClick={() => choose(cat.id)}
                  style={{
                    flexShrink: 0,
                    border: `1px solid ${isSelected ? "#facc15" : "#3f3f46"}`,
                    background: isSelected ? "#facc15" : "#09090b",
                    color: isSelected ? "#000" : "#a1a1aa",
                    padding: "8px 16px",
                    fontSize: 11,
                    fontWeight: 800,
                    textTransform: "uppercase",
                    letterSpacing: ".08em",
                    borderRadius: 10,
                    cursor: "pointer",
                    transition: "all .2s",
                  }}
                >
                  {cat.name} ({count})
                </button>
              );
            })}
          </div>
        </div>

        {/* Status info bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: "1.75rem",
            marginBottom: "1.5rem",
          }}
        >
          <p style={{ fontSize: 11, fontWeight: 700, color: "#71717a", textTransform: "uppercase", letterSpacing: ".12em", margin: 0 }}>
            {visible.length} {visible.length === 1 ? "peça encontrada" : "peças encontradas"}
          </p>

          {(categoryId || query) && (
            <button
              onClick={() => {
                choose(null);
                setQuery("");
              }}
              style={{
                background: "none",
                border: "none",
                color: "#facc15",
                fontSize: 11,
                fontWeight: 800,
                textTransform: "uppercase",
                letterSpacing: ".08em",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <X size={12} /> Limpar filtros
            </button>
          )}
        </div>

        {/* Products Grid */}
        {visible.length > 0 ? (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
              gap: "1.25rem",
            }}
          >
            {visible.map((product) => (
              <SwProductCard
                key={product.id}
                product={product}
                category={categories.find((c) => c.id === product.category_id)?.name}
                path={path}
                saved={wishlist.includes(product.id)}
                onFavorite={() => toggleWishlist(product.id)}
                onAdd={() => addToCart(product)}
                hidePrices={swHidePrices(tenant)}
              />
            ))}
          </div>
        ) : (
          <SwEmpty onClear={() => { choose(null); setQuery(""); }} />
        )}
      </div>
    </main>
  );
}
